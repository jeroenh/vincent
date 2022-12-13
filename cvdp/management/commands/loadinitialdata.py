import logging
import os.path
from os import path
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.contrib.auth.models import Permission
from cvdp.models import *

from django.conf import settings

logger = logging.getLogger(__name__)

MODELS = ['user', 'group', 'groupprofile']
PERMISSIONS = ['view', 'change']


class Command(BaseCommand):
    help = 'Load Initial Data'

    
    def handle(self, *args, **options):
        
        logger.info("Loading email templates.")
        if EmailTemplate.objects.count() > 0:
            logger.info("Email Templates already exist")
            # just need to update templates, not rewrite them                      
            call_command('loadtemplates', 'cvdp/fixtures/EmailTemplate.json')
        else:
            call_command('loaddata', 'EmailTemplate.json')
            logger.info("Done loading email templates.")

        call_command('loadcwe', 'cvdp/fixtures/cwec_v4.14.xml')
        logger.info("Done loading CWE Info")

        logger.info("Loading Case States.")
        if CaseState.objects.count() > 0:
            logger.info("States already loaded... updating")
            call_command('loadstates', 'cvdp/fixtures/CaseState.json')

        else:
            call_command('loaddata', 'CaseState.json')


        if not Group.objects.filter(name="coordinator").exists():
            Group.objects.create(name='coordinator')
        if not Group.objects.filter(name="coordinator_mgr").exists():
            Group.objects.create(name='coordinator_mgr')
        if not Group.objects.filter(name="user_admin").exists():
            Group.objects.create(name="user_admin")

        useradmingroup = Group.objects.get(name="user_admin")
        for model in MODELS:
            for permission in PERMISSIONS:
                name = f"{permission}_{model}"
                logger.info(f"Granting permission {name} to user_admin role")
                try:
                    model_add_perms = Permission.objects.filter(codename=name)
                except Permission.DoesNotExist:
                    logger.warning(f"Permission not found with name {name}")
                    continue
                for p in model_add_perms:
                    useradmingroup.permissions.add(p)
            
        if "adscore" in settings.INSTALLED_APPS:
            from adscore.models import SSVCDecisionTable
            if SSVCDecisionTable.objects.count() > 0:
                logger.info("SSVC already loaded")
            else:
               call_command('loaddata', 'ssvc_decision.json')

            if not Group.objects.filter(name="analyst").exists():
                Group.objects.create(name='analyst')
            if not Group.objects.filter(name="analyst_mgr").exists():
                Group.objects.create(name='analyst_mgr')
            if not Group.objects.filter(name="analysis_creator").exists():
                Group.objects.create(name='analysis_creator')
