from cvdp.models import *
from cvdp.components.models import ComponentStatus, Product, VUL_STATUS_CHOICES, CVE_STATUS_CHOICES, StatusRevision
from django.core.exceptions import ObjectDoesNotExist
from cvdp.permissions import my_case_role, is_my_case, my_case_vendors, is_case_owner, my_components, get_post_participant, is_coordinator, can_approve_case, get_coord_team, get_case_users_in_group, get_visible_case_coordinators
from django.contrib.postgres.aggregates import StringAgg
from cvdp.serializers import ChoiceField, UserSerializer, DynamicFieldsModelSerializer, SystemSerializer
from django.db.models.functions import Concat
from cvdp.groups.serializers import GroupSerializer, GroupLogoSerializer
from rest_framework import serializers
from cvdp.manage.serializers import ResolutionSerializer
from django.utils import timezone
from django.contrib.auth.models import Group
from django.urls import reverse
import traceback
from urllib.parse import urlparse
from django.utils.safestring import mark_safe
from django.utils.timezone import make_aware
from django.db.models import Count, Q, CharField, Value
#from cvdp.md_utils import markdown as md
from cvdp.utils import get_verslike_range, post_serializer
from authapp.models import User
import difflib
import re
from datetime import datetime, timedelta, time
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class StatusSerializer(serializers.Serializer):
    id = serializers.CharField()
    name= serializers.CharField()



class CWESerializer(serializers.ModelSerializer):

    class Meta:
        model = CWEDescriptions
        fields = ('cwe', 'usage', 'children', 'description', 'slice_1003')


class CaseReportSerializer(serializers.Field):

    def to_representation(self, obj):
        user = self.context.get('user')
        if user and is_coordinator(user):
            return obj
        else:
            #remove private fields
            redacted_report = []
            for x in obj:
                if x.get('priv', False):
                    continue
                redacted_report.append(x)
            return redacted_report

    def to_internal_value(self, data):
        return data


class ReportSerializer(serializers.ModelSerializer):

    status = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    case_url = serializers.SerializerMethodField()
    case_id = serializers.SerializerMethodField()
    report = CaseReportSerializer()

    class Meta:
        model = CaseReport
        fields = ('title', 'case_url', "report", "status", "case_id")
        read_only_fields = ('title', 'case_url', 'status')

    def get_status(self, obj):
        cr = Case.objects.filter(report=obj).first()
        if cr:
            return cr.get_status_display()
        return "Pending"

    def get_case_url(self, obj):
        cr = Case.objects.filter(report=obj).first()
        user = self.context.get('user')
        if user and cr and  cr.status == Case.ACTIVE_STATUS and is_my_case(user, cr.id):
            return reverse("cvdp:case", args=[cr.case_id])
        else:
            return ""

    def get_case_id(self, obj):
        cr = Case.objects.filter(report=obj).first()
        if cr:
            return cr.caseid
        cr = CaseReportOriginal.objects.filter(report=obj).first()
        if cr:
            return cr.case.caseid
        return ""

    def get_title(self, obj):
        if obj.entry:
            if obj.entry.form:
                return obj.entry.form.title
            else:
                return obj.entry.title
        return ""


class ReportDetailSerializer(ReportSerializer):

    submitter = serializers.SerializerMethodField()
    transfer_reason = serializers.CharField(required=False)
    transfer = serializers.SerializerMethodField()

    class Meta:
        model = CaseReport
        fields = ReportSerializer.Meta.fields + ('source', 'submitter', 'received', 'transfer', 'transfer_reason', 'copy')
        read_only_fields = ('received', 'title', 'case_url', 'submitter', 'status', 'copy', "transfer")


    def get_transfer(self, obj):
        if obj.connection:
            return True
        return False

    def get_submitter(self, obj):
        if obj.entry:
            if obj.entry.created_by:
                return obj.entry.created_by.screen_name
        elif obj.connection:
            return obj.connection.group.name
        else:
            return "Anonymous"

class CoordReportSerializer(serializers.ModelSerializer):
    submitter = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    case_url = serializers.SerializerMethodField()
    transfer = serializers.SerializerMethodField()

    class Meta:
        model = CaseReport
        fields = ('received', 'title', 'case_url', 'source', 'submitter', "report", "status", "copy", "transfer", )

    def get_transfer(self, obj):
        if obj.connection:
            return True
        return False

    def get_submitter(self, obj):
        if obj.entry:
            if obj.entry.created_by:
                return obj.entry.created_by.screen_name
        elif obj.connection:
            return obj.connection.group.name
        else:
            return "Anonymous"

    def get_status(self, obj):
        cr = Case.objects.filter(report=obj).first()
        if cr:
            return cr.get_status_display()
        return "Pending"

    def get_case_url(self, obj):
        cr = Case.objects.filter(report=obj).first()
        user = self.context.get('user')

        if user and cr and  cr.status == Case.ACTIVE_STATUS and is_my_case(user, cr.id):
            return reverse("cvdp:case", args=[cr.case_id])
        else:
            return ""


    def get_title(self, obj):
        if obj.entry:
            if obj.entry.form:
                return obj.entry.form.title
        return ""

class CaseStatSerializer(serializers.ModelSerializer):
    vuls = serializers.SerializerMethodField()
    posts = serializers.SerializerMethodField()
    participants = serializers.SerializerMethodField()


    class Meta:
        model = Case
        fields = ('vuls', 'posts', 'participants')

    def get_vuls(self, obj):
        return obj.vulnerability_set.filter(deleted=False).count()

    def get_posts(self, obj):
        return Post.objects.filter(thread=obj.official_thread).count()

    def get_participants(self, obj):
        return obj.caseparticipant_set.filter(notified__isnull=False).count()


class CoordinatorCaseSummarySerializer(serializers.ModelSerializer):

    vuls = serializers.SerializerMethodField()
    posts = serializers.SerializerMethodField()
    participants = serializers.SerializerMethodField()
    tickets = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()


    class Meta:
        model = Case
        fields = ('vuls', 'posts', 'participants', 'tickets', 'notes')

    def get_vuls(self, obj):
        return obj.vulnerability_set.filter(deleted=False).count()

    def get_posts(self, obj):
        return Post.objects.filter(thread=obj.official_thread).count()

    def get_participants(self, obj):
        return obj.caseparticipant_set.all().count()

    def get_tickets(self, obj):
        return EmailThread.case(obj.case_id).count()

    def get_notes(self, obj):
        return obj.casenote_set.all().count()



class CaseCoordinatorSerializer(serializers.ModelSerializer):

    case_identifier = serializers.CharField(source='get_caseid', required=False)
    created_by = serializers.SerializerMethodField()
    report = CoordReportSerializer(required=False)
    status = ChoiceField(Case.STATUS_CHOICES, required=False)
    owners = serializers.SerializerMethodField()
    advisory_status = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    state_meta = serializers.SerializerMethodField()

    class Meta:
        model = Case
        fields = ('case_id', 'case_identifier', 'owners', 'created_by', 'created', 'modified', 'status', 'title', 'summary', 'report', 'public_date', 'due_date', 'advisory_status', 'resolution', 'tags', 'state', 'state_meta')
        lookup_field = "case_id"
        read_only_fields =("case_id", "case_identifier", "created_by", "created", "modified", "report", 'tags', )

    def get_created_by(self, obj):
        if obj.created_by:
            return obj.created_by.screen_name
        else:
            return "Anonymous"

    def get_tags(self, obj):
        return list(obj.tags.values_list('tag', flat=True))

    def get_owners(self, obj):
        owners = CaseParticipant.objects.filter(case=obj, role="owner") #.values_list('contact__user__id', flat=True)
        #users = User.objects.filter(id__in=owners)
        #serializer = UserSerializer(users, many=True)
        serializer = CaseOwnerSerializer(owners, many=True)
        return serializer.data

    def get_advisory_status(self, obj):
        advisory = CaseAdvisory.objects.filter(case=obj).first()
        if advisory:
            if advisory.date_published:
                return "PUBLISHED"
            elif AdvisoryRevision.objects.filter(advisory=advisory, date_shared__isnull=False).exists():
                if advisory.current_revision.date_shared:
                    return "LATEST DRAFT SHARED"
                else:
                    return "PREVIOUS DRAFT SHARED"
            else:
                return "DRAFT"
        else:
            return "NOT STARTED"

    def validate_status(self, value):
        """
        Check that this is a valid case status for the current state of the case
        """
        if self.instance:
            owners = CaseParticipant.objects.filter(case=self.instance, role="owner").exclude(contact__isnull=True)
            if not owners.count() and value == Case.ACTIVE_STATUS:
                raise serializers.ValidationError("Case must be assigned before changing status to Active.")
        return value

    def get_state_meta(self, obj):
        """
        This is extra/meta info about a particular state that could be helpful for the case coordinator.
        This is unfortunately super custom to the case milestones configured per VINCE-NT platform but such is life.
        """
        if CaseState.objects.filter(name=obj.state, code="cves_published").exists():
            vuls = Vulnerability.objects.filter(case=obj, publish=True, deleted=False)
            v_count = vuls.count()
            pub_count = vuls.exclude(date_published__isnull=True).count()
            return f"{pub_count} of {v_count} published"
        else:
            return ""


class PendingCaseSerializer(serializers.ModelSerializer):
    case_identifier = serializers.CharField(source='get_caseid')
    status = ChoiceField(Case.STATUS_CHOICES)

    class Meta:
        model = Case
        fields = ('case_id', 'case_identifier', 'created', 'modified', 'status',)
        lookup_field = "case_id"
        read_only_fields =("case_id", "case_identifier", "created", "modified",)

class CaseSummarySerializer(serializers.ModelSerializer):
    case_identifier = serializers.CharField(source='get_caseid')
    owner = serializers.SerializerMethodField()

    class Meta:
        model = Case
        lookup_field = "case_id"
        fields = ('case_id', 'case_identifier', 'title', 'created', 'modified', 'status', 'state', 'owner')

    def get_owner(self, obj):
        owners = CaseParticipant.objects.filter(case=obj, role="owner", group__isnull=False).values_list('group__id', flat=True)
        groups = Group.objects.filter(id__in=owners)
        serializer = GroupLogoSerializer(groups, many=True)
        return serializer.data
        #serializer = CaseParticipantSerializer(owners, many=True)
        #return serializer.data



class CaseSerializer(serializers.ModelSerializer):
    case_identifier = serializers.CharField(source='get_caseid')
    report = ReportSerializer()
    status = ChoiceField(Case.STATUS_CHOICES)
    owners = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()
    advisory_status = serializers.SerializerMethodField()

    class Meta:
        model = Case
        fields = ('case_id', 'case_identifier', 'owners', 'created', 'modified', 'status', 'title', 'summary', 'report', 'public_date', 'due_date', 'stats', 'advisory_status')
        lookup_field = "case_id"
        read_only_fields =("case_id", "owners", "case_identifier", "created", "modified", "report",)

    def get_stats(self, obj):
        serializer = CaseStatSerializer(obj)
        return serializer.data

    def get_owners(self, obj):
        gs = GlobalSettings.objects.all().first()
        if gs and gs.coordinator_identity:
            serializer = CaseOwnerDefaultIdentity([gs], many=True)
            return serializer.data
        else:
            owners = CaseParticipant.objects.filter(case=obj, role="owner", group__isnull=False)
            serializer = CaseOwnerSerializer(owners, many=True)
            return serializer.data

    def get_advisory_status(self, obj):
        advisory = CaseAdvisory.objects.filter(case=obj).first()
        if advisory:
            if advisory.date_published:
                return "PUBLISHED"
            elif AdvisoryRevision.objects.filter(advisory=advisory, date_shared__isnull=False).exists():
                return "DRAFT"
            else:
                return "PENDING"
        else:
            return "PENDING"


class CaseDetailSerializer(serializers.ModelSerializer):
    case_identifier = serializers.CharField(source='get_caseid')
    report = ReportDetailSerializer()
    status = ChoiceField(Case.STATUS_CHOICES)
    owners = serializers.SerializerMethodField()
    advisory_status = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()

    class Meta:
        model = Case
        fields = ('case_id', 'case_identifier', 'owners', 'created', 'created_by', 'modified', 'status', 'title', 'summary', 'report', 'public_date', 'due_date', 'advisory_status', 'stats', 'state', 'tags' )
        lookup_field = "case_id"
        read_only_fields =("case_id", "owners", "case_identifier", "created", "modified", "report", "created_by", 'tags' )

    def get_stats(self, obj):
        serializer = CoordinatorCaseSummarySerializer(obj)
        return serializer.data

    def get_tags(self, obj):
        return list(obj.tags.values_list('tag', flat=True))

    def get_created_by(self, obj):
        if obj.created_by:
            return obj.created_by.screen_name

    def get_advisory_status(self, obj):
        advisory = CaseAdvisory.objects.filter(case=obj).first()
        if advisory:
            if advisory.date_published:
                return "PUBLISHED"
            elif AdvisoryRevision.objects.filter(advisory=advisory, date_shared__isnull=False).exists():
                return "DRAFT"
            else:
                return "PENDING"
        else:
            return "NOT STARTED"

    def get_owners(self, obj):
        owners = CaseParticipant.objects.filter(case=obj, role="owner")
        serializer = CaseOwnerSerializer(owners, many=True)
        return serializer.data



class UserCaseState:
    def __init__(self, user, contact, last_viewed, role, status_needed, groups, new_posts=[], priv_thread=False):
        self.user = user
        self.contact = str(contact)
        self.last_viewed = last_viewed
        self.role = role
        self.status_needed = status_needed
        self.groups = groups
        self.new_posts = new_posts
        self.priv_thread = priv_thread
        if role == "owner":
            self.delete_perm = True



class UserCaseStateSerializer(serializers.Serializer):
    user = UserSerializer()
    contact = serializers.CharField()
    last_viewed = serializers.DateTimeField()
    delete_perm = serializers.BooleanField(default=False)
    role = serializers.CharField()
    status_needed = serializers.BooleanField(default=False)
    priv_thread = serializers.BooleanField(default=False)
    groups = serializers.ListField(
        child=GroupSerializer()
    )
    new_posts = serializers.ListField(
        child=serializers.IntegerField()
    )



class Notification:
    def __init__(self, case, text):
        self.case = case
        self.text = text

class NotificationSerializer(serializers.Serializer):
    case = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    text = serializers.CharField()

    def get_case(self, obj):
        case = obj['case']
        return "%s" % case.case_id
        return ""

    def get_url(self, obj):
        case = obj['case']
        return reverse("cvdp:case", args=[case.case_id])



class ContentSerializerField(serializers.Field):

    def to_representation(self, obj):
        return obj

    def to_internal_value(self, data):
        return data


class CaseParticipantSummarySerializer(serializers.Serializer):
    count = serializers.IntegerField()
    notified = serializers.IntegerField()
    vendors = serializers.IntegerField()

class CaseUserViewSerializer(serializers.ModelSerializer):
    user = serializers.CharField(source='user.screen_name', read_only=True)

    class Meta:
        model = CaseViewed
        fields = ('user', 'first_viewed', 'date_viewed')


class CaseOwnerDefaultIdentity(serializers.ModelSerializer):

    name = serializers.CharField(source='coordinator_identity')
    photo = serializers.SerializerMethodField()
    logocolor = serializers.CharField(source='group.groupprofile.icon_color')
    uuid = serializers.CharField(source='group.groupprofile.uuid')
    participant_type = serializers.CharField(default="group")

    def get_photo(self, obj):
        if obj.group.groupprofile.logo:
            return obj.group.groupprofile.logo.url
        else:
            return None

    class Meta:
        model = GlobalSettings
        fields = ('name', 'photo', 'logocolor', 'uuid', 'participant_type')

class CaseOwnerSerializer(serializers.ModelSerializer):

    name = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()
    logocolor = serializers.SerializerMethodField()
    uuid = serializers.SerializerMethodField()
    participant_type = serializers.SerializerMethodField()

    class Meta:
        model = CaseParticipant
        fields = ('id', 'name', 'photo', 'logocolor', 'uuid', 'participant_type')


    def get_participant_type(self, obj):
        if obj.group:
            return "group"
        elif obj.contact:
            if obj.contact.user:
                return "user"
            else:
                return "contact"

    def get_name(self, obj):
        if obj.group:
            return obj.group.name
        elif obj.contact:
            if obj.contact.user:
                if obj.contact.user.screen_name:
                    return obj.contact.user.screen_name
            if obj.contact.name:
                return obj.contact.name
            else:
                return obj.contact.email
        else:
            return "?"

    def get_uuid(self, obj):
        if obj.group:
            return obj.group.groupprofile.uuid
        elif obj.contact:
            return obj.contact.uuid
        return ""

    def get_photo(self, obj):
        #request = self.context.get('request')
        #if not request:
        #    return None
        if obj.group:
            if obj.group.groupprofile.logo:
                url = obj.group.groupprofile.logo.url
                return url
        elif obj.contact:
            if obj.contact.user:
                if obj.contact.user.userprofile.photo:
                    url = obj.contact.user.userprofile.photo.url
                    return url
                    #return obj.contact.user.userprofile.photo
        return None

    def get_logocolor(self, obj):
        if obj.group:
            return obj.group.groupprofile.icon_color
        elif obj.contact:
            return obj.contact.get_color()
        return "#827F7F"  #generic dark color


class CaseParticipantSerializer(serializers.ModelSerializer):

    name = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()
    logocolor = serializers.SerializerMethodField()
    participant_type = serializers.SerializerMethodField()
    users = serializers.SerializerMethodField()

    class Meta:
        model = CaseParticipant
        fields = ('id', 'name', 'photo', 'participant_type', 'logocolor', 'role', 'users', )

    def get_name(self, obj):

        if self.context.get('coordinator') and obj.role == "owner":
            return self.context.get('coordinator')

        if obj.group:
            return obj.group.name
        elif obj.contact:
            if obj.contact.user:
                if obj.contact.user.screen_name:
                    return obj.contact.user.screen_name
            if obj.contact.name:
                return obj.contact.name
            else:
                return obj.contact.email
        else:
            return "?"

    def get_users(self, obj):
        if self.context.get('coordinator') and obj.role == "owner":
            return get_visible_case_coordinators(obj)

        if obj.group:
            #get users in group
            return list(get_case_users_in_group(obj).values_list('screen_name', flat=True))
        else:
            return []

    def get_participant_type(self, obj):
        if obj.group:
            return "group"
        elif obj.contact:
            if obj.contact.user:
                return "user"
            else:
                return "contact"

    def get_photo(self, obj):

        if self.context.get('owner') and obj.role == "owner":
            if self.context['owner'].groupprofile.logo:
                return self.context['owner'].groupprofile.logo.url
            else:
                return None

        if obj.group:
            if obj.group.groupprofile.logo:
                url = obj.group.groupprofile.logo.url
                return url
        elif obj.contact:
            if obj.contact.user:
                if obj.contact.user.userprofile.photo:
                    url = obj.contact.user.userprofile.photo.url
                    return url
                    #return obj.contact.user.userprofile.photo
        return None

    def get_logocolor(self, obj):

        if self.context.get('owner') and obj.role == "owner":
            return self.context['owner'].groupprofile.icon_color

        if obj.group:
            return obj.group.groupprofile.icon_color
        elif obj.contact:
            return obj.contact.get_color()
        return "#827F7F"  #generic dark color

    def validate_role(self, value):
        """
        Check that this is a valid role for this participant
        """
        if self.instance:
            avail_roles = self.get_roles_available(self.instance)
            if value not in avail_roles:
                raise serializers.ValidationError("This role is not available to this participant")
        return value

    def update(self, participant, validated_data):
        participant.role = validated_data.get('role')
        participant.save()
        return participant


class CaseParticipantDetailSerializer(CaseParticipantSerializer):

    added_by = serializers.CharField(source='user.screen_name', read_only=True)
    roles_available = serializers.SerializerMethodField()
    viewed = serializers.SerializerMethodField()
    uuid = serializers.SerializerMethodField()


    class Meta:
        model = CaseParticipant
        fields = CaseParticipantSerializer.Meta.fields + ('added_by', 'roles_available', 'added', 'notified', 'pulse', 'viewed', 'uuid', )


    def get_uuid(self, obj):
        if obj.group:
            return obj.group.groupprofile.uuid
        elif obj.contact:
            return obj.contact.uuid
        return ""


    def get_viewed(self, obj):
        if obj.contact:
            if obj.contact.user:
                cvs = CaseViewed.objects.filter(case=obj.case, user=obj.contact.user)
                serializer = CaseUserViewSerializer(cvs, many=True)
                return serializer.data
        if obj.group:
            #get users in group:
            ug = User.objects.filter(groups__name=obj.group.name)
            cvs = CaseViewed.objects.filter(case = obj.case, user__in=ug)
            serializer = CaseUserViewSerializer(cvs, many=True)
            return serializer.data
        return []

    def get_roles_available(self, obj):
        if obj.contact:
            if obj.contact.user:
                if is_coordinator(obj.contact.user):
                    team = get_coord_team(obj.case.id).values_list('id', flat=True)
                    if team and obj.contact.user.groups.filter(id__in=team):
                        return ["owner", "supplier", "reporter", "observer", "participant"]

        if obj.group and obj.group.groupprofile.vendor_type == "Coordinator":
            return ["supplier", "reporter", "observer", "participant", "owner"]

        return ["supplier", "reporter", "observer", "participant"]


class CaseThreadParticipantDetailSerializer(serializers.ModelSerializer):

    participant = CaseParticipantDetailSerializer()
    thread = serializers.CharField(source='thread.id')

    class Meta:
        model = CaseThreadParticipant
        fields = ('id', 'participant', 'thread', )


class CaseThreadParticipantSerializer(serializers.ModelSerializer):

    participant = CaseParticipantSerializer()
    thread = serializers.CharField(source='thread.id')

    class Meta:
        model = CaseThreadParticipant
        fields = ('id', 'participant', 'thread', )



class CaseThreadSerializer(serializers.ModelSerializer):

    case = serializers.CharField(source='case.case_id')
    last_post = serializers.SerializerMethodField()

    class Meta:
        model = CaseThread
        fields = ('id', 'case', 'created', 'subject', 'official', 'archived', 'last_post')

    def get_last_post(self, obj):
        last_post = obj.post_set.order_by('-created').first()
        if last_post:
            return last_post.created
        else:
            return None

class AuthorSerializer(serializers.ModelSerializer):

    name = serializers.CharField(source='screen_name')
    logocolor = serializers.CharField(source='userprofile.logocolor')
    photo = serializers.ImageField(source='userprofile.photo')
    participant = serializers.SerializerMethodField()
    contact = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('name', 'org', 'photo', 'logocolor', 'title', 'participant', 'contact')

    def get_contact(self, obj):
        try:
            return str(obj.contact.uuid)
        except ObjectDoesNotExist:
            return None

    def get_participant(self, obj):
        return self.context.get('participant', None)

class PostReplySerializer(serializers.ModelSerializer):
    content = serializers.CharField(source='post.current_revision.content')
    author_role = serializers.SerializerMethodField()
    author = serializers.SerializerMethodField()
    group = serializers.SerializerMethodField()
    revisions = serializers.SerializerMethodField()
    revision_id = serializers.CharField(source='post.current_revision.id')
    created = serializers.DateTimeField(source='post.created')
    id = serializers.IntegerField(source='post.id')
    reactions = serializers.SerializerMethodField()

    class Meta:
        model = PostReply
        fields = ('id', 'content', 'author_role', 'group', 'author', 'revisions', 'revision_id', 'created', 'reactions')

    def get_revisions(self, obj):
        return obj.post.postrevision_set.count() - 1

    def get_author(self, obj):
        cp = get_post_participant(obj.post)
        cpid = 0
        if cp:
            cpid = cp.id
        if obj.post.author:
            if obj.post.author.user:
                serializer = AuthorSerializer(obj.post.author.user, context={'participant': cpid})
                return serializer.data
            else:
                serializer = ContactSerializer(obj.post.author)
                return serializer.data
        else:
            #TODO: fake anonymous user
            return "Unknown"

    def get_group(self, obj):
        if obj.post.group:
            if self.context.get('coordinator') and obj.post.group.groupprofile.vendor_type == "Coordinator":
                #if same branding for coordinator and this is a coordinator group - then determine
                #if the participant is the owner and if so, use the brand name to identify the author
                cp = get_post_participant(obj.post)
                if (cp.role == "owner"):
                    return {'name': self.context.get('coordinator'), 'logocolor': self.context['owner'].groupprofile.icon_color, 'photo': self.context['owner'].groupprofile.get_logo()}

            serializer = GroupLogoSerializer(obj.post.group)
            return serializer.data
        return None

    def get_reactions(self, obj):
        reactions = PostLikes.objects.filter(post=obj.post).values('reaction').annotate(count=Count('reaction'),users=StringAgg('user__screen_name', delimiter=", ")).order_by('-count')
        react_serializer = PostLikeSummarySerializer(reactions, many=True)
        return react_serializer.data


    def get_author_role(self, obj):
        if obj.post.author:
            if obj.post.author.user:
                return my_case_role(obj.post.author.user, obj.post.thread.case)
        else:
            return "Participant"


class PostTransferSerializer(serializers.Serializer):
    content = serializers.CharField()
    author = serializers.CharField()
    created = serializers.DateTimeField()


class PostLikeSummarySerializer(serializers.Serializer):
    count = serializers.IntegerField()
    reaction = serializers.CharField()
    users = serializers.CharField()



class WritePostSerializer(serializers.Serializer):
    content = serializers.CharField()
    json = serializers.CharField(required=False)
    reply = serializers.IntegerField(required=False)

class PostSerializer(serializers.ModelSerializer):
    content = serializers.CharField(source='current_revision.content')
    json = serializers.JSONField(source='current_revision.json_content')
    reactions = serializers.SerializerMethodField()
    author_role = serializers.SerializerMethodField()
    group = serializers.SerializerMethodField()
    author = serializers.SerializerMethodField()
    revisions = serializers.SerializerMethodField()
    revision_id = serializers.CharField(source='current_revision.id')
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ["id", "created", "author", "author_role", "pinned", "group", "content", "revisions", 'revision_id', 'replies', 'json', 'reactions']

    def update(self, post, validated_data):
        content = validated_data.get('current_revision')
        json_content = []
        if content:
            json_content = content.get('json_content', [])
            content = content.get('content')

        pinned = validated_data.get('pinned', post.pinned)
        post.pinned=pinned
        post.save()

        if content:
            rev = PostRevision()
            rev.inherit_predecessor(post)
            rev.content = content
            rev.json_content = json_content
            rev.deleted = False
            post.add_revision(rev)
        return post

    def get_group(self, obj):

        if obj.group:
            if self.context.get('coordinator') and obj.group.groupprofile.vendor_type == "Coordinator":
                #if same branding for coordinator and this is a coordinator group - then determine
                #if the participant is the owner and if so, use the brand name to identify the author
                cp = get_post_participant(obj)
                if (cp.role == "owner"):
                    return {'name': self.context.get('coordinator'), 'logocolor': self.context['owner'].groupprofile.icon_color, 'photo': self.context['owner'].groupprofile.get_logo()}

            serializer = GroupLogoSerializer(obj.group)
            return serializer.data
        return None

        """
    def set_content(self, obj):
        pass

    def get_content(self, obj):
        return mark_safe(md(obj.current_revision.content))
        """

    def get_reactions(self, obj):
        reactions = PostLikes.objects.filter(post=obj).values('reaction').annotate(count=Count('reaction'),users=StringAgg('user__screen_name', delimiter=", ")).order_by('-count')
        react_serializer = PostLikeSummarySerializer(reactions, many=True)
        return react_serializer.data

    def get_replies(self, obj):
        pt = PostReply.objects.filter(reply__parent=obj, post__deleted=False)
        if pt:
            serializer = PostReplySerializer(pt, many=True, context=self.context)
            return serializer.data
        else:
            return []

    def get_revisions(self, obj):
        return obj.postrevision_set.count() - 1

    def get_author(self, obj):
        cp = get_post_participant(obj)
        cpid = 0
        if cp:
            cpid = cp.id
        if obj.author:
            if obj.author.user:
                serializer = AuthorSerializer(obj.author.user, context={'participant': cpid})
                return serializer.data
            else:
                serializer = ContactSerializer(obj.author)
                return serializer.data
        else:
            #TODO: fake anonymous user
            return "Unknown"


    def get_author_role(self, obj):
        if obj.author:
            if obj.author.user:
                return my_case_role(obj.author.user, obj.thread.case)
        else:
            return "Participant"


class CaseThreadPostSerializer(PostSerializer):

    subject = serializers.CharField(source='thread.subject')
    archived = serializers.BooleanField(source='thread.archived')
    thread_id = serializers.IntegerField(source='thread.id')

    class Meta:
        model = Post
        fields = PostSerializer.Meta.fields + ['thread_id', 'subject', 'archived']


class VulTagSerializer(serializers.ModelSerializer):

    class Meta:
        model=VulnerabilityTag
        fields = ('tag', )


class AffectedProductSerializer(serializers.ModelSerializer):

    component = serializers.IntegerField(source='component.id')
    vendor = serializers.SerializerMethodField()
    product = serializers.CharField(source='component.name')
    #version = serializers.CharField(source='current_revision.version_value')
    #version_type = serializers.CharField(source='current_revision.version_type')
    #version_affected = serializers.CharField(source='current_revision.version_affected')
    #end_version_range = serializers.CharField(source='current_revision.version_name')
    status = serializers.JSONField(source='current_revision.version_status')
    default_status = ChoiceField(source='current_revision.default_status', choices=CVE_STATUS_CHOICES)

    class Meta:
        model = ComponentStatus
        fields = ('component', 'vendor', 'product', 'default_status', 'status')

    def get_vendor(self, obj):
        if obj.component.product_info.supplier:
            return obj.component.product_info.supplier.name
        if obj.component.supplier:
            return obj.component.supplier
        return ""

class VEXProduct(serializers.Serializer):
    id = serializers.CharField()

    def to_internal_value(self, data):
        data["id"] = data.pop("@id", "")
        return data

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["@id"] = data.pop("id", "")
        return data

class VEXVulnerability(serializers.Serializer):
    name = serializers.CharField()


class VEXStatement(serializers.Serializer):
    vulnerability = VEXVulnerability()
    products = serializers.ListField(
        child=VEXProduct()
    )
    status = serializers.ChoiceField(choices=["affected", "not_affected", "fixed", "under_investigation"])

class VEXUploadSerializer(serializers.Serializer):
    author = serializers.CharField()
    role = serializers.CharField()
    timestamp = serializers.DateTimeField()
    version = serializers.IntegerField()
    statements = serializers.ListField(
        child=VEXStatement()
    )

class VEXSerializer(serializers.ModelSerializer):

    context = serializers.ReadOnlyField(default="https://openvex.dev/ns")
    id = serializers.SerializerMethodField()
    author = serializers.SerializerMethodField()
    role = serializers.ReadOnlyField(default="Document Creator")
    timestamp = serializers.SerializerMethodField()
    version = serializers.SerializerMethodField()
    statements = serializers.SerializerMethodField()

    class Meta:
        model = Vulnerability
        fields = ('context', 'id', 'author', 'role', 'timestamp', 'version', 'statements')

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["@context"] = data.pop("context", "")
        data["@id"] = data.pop("id", "")
        return data

    def get_id(self, obj):
        return f"{settings.SERVER_NAME}{obj.case.get_absolute_url()}"

    def get_author(self, obj):
        user = self.context.get('user')
        if user:
            return user.get_full_name()
        else:
            return obj.case.get_owners

    def get_timestamp(self, obj):
        status = ComponentStatus.objects.filter(vul=obj).order_by('-current_revision__modified').first()
        return str(status.current_revision.modified)

    def get_version(self, obj):
        status = ComponentStatus.objects.filter(vul=obj).order_by('-current_revision__modified').first()
        return status.current_revision.revision_number

    def get_statements(self, obj):
        user = self.context.get('user')
        if is_coordinator(user):
            status = ComponentStatus.objects.filter(vul=obj)
        else:
            comps = my_components(user)
            status = ComponentStatus.objects.filter(vul=obj, component__in=comps)

        stmts = []
        products = {'affected': [], 'fixed': [], 'under_investgation': []}
        for item in status:
            for version in item.current_revision.version_status:
                lstatus = version["status"].lower().replace(" ", "_");
                if lstatus == "not_affected":
                    just = version["justification"].lower().replace(" ", "_")
                    stmts.append({"vulnerability": {"name": item.vul.vul},
                                  "products": [{"@id": f"{item.component.name} {version['version_value']}"}],
                                  "status": "not_affected",
                                  "justification": just})
                else:
                    products[lstatus].append({"@id": f"{item.component.name} {version['version_value']}"})
        for key,val in products.items():
            if val:
                stmts.append({"vulnerability": {"name": obj.vul},
                              "products": val,
                              "status": key});
        return stmts


class CVSSSerializer(serializers.ModelSerializer):

    scored_by = serializers.CharField(source='scored_by.screen_name', required=False)

    class Meta:
        model=VulCVSS
        fields = ('AV', 'AC', 'PR', 'UI', 'S', 'C', 'I', 'A', 'E', 'RL', 'RC', 'scored_by', 'last_modified', 'vectorString', 'score', 'severity', 'version', 'metrics_json')
        read_only_fields = ('scored_by', 'last_modified')


class BasicVulSerializer(serializers.ModelSerializer):
    case = serializers.CharField(source='case.caseid')

    class Meta:
        model = Vulnerability
        fields = ('vul', 'id', 'cve', 'case', 'title')


class VulAttributeSerializer(serializers.ModelSerializer):

    class Meta:
        model = VulAttributes
        fields = ('name', 'value')

class VulSerializer(serializers.ModelSerializer):

    vul = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    cve_tags = serializers.ListField(source='tags', required=False)
    cvss = CVSSSerializer(many=True, required=False)
    ssvc_vector = serializers.SerializerMethodField()
    ssvc_decision = serializers.SerializerMethodField()
    ssvc_decision_tree = serializers.SerializerMethodField()
    ssvc_justifications = serializers.SerializerMethodField()
    affected_products = serializers.SerializerMethodField()
    case = serializers.CharField(source='case.caseid')
    url = serializers.SerializerMethodField()
    attributes = VulAttributeSerializer(many=True, required=False)
    approved = serializers.SerializerMethodField()
    approvals = serializers.SerializerMethodField()


    class Meta:
        model = Vulnerability
        fields = ('id', 'cve', 'title', 'description', 'vul', 'date_added', 'date_public', 'date_published', 'problem_types', 'references', 'tags', 'cvss', 'ssvc_vector', 'ssvc_decision', 'ssvc_decision_tree', 'ssvc_justifications', 'affected_products', 'case', 'url', 'acknowledgments', 'cve_tags', 'attributes', 'publish', 'approved', 'approvals')
        read_only_fields = ('case', 'vul', 'id', 'date_added')


    def get_fields(self):
        fields = super().get_fields()
        user = self.context.get('user')
        if not user or not is_coordinator(user):
            fields.pop('approvals')
            fields.pop('approved')
            fields.pop('ssvc_justifications')
        return fields


    def validate_problem_types(self, value):
        #find CWE-ID
        ret_value = []
        if value:
            for x in value:
                m = re.search(r"(CWE-(\d{1,7}|noinfo))", x)
                if m:
                    cwe_match = m.group(1)
                    find_cwe = CWEDescriptions.objects.filter(cweid=cwe_match).first()
                    if find_cwe:
                        ret_value.append(find_cwe.cwe)
        return ret_value


    def create(self, validated_data):
        cvss_data = validated_data.pop('cvss', None)
        attributes = validated_data.pop('attributes', [])
        instance = Vulnerability.objects.create(**validated_data)
        if cvss_data:
            for x in cvss_data:
                scorer = None
                if x.get("scored_by"):
                    scorer = User.objects.filter(screen_name=x["scored_by"]).first()
                    x.pop("scored_by", None)
                order = VulCVSS.objects.create(**x, vul=instance)
                if scorer:
                    order.scored_by = scorer
                    order.save()

        for attribute in attributes:
            val = attribute.get('value')
            if val:
                create = VulAttributes.objects.create(**attribute, vul=instance)

        return instance

    def update(self, instance, validated_data):
        cvss_data = validated_data.pop('cvss', None)
        attributes = validated_data.pop('attributes', []);
        if cvss_data:
            for x in cvss_data:
                if x.get('version'):
                    child_instance = VulCVSS.objects.filter(vul=instance, version=x.get('version')).first()
                    if child_instance:
                        child_serializer = CVSSSerializer(instance=child_instance, data=x, partial=True)
                        child_serializer.is_valid(raise_exception=True)
                        child_serializer.save()
                    else:
                        #create it
                        create = VulCVSS.objects.create(**x, vul=instance)
                else:
                    raise serializers.ValidationError("CVSS version required.")

        for attribute in attributes:
            child_instance = VulAttributes.objects.filter(vul=instance, name=attribute.get('name')).first()
            val = attribute.get('value')
            if child_instance:
                if val:
                    child_serializer=VulAttributeSerializer(instance=child_instance, data=attribute, partial=True)
                    child_serializer.is_valid(raise_exception=True)
                    child_serializer.save()
                else:
                    #remove attribute if no value
                    child_instance.delete()
            else:
                if val:
                    create = VulAttributes.objects.create(**attribute, vul=instance)
        # Update parent fields
        return super().update(instance, validated_data)

    def to_internal_value(self, data):
        if data.get('date_public') == '':
            data['date_public'] = None
        acks = []
        if data.get('acknowledgments'):
            for ack in data['acknowledgments']:
                if ((ack.get('names') and ack["names"] != "") or (ack.get('organization') and ack["organization"] != "")):
                    #make sure these are not empty strings
                    acks.append(ack)
            data['acknowledgments'] = acks
        return super().to_internal_value(data)

    def get_vul(self, obj):
        return obj.vul

    def get_url(self, obj):
        return obj.get_absolute_url()

    def validate_cve(self, value):
        if value != None:
            if value.lower().startswith('cve-'):
                cve = value[4:]
                return cve
            else:
                return value
        return value


    def get_tags(self, obj):
        return list(obj.vulnerabilitytag_set.values_list('tag', flat=True))

    def get_ssvc_vector(self, obj):
        try:
            if obj.vulssvc:
                return obj.vulssvc.vector
        except VulSSVC.DoesNotExist:
            return None

    def get_ssvc_decision(self, obj):
        try:
            if obj.vulssvc:
                return obj.vulssvc.final_decision
        except VulSSVC.DoesNotExist:
            return None

    def get_ssvc_decision_tree(self, obj):
        try:
            if obj.vulssvc:
                dec_tree = obj.vulssvc.decision_tree
                dec_tree.append({'label': 'date_scored', 'value': obj.vulssvc.last_edit})
                dec_tree.append({'label': 'tree_type', 'value': obj.vulssvc.tree_type})
                return dec_tree
        except VulSSVC.DoesNotExist:
            return None

    def get_ssvc_justifications(self, obj):
        try:
            if obj.vulssvc:
                return obj.vulssvc.justifications
        except VulSSVC.DoesNotExist:
            return None

    def get_affected_products(self, obj):
        #get all *Affected* status related to this vul
        user = self.context.get('user')
        if user:
            if is_coordinator(user):
                #if case owner, get all components
                status = ComponentStatus.objects.filter(vul=obj)
            else:
                my_groups = my_case_vendors(user, obj.case)
                components = ComponentStatus.objects.filter(vul=obj)
                case_components = components.values_list('component__id', flat=True)
                if my_groups and case_components:
                    products = Product.objects.filter(supplier__in=my_groups, component__in=case_components).values_list('component__id', flat=True)
                    #get all my components/or component status set to Share
                    status = components.filter(component__id__in=products)
                else:
                    status = components.filter(current_revision__user=user)
        else:
            #if user isn't present, we could possibly leak info that we shouldn't
            #status = ComponentStatus.objects.filter(vul=obj, current_revision__status=1)
            status = []
        serializer = AffectedProductSerializer(status, many=True)
        return serializer.data

    def get_approvals(self, obj):
        user = self.context.get('user')
        if user:
            if is_coordinator(user):
                approvals = CaseApproval.objects.filter(case=obj.case, vulnerability=obj).order_by('-created')
                serializer = CaseApprovalSerializer(approvals, many=True, context=self.context)
                return serializer.data
        return []

    def get_approved(self, obj):
        user = self.context.get('user')
        if user:
            if is_coordinator(user):
                return CaseApproval.objects.filter(case=obj.case, vulnerability=obj, status=CaseApproval.APPROVED).exists()
        return False


class ArtifactSerializer(serializers.ModelSerializer):

    file = serializers.FileField(source='file.file')
    uuid = serializers.CharField(source='file.uuid', required=False)
    filename = serializers.CharField(source='file.filename', required=False)
    mime_type = serializers.CharField(source='file.mime_type', required=False)
    size = serializers.IntegerField(source='file.size', required=False)
    user = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    uploaded_date = serializers.SerializerMethodField()
    removable = serializers.SerializerMethodField()

    class Meta:
        model = CaseArtifact
        fields = ('file', 'filename', 'url', 'mime_type', 'size', 'user', 'uuid', 'uploaded_date', 'removable', 'shared')

    def get_url(self, obj):
        return reverse("cvdp:artifact", args=[obj.file.uuid])

    def get_user(self, obj):
        if obj.action:
            if obj.action.user:
                return obj.action.user.screen_name
        return "Anonymous User"

    def get_uploaded_date(self, obj):
        if obj.action:
            return obj.action.created
        else:
            return obj.file.uploaded_time

    def get_removable(self, obj):
        print(self.context)
        user = self.context.get('user')
        if obj.action:
            if user == obj.action.user:
                return True
        if user.is_staff:
            return True
        return False



class SSVCSerializer(serializers.ModelSerializer):

    user = serializers.CharField(source='user.screen_name', required=False)

    class Meta:
        model=VulSSVC
        fields = ('decision_tree', 'tree_type', 'final_decision', 'vector', 'user', 'last_edit', 'justifications')

class AdvisorySerializer(serializers.ModelSerializer):
    references = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    revision_number = serializers.IntegerField(read_only=True)
    revision_id = serializers.CharField(read_only=True)
    author = serializers.SerializerMethodField()
    user_message = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    diff = serializers.SerializerMethodField()
    content = serializers.CharField(required=True)

    class Meta:
        model=AdvisoryRevision
        fields = ('title', 'content', 'references', 'revision_number', 'revision_id', 'user_message', 'author', 'created', 'diff', 'date_published', 'date_shared', 'version_number', 'json_content')

    def get_author(self, obj):
        if obj.user:
            return obj.user.screen_name
        else:
            return "Unknown"

    def get_user_message(self, obj):
        if obj.user_message:
            return obj.user_message
        elif obj.automatic_log:
            return obj.automatic_log
        else:
            return "No log message"


    def get_diff(self, obj):

        other_revision = obj.previous_revision
        baseText = other_revision.content if other_revision is not None else ""
        newText = obj.content

        differ = difflib.Differ(charjunk=difflib.IS_CHARACTER_JUNK)
        diff = differ.compare(
            baseText.splitlines(keepends=True), newText.splitlines(keepends=True)
        )
        return list(diff)


class CSAFSettingsSerializer(serializers.ModelSerializer):

    acknowledgments = serializers.JSONField(source='acknowledgements', allow_null=True, default=[])

    class Meta:
        model = CaseCSAFSettings
        fields = ('publisher_settings', 'notes', 'lang', 'distribution_tlp', 'doc_id', 'references', 'acknowledgments', 'doc_id_format')



class CSAFPublisherDefaultSerializer(serializers.ModelSerializer):
    category = serializers.ReadOnlyField(default='coordinator')
    contact_details = serializers.CharField(default=f"Email: {settings.CONTACT_EMAIL}")
    issuing_authority = serializers.CharField(default=f'{settings.ORG_NAME}')
    name = serializers.CharField(default=f'{settings.ORG_NAME}')
    namespace = serializers.CharField(default=f'{settings.SERVER_NAME}')
    lang = serializers.CharField(default=f'{settings.LANGUAGE_CODE}')

    class Meta:
        model = CaseAdvisory
        fields = ('category', 'contact_details', 'issuing_authority', 'lang', 'name', 'namespace', )
        depth = 1


class CSAFPublisherSerializer(serializers.ModelSerializer):
    category = serializers.CharField(source='publisher_settings.category')
    contact_details = serializers.CharField(source='publisher_settings.contact_details')
    issuing_authority = serializers.CharField(source='publisher_settings.issuing_authority')
    name = serializers.CharField(source='publisher_settings.name')
    namespace = serializers.CharField(source='publisher_settings.namespace')

    class Meta:
        model = CaseCSAFSettings
        fields = ('category', 'contact_details', 'issuing_authority', 'name', 'namespace', )
        depth = 1

class CSAFDocumentRevisionHistory(serializers.ModelSerializer):
    number = serializers.SerializerMethodField()
    date = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()

    class Meta:
        model = AdvisoryRevision
        fields = ('number', 'summary', 'date')


    def get_number(self, obj):
        if obj.version_number:
            return obj.version_number
        elif not obj.date_published and not obj.date_shared:
            return "0.1.0"
        else:
            return "1.0.0"

    def get_date(self, obj):
        if obj.date_published:
            return obj.date_published.strftime("%Y-%m-%dT%H:%M:%SZ")
        elif obj.date_shared:
            return obj.date_shared.strftime("%Y-%m-%dT%H:%M:%SZ")
        else:
            return obj.created.strftime("%Y-%m-%dT%H:%M:%SZ")

    def get_summary(self, obj):
        if obj.user_message:
            return obj.user_message
        elif obj.version_number == "1.0.0":
            return "Initial release"
        else:
            return "Case update resulted in new information"

class CSAFTrackingSerializer(serializers.ModelSerializer):
    current_release_date = serializers.SerializerMethodField()
    generator = serializers.SerializerMethodField()
    id = serializers.SerializerMethodField()
    initial_release_date = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()      #ReadOnlyField(default='final') #also could be 'draft' or 'interim'
    version = serializers.SerializerMethodField()
    revision_history = serializers.SerializerMethodField()

    class Meta:
        model = CaseAdvisory
        fields = ('current_release_date', 'generator', 'id', 'initial_release_date', 'status', 'version', 'revision_history', )
        depth = 1


    def get_id(self, obj):
        try:
            return obj.advisory.case.casecsafsettings.doc_id
        except CaseCSAFSettings.DoesNotExist:
            return obj.advisory.case.caseid

    def get_initial_release_date(self, obj):
        if obj.advisory.date_published:
            revs = AdvisoryRevision.objects.filter(advisory__id=obj.advisory.id).exclude(date_published__isnull=True).order_by('revision_number').first()
            return revs.date_published.strftime("%Y-%m-%dT%H:%M:%SZ")
        else:
            #get first shared
            revs = AdvisoryRevision.objects.filter(advisory__id=obj.advisory.id).exclude(date_shared__isnull=True).order_by('revision_number').first()
            if (revs):
                return revs.date_shared.strftime("%Y-%m-%dT%H:%M:%SZ")
            else:
                #otherwise, cheat and use now
                return timezone.now().strftime("%Y-%m-%dT%H:%M:%SZ")

    def get_current_release_date(self, obj):
        if obj.advisory.date_published:
            revs = AdvisoryRevision.objects.filter(advisory__id=obj.advisory.id).exclude(date_published__isnull=True).order_by('-revision_number').first()
            return revs.date_published.strftime("%Y-%m-%dT%H:%M:%SZ")
        else:
            # get last shared
            revs = AdvisoryRevision.objects.filter(advisory__id=obj.advisory.id).exclude(date_shared__isnull=True).order_by('-revision_number').first()
            if (revs):
                return revs.date_shared.strftime("%Y-%m-%dT%H:%M:%SZ")
            else:
                #otherwise, cheat and use now
                return timezone.now().strftime("%Y-%m-%dT%H:%M:%SZ")


    def get_status(self, obj):
        if obj.advisory.date_published:
            return "final"
        else:
            return "draft"

    def get_generator(self, obj):
        engine = {}
        engine['name'] = "VINCE-NT"
        engine['version'] = settings.VERSION
        return {'engine': engine}

    def get_version(self, obj):
        #get revision last published
        revs = AdvisoryRevision.objects.filter(advisory__id=obj.advisory.id).exclude(date_published__isnull=True).order_by('-revision_number')
        if (len(revs) > 0):
            if revs.first().version_number:
                return revs.first().version_number
            else:
                return "1.0.0"
        else:
            return '0'

    def get_revision_history(self, obj):
        if obj.advisory.date_published:
            revs = AdvisoryRevision.objects.filter(advisory__id=obj.advisory.id).exclude(date_published__isnull=True).order_by('-revision_number')
        else:
            #revs = AdvisoryRevision.objects.filter(advisory__id=obj.advisory.id).exclude(date_shared__isnull=True).order_by('-revision_number')
            revs = AdvisoryRevision.objects.filter(advisory__id=obj.advisory.id).order_by('-revision_number')
        data =  CSAFDocumentRevisionHistory(revs, many=True)
        return data.data

class CSAFDocumentSerializer(serializers.ModelSerializer):
    category = serializers.ReadOnlyField(default='csaf_vex')
    csaf_version = serializers.ReadOnlyField(default='2.0')
    publisher = serializers.SerializerMethodField()
    lang = serializers.SerializerMethodField()
    references = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()
    title = serializers.CharField(source='advisory.case.title')
    tracking = serializers.SerializerMethodField()
    distribution = serializers.SerializerMethodField()
    acknowledgments = serializers.SerializerMethodField()

    class Meta:
        model = CaseAdvisory
        fields = ('category', 'csaf_version', 'lang', 'publisher', 'title', 'tracking', 'distribution', 'notes', 'references', 'acknowledgments' )
        depth = 1

    def get_fields(self):
        fields = super().get_fields()
        try:
            settings = self.instance.advisory.case.casecsafsettings
            if not settings.references:
                fields.pop('references')

            if not settings.acknowledgements:
                fields.pop('acknowledgments')

            if not settings.notes:
                fields.pop('notes')

        except CaseCSAFSettings.DoesNotExist:
            fields.pop('distribution')
            fields.pop('notes')
            fields.pop('references')
            fields.pop('acknowledgments')
        return fields

    def get_distribution(self, obj):
        distribution_tlp = obj.advisory.case.casecsafsettings.distribution_tlp
        return {"tlp": {"label": distribution_tlp}}

    def get_lang(self, obj):
        try:
            lang = obj.advisory.case.casecsafsettings.lang
            if lang:
                return lang
        except CaseCSAFSettings.DoesNotExist:
            pass

        return settings.LANGUAGE_CODE

    def get_publisher(self, obj):
        try:
            csaf_settings = obj.advisory.case.casecsafsettings
            if csaf_settings.publisher_settings:
                data = CSAFPublisherSerializer(csaf_settings)
            else:
                data = CSAFPublisherDefaultSerializer(csaf_settings)
        except CaseCSAFSettings.DoesNotExist:
            data = CSAFPublisherDefaultSerializer(obj)
        return data.data

    def get_tracking(self, obj):
        data =  CSAFTrackingSerializer(obj)
        return data.data

    def get_references(self, obj):

        references = obj.advisory.case.casecsafsettings.references
        return references

    def get_notes(self, obj):

        notes =obj.advisory.case.casecsafsettings.notes
        return notes

    def get_acknowledgments(self, obj):
        acks = obj.advisory.case.casecsafsettings.acknowledgements
        for a in acks:
            if (a.get('organization') == ""):
                # if org is empty don't add it
                a.pop("organization")
            if (a.get('names') == [""] or a.get("names") == []):
                a.pop("names")
            if (a.get('summary') == ""):
                a.pop("summary")
        return acks


class CSAFProductSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    product_id = serializers.SerializerMethodField()

    class Meta:
        model = StatusRevision
        fields = ('name', 'product_id', )

    def get_name(self, obj):
        component = self.context.get('component')
        if (obj.get('version_range')):
            vers = get_verslike_range(obj['version_value'], obj['version_range'], obj['version_end_range'])
            return f"{component.product_info.supplier.name} {component.name} {vers}"
        else:
            if (obj['version_value'] == "*"):
                return f"{component.product_info.supplier.name} {component.name} vers:all/*"

            return f"{component.product_info.supplier.name} {component.name} {obj['version_value']}"


    def get_product_id(self, obj):
        count = self.context.get('count')
        #component = self.context.get('component')
        #return f"CSAFPID-{component.id:04}"
        return f"CSAFPID-{count:04}"

class CSAFProductTreeVersionSerializer(serializers.ModelSerializer):
    category = serializers.SerializerMethodField() #ReadOnlyField(default='product_version')
    name= serializers.SerializerMethodField()
    product = serializers.SerializerMethodField()

    class Meta:
        model = ComponentStatus
        fields = ('category', 'name', 'product', )

    def get_name(self, obj):
        if obj.get('version_range'):
            return get_verslike_range(obj['version_value'], obj['version_range'], obj['version_end_range'])
        #f"{obj['version_value']} {obj['version_range']} {obj['version_end_range']}"
        else:
            if obj['version_value'] == "*":
                return "vers:all/*"
            return obj['version_value']

    def get_category(self, obj):
        if obj.get('version_range'):
            return "product_version_range"
        else:
            return "product_version"

    def get_product(self, obj):
        serializer = CSAFProductSerializer(obj, context=self.context)
        return serializer.data

class CSAFProductTreeNameSerializer(serializers.ModelSerializer):
    category = serializers.ReadOnlyField(default='product_name')
    name = serializers.SerializerMethodField() #serializers.CharField(source='component.name')
    branches = serializers.SerializerMethodField() # no branches if no version
    product = serializers.SerializerMethodField() #no product if there are branches

    class Meta:
        model = ComponentStatus
        fields = ('category', 'name', 'branches', 'product', )

    def get_name(self, obj):
        return self.context.get('name')

    def get_fields(self):
        #pop brances or product depending on if there are versions
        fields = super().get_fields()
        vuls = self.context.get('vuls')
        name = self.context.get('name')
        comps = ComponentStatus.objects.filter(vul__in=vuls).filter(Q(component__name=name)|Q(other_component__name=name))
        versions = 0
        for c in comps:
            app_rev = c.approved_revision()
            if app_rev:
                for p in app_rev.version_status:
                    if name == c.component.name:
                        versions = versions + 1
                    elif name == c.other_component.name:
                        if c.other_component_version:
                            versions = versions + 1


        if versions:
            fields.pop('product')
        else:
            fields.pop('branches')
        return fields

    def get_product(self, obj):
        name = f"{obj.other_component.product_info.supplier.name} {self.context.get('name')}"
        count = self.context.get('count')

        return {'name': name, 'product_id': f"CSAFPID-{count:04}"}

    def get_branches(self, obj):
        #get actual product info
        count = self.context.get('count')
        vuls = self.context.get('vuls')
        name = self.context.get('name')
        data = []
        names = []
        #make sure we get all component status in this case
        comps = ComponentStatus.objects.filter(vul__in=vuls).filter(Q(component__name=obj.component.name)|Q(other_component__name=obj.component.name))
        for c in comps:
            app_rev = c.approved_revision()
            if app_rev:
                for p in app_rev.version_status:
                    if name == obj.component.name:
                        d = CSAFProductTreeVersionSerializer(p, context={'component': obj.component, 'count': count})
                        if d.data['name'] not in names:
                            names.append(d.data['name'])
                            data.append(d.data)
                            count = count + 1
                    elif name == obj.other_component.name:
                        if obj.other_component_version:
                            if obj.other_component_version not in names:
                                names.append(obj.other_component_version)
                                serializer = CSAFProductSerializer({'version_value': obj.other_component_version}, context={'component': obj.other_component, 'count': count})
                                
                                data.append({"category": "product_version", "name": obj.other_component_version, 'product': serializer.data})
                                count = count + 1

        #products = CSAFProductTreeVersionSerializer(obj.current_revision.version_status, many=True, context={'component': obj.component, 'count': count})
        #return products.data
        return data


class CSAFProductRelationshipSerializer(serializers.ModelSerializer):
    category = serializers.SerializerMethodField()
    full_product_name = serializers.SerializerMethodField()
    product_reference = serializers.SerializerMethodField()
    relates_to_product_reference = serializers.SerializerMethodField()

    class Meta:
        model = ComponentStatus
        fields = ('category', 'full_product_name', 'product_reference', 'relates_to_product_reference', )


    def get_category(self, obj):
        component = self.context.get('component')
        return component.relationship

        
    def get_full_product_name(self, obj):
        count = self.context.get('count')
        component = self.context.get('component')
        serializer = CSAFProductSerializer(obj, context={'count': count, 'component': component.component})
        #edit product name
        if component.component.product_info.supplier.name != component.other_component.product_info.supplier.name:
            full_prod_name = serializer.data['name'] + f" {component.relationship} {component.other_component.product_info.supplier.name} {component.other_component.name}"
        else:
            full_prod_name = serializer.data['name'] + f" {component.relationship} {component.other_component.name}"
        if component.other_component_version:
            full_prod_name = full_prod_name + f" {component.other_component_version}"
        return {'name': full_prod_name, 'product_id': serializer.data['product_id']}

        
    def get_product_reference(self, obj):
        prod_tree = self.context.get('prod_tree')
        component = self.context.get('component')
        pid = find_product_id({"branches": prod_tree}, component.component, obj)
        if (pid):
            return pid
        return ""


    def get_relates_to_product_reference(self, obj):
        prod_tree = self.context.get('prod_tree')
        component = self.context.get('component')
        pid = find_product_id({"branches": prod_tree}, component.other_component, {'version_value': component.other_component_version})
        if (pid):
            return pid
        return ""
    

class CSAFProductTreeVendorSerializer(serializers.ModelSerializer):
    category = serializers.ReadOnlyField(default='vendor')
    name = serializers.SerializerMethodField()
    branches = serializers.SerializerMethodField()

    class Meta:
        model = ComponentStatus
        fields = ('category', 'name', 'branches',)

    def get_name(self, obj):
        vendor = self.context.get('vendor')
        return vendor.name


    def get_branches(self, obj):
        vuls = self.context.get('vuls')
        vendor = self.context.get('vendor')
        #get a list of all the products for this vendor
        #components = ComponentStatus.objects.filter(vul__in=vuls, component__product_info__supplier__id=obj.component.product_info.supplier.id).distinct('component__name').order_by('component__name')
        components = ComponentStatus.objects.filter(vul__in=vuls, component__product_info__supplier__id=vendor.id).order_by('component__name').distinct('component__name').values_list('component__name', flat=True)

        other_components = ComponentStatus.objects.filter(vul__in=vuls, other_component__product_info__supplier__id=vendor.id).exclude(other_component__name__in=components).order_by('other_component__name').distinct('other_component__name').values_list('other_component__name', flat=True)

        all_component_names = list(components) + list(other_components)

        data = []
        count = self.context.get('count')
        for compname in all_component_names:
            comps = ComponentStatus.objects.filter(vul__in=vuls).filter(Q(component__product_info__supplier__id=vendor.id)|Q(other_component__product_info__supplier__id=vendor.id)).filter(Q(component__name=compname)| Q(other_component__name=compname))
            for c in comps:
                app_rev = c.approved_revision()
                if app_rev:
                    d = CSAFProductTreeNameSerializer(c, context={'count': count, 'vuls': vuls, 'name': compname})
                    data.append(d.data)
                    if d.data.get('branches'):
                        count = count + len(d.data.get('branches'))
                    else:
                        count = count + 1
        return data


class CSAFScoreSerializer(serializers.ModelSerializer):
    baseScore = serializers.SerializerMethodField()
    baseSeverity = serializers.SerializerMethodField()
    version = serializers.ReadOnlyField(default='3.1')

    class Meta:
        model = VulCVSS
        fields = ('baseScore', 'baseSeverity', 'vectorString', 'version')

    def get_baseScore(self, obj):
        return float(obj.score)

    def get_baseSeverity(self, obj):
        if obj.severity:
            return obj.severity.upper()
        else:
            return "Unknown"

class CSAFRemediationSerializer(serializers.ModelSerializer):
    category = serializers.SerializerMethodField()
    details = serializers.SerializerMethodField()
    date = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    product_ids = serializers.SerializerMethodField()

    class Meta:
        model = ComponentStatus
        fields = ('category', 'details', 'url', 'product_ids', 'date')

    def get_fields(self):
        fields = super().get_fields()
        url = self.instance.get('remediation_url')

        if not url or url == '':
            fields.pop('url')
        date = self.instance.get('remediation_date')
        if not date or date == "":
            fields.pop('date')

        return fields

    def get_date(self, obj):
        if obj.get('remediation_date'):
            try:
                #try to put this in the desired format
                new_time = make_aware(datetime.strptime(obj.get('remediation_date'), '%Y-%m-%dT%H:%M:%S.%fZ'))
                return new_time.strftime("%Y-%m-%dT%H:%M:%SZ")
            except ValueError:
                new_time = make_aware(datetime.strptime(obj.get('remediation_date'), '%Y-%m-%d'))
                return new_time.strftime("%Y-%m-%dT%H:%M:%SZ")
            except:
                logger.debug(traceback.format_exc())
                return obj.get('remediation_date')
        else:
            #this shouldn't happen
            return ""

    def get_url(self, obj):
        return obj.get('remediation_url')

    def get_category(self, obj):
        return obj.get('remediation_category')

    def get_details(self, obj):
        return obj.get('remediation_detail')

    def get_product_ids(self, obj):
        product_ids = self.context.get('product')
        return product_ids


def find_complex_product_id(prod_tree, component, version, other_component, other_version, relationship):

    if (version.get('version_range')):
        vers = get_verslike_range(version.get('version_value'), version.get('version_range'), version.get('version_end_range'))
        prod_name = f"{component.product_info.supplier.name} {component.name} {vers}"
    else:
        if (version['version_value'] == "*"):
            prod_name = f"{component.product_info.supplier.name} {component.name} vers:all/*"
        else:
            prod_name = f"{component.product_info.supplier.name} {component.name} {version['version_value']}"

    if component.product_info.supplier.name != other_component.product_info.supplier.name:
        full_product_name = f"{prod_name} {relationship} {other_component.product_info.supplier.name} {other_component.name}"
    else:
        full_product_name = f"{prod_name} {relationship} {other_component.name}"
        
    if other_version:
        full_product_name = f"{full_product_name} {other_version}"

    for b in prod_tree.get('relationships'):
        if b['full_product_name']['name'] == full_product_name:
            return b['full_product_name']['product_id']
    return ""

    
def find_product_id(prod_tree, component, version):
    for b in prod_tree.get('branches'):
        if b['name'] == component.product_info.supplier.name:
            if b.get('branches'):
                for branch in b['branches']:
                    #find product id
                    if branch['name'] == component.name:
                        if branch.get('branches'):
                            for v in branch.get('branches', []):
                                if (version.get('version_range')):
                                    vers = get_verslike_range(version.get('version_value'), version.get('version_range'), version.get('version_end_range'))
                                    prod_name = f"{component.product_info.supplier.name} {component.name} {vers}"
                                else:
                                    if (version['version_value'] == "*"):
                                        prod_name = f"{component.product_info.supplier.name} {component.name} vers:all/*"
                                    else:
                                        prod_name = f"{component.product_info.supplier.name} {component.name} {version['version_value']}"

                                if v['product']['name'] == prod_name:
                                    prod = v['product']['product_id']
                                    return prod
                        elif branch.get('product'):
                            return branch['product']['product_id']

    return ""



def get_relationships(vuls, count, branches):
    status_with_relationships = ComponentStatus.objects.filter(vul__in=vuls, other_component__isnull=False)
    data = []
    for x in status_with_relationships:

        app_rev = x.approved_revision()
        if app_rev:
            for p in app_rev.version_status:
                fr = CSAFProductRelationshipSerializer(p, context={"count": count, "prod_tree": branches, "component": x})
                data.append(fr.data)
                count += 1
    return data






class CSAFVulnerabilitySerializer(serializers.ModelSerializer):
    cve = serializers.SerializerMethodField()
    cwe = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    product_status = serializers.SerializerMethodField()
    flags = serializers.SerializerMethodField()
    references = serializers.SerializerMethodField()
    scores = serializers.SerializerMethodField()
    remediations = serializers.SerializerMethodField()
    acknowledgments = serializers.SerializerMethodField()
    release_date = serializers.SerializerMethodField()

    class Meta:
        model = Vulnerability
        fields = ('cve', 'cwe', 'notes', 'title', 'product_status', 'flags', 'references', 'scores', 'remediations', 'acknowledgments', 'release_date')

    def get_title(self, obj):
        if obj.title:
            return obj.title
        else:
            return obj.description

    def get_fields(self):
        #pop flags field if vul doesn't hve any not affected components
        fields = super().get_fields()

        if not self.instance.problem_types:
            fields.pop('cwe')
        if not self.instance.references:
            fields.pop('references')
        if not self.instance.acknowledgments:
            fields.pop('acknowledgments')
        if not self.instance.date_public:
            fields.pop('release_date')

        if not self.instance.cvss.filter(version="3.1").exists():
            fields.pop('scores')

        status = ComponentStatus.objects.filter(vul=self.instance).exclude(component__product_info__supplier__isnull=True)
        for item in status:
            app_status = item.approved_revision()
            if app_status:
                for version in app_status.version_status:
                    if version['status'] == "Not Affected":
                        return fields

        fields.pop('flags')


        return fields

    def get_cve(self, obj):
        #this returns CVE-{obj.cve}
        return obj.vul

    def get_cwe(self, obj):
        #CSAF only allows 1 for some reason
        if obj.problem_types:
            for cwe in obj.problem_types:
                m = re.search(r"(CWE-\d{1,7})", cwe)
                if m:
                    cwe_match = m.group(1)
                    item = cwe.split(" ", 1)
                    if len(item) > 1:
                        #attempt to remove CWE-ID to get just the description
                        return {'id': cwe_match,
                                'name': item[1]}
                    else:
                        return {'id': cwe_match,
                                'name': cwe}

        return {}

    def get_notes(self, obj):
        notes = []
        notes.append({'category': 'summary', 'text': obj.description, 'title': "Description"})
        try:
            if obj.vulssvc:
                ssvc_dict = dict((x['label'], x['value']) for x in obj.vulssvc.decision_tree)
                ssvc_time = obj.vulssvc.last_edit.strftime("%Y-%m-%dT%H:%M:%SZ")
                vector = f"SSVCv2/E:{ssvc_dict['Exploitation'][0].upper()}/A:{ssvc_dict['Automatable'][0].upper()}/T:{ssvc_dict['Technical Impact'][0].upper()}/{ssvc_time}/"
                notes.append({'category': 'details', 'title': 'SSVC', 'text': vector})
        except VulSSVC.DoesNotExist:

            pass
        except:
            logger.debug("Decision tree is incomplete")
            logger.debug(traceback.format_exc())
            pass


        #add vendor statements - TODO need approval process!
        status = ComponentStatus.objects.filter(vul=obj).exclude(component__product_info__supplier__isnull=True)
        for item in status:
            app_status = item.approved_revision()
            if app_status and app_status.statement:
                try:
                    notes.append({'category': 'description', 'text': item.current_revision.statement, 'title':f"Vendor statement from {item.component.product_info.supplier.name}"})
                except:
                    pass

        return notes

    def get_product_status(self, obj):
        prod_tree = self.context.get('prod_tree')
        products = {'known_affected': [], 'fixed': [], 'under_investigation': [], 'known_not_affected': []}

        ret = {}
        status = ComponentStatus.objects.filter(vul=obj).exclude(component__product_info__supplier__isnull=True)

        for item in status:
            app_status = item.approved_revision()
            if app_status:
                for version in app_status.version_status:
                   lstatus = version["status"].lower().replace(" ", "_");
                   prod = None

                   if item.other_component:
                       prod = find_complex_product_id(prod_tree, item.component, version, item.other_component, item.other_component_version, item.relationship)
                   else:
                       prod = find_product_id(prod_tree, item.component, version)

                   if not prod:
                       logger.warning(prod_tree.get('branches'))
                       logger.warning(f"Can't find match for {item.component.name} {version['version_value']}")
                   if lstatus == "affected":
                       if prod not in products["known_affected"]:
                           products["known_affected"].append(prod)

                   elif lstatus == "not_affected":
                       if prod not in products["known_not_affected"]:
                           products["known_not_affected"].append(prod)
                   elif lstatus == "unknown":
                       if prod not in products["under_investigation"]:
                           products["under_investigation"].append(prod)
                   else:
                       if prod not in products[lstatus]:
                           products[lstatus].append(prod)

            for key, val in products.items():
                if val:
                    ret[key] = val

        return ret

    def get_flags(self, obj):
        #get unaffected products
        ret = {}
        prod_tree = self.context.get('prod_tree')
        status = ComponentStatus.objects.filter(vul=obj).exclude(component__product_info__supplier__isnull=True)

        for item in status:
            app_status = item.approved_revision()
            if app_status:
                for version in app_status.version_status:
                    if version["status"] == "Not Affected":
                        prod_name = find_product_id(prod_tree, item.component, version)
                        just = version.get("justification", "").lower().replace(" ", "_")
                        if just in ret:
                            ret[just].append(prod_name)
                        else:
                            ret[just] = [prod_name]

        flags = []
        if len(ret) == 0:
            self.fields.pop("flags")
            return

        for x,y in ret.items():
            flags.append({'label': x, 'product_ids': y})
        return flags

    def get_references(self, obj):
        refs = []
        if obj.references:
            for x in obj.references:
                summary = x.get("summary", "")
                if not summary or summary == "":
                    summary = urlparse(x["url"]).netloc
                refs.append({'category': 'external', 'summary': summary, 'url': x["url"]})
        return refs

    def get_acknowledgments(self, obj):
        newacks = []
        # the schema changed for this in 1/25 so we need to figure out what
        # format the data is in and handle it appropriately
        for x in obj.acknowledgments:
            if (isinstance(x, str)):
                return [{"names": obj.acknowledgments}]
            else:
                ack = {}
                if x.get('organization'):
                    ack['organization'] = x["organization"]
                if x["names"].split():
                    ack["names"] = x["names"].split(",")
                newacks.append(ack)

        return newacks

    def get_scores(self, obj):
        prods = self.get_product_status(obj)
        #prioritize 3.1 scores for now
        first_cvss = obj.cvss.filter(version='3.1').first()
        if not first_cvss:
            first_cvss = obj.cvss.all().first()
        score = CSAFScoreSerializer(first_cvss)

        if prods.get('known_affected'):
            affected_prods = prods['known_affected']
        else:
            affected_prods = []
            for key,val in prods.items():
                affected_prods.extend(val)

        if first_cvss.version == "3.1":
            return [{"cvss_v3": score.data, "products": affected_prods}]
        else:
            return [{"cvss_v4": score.data, "products": affected_prods}]

    def get_release_date(self, obj):
        if obj.date_public:
            release_date = timezone.make_aware(datetime.combine(obj.date_public, time.min))
            return release_date.strftime("%Y-%m-%dT%H:%M:%SZ")
        else:
            return ""

    def get_remediations(self, obj):

        prod_tree = self.context.get('prod_tree')
        status = ComponentStatus.objects.filter(vul=obj).exclude(component__product_info__supplier__isnull=True)
        remediations = []
        for item in status:
            app_status = item.approved_revision()
            if app_status:
                for version in app_status.version_status:
                    if version.get('remediation_detail'):

                        if item.other_component:
                            prod = find_complex_product_id(prod_tree, item.component, version, item.other_component, item.other_component_version, item.relationship)
                        else:
                            prod = find_product_id(prod_tree, item.component, version)

                        data = CSAFRemediationSerializer(version, context={'product': [prod]})
                        remediations.append(data.data)

        return remediations

class CSAFAdvisorySerializer(serializers.ModelSerializer):
    document = serializers.SerializerMethodField()
    product_tree = serializers.SerializerMethodField()
    vulnerabilities = serializers.SerializerMethodField()

    class Meta:
        model = Case
        fields = ('document', 'product_tree', 'vulnerabilities', )
        depth = 1


    def get_document(self, obj):
        data = CSAFDocumentSerializer(obj.caseadvisory.current_revision)
        return data.data

    def get_product_tree(self, obj):
        vuls = Vulnerability.objects.filter(case=obj, deleted=False, publish=True).values_list('id', flat=True)
        status = ComponentStatus.objects.filter(vul__in=vuls, component__parent=True).exclude(component__product_info__supplier__isnull=True)
        other_components = status.filter(other_component__isnull=False).values_list('other_component__id', flat=True)
        #add_components = Component.objects.filter(id__in=other_components)
        #sort by vendor
        vendorsort = []
        data = []
        count = 1
        for s in status:
            app_status = s.approved_revision()
            if app_status:
                if app_status.component_status.component.product_info.supplier.name not in vendorsort:
                    vendorsort.append(app_status.component_status.component.product_info.supplier.name)
                    #data = CSAFProductTreeVendorSerializer(status, many=True, context={'vuls': vuls})
                    d = CSAFProductTreeVendorSerializer(s, context={'vuls': vuls, 'count': count, "vendor": app_status.component_status.component.product_info.supplier})
                    data.append(d.data)
                    for b in d.data.get('branches'):
                        if b.get('branches'):
                            count = count + len(b.get('branches'))
                        else:
                            count += 1
        
        #loop through again to make sure we got all vendors
        for s in status:
            app_status = s.approved_revision()
            if app_status and s.other_component:
                if s.other_component.product_info.supplier.name not in vendorsort:
                    vendorsort.append(s.other_component.product_info.supplier.name)
                    od = CSAFProductTreeVendorSerializer(s, context={'count': count, 'vuls': vuls, "vendor": s.other_component.product_info.supplier})
                    data.append(od.data)
                    for b in od.data.get('branches'):
                        if b.get('branches'):
                            count = count + len(b.get('branches'))
                        else:
                            count += 1
        

        relationships = get_relationships(vuls, count, data)
        if relationships:
            return {'branches' : data, 'relationships': relationships}
        else:
            return {'branches': data}

    def get_vulnerabilities(self, obj):
        c = self.get_product_tree(obj)
        vuls = Vulnerability.objects.filter(case=obj, deleted=False, publish=True)
        data = []
        # can't use many here because we need to pop the "flags" field on an individual basis
        for v in vuls:
            #if nothing is affected, pass
            vulstatus = ComponentStatus.objects.filter(vul=v).values_list('id', flat=True)
            if vulstatus:
                #make sure something is approved!
                if StatusRevision.objects.filter(component_status__id__in=vulstatus, approved=True).exists():
                    d = CSAFVulnerabilitySerializer(v, context={'prod_tree': c})
                    data.append(d.data)
            #data = CSAFVulnerabilitySerializer(vuls, many=True)
        return data


class CaseChangeSerializer(serializers.ModelSerializer):

    class Meta:
        model = CaseChange
        fields = ['field', 'old_value', 'new_value']




class CaseActionSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    change = serializers.SerializerMethodField()

    class Meta:
        model = CaseAction
        fields = ['user', 'title', 'created', 'url', 'change',]

    def get_user(self, obj):
        if obj.user:
            user = UserSerializer(obj.user)
            return user.data
        system = SystemSerializer(obj)
        return system.data

    def get_url(self, obj):
        return reverse("cvdp:case", args=[obj.case.case_id])

    def get_change(self, obj):
        changes = obj.casechange_set.all()

        if (changes):
            data = CaseChangeSerializer(changes, many=True)
            return data.data

        elif obj.post:
            if (obj.post.revision_number > 0):
                old_rev = PostRevision.objects.filter(id=obj.post.previous_revision_id).first()
                content = post_serializer(obj.post.json_content)
                if not content:
                    content = obj.post.content
                old_content = post_serializer(old_rev.json_content)
                if not old_content:
                    old_content = old_rev.content
                return [{'field': 'post', 'old_value': old_content, 'new_value': content}]
            else:
                content = post_serializer(obj.post.json_content)

                if not content:
                    content = obj.post.content
                    return [{'field': 'post', 'old_value': '', 'new_value': content}]
                return [{'field': 'post', 'old_value': '', 'new_value': content}]
        return []

class PostLikeSerializer(serializers.ModelSerializer):

    class Meta:
        model = PostLikes
        fields = ('reaction', )

class PostActionSerializer(serializers.ModelSerializer):
    #user = UserSerializer(source='post.author.user')
    user = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    change = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()

    class Meta:
        model = PostRevision
        fields = ['user', 'title', 'created', 'url', 'change',]

    def get_user(self, obj):
        if obj.post.author:
            user_serializer = UserSerializer(obj.post.author.user)
            return user_serializer.data
        #return obj.post.author.user
        else:
            return {"name": obj.post.author_text}

    def get_url(self, obj):
        return reverse("cvdp:case", args=[obj.post.thread.case.case_id])

    def get_change(self, obj):
        if (obj.revision_number > 0):
            old_rev = PostRevision.objects.filter(id=obj.previous_revision_id).first()
            content = post_serializer(obj.json_content)
            if not content:
                content = obj.content
            old_content = post_serializer(old_rev.json_content)
            if not old_content:
                old_content = old_rev.content
            return [{'field': 'post', 'old_value': old_content, 'new_value': content}]
        else:
            content = post_serializer(obj.json_content)
            if not content:
                content = obj.content
            return [{'field': 'post', 'old_value': '', 'new_value': content}]


    def get_title(self, obj):
        if (obj.revision_number > 0):
            return "modified post"
        elif PostReply.objects.filter(post=obj.post).exists():
            return "replied to post"
        else:
            return "added post"

class AdvisoryActionSerializer(serializers.ModelSerializer):
    user = UserSerializer()
    url = serializers.SerializerMethodField()
    change = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()

    class Meta:
        model = PostRevision
        fields = ['user', 'title', 'created', 'url', 'change',]

    def get_url(self, obj):
        return reverse("cvdp:case", args=[obj.advisory.case.case_id])

    def get_change(self, obj):
        return []

    def get_title(self, obj):
        if (obj.revision_number > 0):
            return "modified case advisory"
        else:
            return "created case advisory"


class CaseTransferSerializer(serializers.ModelSerializer):

    action = CaseActionSerializer(read_only=True)
    group = serializers.CharField(source='connection.group.name', read_only=True)
    case = serializers.CharField(source='action.case.case_id')

    class Meta:
        model = CaseTransfer
        fields = ['id', 'connection', 'case', 'group', 'transfer_reason', 'remote_case_id', 'accepted', 'action', 'data_transferred']


class CaseStateSerializer(serializers.ModelSerializer):

    children = serializers.SerializerMethodField()

    class Meta:
        model = CaseState
        fields = ['name', 'description', 'children', 'color']

    def get_children(self, obj):
        children = CaseState.objects.filter(parent=obj.code).order_by('order')
        serializer = CaseStateSerializer(children, many=True)
        return serializer.data



class CaseApprovalSerializer(serializers.ModelSerializer):

    case = CaseSummarySerializer(required=False)
    vulnerability = BasicVulSerializer(required=False, read_only=True)
    user = UserSerializer(read_only=True)
    completed_by = UserSerializer(read_only=True)
    can_approve = serializers.SerializerMethodField()
    status = ChoiceField(CaseApproval.APPROVAL_STATUS_CHOICES, required=False)

    class Meta:
        model = CaseApproval
        fields = ('id', 'case', 'created', 'user', 'status', 'request', 'completed', 'completed_by', 'vulnerability', 'advisory_version', 'can_approve', 'approval_comments', 'request_comments')

    def get_can_approve(self, obj):
        user = self.context.get('user')
        if user:
            return can_approve_case(obj.case, user)

        return False

class CaseMilestoneSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    state = serializers.CharField(source='state.name')

    class Meta:
        model = CaseAction
        fields = ('user', 'state', 'created')

    def get_user(self, obj):
        if obj.user:
            return obj.user.screen_name
        return "System"


class TriageMetaSerializer(serializers.Serializer):
    teams = GroupSerializer(many=True)
    lead = serializers.CharField()

class CaseMetadataSerializer(serializers.Serializer):

    users = UserSerializer(many=True)
    status = serializers.ListField(
        child=StatusSerializer()
    )
    teams = GroupSerializer(many=True)
    roles = serializers.ListField(
        child=serializers.CharField()
    )
    states = CaseStateSerializer(many=True)
    resolutions = ResolutionSerializer(many=True)
    approvals = CaseApprovalSerializer(many=True)
    custom_report = serializers.BooleanField()
    unread = serializers.IntegerField(default = 0)
    unapproved = serializers.IntegerField(default = 0)
    milestones = CaseMilestoneSerializer(many=True)


class CaseMetricsStateSerializer(serializers.Serializer):
    state = serializers.CharField()
    count = serializers.IntegerField(source='c')

class CaseMetricsStatusSerializer(serializers.Serializer):
    status = serializers.SerializerMethodField()
    count = serializers.IntegerField(source='c')

    def get_status(self, obj):
        return dict(Case.STATUS_CHOICES).get(obj["status"])

class CaseMetricsTeamSerializer(serializers.Serializer):
    count = serializers.IntegerField(source='c')
    team = serializers.CharField(source='group__name')

class CaseMetricsTagSerializer(serializers.Serializer):
    count = serializers.IntegerField(source='c')
    tag = serializers.CharField()


class CaseMetricsUserSerializer(serializers.Serializer):
    count = serializers.IntegerField(source='c')
    user = serializers.CharField(source='contact__user__screen_name')
    uuid = serializers.CharField(source='contact__uuid')

class TeamCaseMetricsSerializer(serializers.Serializer):
    team_name = serializers.CharField()
    cases_by_status = CaseMetricsStatusSerializer(many=True)
    cases_by_state = CaseMetricsStateSerializer(many=True)
    cases_per_user = CaseMetricsUserSerializer(many=True)
    team_cases_by_tag = CaseMetricsTagSerializer(many=True)
    cases_started = serializers.IntegerField()
    cases_triaged = serializers.IntegerField()
    vendors_notified = serializers.IntegerField()
    cases_published = serializers.IntegerField()

class CaseMetricsPerDaySerializer(serializers.Serializer):
    day = serializers.CharField()
    count = serializers.IntegerField(source='c')

class CaseMetricsSerializer(serializers.Serializer):
    teams = GroupSerializer(many=True)
    lead = serializers.IntegerField()
    states = CaseStateSerializer(many=True)
    cases_per_team = CaseMetricsTeamSerializer(many=True)
    cases_by_state = CaseMetricsStateSerializer(many=True)
    team_metrics = TeamCaseMetricsSerializer(many=True)
    all_cases_by_tag = CaseMetricsTagSerializer(many=True)
    groups_added_per_day = CaseMetricsPerDaySerializer(many=True)
    users_added_per_day = CaseMetricsPerDaySerializer(many=True)
    groups_added = serializers.IntegerField()
    users_added = serializers.IntegerField()

class UserCaseMetricsSerializer(serializers.Serializer):
    cases = CaseSummarySerializer(many=True)
    cases_by_state = CaseMetricsStateSerializer(many=True)
