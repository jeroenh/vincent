from cvdp.components.models import *
from cvdp.serializers import ChoiceField
from rest_framework import serializers
from django.contrib.auth.models import Group
from django.urls import reverse
from authapp.models import User
from cvdp.cases.serializers import VulSerializer, BasicVulSerializer
from cvdp.groups.serializers import GroupSerializer, GroupLogoSerializer
from cvdp.permissions import is_coordinator
import difflib
from jsondiff import diff
from cvdp.serializers import UserSerializer, BasicUserSerializer
from django.db.models import F, Count
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class ParentProductSerializer(serializers.HyperlinkedModelSerializer):

    id = serializers.ReadOnlyField(source='product.component.id')
    name = serializers.ReadOnlyField(source='product.component.name')
    version = serializers.ReadOnlyField(source='product.component.version')

    class Meta:
        model = ComponentRelationship
        fields = ('id', 'name', 'version', 'date_added')

class ComponentRelationshipSerializer(serializers.HyperlinkedModelSerializer):

    id = serializers.ReadOnlyField(source='component.id')
    name = serializers.ReadOnlyField(source='component.name')
    version = serializers.ReadOnlyField(source='component.version')
    owner = serializers.ReadOnlyField(source='component.product_info.supplier.name')
    source = serializers.ReadOnlyField(source='component.source')

    class Meta:
        model = ComponentRelationship
        fields = ('id', 'name', 'version', 'owner', 'source', 'date_added')


class StatusTransferSerializer(serializers.ModelSerializer):


    class Meta:
        model = ComponentStatusUpload
        fields = ('id', 'vex', 'received', 'user', 'merged', 'deleted')

class DependencySerializer(serializers.ModelSerializer):

    class Meta:
        model = Component
        fields = ('id', 'name', 'version', )



class ComponentSerializer(serializers.ModelSerializer):

    contained_in = ParentProductSerializer(source='componentrelationship_set', many=True, required=False)
    tags = serializers.SerializerMethodField()
    
    class Meta:
        model = Component
        fields = ('id', 'name', 'parent', 'component_type', 'contained_in', 'supplier', 'source', 'comment', 'homepage', 'checksum', 'external_ids', 'version', 'deleted', 'modified', 'tags' )

    def get_fields(self):
        #pop contained_in field if user doesn't have permission
        fields = super().get_fields()
        coordinator = self.context.get("coordinator")
        if coordinator:
            return fields
        fields.pop('tags')
        groups = self.context.get('groups')
        if self.instance and self.instance.product_info:
            if self.instance.product_info.supplier:
                if self.instance.product_info.supplier.id in groups:
                    return fields
        fields.pop('contained_in')
        return fields

    def get_tags(self, obj):
        return list(obj.tags.values_list('tag', flat=True))
    
class BasicComponentSerializer(serializers.ModelSerializer):

    owner = GroupLogoSerializer(source='product_info.supplier')

    class Meta:
        model = Component
        fields = ('id', 'name', 'version', 'owner', )

class ComponentDetailSerializer(serializers.ModelSerializer):
    #WRITE ONLY SERIALIZER
    #products are the products that this component is a dependency of
    contained_in = ParentProductSerializer(source='componentrelationship_set', many=True, required=False)
    dependencies = serializers.SerializerMethodField()
    owner = serializers.SerializerMethodField()
    #sbom_id = serializers.CharField(source='product_info__sbom_id')

    class Meta:
        model = Component
        fields = ('id', 'name', 'owner', 'component_type', 'version', 'supplier', 'source', 'homepage', 'checksum', 'external_ids', 'comment', 'contained_in', 'dependencies', 'deleted',  )
        extra_kwargs = {"component_type": {"required": False, "allow_null": True}}


    def get_dependencies(self, obj):

        p = Product.objects.filter(component=obj).first()
        if p:
            data = DependencySerializer(p.dependencies, many=True)
            return data.data
        #return list(p.dependencies.values_list('name', 'version', flat=True))
        return []

    def get_owner(self, obj):
        p = Product.objects.filter(component__id=obj.id).exclude(supplier__isnull=True).first()
        if p:
            g  = GroupSerializer(p.supplier)
            return g.data
        return ""

class ComponentVersionSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='component.id')
    version = serializers.CharField(source='component.version')

    class Meta:
        model = Product
        fields = ('id', 'version', 'sbom_id', )
        depth = 1

class ProductSerializer(serializers.ModelSerializer):

    component = serializers.SerializerMethodField()
    dependencies = serializers.SerializerMethodField()
    #dependencies = ComponentRelationshipSerializer(source='componentrelationship_set', many=True)
    versions = serializers.SerializerMethodField()
    owner = GroupSerializer(source='supplier')
    permissions = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = ('component', 'dependencies', 'versions', 'owner', 'sbom_id', "permissions")

    def get_component(self, obj):
        #do this so we can pop off contained in field if user should not have access to it
        s = ComponentSerializer(obj.component, context=self.context)
        return s.data

    def get_permissions(self, obj):
        coordinator = self.context.get("coordinator")
        if coordinator:
            return "rw"
        groups = self.context.get('groups')
        if obj.supplier and groups:
            if obj.supplier.id in groups:
                return "rw"
            else:
                return "r"
        return "r"
        
    def get_dependencies(self, obj):
        return obj.componentrelationship_set.count()
        
    def get_versions(self, obj):
        #only return other versions if this is the root component
        if obj.component.parent:
            if obj.supplier:
                other_versions = Product.objects.filter(component__name=obj.component.name, supplier=obj.supplier, component__deleted=False).exclude(component__parent=True)
            else:
                other_versions = Product.objects.filter(component__name=obj.component.name, component__deleted=False).exclude(supplier__isnull=False).exclude(component__parent=True)
            cv = ComponentVersionSerializer(other_versions, many=True)

            return cv.data
        else:
            return []


class StatusRevisionSerializer(serializers.ModelSerializer):
    default_status = ChoiceField(CVE_STATUS_CHOICES)
    statement = serializers.CharField(required=False, allow_blank=True)
    user = serializers.SerializerMethodField()
    diff = serializers.SerializerMethodField()

    class Meta:
        model = StatusRevision
        fields = ('default_status', 'version_status', 'statement', 'revision_number', 'user', 'created', 'modified', 'diff', 'approved',)

    def get_user(self, obj):
        if obj.user:
            return obj.user.screen_name
        else:
            return "Unknown"


    def get_diff(self, obj):
        all_diffs = {}
        other_revision = obj.previous_revision
        if other_revision:
            baseStatusText = other_revision.version_status if other_revision.version_status is not None else ""
            baseText =  other_revision.statement if other_revision.statement is not None else ""
        else:
            baseStatusText = ""
            baseText = ""
        newStatusText = obj.version_status if obj.version_status is not None else ""
        newText = obj.statement if obj.statement is not None else ""
        differ = difflib.Differ(charjunk=difflib.IS_CHARACTER_JUNK)
        d = differ.compare(
            baseText.splitlines(keepends=True), newText.splitlines(keepends=True)
        )

        if len(list(d)) > 0:
            all_diffs['stmt_diff'] = list(d)

        changes = []        
        if not baseStatusText and newStatusText:
            #this would be the first one
            for stat in obj.version_status:
                for key, val in stat.items():
                    if (val):
                        changes.append(f"+ {key}: {val}")
        else:
            statusdiff = diff(baseStatusText, newStatusText, marshal=True)
            for key, val in statusdiff.items():
                if type(key) == int:
                    for k, v in val.items():
                        changes.append(f"+ {k}: {v}")
                        if other_revision.version_status[key].get(k):
                            changes.append(f"- {k}: {other_revision.version_status[key][k]}")
                elif key == "$insert":
                    for stat in val:
                        changes.append(f"+ {stat[1]}")
        if changes:
            all_diffs['status_diff'] = changes

        if other_revision:
            if (other_revision.default_status != obj.default_status):
                all_diffs['default_status'] = f"Default status changed from {other_revision.get_default_status_display()} to {obj.get_default_status_display()}"

        return all_diffs

class StatusChoiceField(serializers.ChoiceField):

    def to_representation(self, obj):
        if obj == '' and self.allow_blank:
            return obj
        return self._choices[obj]

    def to_internal_value(self, data):
        # To support inserts with the value
        if data == '' and self.allow_blank:
            return ''
        #this is annoying, but since the Base field-level validation is
        #applied before any additional serializer-level methods are called, this is the way it has to be done
        if data == "unaffected":
            data = "Not Affected"
        elif data == "affected":
            data = "Affected"
        elif data == "unknown":
            data = "Unknown"

        for key, val in self._choices.items():
            if val == data:
                return key
        self.fail('invalid_choice', input=data)


class CVEStatusChoiceField(serializers.ChoiceField):

    def to_representation(self, obj):
        print(f"IN TO_REPR {object}")
        if obj == '' and self.allow_blank:
            return obj
        return self._choices[obj]

    def to_internal_value(self, data):
        # To support inserts with the value
        if data == '' and self.allow_blank:
            return ''
        #this is annoying, but since the Base field-level validation is
        #applied before any additional serializer-level methods are called, this is the way it has to be done
        if data == "unaffected":
            data = "Unaffected"
        elif data == "affected":
            data = "Affected"
        elif data == "unknown":
            data = "Unknown"
        print(f"IN TO INTERNAL VALUE")
        for key, val in self._choices.items():
            print(f"{key}, {val}")
            if val == data:
                return key
        self.fail('invalid_choice', input=data)


class StatusApprovalSerializer(serializers.Serializer):
    approved = serializers.BooleanField()


class VersionStatusSerializer(serializers.Serializer):

    status = StatusChoiceField(VUL_STATUS_CHOICES)
    version_value = serializers.CharField()
    version_end_range = serializers.CharField(required=False, allow_blank=True)
    version_type = serializers.CharField(required=False, allow_blank=True)
    version_range = ChoiceField(VERSION_RANGE_CHOICES, allow_blank=True, required=False)
    justification = ChoiceField(choices=JUSTIFICATION_CHOICES, allow_blank=True, required=False)    
    remediation_category = ChoiceField(choices=REMEDIATION_CATEGORY_CHOICES, allow_blank=True, required=False)
    remediation_detail = serializers.CharField(required=False, allow_blank=True)
    remediation_url = serializers.CharField(required=False, allow_blank=True)
    remediation_date = serializers.CharField(required=False, allow_blank=True)

class WriteComponentSerializer(serializers.ModelSerializer):

    owner = serializers.CharField(source='product_info.supplier.uuid', required=False, allow_blank=True)
    id = serializers.IntegerField(required=False)
    
    class Meta:
        model = Component
        fields = ('id', 'name', 'version', 'owner', 'supplier')
        extra_kwargs = {"name": {"required": False, "allow_null": True}}

    def validate(self, data):
        if data.get('id'):
            #legit componenet?
            if not Component.objects.filter(id=data['id']).exists():
                raise serializers.ValidationError("Invalid Component")
        elif data.get('owner'):
            #valid owner?
            if not Group.objects.filter(groupprofile__uuid = data['owner']).exists():
                raise serializers.ValidationError("Invalid Group")
        elif not data.get('name'):
            raise serializers.ValidationError("id or name is required")
        return data
        
    
    
class StatusSerializer(serializers.ModelSerializer):
    default_status = CVEStatusChoiceField(required=False, choices=CVE_STATUS_CHOICES, allow_blank=True)
    statement = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    status = serializers.ListField(
        child=VersionStatusSerializer(),
        source='version_status')
    share = serializers.BooleanField(default=False, required=False)
    component = WriteComponentSerializer()
    relationship = serializers.CharField(source='component_status.relationship', allow_blank=True, allow_null=True, required=False)
    vuls = serializers.ListField(
        child=serializers.IntegerField(),
        source='component_status.vul.id'
    )
    other_component = WriteComponentSerializer(required=False)
    other_component_version = serializers.CharField(source='component_status.other_component_version', allow_blank=True, allow_null=True, required=False)
    
    class Meta:
        model = StatusRevision
        fields = ('status', 'default_status', 'share', 'statement', 'component', 'vuls', 'other_component', 'relationship', 'other_component_version')

    def validate_vuls(self, value):
        if not value:
            raise serializers.ValidationError("vuls is required field.")
        for v in value:
            vul = Vulnerability.objects.filter(id=v).first()
            if not vul:
                raise serializers.ValidationError(f"{v} is not a valid vulnerability ID")
        return value
        
        
class VulStatusSerializer(serializers.ModelSerializer):

    default_status = ChoiceField(source='current_revision.default_status', choices=CVE_STATUS_CHOICES)
    statement = serializers.CharField(source='current_revision.statement', allow_blank=True, required=False)
    vul = BasicVulSerializer()
    revisions = serializers.SerializerMethodField()
    status = serializers.JSONField(source='current_revision.version_status')
    revision_number = serializers.CharField(source='current_revision.revision_number')
    user = serializers.SerializerMethodField()
    created = serializers.DateTimeField(source='current_revision.created')
    modified = serializers.DateTimeField(source='current_revision.modified')
    approved = serializers.BooleanField(source='current_revision.approved')

    class Meta:
        model = ComponentStatus
        fields = ('id', 'default_status', 'status', 'user', 'statement', 'vul', 'revisions', 'revision_number', 'created', 'modified', 'share', 'approved')

    def get_revisions(self, obj):
        return obj.statusrevision_set.count() - 1

    def get_user(self, obj):
        if self.context.get('user'):
            if is_coordinator(self.context['user']) or obj.current_revision.user == self.context['user']:
                bs = BasicUserSerializer(obj.current_revision.user)
                return bs.data
        return {}

#    def validate_version_type(self, value):
#        version_type = value.lower()
#        if value and value not in ['custom', 'git', 'maven', 'python', 'rpm', 'semvar']:
#            raise serializers.ValidationError("Invalid version type")
#        return version_type



class StatusSummarySerializer(serializers.ModelSerializer):
    component = BasicComponentSerializer()
    vuls = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()
    other_component = BasicComponentSerializer()

    class Meta:
        model = ComponentStatus
        fields = ('component', 'vuls', 'summary', 'other_component', 'relationship', 'other_component_version')

    def get_summary(self, obj):
        #this gets me the number of VEXs in each status category
        summary = {}
        sum_list = []
        s = ComponentStatus.objects.filter(vul__case=obj.vul.case, component__name=obj.component.name, component__product_info__supplier=obj.component.product_info.supplier).distinct('vul__id').order_by('vul__id')
        for d in s:
            for x in  d.current_revision.version_status:
                if x["status"] in summary:
                    summary[x["status"]] = summary[x["status"]] + 1
                else:
                    summary[x["status"]] = 1

        for key, val in summary.items():
            sum_list.append({'status': key, 'count': val})
        #annotate(status=F('current_revision__status')).values("status").annotate(count=Count("id")).order_by("status")
        #for d in s:
        #    summary.append({'status':status_dict[int(d['status'])], 'count': d['count']})
        #return summary
        return sum_list

    def get_vuls(self, obj):
        vuls = ComponentStatus.objects.filter(vul__case=obj.vul.case, component__name=obj.component.name, component__product_info__supplier=obj.component.product_info.supplier).distinct('vul__id').order_by('vul__id')
        serializer = VulStatusSerializer(vuls, many=True, context=self.context)
        return serializer.data


class ComponentStatusSerializer(serializers.ModelSerializer):

    status = serializers.JSONField(source='current_revision.version_status')
    statement = serializers.CharField(source='current_revision.statement', allow_blank=True, required=False)
    component = BasicComponentSerializer()
    other_component = BasicComponentSerializer()
    vul = BasicVulSerializer()
    revisions = serializers.SerializerMethodField()
    revision_number = serializers.CharField(source='current_revision.revision_number')
    user = serializers.SerializerMethodField()
    created = serializers.DateTimeField(source='current_revision.created')
    modified = serializers.DateTimeField(source='current_revision.modified')
    default_status = ChoiceField(source='current_revision.default_status', choices=CVE_STATUS_CHOICES)
    
    class Meta:
        model = ComponentStatus
        fields = ('status', 'user', 'statement', 'component', 'other_coponent', 'relationship', 'other_component_version', 'vul', 'revisions', 'revision_number', 'created', 'modified', 'default_status' )


    def get_revisions(self, obj):
        return obj.statusrevision_set.count() - 1

    def get_user(self, obj):
        if self.context.get('user'):
            if is_coordinator(self.context['user']) or obj.current_revision.user == self.context['user']:
                bs = BasicUserSerializer(obj.current_revision.user)
                return bs.data
        return {}


class StatusActionSerializer(serializers.ModelSerializer):
    user = UserSerializer(source='component_status.current_revision.user')
    url = serializers.SerializerMethodField()
    change = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()

    class Meta:
        model = StatusRevision
        fields = ['user', 'title', 'created', 'url', 'change',]

    def get_url(self, obj):
        return reverse("cvdp:case", args=[obj.component_status.vul.case.case_id])

    def get_change(self, obj):
        return []

    def get_title(self, obj):
        if (obj.revision_number > 0):
            return f"modified status to for vul {obj.component_status.vul} and component {obj.component_status.component.name}"
        else:
            return f"added status for vul {obj.component_status.vul} and component {obj.component_status.component.name}"



class ComponentChangeSerializer(serializers.ModelSerializer):

    class Meta:
        model = ComponentChange
        fields = ['field', 'old_value', 'new_value']


class ComponentActionSerializer(serializers.ModelSerializer):
    user = UserSerializer()
    #url = serializers.SerializerMethodField()
    change = serializers.SerializerMethodField()

    class Meta:
        model = ComponentAction
        fields = ['user', 'title', 'created','change',]

    def get_change(self, obj):
        changes = obj.componentchange_set.all()
        data = ComponentChangeSerializer(changes, many=True)
        return data.data
