from django.db import models
from django.contrib.auth.models import Group
from django.db.models import Q
from django.core.exceptions import ObjectDoesNotExist
from django.contrib.auth import get_user_model
from django.utils.translation import gettext as _
from pydoc import locate
from cvdp.validators import JSONSchemaValidator
from django.utils import timezone
from django.urls import reverse
from django.conf import settings
from django.contrib.postgres.search import SearchVectorField, SearchQuery, SearchVector
from django.contrib.postgres.indexes import GinIndex
from cvdp.models import Vulnerability, BaseRevisionMixin, Action, Case
import logging


logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

User = get_user_model()


COMPONENT_TYPES = (
    ('Application', 'Application'),
    ('Container', 'Container'),
    ('Device', 'Device'),
    ('Library', 'Library'),
    ('File', 'File'),
    ('Firmware', 'Firmware'),
    ('Framework', 'Framework'),
    ('Operating System', 'Operating System'),
    ('Service', 'Service'),
    ('Other', 'Other'),
)

#Everything is a component.  A product is a component that has dependencies
# and/or a defined supplier within the system.

class ComponentManager(models.Manager):
    def search(self, query=None):
        qs = self.get_queryset()
        if query is not None:
            query = SearchQuery(query)
            qs = qs.filter(search_vector = query, deleted=False)
        return qs

    def search_my_components(self, qs, query=None):
        if not qs:
            qs = self.get_queryset()
        if query is not None:
            squery = SearchQuery(query)
            #qs = qs.filter(search_vector = query, deleted=False)
            qs = qs.filter(Q(search_vector = squery)|Q(name__icontains=query)).exclude(deleted=True)
        return qs

class AbstractComponent(models.Model):

    name = models.CharField(
        max_length=250)

    component_type = models.CharField(
        max_length=50,
        choices=COMPONENT_TYPES,
        default='Application')

    version = models.CharField(
        blank=True,
        null=True,
        max_length=100)

    supplier = models.CharField(
        max_length=250, blank=True,
        null=True)

    source = models.TextField(
        blank=True, null=True,
        help_text=_('Download Location')
    )

    homepage = models.CharField(
        max_length=500, blank=True,
        null=True)

    checksum = models.CharField(
        blank=True, null=True,
        max_length=500)

    external_ids = models.JSONField(
        blank=True, null=True,
        help_text=_('Other unique identifiers, like CPE, SWID, or PURL in a JSON dict')
    )

    comment = models.TextField(
        blank=True, null=True
    )

    notes = models.TextField(
        blank=True, null=True,
        help_text=_('Coordinator/Analyst Notes')
    )
    
    def __str__(self):
        if self.version:
            return f"{self.name} {self.version}"
        else:
            return str(self.name)

    class Meta:
        abstract=True
        verbose_name = _('Component')
        verbose_name_plural = ('Components')


class Component(AbstractComponent):

    # the user that added this component
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete = models.SET_NULL,
        blank=True,
        null=True
    )

    parent = models.BooleanField(
        help_text=_('The root component'),
        default=False)

    created = models.DateTimeField(
        default=timezone.now)

    modified = models.DateTimeField(
        auto_now=True)

    deleted = models.BooleanField(
        default=False)

    search_vector = SearchVectorField(null=True)

    objects = ComponentManager()

    class Meta:
        ordering = ('name',)
        indexes = [ GinIndex(
            fields = ['search_vector'],
            name = 'component_gin',
        )
                   ]

    def get_absolute_url(self):
        return reverse('cvdp:componentdetail', args=[self.id])

    def get_vendor(self):
        try:
            return self.product_info.supplier.name
        except ObjectDoesNotExist:
            return self.supplier
        except AttributeError:
            return self.supplier

class ProductManager(models.Manager):
    def search(self, query=None):
        qs = self.get_queryset()
        if query is not None:
            query = SearchQuery(query)
            qs = qs.filter(search_vector = query, component__deleted=False)
        return qs

    def search_my_components(self, qs, query=None):
        if not qs:
            qs = self.get_queryset()
        if query is not None:
            query = SearchQuery(query)
            qs = qs.filter(search_vector = query, component__deleted=False)
        return qs

class Product(models.Model):

    component = models.OneToOneField(
        Component,
        related_name='product_info',
        on_delete=models.CASCADE
    )

    #supplier is not required, but should not be null
    supplier = models.ForeignKey(
        Group,
        on_delete=models.SET_NULL,
        blank=True, null=True)

    dependencies = models.ManyToManyField(
        Component,
        through='ComponentRelationship'
    )

    objects = ProductManager()

    class Meta:
        ordering = ('component__name',)

    @classmethod
    def my_group_products(cls, group):
        return cls.objects.filter(
            supplier=group,
            component__deleted=False,
        )

    @classmethod
    def my_products(cls, groups):
        return cls.objects.filter(
            supplier__in=groups,
            component__parent=True,
            component__deleted=False,
        )

    @classmethod
    def all_products(cls):
        return cls.objects.filter(
            component__deleted=False,
            component__parent=True
        )

    @classmethod
    def deleted_products(cls):
        return cls.objects.filter(
            component__deleted=True,
        )


    @classmethod
    def other_versions(cls, prod):
        return cls.objects.filter(
            component__name=prod.component.name,
            supplier=prod.supplier,
            component__deleted=False
        )

    def __str__(self):
        return f"{self.component.name} {self.component.version}"

    def _get_sbom_id(self):
        """ a DNS-like way to represent components """
        supplier = self.supplier.name if self.supplier else "unknown"
        if self.component.version and (not self.component.parent):
            versions = self.component.version.split(" ")
            return f"sbom://{supplier}/{self.component.name}/{('/').join(versions)}"
        else:
            return f"sbom://{supplier}/{self.component.name}"

    sbom_id = property(_get_sbom_id)


class ComponentRelationship(models.Model):

    component = models.ForeignKey(
        Component,
        on_delete=models.CASCADE)

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE)

    date_added = models.DateTimeField(
        auto_now_add=True)

    def __str__(self):
        return f"{self.product} contains {self.component}"



#ADD COMPONENT TAGS!!!!

VUL_STATUS_CHOICES = [
    'Not Affected',
    'Affected',
    'Fixed',
    'Under Investigation',
    'Unknown'
]


CVE_STATUS_CHOICES = (
    (0, _('Unknown')),
    (1, _('Affected')),
    (2, _('Unaffected')),
)


VERSION_RANGE_CHOICES = [
    None,
    '<',
    '<='
]

JUSTIFICATION_CHOICES = [
    "Component not present",
    "Vulnerable code not present",
    "Vulnerable code not in execute path",
    "Vulnerable code cannot be controlled by adversary",
    "Inline mitigations already exist",
]

REMEDIATION_CATEGORY_CHOICES = [
    "mitigation",
    "no_fix_planned",
    "none_available",
    "vendor_fix",
    "workaround",
]

STATUS_FIELD_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "enum": ["Affected", "Not Affected", "Fixed", "Under Investigation", "Unknown"]
            },
            "version_value": {
                "type": "string"
            },
            "version_range": {
                "type": ["string", "null"],
                "enum": ["<", "<=", ""]
            },
            "version_end_range": {
                "type": ["string", "null"]
            },
            "version_type": {
                "type": ["string", "null"],
                "enum": ["custom", "git", "maven", "python", "rpm", "semver", ""]
            },
            "justification": {
                "type": ["string", "null"],
                "enum": ["Component Not Present",
                         "Vulnerable Code Not Present",
                         "Vulnerable Code not in Execute Path",
                         "Vulnerable Code cannot be controlled by adversary",
                         "Inline mitigations already exist",
                         ""]
            }
        },
        "required": ["status", "version_value"]
    }
}


class StatusRevisionManager(models.Manager):
    def search_my_cases(self, cases, query=None):
        compstatus = ComponentStatus.objects.filter(vul__case__in=cases).values_list('id', flat=True)
        qs = self.get_queryset().filter(component_status__id__in=compstatus)
        if query:
            tsquery = SearchQuery(query)
            qs = qs.annotate(search=SearchVector('component_status__component__name', 'statement', 'component_status__vul__cve')).filter(Q(search=tsquery)|Q(component_status__component__name__icontains=query))
        return qs


class StatusRevision(BaseRevisionMixin, models.Model):

    component_status = models.ForeignKey(
        'ComponentStatus',
        on_delete = models.CASCADE,
        verbose_name=('Component Status'))

    default_status = models.IntegerField(
        choices=CVE_STATUS_CHOICES,
        default=0)

    version_status = models.JSONField(
	help_text=_('Array of Status Objects'),
        validators = [JSONSchemaValidator(limit_value = STATUS_FIELD_SCHEMA)],
        default=list
    )

    statement = models.TextField(
        blank=True,
        null=True)

    approved = models.BooleanField(
        default=False)
    
    objects = StatusRevisionManager()

#    status = models.IntegerField(
#        choices=VUL_STATUS_CHOICES)
#
#    version_name = models.CharField(
#        _('Affected Version End Range'),
#        blank=True,
#        null=True,
#        max_length=100)
#
#    version_affected = models.CharField(
#        _('Version Affected'),
#        choices=VERSION_RANGE_CHOICES,
#        blank=True,
#        null=True,
#        max_length=10)
#
#    version_value = models.CharField(
#        _('Affected Version Value or Start Range'),
#	max_length=100)
#
#    version_type = models.CharField(
#        _('Version Type'),
#        max_length=50,
#        blank=True,
#        null=True,
#        help_text=('The version numbering system used for specifying the range. This defines the exact semantics of the comparison (less-than) operation on versions, which is required to understand the range itself.')
#    )
#
#    justification = models.CharField(
#        _('Justification when status is Not Affected'),
#        choices = JUSTIFICATION_CHOICES,
#        blank=True,
#        null=True,
#        max_length=100)

    def __str__(self):
            return "%s Rev.(%d)" % (self.component_status.component, self.revision_number)

    def inherit_predecessor(self, component_status):
        """
        Inherit certain properties from predecessor because it's very
        convenient. Remember to always call this method before
        setting properties :)"""

        predecessor = component_status.current_revision
        self.component_status = predecessor.component_status
        self.version_status = predecessor.version_status
        self.statement = predecessor.statement
        self.default_status = predecessor.default_status
        #self.version_type = predecessor.version_type
        self.deleted = predecessor.deleted
        self.locked = predecessor.locked
        #self.version_affected = predecessor.version_affected
        #self.version_value = predecessor.version_value
        #self.version_name = predecessor.version_name


    class Meta:
        get_latest_by = 'revision_number'
        ordering = ('created', 'component_status__component__name')
        unique_together = ('component_status', 'revision_number')


class ComponentStatus(models.Model):


    CSAF_COMPONENT_RELATIONSHIP_TYPES = (
        ( "default_component_of", "default component of" ),
        ("external_component_of", "external component of" ),
        ("installed_on", "installed on" ),
        ("installed_with", "installed with" ),
        ( "optional_component_of", "optional component ofd" ),
    )
    
    current_revision = models.OneToOneField(
        'StatusRevision',
        help_text=_('The current status revision'),
        on_delete=models.CASCADE,
        blank=True, null=True,
        related_name='current_set'
    )

    component = models.ForeignKey(
        Component,
        on_delete = models.CASCADE)

    vul = models.ForeignKey(
        Vulnerability,
        on_delete = models.CASCADE)

    share = models.BooleanField(
        default=False)

    relationship = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text=_("Optional relationship from component to other component"),
        choices=CSAF_COMPONENT_RELATIONSHIP_TYPES)
    
    other_component = models.ForeignKey(
        Component,
        blank=True,
        null=True,
        related_name='other_component',
        help_text=_("This is used for more complex component relationships"),
        on_delete = models.SET_NULL)

    other_component_version = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text=_("The version number of the other component, if appropriate"))
    
    def add_revision(self, new_revision, save=True):
        """
        Sets the properties of a revision and ensures its the current
        revision.
        """
        assert self.id or save, (
            'You cannot add a revision without using save=True')
        if not self.id:
            self.save()
        revisions = self.statusrevision_set.all()
        try:
            new_revision.revision_number = revisions.latest().revision_number + 1
        except StatusRevision.DoesNotExist:
            new_revision.revision_number = 0
        new_revision.component_status = self
        new_revision.previous_revision = self.current_revision
        
        if save:
            new_revision.save()
        self.current_revision = new_revision
        if save:
            self.save()

    def approved_revision(self):
        app = self.statusrevision_set.filter(approved=True)
        if app:
            return app.latest()
        else:
            return None
            
    def __str__(self):
        #if self.current_revision and self.current_revision.version_status:
        #    return f"{self.component.name} {self.current_revision.version_status[0].status}"
        #else:
        return f"{self.component.name} {self.vul.vul}"

        obj_name = _('Status Unknown')
        return str(obj_name)

class ComponentStatusUpload(models.Model):

    vex = models.JSONField(
	help_text=_('Status in VEX JSON format')
    )

    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE)

    received = models.DateTimeField(
        default = timezone.now)


    user = models.ForeignKey(
	settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.SET_NULL)

    merged = models.BooleanField(
        default = False)

    deleted = models.BooleanField(
        default = False)


class ComponentAction(Action):

    ACTION_TYPE = (
        (1, 'Create'),
        (2, 'Edit'),
        (3, 'SBOM'),
        (4, 'Add Dependency'),
        (5, 'Remove Dependency'),
        (6, 'Status'),
    )

    component = models.ForeignKey(
	Component,
        help_text=_('Component'),
	on_delete=models.CASCADE
    )

    """
    file = models.FileField(
	_('SBOM File'),
        storage=locate(settings.ATTACHMENT_FILES_STORAGE)(),
        upload_to=get_uuid_filename,
	max_length=1000,
    )
    """

    action_type = models.IntegerField(
	default = 2
    )


    def __str__(self):
        return f"{self.user.screen_name} made change to {self.component.name} {self.component.version}: {self.title}"

class ComponentChange(models.Model):

    action = models.ForeignKey(
        ComponentAction,
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


class ComponentTag(models.Model):
    """
    Component Tags
    """

    component = models.ForeignKey(
        Component,
        on_delete=models.CASCADE,
        related_name='tags',
	verbose_name=_('Component'),
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
