from allauth.socialaccount import providers
from allauth.socialaccount.providers.base import ProviderAccount
from allauth.socialaccount.providers.oauth2.provider import OAuth2Provider
from .views import CustomAdapter

class AdViseAccount(ProviderAccount):
    def to_str(self):
        return self.account.extra_data.get("name", super(AdViseAccount, self).to_str())

class AdViseProvider(OAuth2Provider):
    id = "adviseprovider"
    name = 'AdVise Provider'
    account_class = AdViseAccount
    oauth2_adapter_class = CustomAdapter
    
    def extract_uid(self, data):
        return str(data['id'])

    def extract_common_fields(self, data):
        #from pprint import pprint
        #print(data)
        return dict(username=data['username'],
                    email=data['email'],
                    first_name=data['first_name'],
                    last_name=data['last_name'],
                    title=data['title'],
                    screen_name=data['screen_name'],
                    org=data['organization']
                    )

    def get_default_scope(self):
        scope = ['read']
        return scope


provider_classes = [AdViseProvider]
#providers.registry.register(AdViseProvider)
