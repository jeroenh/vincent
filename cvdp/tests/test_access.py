import json
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from authapp.models import User
from django.contrib.auth.models import Group
from cvdp.models import Case, CaseParticipant, Contact, UserAssignmentWeight, AssignmentRole, GroupProfile, GlobalSettings, ContactAssociation
from django.test import TestCase, Client, modify_settings
from django.urls import reverse, reverse_lazy
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# initialize the APIClient app
client = Client()

class TestAccessUrls(TestCase):

    def setUp(self):

        self.coord_user = User.objects.create(email='coordinator', password='Pas$w0rd', is_coordinator=True)
        self.coord_mgr = User.objects.create(email='coordmgr', password='Pas$w0rd', is_coordinator=True)
        self.reporter_user = User.objects.create(email='reporter', password='Pas$w0rd')
        self.vendor_user = User.objects.create(email='vendor', password='Pas$w0rd')
        self.lead_coord = User.objects.create(email='leader', password='Pas$w0rd')


        lead_coord_group = Group.objects.create(name='lead_coord_group')
        GroupProfile.objects.create(group=lead_coord_group, vendor_type='Coordinator')
        lead_coord_group.user_set.add(self.lead_coord)
        c = Contact.objects.filter(user=self.lead_coord).first()
        ContactAssociation.objects.create(group=lead_coord_group,contact=c) 
        
        config = GlobalSettings.objects.create(group=lead_coord_group)
        
        coord_group = Group.objects.create(name="coordinator")
        coord_group.user_set.add(self.coord_user)
        coord_mgr_group = Group.objects.create(name="coordinator_mgr")
        coord_mgr_group.user_set.add(self.coord_mgr)
        coord_mgr_group.user_set.add(self.lead_coord)
        
        group = Group.objects.create(name='vendor')
        group.user_set.add(self.vendor_user)
        GroupProfile.objects.create(group=group)

        coord_team = Group.objects.create(name='CoordTeam')
        coord_team.user_set.add(self.coord_user)
        coord_team.user_set.add(self.coord_mgr)
        GroupProfile.objects.create(group=coord_team, vendor_type="Coordinator")
        
        role = AssignmentRole.objects.create(role="coordinator")

        UserAssignmentWeight.objects.create(user=self.coord_user, role=role, weight=5)
        
        Case.objects.create(case_id = '123456', status=Case.ACTIVE_STATUS, title='Test Case', summary="This is a summary of test case")
        Case.objects.create(case_id = '987654', status=Case.ACTIVE_STATUS, title='Test Case', summary="This is a summary of test case")
        acase = Case.objects.create(case_id = '567891', status=Case.ACTIVE_STATUS, title='Test Case', summary="This is a summary of test case")
        case = Case.objects.create(case_id = '111111', status=Case.ACTIVE_STATUS, title='Test Case', summary="This is a summary of test case")
        tcase = Case.objects.create(case_id = '222222', status=Case.ACTIVE_STATUS, title='Test Case', summary="This is a summary of test case")
        pendingcase = Case.objects.create(case_id='444444', title='Pending Test', summary='This case is still pending')

        contact = Contact.objects.get(user=self.coord_user)

        mgrcontact = Contact.objects.get(user=self.coord_mgr)

        CaseParticipant.objects.create(case=case, contact=contact, role="owner")
        CaseParticipant.objects.create(case=case, group=group, notified=timezone.now())

        CaseParticipant.objects.create(case=acase, contact=contact, role="owner")
        CaseParticipant.objects.create(case=acase, group=group, notified=timezone.now())

        CaseParticipant.objects.create(case=tcase, contact=mgrcontact, role="owner")


    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_coordinator_modify_global_group(self):

        client = Client()
        client.force_login(user=self.lead_coord)
        #coord fails at making themselves group admin of lead group
        lead_coord_group = Group.objects.filter(name='lead_coord_group').first()
        contact = ContactAssociation.objects.filter(contact__email='leader', group=lead_coord_group).first()
        valid_payload = {
            'group_admin': "True"
	}
        response = client.patch(
            reverse('cvdp:assoc_api_detail', args=[contact.id]),
            data=json.dumps(valid_payload),
            content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        #coord should fail adding reporter to lead coord group
        valid_payload = {
            'email': 'reporter'
        }
        response = client.post(
            reverse('cvdp:assoc_api', args=[lead_coord_group.groupprofile.uuid]),
            data=json.dumps(valid_payload),
            content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        #add reporter to lead_coord_group
        c = Contact.objects.filter(user=self.reporter_user).first()
        cas = ContactAssociation.objects.create(contact=c, group=lead_coord_group)
        
        #coord should fail verifiying reporter
        ca = ContactAssociation.objects.filter(contact=c, group=lead_coord_group).first()
        valid_payload = {
            'verified': "True"
	}
        response = client.patch(
            reverse('cvdp:assoc_api_detail', args=[ca.id]),
            data=json.dumps(valid_payload),
            content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        #now make coordinator gorup admin and verify them as part of the group
        contact.group_admin = True
        contact.verified = True
        contact.save()

        ContactAssociation.objects.filter(group=ca.group, contact__user=self.lead_coord, group_admin=True).exists()
        
        #now try adding them
        response = client.patch(
            reverse('cvdp:assoc_api_detail', args=[ca.id]),
            data=json.dumps(valid_payload),
            content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        
    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_coordinator_case_access(self):
        # get API response
        client = Client()
        client.force_login(user=self.coord_user)
        response = client.get(reverse('cvdp:casesearch'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:caseapi-detail', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:case_participant_summary_api', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:edit_case', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:vulapi', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:advisoryapi-list', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:csafapi', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        response = client.get(reverse('cvdp:csafsettings', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        response = client.get(reverse('cvdp:caseapi-detail', args=['222222']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_lead_coordinator_case_access(self):
        # get API response
        client = Client()
        client.force_login(user=self.lead_coord)
        response = client.get(reverse('cvdp:casesearch'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:caseapi-detail', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:case_participant_summary_api', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:edit_case', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:vulapi', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:advisoryapi-list', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:csafapi', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        response = client.get(reverse('cvdp:csafsettings', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        response = client.get(reverse('cvdp:caseapi-detail', args=['222222']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:caseapi-detail', args=['123456']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    
        
    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })  
    def test_mgr_coordinator_case_access(self):

        client = Client()
        client.force_login(user=self.coord_mgr)
        
        response = client.get(reverse('cvdp:casesearch'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:caseapi-detail', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = client.get(reverse('cvdp:case_participant_summary_api', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = client.get(reverse('cvdp:edit_case', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = client.get(reverse('cvdp:vulapi', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = client.get(reverse('cvdp:advisoryapi-list', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = client.get(reverse('cvdp:csafapi', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = client.get(reverse('cvdp:csafsettings', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        response = client.get(reverse('cvdp:caseapi-detail', args=['222222']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        
    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_coordinator_assign_case(self):
        client = Client()

        client.force_login(user=self.coord_user)

        logger.debug(reverse('cvdp:assign_case', args=['123456']))
        valid_payload = {'user': self.coord_user.contact.uuid}

        response = client.post(
            reverse('cvdp:assign_case', args=['123456']),
            data=valid_payload
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        
    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_lead_coordinator_assign_case_bad_group(self):
        client = Client()

        client.force_login(user=self.lead_coord)

        #should fail because group is not a coordinator
        
        vendor_group = Group.objects.create(name='bad_vendor')
        GroupProfile.objects.create(group=vendor_group)
        
        valid_payload = {'user': vendor_group.groupprofile.uuid}

        response = client.post(
            reverse('cvdp:assign_case', args=['123456']),
            data=valid_payload
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_lead_coordinator_assign_case(self):
        client = Client()

        client.force_login(user=self.lead_coord)

        vendor_group = Group.objects.get(name='CoordTeam')

        logger.debug(reverse('cvdp:assign_case', args=['123456']))
        valid_payload = {'user': vendor_group.groupprofile.uuid}

        response = client.post(
            reverse('cvdp:assign_case', args=['123456']),
            data=valid_payload
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_lead_coordinator_unassign_case(self):
        client = Client()

        client.force_login(user=self.lead_coord)

        vendor_group = Group.objects.get(name='CoordTeam')

        logger.debug(reverse('cvdp:assign_case', args=['123456']))
        valid_payload = {'user': vendor_group.groupprofile.uuid}

        response = client.post(
            reverse('cvdp:assign_case', args=['123456']),
            data=valid_payload
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


        valid_payload = {'users[]': vendor_group.groupprofile.uuid}
        response = client.post(
            reverse('cvdp:unassign_case', args=['123456']),
            data=valid_payload
        )

        #can't unassign a case in active status without first assigning someone else!
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        case = Case.objects.get(case_id='123456')
        case.status = Case.PENDING_STATUS
        case.save()

        valid_payload = {'users[]': vendor_group.groupprofile.uuid}
        response = client.post(
            reverse('cvdp:unassign_case', args=['123456']),
            data=valid_payload
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_coordinatormgr_assign_case(self):
        client = Client()

        client.force_login(user=self.lead_coord)

        coord_group = Group.objects.get(name='CoordTeam')

        logger.debug(reverse('cvdp:assign_case', args=['123456']))
        valid_payload = {'user': coord_group.groupprofile.uuid}

        response = client.post(
            reverse('cvdp:assign_case', args=['123456']),
            data=valid_payload
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        client.force_login(user=self.coord_mgr)
        
        valid_payload = {'user': self.coord_user.contact.uuid}

        response = client.post(
            reverse('cvdp:assign_case', args=['123456']),
            data=valid_payload
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_coordinatormgr_assign_case_forbidden(self):
        client = Client()

        coord_group = Group.objects.get(name='CoordTeam')

        client.force_login(user=self.coord_mgr)

        valid_payload = {'user': coord_group.groupprofile.uuid}

        response = client.post(
            reverse('cvdp:assign_case', args=['123456']),
            data=valid_payload
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_coordinator_assign_case_forbidden(self):
        client = Client()

        coord_group = Group.objects.get(name='CoordTeam')

        client.force_login(user=self.coord_user)

        valid_payload = {'user': coord_group.groupprofile.uuid}

        response = client.post(
            reverse('cvdp:assign_case', args=['123456']),
            data=valid_payload
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)        
        
        
    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_coordinator_autoassign_case_bogus(self):
        client = Client()

        client.force_login(user=self.coord_user)

        logger.debug(reverse('cvdp:assign_case', args=['123456']))
        valid_payload = {'role': 'bogus'}

        response = client.post(
            reverse('cvdp:assign_case', args=['123456']),
            data=valid_payload
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_coordinatormgr_autoassign_case_bogus(self):
        client = Client()

        client.force_login(user=self.coord_mgr)

        logger.debug(reverse('cvdp:assign_case', args=['123456']))
        valid_payload = {'role': 'bogus'}

        response = client.post(
            reverse('cvdp:assign_case', args=['123456']),
            data=valid_payload
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_coordinator_autoassign_case(self):
        client = Client()

        client.force_login(user=self.coord_user)
        
        logger.debug(reverse('cvdp:assign_case', args=['123456']))
        valid_payload = {'role': 'coordinator'}

        response = client.post(
	    reverse('cvdp:assign_case', args=['123456']),
            data=valid_payload
	)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_coordinator_assign_bad_uuid(self):
        client = Client()

        client.force_login(user=self.coord_mgr)

        logger.debug(reverse('cvdp:assign_case', args=['123456']))
        valid_payload = {'user': self.reporter_user.id}

        response = client.post(
            reverse('cvdp:assign_case', args=['123456']),
            data=valid_payload
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_coordinator_assign_non_coordinator_case(self):
        client = Client()

        client.force_login(user=self.coord_mgr)

        logger.debug(reverse('cvdp:assign_case', args=['123456']))
        valid_payload = {'user': self.reporter_user.contact.uuid}

        response = client.post(
            reverse('cvdp:assign_case', args=['123456']),
            data=valid_payload
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        
    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_vendor_assign_coordinator_case(self):
        client = Client()

        client.force_login(user=self.vendor_user)

        logger.debug(reverse('cvdp:assign_case', args=['123456']))
        valid_payload = {'user': self.coord_user.id}

        response = client.post(
            reverse('cvdp:assign_case', args=['123456']),
            data=valid_payload
        )
        #redirects to login because user doesn't pass test
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_coordinator_unassign_case_bad_uuid(self):
        client = Client()

        client.force_login(user=self.coord_user)

        valid_payload = {'users[]': [self.coord_user.id]}
        
        response = client.post(
            reverse('cvdp:unassign_case', args=['111111']),
            data=valid_payload
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        
    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_coordinator_unassign_case(self):
        client = Client()

        client.force_login(user=self.coord_user)

        valid_payload = {'users[]': [self.coord_user.contact.uuid]}
        
        response = client.post(
            reverse('cvdp:unassign_case', args=['111111']),
            data=valid_payload
        )
        #can't unassign a case that is active with vendors already notified... must reassign first
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        client.force_login(user=self.coord_mgr)
        
        valid_payload = {'user': self.coord_mgr.contact.uuid}
        
        response = client.post(
            reverse('cvdp:assign_case', args=['111111']),
            data=valid_payload
        )

        # case must be assigned to coord team first
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        case = Case.objects.get(case_id='111111')
        coord_team = Group.objects.get(name="CoordTeam")
        CaseParticipant.objects.create(case=case, group=coord_team, role="owner")

        response = client.post(
            reverse('cvdp:assign_case', args=['111111']),
            data=valid_payload
	)

	# case must be assigned to coord team first
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        client.force_login(user=self.coord_user)
        
        valid_payload = {'users[]': [self.coord_user.contact.uuid]}

        response = client.post(
            reverse('cvdp:unassign_case', args=['111111']),
            data=valid_payload
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        

    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_noncoordinator_unassign_case(self):
        client = Client()

        client.force_login(user=self.vendor_user)
        
        valid_payload =	{'users[]': [self.coord_user.contact.uuid]}
	
        response = client.post(
            reverse('cvdp:unassign_case', args=['111111']),
            data=valid_payload
	)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_coordinator_unassign_case_baddata(self):
        client = Client()

        client.force_login(user=self.coord_user)

        valid_payload = {'users[]': [self.reporter_user.contact.uuid]}

        response = client.post(
            reverse('cvdp:unassign_case', args=['111111']),
            data=valid_payload
	)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


        
    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_vendor_case_access(self):
        client = Client()
        client.force_login(user=self.vendor_user)
        response = client.get(reverse('cvdp:casesearch'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:case', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:caseparticipants', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:edit_case', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = client.get(reverse('cvdp:casestatus', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:advisory', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)


    
        
    """
    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_reporter_case_access(self):
        client = Client()
        client.force_login(user=self.reporter_user)
        response = client.get(reverse('cvdp:casesearch'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = client.get(reverse('cvdp:case', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = client.get(reverse('cvdp:caseparticipants', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = client.get(reverse('cvdp:edit_case', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = client.get(reverse('cvdp:casestatus', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = client.get(reverse('cvdp:advisory', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    """
