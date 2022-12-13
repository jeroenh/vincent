from cvdp.models import MessageThread, Message, UserThread
from rest_framework import serializers
from django.contrib.auth.models import Group
from django.urls import reverse
from authapp.models import User
from cvdp.serializers import ChoiceField, UserSerializer
from cvdp.cases.serializers import ContentSerializerField
from cvdp.permissions import is_coordinator
from cvdp.groups.serializers import GroupLogoSerializer


class MessageSerializer(serializers.ModelSerializer):

    sender = UserSerializer()
    content = ContentSerializerField()
    groups = serializers.SerializerMethodField()
    
    class Meta:
        model = Message
        fields = ('id', 'created', 'sender', 'content', 'groups')

    def get_groups(self, obj):
        #get groups in this thread
        thread_groups = obj.thread.groups.values_list('id', flat=True)
        if thread_groups:
            if is_coordinator(obj.sender) and self.context.get('coordinator'):
                return [self.context.get('coordinator')]
            sender_groups = list(obj.sender.groups.filter(id__in=thread_groups).values_list('name', flat=True))
            return sender_groups
        elif (obj.thread.is_user_member(obj.sender)):
            return []
        return []

class ThreadSerializer(serializers.ModelSerializer):

    last_message = serializers.SerializerMethodField()
    unread = serializers.SerializerMethodField()
    users = UserSerializer(many=True)
    groups = serializers.SerializerMethodField()
    message_count = serializers.SerializerMethodField()
    
    class Meta:
        model = MessageThread
        fields = ('id', 'subject', 'users', 'groups', 'message_count', 'last_message', 'unread')

    def get_message_count(self, obj):
        return obj.messages.count()

    def get_groups(self, obj):
        if self.context.get('coordinator'):
            if obj.groups:
                return [{'name': self.context.get('coordinator'), 'logocolor': self.context['owner'].groupprofile.icon_color, 'photo': self.context['owner'].groupprofile.get_logo()}]
            else:
                return []
        serializer = GroupLogoSerializer(obj.groups, many=True)
        return serializer.data

    def get_unread(self, obj):
        group = self.context.get('group')
        if group:
            return bool(obj.groupthread_set.filter(group=group, unread=True))
        user = self.context.get('user')
        return bool(obj.userthread_set.filter(user=user, unread=True))

    def get_last_message(self, obj):
        message = obj.latest_message
        serializer = MessageSerializer(message)
        return serializer.data
