#from django.shortcuts import render
import logging
#from django.conf import settings
from allauth.socialaccount.providers.oauth2.views import (
    OAuth2Adapter,
    OAuth2CallbackView,
    OAuth2LoginView,
)
from allauth.socialaccount.providers.okta.views import  OktaOAuth2Adapter

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class OktaExtendedOAuth2Adapter(OktaOAuth2Adapter):
    provider_id = "okta_extended_provider"

oauth2_login = OAuth2LoginView.adapter_view(OktaExtendedOAuth2Adapter)
oauth2_callback = OAuth2CallbackView.adapter_view(OktaExtendedOAuth2Adapter)