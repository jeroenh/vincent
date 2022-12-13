from django.core.management.base import BaseCommand, CommandError
from cvdp.models import CaseState
import json
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Load but not overwrite case states'
    
    def add_arguments(self, parser):
        parser.add_argument('in', nargs=1, type=str)

    def handle(self, *args, **options):
        num_states = 0
        created = 0
        with open(options['in'][0], 'r') as f:
            states = json.load(f)
            for t in states:
                #don't update team templates (body_only = True)                                                
                state = CaseState.objects.filter(code=t['fields']['code']).first()

                if state:
                    num_states = num_states + 1
                    state.name = t['fields']['name']
                    state.description = t['fields']['description']
                    state.code = t['fields']['code']
                    state.parent = t['fields']['parent']
                    state.order = t['fields']['order']
                    state.color = t['fields']['color']
                    state.save()
                else:
                    created = created + 1
                    new_state = CaseState.objects.create(name=t['fields']['name'],
                                                         description = t['fields']['description'],
                                                         code = t['fields']['code'],
                                                         parent = t['fields']['parent'],
                                                         order = t['fields']['order'],
                                                         color = t['fields']['color'])
                    

            logger.info(f"Updated {num_states} states, created {created} new states")
