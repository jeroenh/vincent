from django.apps import apps
from django.conf import settings
from django.urls import reverse
import datetime

def vincent_version(request):
    # return the value you want as a dictionary. you may add multiple values in there.
    context_vars = {}
    context_vars['VERSION'] = settings.VERSION
    context_vars['ORG_NAME'] = getattr(settings, 'ORG_NAME', None)
    context_vars['DISCLOSURE_POLICY_LINK'] = getattr(settings, 'DISCLOSURE_POLICY_LINK', None)
    context_vars['TERMS_OF_USE_LINK'] = getattr(settings, 'TERMS_OF_USE_LINK', None)
    context_vars['CONTACT_EMAIL'] = getattr(settings, 'CONTACT_EMAIL', None)
    context_vars['CVDP_BASE_TEMPLATE'] = getattr(settings, 'CVDP_BASE_TEMPLATE', 'cvdp/base.html')
    context_vars['LOGO'] = getattr(settings, 'LOGO', None)
    if getattr(settings, 'SESSION_SAVE_EVERY_REQUEST', None):
        # this will enable the InactivityTimer component which only supports inactivity timeout
        # not static session cookie age. 
        context_vars['INACTIVITY_TIMEOUT'] = getattr(settings, 'SESSION_COOKIE_AGE', None)
    context_vars['CASE_IDENTIFIER'] = settings.CASE_IDENTIFIER
    context_vars['LOGOUT_URL'] = settings.SERVER_NAME + "/accounts/logout/";
    context_vars['LOGIN_URL'] = getattr(settings, reverse(settings.LOGIN_URL), reverse("authapp:login"))
    context_vars['DEV_BANNER'] = settings.DEV_BANNER
    context_vars['ENVIRONMENT_NAME'] = settings.ENVIRONMENT_NAME
    context_vars['CURRENT_YEAR'] = datetime.date.today().year
    # vars for react appConfig
    context_vars['API_URL'] = settings.SERVER_NAME + '/cvdp'

    context_vars['RECAPTCHA_SITE_KEY'] = settings.RECAPTCHA_PUBLIC_KEY
    context_vars['TURNSTILE_SITE_KEY'] = settings.TURNSTILE_SITE_KEY
    
    if "adscore" in settings.INSTALLED_APPS:
        context_vars['ADSCORE'] = True
        context_vars['SSVC_ROLE'] = apps.get_app_config('adscore').ADSCORE_SSVC_ROLE
        context_vars['ADP_CONTAINER_TITLE'] = apps.get_app_config('adscore').ADSCORE_ADP_CONTAINER_TITLE
        context_vars['SCORE_API_URL'] = settings.SERVER_NAME + '/score'
    return context_vars
                                        
