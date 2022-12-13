#from django.urls import path, include, re_path
from allauth.socialaccount.providers.oauth2.urls import default_urlpatterns
from .provider import OktaProviderWithExtendedAttributes

urlpatterns = default_urlpatterns(OktaProviderWithExtendedAttributes)
