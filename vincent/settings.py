"""
Django settings for VINCE-NT project.

"""

import os
import logging.config
import environ
import json
import copy

env = environ.Env(
    DEBUG=(bool, False)
    )
environ.Env.read_env()

# read deployment type from envvar
# assume local-type deployment. Other possible choices? AWS? AWS-{PROD|DEV|TEST}? 
DEPLOYMENT_TYPE = os.environ.get('DEPLOYMENT_TYPE', 'local')

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = environ.Path(__file__) - 3

VERSION = '1.14.0'

# append build number if we have one
try:
    with open("build_number.txt", 'r') as in_f:
        build_number = in_f.readline().strip()
        VERSION += "+build." + build_number
except FileNotFoundError:
    pass


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/2.2/howto/deployment/checklist/

ENVIRONMENT_NAME = os.environ.get('ENVIRONMENT_NAME', None)

if MAINTENANCE_MODE := os.environ.get('MAINTENANCE_MODE', False):
    if MAINTENANCE_MODE.lower() != 'true':
        MAINTENANCE_MODE = False

DEV_BANNER = False
if ENVIRONMENT_NAME in ['dev', 'test']:
    DEV_BANNER = True
    
# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('SECRET_KEY')

#this is for hashing API keys. If using SECRET_KEY make sure
#SECRET_KEY does not contain $ character
#You can use something like
#`import secrets && secrets.token_hex(8)`
API_HASH_SALT = os.environ.get('API_HASH_SALT', SECRET_KEY)

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env('DEBUG')

# set an environment name
ENVIRONMENT_NAME = os.environ.get('ENVIRONMENT_NAME', 'undefined')

# try to set up allowed hosts
try:
    ALLOWED_HOSTS = json.loads(os.environ.get('ALLOWED_HOSTS'))
except (json.JSONDecodeError, TypeError):
    # fall back to default localhost if we don't have any
    ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'host.docker.internal']

if DEPLOYMENT_TYPE == 'AWS':
    import requests
    try:
        EC2_PRIVATE_IP = requests.get('http://169.254.169.254/latest/meta-data/local-ipv4', timeout=0.1).text
        if EC2_PRIVATE_IP:
            ALLOWED_HOSTS.append(EC2_PRIVATE_IP)
    except requests.exceptions.RequestException:
        pass
    APP_SERVER_FQDN = os.environ.get('APP_SERVER_FQDN', None)
    APP_LB_FQDN = os.environ.get('APP_LB_FQDN', None)
    OAUTH_SERVER_FQDN = os.environ.get('OAUTH_SERVER_FQDN', None)
    OAUTH_LB_FQDN = os.environ.get('OAUTH_LB_FQDN', None)
    if APP_SERVER_FQDN:
        ALLOWED_HOSTS.append(APP_SERVER_FQDN)
    if APP_LB_FQDN:
        ALLOWED_HOSTS.append(APP_LB_FQDN)
    if OAUTH_SERVER_FQDN:
        ALLOWED_HOSTS.append(OAUTH_SERVER_FQDN)
    if OAUTH_LB_FQDN:
        ALLOWED_HOSTS.append(OAUTH_LB_FQDN)

trusted_domains = []
for hostname in ALLOWED_HOSTS:
    trusted_domains.append(f"https://{hostname}")
CSRF_TRUSTED_ORIGINS = trusted_domains
CSRF_COOKIE_HTTPONLY = False

LOGIN_REDIRECT_URL = 'cvdp:dashboard'
LOGIN_URL = 'authapp:login'

# Application definition

DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.sites',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.postgres',
    'django.contrib.humanize',
]

LOCAL_APPS = [
    'authapp',
    'cvdp',
]

THIRD_PARTY_APPS = [
    'qr_code',
    'django_filters',
    'allauth',
    'allauth.mfa',
    'allauth.account',
    'allauth.socialaccount',
    'authapp.adviseprovider',
    'django_otp',
    'django_otp.plugins.otp_static',
    'django_otp.plugins.otp_totp',
    'crispy_forms',
    'crispy_bootstrap5',
    'widget_tweaks',
    'rest_framework',
    'corsheaders',
    'webpack_loader',
    'drf_yasg',
]

INSTALLED_APPS_EXTRAS = os.environ.get('INSTALLED_APPS_EXTRAS')
if INSTALLED_APPS_EXTRAS:
    for app in INSTALLED_APPS_EXTRAS.split():
        LOCAL_APPS.append(app)

#append to LOCAL_APPS so they get added to logging (see below)

INSTALLED_APPS = DJANGO_APPS + LOCAL_APPS + THIRD_PARTY_APPS

#OAUTH2 - ALLAUTH  SETTINGS
ACCOUNT_ADAPTER = os.environ.get('ACCOUNT_ADAPTER', 'authapp.adviseprovider.adapters.AdViseAccountAdapter')
MFA_ADAPTER = "allauth.mfa.adapter.DefaultMFAAdapter"
# for sites that have all traffic passing through SSL, change this to https
ACCOUNT_DEFAULT_HTTP_PROTOCOL = os.environ.get("ACCOUNT_DEFAULT_HTTP_PROTOCOL", "http")
#user is required to hand over an email address when signing up
ACCOUNT_SIGNUP_FIELDS = {'email*', 'password1*', 'password2*'}
ACCOUNT_LOGIN_METHODS={'email'}
# Account email verification setting:
# options: "mandatory", "optional", "none"
# mandatory is default--users must verify email before login is permitted.
# optional: send verification email, but users may log in without verifying.
# none: no verification email, users may log in
#
# It is strongly advised to run VINCE-NT in mandatory verification mode.
# However, during setup or testing, it can be helpful to run in a lower
# mode if outgoing email is not available or not yet configured.
ACCOUNT_EMAIL_VERIFICATION = os.environ.get("ACCOUNT_EMAIL_VERIFICATION", "mandatory")
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_PRESERVE_USERNAME_CASING = False
ACCOUNT_FORMS = {
    'signup': 'authapp.forms.AdviseSignUpForm',
}

# Set to the full URL to the main oauth2 provider
OAUTH_SERVER_BASEURL = os.environ.get('OAUTH_SERVER_BASEURL', 'http://localhost:8080')
# In some cases, the oauth2 provider might have an internal address that is
# different from the outside-facing address, or the outside-facing address
# might be unreachable by the application service. In this case, set the
# internal URL to the address that the application service can reach. 
# If not set, default to the BASEURL defined above (this is the default for
# many installation scenarios).
OAUTH_SERVER_INTERNAL_URL = os.environ.get('OAUTH_SERVER_INTERNAL_URL', OAUTH_SERVER_BASEURL)

# These 2 variables allow you to optionally provide links to these services
# within VINCE-NT. For most OAuth providers this doesn't really make sense to do.
# But if you're using a custom provider, then it may make sense to allow a user
# to change their password or reset their MFA device.  If not provided, links will
# not be displayed.
OAUTH_SERVER_MFA_SETUP = os.environ.get('OAUTH_SERVER_MFA_SETUP_PATH', None)
OAUTH_SERVER_PASSWORD_CHANGE = os.environ.get('OAUTH_SERVER_PASSWORD_CHANGE', None)


OAUTH_SERVER_LOGOUT = f"{OAUTH_SERVER_BASEURL}{os.environ.get('OAUTH_SERVER_LOGOUT_PATH', '/o/revoke-token/')}"

# These 2 variables determine how initial login works
# If you want to disable local authentication/local registrations
# and just use the provided Advise provider, then uncomment
# the following 2 lines.  Make sure the USE_PROVIDER matches
# the name of the custom provider which should be AdVise Provider
# You can have additional social providers in both cases.
# 
# If using one of the allauth packaged providers, check the provider's
# name in provider.py. This is the value that should be set for 
# USE_PROVIDER.
#
# Note that we're doing some automagic here for when AdVise Provider
# is used. If you're using one of the packaged providers, you may
# want or need to set SOCIALACCOUNT_ADAPTER and/or SOCIALACCOUNT_FORMS
# to get the functionality you wish.

if (use_provider := os.environ.get('USE_PROVIDER')):
    USE_PROVIDER = use_provider #'AdVise Provider'
    if USE_PROVIDER == 'AdVise Provider':
        SOCIALACCOUNT_ADAPTER = "authapp.adviseprovider.adapters.AdViseSocialAccountAdapter"
        SOCIALACCOUNT_FORMS = {'signup': 'authapp.adviseprovider.forms.CustomSocialSignupForm'}
        OAUTH_SERVER_MFA_SETUP= f"{OAUTH_SERVER_BASEURL}{os.environ.get('OAUTH_SERVER_MFA_SETUP_PATH', '/provider/home/')}"
        OAUTH_SERVER_PASSWORD_CHANGE=f"{OAUTH_SERVER_BASEURL}{os.environ.get('OAUTH_SERVER_PASSWORD_CHANGE_PATH', '/accounts/password_change/')}"

if (registration_link := os.environ.get('REGISTRATION_LINK')):
    REGISTRATION_LINK = registration_link #f'{OAUTH_SERVER_BASEURL}/provider/register'

if (socialaccount_adapter := os.environ.get('SOCIALACCOUNT_ADAPTER')):
    SOCIALACCOUNT_ADAPTER = socialaccount_adapter

if (socialaccount_forms := os.environ.get('SOCIALACCOUNT_FORMS')):
    SOCIALACCOUNT_FORMS = socialaccount_forms

SOCIALACCOUNT_LOGIN_ON_GET=True
SOCIALACCOUNT_STORE_TOKENS=True

SOCIALACCOUNT_REQUESTS_TIMEOUT = 15 # Default is 5 seconds, bump this to 15

#if true - all new sign ups will be pending until someone approves them
REQUIRE_ACCOUNT_APPROVAL = os.environ.get("REQUIRE_ACCOUNT_APPROVAL", False)

# If you need to provide socialaccount configuration that cannot be set in 
# the admin interface, set this envvar. It must be valid JSON.
if (socialaccount_providers_raw := os.environ.get("SOCIALACCOUNT_PROVIDERS", None)):
    # let this raise an exception if decode fails so that we stop
    SOCIALACCOUNT_PROVIDERS = json.loads(socialaccount_providers_raw)

# SESSION_COOKIE_AGE controls how long a session cookie is valid (in seconds)
# Django default is two weeks. This is a hard timeout from the date of
# the creation of the session. If SESSION_SAVE_EVERY_REQUEST is also set
# to True, this will become a sliding inactivity timeout, resetting the
# timer with every request. This increases db activity, but provides a 
# useful inactivity timeout that kills the session after timeout.
#
# To set just the cookie age, set the envvar SESSION_COOKIE_AGE.
# If you would like to instead set an inactivity timeout, set
# INACTIVITY_TIMEOUT to the number of seconds before a session should
# expire. Note that setting the inactivity timeout will override any
# prior setting for SESSION_COOKIE_AGE.
if (session_cookie_age := os.environ.get("SESSION_COOKIE_AGE", None)):
    SESSION_COOKIE_AGE = int(session_cookie_age)

if (inactivity_timeout := os.environ.get("INACTIVITY_TIMEOUT", None)):
    SESSION_COOKIE_AGE = int(inactivity_timeout)
    SESSION_SAVE_EVERY_REQUEST = True

MIDDLEWARE = [

    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django_otp.middleware.OTPMiddleware',
    'authapp.middleware.Require2FAMiddleware', #<--- if you want to require 2fa for local users, otherwise comment out
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    "allauth.account.middleware.AccountMiddleware",
    "cvdp.middleware.MaintenanceModeMiddleware",
    "cvdp.middleware.PermissionDeniedMiddleware",

]

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True
try:
    CORS_ALLOWED_ORIGINS = json.loads(os.environ.get('CORS_ALLOWED_ORIGINS'))
except (json.JSONDecodeError, TypeError):
    # fall back to default webpack dev startup url if we don't have one
    CORS_ALLOWED_ORIGINS = ['http://localhost:3000']

SITE_ID = 1

ROOT_URLCONF = 'vincent.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': ['cvdp'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'cvdp.context_processors.vincent_version',
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'vincent.wsgi.application'

#use a cutom authentication model

AUTH_USER_MODEL = 'authapp.User'

CRISPY_ALLOWED_TEMPLATE_PACKS='bootstrap5'
CRISPY_TEMPLATE_PACK='bootstrap5'

db_user = os.environ.get('DB_USER', 'vincent')
db_password = os.environ.get('DB_PASS', 'vincent')

if DEPLOYMENT_TYPE == "AWS":
    import boto3
    def get_secret(secret_arn):
        # Create a Secrets Manager client
        session = boto3.session.Session()
        client = session.client(service_name='secretsmanager', region_name=os.environ.get('AWS_REGION'))
        secrets = client.get_secret_value(SecretId=secret_arn)
        return json.loads(secrets['SecretString'])

    rds_secret_arn = os.environ.get('RDS_SECRET_ARN', None)
    if rds_secret_arn:
        rds_secret = get_secret(rds_secret_arn)
        db_user = rds_secret['username']
        db_password = rds_secret['password']

# Database
# https://docs.djangoproject.com/en/2.2/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql_psycopg2',
        'NAME': os.environ.get('DB_NAME', 'vincent'),
        'USER': db_user,
        'PASSWORD': db_password,
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', 5432),
    }
}

"""
OIDC_RSA_PRIVATE_KEY_FILE = os.environ.get('OIDC_RSA_PRIVATE_KEY_FILE')
if OIDC_RSA_PRIVATE_KEY_FILE:
    with open(OIDC_RSA_PRIVATE_KEY_FILE) as privatefile:
        OIDC_RSA_PRIVATE_KEY = privatefile.read()


OAUTH2_PROVIDER = {
    "OIDC_ENABLED": True,
    "ACCESS_TOKEN_EXPIRE_SECONDS": 3600,
    "OAUTH2_VALIDATOR_CLASS": "authapp.oauth_validator.CustomOAuth2Validator",
    "OIDC_RSA_PRIVATE_KEY": OIDC_RSA_PRIVATE_KEY,
    "SCOPES": {
        'read': 'Read scope',
        'write': 'Write scope',
        "openid": "OpenID Connect scope",
    },
}
"""

# Password validation
# https://docs.djangoproject.com/en/2.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


PASSWORD_HASHERS = [
    "authapp.hashers.VinceNTPasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
]

# Internationalization
# https://docs.djangoproject.com/en/2.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_L10N = True

USE_TZ = True

DEFAULT_TIME_ZONE = 'UTC'

# logging configuration
LOGLEVEL = os.environ.get('LOGLEVEL', 'info').upper()
DJANGO_LOGLEVEL = os.environ.get('DJANGO_LOGLEVEL', 'info').upper()
LOGGING_CONFIG = None
LOGGER_HANDLER = 'console'


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/2.2/howto/static-files/
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static'),
    os.path.join(BASE_DIR, 'assets'),
]

# default file storage left as default
MEDIA_URL = os.environ.get('MEDIA_URL', '/media/')
MEDIA_ROOT = os.path.join(BASE_DIR, os.environ.get('MEDIA_ROOT', 'media'))

# artifact file storage defaults
# set ATTACHMENT_FILES_STORAGE to None for default filesystem storage
#ATTACHMENT_FILES_STORAGE = 'advise.storage_backends.AttachmentFileStorage'
#ATTACHMENT_FILES_ARGS = {
#    'location': ATTACHMENTS_ROOT,
#    'base_url': ATTACHMENTS_URL,
#}
# for 4.2, we should use the newly-introduced STORAGES dict to manage
# these backends [JDW]
#

# storages (populated later in this file; default is to use FileSystemStorage if nothing specified) [JDW]
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

ATTACHMENTS_URL = os.environ.get('ATTACHMENTS_URL', '/attachments/')
ATTACHMENTS_ROOT = os.path.join(BASE_DIR, os.environ.get('ATTACHMENT_FILE_LOCATION', 'attachments'))
STORAGES['attachments'] = {
    'BACKEND': "vincent.storage_backends.AttachmentFileStorage",
    'OPTIONS': {
        'location': ATTACHMENTS_ROOT,
        'base_url': ATTACHMENTS_URL
    }
}

# set up STATIC files
# (assumed local unless otherwise)
# if DEPLOYMENT_TYPE == 'local':
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR + "/staticfiles"

if DEPLOYMENT_TYPE == 'AWS':
    INSTALLED_APPS.append('storages')
    USE_S3=True
    AWS_REGION = os.environ.get('AWS_REGION')
    AWS_DEFAULT_ACL = None
    AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME')
    AWS_S3_REGION_NAME = AWS_REGION

    # Tell django-storages the domain to use to refer to static files.
    AWS_S3_CUSTOM_DOMAIN = os.environ.get('STATIC_SERVER_FQDN', APP_SERVER_FQDN)
    AWS_LOCATION = os.environ.get('AWS_LOCATION', 'static')
    STATIC_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/{AWS_LOCATION}/'
    # Tell the staticfiles app to use S3Boto3 storage when writing the collected static files (when
    # you run `collectstatic`).
    STORAGES['staticfiles'] = {
        'BACKEND': 'storages.backends.s3boto3.S3Boto3Storage',
        'OPTIONS':  {
            'bucket_name': AWS_STORAGE_BUCKET_NAME,
            'default_acl': None,
            'location': AWS_LOCATION,
            'region_name': AWS_S3_REGION_NAME
        }
    }
    #STATICFILES_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    #PRIVATE_FILE_STORAGE = 'advise.storage_backends.PrivateMediaStorage'
    # unset STATIC_ROOT so we don't cause any conflicts with staticfiles
    STATIC_ROOT = None

    # set up attachment file storage
    #ATTACHMENT_FILES_STORAGE = 'advise.storage_backends.AttachmentFileStorage'
    AWS_ATTACHMENT_FILES_STORAGE_BUCKET_NAME = os.environ.get('AWS_ATTACHMENT_FILES_STORAGE_BUCKET_NAME')
    AWS_ATTACHMENT_FILES_LOCATION = os.environ.get('ATTACHMENT_FILES_LOCATION', 'attachments')
    STORAGES['attachments'] = {
        'BACKEND': 'vincent.storage_backends.AttachmentFileStorage',
        'OPTIONS': {
            'location': AWS_ATTACHMENT_FILES_LOCATION,
            'bucket_name': AWS_ATTACHMENT_FILES_STORAGE_BUCKET_NAME,
            'file_overwrite': False,
            'default_acl': 'private',
            'region_name': AWS_REGION,
            'custom_domain': False,
        }
    }
    ATTACHMENTS_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/{AWS_ATTACHMENT_FILES_LOCATION}/'
    ATTACHMENTS_ROOT = None

    #DEFAULT_FILE_STORAGE = 'advise.storage_backends.DefaultFileStorage'
    AWS_MEDIA_FILES_STORAGE_BUCKET_NAME = os.environ.get('AWS_MEDIA_FILES_STORAGE_BUCKET_NAME')
    AWS_MEDIA_FILES_LOCATION = os.environ.get('MEDIA_FILES_LOCATION', 'media')
    STORAGES['default'] = {
        'BACKEND': 'vincent.storage_backends.DefaultFileStorage',
        'OPTIONS': {
            'location': AWS_MEDIA_FILES_LOCATION,
            'bucket_name': AWS_MEDIA_FILES_STORAGE_BUCKET_NAME,
            'file_overwrite': False,
            'default_acl': 'private',
            'region_name': AWS_REGION,
            'custom_domain': AWS_S3_CUSTOM_DOMAIN,
        }
    }
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/{AWS_MEDIA_FILES_LOCATION}/'
    MEDIA_ROOT = None

    LOGGER_HANDLER = 'watchtower'

local_logger_conf = {
    'handlers': [LOGGER_HANDLER],
    'level': LOGLEVEL,
}
    
logging_dict = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'console': {
            # exact format is not important, this is the minimum information    
            'format': '%(asctime)s %(name)-12s %(filename)s:%(lineno)s %(levelname)-8s %(message)s',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'console',
        },
    },
    'loggers': {
        app: copy.deepcopy(local_logger_conf) for app in LOCAL_APPS
    }
}

logging_dict['loggers']['django'] = local_logger_conf
#logging_dict['loggers']['django.db.backends'] = {'level': 'DEBUG'}

if DEPLOYMENT_TYPE == 'AWS': 
    LOG_GROUP_NAME = os.environ.get('ADVISE_LOG_GROUP_NAME', 'VINCENT')
    logging_dict['handlers']['watchtower'] = {
        'level': 'DEBUG',
        'class': 'watchtower.CloudWatchLogHandler',
        'log_group': LOG_GROUP_NAME,
        'stream_name': 'cvdp',
        'formatter': 'console',
    }

logging.config.dictConfig(logging_dict)
        

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]
 

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'authapp.backend.HashedTokenAuthentication',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
    ],
    'EXCEPTION_HANDLER': 'cvdp.views.exception_handler',
}


#allowed options: "prod", "test", "dev", "adptest"                                         
#List available options here:
CVE_SERVICES_API_OPTIONS = (
    ('prod', "Production"),
    ('test', "Test"),
    ('dev', "Development"),
    ('adptest', 'ADP Test'),
)

CVE_SERVICES_API_URLS  = (
    ("prod", "https://cveawg.mitre.org/api/"),
    ("dev", "https://cveawg-dev.mitre.org/api/"),
    ("test", "https://cveawg-test.mitre.org/api/"),
    ("adptest", "https://cveawg-adp-test.mitre.org/api/")
)


DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

CVDP_BASE_TEMPLATE = "cvdp/base.html"

ORG_NAME = os.environ.get('ORG_NAME', 'Vullabs')

#set if you want links in the footer, remove if you don't
#DISCLOSURE_POLICY_LINK = "https://myorg.org/policies/vuldisclosure/"
#TERMS_OF_USE_LINK = "https://myorg.org/terms"

#if True, add a link to login page to receive anonymous reports. 
ALLOW_ANONYMOUS_REPORTS = os.environ.get('ALLOW_ANONYMOUS_REPORTS', True)


CASE_IDENTIFIER = "CASE#"

# email configuration
CONTACT_EMAIL = os.environ.get('CONTACT_EMAIL', 'vuls@localhost')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', CONTACT_EMAIL)
REPLY_TO_EMAIL = os.environ.get('REPLY_TO_EMAIL', CONTACT_EMAIL)
EMAIL_HEADERS = {}

EMAIL_SIG = "Your VINCE-NT Team"

# default to dump email to the console unless we actually configure email
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')

# we might need to set some vars if user chooses to use the SMTP backend
# this is long but avoids overriding module defaults
if EMAIL_BACKEND == 'django.core.mail.backends.smtp.EmailBackend':
    if (email_host := os.environ.get('EMAIL_HOST')):
        EMAIL_HOST = email_host
    if (email_port := os.environ.get('EMAIL_PORT')):
        EMAIL_PORT = email_port
    if (email_host_user := os.environ.get('EMAIL_HOST_USER')):
        EMAIL_HOST_USER = email_host_user
    if (email_host_password := os.environ.get('EMAIL_HOST_PASSWORD')):
        EMAIL_HOST_PASSWORD = email_host_password 
    if (email_use_tls := os.environ.get('EMAIL_USE_TLS')):
        EMAIL_USE_TLS = email_use_tls
    if (email_use_ssl := os.environ.get('EMAIL_USE_SSL')):
        EMAIL_USE_SSL = email_use_ssl
    if (email_timeout := os.environ.get('EMAIL_TIMEOUT')):
        EMAIL_TIMEOUT = email_timeout

# AWS SES email might have some regional settings
if EMAIL_BACKEND == 'django_ses.SESBackend':
    # django_ses defaults to using us-east-1. Set these to use an alt region.
    # If the region is set, one must also set the appropriate endpoint value.
    if (ses_region_name := os.environ.get("AWS_SES_REGION_NAME")):
        AWS_SES_REGION_NAME = ses_region_name
        AWS_SES_REGION_ENDPOINT = os.environ.get("AWS_SES_REGION_ENDPOINT")


WEBPACK_LOADER = {
  'DEFAULT': {
    'CACHE': not DEBUG,
    'STATS_FILE': os.path.join(BASE_DIR, 'webpack-stats.json'),
    'POLL_INTERVAL': 0.1,
    'IGNORE': [r'.+\.hot-update.js', r'.+\.map'],
  }
}

#JOB_MANAGER - Not required but suggested for production deployments
# long running tasks will be done asychronously
#JOB_MANAGER = "cvdp.appcomms.async.AdviseWorker_Communicator"
# or celery/redis option
#JOB_MANAGER = "cvdp.appcomms.celery.CeleryRedis_Communicator"

JOB_MANAGER = os.environ.get('JOB_MANAGER')

# following settings only required if JOB_MANAGER=cvdp.appcomms.async.CeleryRedis...
if JOB_MANAGER == 'cvdp.appcomms.async.CeleryRedis':
    from celery.schedules import crontab
    INSTALLED_APPS.append('django_celery_beat')
    CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_REDIS_URL', "redis://localhost:6379")
    CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', "redis://localhost:6379")
    CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers.DatabaseScheduler'
    CELERY_IGNORE_RESULT = True

    #this runs every hour to check for new CVEs
    CELERY_BEAT_SCHEDULE = {
        'check-new-cve': {
            'task': 'adscore.tasks.check_for_new_cves',
            'schedule': crontab(minute=0)
        }
    }

LOGO = "cvdp/css/images/CVDP-default.png"
    
SERVER_NAME = os.environ.get('APP_SERVER_FQDN', "localhost:8000")
SERVER_NAME = f'{ACCOUNT_DEFAULT_HTTP_PROTOCOL}://{SERVER_NAME}'
RECAPTCHA_PUBLIC_KEY = os.environ.get('RECAPTCHA_SITE_KEY')
RECAPTCHA_PRIVATE_KEY = os.environ.get('RECAPTCHA_SECRET_KEY')
RECAPTCHA_SUCCESS_SCORE = os.environ.get('RECAPTCHA_SUCCESS_SCORE', 0.5)
PBKDF2HASHER_ITERATIONS = os.environ.get('HASHER_ITERATIONS', 870000)

TURNSTILE_SITE_KEY = os.environ.get('TURNSTILE_SITE_KEY')
TURNSTILE_SECRET_KEY = os.environ.get('TURNSTILE_SECRET_KEY')

#SESSION_COOKIE_AGE = 600
#SESSION_SAVE_EVERY_REQUEST = True


# staging swagger settings to specify endpoints needing auth [JDW]
#SWAGGER_SETTINGS = {
#    'SECURITY_DEFINITIONS': {
#        'Token': {
#            'type': 'apiKey',
#            'name': 'Authorization',
#            'in': 'header'
#        }
#    }
#}
