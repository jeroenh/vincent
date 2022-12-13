import json
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from django.test import TestCase, Client, modify_settings
from django.urls import reverse, reverse_lazy
from django_otp.oath import TOTP
from django_otp.plugins.otp_totp.models import TOTPDevice
from cvdp.models import Case, CaseParticipant, Contact, CaseArtifact, Action, BounceEmailNotification
from django.contrib.auth.models import Group
from django.test import TestCase, Client, modify_settings
from authapp.models import APIToken, User
from cvdp.cases.serializers import *
from cvdp.components.models import *
from cvdp.components.serializers import *
from cvdp.manage.serializers import *
from cvdp.permissions import my_coord_teams
from cvdp.manage.models import *
from cvdp.lib import add_artifact
from django.core.files.uploadedfile import SimpleUploadedFile
import logging

# initialize the APIClient app
client = Client()

class TestTriage(APITestCase):

    def setUp(self):
        self.api_client = APIClient()
        self.coord_user = User.objects.create(email='coordinator', password='Pas$w0rd')
        self.lead_coord_user = User.objects.create(email='lead_coordinator', password='Pas$w0rd')
        coord_group = Group.objects.create(name='coordinator')
        coord_mgr_group = Group.objects.create(name='coordinator_mgr')
        coord_group.user_set.add(self.coord_user)
        coord_group.user_set.add(self.lead_coord_user)
        coord_mgr_group.user_set.add(self.lead_coord_user)
        coord_group1 = Group.objects.create(name='coordinator_team1')
        GroupProfile.objects.create(group = coord_group1, vendor_type='Coordinator')
        coord_group2 = Group.objects.create(name='coordinator_team2')
        GroupProfile.objects.create(group = coord_group2, vendor_type='Coordinator')

        coord_group1.user_set.add(self.coord_user)
        coord_group2.user_set.add(self.lead_coord_user)
        
        reporter_user = User.objects.create(email='reporter', password='Pas$w0rd')
        self.vendor_user = User.objects.create(email='vendor', password='Pas$w0rd')
        group = Group.objects.create(name='vendor')
        GroupProfile.objects.create(group=group)
        group.user_set.add(self.vendor_user)

        leadcoordgroup = Group.objects.create(name="LeadCoordTeam")
        GroupProfile.objects.create(group = leadcoordgroup, vendor_type='Coordinator')
        leadcoordgroup.user_set.add(self.lead_coord_user)

        config = GlobalSettings.objects.create(group=leadcoordgroup)

        Case.objects.create(case_id = '123456', status=Case.PENDING_STATUS, title='Test Case', summary="This is a summary of test case")
        Case.objects.create(case_id = '987654', status=Case.PENDING_STATUS, title='Test Case', summary="This is a summary of test case")

        BounceEmailNotification.objects.create(email='test@gmail.com', from_email='vuls@vincent.com',bounce_type=BounceEmailNotification.TRANSIENT, subject='This is a bounce')


    def test_lead_coordinator_get_all_cases(self):
        self.api_client.force_authenticate(user=self.lead_coord_user)
        
        response = self.api_client.get(reverse('cvdp:triageapi'))
        # get data from db
    
        cases = Case.objects.all()
        serializer = CaseSerializer(cases, many=True)
        #use results due to pagination
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['results'], serializer.data)

    def test_coordinator_get_all_cases(self):
        self.api_client.force_authenticate(user=self.coord_user)
        
        response = self.api_client.get(reverse('cvdp:triageapi'))
        # get data from db
    
        coord_team = my_coord_teams(self.coord_user)
        owners = CaseParticipant.objects.filter(role="owner", group__in=coord_team).values_list('case__id', flat=True)
        unassigned = CaseParticipant.objects.filter(case__in=owners, role="owner", contact__isnull=False).values_list('case__id', flat=True)
        cases = Case.objects.filter(id__in=owners).exclude(status=Case.INACTIVE_STATUS).exclude(id__in=unassigned).order_by('-created')

        serializer = CaseSerializer(cases, many=True)
        #use results due to pagination
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['results'], serializer.data)

    def test_vendor_triage_acceess_denied(self):
        
        self.api_client.force_authenticate(user=self.vendor_user)
        response = self.api_client.get(reverse('cvdp:triageapi'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_lead_coord_assign_case(self):

        self.api_client.force_login(user=self.lead_coord_user)
        cg = Group.objects.filter(name='coordinator_team1').first()
        
        valid_payload = {'user': str(cg.groupprofile.uuid)}
        response = self.api_client.post(
            reverse('cvdp:assign_case', args=['123456']),
            data = valid_payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_notlead_coord_assign_case(self):

        self.api_client.force_login(user=self.coord_user)
        cg = Group.objects.filter(name='coordinator_team1').first()

        valid_payload = {'user': str(cg.groupprofile.uuid)}
        response = self.api_client.post(
            reverse('cvdp:assign_case', args=['123456']),
            data = valid_payload)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @modify_settings(MIDDLEWARE={
	'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_notlead_coord_assign_case_user(self):

        self.api_client.force_login(user=self.coord_user)
        cg = Group.objects.filter(name='coordinator_team1').first()

        case = Case.objects.get(case_id='123456')
        cp = CaseParticipant.objects.create(case=case, group=cg, role="owner")
        
        valid_payload = {'user': str(self.coord_user.contact.uuid)}
        response = self.api_client.post(
            reverse('cvdp:assign_case', args=['123456']),
            data = valid_payload)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @modify_settings(MIDDLEWARE={
	'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_notlead_coordmgr_assign_case_user(self):

        self.api_client.force_login(user=self.coord_user)
        mgr = Group.objects.get(name='coordinator_mgr')
        mgr.user_set.add(self.coord_user)
        cg = Group.objects.filter(name='coordinator_team1').first()

        case = Case.objects.get(case_id='123456')
        cp = CaseParticipant.objects.create(case=case, group=cg, role="owner")
	
        valid_payload = {'user': str(self.coord_user.contact.uuid)}
        response = self.api_client.post(
            reverse('cvdp:assign_case', args=['123456']),
            data = valid_payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


    @modify_settings(MIDDLEWARE={
	'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_lead_get_triage_meta(self):

        self.api_client.force_login(user=self.lead_coord_user)
        response = self.api_client.get(
            reverse('cvdp:triage_meta'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['teams']), 3)


    @modify_settings(MIDDLEWARE={
	'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_notlead_get_triage_meta(self):

        self.api_client.force_login(user=self.coord_user)
        response = self.api_client.get(
            reverse('cvdp:triage_meta'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['teams']), 1)

    @modify_settings(MIDDLEWARE={
	'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_vendor_get_triage_meta(self):

        self.api_client.force_login(user=self.vendor_user)
        response = self.api_client.get(
            reverse('cvdp:triage_meta'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
    @modify_settings(MIDDLEWARE={
	'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_lead_get_triagecal_meta(self):

        self.api_client.force_login(user=self.lead_coord_user)
        response = self.api_client.get(
            reverse('cvdp:triage_cal')+'?team=coordinator_team2')
        print(response.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['group']['name'], 'coordinator_team2')


    @modify_settings(MIDDLEWARE={
	'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_notlead_get_triagecal_meta(self):

        self.api_client.force_login(user=self.coord_user)
        response = self.api_client.get(
            reverse('cvdp:triage_cal'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['group']['name'], 'coordinator_team1')

    @modify_settings(MIDDLEWARE={
	'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_notlead_get_triagecal_meta_wrongteam(self):

        self.api_client.force_login(user=self.coord_user)
        response = self.api_client.get(
            reverse('cvdp:triage_cal')+'?team=coordinator_team2')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @modify_settings(MIDDLEWARE={
	'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_notlead_get_triagecal_events_wrongteam(self):

        self.api_client.force_login(user=self.coord_user)
        response = self.api_client.get(
            reverse('cvdp:triage_cal_event')+'?team=coordinator_team2')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    	
    @modify_settings(MIDDLEWARE={
	'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_lead_get_triagecal_events(self):

        self.api_client.force_login(user=self.lead_coord_user)
        response = self.api_client.get(
            reverse('cvdp:triage_cal_event')+'?team=coordinator_team2')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


    @modify_settings(MIDDLEWARE={
	'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_lead_post_triagecal_events(self):

        self.api_client.force_login(user=self.lead_coord_user)
        valid_payload = {'event_id': 1,
                         'start': '2025-09-30'}
                         
        response = self.api_client.post(
            reverse('cvdp:triage_cal_event'),
            data=json.dumps(valid_payload),
            content_type='application/json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


    @modify_settings(MIDDLEWARE={
	'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_lead_bad_post_triagecal_events(self):

        self.api_client.force_login(user=self.lead_coord_user)
        invalid_payload = {'event_id': 1,
                         'date': '2025-09-30'}
                         
        response = self.api_client.post(
            reverse('cvdp:triage_cal_event'),
            data=json.dumps(invalid_payload),
            content_type='application/json')
        
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    
    @modify_settings(MIDDLEWARE={
	'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_notlead_post_triagecal_events_invalid(self):

        self.api_client.force_login(user=self.coord_user)
        valid_payload = {'event_id': 3,
                         'date': '2025-09-30'}
        
        response = self.api_client.post(
            reverse('cvdp:triage_cal_event'),
            data=json.dumps(valid_payload),
            content_type='application/json')
    
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_notlead_post_triagecal_events(self):

        self.api_client.force_login(user=self.coord_user)
        valid_payload = {'event_id': 1,
                         'date': '2025-09-30'}

        response = self.api_client.post(
            reverse('cvdp:triage_cal_event'),
            data=json.dumps(valid_payload),
	    content_type='application/json')
	
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)


    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_notlead_post_triagecal_events_assign_user(self):

        self.api_client.force_login(user=self.coord_user)
        valid_payload = {'event_id': 1,
                         'assign_user': self.lead_coord_user.id,
                         'date': '2025-09-30'}

        response = self.api_client.post(
            reverse('cvdp:triage_cal_event'),
            data=json.dumps(valid_payload),
	    content_type='application/json')
	
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    @modify_settings(MIDDLEWARE={
	'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_notlead_post_triagecal_events_assign_userwteam(self):

        self.api_client.force_login(user=self.coord_user)
        valid_payload = {'event_id': 1,
                         'assign_user':	self.lead_coord_user.id,
                         'date': '2025-09-30',
                         'coord_team': 'coordinator_team2'}

        response = self.api_client.post(
            reverse('cvdp:triage_cal_event'),
            data=json.dumps(valid_payload),
            content_type='application/json')
	
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        

    @modify_settings(MIDDLEWARE={
	'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_lead_post_triagecal_events_assign_user(self):

        self.api_client.force_login(user=self.lead_coord_user)
        valid_payload = {'event_id': 1,
                         'assign_user':	self.coord_user.id,
                         'date': '2025-09-30',
                         'coord_team': 'coordinator_team1'}

        response = self.api_client.post(
            reverse('cvdp:triage_cal_event'),
            data=json.dumps(valid_payload),
            content_type='application/json')
	
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    @modify_settings(MIDDLEWARE={
	'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_lead_post_triagecal_events_assign_user_wrongteam(self):

        self.api_client.force_login(user=self.lead_coord_user)
        valid_payload = {'event_id': 1,
                         'assign_user':	self.coord_user.id,
                         'date': '2025-09-30',
                         'coord_team': 'coordinator_team2'}

        response = self.api_client.post(
            reverse('cvdp:triage_cal_event'),
            data=json.dumps(valid_payload),
            content_type='application/json')
	
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_lead_patch_triagecal_events(self):

        obj = TriageCalendarEvent.objects.create(date='2025-09-30', user=self.lead_coord_user,
                                           coord_team=Group.objects.get(name='coordinator_team2'),
                                           event_id=1)
                                                                
        
        self.api_client.force_login(user=self.lead_coord_user)
        valid_payload = {'event_id': 2}

        response = self.api_client.patch(
            reverse('cvdp:triage_cal_event_update', args=[obj.id]),
            data=json.dumps(valid_payload),
            content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)


    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_notlead_patch_triagecal_events(self):

        obj = TriageCalendarEvent.objects.create(date='2025-09-30', user=self.coord_user,
                                           coord_team=Group.objects.get(name='coordinator_team1'),
                                           event_id=1)
                                                                
        
        self.api_client.force_login(user=self.coord_user)
        valid_payload = {'end_date': '2025-10-02'}

        response = self.api_client.patch(
            reverse('cvdp:triage_cal_event_update', args=[obj.id]),
            data=json.dumps(valid_payload),
            content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
        
    def test_lead_patch_triagecal_events_invalid(self):

        obj = TriageCalendarEvent.objects.create(date='2025-09-30', user=self.lead_coord_user,
                                           coord_team=Group.objects.get(name='coordinator_team2'),
                                           event_id=1)
                                                                
        
        self.api_client.force_login(user=self.coord_user)
        valid_payload = {'event_id': 2}

        response = self.api_client.patch(
            reverse('cvdp:triage_cal_event_update', args=[obj.id]),
            data=json.dumps(valid_payload),
            content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_bounce_access(self):

        self.api_client.force_login(user=self.coord_user)

        response = self.api_client.get(
            reverse('cvdp:bounces'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)


        
    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_bounce_noaccess(self):

        self.api_client.force_login(user=self.vendor_user)

        response = self.api_client.get(
            reverse('cvdp:bounces'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_update_bounce(self):

        self.api_client.force_login(user=self.coord_user)

        bounce = BounceEmailNotification.objects.all().first()
        
        response = self.api_client.patch(
            reverse('cvdp:update_bounce', args=[bounce.id]),
            data=json.dumps({'action': 'ignore'}),
            content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)


    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_invalid_update_bounce(self):

        self.api_client.force_login(user=self.coord_user)

        bounce = BounceEmailNotification.objects.all().first()
        
        response = self.api_client.patch(
            reverse('cvdp:update_bounce', args=[bounce.id]),
            data=json.dumps({'from_email': 'ignore'}),
            content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        #from_email is read only
        bounce = BounceEmailNotification.objects.all().first()
        self.assertEqual(bounce.from_email, "vuls@vincent.com")

    

    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_forbidden_update_bounce(self):

        self.api_client.force_login(user=self.vendor_user)

        bounce = BounceEmailNotification.objects.all().first()
        
        response = self.api_client.patch(
            reverse('cvdp:update_bounce', args=[bounce.id]),
            data=json.dumps({'from_email': 'ignore'}),
            content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
