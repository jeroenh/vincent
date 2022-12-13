import django
django.setup()
import logging
import multiprocessing
from django.conf import settings
from django.db import close_old_connections, connections
from cvdp.manage.models import AdviseTask, AdviseScheduledTask
from cvdp.mailer import mailer_send_email
from datetime import datetime, timedelta
from django.utils.module_loading import import_string
from django.utils import timezone
import json
import traceback
import time

#logging.getLogger(__name__)
logger = multiprocessing.log_to_stderr() 
logger.setLevel(logging.INFO)


def mp_django_setup():
    # ensure we have a clean django environment and db slate in each
    # pool process
    django.setup()
    close_old_connections()

def check_tasks():
    close_old_connections()
    return AdviseTask.objects.filter(completed__isnull=True, running=False)

def run_adhoc_task(task):
    # get a clean environment
    # note: this is now done by initializer in pool [JDW]
    #mp_django_setup()

    #make sure task hasn't been picked up
    #updated_task = AdviseTask.objects.get(id=task.id)
    rows = AdviseTask.objects.filter(id=task.id, running=False).update(running=True)
    if rows != 1:
        # abort - may be still running
        return

    try:
        logger.debug(f"got task: {task.task_info} (ID: {task.id})")
        if task.task_type == 1:
            # mailer task
            subject = task.task_info.pop('subject', None)
            message = task.task_info.pop('message')
            recipients = task.task_info.pop('recipients')
            mailer_send_email(subject, message, recipients, **task.task_info)
        elif task.task_type == 2:
            logger.info(f"Unhandled task type 2: {task.task_info}")
        else:
            logger.info(f"Undefined task type {task.task_type}: {task.task_info}")
    except json.JSONDecodeError as e:
        logger.error(f"Unable to decode JSON for task: {e} (raw JSON: {task.task_info})")
    except Exception as e:
        logger.error(f"Unknown error trying to process task: {e} (task info: {task.task_info})")

    AdviseTask.objects.filter(id=task.id).update(completed=timezone.now(), running=False)


def check_scheduled_tasks(runtime):
    close_old_connections()
    tasks = AdviseScheduledTask.objects.filter(enabled=True)
    #runtime = timezone.now()
    tasks_to_run = []
    # notes:
    # We could check first for tasks that have not been run and queue those,
    # then check for tasks whose next_run <= runtime. Any first-run tasks
    # would need to have next_run set based on periodicity at runtime. Minor
    # problem: a task updated with a new periodicity significantly shorter
    # than it was will be delayed for the old periodicity until they get
    # queued and updated. This is maybe more efficient if there are lots of
    # periodic tasks, however, and the delay issue could be solved by having
    # the form process set next_run whenever the task is saved.
    #
    # Alternate idea (and what I'm doing here): Just get all tasks, check
    # against periodicity and last_run, queue if needed, and update after
    # run.
    for t in tasks:
        if t.next_run and t.next_run <= runtime:
            # next run is set and prior to now
            tasks_to_run.append(t)
        elif not t.last_run and not t.next_run:
            # task has not been run yet
            # set next_run and move on
            if t.run_at_time:
                if t.run_at_time < runtime.time():
                    # before current time, so set to tomorrow at this time
                    t.next_run = datetime.combine((runtime + timedelta(days=1)), t.run_at_time)
                else:
                    t.next_run = datetime.combine(runtime, t.run_at_time)
            else:
                t.next_run = runtime + timedelta(seconds=t.period)
            t.save()
        else:
            # next run is set, not now, move on
            # We could also end up here if somehow next run is not
            # set but last_run is, which would be weird.
            continue
    return tasks_to_run


def run_scheduled_task(taskinfo):
    # get a clean environment
    # note: this is now done by initializer in pool [JDW]
    #mp_django_setup()

    django.db.connections.close_all()
    
    task = taskinfo[0]
    runtime = taskinfo[1]

    #make sure task hasn't been picked up
    #updated_task = AdviseScheduledTask.objects.get(id=task.id)
    rows = AdviseScheduledTask.objects.filter(id=task.id, running=False).update(running=True)
    if rows == 0:
        # task is apparently still marked as running, so check the timeout
        # if honor_timeout is true, check against the last run time
        if task.timeout and (timezone.now() - task.last_run > timedelta(seconds=task.timeout)):
            # reset running and return, let scheduler pick it up on the next cycle
            logger.warning(f"Possible dead task, cleared running flag (task = {task.task}, last_run = {task.last_run}, timeout = {timedelta(seconds=task.timeout)})")
            task.running = False
            task.save()
            return
        else:
            # abort - may be still running
            return

    try:
        logger.info(f"got scheduled task: {task.task} (ID: {task.id})")
        do_task = import_string(task.task)
        # do things!
        if task.task_info:
            #if this task has args
            do_task(**task.task_info)
        else:
            do_task()
        logger.info(f"done with task {task.task} (ID: {task.id})")
    except json.JSONDecodeError as e:
        logger.error(f"Unable to decode JSON for task: {e} (raw JSON: {task.task_info})")
    except Exception as e:
        logger.error(f"Unknown error trying to process task: {e} (task info: {task.task_info})")
        logger.error(traceback.format_exc())
        #print(traceback.format_exc())
        # Note: By doing nothing here, we let the task schedule itself for
        #       whatever the next cycle is. If we return here instead, the
        #       task should get picked up on the next task check cycle.
        #       Which is preferred? For now, do nothing and reschedule the
        #       task as if it had run to avoid fast cycling failing tasks. [JDW]

    # refresh task settings in case anything was changed during the run
    task.refresh_from_db()
    # reset runtime to now so that we cycle based on periodicity instead of start time
    runtime = timezone.now()
    next_run = (runtime + timedelta(seconds = task.period))
    if task.run_at_time:
        next_run = (runtime + timedelta(days=1)).combine(time=task.run_at_time)
    AdviseScheduledTask.objects.filter(id=task.id).update(last_run=timezone.now(), next_run=next_run, running=False) 



#    if settings.DEPLOYMENT_TYPE == 'AWS':
#        import boto3
#        client = boto3.client('sqs')
#        msgs = client.receive_message(QueueUrl=settings.ADVISE_WORKER_SQS_ARN, WaitTimeSeconds=settings.ADVISE_WORKER_SQS_WAIT_TIME)
#        logger.debug(f"We got messages from SQS: {msgs}")
#        for m in msgs:
#            try:
#                process_message(m)
#            except Exception as e:
#                logger.error(f"Unable to process message from SQS: {e}")
#                continue
#            try:
#                client.delete_message(QueueUrl=settings.ADVISE_WORKER_SQS_ARN, ReceiptHandle=m['ReceiptHandle'])
#            except Exception as e:
#                logger.error(f"Unable to delete successfully processed message: {e}")
#    else:
#        raise RuntimeError("No alternate method defined to process jobs... ")

#def long_task_a():
#    time.sleep(30)
#def long_task_b():
#    time.sleep(60)
#def long_task_c():
#    time.sleep(45)
#def long_task_d():
#    time.sleep(95)
#def long_task_e():
#    time.sleep(5)
#def long_task_f():
#    time.sleep(100)
