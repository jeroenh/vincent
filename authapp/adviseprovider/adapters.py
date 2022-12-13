from authapp.adapters import AdViseBaseAccountAdapter
from allauth.socialaccount.models import SocialToken, SocialApp
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.contrib.auth import get_user_model
from django.contrib.auth import logout as auth_logout
from django.urls import reverse
from django.conf import settings
import requests


class AdViseAccountAdapter(AdViseBaseAccountAdapter):
    def get_logout_redirect_url(self, request):
        if request.user.is_authenticated:
            user = request.user
            if SocialToken.objects.filter(account__user=user).exists():
                social = SocialToken.objects.get(account__user=user)
                access_token=social.token
                refresh_token=social.token_secret
                social_app = SocialApp.objects.get(id=social.app.id)
                logout_request_data={"token": access_token, "client_id": social_app.client_id, "client_secret": social_app.secret}
                headers={"Authorization" : "Bearer "+access_token,"Content-Type" : "application/x-www-form-urlencoded"}
                result=requests.post(settings.OAUTH_SERVER_LOGOUT, data=logout_request_data, headers=headers)
        auth_logout(request)
        return '/'
    
class AdViseSocialAccountAdapter(DefaultSocialAccountAdapter):

    def populate_user(self, request, sociallogin, data):

        #print(sociallogin.account.provider)
        #print(data)

        user = super().populate_user(request, sociallogin, data)
        
        if sociallogin.account.provider == "adviseprovider":
            user.screen_name = data.get('screen_name')
            user.title = data.get('title')
            user.org = data.get('org')

            
        return user



    """
    
    def pre_social_login(self, request, sociallogin):

        # do we already have this user?
        user = sociallogin.user
        if user.id:
            return

        #if this is a new user, do we already have their email?
        try:
            email = get_user_model().objects.get(email__iexact=user.email)
            sociallogin.connect(request, email)
        except User.DoesNotExist:
            pass
        
        
        print("FooAppSocialAccountAdapter.pre_social_login")
        return super(AdViseSocialAccountAdapter, self).pre_social_login(
            request, sociallogin
        )

    def save_user(self, request, sociallogin, form=None):
        print("FooAppSocialAccountAdapter.save_user")
        return super(AdViseSocialAccountAdapter, self).save_user(
            request, sociallogin, form
        )

    """
