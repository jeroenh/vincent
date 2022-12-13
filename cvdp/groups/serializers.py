from cvdp.models import GroupProfile, ContactAssociation, Contact, ContactAction, ContactChange, Case, CaseParticipant, GlobalSettings, GroupTag
from rest_framework import serializers
from django.contrib.auth.models import Group
from authapp.models import APIToken
from django.urls import reverse
from authapp.models import User
from cvdp.lib import find_user_groups, get_new_stats
from cvdp.serializers import UserSerializer, ChoiceField
from django.core.exceptions import ObjectDoesNotExist
import traceback

class GenericContactSerializer(serializers.Serializer):
    type = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    user_name = serializers.SerializerMethodField()
    uuid = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    logocolor = serializers.SerializerMethodField()
    
    def get_name(self, obj):
        try:
            if obj.name:
                return obj.name
            elif obj.user:
                if obj.user.screen_name:
                    return obj.user.screen_name
                else:
                    return obj.user.email
        except:
            pass
        try:
            return obj.group.name
        except:
            return ""
    
    def get_user_name(self, obj):
        try:
            if obj.user:
                return obj.user.screen_name
        except:
            pass
        return ""

    def get_uuid(self, obj):
        try:
            if obj.uuid:
                return obj.uuid
        except:
            pass
        try:
            if obj.groupprofile:
                return obj.groupprofile.uuid
        except:
            pass
        return ""

    def get_photo(self, obj):
        try:
            if obj.logo:
                return obj.get_logo()
        except:
            pass
        try:
            if obj.user:
                return obj.get_photo()
        except:
            pass
        return ""

    def get_logocolor(self, obj):
        try:
            if obj.icon_color:
                return obj.icon_color
        except:
            pass
        try:
            if obj.user:
                return obj.get_color()
        except:
            pass
        return ""
    
    def get_type(self, obj):
        try:
            if obj.user:
                return "Contact/User"
            elif obj.name:
                return "Contact"
        except:
            pass
        return "Group"

    def get_tags(self, obj):
        try:
            if obj.vendor_type:
                tags = list(GroupTag.objects.filter(group = obj.group.id).values_list('tag', flat=True))
                return tags
        except:
            pass
        try:
            if obj.groupprofile:
                tags = list(GroupTag.objects.filter(group = obj.id).values_list('tag', flat=True))
                return tags
        except:
            return []
        
    def get_url(self, obj):
        return obj.get_absolute_url()
    

    def get_fields(self):
        fields = super().get_fields()
        try:
            if self.context.get('user'):
                return fields
            else:
                fields.pop('tags')
                return fields
        except:
            fields.pop('tags')
            return fields

class GroupLogoSerializer(serializers.ModelSerializer):
    photo = serializers.SerializerMethodField()
    logocolor = serializers.SerializerMethodField()
    name = serializers.CharField()
    uuid = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ('name', 'photo', 'logocolor', 'uuid')

    def get_fields(self):
        fields = super().get_fields()
        user = self.context.get('user')
        if not user:
            fields.pop('uuid')
        return fields
        
    def get_photo(self, obj):
        if obj.groupprofile:
            return obj.groupprofile.get_logo()
        return ""

    def get_logocolor(self, obj):
        if obj.groupprofile:
            return obj.groupprofile.icon_color
        return ""

    def get_uuid(self, obj):
        if obj.groupprofile:
            return str(obj.groupprofile.uuid)
        return ""
        
class GroupSerializer(serializers.ModelSerializer):
    type = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()
    logocolor = serializers.SerializerMethodField()
    uuid = serializers.SerializerMethodField()
    support_emails = serializers.ListField(child=serializers.CharField(), source='groupprofile.support_emails', allow_empty=True, default=[], required=False)
    support_phone = serializers.CharField(source='groupprofile.support_phone', allow_blank=True, required=False)
    website = serializers.CharField(source='groupprofile.website',  allow_blank=True, required=False)
    mailing_address = serializers.CharField(source='groupprofile.mailing_address', allow_blank=True, required=False)
    permissions = serializers.BooleanField(source='groupprofile.permissions', required=False)
    
    class Meta:
        model=Group
        fields = ('name', 'type', 'url', 'photo', 'logocolor', 'uuid',  'support_emails', 'support_phone', 'website', 'mailing_address', 'permissions',)

    def get_url(self, obj):
        return obj.groupprofile.get_absolute_url()

    #not currently using type
    def get_type(self, obj):
        return "Group"

    def get_photo(self, obj):
        if obj.groupprofile:
            return obj.groupprofile.get_logo()
        return ""

    def get_logocolor(self, obj):
        if obj.groupprofile:
            return obj.groupprofile.icon_color
        return ""

    def get_uuid(self, obj):
        if obj.groupprofile:
            return str(obj.groupprofile.uuid)
        return ""

    def update(self, group, validated_data):
        data = validated_data.get('groupprofile')
        if (data):
            group.groupprofile.support_emails = data.get('support_emails')
            group.groupprofile.support_phone = data.get('support_phone')
            group.groupprofile.website = data.get('website')
            group.groupprofile.mailing_address = data.get('mailing_address')
            group.groupprofile.save()
        return group


    
class CoordGroupSerializer(GroupSerializer):

    lead = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = GroupSerializer.Meta.fields + ('lead', 'tags')


    def get_tags(self, obj):
        return list(obj.tags.values_list('tag', flat=True))


    def get_lead(self, obj):

        if GlobalSettings.objects.filter(group = obj.id).exists():
            return True
        return False

        
class SimpleCaseParticipantSerializer(serializers.ModelSerializer):


    status = ChoiceField(Case.STATUS_CHOICES)

    class Meta:
        model = Case
        fields = ('case_id', 'case_identifier', 'title', 'status',)
        lookup_field = "case_id"

class GroupCaseAccessPermSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source='case.title')
    case_identifier = serializers.CharField(source='case.get_caseid')
    status = ChoiceField(Case.STATUS_CHOICES, source='case.status')
    case_id = serializers.CharField(source='case.case_id')
    permissions = serializers.JSONField()
        
    class Meta:
        model = CaseParticipant
        fields = ['permissions', 'title', 'status', 'case_id', 'case_identifier', ]

class PermissionSerializer(serializers.Serializer):
    case = serializers.CharField()
    perms = serializers.ChoiceField(choices=["r", "rw"])
        
class CaseAccessSerializer(serializers.Serializer):
    user = serializers.CharField()
    perms = serializers.ListField(
        child=PermissionSerializer()
    )

class GroupAPIAccountSerializer(serializers.ModelSerializer):

    class Meta:
        model=APIToken
        fields = ('last_four', 'created', 'last_used', )
    
    
class GroupProfileSerializer(serializers.ModelSerializer):
    group = CoordGroupSerializer(required=False)
    
    class Meta:
        model=GroupProfile
        lookup_field = ['uuid']
        fields=['group', 'active',]

        
    def create(self, validated_data):
        g = Group(name=validated_data.pop('name'))
        g.save()
        profile, created = GroupProfile.objects.update_or_create(group=g,
                                                                 active=True)
        return profile

  
class AssociationSerializer(serializers.ModelSerializer):

    group = serializers.CharField(source='group.name', required=False)

    url = serializers.SerializerMethodField()

    class Meta:
        model = ContactAssociation
        fields = ['group', 'verified', 'url', 'group_admin']

    def get_url(self, obj):
        try:
            if obj.group:
                return reverse("cvdp:group", args=[obj.group.groupprofile.uuid])
        except:
            pass
        return ""

class ContactSerializer(serializers.ModelSerializer):
    type = serializers.SerializerMethodField()
    user_name = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    user = UserSerializer(required=False)
    associations = AssociationSerializer(many=True, read_only=True)    #serializers.SerializerMethodField()
    
    class Meta:
        model = Contact
        fields = ['email', 'phone', 'name', 'type', 'user_name', 'url', 'uuid', 'user', 'associations']
        read_only_fields = ('type', 'url', 'user', 'user_name', 'uuid', )

    def get_associations(self, obj):
        assoc = ContactAssociation.objects.filter(contact = self.obj)
        
        
    def get_user_name(self, obj):
        if obj.user:
            if obj.user.screen_name:
                return obj.user.screen_name
            else:
                return obj.user.get_full_name()
        else:
            return ""

    def get_url(self, obj):
        return reverse("cvdp:contact", args=[obj.uuid])

    def get_type(self, obj):
        if obj.user:
            return "Contact/User"
        return "Contact"

#used for users to request access to particular groups
class ContactAssociationRequestSerializer(serializers.Serializer):
    group = serializers.UUIDField(required = True)

    
class ContactAssociationSerializer(serializers.ModelSerializer):

    group = serializers.CharField(source='group.name', required=False)
    has_admin = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    
    contact = ContactSerializer(required=False)

    class Meta:
        model = ContactAssociation
        fields = ['id', 'group', 'contact', 'verified', 'url', 'group_admin', 'has_admin', 'created']
        read_only_fields = ('id', 'url', 'group', 'contact',)
        
    def get_url(self, obj):
        return reverse("cvdp:contact", args=[obj.contact.uuid])

    def get_has_admin(self, obj):
        if ContactAssociation.objects.filter(group=obj.group, group_admin=True).exists():
            return True
        return False
    
class ContactChangeSerializer(serializers.ModelSerializer):

    class Meta:
        model = ContactChange
        fields = ['field', 'old_value', 'new_value']



class ContactActionSerializer(serializers.ModelSerializer):
    user = UserSerializer()
    url = serializers.SerializerMethodField()
    change = serializers.SerializerMethodField()

    class Meta:
        model = ContactAction
        fields = ['user', 'title', 'created', 'url', 'change',]

    def get_url(self, obj):
        if obj.group:
            return reverse("cvdp:group", args=[obj.group.groupprofile.uuid])
        elif obj.contact:
            return reverse("cvdp:contact", args=[obj.contact.uuid])
        else:
            return ""
    
    def get_change(self, obj):
        changes = obj.contactchange_set.all()
        data = ContactChangeSerializer(changes, many=True)
        return data.data


    
class UserWelcomeMessage(serializers.ModelSerializer):
    suggestions = serializers.SerializerMethodField()
    pending = serializers.SerializerMethodField()
    new_posts = serializers.SerializerMethodField()
    new_cases = serializers.SerializerMethodField()
    unseen_cases = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ('suggestions', 'pending', 'new_posts', 'new_cases', 'unseen_cases')

        
    def get_suggestions(self, obj):
        if obj.groups.count() == 0:
            sugg = find_user_groups(obj.email)
            if sugg:
                x = GroupLogoSerializer(sugg, many=True, context={'user': True})
                return x.data
                
        return []

    def get_pending(self, obj):
        pending = ContactAssociation.objects.filter(contact__email=obj.email, verified=False).values_list('group__id', flat=True)
        if pending:
            groups = Group.objects.filter(id__in=pending)
            x = GroupLogoSerializer(groups, many=True)
            return x.data

        return []

    def get_new_posts(self, obj):
        stats = self.context.get('stats')
        if stats:
            return stats.get('new_posts', 0)
        return 0

    def get_new_cases(self, obj):
        stats = self.context.get('stats')
        if stats:
            return stats.get('new_cases', [])
        return []

    def get_unseen_cases(self, obj):
        stats = self.context.get('stats')
        if stats:
            return stats.get('unseen_cases', [])
        return []
        

        
class UserGroupSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='screen_name')
    logocolor = serializers.CharField(source='userprofile.logocolor')
    photo = serializers.ImageField(source='userprofile.photo')
    groups = serializers.ListSerializer(child=serializers.CharField(source='name'))
    roles = serializers.SerializerMethodField()
    contact = serializers.SerializerMethodField()
    uuid = serializers.SerializerMethodField()
    groupadmin = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ('name', 'org', 'photo', 'logocolor', 'contact', 'groups', 'roles', 'uuid', 'groupadmin')

    def get_uuid(self, obj):
        try:
            return str(obj.contact.uuid)
        except ObjectDoesNotExist:
            return None
        
    def get_contact(self, obj):
        try:
            return str(obj.contact.uuid)
        except ObjectDoesNotExist:
            return None

    def	get_roles(self, obj):
        roles =	[]
        user = obj
        if user:
            if user.groups.filter(name__in=['coordinator', 'coordinator_mgr']).exists():
                roles.append("coordinator")
            if user.groups.filter(name__in=['analyst', 'analyst_mgr']).exists():
                roles.append("analyst")
            if user.groups.filter(name='user_admin').exists():
                roles.append("user_admin")
            if user.is_staff:
                roles.append("staff")
            if user.is_superuser:
                roles.append("admin")
        return roles

    def get_groupadmin(self, obj):
        #is this user a groupadmin
        return ContactAssociation.objects.filter(contact__user=obj, group_admin=True).exists()



class UserGroupWelcomeSerializer(UserGroupSerializer):

    welcome = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = UserGroupSerializer.Meta.fields + ('welcome', )

    
    def get_welcome(self, obj):
        last_login = self.context.get('last_login', None)
        stats = get_new_stats(obj, last_login)
        slzr = UserWelcomeMessage(obj, context={'stats': stats})
        return slzr.data
    

    """
    def get_groups(self, obj):
        #user = self.context.get('user')
        serializer = serializers.ListSerializer(obj.groups.exclude(groupprofile__isnull=True), many=True)
        return serializer.data
    """

