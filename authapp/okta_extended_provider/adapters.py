from allauth.socialaccount.models import SocialToken, SocialApp
from authapp.adapters import AdViseBaseAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.contrib.auth import get_user_model
from django.contrib.auth import logout as auth_logout
from django.conf import settings
from django.shortcuts import redirect
from django.contrib import messages
from django.urls import reverse

from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
import requests
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class AdViseOktaAccountAdapter(AdViseBaseAccountAdapter):

    def get_logout_redirect_url(self, request):
        # default to our homepage if user is not authenticated
        logout_redirect = '/'
        if request.user.is_authenticated:
            user = request.user
            if SocialToken.objects.filter(account__user=user).exists():
                social = SocialToken.objects.get(account__user=user)
                access_token=social.token
                logout_request_data={"token": access_token, "token_type_hint": "access_token"}
                headers={"Authorization" : "Bearer "+access_token,"Content-Type" : "application/json"}
                result=requests.post(settings.OAUTH_SERVER_LOGOUT, data=logout_request_data, headers=headers)
                logger.debug(f"okta logout response: {result.text}")
        auth_logout(request)
        return '/'
    
    
class OktaSocialAccountAdapter(DefaultSocialAccountAdapter):

    def populate_user(self, request, sociallogin, data):
        user = super().populate_user(request, sociallogin, data)
        
        if sociallogin.account.provider == "okta_extended_provider":
            user.screen_name = data.get('screen_name')
            #user.title = data.get('title')
            #user.org = data.get('org')
            
        return user

    def on_authentication_error(self, request, provider, error, exception, extra_context):
        logger.info(f"Okta interrupt: {error}")
        logger.info(f"Okta Timeout exception?: {exception}")
        messages.error(request, "Okta login service timed out. Please try again.")
        return redirect(reverse('authapp:login'))
	
