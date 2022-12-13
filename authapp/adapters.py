from allauth.account.adapter import DefaultAccountAdapter
from django.conf import settings

class AdViseBaseAccountAdapter(DefaultAccountAdapter):
    def render_mail(self, template_prefix, email, context, headers=None):
        context['homepage'] = f"{settings.SERVER_NAME}"
        if hasattr(settings, "LOGO"):
            context['logo'] = f"{settings.LOGO}"
        if hasattr(settings, 'EMAIL_SIG'):
            context['email_signature'] = settings.EMAIL_SIG

        return super(AdViseBaseAccountAdapter, self).render_mail(
            template_prefix, email, context, headers)
