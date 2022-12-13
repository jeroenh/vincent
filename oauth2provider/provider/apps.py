from django.apps import AppConfig


class ProviderConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'provider'
    
    def ready(self):
        from . import validation
        validation.validate_settings()
