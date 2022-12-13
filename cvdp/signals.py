from authapp.models import User
from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from cvdp.models import UserProfile, Case, CaseThread, Contact, message_sent, PostRevision
from django.conf import settings
from cvdp.manage.models import AdVISEConnection
from django.core.exceptions import ObjectDoesNotExist
from cvdp.appcomms.appcommunicator import cvdp_send_email
from cvdp.lib import setup_new_case, get_casethread_user_participants, get_post_mentions, create_ticket
from corsheaders.signals import check_request_enabled
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

@receiver(check_request_enabled)
def cors_allow_mysites(sender, request, **kwargs):
    test = AdVISEConnection.objects.filter(url=request.headers["origin"], disabled=False).exists()
    if test:
        logger.debug(f"origin is disabled: {request.headers['origin']}")        
    return test


#check_request_enabled.connect(cors_allow_mysites)

@receiver(pre_save, sender=settings.AUTH_USER_MODEL)
def update_username_from_email(sender, instance, **kwargs):
    instance.username = instance.email


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_userprofile(sender, instance, created, using, **kwargs):
    """
    Helper function to create Profile when User is created 
    """
    if created:
        from cvdp.settings import DEFAULT_USER_SETTINGS
        muser = UserProfile.objects.create(user=instance, settings=DEFAULT_USER_SETTINGS)
        muser.save()

        #every user is contact
        Contact.objects.update_or_create(email=instance.email, defaults={
            'name':instance.get_full_name(),
            'user':instance,
            })
        

@receiver(post_save, sender=Case)
def create_case_officialthread(sender, instance, created, **kwargs):
    if created:
        setup_new_case(instance)

"""
@receiver(pre_save, sender=Case)
def log_case_state_transition(sender, instance, **kwargs):
    if instance.pk:
        try:
            old_instance = sender.objects.get(pk=instance.pk)
        except ObjectDoesNotExist:
            return
"""

@receiver(message_sent)
def send_message_notification(sender, message, thread, reply, from_group, **kwargs):

    create_ticket(message)
    
    if reply:
        template = 'reply_message'
    else:
        template = 'new_message'
    email_context = {'template': template, 'sender': message.sender.screen_name, 'url': f'{settings.SERVER_NAME}{message.thread.get_absolute_url()}'}
    
    recipients = []
    for recip in thread.userthread_set.exclude(user=message.sender):
        recipients.append(recip.user.email)

    cvdp_send_email(None, None, recipients, **email_context)

    #coord teams get added on automatically and there's no need to send an email
    #since these messages will be tracked with tickets
    #if from_group:
    #    groups = thread.groupthread_set.exclude(group=from_group)
    #else:
    #    groups = thread.groupthread_set.all()
            
    #for g in groups:
    #    users = User.objects.filter(groups=g.group).exclude(id=message.sender.id).exclude(api_account=True).exclude(pending=True)
    #    for u in users:
    #        if u.email not in recipients:
    #            recipients.append(u.email)

    
@receiver(post_save, sender=PostRevision)
def send_post_notification(sender, instance, created, **kwargs):

    if created:
        #update case last_modified
        instance.post.thread.case.modified = timezone.now()
        instance.post.thread.case.save()
        
        if instance.revision_number == 0:
            # we only want to send emails on first post,
            #edits are ignored
            participants = get_casethread_user_participants(instance.post.thread, instance.post.group)

            email_context = {'url': f'{settings.SERVER_NAME}{instance.post.thread.case.get_absolute_url()}', 'prepend': instance.post.thread.case.caseid}
            try:
                #remove author from list
                if instance.post.author:
                    participants.remove(instance.post.author.email)
                else:
                    if instance.post.thread.subject == "Transferred Case Thread":
                        return
            except:
                print(f"Author not in list {instance.post.author.email}")
                pass
            email_context['user_mentions'], email_context['group_mentions'] = get_post_mentions(instance)
            sent_to = []

            for email in email_context['user_mentions']:
                email_context['template'] = 'user_mentioned'
                if email not in sent_to:
                    cvdp_send_email(None, None, [email], **email_context)
                    sent_to.append(email)

            for email in email_context['group_mentions']:
                email_context['template'] = 'group_mentioned'
                if email not in sent_to:
                    cvdp_send_email(None, None, [email], **email_context)
                    sent_to.append(email)

            email_context['template'] = 'case_new_post'
            email_context['ignore'] = sent_to
            cvdp_send_email(None, None, participants, **email_context)

