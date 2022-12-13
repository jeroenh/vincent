from rest_framework import serializers
from authapp.models import User
from django.core.exceptions import ObjectDoesNotExist
from cvdp.models import TriageCalendarEvent, BounceEmailNotification


class DynamicFieldsModelSerializer(serializers.ModelSerializer):
    """
    A ModelSerializer that takes an additional `fields` argument that
    controls which fields should be displayed.
    """

    def __init__(self, *args, **kwargs):
        # Don't pass the 'fields' arg up to the superclass
        fields = kwargs.pop('fields', None)

        # Instantiate the superclass normally
        super().__init__(*args, **kwargs)

        if fields is not None:
            #remove any fields provided
            not_allowed = set(fields)
            existing = set(self.fields)
            for field_name in not_allowed:
                self.fields.pop(field_name)


class BounceEmailSerializer(serializers.Serializer):
    content = serializers.CharField()


class ChoiceField(serializers.ChoiceField):

    def to_representation(self, obj):
        if obj == '' and self.allow_blank:
            return obj
        return self._choices[obj]

    def to_internal_value(self, data):
        # To support inserts with the value
        if data == '' and self.allow_blank:
            return ''

        for key, val in self._choices.items():
            if val == data:
                return key
        self.fail('invalid_choice', input=data)


class SystemSerializer(serializers.Serializer):
    name = serializers.ReadOnlyField(default='VINCE-NT')
    logocolor = serializers.ReadOnlyField(default=None)
    photo = serializers.ReadOnlyField(default=None)
    contact = serializers.ReadOnlyField(default=None)
    uuid = serializers.ReadOnlyField(default=None)
                                      


class BasicUserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    uuid = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields  = ('uuid', 'name')

    def get_name(self, obj):
        if obj.screen_name:
            return obj.screen_name
        else:
            return obj.get_full_name()
        
    def get_uuid(self, obj):
        try:
            return str(obj.contact.uuid)
        except ObjectDoesNotExist:
            return None
           
    
class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    logocolor = serializers.CharField(source='userprofile.logocolor')
    photo = serializers.ImageField(source='userprofile.photo')
    uuid = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('name', 'org', 'photo', 'logocolor', 'title', 'uuid')

    def get_name(self, obj):
        if obj.screen_name:
            return obj.screen_name
        else:
            return obj.get_full_name()
        
    def get_uuid(self, obj):
        try:
            return str(obj.contact.uuid)
        except ObjectDoesNotExist:
            return None
        

class GenericSerializer(serializers.Serializer):
    type = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    case_id = serializers.SerializerMethodField()
    modified = serializers.SerializerMethodField()

    def get_modified(self, obj):
        try:
            if obj.modified:
                return obj.modified
        except:
            pass

        try:
            if obj.groupprofile.modified:
                return obj.groupprofile.modified
        except:
            pass
        return obj.created
    

    def get_type(self, obj):
        return str(type(obj))

    def get_url(self, obj):
        return obj.get_absolute_url()

    def get_case_id(self, obj):
        try:
            if obj.case:
                return obj.case.caseid
        except:
            pass

        return ''

    def get_title(self, obj):
        try:
            if obj.full_title:
                return obj.full_title
        except:
            pass
        
        try:
            if obj.title:
                return obj.title
        except:
            pass
        try:
            if obj.name:
                return obj.name
            if obj.email:
                return obj.email
        except:
            pass
        try:
            if obj.group.name:
                return obj.group.name
        except:
            pass

        try:
            if obj.vul:
                return obj.vul
        except:
            return "?"
        

class CoordGenericSerializer(GenericSerializer):
    tags = serializers.SerializerMethodField()

    def get_tags(self, obj):
        try:
            return list(obj.tags.values_list('tag', flat=True))
        except:
            pass

        try:
            return list(obj.vulnerabilitytag_set.values_list('tag', flat=True))
        except:
            pass

        try:
            return list(obj.grouptag_set.values_list('tag', flat=True))
        except:
            pass
        return []
    
        

