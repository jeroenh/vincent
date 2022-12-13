from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.conf import settings
from cvdp.appcomms.appcommunicator import cvdp_send_email
from allauth.account.signals import password_changed, password_reset, email_added, email_removed, user_logged_out, user_logged_in
import logging

logger = logging.getLogger(__name__)
#TODO - might want to add social account hooks
#TODO - add hooks for mfa setup/removal

@receiver(password_changed)
def send_password_changed_notification(request, user, **kwargs):
    email_context = {'template': 'password_changed'}
    logger.warning("User %s changed password", user)
    cvdp_send_email(None, None, [user.email], **email_context)


@receiver(password_reset)
def send_password_reset_notification(request, user, **kwargs):
    email_context = {'template': 'password_reset'}
    logger.warning("User %s reset password", user)
    cvdp_send_email(None, None, [user.email], **email_context)

@receiver(email_added)
def send_email_added_notification(request, user, email_address, **kwargs):
    email_context = {'template': 'email_added', 'email': email_address}
    cvdp_send_email(None, None, [user.email], **email_context)

@receiver(email_removed)
def send_email_removed_notification(request, user, email_address, **kwargs):
    email_context = {'template': 'email_removed', 'email': email_address}
    cvdp_send_email(None, None, [user.email], **email_context)
    
@receiver(user_logged_out)
def user_logged_out_notification(request, user, **kwargs):
    logger.warning(
        "User Session Ended: %s", user)

@receiver(user_logged_in)
def user_logged_in_notification(request, user, **kwargs):
    previous_last_login = user.last_login
    if previous_last_login:
        request.session['previous_last_login'] = str(previous_last_login)
        logger.debug(f"User {user.username} previously logged in at: {previous_last_login}")
    else:
        logger.debug(f"User {user.username} is logging in for the first time.")
        request.session['previous_last_login'] = "New"
    logger.warning(
        "User Session Started: %s", user)
