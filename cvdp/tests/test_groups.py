import json
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from django.test import TestCase, Client, modify_settings
from django.urls import reverse, reverse_lazy
from django.utils import timezone
from cvdp.models import *
from cvdp.manage.models import DefinedTag
from cvdp.components.models import *
from cvdp.components.serializers import *
from django.contrib.auth.models import Group
from authapp.models import APIToken, User
from cvdp.groups.serializers import *
from cvdp.cases.serializers import *
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
#test group/contact endpoints

class GroupTests(TestCase):

    def setUp(self):
        self.api_client = APIClient()
        self.coord_user = User.objects.create(email='coordinator', password='Pas$w0rd', screen_name="coordinator", is_coordinator=True)

        coord_group = Group.objects.create(name='coordinator')
        coord_group.user_set.add(self.coord_user)

        self.reporter_user = User.objects.create(email='reporter', password='Pas$w0rd', screen_name="reporter")
        self.vendor_user = User.objects.create(email='vendor', password='Pas$w0rd', screen_name="vendor")
        contact = Contact.objects.filter(user=self.vendor_user).first()
        self.group = Group.objects.create(name='vendor')
        GroupProfile.objects.create(group=self.group)
        self.group.user_set.add(self.vendor_user)
        ContactAssociation.objects.create(contact=contact, group=self.group,
                                          added_by=self.coord_user)

    def test_api_add_coord_team(self):
        self.api_client.force_authenticate(user=self.coord_user)
        valid_payload = {
            'group': self.group.groupprofile.uuid
	}
        response = self.api_client.post(
            reverse('cvdp:coord_team_api'),
            data=valid_payload,
            content_type='application/json')
        #must be superuser to add
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_api_add_coord_team_superuser(self):
        self.coord_user.is_superuser = True
        self.coord_user.save()

        self.api_client.force_authenticate(user=self.coord_user)
        valid_payload = {
            'group': str(self.group.groupprofile.uuid)
	}
        logger.debug(self.group.groupprofile.uuid)
        response = self.api_client.post(
            reverse('cvdp:coord_team_api'),
            data=json.dumps(valid_payload),
            content_type='application/json')
        #must be superuser to add
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)


        response = self.api_client.delete(
            reverse('cvdp:rm_coord_team', args=[self.group.groupprofile.uuid]))

        #must be superuser to rm
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_api_rm_coord_team(self):
        self.api_client.force_authenticate(user=self.coord_user)

        response = self.api_client.delete(
            reverse('cvdp:rm_coord_team', args=[self.group.groupprofile.uuid]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
    def test_api_get_coordinators(self):
        self.api_client.force_authenticate(user=self.coord_user)

        response = self.api_client.get(
            reverse('cvdp:coord_team_api'))

        groups = GroupProfile.objects.filter(vendor_type='Coordinator')
        serializer = GroupProfileSerializer(groups, many=True)

        self.assertEqual(response.data, serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_coordinator_get_groups(self):

        self.api_client.force_authenticate(user=self.coord_user)

        response = self.api_client.get(
            reverse('cvdp:group_api'))

        groups = GroupProfile.objects.all()
        serializer = GroupProfileSerializer(groups, many=True)

        self.assertEqual(response.data, serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unauthed_get_groups(self):
        response = self.api_client.get(
            reverse('cvdp:group_api'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_vendor_get_groups(self):
        self.api_client.force_authenticate(user=self.vendor_user)

        response = self.api_client.get(
            reverse('cvdp:group_api'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_coord_create_group(self):
        self.api_client.force_authenticate(user=self.coord_user)
        valid_payload = {
            'name': 'some vendor',
            'vendor_type': 'Coordinator'
        }
        response = self.api_client.post(
            reverse('cvdp:group_api'),
            data=json.dumps(valid_payload),
            content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_coord_invalid_create_group(self):
        self.api_client.force_authenticate(user=self.coord_user)
        invalid_payload = {
            'name': 'vendor',
            'vendor_type': 'coordinator'
        }
        response = self.api_client.post(
            reverse('cvdp:group_api'),
            data=json.dumps(invalid_payload),
            content_type='application/json')

        #name already exists
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_coord_update_group(self):
        self.api_client.force_authenticate(user=self.coord_user)
        group = Group.objects.get(name='vendor')
        valid_payload = {
            'vendor_type': 'Coordinator'
        }
        response = self.api_client.patch(
            reverse('cvdp:groupdetailapi', args=[group.groupprofile.uuid]),
            data=json.dumps(valid_payload),
            content_type='application/json')

        #user must be superuser or user_admin to change vendor_type
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        
    def test_vendor_create_group(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        valid_payload = {
            'name': 'some vendor',
            'vendor_type': 'Coordinator'
        }
        response = self.api_client.post(
            reverse('cvdp:group_api'),
            data=json.dumps(valid_payload),
            content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_vendor_update_group(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        group = Group.objects.get(name='vendor')
        valid_payload = {
            'vendor_type': 'Coordinator'
        }
        response = self.api_client.patch(
            reverse('cvdp:groupdetailapi', args=[group.groupprofile.uuid]),
            data=json.dumps(valid_payload),
            content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_coordinator_delete_group(self):
        self.api_client.force_authenticate(user=self.coord_user)
        group = Group.objects.get(name='vendor')
        response = self.api_client.delete(
            reverse('cvdp:groupdetailapi', args=[group.groupprofile.uuid]))

        #superusers only
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_vendor_delete_group(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        group = Group.objects.get(name='vendor')
        response = self.api_client.delete(
            reverse('cvdp:groupdetailapi', args=[group.groupprofile.uuid]))
        #superusers only
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_coordinator_get_group(self):
        self.api_client.force_authenticate(user=self.coord_user)
        group = Group.objects.get(name='vendor')
        response = self.api_client.get(
            reverse('cvdp:groupdetailapi', args=[group.groupprofile.uuid]))

        serializer = GroupProfileSerializer(group.groupprofile)
        self.assertEqual(serializer.data, response.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_vendor_get_group(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        group = Group.objects.get(name='vendor')
        response = self.api_client.get(
            reverse('cvdp:groupdetailapi', args=[group.groupprofile.uuid]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_coordinator_tag_group(self):
        self.api_client.force_authenticate(user=self.coord_user)
        group = Group.objects.get(name='vendor')
        valid_payload = {
            'tags': ['hardware', 'software', 'network']
        }
        response = self.api_client.patch(
            reverse('cvdp:groupdetailapi', args=[group.groupprofile.uuid]),
            data=json.dumps(valid_payload),
            content_type='application/json')

        #tags don't exist yet
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_coordinator_tag_group_success(self):
        self.api_client.force_authenticate(user=self.coord_user)
        
        DefinedTag.objects.create(tag='hardware',
                                  category=3)

        group = Group.objects.get(name='vendor')

        valid_payload = {
            'tags': ['hardware']
        }

        response = self.api_client.patch(
            reverse('cvdp:groupdetailapi', args=[group.groupprofile.uuid]),
            data=json.dumps(valid_payload),
            content_type='application/json')

        #tags don't exist yet
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_vendor_tag_group_success(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        
        DefinedTag.objects.create(tag='hardware',
                                  category=3)

        group = Group.objects.get(name='vendor')

        valid_payload = {
            'tags': ['hardware']
        }

        response = self.api_client.patch(
            reverse('cvdp:groupdetailapi', args=[group.groupprofile.uuid]),
            data=json.dumps(valid_payload),
            content_type='application/json')

        #tags don't exist yet
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
        
    #GROUPS API /groups/

    def test_coordinator_get_groupsinfo(self):
        self.api_client.force_authenticate(user=self.coord_user)

        response = self.api_client.get(
            reverse('cvdp:groupapi')+"?type=groups")

        groups = GroupProfile.objects.all().order_by('-modified')
        serializer = GenericContactSerializer(groups, many=True, context={'user': self.coord_user})

        self.assertEqual(response.data['results'], serializer.data)
        self.assertIn('tags', response.data['results'][0]) 
        self.assertEqual(response.status_code, status.HTTP_200_OK)


    def test_coordinator_get_contactsinfo(self):
        self.api_client.force_authenticate(user=self.coord_user)

        response = self.api_client.get(
            reverse('cvdp:groupapi')+"?type=contacts")

        groups = Contact.objects.all().order_by('-modified')
        serializer = GenericContactSerializer(groups, many=True, context={'user': self.coord_user})

        self.assertEqual(response.data['results'], serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_vendor_get_groupsinfo(self):
        self.api_client.force_authenticate(user=self.vendor_user)

        response = self.api_client.get(
            reverse('cvdp:groupapi')+"?type=groups")

        vendor_groups = GroupProfile.objects.filter(group__in=self.vendor_user.groups.all())
        groups = GenericContactSerializer(vendor_groups, many=True)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('tags', response.data['results'][0]) 
        self.assertEqual(groups.data, response.data['results'])


    def test_vendor_get_contactsinfo(self):
        self.api_client.force_authenticate(user=self.vendor_user)

        response = self.api_client.get(
            reverse('cvdp:groupapi')+"?type=contacts")

        vendor_groups = GroupProfile.objects.filter(group__in=self.vendor_user.groups.all())

        groups = GenericContactSerializer(vendor_groups, many=True)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(groups.data, response.data['results'])

    def test_unauth_get_groupsinfo(self):
        response = self.api_client.get(
            reverse('cvdp:groupapi'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_group_contacts(self):
        self.api_client.force_authenticate(user=self.coord_user)
        group = Group.objects.get(name='vendor')
        response = self.api_client.get(
            reverse('cvdp:assoc_api', args=[group.groupprofile.uuid]))

        groups = ContactAssociation.objects.filter(group=group)
        serializer = ContactAssociationSerializer(groups, many=True)

        self.assertEqual(response.data, serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_add_contact_assoc(self):
        self.api_client.force_authenticate(user=self.coord_user)
        group = Group.objects.get(name='vendor')
        valid_payload = {
            'email': 'someemail@email.com',
            'name': 'Joe Smith'
        }
        response = self.api_client.post(
            reverse('cvdp:assoc_api', args=[group.groupprofile.uuid]),
            data=json.dumps(valid_payload),
            content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_add_user_assoc(self):
        self.api_client.force_authenticate(user=self.coord_user)
        group = Group.objects.get(name='vendor')
        valid_payload = {
            'email': 'reporter'
        }
        response = self.api_client.post(
            reverse('cvdp:assoc_api', args=[group.groupprofile.uuid]),
            data=json.dumps(valid_payload),
            content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        contact = ContactAssociation.objects.filter(contact__email='reporter', group=group).first()
        valid_payload = {
            'group_admin': "True"
        }
        response = self.api_client.patch(
            reverse('cvdp:assoc_api_detail', args=[contact.id]),
            data=json.dumps(valid_payload),
            content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        response = self.api_client.delete(
            reverse('cvdp:assoc_api_detail', args=[contact.id]))
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)


    def test_vendor_get_group_contacts(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        group = Group.objects.get(name='vendor')
        response = self.api_client.get(
            reverse('cvdp:assoc_api', args=[group.groupprofile.uuid]))

        groups = ContactAssociation.objects.filter(group=group)
        serializer = ContactAssociationSerializer(groups, many=True)

        self.assertEqual(response.data, serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_vendor_get_notmygroup_contacts(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        group = Group.objects.create(name='other-vendor')
        GroupProfile.objects.create(group=group)
        response = self.api_client.get(
            reverse('cvdp:assoc_api', args=[group.groupprofile.uuid]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_vendor_add_group_contact(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        group = Group.objects.get(name='vendor')
        valid_payload = {
            'email': 'someemail@email.com',
            'name': 'Joe Smith'
        }
        response = self.api_client.post(
            reverse('cvdp:assoc_api', args=[group.groupprofile.uuid]),
            data=json.dumps(valid_payload),
            content_type='application/json')
        #user not group admin
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_groupadmin_add_group_contact(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        group = Group.objects.get(name='vendor')
        ca = ContactAssociation.objects.filter(contact__user=self.vendor_user, group=group).first()
        ca.group_admin = True
        ca.save()

        valid_payload = {
            'email': 'someemail@email.com',
            'name': 'Joe Smith'
        }
        response = self.api_client.post(
            reverse('cvdp:assoc_api', args=[group.groupprofile.uuid]),
            data=json.dumps(valid_payload),
            content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_groupadmin_promote_contact(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        group = Group.objects.get(name='vendor')
        ca = ContactAssociation.objects.filter(contact__user=self.vendor_user, group=group).first()
        ca.group_admin = True
        ca.save()

        valid_payload = {
            'email': 'someemail@email.com',
            'name': 'Joe Smith'
        }
        response = self.api_client.post(
            reverse('cvdp:assoc_api', args=[group.groupprofile.uuid]),
            data=json.dumps(valid_payload),
            content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        contact = ContactAssociation.objects.filter(contact__email='someemail@email.com', group=group).first()
        valid_payload = {
            'group_admin': "True"
        }
        response = self.api_client.patch(
            reverse('cvdp:assoc_api_detail', args=[contact.id]),
            data=json.dumps(valid_payload),
            content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        associated_user = User.objects.create(email='someemail@email.com', password='Pas$w0rd')
        contact.user = associated_user
        contact.save()

        #works now that there is a user associated with it
        response = self.api_client.patch(
            reverse('cvdp:assoc_api_detail', args=[contact.id]),
            data=json.dumps(valid_payload),
            content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)


        response = self.api_client.delete(
            reverse('cvdp:assoc_api_detail', args=[contact.id]))
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)


    def test_reporter_get_group(self):
        self.api_client.force_authenticate(user=self.reporter_user)
        group = Group.objects.get(name='vendor')
        response = self.api_client.get(
            reverse('cvdp:assoc_api', args=[group.groupprofile.uuid]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_reporter_add_group_contact(self):
        self.api_client.force_authenticate(user=self.reporter_user)
        group = Group.objects.get(name='vendor')
        valid_payload = {
            'email': 'someemail@email.com',
            'name': 'Joe Smith'
        }
        response = self.api_client.post(
            reverse('cvdp:assoc_api', args=[group.groupprofile.uuid]),
            data=json.dumps(valid_payload),
            content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    #contacts permissions /api/contacts
    def test_coordinator_get_contacts(self):
        self.api_client.force_authenticate(user=self.coord_user)
        response = self.api_client.get(
            reverse('cvdp:contactapi-list'))

        contacts = Contact.objects.all()
        serializer = ContactSerializer(contacts, many=True)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, serializer.data)

    def test_vendor_get_contacts(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        response = self.api_client.get(
            reverse('cvdp:contactapi-list'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_reporter_get_contact(self):
        self.api_client.force_authenticate(user=self.reporter_user)
        contact = Contact.objects.filter(user=self.vendor_user).first()
        response = self.api_client.get(
            reverse('cvdp:contactapi-detail', args=[contact.uuid]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_coord_create_contact(self):
        self.api_client.force_authenticate(user=self.coord_user)
        valid_payload = {
            'email': 'someemail@email.com',
            'name': 'Joe Smith'
        }
        response = self.api_client.post(
            reverse('cvdp:contactapi-list'),
            data=json.dumps(valid_payload),
            content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_reporter_create_contact(self):
        self.api_client.force_authenticate(user=self.reporter_user)
        valid_payload = {
            'email': 'someemail@email.com',
            'name': 'Joe Smith'
        }
        response = self.api_client.post(
            reverse('cvdp:contactapi-list'),
            data=json.dumps(valid_payload),
            content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_coord_invalid_create_contact(self):
        self.api_client.force_authenticate(user=self.coord_user)
        valid_payload = {
            'name': 'Joe Smith'
        }
        response = self.api_client.post(
            reverse('cvdp:contactapi-list'),
            data=json.dumps(valid_payload),
            content_type='application/json')
        #should require an email
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_coord_update_contact(self):
        self.api_client.force_authenticate(user=self.coord_user)
        contact = Contact.objects.get(user=self.reporter_user)
        valid_payload = {
            'name': 'Joe Smith',
            'email': 'repoter@dkso.com'
        }
        response = self.api_client.patch(
            reverse('cvdp:contactapi-detail', args=[contact.uuid]),
            data=json.dumps(valid_payload),
            content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_coord_delete_contact(self):
        self.api_client.force_authenticate(user=self.coord_user)
        contact = Contact.objects.get(user=self.reporter_user)
        response = self.api_client.delete(
            reverse('cvdp:contactapi-detail', args=[contact.uuid]))
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_vendor_delete_contact(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        contact = Contact.objects.get(user=self.reporter_user)
        response = self.api_client.delete(
            reverse('cvdp:contactapi-detail', args=[contact.uuid]))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_groupadmin_get_contact(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        group = Group.objects.get(name='vendor')
        ca = ContactAssociation.objects.filter(contact__user=self.vendor_user, group=group).first()
        ca.group_admin = True
        ca.save()

        contact = Contact.objects.get(user=self.vendor_user)
        response = self.api_client.get(
            reverse('cvdp:contactapi-detail', args=[contact.uuid]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        #but the groupadmin can patch if group is in payload!
        valid_payload = {
            'phone': '5555555555'
        }
        response = self.api_client.patch(
            reverse('cvdp:contactapi-detail', args=[contact.uuid]),
            data=json.dumps(valid_payload),
            content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        valid_payload = {
            'phone': '5555555555',
            'group': str(group.groupprofile.uuid)
        }
        response = self.api_client.patch(
            reverse('cvdp:contactapi-detail', args=[contact.uuid]),
            data=json.dumps(valid_payload),
            content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        #make sure group admin can't just get any user

    def test_groupadmin_api_generation(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        group = Group.objects.get(name='vendor')
        ca = ContactAssociation.objects.filter(contact__user=self.vendor_user, group=group).first()
        ca.group_admin = True
        ca.save()

        response = self.api_client.get(
            reverse('cvdp:groupapikeys', args=[group.groupprofile.uuid]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_groupadmin_api_generation_noadmin(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        group = Group.objects.get(name='vendor')
        response = self.api_client.get(
            reverse('cvdp:groupapikeys', args=[group.groupprofile.uuid]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_groupadmin_api_generation_post(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        group = Group.objects.get(name='vendor')
        group.groupprofile.support_emails = ['something@something.com']
        group.groupprofile.save()
        ca = ContactAssociation.objects.filter(contact__user=self.vendor_user, group=group).first()
        ca.group_admin = True
        ca.save()

        response = self.api_client.post(
            reverse('cvdp:groupapikeys', args=[group.groupprofile.uuid]))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('key', response.data)

    def test_notgroupadmin_api_generation_post(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        group = Group.objects.get(name='vendor')

        response = self.api_client.post(
            reverse('cvdp:groupapikeys', args=[group.groupprofile.uuid]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_remove_api_admin(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        group = Group.objects.get(name='vendor')
        group.groupprofile.support_emails = ['something@something.com']
        group.groupprofile.save()
        ca = ContactAssociation.objects.filter(contact__user=self.vendor_user, group=group).first()
        ca.group_admin = True
        ca.save()

        response = self.api_client.post(
            reverse('cvdp:groupapikeys', args=[group.groupprofile.uuid]))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('key', response.data)

        response = self.api_client.get(
            reverse('cvdp:groupapikeys', args=[group.groupprofile.uuid]))

        accounts = group.user_set.filter(api_account=True)
        api_keys = APIToken.objects.filter(user__in=accounts)
        serializer=GroupAPIAccountSerializer(api_keys, many=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, serializer.data)

        #refresh key
        api_key = api_keys[0]
        response = self.api_client.patch(
            reverse('cvdp:rmgroupapikey', args=[group.groupprofile.uuid, api_key.last_four]))

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertIn('key', response.data)

        #key changed in above patch
        api_keys = APIToken.objects.filter(user__in=accounts)
        api_key=api_keys[0]

        response = self.api_client.delete(
            reverse('cvdp:rmgroupapikey', args=[group.groupprofile.uuid, api_key.last_four]))

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_create_api_account_fail_noemail(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        group = Group.objects.get(name='vendor')
        ca = ContactAssociation.objects.filter(contact__user=self.vendor_user, group=group).first()
        ca.group_admin = True
        ca.save()

        #support email is required, so fail
        response = self.api_client.post(
            reverse('cvdp:groupapikeys', args=[group.groupprofile.uuid]))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nonadmin_updatedelete_api(self):
        self.api_client.force_authenticate(user=self.vendor_user)
        group = Group.objects.get(name='vendor')

        #confirm this user is not a group admin
        ca = ContactAssociation.objects.filter(group=group, contact__user=self.vendor_user).first()
        ca.group_admin=False
        ca.save()

        apiaccount = User.objects.create(email='something+API@something.com', api_account=True, screen_name='api account', org=group.name, title="API ServiceAccount")
        group.user_set.add(apiaccount)
        token = APIToken(user=apiaccount)
        key=token.generate_key()
        token.save(key)

        response = self.api_client.get(
            reverse('cvdp:groupapikeys', args=[group.groupprofile.uuid]))

        accounts = group.user_set.filter(api_account=True)
        api_keys = APIToken.objects.filter(user__in=accounts)
        serializer=GroupAPIAccountSerializer(api_keys, many=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, serializer.data)

        response = self.api_client.patch(
            reverse('cvdp:rmgroupapikey', args=[group.groupprofile.uuid, token.last_four]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = self.api_client.delete(
            reverse('cvdp:rmgroupapikey', args=[group.groupprofile.uuid, token.last_four]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_rando_access_to_groupadminapi(self):
        self.api_client.force_authenticate(user=self.reporter_user)
        group = Group.objects.get(name='vendor')

        response = self.api_client.get(
            reverse('cvdp:groupapikeys', args=[group.groupprofile.uuid]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

class GroupAPITests(TestCase):

    def setUp(self):
        self.api_client = APIClient()
        self.coord_user = User.objects.create(email='coordinator', password='Pas$w0rd', is_coordinator=True)
        coord_group = Group.objects.create(name='coordinator')
        coord_group.user_set.add(self.coord_user)
        self.reporter_user = User.objects.create(email='reporter', password='Pas$w0rd')
        self.vendor_user = User.objects.create(email='vendor', password='Pas$w0rd')
        contact = Contact.objects.filter(user=self.vendor_user).first()
        group = Group.objects.create(name='vendor')
        GroupProfile.objects.create(group=group)
        group.user_set.add(self.vendor_user)
        ContactAssociation.objects.create(contact=contact, group=group,
                                          added_by=self.coord_user)
        self.case = Case.objects.create(case_id = '123456', title='Test Case', summary="This is a summary of test case", status=Case.ACTIVE_STATUS)
        CaseParticipant.objects.create(case=self.case, group=group, notified=timezone.now())

        Case.objects.create(case_id = '111111', status=Case.ACTIVE_STATUS, title='Test Case', summary="This is a summary of test case")

        #create API account
        api_account = User.objects.create(email='vendor+api@vendor.org', api_account=True, screen_name="Vendor API", org="VENDOR", title="API Service Account")
        group.user_set.add(api_account)
        token = APIToken(user=api_account)
        self.key = token.generate_key()
        token.save(self.key)

        component1 = Component.objects.create(name='something', version='1.2.3')
        Product.objects.create(component=component1, supplier=group)
        component = Component.objects.create(name='product x', version='1.3.4')
        p = Product.objects.create(component=component)
        p.dependencies.add(component1)


    def test_api_access_for_case(self):
        self.api_client.credentials(HTTP_AUTHORIZATION='Token ' + self.key)
        response = self.api_client.get(reverse('cvdp:caseapi-list'))
        # get data from db
        cases = Case.objects.filter(case_id='123456')
        serializer = CaseSerializer(cases, many=True)
        #use results due to pagination
        self.assertEqual(response.data['results'], serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_api_access_for_case_not_participating(self):
        self.api_client.credentials(HTTP_AUTHORIZATION='Token ' + self.key)
        response = self.api_client.get(reverse('cvdp:caseapi-detail', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_api_access_for_case_participating(self):
        self.api_client.credentials(HTTP_AUTHORIZATION='Token ' + self.key)
        response = self.api_client.get(reverse('cvdp:caseapi-detail', args=['123456']))

        cases = Case.objects.get(case_id='123456')
        serializer = CaseSerializer(cases)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, serializer.data)

    def test_api_active_case(self):
        self.case.status=Case.ACTIVE_STATUS
        self.case.save()
        self.api_client.credentials(HTTP_AUTHORIZATION='Token ' + self.key)
        response = self.api_client.get(reverse('cvdp:caseapi-detail', args=['123456']))

        cases = Case.objects.get(case_id='123456')
        serializer = CaseSerializer(cases)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, serializer.data)

    def test_api_get_group_data(self):
        self.api_client.credentials(HTTP_AUTHORIZATION='Token ' + self.key)
        response = self.api_client.get(reverse('cvdp:groupadminapi'))

        group = Group.objects.filter(name='vendor')
        serializer = GroupSerializer(group, many=True)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, serializer.data)

    def test_api_get_contact_associations(self):
        self.api_client.credentials(HTTP_AUTHORIZATION='Token ' + self.key)
        group = Group.objects.get(name='vendor')
        response = self.api_client.get(
            reverse('cvdp:assoc_api', args=[group.groupprofile.uuid]))

        groups = ContactAssociation.objects.filter(group=group)
        serializer = ContactAssociationSerializer(groups, many=True)

        self.assertEqual(response.data, serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_api_vendor_get_notmygroup_contacts(self):
        self.api_client.credentials(HTTP_AUTHORIZATION='Token ' + self.key)
        group = Group.objects.create(name='other-vendor')
        gp = GroupProfile.objects.create(group=group)
        response = self.api_client.get(
            reverse('cvdp:assoc_api', args=[group.groupprofile.uuid]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_api_vendor_add_group_contact(self):
        self.api_client.credentials(HTTP_AUTHORIZATION='Token ' + self.key)
        group = Group.objects.get(name='vendor')
        valid_payload = {
            'email': 'someemail@email.com',
            'name': 'Joe Smith'
        }
        response = self.api_client.post(
            reverse('cvdp:assoc_api', args=[group.groupprofile.uuid]),
            data=json.dumps(valid_payload),
            content_type='application/json')
        #api key does not have group admin perms
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_api_get_component(self):
        self.api_client.credentials(HTTP_AUTHORIZATION='Token ' + self.key)
        response = self.api_client.get(reverse('cvdp:componentapi'))
        group = Group.objects.filter(name='vendor').first()
        # get data from db
        products = Product.my_products([group])
        serializer = ProductSerializer(products, many=True)
        #use results due to pagination
        self.assertEqual(response.data['results'], serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_api_post_component(self):
        self.api_client.credentials(HTTP_AUTHORIZATION='Token ' + self.key)
        group = Group.objects.get(name='vendor')
        valid_payload = {
            'name': 'B0dk3',
            'component_type': 'Firmware',
            'version': '123',
            'homepage': 'www.google.com/123/',
            'comment': 'This is a test component',
        }
        response = self.api_client.post(
            reverse('cvdp:group_components_api', args=[group.groupprofile.uuid]),
            data=json.dumps(valid_payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_api_get_component_detail(self):
        self.api_client.credentials(HTTP_AUTHORIZATION='Token ' + self.key)
        comp = Component.objects.get(name='something')
        response = self.api_client.get(reverse('cvdp:componentapi-detail', args=[comp.product_info.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        #vendor - should be able to get this one
        comp = Component.objects.get(name='product x')
        response = self.api_client.get(reverse('cvdp:componentapi-detail', args=[comp.product_info.id]))
        #use results due to pagination
        self.assertEqual(response.status_code, status.HTTP_200_OK)
