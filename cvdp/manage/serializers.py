from cvdp.manage.models import *
from cvdp.models import UserAssignmentWeight, AssignmentRole, CVEServicesAccount, CaseReport, EmailTemplate, CaseResolutionOptions, Contact, CVEReservation, TriageCalendarEvent, BounceEmailNotification, GroupProfile, ContactAssociation
from rest_framework import serializers
from django.contrib.auth.models import Group
from django.urls import reverse
from authapp.models import User
from cvdp.serializers import ChoiceField, UserSerializer
from cvdp.groups.serializers import GroupSerializer
from django.conf import settings


class ManageEmailBounceSerializer(serializers.ModelSerializer):

    user = UserSerializer()
    bounce_type = ChoiceField(BounceEmailNotification.BOUNCE_CHOICES)
    groups = serializers.SerializerMethodField()

    class Meta:
        model = BounceEmailNotification
        fields = ('id', 'email', 'from_email', 'user', 'bounce_date', 'bounce_type', 'subject', 'groups', 'action')
        read_only_fields = ['email', 'from_email', 'user', 'bounce_date', 'bounce_type', 'subject']

    def get_groups(self, obj):
        if obj.user:
            serializer =  GroupSerializer(obj.user.groups, many=True)
            return serializer.data
        else:
            c = Contact.objects.filter(email=obj.email)
            if c:
                association = ContactAssociation.objects.filter(contact__in=c).values_list('group__id', flat=True)
                if association:
                    groups = Group.objects.filter(id__in=association)
                    serializer = GroupSerializer(groups, many=True)
                    return serializer.data
        
            g = GroupProfile.objects.filter(support_emails__contains=obj.email).values_list('group__id', flat=True)
            if g:
                groups = Group.objects.filter(id__in=g)
                serializer = GroupSerializer(groups, many=True)
                return serializer.data
        return []


class QuestionSerializer(serializers.ModelSerializer):

    question_type = ChoiceField(choices=FIELD_NAMES)
    
    class Meta:
        model = FormQuestion
        fields = ('id', 'question', 'question_type', 'question_choices', 'required', 'private', )

        
class EmailTemplateSerializer(serializers.ModelSerializer):

    class Meta:
        model = EmailTemplate
        fields = ('id', 'template_name', 'template_type', 'subject', 'plain_text', )
        
class ReportingFormSerializer(serializers.ModelSerializer):

    class Meta:
        model = ReportingForm
        fields = ("id", "title", "description", 'intro', 'send_ack_email', 'email_from', 'email_subject', 'email_answers', 'email_message', 'login_required', )


class ResolutionSerializer(serializers.ModelSerializer):

    email = EmailTemplateSerializer(read_only=True, source='email_template')
    email_template = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = CaseResolutionOptions
        fields = ('description', 'id', 'email_template', 'email')

    def validate_email_template(self, value):
        if value:
            cr = EmailTemplate.objects.filter(id=value).first()
            if cr:
                return cr
            else:
                raise serializers.ValidationError("Invalid Role")
        return value
        
        
        
class AssignmentWeightSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='user.screen_name', read_only=True)
    userid = serializers.SerializerMethodField()
    probability = serializers.SerializerMethodField()
    user = serializers.CharField(write_only=True)
    weight = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = UserAssignmentWeight
        fields = ('userid', 'name', 'weight', 'probability', 'user', 'weight')

    def get_probability(self, obj):
        return obj.probability

    def get_userid(self, obj):
        if obj.user:
            c = Contact.objects.filter(user=obj.user).first()
            return str(c.uuid)
        return ""
    

        
class AutoAssignmentSerializer(serializers.ModelSerializer):
    group = GroupSerializer(read_only=True)
    users = AssignmentWeightSerializer(many=True, required=False)
    
    class Meta:
        model = AssignmentRole
        fields = ('id', 'role', 'group', 'users', )

    def create(self, validated_data):
        if validated_data.get('users'):
            user_data = validated_data.pop('users')
        role = AssignmentRole.objects.create(**validated_data)
        return role


class CVEAccountSerializer(serializers.ModelSerializer):
    server_type = ChoiceField(choices=CVEServicesAccount.SERVER_TYPES)
    server = serializers.SerializerMethodField()
    api_key = serializers.CharField();
    
    class Meta:
        model = CVEServicesAccount
        fields = ('id', 'org_name', 'email', 'active', 'server_type', 'server', 'group', 'api_key')

    def get_server(self, obj):
        for i in settings.CVE_SERVICES_API_URLS:
            if obj.server_type == i[0]:
                return i[1]
        return "Not Found"

class CVEReservationSerializer(serializers.ModelSerializer):
    user_reserved = UserSerializer(read_only=True)
    account = serializers.CharField(source='account__org_name', read_only=True)
    account_id = serializers.IntegerField()
    case = serializers.SerializerMethodField()
    
    class Meta:
        model = CVEReservation
        #account id is for write
        fields = ('cve_id', 'time_reserved', 'account', 'user_reserved', 'account_id', 'case')
        read_only_fields = ('time_reserved', 'user_reserved', 'account')

    def get_case(self, obj):
        try:
            if obj.vul:
                return {'case_id': obj.vul.case.caseid, 'url': obj.vul.case.get_absolute_url()}
        except:
            return ""
        
        
class ConnectionSerializer(serializers.ModelSerializer):

    incoming_api_key = serializers.SerializerMethodField()
    created_by = UserSerializer()
    group = GroupSerializer()
    
    class Meta:
        model = AdVISEConnection
        fields = ("id", "group", "url", "external_key", "incoming_api_key", "created", "created_by", "last_used", "disabled")
        read_only_fields = ("id", "created", "created_by", "last_used")

        
    def get_incoming_api_key(self, obj):
        if obj.incoming_key:
            return obj.incoming_key.last_four
        else:
            return ""

        
class TagSerializer(serializers.ModelSerializer):

    user = UserSerializer(required=False)
    category = ChoiceField(choices = DefinedTag.TAG_CATEGORY)
    
    class Meta:
        model = DefinedTag
        fields = ('id', 'tag', 'description', 'user', 'created', 'category')
        read_only_fields = ('id', 'user', 'created')

    def validate_tag(self, value):

        if ' ' in value:
            raise serializers.ValidationError("Tag may not contain a space")
        return value
            

class VulAttributesSerializer(serializers.ModelSerializer):

    user = UserSerializer(required=False)

    class Meta:
        model = VulAttributeKey
        fields = ('id', 'attribute', 'description', 'user', 'created')
        read_only_fields = ('id', 'user', 'created')
        

class TagCategorySerializer(serializers.Serializer):

    category = serializers.SerializerMethodField()


    def get_category(self, obj):
        data = {}
        for key, val in DefinedTag.TAG_CATEGORY:
            # get all tags in category
            tags = DefinedTag.objects.filter(category=key)
            tag_serializer = TagSerializer(tags, many=True)
            data[val] = tag_serializer.data
        return data
    
            
class CSAFProfileSerializer(serializers.ModelSerializer):

    created_by = UserSerializer(read_only=True)
    group = GroupSerializer(read_only=True)

    class Meta:
        model = CSAFProfile
        fields = ('id', 'created_by', 'created', 'group',  'name', 'publisher_settings', 'lang', 'notes', 'references', 'distribution_tlp', 'document_id')
        read_only_fields = ('id', 'created_by', 'group', 'created')

class TriageCalendarEventSerializer(serializers.ModelSerializer):
    assign_user = serializers.CharField(write_only=True)
    user = serializers.CharField(source='user.screen_name', read_only=True)
    coord_team = serializers.CharField(source='coord_team.name', read_only=True)
    color = serializers.SerializerMethodField()
    end = serializers.DateField(source='end_date', required=False)
    
    class Meta:
        model = TriageCalendarEvent
        fields = ('id', 'title', 'date', 'end', 'event_id', 'coord_team', 'user', 'assign_user', 'color')
        read_only_fields = ('id', 'user', 'coord_team')

    def get_color(self, obj):
        if obj.event_id == 1:
            return "#005288";
        else:
            return "#C41230";
        

class TriageCalendarSerializer(serializers.Serializer):
    users = serializers.ListField(
        child=UserSerializer())
    group = GroupSerializer()

