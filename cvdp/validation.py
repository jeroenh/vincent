from django.core.exceptions import ImproperlyConfigured
from django.conf import settings

def validate_settings():
    recaptcha_setting = getattr(settings, 'RECAPTCHA_PUBLIC_KEY', None)
    turnstile_setting = getattr(settings, 'TURNSTILE_SITE_KEY', None)

    if recaptcha_setting and turnstile_setting:
        raise ImproperlyConfigured("Both RECAPTCHA and TURNSTILE are configured. Please choose only one.")

    #if required_setting not in ['valid_value_1', 'valid_value_2']:
    #    raise ImproperlyConfigured("MY_REQUIRED_SETTING has an invalid value. Must be 'valid_value_1' or 'valid_value_2'.")
