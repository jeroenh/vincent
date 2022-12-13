from cvdp.models import *
from cvdp.serializers import UserSerializer
from django.core.exceptions import ObjectDoesNotExist
from cvdp.groups.serializers import GroupSerializer
from cvdp.serializers import ChoiceField
from rest_framework import serializers
from django.contrib.auth.models import Group
from django.urls import reverse
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class EmailAttachmentSerializer(serializers.ModelSerializer):

    filename = serializers.CharField(source='file.filename')
    mime_type = serializers.CharField(source='file.mime_type')
    size = serializers.CharField(source='file.size')
    url = serializers.SerializerMethodField()
    
    class Meta:
        model = EmailAttachment
        fields = ('filename', 'mime_type', 'size', 'url')

    def get_url(self, obj):
        return reverse("cvdp:artifact", args=[obj.file.uuid])


class EmailSerializer(serializers.Serializer):

    content = serializers.CharField()


class TicketThreadSerializer(serializers.ModelSerializer):

    last_email = serializers.SerializerMethodField()
    
    class Meta:
        model = EmailThread
        fields = ('id', 'topic', 'emails', 'last_email')

    def get_last_email(self, obj):
        email = obj.latest_message
        serializer = EmailTicketSerializer(email)
        return serializer.data


class TicketSerializer(serializers.ModelSerializer):

    assigned_to = UserSerializer()
    case = serializers.SerializerMethodField()
    label = serializers.CharField(source='thread.label')
    status = ChoiceField(Ticket.STATUS_CHOICES)
    team = GroupSerializer(read_only=True)
    msg_thread = serializers.SerializerMethodField()
    
    class Meta:
        model = Ticket
        fields = ('id', 'title', 'content', 'created', 'modified', 'submitted_by', 'assigned_to', 'status', 'case', 'label', 'msg_thread', 'team')

    def get_msg_thread(self, obj):
        try:
            return obj.msg_thread.id
        except:
            return ""
        
    def get_case(self, obj):
        try:
            return obj.thread.case.caseid
        except ObjectDoesNotExist:
            return ""
        except AttributeError:
            return ""


class TicketActivitySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    url = serializers.SerializerMethodField()
    title = serializers.CharField(required=False)
    
    class Meta:
        model = TicketAction
        fields = ['user', 'title', 'created', 'url', 'comment',]

    def get_url(self, obj):
        if (obj.ticket.thread.case):
            return reverse("cvdp:case", args=[obj.ticket.thread.case.case_id])
        else:
            return ""

        
class EmailTicketSerializer(TicketSerializer):

    topic = serializers.CharField(source='email_thread.topic')
    attachments = serializers.SerializerMethodField()
    
    class Meta:
        model = EmailTicket
        fields = TicketSerializer.Meta.fields + ('topic', 'message_id', 'sent_to', 'attachments')


    def get_attachments(self, obj):
        attachments = obj.emailattachment_set.all()
        s = EmailAttachmentSerializer(attachments, many=True)
        return s.data
        
class CaseNoteSerializer(serializers.ModelSerializer):

    user = UserSerializer(read_only=True)

    class Meta:
        model = CaseNote
        fields = ('id', 'created', 'modified', 'user', 'content', 'flagged', 'archived')
        read_only_fields = ('user', 'id', 'created', 'modified')
    
