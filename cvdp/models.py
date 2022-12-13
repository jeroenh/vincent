from django.db import models
from django.db.models import Q
from django.contrib.auth.models import Group
from django.contrib.auth import get_user_model
from django.utils.translation import gettext as _
from django.utils import timezone
from django.urls import reverse
from django.conf import settings
from .utils import cached_attribute
from cvdp.manage.models import FormEntry, CVEServicesAccount, AdVISEConnection
from cvdp.validators import JSONSchemaValidator
from django.utils.functional import cached_property
from django.dispatch import Signal
from django.core.exceptions import ValidationError
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField, SearchVector, SearchQuery
import vincent.storage_backends
import uuid
import re
import io
import traceback
import random
import base64
import os
from pydoc import locate
import logging
# Create your models here.

message_sent = Signal()

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

User = get_user_model()

def random_logo_color():
    return "#"+''.join([random.choice('0123456789ABCDEF') for j in range(6)])

def generate_uuid():
    return uuid.uuid1()

def user_logo_path(instance, filename):
    try:
        return f'user_logos/{instance.user.contact.uuid}/{filename}'
    except:
        return f'user_logos/unknown/{filename}'


class GlobalSettings(models.Model):

    group = models.ForeignKey(
        Group,
        on_delete = models.SET_NULL,
        blank=True,
        null=True,
        help_text=_('The main coordination group for this VINCE-NT instance'),
    )

    use_custom_report = models.BooleanField(
        help_text=_("Disable Form Builder and use a custom Javascript reporting form"),
        default=False)

    unresponsive_pulse = models.IntegerField(
        help_text=_("Number of days before vendor is marked as unresponsive"),
        default = 0)

    coordinator_identity = models.CharField(
        max_length=500,
        help_text=_('If provided, all coordinator teams will use '
                    'name provided here as display to all non-coordinator '
                    'accounts on the platform'),
        blank=True,
        null=True)

    contact_reasons = models.TextField(
        help_text=_('Inbox message titles, separated by new line. Provide reasons '
                    'why a user should use the form to contact the team'),
        blank=True,
        null=True)

    class Meta:
        verbose_name = "Global Settings"
        verbose_name_plural = "Global Settings"

    def clean(self):
        if not self.pk and GlobalSettings.objects.exists():
            raise ValidationError("Only one settings instance is permitted")
        if self.group.groupprofile.vendor_type != "Coordinator":
            raise ValidationError("Group must be \"Coordinator\" type to be lead coordination group")

    def save(self, *args, **kwargs):
        return super(GlobalSettings, self).save(*args, **kwargs)

    def __str__(self):
        if self.group:
            return self.group.name
        else:
            return "Improperly Configured"

class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL,
                                related_name="userprofile",
                                on_delete=models.CASCADE)

    logocolor = models.CharField(max_length=10, default=random_logo_color)

    photo = models.FileField(
        upload_to=user_logo_path,
        blank=True,
        null=True)

    timezone = models.CharField(default='UTC', max_length=100)

    settings_pickled = models.TextField(
	_('Settings Dictionary'),
        help_text=_('This is a base64-encoded representation of a '
                    'pickled Python dictionary.'
                    'Do not change this field via the admin.'),
        blank=True,
        null=True,
    )

    def get_photo(self):
        if self.photo:
            return self.photo.url
        return None

    def _set_settings(self, data):
        # data should always be a Python dictionary.
        if not isinstance(data,dict):
            logger.warn("Non dictionary item sent to pickle %s" % str(data))
            data = {}
        try:
            import pickle
        except ImportError:
            import cPickle as pickle
        from base64 import encodebytes as b64encode
        self.settings_pickled = b64encode(pickle.dumps(data)).decode()

    def _get_settings(self):
        # return a python dictionary representing the pickled data.
        try:
            import pickle
        except ImportError:
            import cPickle as pickle

        class RestrictedUnpickler(pickle.Unpickler):
            def find_class(self, module, name):
                """ If find_class gets called then return error """
                raise pickle.UnpicklingError("global '%s.%s' is forbidden" %
                                             (module, name))
        try:
            from base64 import decodebytes as b64decode
            if self.settings_pickled:
                s = b64decode(self.settings_pickled.encode('utf-8'))
                #replacement for pickle.loads()
                return RestrictedUnpickler(io.BytesIO(s)).load()
            else:
                return {}
        except (pickle.UnpicklingError, AttributeError) as e:
            logger.warn("Error when trying to unpickle data %s " %(str(e)))
            return {}
        except Exception as e:
            logger.debug(traceback.format_exc())
            logger.warn("Generic error when trying to unpickle data %s " %(str(e)))
            return {}

    settings = property(_get_settings, _set_settings)


class Action(models.Model):

    created = models.DateTimeField(
        _('Date'),
	default=timezone.now
    )

    title = models.TextField(
	_('Title'),
        blank=True,
	null=True,
    )

    user = models.ForeignKey(
	settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
	verbose_name=_('User'),
        blank=True,
        null=True
    )

    def __str__(self):
        return '%s' % self.title


def group_directory_path(instance, filename):
    return f'group/{instance.uuid}/{filename}'


class GroupProfile(models.Model):

    VENDOR_TYPE = (
        ('Vendor', 'Vendor'),
        ('Coordinator', 'Coordinator'),
    )

    created = models.DateTimeField(
        default=timezone.now)

    modified = models.DateTimeField(
        auto_now=True)

    vendor_type = models.CharField(
        max_length=50,
        default="Vendor",
        choices=VENDOR_TYPE)

    group = models.OneToOneField(
        Group,
        on_delete=models.CASCADE)

    logo = models.FileField(
        upload_to=group_directory_path,
        blank=True,
        null=True)

    icon_color = models.CharField(
        max_length=10,
        default=random_logo_color)

    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False)

    active = models.BooleanField(
        default=True)

    support_emails = models.JSONField(
        help_text=_('Team or contact email address for organization'),
        blank=True,
        null=True,
        default=list)

    support_email = models.EmailField(
        help_text=_('Team or contact email address for organization'),
        blank=True,
        null=True
    )

    support_phone = models.CharField(
        help_text=_('Team or contact phone number for organization'),
        max_length=20,
        blank=True,
        null=True)

    website = models.URLField(
        help_text=_('Organization/support website'),
        blank=True,
        null=True)

    mailing_address = models.TextField(
        help_text=_("Organization mailing address/location"),
        blank=True,
        null=True)

    permissions = models.BooleanField(
        default=False,
        help_text=_('Case Access permissions set by group admin. If false, all users in group have r/w on all cases.'),
    )

    def get_logo(self):
        if self.logo:
            return self.logo.url
        else:
            return None

    def get_logo_name(self):
        if self.logo:
            return self.logo.name
        else:
            return None

    def get_absolute_url(self):
        return reverse('cvdp:group', args=(self.uuid,))




class GroupTag(models.Model):
    """
    Tagging a group is essentially a way to group vendors
    """

    group = models.ForeignKey(
	Group,
        related_name='tags',
        on_delete=models.CASCADE,
        verbose_name=_('Group'),
    )

    created = models.DateTimeField(
        auto_now_add=True
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
	blank=True,
        null=True,
        help_text=_('User that created this tag.'),
	verbose_name=_('User'),
    )

    tag = models.CharField(
        max_length=100,
	help_text=_('The tag')
    )

    def __str__(self):
        return self.tag


class Contact(models.Model):

    email = models.EmailField(
        unique=True)

    phone = models.CharField(
        max_length=50,
        blank=True,
        null=True)

    name = models.CharField(
        max_length=200,
        blank=True,
        null=True
    )

    #contact may or may not be a user on the system
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True
    )

    # the user that added this contact
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name = _('Added_by'),
        on_delete = models.SET_NULL,
        blank=True,
        null=True
    )

    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False)

    created = models.DateTimeField(
        default=timezone.now)

    modified = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return self.name

    def get_color(self):
        if self.user:
            return self.user.userprofile.logocolor
        else:
            return "#827F7F"

    def get_photo(self):
        if self.user:
            return self.user.userprofile.get_photo()
        else:
            return None

    def get_name(self):
        if self.user:
            if self.user.screen_name:
                return self.user.screen_name
        if self.name:
            return self.name
        else:
            return self.email

    def get_title(self):
        if self.user:
            return self.user.title
        else:
            return None

    def get_absolute_url(self):
        return reverse('cvdp:contact', args=(self.uuid,))

class ContactAssociation(models.Model):
    contact = models.ForeignKey(
        Contact,
        related_name='associations',
        on_delete = models.CASCADE,
    )

    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE
    )

    created = models.DateTimeField(
        default=timezone.now)

    verified = models.BooleanField(
        default=False)

    group_admin = models.BooleanField(
        default=False)

    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete = models.SET_NULL,
        blank=True,
        null=True)

    def __str__(self):
        return f"{self.contact.email} in {self.group.name}"


class RejectedAssociation(models.Model):

    contact = models.ForeignKey(
        Contact,
	related_name='rejected_associations',
	on_delete = models.CASCADE,
    )

    group = models.ForeignKey(
        Group,
	on_delete=models.CASCADE
    )

    rejected = models.DateTimeField(
        default=timezone.now)

    rejected_by =  models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete = models.SET_NULL,
        blank=True,
        null=True)

    def __str__(self):
        return f"{self.contact.email} rejected from {self.group.name}"


class CaseReport(models.Model):

    entry = models.ForeignKey(
        FormEntry,
        on_delete=models.SET_NULL,
        blank=True,
        null=True)

    connection = models.ForeignKey(
        AdVISEConnection,
        on_delete=models.SET_NULL,
        blank=True,
        null=True)

    report = models.JSONField(
        help_text=_('JSON dictionary with report')
    )

    received = models.DateTimeField(
        default = timezone.now)

    source = models.CharField(
        max_length=300,
        help_text=_('URL, automated source, email'),
        blank=True,
        null=True)

    copy = models.BooleanField(
        default = False)

    def __str__(self):
        return str(self.report)

class CaseReportOriginal(models.Model):

    report = models.ForeignKey(
        CaseReport,
        on_delete = models.CASCADE)

    case = models.ForeignKey(
        "Case",
        on_delete=models.CASCADE)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL)

    created = models.DateTimeField(
        default=timezone.now)


class CaseManager(models.Manager):
    def search(self, query=None):
        qs = self.get_queryset()
        if query is not None:
            query = SearchQuery(query)
            qs = qs.filter(search_vector = query)
        return qs

    def search_my_cases(self, qs, query=None):
        if not qs:
            qs = self.get_queryset()
        if query is not None:
            query = SearchQuery(query)
            qs = qs.filter(search_vector = query)
        return qs

class Case(models.Model):
    PENDING_STATUS = 0
    ACTIVE_STATUS = 1
    INACTIVE_STATUS = 2

    STATUS_CHOICES = (
        (PENDING_STATUS, _('Pending')),
        (ACTIVE_STATUS, _('Active')),
        (INACTIVE_STATUS, _('Inactive')),
    )

    case_id = models.CharField(
        max_length=20,
        unique=True)

    created = models.DateTimeField(default=timezone.now)

    modified = models.DateTimeField(
        _('Modified'),
        auto_now=True,
        help_text=_('Date this case was most recently changed.'),
    )

    status = models.IntegerField(
        _('Status'),
        choices=STATUS_CHOICES,
        default=PENDING_STATUS,
    )

    state = models.CharField(
        _('Case State'),
        blank=True,
        null=True,
        max_length=100)

    resolution = models.TextField(
        _('Resolution'),
        blank=True,
        null=True,
        help_text=_('The case resolution')
    )

    title = models.CharField(
        max_length=500,
        help_text=_('A title for this case.'))

    summary = models.TextField(
        blank=True,
        null=True,
        help_text=_('A brief summary of the case')
    )

    report = models.ForeignKey(
        CaseReport,
        on_delete=models.SET_NULL,
        blank=True,
        null=True
    )

    due_date = models.DateTimeField(
        help_text=_('Estimated Public Date'),
        blank=True, null=True
    )

    public_date = models.DateTimeField(
        blank=True, null=True
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete = models.SET_NULL,
	blank=True,
        null=True)

    search_vector = SearchVectorField(null=True)

    objects = CaseManager()

    def get_official_thread(self):
        return CaseThread.objects.filter(case=self, official=True).first()

    official_thread = property(get_official_thread)

    def get_title(self):
        return f"{settings.CASE_IDENTIFIER}{self.case_id}: {self.title}"

    full_title = property(get_title)

    def get_caseid(self):
        return f"{settings.CASE_IDENTIFIER}{self.case_id}"

    caseid = property(get_caseid)

    def __str__(self):
        return self.case_id

    def get_absolute_url(self):
        return reverse('cvdp:case', args=(self.case_id,))

    def _get_case_for_url(self):
        """ A URL-friendly ticket ID, used in links. """
        return f"{settings.CASE_IDENTIFIER}{self.case_id}"

    case_for_url = property(_get_case_for_url)

    def _get_owners(self):
        """ Custom property to get owners of Case or return
        'Unassigned' if no owners. """
        assignments = list(CaseParticipant.objects.filter(case=self, role="owner").exclude(contact__isnull=True).values_list('contact__user__screen_name', flat=True))
        if assignments:
            return ",".join(assignments)
        else:
            logger.debug("UNASSIGNED")
            return _('Unassigned')

    get_owners = property(_get_owners)

    def _get_coordinators(self):
        assignments = list(CaseParticipant.objects.filter(case=self, role="owner").exclude(group__isnull=True).values_list('group__name', flat=True))
        if assignments:
            return ",".join(assignments)
        else:
            logger.debug("UNASSIGNED")
            return _('Unassigned')

    get_coordinators = property(_get_coordinators)

    def _get_status_html(self):
        if self.status == self.ACTIVE_STATUS:
            """if self.published:
                return f"<span class=\"badge rounded-pill bg-success\">{self.get_status_display()}</span>   <span class=\"badge rounded-pill bg-success\">Published</span>"""
            return f"<span class=\"badge rounded-pill bg-success\">{self.get_status_display()}</span>"

        else:
            """if self.published:
                return f"<span class=\"badge rounded-pill bg-info\">{self.get_status_display()}</span>  <span class=\"badge rounded-pill bg-success\">Published</span>"
            else:"""
            return f"<span class=\"badge rounded-pill bg-info\">{self.get_status_display()}</span>"

    get_status_html = property(_get_status_html)

    class Meta:
        ordering = ("-modified",)
        indexes = [ GinIndex(
            fields = ['search_vector'],
            name = 'case_gin',
        )
                ]









class CaseParticipant(models.Model):

    CASE_ROLES = (('owner', 'owner'),
                  ('reporter', 'reporter'),
                  ('supplier', 'supplier'),
                  ('participant', 'participant'),
                  ('observer', 'observer'))

    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE)

    group = models.ForeignKey(
        Group,
        blank=True, null=True,
        on_delete=models.CASCADE)

    contact = models.ForeignKey(
        Contact,
        blank=True, null=True,
	help_text=_('A participant in the case (contact may not belong to a group)'),
        on_delete = models.CASCADE)

    added = models.DateTimeField(
        default=timezone.now)

    notified = models.DateTimeField(
        blank=True,
        null=True)

    user = models.ForeignKey(
	settings.AUTH_USER_MODEL,
        blank=True,
	null=True,
        help_text=_('The user that added the group/contact.'),
        on_delete=models.SET_NULL)

    seen = models.BooleanField(
	default=False)

    pulse = models.DateTimeField(
        help_text=_('Last time participant interacted with case.'),
        blank=True,
        null=True)

    role = models.CharField(
        max_length=30,
        choices = CASE_ROLES,
        default = 'supplier')

    #add this so we can sort */

    title = models.CharField(
        max_length=500,
        blank=True,
        null=True)

    permissions = models.JSONField(
        help_text=_('Case access permissions set by group admin'),
	default=dict
    )

    def __str__(self):
        if self.group:
            return f"{self.group.name} in {self.case.case_id}"
        else:
            return f"{self.contact.email} in {self.case.case_id}"

    def _get_name(self):
        if self.group:
            return self.group.name
        else:
            if self.contact.user:
                return self.contact.user.screen_name
            return self.contact.email

    name = property(_get_name)

    def save(self, *args, **kwargs):

        self.title = self._get_name()

        super(CaseParticipant, self).save(*args, **kwargs)

# Adapted from Pinax-messages Project
class MessageThread(models.Model):

    subject = models.CharField(
        max_length=150)

    users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        through="UserThread")

    groups = models.ManyToManyField(
        Group,
        blank=True,
        through="GroupThread")

    case = models.ForeignKey(
        Case,
        blank=True, null=True,
        on_delete=models.CASCADE)

    @classmethod
    def none(cls):
        return cls.objects.none()

    @classmethod
    def all(cls, user):
        return cls.objects.filter(userthread__user=user).distinct()

    @classmethod
    def group(cls, group):
        return cls.objects.filter(groupthread__group=group).distinct()

    @classmethod
    def inbox(cls, user):
        return cls.objects.filter(userthread__user=user, userthread__deleted=False).distinct()

    @classmethod
    def deleted(cls, user):
        return cls.objects.filter(userthread__user=user, userthread__deleted=True).distinct()

    @classmethod
    def read(cls, user):
        return cls.objects.filter(userthread__user=user, userthread__deleted=False, userthread__unread=False).distinct()

    @classmethod
    def unread(cls, user):
        return cls.objects.filter(userthread__user=user, userthread__deleted=False, userthread__unread=True).distinct()

    @classmethod
    def group_unread(cls, group):
        return cls.objects.filter(groupthread__group=group, groupthread__deleted=False, groupthread__unread=True).distinct()

    @classmethod
    def is_user_member(cls, user):
        return cls.objects.filter(userthread__user=user).exists()


    def __str__(self):
        return "{}: {}".format(
            self.subject,
            ", ".join([str(user) for user in self.users.all()])
        )


    @property
    @cached_attribute
    def first_message(self):
        return self.messages.all()[0]

    @property
    @cached_attribute
    def latest_message(self):
        return self.messages.order_by("-created").first()

    @property
    @cached_attribute
    def number_attachments(self):
        return MessageAttachment.objects.filter(message__in=self.messages.all()).count()

    @property
    @cached_attribute
    def num_messages(self):
        return len(self.messages.all())

    @classmethod
    def ordered(cls, objs):
        """
        Returns the iterable ordered the correct way, this is a class method
        because we don"t know what the type of the iterable will be.
        """
        objs = list(objs)
        try:
            objs.sort(key=lambda o: o.latest_message.created, reverse=True)
        except:
            pass
        return objs

    def get_absolute_url(self):
        return reverse('cvdp:inboxthread', args=[self.id])

class UserThread(models.Model):

    thread = models.ForeignKey(
        MessageThread,
        on_delete=models.CASCADE)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE)

    unread = models.BooleanField()

    deleted = models.BooleanField()

    def __str__(self):
        return "%s" % self.thread.num_messages

class GroupThread(models.Model):

    thread = models.ForeignKey(
        MessageThread,
        on_delete=models.CASCADE)

    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE)

    unread = models.BooleanField()

    deleted = models.BooleanField()


class MessageManager(models.Manager):
    def search(self, case=None, query=None, author_list=None):
        qs = self.get_queryset()
        if case is not None:
            qs = qs.filter(thread__case=case)
        if author_list is not None:
            qs = qs.filter(sender__in=author_list)
        if query is not None:
            qs = qs.filter(content__search=query)

        return qs

class Message(models.Model):

    thread = models.ForeignKey(
        MessageThread,
        related_name="messages",
        on_delete=models.CASCADE)

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="sent_messages",
        on_delete=models.CASCADE)

    created = models.DateTimeField(
        default=timezone.now)

    content = models.TextField(blank=True, null=True)

    objects = MessageManager()

    @classmethod
    def new_reply(cls, thread, user, content):
        """
        Create a new reply for an existing MessageThread.
        Mark thread as unread for all other participants, and
        mark thread as read by replier.
        """
        msg = cls.objects.create(thread=thread, sender=user, content=content)
        thread.userthread_set.exclude(user=user).update(deleted=False, unread=True)
        thread.groupthread_set.update(deleted=False, unread=True)
        thread.userthread_set.filter(user=user).update(deleted=False, unread=False)
        message_sent.send(sender=cls, message=msg, thread=thread, reply=True, from_group=None)
        return msg


    @classmethod
    def new_group_user_message(cls, from_user, from_group, to_users, to_groups, case, subject, content, signal=True):
        """
        Create a new message to multiple groups/users
        Mark thread as unread for everyone but sender
        """
        thread = MessageThread.objects.create(subject=subject)
        for group in to_groups:
            thread.groupthread_set.create(group=group, deleted=False, unread=True)
        for user in to_users:
            thread.userthread_set.create(user=user, deleted=True, unread=True)
        if not from_group:
            thread.userthread_set.create(user=from_user, deleted=True, unread=False)
        msg = cls.objects.create(thread=thread, sender=from_user, content=content)
        message_sent.send(sender=cls, message=msg, thread=thread, reply=False, from_group=from_group)
        return msg



    @classmethod
    def new_group_message(cls, from_user, from_group, groups, case, subject, content, signal=True):
        """
        Create a new message to groups
        Mark thread as unread for group and mark thread as read for sender
        """
        thread = MessageThread.objects.create(subject=subject)
        for group in groups:
            thread.groupthread_set.create(group=group, deleted=False, unread=True)
        if not from_group:
            thread.userthread_set.create(user=from_user, deleted=True, unread=False)
        msg = cls.objects.create(thread=thread, sender=from_user, content=content)
        message_sent.send(sender=cls, message=msg, thread=thread, reply=False, from_group=from_group)
        return msg

    @classmethod
    def new_message(cls, from_user, from_group, to_users, case, subject, content, signal=True):
        """
        Create a new Message and MessageThread.
        Mark thread as unread for all recipients, and
        mark thread as read and deleted from inbox by creator.
        """
        #if case:
        #    vc = Case.objects.filter(id=case).first()
        #else:
        #    vc = None

        thread = MessageThread.objects.create(subject=subject)
        for user in to_users:
            thread.userthread_set.create(user=user, deleted=False, unread=True)
        if not from_group:
            thread.userthread_set.create(user=from_user, deleted=True, unread=False)
        msg = cls.objects.create(thread=thread, sender=from_user, content=content)
        message_sent.send(sender=cls, message=msg, thread=thread, reply=False, from_group=from_group)
        return msg

    class Meta:
        ordering = ("created",)

    def get_absolute_url(self):
        return self.thread.get_absolute_url()


def get_uuid_filename(self, filename):

    name = str(self.uuid)

    return name

class Attachment(models.Model):
    file = models.FileField(
        _('File'),
        storage=locate(settings.STORAGES['attachments']['BACKEND'])(),
        upload_to=get_uuid_filename,
        max_length=1000,
    )

    filename = models.CharField(
	_('Filename'),
        max_length=1000,
    )

    mime_type = models.CharField(
        _('MIME Type'),
        max_length=255,
    )

    size = models.IntegerField(
        _('Size'),
	help_text=_('Size of this file in bytes'),
    )

    uuid = models.UUIDField(
        default=uuid.uuid4,
	editable=False,
	unique=True)

    uploaded_time = models.DateTimeField(
        default=timezone.now)

    def __str__(self):
        return '%s' % self.filename

    def _get_access_url(self):
        url = self.file.storage.url(self.file.name)
        return url

    access_url = property(_get_access_url)

class MessageAttachment(models.Model):

    file = models.ForeignKey(
        Attachment,
        on_delete=models.CASCADE,
        blank=True,
	null=True)

    thread = models.ForeignKey(
        MessageThread,
        on_delete=models.CASCADE,
        blank=True,
        null=True
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.CASCADE)


class CaseThread(models.Model):

    case = models.ForeignKey(
        Case,
        help_text=_("The case this thread belongs to"),
        on_delete=models.CASCADE)


    created = models.DateTimeField(
        auto_now_add=True
    )

    archived = models.BooleanField(
        default=False)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        help_text=_('The user that started this thread'),
        on_delete=models.SET_NULL)

    subject = models.CharField(
        max_length=1000,
        blank=True,
        null=True)

    official = models.BooleanField(
        default=False,
        help_text=_('The official case thread. Everyone participates.')
    )

    def get_absolute_url(self):
        return reverse('cvdp:case', args=(self.case.case_id,)) + "?thread=" + self.id


class CaseThreadParticipant(models.Model):

    thread = models.ForeignKey(
        CaseThread,
        help_text=_("The case thread"),
        on_delete=models.CASCADE)

    participant = models.ForeignKey(
        CaseParticipant,
        help_text=("The participant"),
        on_delete=models.CASCADE)

    added = models.DateTimeField(
        auto_now_add=True)

    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
	help_text=_('The user that added this user to this thread'),
        on_delete=models.SET_NULL)


class BaseRevisionMixin(models.Model):
    """This is an abstract model used as a mixin: Do not override any of the
    core model methods but respect the inheritor's freedom to do so itself."""

    revision_number = models.IntegerField(
        editable=False,
	verbose_name=_('revision number'))

    user_message = models.TextField(
        blank=True,
    )

    automatic_log = models.TextField(
        blank=True,
	editable=False,
    )

    user = models.ForeignKey(
	settings.AUTH_USER_MODEL,
        verbose_name=_('user'),
	blank=True, null=True,
	on_delete=models.SET_NULL)

    modified = models.DateTimeField(
        auto_now=True)

    created = models.DateTimeField(
        auto_now_add=True)

    previous_revision = models.ForeignKey(
        'self',
	blank=True, null=True,
        on_delete=models.SET_NULL
    )

    deleted = models.BooleanField(
        verbose_name=_('deleted'),
        default=False,
    )

    locked = models.BooleanField(
        verbose_name=_('locked'),
        default=False,
    )

    def inherit_predecessor(self, predecessor):
        """
        This is a naive way of inheriting, assuming that ``predecessor`` is in
        fact the predecessor and there hasn't been any intermediate changes!
        :param: predecessor is an instance of whatever object for which
        object.current_revision implements BaseRevisionMixin.
        """
        predecessor = predecessor.current_revision
        self.previous_revision = predecessor
        self.deleted = predecessor.deleted
        self.locked = predecessor.locked
        self.revision_number = predecessor.revision_number + 1

    def set_from_request(self, request):
        if request.user.is_authenticated:
            self.user = request.user

    class Meta:
        abstract = True

class PostRevisionManager(models.Manager):

    def search(self, query=None):
        qs = self.get_queryset()
        if query is not None:
            query = SearchQuery(query)
            qs = qs.filter(search_vector=query)
        return qs

    def search_my_cases(self, cases, query=None):
        posts = Post.objects.filter(thread__case__in=cases).values_list('id', flat=True)
        qs = self.get_queryset().filter(post__id__in=posts)
        if query:
            query = SearchQuery(query)
            qs = qs.filter(search_vector=query)

        return qs

    def search_my_threads(self, threads, query=None):
        posts = Post.objects.filter(thread__in=threads).values_list('id', flat=True)
        qs = self.get_queryset().filter(post__id__in=posts)
        if query:
            query = SearchQuery(query)
            qs = qs.filter(search_vector=query)
        return qs


class PostRevision(BaseRevisionMixin,  models.Model):
    """This is where main revision data is stored. To make it easier to
       copy, NEVER create m2m relationships."""

    post = models.ForeignKey(
        "Post",
        on_delete=models.CASCADE,
        verbose_name=_('Post'))

    # This is where the content goes, with whatever markup language is used
    content = models.TextField(
        blank=True,
        verbose_name=_('post contents'))

    json_content = models.JSONField(
        _('Slatejs JSON format'),
        default=list,
    )

    search_vector = SearchVectorField(null=True)

    objects = PostRevisionManager()

    def __str__(self):
        if self.revision_number:
            return "(%d)" % self.revision_number
        else:
            return "OG Post"

    def clean(self):
	# Enforce DOS line endings \r\n. It is the standard for web browsers,
        # but when revisions are created programatically, they might
        # have UNIX line endings \n instead.
        self.content = self.content.replace('\r', '').replace('\n', '\r\n')

    def inherit_predecessor(self, post):
        """
        Inherit certain properties from predecessor because it's very
        convenient. Remember to always call this method before
        setting properties :)
        """

        predecessor = post.current_revision
        self.post = predecessor.post
        self.json_content = predecessor.json_content
        self.content = predecessor.content
        self.deleted = predecessor.deleted
        self.locked = predecessor.locked

    class Meta:
        get_latest_by = 'revision_number'
        ordering = ('created',)
        unique_together = ('post', 'revision_number')
        indexes = [ GinIndex(
            fields = ['search_vector'],
            name = 'post_gin',
            )
        ]

""" Adapted from Misago
https://github.com/rafalp/Misago
"""
class PostManager(models.Manager):
    def search(self, case=None, query=None, author_list=[]):
        qs = self.get_queryset()
        if case is not None:
            qs = qs.filter(case=case)
        if author_list is not None:
            qs = qs.filter(author__in=author_list)
        if query is not None:
            qs = qs.filter(current_revision__content__search=query)
        return qs

class Post(models.Model):
    current_revision = models.OneToOneField(
        'PostRevision',
        blank=True,
        null=True,
        on_delete=models.CASCADE,
        related_name='current_set',
        help_text=_('The revision displayed for this post.  If you need to rollback, change value of this field.'))

    thread = models.ForeignKey(
        CaseThread,
        help_text=('The case this post belongs to'),
        on_delete=models.CASCADE,
    )

    created = models.DateTimeField(
        default=timezone.now
    )

    modified = models.DateTimeField(
        auto_now=True
    )

    author = models.ForeignKey(
        Contact,
        blank=True, null=True,
        help_text=_('The writer of this post.'),
        on_delete=models.SET_NULL)

    group = models.ForeignKey(
        Group,
        blank=True, null=True,
        help_text=_('The group of the user'),
	on_delete=models.SET_NULL
    )

    author_text = models.CharField(
        help_text=_('Info about author/membership if contact or group are nonexistent/removed'),
        max_length=500,
        blank=True,
        null=True)

    pinned = models.BooleanField(
        default=False,
	help_text=_('A pinned post is pinned to the top of the page.'),
    )

    deleted = models.BooleanField(
        default=False
    )

    objects = PostManager()

    def add_revision(self, new_revision, save=True):
        """
        Sets the properties of a revision and ensures its the current
        revision.
        """
        assert self.id or save, (
            'Post.add_revision: Sorry, you cannot add a'
            'revision to a post that has not been saved '
            'without using save=True')
        if not self.id:
            self.save()
        revisions = self.postrevision_set.all()
        try:
            new_revision.revision_number = revisions.latest().revision_number + 1
        except PostRevision.DoesNotExist:
            new_revision.revision_number = 0
        new_revision.post = self
        new_revision.previous_revision = self.current_revision
        if save:
            new_revision.clean()
            new_revision.save()
        self.current_revision = new_revision
        if save:
            self.save()

    def __str__(self):
        if self.current_revision:
            return str(self.current_revision.revision_number)
        obj_name = _('Post without content (%d)') % (self.id)
        return str(obj_name)

class PostThread(models.Model):

    parent = models.ForeignKey(
        Post,
        related_name='top_thread',
        on_delete=models.CASCADE)

    replies = models.ManyToManyField(
        Post,
        through='PostReply')


class PostReply(models.Model):

    reply = models.ForeignKey(
        PostThread,
        on_delete=models.CASCADE)

    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE)


class CaseViewed(models.Model):
    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
	blank=True, null=True,
        on_delete=models.CASCADE)

    first_viewed = models.DateTimeField(
        auto_now_add=True)

    date_viewed = models.DateTimeField(
	default=timezone.now)


class PostLikes(models.Model):

    post = models.ForeignKey(
        Post,
        related_name="reactions",
        on_delete=models.CASCADE)

    reaction = models.CharField(
        _('Icon clicked'),
        max_length=20)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE)

    created = models.DateTimeField(
        auto_now_add=True)

    def __str__(self):
        return '%s reacted to post' % self.user.screen_name

class EmailTemplate(models.Model):

    CASE_EMAIL = 0
    USER_EMAIL = 1
    REPORT_EMAIL = 2
    MESSAGE_EMAIL = 3
    POST_EMAIL = 4
    TICKET_EMAIL = 5

    TEMPLATE_TYPES = (
        (CASE_EMAIL, 'Case'),
        (USER_EMAIL, 'User'),
        (REPORT_EMAIL, 'Report'),
        (MESSAGE_EMAIL, 'Message'),
        (POST_EMAIL, 'Post'),
        (TICKET_EMAIL, 'Ticket'),
    )

    template_name = models.CharField(
        _('Template Name'),
        max_length=150)

    template_type = models.IntegerField(
        choices=TEMPLATE_TYPES)

    title = models.CharField(
        _('HTML Email Title'),
        max_length=250,
        blank=True,
        null=True,
        help_text=_('If present, this will be used '
                    'for a header in the HTML email.'
                    ' Not used for plain text emails.')
    )

    subject = models.CharField(
        _('Subject'),
        max_length=150,
        help_text=_('If related to a case, this will be '
                    'prefixed with the case ID and/or any '
                    'user supplied identifier')
    )

    plain_text = models.TextField(
        _('Plain Text'),
        help_text=('The contents of the email in plain text. '
                   'If related to a case, generic case '
                   'information will be available through '
                   'the context.')
    )

    html = models.TextField(
        _('HTML'),
        help_text=_('The HTML version of the email, with the '
                    'same context available in the plain text '
                    'version.')
    )

    locale = models.CharField(
        _('Locale'),
        max_length=10,
        blank=True,
        null=True,
        help_text=_('Locale of this template.'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        help_text=_('The user that added this template, or if null '
                    'most likely it was system generated.'),
        blank=True,
        null=True)

    modified = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return '%s' % self.template_name

    class Meta:
        ordering = ('template_name', 'locale')
        verbose_name = _('e-mail template')
        verbose_name_plural = _('e-mail templates')


class VulnerabilityManager(models.Manager):
    def search(self, query=None):
        qs = self.get_queryset()
        if query is not None:
            if re.match('cve-', query, re.I):
                query = query[4:]

            query = SearchQuery(query)
            qs = qs.filter(search_vector=query)
        return qs

    def search_my_vuls(self, qs, query=None):
        if not qs:
            qs = self.get_queryset()
        if query is not None:
            if re.match('cve-', query, re.I):
                query = query[4:]
            query = SearchQuery(query)
            qs = qs.filter(search_vector=query)
        return qs

    def search_my_cases(self, cases, query=None):
        qs = Vulnerability.objects.filter(case__in=cases)
        if query is not None:
            if re.match('cve-', query, re.I):
                query = query[4:]
            query = SearchQuery(query)
            qs = qs.filter(search_vector=query)
        return qs


ACK_SCHEMA_VALIDATOR = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "names": {
                "type": "string",
            },
            "organization": {
                "type": "string"
            }
        },
        "required": ["names"]
    }
}

REF_SCHEMA_VALIDATOR = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
            },
            "summary": {
                "type": "string"
            },
            "tags": {

                "type": "array",
                "minItems": 1,
                "uniqueItems": True,
                "items": {
                    "oneOf" : [
                        {
                            "type": "string",
                            "enum": [
                                "broken-link",
                                "customer-entitlement",
                                "exploit",
                            "government-resource",
                                "issue-tracking",
                                "mailing-list",
                                "mitigation",
                                "not-applicable",
                                "patch",
                                "permissions-required",
                                "media-coverage",
                                "product",
                                "related",
                            "release-notes",
                                "signature",
                                "technical-description",
                                "third-party-advisory",
                                "vendor-advisory",
                                "vdb-entry"
                            ]
                        },
                        {
                            "type": "string",
                            "minLength": 2,
                            "maxLength": 128,
                            "pattern": "^x_.*$",
                            "$comment": "These values are not used as JSON property names, so there is not a need to work-around property naming limitations in some common implementations."
                        },
                    ]
                }
            }
        },
        "required": ["url"]
    }
}




class Vulnerability(models.Model):

    cve = models.CharField(
        _('CVE'),
        max_length=50,
        blank=True,
        null=True)

    title = models.TextField(
        blank=True,
        null=True)

    description = models.TextField(
        _('Description'))

    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE)

    sequence = models.IntegerField(
        default=1)

    publish = models.BooleanField(
        default=True)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL)

    date_added = models.DateTimeField(
        default=timezone.now)

    modified = models.DateTimeField(
        auto_now=True
    )

    date_public = models.DateField(
        blank=True,
        null=True
    )

    date_published = models.DateTimeField(
        help_text=_('Auto-set if vul is published from VINCE-NT.'),
        blank=True,
        null=True
    )

    tags = models.JSONField(
        default=list,
        validators=[JSONSchemaValidator(limit_value={"type": "array", "items":
                                                     {"type": "string",
                                                      "enum": [
                                                          "unsupported-when-assigned",
                                                          "exclusively-hosted-service",
                                                          "disputed"]}})],
        blank=True,
        null=True
    )

    problem_types = models.JSONField(
        _('Problem Type'),
        default=list,
        blank=True,
        null=True)


    references = models.JSONField(
        _('References'),
        validators=[JSONSchemaValidator(limit_value=REF_SCHEMA_VALIDATOR)],
        default = list)

    acknowledgments = models.JSONField(
        _('Acknowledgments'),
        default = list,
        validators=[JSONSchemaValidator(limit_value=ACK_SCHEMA_VALIDATOR)],
        blank=True,
        null=True)

    deleted = models.BooleanField(
        default=False,
        help_text=_('Only present if a vulnerability is deleted after a case has moved to active state.'))

    search_vector = SearchVectorField(null=True)

    objects = VulnerabilityManager()

    def _get_vul(self):
        """ A user-friendly Vul ID, which is the cve if cve exists,
        otherwise it's a combination of vul ID and case. """
        if (self.cve):
            return u"CVE-%s" % self.cve
        else:
            return u"%s.%s" % (self.case.caseid, self.sequence)

    vul = property(_get_vul)

    class Meta:
        verbose_name = "Vulnerability"
        verbose_name_plural = "Vulnerabilities"
        get_latest_by = 'sequence'
        ordering = ('sequence', )
        unique_together = ('case', 'sequence')
        indexes = [GinIndex(
            fields=['search_vector'],
            name= 'vul_gin',
        )
                   ]


    def __str__(self):
        return "%s" % self.vul

    def get_absolute_url(self):
        return reverse('cvdp:case', args=(self.case.case_id,))

    def save(self, *args, **kwargs):
        if not(self.id):
            #only update sequence on initial save
            try:
                latest = Vulnerability.objects.filter(case=self.case).latest()
                self.sequence = latest.sequence + 1
            except:
                #probably the first
                self.sequence = 1

        super(Vulnerability, self).save(*args, **kwargs)


class VulnerabilityTag(models.Model):
    """
    Tagging vuls is a cool thing to do.
    """

    vulnerability = models.ForeignKey(
        Vulnerability,
        on_delete=models.CASCADE,
	verbose_name=_('Vulnerability'),
    )

    created = models.DateTimeField(
        auto_now_add=True
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        help_text=_('User that created this tag.'),
        verbose_name=_('User'),
    )

    tag = models.CharField(
        max_length=50,
        help_text=_('The tag')
    )

    def __str__(self):
        return self.tag


class CWEDescriptions(models.Model):

    cweid = models.CharField(
        blank=True, null=True,
        max_length=10
    )

    slice_1003 = models.BooleanField(
        default=False)

    usage = models.CharField(
        blank=True, null=True,
        max_length=100)

    description = models.TextField(
        blank=True,
        null=True)

    cwe = models.CharField(
        max_length=1000,
    )

    # CWEs that are children of this CWE
    children = models.JSONField(
        default=list
    )

    def __str__(self):
        return self.cweid

    class Meta:
        verbose_name = "CWE Description"
        verbose_name_plural = "CWE Descriptions"

class AssignmentRole(models.Model):

    role = models.CharField(
        max_length=200)

    group = models.ForeignKey(
        Group,
        on_delete=models.SET_NULL,
        blank=True,
        null=True)

    def __str__(self):
        if self.group:
            return f"{self.group} {self.role}"
        else:
            return self.role

class UserAssignmentWeight(models.Model):

    user = models.ForeignKey(
	settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assignment")

    role = models.ForeignKey(
        AssignmentRole,
        related_name='users',
        on_delete=models.CASCADE)

    weight = models.IntegerField(
    )

    current_weight = models.IntegerField(
        default = 0)

    effective_weight = models.IntegerField(
        )

    def save(self, *args, **kwargs):

        #  set effective weight to weight if new object
        if self.pk is None:
            self.effective_weight = self.weight

        return super(UserAssignmentWeight, self).save(*args, **kwargs)

    def _get_probability(self):
        #get all weights of this role
        weight_sum = UserAssignmentWeight.objects.filter(role=self.role).aggregate(models.Sum('weight'))
        return self.weight/weight_sum['weight__sum'] * 100

    probability = property(_get_probability)

    class Meta:
        unique_together = (('user', 'role'),)


class CaseArtifactManager(models.Manager):
    def search(self, query=None):
        qs = self.get_queryset()
        if query is not None:
            qs = qs.filter(file__filename__icontains=query)
        return qs

    def search_my_cases(self, cases, query=None):
        qs = CaseArtifact.objects.filter(case__in=cases)
        if query is not None:
            qs = qs.filter(file__filename__icontains=query)
        return qs

class CaseArtifact(models.Model):

    action = models.ForeignKey(
        Action,
        on_delete=models.SET_NULL,
        blank=True,
        null=True
    )

    file = models.ForeignKey(
        Attachment,
        on_delete=models.CASCADE)

    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE)

    shared = models.BooleanField(
        default=False)

    def _get_modified(self):
        # for sorting
        if self.action:
            return self.action.created
        return timezone.now()

    modified = property(_get_modified)

    def _get_title(self):
        # also for searching
        return f"{self.case.caseid} artifact: {self.file.filename}"

    title = property(_get_title)

    def get_absolute_url(self):
        return reverse('cvdp:case', args=(self.case.case_id,))

    objects = CaseArtifactManager()

    def __str__(self):
        return f"{self.file.filename}"

class ThreadArtifact(models.Model):

    file = models.ForeignKey(
        Attachment,
	on_delete=models.CASCADE)

    thread = models.ForeignKey(
        CaseThread,
        on_delete=models.CASCADE)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL)


class CVEReservation(models.Model):

    vul = models.OneToOneField(
        Vulnerability,
        on_delete=models.SET_NULL,
        blank=True,
        null=True)

    cve_id = models.CharField(
        max_length=50)

    time_reserved = models.DateTimeField(
        default=timezone.now)

    account = models.ForeignKey(
        CVEServicesAccount,
        help_text=_('Account used to create reservation'),
        on_delete = models.SET_NULL,
        blank=True,
        null=True)

    user_reserved = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete = models.SET_NULL)

    def __str__(self):
        return self.cve_id

class VulCVSS(models.Model):

    vul = models.ForeignKey(
        Vulnerability,
        related_name='cvss',
        on_delete=models.CASCADE)

    AV = models.CharField(
        _('Attack Vector'),
        blank=True,
        null=True,
	max_length=2)

    AC = models.CharField(
        _('Attack Complexity'),
        blank=True,
        null=True,
        max_length=2)

    PR = models.CharField(
        _('Privileges Required'),
        blank=True,
        null=True,
        max_length=2)

    UI = models.CharField(
        _('User Interaction'),
        blank=True,
        null=True,
	max_length=2)

    S = models.CharField(
        _('Scope'),
        blank=True,
        null=True,
        max_length=2)

    C = models.CharField(
        _('Confidentiality'),
        blank=True,
        null=True,
        max_length=2)

    I = models.CharField(
        _('Integrity'),
        blank=True,
        null=True,
        max_length=2)

    A = models.CharField(
        _('Availability'),
        blank=True,
        null=True,
        max_length=2)

    #Temporal metrics - X if not defined

    E = models.CharField(
        _('Exploit Code Maturity'),
        default='X',
        max_length=2)

    RL = models.CharField(
        _('Remediation Level'),
        default='X',
        max_length=2)

    RC = models.CharField(
        _('Report Confidence'),
        default='X',
        max_length=2)

    scored_by = models.ForeignKey(
       settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        verbose_name=_('User'),
    )

    last_modified = models.DateTimeField(
        _('Last Modified Date'),
        default=timezone.now)

    vectorString = models.CharField(
        _('CVSS Vector String'),
        max_length=100,
        blank=True,
        null=True)

    score = models.DecimalField(
        _('CVSS Base Score'),
        max_digits=3,
        decimal_places=1,
        blank=True,
        null=True)

    severity = models.CharField(
	_('CVSS Severity'),
        max_length=20,
        blank=True,
        null=True)

    version = models.CharField(
        _('CVSS Version'),
        default='3.1',
        max_length=20)

    # this is the CVE JSON object for metrics
    metrics_json = models.JSONField(
        _('CVE JSON CVSS'),
        default=dict)

    
    def save(self, *args, **kwargs):
        if self.id:
            #only update reference on edit
            try:
                if self.version == "4.0":
                    if self.vul.references:
                        for ref in self.vul.references:
                            if "4.0#CVSS:4.0" in ref["url"]:
                                ref["url"] = f"https://www.first.org/cvss/calculator/4.0#{self.vectorString}"
                                self.vul.save()
                                break
                        
            except:
                logger.debug(traceback.format_exc())

        super(VulCVSS, self).save(*args, **kwargs)


class VulAttributes(models.Model):

    vul = models.ForeignKey(
        Vulnerability,
        related_name='attributes',
	on_delete=models.CASCADE)


    name = models.TextField(
    )

    value = models.TextField(
        blank=True,
        null=True
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        verbose_name=_('User'),
    )

    last_edit = models.DateTimeField(
        _('Last Modified Date'),
        default=timezone.now)



class VulSSVC(models.Model):

    vul = models.OneToOneField(
        Vulnerability,
        on_delete=models.CASCADE)

    decision_tree = models.JSONField(
        _('SSVC Decisions'))

    tree_type = models.CharField(
        max_length=100)

    final_decision = models.CharField(
        max_length=50)

    vector = models.CharField(
        max_length=100)

    justifications = models.JSONField(
        _('SSVC Decision Justifications'),
        blank=True,
        null=True)

    user = models.ForeignKey(
	settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        verbose_name=_('User'),
    )

    last_edit = models.DateTimeField(
        _('Last Modified Date'),
        default=timezone.now)


    def __str__(self):
        return self.vector

    def save(self, *args, **kwargs):
        final_decision = ''
        for dec in self.decision_tree:
            if dec['label'] == "Decision":
                final_decision = dec['value']
            else:
                logger.debug(dec['label'])
                VulAttributes.objects.update_or_create(vul=self.vul,

                                                       name=dec['label'],
                                                       defaults = {
                                                           'value': dec['value'],
                                                           'user': self.user,
                                                           'last_edit': timezone.now
                                                       }
	                                               )
        if final_decision:
            VulAttributes.objects.update_or_create(vul=self.vul,
                                                   name=self.tree_type,
	                                           defaults = {
                                                       'value': final_decision,
	                                               'user': self.user,
                                                       'last_edit': timezone.now
                                                   })

        super(VulSSVC, self).save(*args, **kwargs)



class AdvisoryRevision(BaseRevisionMixin,  models.Model):

    advisory = models.ForeignKey(
        'CaseAdvisory',
        on_delete=models.CASCADE,
        verbose_name=_('advisory'))

    # This is where the content goes, with whatever markup language is used
    content = models.TextField(
        blank=True,
	verbose_name=_('advisory contents'))

    json_content = models.JSONField(
        _('Slatejs JSON format'),
        default=list,
    )

    # This title is automatically set from either the article's title or
    # the last used revision...
    title = models.CharField(
	max_length=512,
	verbose_name=_('advisory title'),
        null=False,
	blank=False,
        help_text=_(
            'Each revision contains a title field that must be filled out, even if the title has not changed'))

    references = models.JSONField(
        blank=True,
        null=True,
        verbose_name=_('references'))

    date_published = models.DateTimeField(
        blank=True, null=True)

    date_shared = models.DateTimeField(
        blank=True, null=True)

    version_number = models.CharField(
        max_length = 10,
        blank=True,
        null=True)

    search_vector = SearchVectorField(null=True)

    def __str__(self):
        if self.revision_number:
            return "%s (%d)" % (self.title, self.revision_number)
        else:
            return "%s" % self.title

    def clean(self):
        self.content = self.content.replace('\r', '').replace('\n', '\r\n')

    def inherit_predecessor(self, advisory):
        """
        Inherit certain properties from predecessor because it's very
        convenient. Remember to always call this method before
        setting properties :)"""
        predecessor = advisory.current_revision
        self.advisory = predecessor.advisory
        self.content = predecessor.content
        self.json_content = predecessor.json_content
        self.title = predecessor.title
        self.references = predecessor.references
        self.deleted = predecessor.deleted
        self.locked = predecessor.locked

    class Meta:
        get_latest_by = 'revision_number'
        ordering = ('created',)
        unique_together = ('advisory', 'revision_number')
        indexes = [GinIndex(
            fields=['search_vector'],
            name= 'advisory_gin',
        )
                   ]


class AdvisoryManager(models.Manager):
    def search(self, query=None):
        qs = self.get_queryset()
        if query is not None:
            query = SearchQuery(query)
            qs = qs.filter(current_revision__search_vector = query)
        return qs

    def search_my_cases(self, cases, query=None):
        qs = AdvisoryRevision.objects.filter(advisory__case__in=cases)
        if query is not None:
            query = SearchQuery(query)
            qs = qs.filter(search_vector = query)
        advisories = qs.values_list('advisory__id', flat=True)
        return self.get_queryset().filter(id__in=advisories)


class CaseCSAFSettings(models.Model):

    case = models.OneToOneField(
        'Case',
        help_text=_('CSAF Settings'),
        on_delete = models.CASCADE)

    publisher_settings = models.JSONField(
        help_text=_('Publisher CSAF Settings'),
        default = dict
    )

    doc_id = models.CharField(
        max_length=100,
        blank=True,
        null=True)

    doc_id_format = models.CharField(
        help_text=_("If doc id is generated from a format defined in a profile, set here"),
        max_length=50,
        blank=True,
        null=True)

    lang = models.CharField(
        max_length=10,
        blank=True,
        null=True)

    distribution_tlp = models.CharField(
        max_length=100,
        blank=True,
        null=True)

    notes = models.JSONField(
        help_text=_('Document Notes'),
        default = list
    )

    references = models.JSONField(
        help_text=_('Document References'),
        default = list
    )

    acknowledgements = models.JSONField(
        help_text=_('Document Acknowledgements'),
        default = list
    )

    class Meta:
        verbose_name_plural = "Case CSAF Settings"

    def __str__(self):
        return f"CSAF settings for {self.case.caseid}"


class CaseAdvisory(models.Model):
    current_revision = models.OneToOneField(
        'AdvisoryRevision',
	blank=True, null=True,
        on_delete=models.CASCADE,
	related_name='current_set',
        help_text=_('The current revision. If you need to rollback, change value of this field.')
    )

    case = models.OneToOneField(
        'Case',
	help_text=_('Advisory for the case.'),
	on_delete=models.CASCADE
    )

    created = models.DateTimeField(
        auto_now_add=True
    )

    modified = models.DateTimeField(
        auto_now=True
    )

    date_published = models.DateTimeField(
	blank=True, null=True)

    date_last_published = models.DateTimeField(
	blank=True, null=True)

    def _get_title(self):
        return f"{self.case.caseid} Advisory: {self.current_revision.title}"

    title = property(_get_title)

    objects = AdvisoryManager()

    def add_revision(self, new_revision, save=True):
        """
        Sets the properties of a revision and ensures its the current
        revision.
        """
        assert self.id or save, (
            'Article.add_revision: Sorry, you cannot add a'
            'revision to an article that has not been saved '
            'without using save=True')
        if not self.id:
            self.save()
        revisions = self.advisoryrevision_set.all()
        try:
            new_revision.revision_number = revisions.latest().revision_number + 1
        except AdvisoryRevision.DoesNotExist:
            new_revision.revision_number = 0
        new_revision.advisory = self
        new_revision.previous_revision = self.current_revision
        if save:
            new_revision.clean()
            new_revision.save()
        self.current_revision = new_revision
        if save:
            self.save()

    def __str__(self):
        if self.current_revision:
            return self.current_revision.title
        obj_name = _('Advisory without content (%(id)d)') % {'id': self.id}
        return str(obj_name)

    def get_absolute_url(self):
        return reverse('cvdp:advisory', args=(self.case.case_id,))

    class Meta:
        verbose_name_plural = "Case Advisories"

class CaseActionManager(models.Manager):

    def search(self, query=None):
        qs = self.get_queryset()
        if query is not None:
            qs = qs.filter(title__search=query)
        return qs

    def search_my_cases(self, cases, query=None):
        qs = CaseAction.objects.filter(case__in=cases)
        if query:
            qs = qs.annotate(search=SearchVector('title', 'user__screen_name')).filter(Q(search = query)|Q(title__icontains=query))
            #qs = qs.filter(title__search=query)
        return qs

class CaseAction(Action):

    ACTION_TYPE = (
        (1, 'Share'),
        (2, 'Coordinator Only'),
    )

    case = models.ForeignKey(
        Case,
        help_text=_('Case'),
        on_delete=models.CASCADE
    )

    state = models.ForeignKey(
        "CaseState",
        blank=True,
        null=True,
        help_text=_('Case State Transition'),
        on_delete=models.SET_NULL)

    action_type = models.IntegerField(
        default = 2
    )

    artifact = models.ForeignKey(
        CaseArtifact,
        blank=True, null=True,
        on_delete=models.SET_NULL)

    participant = models.ForeignKey(
        CaseParticipant,
        blank=True, null=True,
        on_delete = models.SET_NULL)

    vulnerability = models.ForeignKey(
        Vulnerability,
        blank=True, null=True,
        on_delete=models.SET_NULL)

    post = models.ForeignKey(
        PostRevision,
        blank=True, null=True,
        on_delete=models.SET_NULL)

    advisory = models.ForeignKey(
        AdvisoryRevision,
        blank=True, null=True,
        on_delete=models.SET_NULL)

    objects = CaseActionManager()

    def __str__(self):
        return f"{self.user.screen_name} made change to {self.case.caseid}: {self.title}"

class CaseChange(models.Model):

    action = models.ForeignKey(
        CaseAction,
        on_delete = models.CASCADE
    )

    field = models.CharField(
        _('Field'),
        max_length=100,
    )

    old_value = models.TextField(
        _('Old Value'),
        blank=True,
        null=True,
    )

    new_value = models.TextField(
        _('New Value'),
        blank=True,
        null=True,
    )

    def __str__(self):
        out = '%s ' % self.field
        if not self.new_value:
            out += 'removed'
        elif not self.old_value:
            out += ('set to %s') % self.new_value
        else:
            out += ('changed from "%(old_value)s" to "%(new_value)s"') % {
                'old_value': self.old_value,
                'new_value': self.new_value
            }
        return out



class ContactAction(Action):

    contact = models.ForeignKey(
	Contact,
        help_text=_('Contact'),
	on_delete=models.SET_NULL,
        blank=True, null=True
    )

    group = models.ForeignKey(
        Group,
        help_text=_('Group'),
        on_delete=models.SET_NULL,
        blank=True, null=True
    )

    share = models.BooleanField(
        default=True)

    class Meta:
        ordering = ("-created",)

class ContactChange(models.Model):

    action = models.ForeignKey(
	ContactAction,
	on_delete = models.CASCADE
    )

    field = models.CharField(
	_('Field'),
	max_length=100,
    )

    old_value = models.TextField(
	_('Old Value'),
	blank=True,
	null=True,
    )

    new_value = models.TextField(
	_('New Value'),
	blank=True,
	null=True,
    )

    def __str__(self):
        out = '%s ' % self.field
        if not self.new_value:
            out += 'removed'
        elif not self.old_value:
            out += ('set to %s') % self.new_value
        else:
            out += ('changed from "%(old_value)s" to "%(new_value)s"') % {
		'old_value': self.old_value,
		'new_value': self.new_value
            }
        return out

# These are to keep track of EXTERNAL transfers
# Incoming transfers are found in the CaseReport

class CaseTransfer(models.Model):

    connection = models.ForeignKey(
        AdVISEConnection,
        on_delete=models.SET_NULL,
        blank=True,
        null=True)

    action = models.ForeignKey(
        CaseAction,
        on_delete=models.CASCADE)

    transfer_reason = models.TextField(
        blank=True,
        null=True,
        help_text=_('Th reason for the transfer')
    )

    remote_case_id = models.CharField(
        blank=True,
        null=True)

    accepted = models.BooleanField(
        default=False)

    data_transferred = models.JSONField(
        _('Data Types Transferred'),
        blank=True,
	null=True)


class CaseResolutionOptions(models.Model):

    description = models.CharField(
        max_length=500)

    email_template = models.ForeignKey(
        EmailTemplate,
        on_delete=models.SET_NULL,
        blank=True,
        null=True)

    def __str__(self):
        return self.description


    class Meta:
        verbose_name_plural = "Case Resolution Options"

class TicketThread(models.Model):

    label = models.CharField(
        max_length=100,
        default="no_label"
    )

    case = models.ForeignKey(
        "Case",
        blank=True,
        null=True,
        on_delete=models.CASCADE)

    def __str__(self):
        if self.case:
            return "%s %s" % (self.case.caseid, self.label)
        return "%s" % self.label
"""
    @classmethod
    def case(cls, case):
        return cls.objects.filter(tickets__thread__case__case_id=case)
"""


class TicketManager(models.Manager):
    def search(self, query=None):
        qs = self.get_queryset()
        if query is not None:
            query = SearchQuery(query)
            qs = qs.filter(search_vector=query)
        return qs

    def search_my_tickets(self, cases, user, query=None):
        tickets = Ticket.objects.filter(Q(thread__case__in=cases) | Q(assigned_to=user)).values_list('id', flat=True)
        qs = self.get_queryset().filter(id__in=tickets)
        if query is not None:
            query = SearchQuery(query)
            qs = qs.filter(search_vector=query)
        return qs


class Ticket(models.Model):

    OPEN_STATUS = 1
    CLOSED_STATUS = 2
    IN_PROGRESS_STATUS = 3

    STATUS_CHOICES = (
        (OPEN_STATUS, _('Open')),
        (CLOSED_STATUS, _('Closed')),
        (IN_PROGRESS_STATUS, _('In Progress')),
    )

    thread = models.ForeignKey(
        TicketThread,
        related_name="tickets",
        on_delete=models.CASCADE)

    title = models.TextField(
        _('Title'),
    )

    created = models.DateTimeField(
        _('Created'),
        auto_now_add=True,
        help_text=_('Date/Time created'),
    )

    modified = models.DateTimeField(
        _('Modified'),
        auto_now=True,
        help_text=_('Last modified.'),
    )

    submitted_by = models.CharField(
        _('Submitted by'),
        max_length=300,
        blank=True,
        null=True,
    )

    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='assigned_to',
        blank=True,
        null=True,
        verbose_name=_('Assigned to'),
    )

    team = models.ForeignKey(
        Group,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        verbose_name=_('Team Assigned')
    )

    status = models.IntegerField(
        _('Status'),
        choices=STATUS_CHOICES,
        default=OPEN_STATUS,
    )

    content = models.TextField(
        _('Task Content'),
        blank=True,
        null=True,
        help_text=_('The content of the ticket.'),
    )

    search_vector = SearchVectorField(null=True, editable=False)

    objects = TicketManager()

    class Meta:
        indexes = [ GinIndex(
            fields = ['search_vector'],
            name = 'ticket_gin',
            )
                   ]

    def _get_assigned_to(self):
        if not self.assigned_to:
            return _('Unassigned')
        else:
            return self.assigned_to.screen_name

    get_assigned_to = property(_get_assigned_to)

    @classmethod
    def unassigned(cls):
        return cls.objects.filter(assigned_to__isnull=True)

    def get_absolute_url(self):
        if self.thread.case:
            return reverse('cvdp:case', args=(self.thread.case.case_id,))+"/dash"
        else:
            return reverse('cvdp:dashboard')


    def save(self, *args, **kwargs):
        c = self.thread.case
        if c and not self.pk:
            #if we're adding a case ticket, update the case modified time
            c.modified = timezone.now()
            c.save()

        super(Ticket, self).save(*args, **kwargs)

    def assign(self, assignee, user=None):
        change = False
        if self.assigned_to:
            if self.assigned_to != assignee:
                self.assigned_to = assignee
                self.save()
                change=True
                if user:
                    TicketAction.objects.create(title=f"re-assigned ticket to {assignee.screen_name}",
                                                user=user,
                                                ticket=self)

        else:
            self.assigned_to = assignee
            change=True
            self.save()
            if user:
                TicketAction.objects.create(title=f"assigned ticket to {assignee.screen_name}",
                                            user=user,
                                            ticket=self)
        #create ticket receipt if person doing assigning isn't the assignee
        if change and assignee != user:
            TicketReceipt.objects.update_or_create(ticket=self,
                                                   user=assignee)

    def unassign(self, user=None):
        if self.assigned_to:
            self.assigned_to = None
            self.save()
            TicketAction.objects.create(title="unassigned ticket",
                                        user=user,
                                        ticket=self)

    def mark_read(self, user):
        tr = TicketReceipt.objects.filter(ticket=self, user=user, unread=True).first()
        if tr:
            tr.unread=False
            tr.save()


    def assign_team(self, assignee, user=None):
        change = False
        if self.team:
            if self.team != assignee:
                self.team = assignee
                self.save()
                change=True
                if user:
                    TicketAction.objects.create(title=f"re-assigned ticket to {assignee.name}",
                                                user=user,ticket=self)
        else:
            self.team = assignee
            change=True
            self.save()
            if user:
                TicketAction.objects.create(title=f"assigned ticket to {assignee.name}",
                                            user=user,
                                            ticket=self)

    def unassign_team(self, user=None):
        if self.team:
            TicketAction.objects.create(title = f"unassigned team {self.team.name}",
                                        user = user,
                                        ticket=self)
            self.team = None
            self.save()



class EmailThread(models.Model):

    topic = models.CharField(
        max_length=1000)

    def __str__(self):
        return self.topic

    @classmethod
    def triage(cls, status=[1]):
        #how about unassigned case tickets?tickets__thread__case__isnull=True,
        return cls.objects.filter(emails__assigned_to__isnull=True, emails__team__isnull=True, emails__thread__case__isnull=True, emails__status__in=status).distinct('id')

    @classmethod
    def team_triage(cls, teams, status=[1]):
        #teams takes a queryset of Group objects
        if teams:
            return cls.objects.filter(emails__assigned_to__isnull=True, emails__team__in=teams, emails__thread__case__isnull=True, emails__status__in=status).distinct('id')
        else:
            return cls.objects.filter(emails__assigned_to__isnull=True, emails__thread__case__isnull=True, emails__status__in=status).distinct('id')

    @classmethod
    def case(cls, case):
        return cls.objects.filter(emails__thread__case__case_id=case).distinct('id')

    @classmethod
    def team_tickets(cls, team, status='open', search=None):
        if status:
            status = status.lower()

        num_status = None
        if status == "closed":
            num_status = Ticket.CLOSED_STATUS
        elif status == "open":
            num_status = Ticket.OPEN_STATUS
        elif status == "progress":
            num_status = Ticket.IN_PROGRESS_STATUS

        tkts = cls.objects.filter(emails__team=team)

        if num_status:
            tkts = tkts.filter(emails__status=num_status)

        if search:
            logger.debug(search)
            query = SearchQuery(search)
            tkts = tkts.filter(emails__search_vector=query)

        return tkts.distinct('id')

    @classmethod
    def mytickets(cls, user, status='open'):
        if status:
            query_status = status.lower()
        else:
            query_status = 'open'
        if query_status == "all":

            return cls.objects.filter(emails__assigned_to=user).distinct('id')
        if query_status == "open":
            num_status = Ticket.OPEN_STATUS
        elif query_status == "closed":
            num_status = Ticket.CLOSED_STATUS
        elif query_status == "unread":
            unread_tickets = TicketReceipt.objects.filter(unread=True, user=user).values_list('ticket__id', flat=True)
            return cls.objects.filter(emails__id__in=unread_tickets, emails__assigned_to=user).distinct('id')
        else:
            num_status = Ticket.IN_PROGRESS_STATUS
        return cls.objects.filter(emails__assigned_to=user, emails__status=num_status).distinct('id')

    @classmethod
    def case_status(cls, case, status):
        return cls.objects.filter(emails__thread__case__case_id=case, emails__status=status).distinct('id')

    @classmethod
    def unread(cls, case, user):
        unread_tickets = TicketReceipt.objects.filter(unread=True, user=user).values_list('ticket__id', flat=True)
        return cls.objects.filter(emails__id__in=unread_tickets, emails__assigned_to=user, emails__thread__case__case_id=case).distinct('id')


    @property
    @cached_attribute
    def num_messages(self):
        return len(self.emails.all())

    @property
    @cached_attribute
    def latest_message(self):
        return self.emails.order_by("-created").first()

    @classmethod
    def ordered(cls, objs):
        """
        Returns the iterable ordered the correct way, this is a class method
        because we don"t know what the type of the iterable will be.
        """
        objs = list(objs)
        try:
            objs.sort(key=lambda o: o.latest_message.modified, reverse=True)
        except:
            pass
        return objs


class EmailTicket(Ticket):

    email_thread = models.ForeignKey(
        EmailThread,
        related_name="emails",
        on_delete = models.CASCADE)

    message_id = models.CharField(
        max_length=250,
        blank=True,
	null=True,
        help_text=_('email header message id')
    )

    msg_thread = models.ForeignKey(
        MessageThread,
        blank=True,
        null=True,
        on_delete = models.SET_NULL)

    sent_to = models.JSONField(
        blank=True,
        null=True,
        help_text=_('Sent To, CC')
    )

    parent = models.BooleanField(
        default=True,
        help_text=_('Set to false if this is a reply')
    )

    references = models.JSONField(
        blank=True,
        null=True,
        help_text=_('email header references')
    )

    email_id = models.CharField(
        max_length=150,
        blank=True,
        null=True,
        help_text=_('external email reference ID, (e.g. AWS email id)')
    )


    def __str__(self):
        return "%s" % self.title


"""
When  a ticket (email) gets assigned to a user, one of these
will be created for that user so we can keep track of read/unread
"""

class TicketReceipt(models.Model):

    ticket = models.ForeignKey(
	Ticket,
        on_delete=models.CASCADE)

    user = models.ForeignKey(
	settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE)

    unread = models.BooleanField(default=True)

    #keep track of what time it was opened
    modified = models.DateTimeField(
        auto_now=True)

    def __str__(self):
        if self.unread:
            return "Ticket unread"
        else:
            return "Ticket read"


class TicketAction(Action):

    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        verbose_name=_('Ticket')
    )

    comment = models.TextField(
        _('Comment'),
        help_text=_('A comment on some ticket action'),
        blank=True,
        null=True
    )


class EmailAttachment(models.Model):

    file = models.ForeignKey(
        Attachment,
        on_delete=models.CASCADE,
        blank=True,
        null=True)

    ticket = models.ForeignKey(
        EmailTicket,
        on_delete=models.CASCADE,
        blank=True,
        null=True
    )



class CaseNote(models.Model):

    case = models.ForeignKey(
        "Case",
        on_delete=models.CASCADE)

    created = models.DateTimeField(
	_('Created'),
        auto_now_add=True,
        help_text=_('Date/Time created'),
    )

    modified = models.DateTimeField(
        _('Modified'),
        auto_now=True,
	help_text=_('Last modified.'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
    )

    content = models.TextField(
	_('Task Content'),
        blank=True,
	null=True,
	help_text=_('The content of the ticket.'),
    )

    flagged = models.BooleanField(
        default = False)

    archived = models.BooleanField(
        default = False)


"""
class ActionComment(Action):

    comment = models.TextField(
        _('Comment'),
        help_text=_('A comment on some ticket action')
    )
"""


class CaseTag(models.Model):
    """
    Tagging vuls is a cool thing to do.
    """

    case = models.ForeignKey(
        Case,
        related_name='tags',
        on_delete=models.CASCADE,
        verbose_name=_('Case'),
    )

    created = models.DateTimeField(
        auto_now_add=True
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        help_text=_('User that created this tag.'),
        verbose_name=_('User'),
    )

    tag = models.CharField(
        max_length=100,
        help_text=_('The tag')
    )

    def __str__(self):
        return self.tag


class CaseState(models.Model):

    BADGE_CHOICES = (
        ('primary', 'Primary'),
        ('secondary', 'Secondary'),
        ('success', 'Success'),
        ('danger', 'Danger'),
        ('warning', 'Warning'),
        ('info', 'Info'),
        ('light', 'Light'),
        ('dark', 'Dark'),
    )

    name = models.CharField(
        _('State name'),
        max_length=100)

    description = models.TextField(
        _('Description of transition criteria'),
        blank=True,
        null=True)

    code = models.CharField(
        _('Short name id used for automation'),
        editable=False,
        max_length=100,
    )

    parent = models.CharField(
        _('This is a sub-state of parent (use code)'),
        max_length=100,
        blank=True,
        null=True)

    order = models.IntegerField(
        _('Order of state in CVD process'),
        blank=True,
        null=True)

    color = models.CharField(
        _('Badge color'),
        choices=BADGE_CHOICES,
        default="secondary",
        max_length=100)


    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.code = self.name.lower().replace(" ", "_")
        super(CaseState, self).save(*args, **kwargs)


class CaseApproval(models.Model):
    WAITING = 0
    REJECTED = 1
    APPROVED = 2
    ADVISORY = 1
    CVE = 2
    PUBLISH_ADVISORY=3

    APPROVAL_STATUS_CHOICES = (
        (WAITING, _('Waiting')),
        (REJECTED, _('Rejected')),
        (APPROVED, _('Approved')),
    )

    APPROVAL_TYPE = (
        (ADVISORY, _('Share Advisory')),
        (CVE, _('Publish CVE')),
        (PUBLISH_ADVISORY, _('Publish Advisory')),
    )

    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        verbose_name=_('Case'),
    )

    created = models.DateTimeField(
        auto_now_add=True
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        help_text=_('User requesting approval.'),
        verbose_name=_('User'),
    )

    status = models.IntegerField(
        _('Status'),
        choices=APPROVAL_STATUS_CHOICES,
        default=WAITING,
    )

    request = models.IntegerField(
        _('Approval Type'),
        choices=APPROVAL_TYPE,
        default=ADVISORY
    )

    approval_comments = models.TextField(
        blank=True,
        null=True,
        help_text=_('Comments')
    )

    request_comments = models.TextField(
        blank=True,
        null=True,
        help_text=_('Request Comments')
    )

    completed = models.DateTimeField(
        blank=True,
        null=True)

    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name=_('completed_by'),
        blank=True,
        null=True,
        help_text=_('User completed.'),
    )

    vulnerability = models.ForeignKey(
        Vulnerability,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        verbose_name=_('Vulnerability'),
    )

    advisory_version = models.CharField(
        max_length=100,
        blank=True,
        null=True)


class TriageCalendarEvent(models.Model):

    TRIAGE = 1
    OOF = 2

    EVENT_CHOICES = (
	(TRIAGE, _('Triage')),
        (OOF, _('Out of Office'))
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="scheduled",
        on_delete=models.CASCADE
    )

    user_added = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="user_added",
        blank=True,
	null=True)

    coord_team = models.ForeignKey(
	Group,
        on_delete=models.CASCADE,
        verbose_name=_('Group'),
    )

    created = models.DateTimeField(
        default=timezone.now)

    date = models.DateField()

    end_date = models.DateField(
        blank=True,
        null=True)

    title = models.CharField(
        _('Event Title'),
        max_length=200)

    event_id = models.IntegerField(
	choices=EVENT_CHOICES,
        default=TRIAGE
    )


class DailyEmailNotification(models.Model):

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )

    created = models.DateTimeField(
	default=timezone.now)

    notifications = models.JSONField(
        help_text=_('A list of notifications that occurred today.'),
        default=list
    )


class BounceEmailNotification(models.Model):

    TRANSIENT=0
    PERMANENT=1

    BOUNCE_CHOICES = (
        (TRANSIENT, _('Transient')),
        (PERMANENT, _('Permanent'))
    )

    email = models.CharField(
        max_length=320)

    from_email = models.CharField(
        max_length=320)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.CASCADE)

    bounce_date = models.DateTimeField(
        default=timezone.now)

    bounce_type = models.IntegerField(
        _('Bounce Type'),
        choices=BOUNCE_CHOICES,
        default=TRANSIENT
    )

    subject = models.TextField(
	blank=True,
        null=True)

    action = models.TextField(
        blank=True,
        null=True)
