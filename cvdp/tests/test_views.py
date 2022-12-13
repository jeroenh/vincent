import json
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from django.test import TestCase, Client, modify_settings
from django.urls import reverse, reverse_lazy
from django_otp.oath import TOTP
from django_otp.plugins.otp_totp.models import TOTPDevice
from cvdp.models import Case, CaseParticipant, Contact, CaseArtifact, Action, CaseApproval
from django.contrib.auth.models import Group
from django.test import TestCase, Client
from rest_framework.test import APIClient
from authapp.models import APIToken, User
from cvdp.cases.serializers import *
from cvdp.components.models import *
from cvdp.components.serializers import *
from cvdp.manage.serializers import *
from cvdp.manage.models import *
from cvdp.lib import add_artifact
from django.core.files.uploadedfile import SimpleUploadedFile
import logging


logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# initialize the APIClient app
client = Client()


def get_token_from_totp_device(totp_model) -> str:
    return TOTP(
        key=totp_model.bin_key,
        step=totp_model.step,
        t0=totp_model.t0,
        digits=totp_model.digits,
    ).token()

class GetAllCasesTest(TestCase):

    def setUp(self):
        coord_user = User.objects.create(email='coordinator', password='Pas$w0rd', is_coordinator=True)
        coord_group = Group.objects.create(name='coordinator')
        coord_group.user_set.add(coord_user)
        reporter_user = User.objects.create(email='reporter', password='Pas$w0rd')
        vendor_user = User.objects.create(email='vendor', password='Pas$w0rd')
        group = Group.objects.create(name='vendor')
        GroupProfile.objects.create(group=group)
        group.user_set.add(vendor_user)

        coordgroup = Group.objects.create(name="CoordTeam")
        GroupProfile.objects.create(group = coordgroup, vendor_type='Coordinator')
        coordgroup.user_set.add(coord_user)

        config = GlobalSettings.objects.create(group=coord_group)

        Case.objects.create(case_id = '123456', status=Case.ACTIVE_STATUS, title='Test Case', summary="This is a summary of test case")
        Case.objects.create(case_id = '987654', status=Case.ACTIVE_STATUS, title='Test Case', summary="This is a summary of test case")
        acase = Case.objects.create(case_id = '567891', status=Case.ACTIVE_STATUS, title='Test Case', summary="This is a summary of test case")
        case = Case.objects.create(case_id = '111111', status=Case.ACTIVE_STATUS, title='Test Case', summary="This is a summary of test case")
        pendingcase = Case.objects.create(case_id='444444', title='Pending Test', summary='This case is still pending')

        CaseParticipant.objects.create(case=case, group=group, notified=timezone.now())
        CaseParticipant.objects.create(case=acase, group=group, notified=timezone.now())


    def test_coordinator_get_all_cases(self):
        # get API response
        client = APIClient()

        coord_user = User.objects.get(email='coordinator')
        client.force_authenticate(user=coord_user)
        response = client.get(reverse('cvdp:caseapi-list'))
        # get data from db
        cases = Case.objects.all()
        serializer = CaseDetailSerializer(cases, many=True)
        #use results due to pagination
        self.assertEqual(response.data['results'], serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


    def test_coordinator_get_case_detail(self):
        # get API response
        client = APIClient()

        coord_user = User.objects.get(email='coordinator')
        client.force_authenticate(user=coord_user)
        response = client.get(reverse('cvdp:caseapi-detail', args=['123456']))
        # get data from db
        cases = Case.objects.get(case_id='123456')
        serializer = CaseCoordinatorSerializer(cases)
        self.assertEqual(response.data, serializer.data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_vendor_get_active_case_detail(self):
        # get API response
        client = APIClient()

        coord_user = User.objects.get(email='vendor')
        client.force_authenticate(user=coord_user)
        response = client.get(reverse('cvdp:caseapi-detail', args=['567891']))
        # get data from db
        cases = Case.objects.get(case_id='567891')
        serializer = CaseSerializer(cases)
        #use results due to pagination
        self.assertEqual(response.data, serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_vendor_get_pending_case_detail(self):
        # get API response
        client = APIClient()

        coord_user = User.objects.get(email='vendor')
        client.force_authenticate(user=coord_user)
        response = client.get(reverse('cvdp:caseapi-detail', args=['444444']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_reporter_get_case_detail(self):
        # get API response
        client = APIClient()

        user = User.objects.get(email='reporter')
        client.force_authenticate(user=user)
        response = client.get(reverse('cvdp:caseapi-detail', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_reporter_get_all_cases(self):
        # get API response
        client = APIClient()
        reporter_user = User.objects.get(email='reporter')
        client.force_authenticate(user=reporter_user)
        response = client.get(reverse('cvdp:caseapi-list'))
        # get data from db
        #cases = Case.objects.all()
        #serializer = CaseSerializer(cases, many=True)
        #use results due to pagination

        self.assertEqual(response.data['results'], [])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_vendor_access_cases(self):
        # get API response
        client = APIClient()

        vendor_user = User.objects.get(email='vendor')
        client.force_authenticate(user=vendor_user)
        response = client.get(reverse('cvdp:caseapi-list'))
        # get data from db
        cases = Case.objects.filter(case_id__in=['111111', '567891'])
        serializer = CaseSerializer(cases, many=True)
        #use results due to pagination
        self.assertEqual(response.data['results'], serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unauthenticated_get_cases(self):
        # get API response
        client = APIClient()
        response = client.get(reverse('cvdp:caseapi-list'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_coord_token_access(self):
        client=APIClient()
        coord_user = User.objects.get(email='coordinator')
        t = APIToken(user=coord_user)
        key = t.generate_key()
        t.save(key)

        client.credentials(HTTP_AUTHORIZATION='Token ' + key)
        response = client.get(reverse('cvdp:caseapi-list'))
        # get data from db
        cases = Case.objects.all()
        serializer = CaseDetailSerializer(cases, many=True)
        #use results due to pagination
        self.assertEqual(response.data['results'], serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


    def test_reporter_token_access(self):
        # get API response
        client = APIClient()
        reporter_user = User.objects.get(email='reporter')
        t = APIToken(user=reporter_user)
        key = t.generate_key()
        t.save(key)
        client.credentials(HTTP_AUTHORIZATION='Token ' + key)
        response = client.get(reverse('cvdp:caseapi-list'))
        self.assertEqual(response.data['results'], [])
        self.assertEqual(response.status_code, status.HTTP_200_OK)


    def test_vendor_token_access(self):
        # get API response
        client = APIClient()

        vendor_user = User.objects.get(email='vendor')
        t = APIToken(user=vendor_user)
        key = t.generate_key()
        t.save(key)
        client.credentials(HTTP_AUTHORIZATION='Token ' + key)
        response = client.get(reverse('cvdp:caseapi-list'))
        # get data from db
        cases = Case.objects.filter(case_id__in=['111111', '567891'])
        serializer = CaseSerializer(cases, many=True)
        #use results due to pagination
        self.assertEqual(response.data['results'], serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)




class CaseWriteTest(TestCase):

    def setUp(self):
        self.coord_user = User.objects.create(email='coordinator', password='Pas$w0rd', is_coordinator=True)
        coord_group = Group.objects.create(name='coordinator')
        coord_group.user_set.add(self.coord_user)
        self.reporter_user = User.objects.create(email='reporter', password='Pas$w0rd')
        self.vendor_user = User.objects.create(email='vendor', password='Pas$w0rd')
        group = Group.objects.create(name='vendor')
        GroupProfile.objects.create(group=group)
        group.user_set.add(self.vendor_user)
        case = Case.objects.create(case_id = '111111', title='Test Case', summary="This is a summary of test case")
        contact = Contact.objects.get(user=self.coord_user)
        CaseParticipant.objects.create(case=case, group=group)
        CaseParticipant.objects.create(case=case, contact=contact, role="owner")

        self.valid_payload = {
            'title': 'XXX',
            'case_id': '123456',
            'summary': 'blah blah blah'
        }

        self.invalid_payload = {
            'case_id': '444',
        }

    def test_create_valid_case(self):
        #Trick Question! The only way to create a case from the API is through a transfer
        client = APIClient()
        client.force_authenticate(user=self.coord_user)
        response = client.post(
            reverse('cvdp:caseapi-list'),
            data=json.dumps(self.valid_payload),
            content_type='application/json'
        )
        #must be a coord mgr
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_valid_case_mgr(self):
        client = APIClient()
        client.force_authenticate(user=self.coord_user)
        response = client.post(
            reverse('cvdp:caseapi-list'),
            data=json.dumps(self.valid_payload),
            content_type='application/json'
        )
        #must be a coord mgr
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_delete_valid_case(self):
        #Another Trick Question! You can't delete a case from the API
        client = APIClient()
        client.force_authenticate(user=self.coord_user)
        response = client.delete(
            reverse('cvdp:caseapi-detail', args=['111111']),
        )
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_update_valid_case(self):
        client = APIClient()

        client.force_authenticate(user=self.coord_user)

        response = client.patch(
            reverse('cvdp:caseapi-detail', args=['111111']),
            data=json.dumps(self.valid_payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_readonly_update_case(self):
        client = APIClient()

        client.force_authenticate(user=self.coord_user)

        response = client.patch(
            reverse('cvdp:caseapi-detail', args=['111111']),
            data=json.dumps(self.invalid_payload),
            content_type='application/json'
        )
        self.assertEqual(response.data['case_id'], '111111')
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_reporter_update_case(self):
        client = APIClient()

        client.force_authenticate(user=self.reporter_user)
        response = client.patch(
            reverse('cvdp:caseapi-detail', args=['111111']),
            data=json.dumps(self.valid_payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class AdvisoryTests(TestCase):

    def setUp(self):
        self.coord_user = User.objects.create(email='coordinator', password='Pas$w0rd', is_coordinator=True)
        coord_group = Group.objects.create(name='coordinator')
        coord_group.user_set.add(self.coord_user)
        self.reporter_user = User.objects.create(email='reporter', password='Pas$w0rd')
        self.vendor_user = User.objects.create(email='vendor', password='Pas$w0rd')
        group = Group.objects.create(name='vendor')
        GroupProfile.objects.create(group=group)
        group.user_set.add(self.vendor_user)

        self.case = Case.objects.create(case_id = '111111', title='Test Case', summary="This is a summary of test case")
        cp = CaseParticipant.objects.create(case=self.case, group=group)
        contact = Contact.objects.get(user=self.coord_user)
        CaseParticipant.objects.create(case=self.case, contact=contact, role="owner")

    def test_coordinator_get_advisory(self):
        client = APIClient()
        client.force_authenticate(user=self.coord_user)

        response = client.get(
            reverse('cvdp:advisoryapi', args=['111111']))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_coordinator_create_advisory(self):
        client=APIClient()
        client.force_authenticate(user=self.coord_user)

        valid_payload = {'title': 'My Advisory Title',
                         'content': '<p>Lots of markdown!</p>',
                         'references': 'www.myadvisory.com'}

        response = client.post(reverse('cvdp:advisoryapi-list', args=['111111']),
                               data=json.dumps(valid_payload),
                               content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_coordinator_invalid_advisory(self):
        client=APIClient()
        client.force_authenticate(user=self.coord_user)

        valid_payload = {'content': '<p>Lots of markdown!</p>',
                         'references': 'www.myadvisory.com'}

        response = client.post(reverse('cvdp:advisoryapi-list', args=['111111']),
                               data=json.dumps(valid_payload),
                               content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_vendor_create_advisory(self):
        client=APIClient()
        client.force_authenticate(user=self.vendor_user)

        valid_payload = {'title': 'My Advisory Title',
                         'contents': '<p>Lots of markdown!</p>',
                         'references': 'www.myadvisory.com'}

        response = client.post(reverse('cvdp:advisoryapi-list', args=['111111']),
                               data=json.dumps(valid_payload),
                               content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauth_create_advisory(self):
        valid_payload = {'title': 'My Advisory Title',
                         'contents': '<p>Lots of markdown!</p>',
                         'references': 'www.myadvisory.com'}

        response = client.post(reverse('cvdp:advisoryapi-list', args=['111111']),
            data=json.dumps(valid_payload),
            content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class CaseAdvisoryTest(TestCase):
    def setUp(self):
        self.coord_user = User.objects.create(email='coordinator', password='Pas$w0rd', is_coordinator=True)
        coord_group = Group.objects.create(name='coordinator')
        coord_group.user_set.add(self.coord_user)
        self.reporter_user = User.objects.create(email='reporter', password='Pas$w0rd')
        self.vendor_user = User.objects.create(email='vendor', password='Pas$w0rd')
        group = Group.objects.create(name='vendor')
        GroupProfile.objects.create(group=group)
        group.user_set.add(self.vendor_user)

        self.case = Case.objects.create(case_id = '111111', title='Test Case', summary="This is a summary of test case", status=Case.ACTIVE_STATUS)
        cp = CaseParticipant.objects.create(case=self.case, group=group)
        contact = Contact.objects.get(user=self.coord_user)
        CaseParticipant.objects.create(case=self.case, contact=contact, role="owner")
        advisory = CaseAdvisory(case=self.case)
        advisory.add_revision(AdvisoryRevision(user=self.coord_user,
                                               title="My cool advisory",
                                               content="SOMEHTING SOMETHING SOMETHING",
                                               references="",
                                               user_message="my first revision"),
                              save=True)

    def test_coordinator_get_advisory(self):
        client = APIClient()
        client.force_authenticate(user=self.coord_user)

        response = client.get(
            reverse('cvdp:advisoryapi', args=['111111']))

        advisory = CaseAdvisory.objects.filter(case=self.case).first()
        serializer = AdvisorySerializer(advisory.current_revision)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, serializer.data)

    def test_coordinator_delete_advisory(self):
        #should be 405 since this method was not implemented
        client = APIClient()
        client.force_authenticate(user=self.coord_user)

        response = client.delete(
	    reverse('cvdp:advisoryapi', args=['111111']))

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_coordinator_share_advisory(self):
        client = APIClient()
        client.force_authenticate(user=self.coord_user)

        response = client.patch(
            reverse('cvdp:advisoryapi', args=['111111']),
            data=json.dumps({'date_shared': str(timezone.now())}),
            content_type='application/json')

        # this advisory was not approved to share!
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        ca = CaseApproval.objects.create(case=self.case, request=2, status=CaseApproval.APPROVED)
        
        response = client.patch(
            reverse('cvdp:advisoryapi', args=['111111']),
            data=json.dumps({'date_shared': str(timezone.now())}),
            content_type='application/json')

        # TRY AGAIN
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        #make advisory shared
        
        ca = CaseAdvisory.objects.get(case=self.case)
        self.assertIsNotNone(ca.current_revision.date_shared)

        #make sure the share worked
        client.force_authenticate(user=self.vendor_user)

        #first denied because vendor has not been notified
        response = client.get(
            reverse('cvdp:advisoryapi', args=['111111']))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        group = Group.objects.get(name='vendor')
        cp = CaseParticipant.objects.filter(case=self.case, group=group).first()
        cp.notified = timezone.now()
        cp.save()

        response = client.get(
            reverse('cvdp:advisoryapi', args=['111111']))

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_vendor_share_advisory(self):
        client = APIClient()
        client.force_authenticate(user=self.vendor_user)

        response = client.patch(
            reverse('cvdp:advisoryapi', args=['111111']),
            data=json.dumps({'date_shared': str(timezone.now())}),
            content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_coordinator_get_all_revisions(self):
        client = APIClient()
        client.force_authenticate(user=self.coord_user)

        response = client.get(
            reverse('cvdp:advisoryapi-list', args=['111111']))

        advisory = AdvisoryRevision.objects.filter(advisory__case=self.case).order_by('-revision_number')
        serializer = AdvisorySerializer(advisory, many=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, serializer.data)

    def test_vendor_get_advisory(self):
        client = APIClient()
        client.force_authenticate(user=self.vendor_user)

        response = client.get(
            reverse('cvdp:advisoryapi', args=['111111']))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_vendor_get_all_revisions(self):
        client = APIClient()
        client.force_authenticate(user=self.vendor_user)

        response = client.get(
            reverse('cvdp:advisoryapi-list', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_notified_vendor_get_all_revisions(self):
        client = APIClient()
        client.force_authenticate(user=self.vendor_user)

        group = Group.objects.get(name='vendor')
        cp = CaseParticipant.objects.filter(case=self.case, group=group).first()
        cp.notified = timezone.now()
        cp.save()

        response = client.get(
            reverse('cvdp:advisoryapi-list', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_vendor_get_shared_advisory(self):
        client = APIClient()
        client.force_authenticate(user=self.vendor_user)

        group = Group.objects.get(name='vendor')
        cp = CaseParticipant.objects.filter(case=self.case, group=group).first()
        cp.notified = timezone.now()
        cp.save()

        #make advisory shared
        ca = CaseAdvisory.objects.get(case=self.case)
        ca.current_revision.date_shared=timezone.now()
        ca.current_revision.save()

        response = client.get(
            reverse('cvdp:advisoryapi', args=['111111']))

        serializer = AdvisorySerializer(ca.current_revision)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, serializer.data)

    def test_vendor_get_all_shared_revisions(self):
        client = APIClient()
        client.force_authenticate(user=self.vendor_user)

        group = Group.objects.get(name='vendor')
        cp = CaseParticipant.objects.filter(case=self.case, group=group).first()
        cp.notified = timezone.now()
        cp.save()

        #make advisory shared
        ca = CaseAdvisory.objects.get(case=self.case)
        ca.current_revision.date_shared=timezone.now()
        ca.current_revision.save()

        response = client.get(
            reverse('cvdp:advisoryapi-list', args=['111111']))

        revision = AdvisoryRevision.objects.filter(advisory__case=self.case)
        serializer = AdvisorySerializer(revision, many=True)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, serializer.data)




class CaseArtifactTest(TestCase):

    def setUp(self):
        self.coord_user = User.objects.create(email='coordinator', password='Pas$w0rd', is_coordinator=True)

        coord_group = Group.objects.create(name='coordinator')
        coord_group.user_set.add(self.coord_user)
        self.reporter_user = User.objects.create(email='reporter', password='Pas$w0rd')
        self.vendor_user = User.objects.create(email='vendor', password='Pas$w0rd')
        self.observer_user = User.objects.create(email="observer", password="Pas$w0rd")
        group = Group.objects.create(name='vendor')
        GroupProfile.objects.create(group=group)
        group.user_set.add(self.vendor_user)
        case = Case.objects.create(case_id = '111111', title='Test Case', summary="This is a summary of test case", status=Case.ACTIVE_STATUS)
        self.case = case
        contact = Contact.objects.get(user=self.coord_user)
        CaseParticipant.objects.create(case=case, group=group)
        CaseParticipant.objects.create(case=case, contact=contact, role="owner")
        contact = Contact.objects.get(user=self.observer_user)
        CaseParticipant.objects.create(case=case, contact=contact, role="observer")
        artifact = SimpleUploadedFile("artifact.jpg", b"RANDOM COnTEJKLDSJFSINTt", content_type="image/jpeg")

        artifact = add_artifact(artifact)
        action = Action(title="Uploaded file", user=self.coord_user)
        action.save()
        self.artifact = CaseArtifact(file=artifact, case=case, action=action)
        self.artifact.save()


    def test_get_case_artifacts(self):
        client = APIClient()
        client.force_authenticate(user=self.coord_user)
        response = client.get(reverse('cvdp:artifactapi', args=['111111']))

        cases = CaseArtifact.objects.filter(case__case_id='111111')
        serializer = ArtifactSerializer(cases, many=True, context={'user':self.coord_user})

        self.assertEqual(response.data, serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_get_case_artifact(self):
        client = Client()
        client.force_login(self.coord_user)
        response = client.get(reverse('cvdp:artifact', args=[self.artifact.file.uuid]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get('Content-Disposition'), "attachment; filename=\"artifact.jpg\"")

    def test_get_unauth_case_artifact(self):
        client = Client()
        response = client.get(reverse('cvdp:artifact', args=[self.artifact.file.uuid]))
        #should redirect to login
        self.assertEqual(response.status_code, 302)

    @modify_settings(MIDDLEWARE={
        'remove': 'authapp.middleware.Require2FAMiddleware'
    })
    def test_get_auth_forbid_case_artifact(self):
        client = Client()
        client.force_login(self.reporter_user)
        response = client.get(reverse('cvdp:artifact', args=[self.artifact.file.uuid]))
        self.assertEqual(response.status_code, 403)


    def test_post_case_artifact(self):
        client = APIClient()
        client.force_authenticate(user=self.coord_user)
        artifact = SimpleUploadedFile("artifact.jpg", b"RANDOM COnTEJKLDSJFSINTt", content_type="image/jpeg")
        response = client.post(
            reverse('cvdp:artifactapi', args=['111111']),
            {'file': artifact}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_forbidden_post_artifact(self):
        client = APIClient()
        client.force_authenticate(user=self.reporter_user)
        artifact = SimpleUploadedFile("artifact.jpg", b"RANDOM COnTEJKLDSJFSINTt", content_type="image/jpeg")
        response = client.post(
            reverse('cvdp:artifactapi', args=['111111']),
            {'file': artifact}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_vendor_post_case_artifact(self):
        client = APIClient()
        client.force_authenticate(user=self.vendor_user)
        group = Group.objects.get(name='vendor')
        cp = CaseParticipant.objects.filter(case=self.case, group=group).first()
        cp.notified = timezone.now()
        cp.save()
        artifact = SimpleUploadedFile("artifact.jpg", b"RANDOM COnTEJKLDSJFSINTt", content_type="image/jpeg")
        response = client.post(
            reverse('cvdp:artifactapi', args=['111111']),
            {'file': artifact}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        artifact = CaseArtifact.objects.filter(action__user=self.vendor_user).first()
        response = client.patch(
            reverse('cvdp:artifactapi-detail', args=[artifact.file.uuid]),
            data=json.dumps({'shared': True}),
            content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = client.delete(
            reverse('cvdp:artifactapi-detail', args=[artifact.file.uuid])
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        #coord user can unshare, but not fully remove
        client.force_authenticate(user=self.coord_user)
        response = client.delete(
            reverse('cvdp:artifactapi-detail', args=[artifact.file.uuid])
            )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        #make sure it still exsits, not deleted
        artifact = CaseArtifact.objects.filter(file__uuid=artifact.file.uuid).exists()
        self.assertEqual(artifact, True)

    def test_reporter_get_artifact_detail(self):
        client=APIClient()
        client.force_authenticate(user=self.reporter_user)
        artifact = CaseArtifact.objects.all().first()

        response = client.get(
            reverse('cvdp:artifactapi-detail', args=[artifact.file.uuid]))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_coord_update_remove_artifact(self):
        client=APIClient()
        client.force_authenticate(user=self.coord_user)
        artifact = CaseArtifact.objects.all().first()
        response = client.patch(
            reverse('cvdp:artifactapi-detail', args=[artifact.file.uuid]),
            data=json.dumps({'shared': True}),
            content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)


    def test_vendor_get_artifact(self):
        client = APIClient()
        client.force_authenticate(user=self.vendor_user)
        group = Group.objects.get(name='vendor')
        cp = CaseParticipant.objects.filter(case=self.case, group=group).first()
        cp.notified = timezone.now()
        cp.save()
        response = client.get(
            reverse('cvdp:artifactapi', args=['111111']))
        #should be empty since artifact wasn't shared

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_reporter_get_artifact(self):
        client = APIClient()
        client.force_authenticate(user=self.reporter_user)
        response = client.get(
            reverse('cvdp:artifactapi', args=['111111']))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_vendor_get_shared_artifact(self):
        client = APIClient()
        client.force_authenticate(user=self.vendor_user)
        artifact = CaseArtifact.objects.all().first()
        artifact.shared=True
        artifact.save()
        response = client.get(
            reverse('cvdp:artifactapi', args=['111111']))
        #should be empty since artifact wasn't shared
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_notified_vendor_get_shared_artifact(self):
        client = APIClient()
        client.force_authenticate(user=self.vendor_user)
        group = Group.objects.get(name='vendor')
        cp = CaseParticipant.objects.filter(case=self.case, group=group).first()
        cp.notified = timezone.now()
        cp.save()

        artifact = CaseArtifact.objects.all().first()
        artifact.shared=True
        artifact.save()
        response = client.get(
            reverse('cvdp:artifactapi', args=['111111']))
        #should be empty since artifact wasn't shared
        artifacts = CaseArtifact.objects.all()
        serializer = ArtifactSerializer(artifacts, many=True, context={'user':self.vendor_user})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, serializer.data)


class ComponentAPITest(TestCase):

    def setUp(self):
        self.coord_user = User.objects.create(email='coordinator', password='Pas$w0rd', is_coordinator=True)
        coord_group = Group.objects.create(name='coordinator')
        coord_group.user_set.add(self.coord_user)
        self.reporter_user = User.objects.create(email='reporter', password='Pas$w0rd')
        self.vendor_user = User.objects.create(email='vendor', password='Pas$w0rd')
        self.group = Group.objects.create(name='vendor')
        GroupProfile.objects.create(group=self.group)
        self.group.user_set.add(self.vendor_user)
        case = Case.objects.create(case_id = '111111', title='Test Case', summary="This is a summary of test case")
        contact = Contact.objects.get(user=self.coord_user)
        CaseParticipant.objects.create(case=case, group=self.group)
        CaseParticipant.objects.create(case=case, contact=contact, role="owner")

        c = Component.objects.create(name='something', version='1.2.3', parent=True)
        Product.objects.create(component=c)
        c = Component.objects.create(name='dependency x.1.2', version='2.3.4', parent=True)
        Product.objects.create(component=c)
        c = Component.objects.create(name='python', version='1.2.3.4.5', parent=True)
        Product.objects.create(component=c)
        component = Component.objects.create(name='product x', version='1.3.4', parent=True)
        Product.objects.create(component=component, supplier=self.group)
        self.valid_payload = {
            'name': 'B0dk3',
            'component_type': 'Firmware',
            'version': '123',
            'homepage': 'www.google.com/123/',
            'comment': 'This is a test component',
        }

        DefinedTag.objects.create(tag='network', category=4)

        self.invalid_payload = {
            'version': '1.2.3',
        }

    def test_coordinator_get_all_components(self):
        # get API response
        client = APIClient()

        coord_user = User.objects.get(email='coordinator')
        client.force_authenticate(user=coord_user)
        response = client.get(reverse('cvdp:componentapi'))
        logger.debug(response.data)
        # get data from db
        comps = Product.all_products().distinct('component__name', 'supplier')
        serializer = ProductSerializer(comps, many=True, context={'coordinator':coord_user.is_coordinator})
        logger.debug(serializer.data)
        #use results due to pagination
        self.assertEqual(response.data['results'], serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


    def test_vendor_products_get_all(self):
        # get API response
        client = APIClient()

        user = User.objects.get(email='vendor')
        client.force_authenticate(user=user)
        response = client.get(reverse('cvdp:componentapi')+'?my=1')
        # get data from db
        products = Product.my_products([self.group])
        serializer = ProductSerializer(products, many=True, context={'groups':user.groups.all().values_list('id', flat=True),
                                                                     'coordinator': user.is_coordinator})
        #use results due to pagination
        self.assertEqual(response.data['results'], serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unauth_component_get(self):
        client=APIClient()

        response = client.get(reverse('cvdp:componentapi'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_reporter_component_get(self):
        client = APIClient()

        user = User.objects.get(email='reporter')
        client.force_authenticate(user=user)
        response = client.get(reverse('cvdp:componentapi'))
        # random users not associated with groups cannot see component API
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_post_component(self):
        client=APIClient()

        user=User.objects.get(email='coordinator')
        client.force_authenticate(user=user)

        response = client.post(
            reverse('cvdp:componentapi'),
            data=json.dumps(self.valid_payload),
            content_type='application/json'
        )
        # owner must be present for vendor to use this endpoint
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)


    def test_reporter_post_component(self):
        client=APIClient()

        user=User.objects.get(email='reporter')
        client.force_authenticate(user=user)

        response = client.post(
            reverse('cvdp:componentapi'),
            data=json.dumps(self.valid_payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_unauth_post_component(self):
        client=APIClient()
        response = client.post(
            reverse('cvdp:componentapi'),
            data=json.dumps(self.valid_payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_invalid_post_component(self):
        client=APIClient()
        user=User.objects.get(email='coordinator')
        client.force_authenticate(user=user)
        response = client.post(
            reverse('cvdp:componentapi'),
            data=json.dumps(self.invalid_payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_vendor_post_compapi(self):
        client=APIClient()

        user=User.objects.get(email='vendor')
        client.force_authenticate(user=user)

        response = client.post(
            reverse('cvdp:componentapi'),
            data=json.dumps(self.valid_payload),
            content_type='application/json'
	)
	# owner must be present for vendor to use this endpoint
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_post_component_not_in_group(self):
        client=APIClient()

        user=User.objects.get(email='vendor')
        client.force_authenticate(user=user)

        newgroup = Group.objects.create(name='othervendor')
        gp = GroupProfile.objects.create(group=newgroup)

        newdata = self.valid_payload
        newdata['owner'] = str(gp.uuid)

        response = client.post(
            reverse('cvdp:componentapi'),
            data=json.dumps(newdata),
            content_type='application/json'
        )
	# vendor must be a part of group to use componenetapi
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_post_component_in_group(self):
        client=APIClient()

        user=User.objects.get(email='vendor')
        client.force_authenticate(user=user)

        newdata = self.valid_payload
        newdata['owner'] = str(self.group.groupprofile.uuid)

        response = client.post(
            reverse('cvdp:componentapi'),
            data=json.dumps(newdata),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_vendor_post_component(self):
        client=APIClient()

        user=User.objects.get(email='vendor')
        client.force_authenticate(user=user)

        response = client.post(
            reverse('cvdp:group_components_api', args=[self.group.groupprofile.uuid]),
            data=json.dumps(self.valid_payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_vendor_invalid_post_component(self):
        client=APIClient()

        user=User.objects.get(email='vendor')
        client.force_authenticate(user=user)
        response = client.post(
            reverse('cvdp:group_components_api', args=[self.group.groupprofile.uuid]),
            data=json.dumps(self.invalid_payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_coordinator_post_group_component(self):
        client=APIClient()

        user=User.objects.get(email='coordinator')
        client.force_authenticate(user=user)

        response = client.post(
            reverse('cvdp:group_components_api', args=[self.group.groupprofile.uuid]),
            data=json.dumps(self.valid_payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_reporter_post_group_component(self):
        client=APIClient()

        user=User.objects.get(email='reporter')
        client.force_authenticate(user=user)

        response = client.post(
            reverse('cvdp:group_components_api', args=[self.group.groupprofile.uuid]),
            data=json.dumps(self.valid_payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_group_components(self):
        client=APIClient()

        user=User.objects.get(email='vendor')
        client.force_authenticate(user=user)
        response = client.get(
            reverse('cvdp:group_components_api', args=[self.group.groupprofile.uuid]))
        products = Product.objects.filter(supplier=self.group, component__parent=True, component__deleted=False).distinct('component__name')
        serializer = ProductSerializer(products, many=True, context={'groups':user.groups.all().values_list('id', flat=True),
                                                                     'coordinator': user.is_coordinator})
        self.assertEqual(response.data['results'], serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_non_group_get_components(self):
        client=APIClient()
        user=User.objects.get(email='reporter')
        client.force_authenticate(user=user)
        response = client.get(
            reverse('cvdp:group_components_api', args=[self.group.groupprofile.uuid]))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_coord_get_group_components(self):
        client=APIClient()

        user=User.objects.get(email='coordinator')
        client.force_authenticate(user=user)
        response = client.get(
            reverse('cvdp:group_components_api', args=[self.group.groupprofile.uuid]))
        products = Product.objects.filter(supplier=self.group).distinct('component__name')
        serializer = ProductSerializer(products, many=True, context={'groups':user.groups.all().values_list('id', flat=True),
                                                                     'coordinator': user.is_coordinator})
        self.assertEqual(response.data['results'], serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_get_component_detail(self):
        # get API response
        client = APIClient()

        coord_user = User.objects.get(email='coordinator')
        client.force_authenticate(user=coord_user)
        comp = Component.objects.get(name='something')
        response = client.get(reverse('cvdp:componentapi-detail', args=[comp.product_info.id]))
        # get data from db
        serializer = ProductSerializer(comp.product_info, context={'groups':coord_user.groups.all().values_list('id', flat=True),
                                                                   'coordinator': coord_user.is_coordinator})
        #use results due to pagination
        self.assertEqual(response.data, serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unauth_and_reporter_get_component_detail(self):
        # get API response
        client = APIClient()
        comp = Component.objects.get(name='something')
        response = client.get(reverse('cvdp:componentapi-detail', args=[comp.product_info.id]))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        coord_user = User.objects.get(email='reporter')
        client.force_authenticate(user=coord_user)
        comp = Component.objects.get(name='something')
        response = client.get(reverse('cvdp:componentapi-detail', args=[comp.product_info.id]))
        # get data from db
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_vendor_get_component_detail(self):
        # get API response
        client = APIClient()
        user = User.objects.get(email='vendor')
        client.force_authenticate(user=user)
        comp = Component.objects.get(name='something')
        response = client.get(reverse('cvdp:componentapi-detail', args=[comp.product_info.id]))
        serializer = ProductSerializer(comp.product_info, context={'groups':user.groups.all().values_list('id', flat=True),
                                                                   'coordinator': user.is_coordinator})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, serializer.data)

        #vendor - should be able to get this one
        comp = Component.objects.get(name='product x')
        response = client.get(reverse('cvdp:componentapi-detail', args=[comp.product_info.id]))
        serializer = ProductSerializer(comp.product_info, context={'groups':user.groups.all().values_list('id', flat=True),
                                                                   'coordinator': user.is_coordinator})
        #use results due to pagination
        self.assertEqual(response.data, serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_component(self):
        # get API response
        client = APIClient()

        coord_user = User.objects.get(email='coordinator')
        client.force_authenticate(user=coord_user)
        comp = Component.objects.get(name='something')
        response = client.patch(
            reverse('cvdp:componentapi-detail', args=[comp.product_info.id]),
            data=json.dumps({'name': 'funtimes'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)


    def test_coordinator_tag_component(self):
        # get API response
        client = APIClient()
        coord_user = User.objects.get(email='coordinator')
        client.force_authenticate(user=coord_user)
        comp = Component.objects.get(name='something')
        response = client.patch(
            reverse('cvdp:componentapi-detail', args=[comp.product_info.id]),
            data=json.dumps({'name': 'funtimes', 'tags': ['alpha', 'beta']}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


    def test_coordinator_tag_component_success(self):
        # get API response
        client = APIClient()
        coord_user = User.objects.get(email='coordinator')
        client.force_authenticate(user=coord_user)
        comp = Component.objects.get(name='something')
        response = client.patch(
            reverse('cvdp:componentapi-detail', args=[comp.product_info.id]),
            data=json.dumps({'name': 'funtimes', 'tags': ['network']}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)


    def test_vendor_tag_component(self):
        # get API response
        client = APIClient()
        user = User.objects.get(email='vendor')
        client.force_authenticate(user=user)
        comp = Component.objects.get(name='product x')

        #tags are ignored
        response = client.patch(
            reverse('cvdp:componentapi-detail', args=[comp.product_info.id]),
            data=json.dumps({'name': 'funtimes', 'tags': ['network']}),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        comp = Component.objects.get(name='funtimes')
        tags = comp.tags.values_list('tag', flat=True)
        self.assertEqual(len(tags), 0)
        
        
    def test_reporter_update_component(self):
        # get API response
        client = APIClient()

        coord_user = User.objects.get(email='reporter')
        client.force_authenticate(user=coord_user)
        comp = Component.objects.get(name='something')
        response = client.patch(
            reverse('cvdp:componentapi-detail', args=[comp.product_info.id]),
            data=json.dumps({'name': 'funtimes'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_vendor_update_component(self):
        # get API response
        client = APIClient()

        user = User.objects.get(email='vendor')
        client.force_authenticate(user=user)
        comp = Component.objects.get(name='something')
        response = client.patch(
            reverse('cvdp:componentapi-detail', args=[comp.product_info.id]),
            data=json.dumps({'name': 'funtimes'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        comp = Component.objects.get(name='product x')
        response = client.patch(
            reverse('cvdp:componentapi-detail', args=[comp.product_info.id]),
            data=json.dumps({'version': '123'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_delete_component(self):
        client = APIClient()

        coord_user = User.objects.get(email='coordinator')
        client.force_authenticate(user=coord_user)
        comp = Component.objects.get(name='something')
        response = client.delete(
            reverse('cvdp:componentapi-detail', args=[comp.product_info.id])
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_reporter_delete_component(self):
        client = APIClient()

        user = User.objects.get(email='reporter')
        client.force_authenticate(user=user)
        comp = Component.objects.get(name='something')
        response = client.delete(
            reverse('cvdp:componentapi-detail', args=[comp.product_info.id])
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_vendor_delete_component(self):
        client = APIClient()

        user = User.objects.get(email='vendor')
        client.force_authenticate(user=user)
        comp = Component.objects.get(name='something')
        response = client.delete(
            reverse('cvdp:componentapi-detail', args=[comp.product_info.id])
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        comp = Component.objects.get(name='product x')
        response = client.delete(
            reverse('cvdp:componentapi-detail', args=[comp.product_info.id]),
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_component_dependencies(self):
        client = APIClient()

        coord_user = User.objects.get(email='coordinator')
        client.force_authenticate(user=coord_user)
        comp = Component.objects.get(name='python')
        dep = Component.objects.get(name='something')
        response = client.get(
            reverse('cvdp:componentapi-detail', args=[comp.product_info.id])
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        resp = client.patch(
            reverse('cvdp:dependencyapi', args=[comp.id]),
            data=json.dumps({'dependency':dep.id}),
            content_type='application/json')
        self.assertEqual(resp.status_code, status.HTTP_202_ACCEPTED)

        response = client.get(
            reverse('cvdp:componentapi-detail', args=[comp.id])
        )
        product = Product.objects.get(component=comp)
        serializer = ProductSerializer(product, context={'groups':coord_user.groups.all().values_list('id', flat=True),
                                                         'coordinator': coord_user.is_coordinator})
        self.assertEqual(response.data, serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_reporter_get_dependencies(self):
        client = APIClient()

        user = User.objects.get(email='reporter')
        client.force_authenticate(user=user)
        comp = Component.objects.get(name='something')
        response = client.get(
            reverse('cvdp:componentapi-detail', args=[comp.product_info.id])
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = client.patch(
            reverse('cvdp:dependencyapi', args=[comp.id]),
            data=json.dumps(self.valid_payload),
            content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_vendor_get_dependencies(self):
        client = APIClient()

        user = User.objects.get(email='coordinator')
        client.force_authenticate(user=user)
        comp = Component.objects.get(name='product x')
        dep = Component.objects.get(name='python')
        response = client.patch(
            reverse('cvdp:dependencyapi', args=[comp.id]),
            data=json.dumps({'dependency':dep.id}),
            content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        response = client.get(
            reverse('cvdp:componentapi-detail', args=[comp.id])
        )
        product = Product.objects.get(component=comp)
        serializer = ProductSerializer(product, context={'groups':user.groups.all().values_list('id', flat=True),
                                                         'coordinator': user.is_coordinator})
        self.assertEqual(response.data, serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


#Test ReportsAPIView /form/submissions/

class TestFormSubmissions(APITestCase):

    def setUp(self):
        self.api_client = APIClient()
        self.coord_user = User.objects.create(email='coordinator', password='Pas$w0rd', is_coordinator=True)
        coord_group = Group.objects.create(name='coordinator')
        coord_group.user_set.add(self.coord_user)

        coordgroup = Group.objects.create(name="CoordTeam")
        GroupProfile.objects.create(group = coordgroup, vendor_type='Coordinator')
        coordgroup.user_set.add(self.coord_user)

        config = GlobalSettings.objects.create(group=coord_group)

        self.reporter_user = User.objects.create(email='reporter', password='Pas$w0rd')
        self.vendor_user = User.objects.create(email='vendor', password='Pas$w0rd')

        self.report = ReportingForm.objects.create(title="Basic Vul Report")
        FormQuestion.objects.create(form=self.report, question='How are you?',
                                    question_type=0)
        FormQuestion.objects.create(form=self.report, question='How old are you??',
                                    question_type=1)
        FormQuestion.objects.create(form=self.report, question="Provide hidden response",
                                    question_type=0, private=True)
        fe = FormEntry.objects.create(form=self.report, created_by=self.reporter_user)

        self.form = [{"question": 'How are you?', "answer": 'Good'},
                     {"question": 'How old are you?', "ansewr": '10'},
                     {"question": "Provide hidden response", "answer": "this is private", "priv": True}]
        self.cr = CaseReport.objects.create(entry=fe, report=self.form)


    def test_get_form_submissions(self):
        self.api_client.force_authenticate(user=self.reporter_user)

        response = self.api_client.get(
            reverse('cvdp:reportsapi'))

        cr = CaseReport.objects.filter(entry__created_by=self.reporter_user)
        serializer = ReportDetailSerializer(cr, many=True)

        self.assertEqual(response.data, serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(serializer.data[0]['report']), 2)

    def test_get_case_report(self):
        self.api_client.force_authenticate(user=self.coord_user)

        Case.objects.create(case_id = '123456', status=Case.ACTIVE_STATUS, title='Test Case', summary="This is a summary of test case", report=self.cr)

        response = self.api_client.get(reverse('cvdp:caseapi-detail', args=['123456']))

        cases = Case.objects.get(case_id='123456')
        serializer = CaseCoordinatorSerializer(cases)
        #use results due to pagination
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        #make sure private responses are included
        self.assertEqual(len(serializer.data['report']['report']), 3)

    def test_coord_get_form_submissions(self):
        #should be empty since it's user specific
        self.api_client.force_authenticate(user=self.coord_user)

        response = self.api_client.get(
            reverse('cvdp:reportsapi'))

        self.assertEqual(response.data, [])
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_triage_view(self):
        self.api_client.force_authenticate(user=self.coord_user)

        case = Case(report=self.cr,
                    case_id='111111',
                    title='test case')
        case.save()

        #get triage view
        response = self.api_client.get(
            reverse('cvdp:triageapi'))

        cases = Case.objects.filter(status=Case.PENDING_STATUS)
        serializer = CaseSerializer(cases, many=True)
        #get results bc pagination
        self.assertEqual(response.data['results'], serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_vendor_get_triage_view(self):
        self.api_client.force_authenticate(user=self.vendor_user)

        case = Case(report=self.cr,
                    case_id='111111',
                    title='test case')
        case.save()

        #get triage view
        response = self.api_client.get(
            reverse('cvdp:triageapi'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauth_triage_view(self):
        response = self.api_client.get(
            reverse('cvdp:triageapi'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

class TestSystemSettings(TestCase):

    def setUp(self):
        self.coord_user = User.objects.create(email='coordinator', password='Pas$w0rd', is_coordinator=True)
        self.coord_mgr = User.objects.create(email='coord_mgr', password='Pa$sw0rd')
        coord_group = Group.objects.create(name='coordinator')
        coord_group.user_set.add(self.coord_user)
        self.staff_user = User.objects.create(email='staff', password='Pas$w0rd')
        coord_mgr_group = Group.objects.create(name='coordinator_mgr')
        coord_mgr_group.user_set.add(self.staff_user)
        self.random_user = User.objects.create(email='random@random.org', password='ABC123')

        CaseResolutionOptions.objects.create(description = 'Fixed')
        CaseResolutionOptions.objects.create(description= "Won't fix")

    def test_coordinator_get_resolutions(self):

        client = APIClient()
        client.force_authenticate(self.coord_user)

        response = client.get(reverse('cvdp:res_api'))

        resolutions = CaseResolutionOptions.objects.all()
        serializer = ResolutionSerializer(resolutions, many=True)

        self.assertEqual(response.data, serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_random_get_resolutions(self):
        client = APIClient()
        client.force_authenticate(self.random_user)

        response = client.get(reverse('cvdp:res_api'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_coordinator_add_resolution(self):
        client = APIClient()
        client.force_authenticate(self.coord_user)
        valid_payload = {'description': 'Spam - not taking case'}

        response = client.post(reverse('cvdp:res_api'),
                               data=json.dumps(valid_payload),
                               content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def	test_staffmember_add_resolution(self):
        client = APIClient()
        client.force_authenticate(self.staff_user)
        valid_payload = {'description': 'Spam - not taking case'}

        response = client.post(reverse('cvdp:res_api'),
                               data=json.dumps(valid_payload),
                               content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_random_add_resolution(self):
        client = APIClient()
        client.force_authenticate(self.random_user)
        valid_payload = {'description': 'BAD BAD BAD'}

        response = client.post(reverse('cvdp:res_api'),
                               data=json.dumps(valid_payload),
                               content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_staffmember_rm_resolution(self):

        client = APIClient()
        client.force_authenticate(self.staff_user)
        obj = CaseResolutionOptions.objects.all().first()
        response = client.delete(reverse('cvdp:res_api_detail', args=[obj.id]))

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_coord_rm_resolution(self):

        client = APIClient()
        client.force_authenticate(self.coord_user)

        #get first resolution to remove
        obj = CaseResolutionOptions.objects.all().first()
        response = client.delete(reverse('cvdp:res_api_detail', args=[obj.id]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_random_rm_resolution(self):

        client = APIClient()
        client.force_authenticate(self.random_user)

        #get first resolution to remove
        obj = CaseResolutionOptions.objects.all().first()
        response = client.delete(reverse('cvdp:res_api_detail', args=[obj.id]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_tags_api(self):

        client = APIClient()
        client.force_authenticate(self.coord_user)

        response = client.get(reverse('cvdp:tag_api'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_tags_api_random(self):

        client = APIClient()
        client.force_authenticate(self.random_user)

        response = client.get(reverse('cvdp:tag_api'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_tags_api_mgr(self):
        client = APIClient()
        client.force_authenticate(self.staff_user)

        #get first resolution to remove
        obj = DefinedTag.objects.all().first()
        response = client.get(reverse('cvdp:tag_api'))

        serializer = TagSerializer(obj, many=True)

        self.assertEqual(response.data, serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_staffmember_add_tag(self):
        client = APIClient()
        client.force_authenticate(self.staff_user)
        valid_payload = {'description': 'add tag', 'tag': 'tag', 'category': 1}

        response = client.post(reverse('cvdp:tag_api'),
                               data=json.dumps(valid_payload),
                               content_type='application/json')

        #not a valid category
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


    def test_staffmember_add_tag_success(self):
        client = APIClient()
        client.force_authenticate(self.staff_user)
        valid_payload = {'description': 'add tag', 'tag': 'tag', 'category': 'Group'}

        response = client.post(reverse('cvdp:tag_api'),
                               data=json.dumps(valid_payload),
                               content_type='application/json')

        #not a valid category
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)


    def test_staffmember_rm_tag(self):
        client = APIClient()
        client.force_authenticate(self.staff_user)
        valid_payload = {'description': 'add tag', 'tag': 'tag', 'category': 'Group'}

        response = client.post(reverse('cvdp:tag_api'),
                               data=json.dumps(valid_payload),
                               content_type='application/json')

        #not a valid category
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        #get Tag
        obj = DefinedTag.objects.all().first()

        response = client.delete(reverse('cvdp:rm_manage_tag', args=[obj.id]),
                                 content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.staff_user.is_staff = True
        self.staff_user.save()

        response = client.delete(reverse('cvdp:rm_manage_tag', args=[obj.id]),
                                 content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)


    def test_coorduser_add_tag(self):
        client = APIClient()
        client.force_authenticate(self.coord_user)
        valid_payload = {'description': 'add tag', 'tag': 'tag', 'category': 1}

        response = client.post(reverse('cvdp:tag_api'),
                               data=json.dumps(valid_payload),
                               content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_randomuser_add_tag(self):
        client = APIClient()
        client.force_authenticate(self.random_user)
        valid_payload = {'description': 'add tag', 'tag': 'tag', 'category': 1}

        response = client.post(reverse('cvdp:tag_api'),
                               data=json.dumps(valid_payload),
                               content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_vulattr_api(self):

        client = APIClient()
        client.force_authenticate(self.coord_user)

        response = client.get(reverse('cvdp:vul_attr_api'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)


    def test_vulattrs_api_random(self):

        client = APIClient()
        client.force_authenticate(self.random_user)

        response = client.get(reverse('cvdp:vul_attr_api'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_vulattrs_api_mgr(self):
        client = APIClient()
        client.force_authenticate(self.staff_user)

        #get first resolution to remove
        obj = VulAttributeKey.objects.all().first()
        response = client.get(reverse('cvdp:vul_attr_api'))

        serializer = VulAttributesSerializer(obj, many=True)

        self.assertEqual(response.data, serializer.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_staffmember_add_vulattr(self):
        client = APIClient()
        client.force_authenticate(self.staff_user)
        valid_payload = {'description': 'add vulattr'}

        response = client.post(reverse('cvdp:vul_attr_api'),
                               data=json.dumps(valid_payload),
                               content_type='application/json')

        #not a valid category
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


    def test_staffmember_add_vulattr_success(self):
        client = APIClient()
        client.force_authenticate(self.staff_user)
        valid_payload = {'description': 'add vulattr', 'attribute': 'tag'}

        response = client.post(reverse('cvdp:vul_attr_api'),
                               data=json.dumps(valid_payload),
                               content_type='application/json')

        #not a valid category
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)


    def test_staffmember_rm_vulattr(self):
        client = APIClient()
        client.force_authenticate(self.staff_user)
        valid_payload = {'description': 'add vulattr', 'attribute': 'tag'}

        response = client.post(reverse('cvdp:vul_attr_api'),
                               data=json.dumps(valid_payload),
                               content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        #get Vulattr

        #user is manager so they can remove 
        obj = VulAttributeKey.objects.all().first()

        response = client.delete(reverse('cvdp:rm_vul_attr', args=[obj.id]),
                                 content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)


    def test_coorduser_rm_vulattr(self):
        client = APIClient()
        client.force_authenticate(self.staff_user)

        valid_payload = {'description': 'add vulattr', 'attribute': 'tag'}

        response = client.post(reverse('cvdp:vul_attr_api'),
                               data=json.dumps(valid_payload),
                               content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)


        client.force_authenticate(self.coord_user)
        #user is manager so they can remove
        obj = VulAttributeKey.objects.all().first()
        
        response = client.delete(reverse('cvdp:rm_vul_attr', args=[obj.id]),
                                 content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_coorduser_add_vulattr(self):
        client = APIClient()
        client.force_authenticate(self.coord_user)
        valid_payload = {'description': 'add vulattr', 'attribute': 'tag'}

        response = client.post(reverse('cvdp:vul_attr_api'),
                               data=json.dumps(valid_payload),
                               content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_randomuser_add_vulattr(self):
        client = APIClient()
        client.force_authenticate(self.random_user)
        valid_payload = {'description': 'add tag', 'attribute': 'tag'}

        response = client.post(reverse('cvdp:vul_attr_api'),
                               data=json.dumps(valid_payload),
                               content_type='application/json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
