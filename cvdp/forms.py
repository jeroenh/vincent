from django import forms
from cvdp.models import *
from django.conf import settings
from django.utils.translation import gettext, gettext_lazy as _, pgettext_lazy
from django.utils import timezone
from crispy_forms.helper import FormHelper
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User, Group
from django.contrib.auth import get_user_model
import requests
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class AdminVulCloneForm(forms.Form):
    new_cve = forms.CharField(max_length=255, label="New CVE ID",
                              help_text=_('Create a new CVE or use the old one but you need to fill this out.'))

    new_case_id = forms.CharField(
        max_length=10,
        label="New CASE ID",
        help_text=_('Use the same case or provide a new one.  e.g. CASE#123456 please provide just the numerical value "123456"'))

    _selected_action = forms.CharField(widget=forms.MultipleHiddenInput)


class GenSubForm(forms.Form):

    def __init__(self, *args, **kwargs):
        extra = kwargs.pop('extra')

        super(GenSubForm, self).__init__(*args, **kwargs)

        for i, values in enumerate(extra):
            label, klass, widget, field_args = values
            if widget:
                field_args["widget"] = widget

            self.fields['subform_question_%d' % i] = klass(label=label, **field_args)



class GenReportingForm(forms.Form):

    def __init__(self, *args, **kwargs):
        extra = kwargs.pop('extra')
        
        super(GenReportingForm, self).__init__(*args, **kwargs)

        for i, values in enumerate(extra):
            label, klass, widget, field_args = values
            if widget:
                field_args["widget"] = widget
                         
            self.fields['question_%d' % i] = klass(label=label, **field_args)

    def clean(self):
        if not self.data.get('g-recaptcha-response'):
            #this form may be added by coordinator
            return self.cleaned_data

        recaptcha_response = self.data.get('g-recaptcha-response')
        if settings.RECAPTCHA_PRIVATE_KEY:
            data = {
                "secret": settings.RECAPTCHA_PRIVATE_KEY,
                "response": recaptcha_response,
            }
            req_object = requests.post(url = "https://www.google.com/recaptcha/api/siteverify",
                                    data=data,
                                       headers={
                                           "Content-type": "application/x-www-form-urlencoded",
                                           "User-agent": "reCAPTCHA Django",
                                       })
            resp = req_object.json()
            if resp['success']:
                if resp.get('score'):
                    #v3 recaptcha
                    if resp['score'] > settings.RECAPTCHA_SUCCESS_SCORE:
                        return self.cleaned_data
                else:
                    return self.cleaned_data
            raise forms.ValidationError(_('Invalid ReCAPTCHA. Please try again.'))
        elif settings.TURNSTILE_PRIVATE_KEY:
            data = {
                "secret": settings.TURNSTILE_PRIVATE_KEY,
                "response": recaptcha_response,
            }
            req_object = requests.post(url = "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                                       data=data,
                                       headers={
                                           "Content-type": "application/x-www-form-urlencoded",
                                       })
            resp = req_object.json()
            if resp['success']:
                return self.cleaned_data
            raise forms.ValidationError(_('Invalid Verification. Please try again.'))

            
