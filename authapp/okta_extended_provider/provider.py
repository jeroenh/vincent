from allauth.socialaccount.providers.okta.provider import OktaProvider
from .views import OktaExtendedOAuth2Adapter

class OktaProviderWithExtendedAttributes(OktaProvider):
    id = 'okta_extended_provider'
    oauth2_adapter_class = OktaExtendedOAuth2Adapter

    def extract_common_fields(self, data):
        user_dict = super().extract_common_fields(data)
        try:
            user_dict['screen_name'] = data['screen_name']
        except KeyError:
            user_dict['screen_name'] = f"{user_dict['first_name']} {user_dict['last_name']}"
        return user_dict


provider_classes = [OktaProviderWithExtendedAttributes]