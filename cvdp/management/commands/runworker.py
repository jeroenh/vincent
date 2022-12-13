import django
django.setup()
from django.core.management.base import BaseCommand, CommandError
from cvdp.manage.models import AdviseTask, AdviseScheduledTask
from vincent_worker.tasks import check_tasks, check_scheduled_tasks, run_adhoc_task, run_scheduled_task, mp_django_setup
from django.utils import timezone
from django.db import close_old_connections
import time
import logging
import traceback
import multiprocessing
import concurrent.futures
#from multiprocessing import Pool

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Run the polling process to process worker jobs'
    poll_seconds = 10
    workers = 4
    
    def add_arguments(self, parser):
        parser.add_argument('--workers', default=4, type=int, help='Number of workers to run')

        
    def handle(self, *args, **options):
        workers = options.get('workers')
        logger.info(f"Starting worker event polling loop with {workers} workers (poll time {self.poll_seconds} seconds)")

        #make sure tasks aren't stuck in "running"
        # TODO: If we start another worker task, this breaks and could reset tasks that are
        #       running legitimately. We need a better way to handle that case to know if
        #       there are other active workers and only reset tasks if there are none, but
        #       that is also hard because a redeploy will start a new worker task before
        #       terminating the old one. Task timeouts are probably the way to go, but those
        #       can be risky for long-running tasks. Some thought needs to occur here. [JDW]
        AdviseScheduledTask.objects.filter(enabled=True, running=True).update(running=False)
        AdviseTask.objects.filter(completed__isnull=True, running=True).update(running=False)
            
        #mp_context = multiprocessing.get_context('spawn')

        # inflight tracking
        inflight_adhoc = {}
        inflight_scheduled = {}

        #with concurrent.futures.ProcessPoolExecutor(max_workers=workers, mp_context=mp_context, initializer=mp_django_setup) as executor:
        with concurrent.futures.ProcessPoolExecutor(max_workers=workers, initializer=mp_django_setup) as executor:
            while True:
                try:
                    # clean up completed tasks
                    _prune_completed(inflight_adhoc)
                    _prune_completed(inflight_scheduled)

                    adhoc = check_tasks()
                    for task in adhoc:
                        if task.id not in inflight_adhoc:
                            future = executor.submit(run_adhoc_task, task)
                            inflight_adhoc[task.id] = future
                    
                    runtime = timezone.now()
                    scheduled = check_scheduled_tasks(runtime)
                    for task in scheduled:
                        if task.id not in inflight_scheduled:
                            future = executor.submit(run_scheduled_task, (task, runtime))
                            inflight_scheduled[task.id] = future
                except:
                    logger.warning("Error occurred while checking for tasks:")
                    logger.warning(traceback.format_exc())
                    logger.warning(f"Clearing DB connections and will try again in {self.poll_seconds} seconds")
                    close_old_connections()
                time.sleep(self.poll_seconds)

def _prune_completed(inflight: dict):
    # remove futures that have finished
    done_keys = [k for k, fut in inflight.items() if fut.done()]
    for k in done_keys:
        fut = inflight.pop(k)
        exc = fut.exception()
        if exc:
            logger.error(f"Task {k} failed with: {exc}")

