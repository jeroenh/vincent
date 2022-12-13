import json
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from django.test import TestCase, Client, modify_settings
from django.urls import reverse, reverse_lazy
from authapp.models import APIToken, User
from cvdp.models import *
import logging
from email.message import EmailMessage
import email.utils as utils


class APITests(APITestCase):

    def setUp(self):

        self.api_client = APIClient()
        self.service_account = User.objects.create(email='service_api', screen_name='API account', is_api_service=True)
        token = APIToken(user=self.service_account)
        self.api_key=token.generate_key()
        token.save(self.api_key)

        self.regular_account = User.objects.create(email='reg_api', screen_name="Non_service_account")
        token = APIToken(user=self.regular_account)
        self.non_service_api_key = token.generate_key()
        token.save(self.non_service_api_key)


    def test_email(self):

        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.api_key)

        message = EmailMessage()
        message.set_content('Testing 1 3 4')
        message['Subject'] = "CASE#968520 Bad things"
        message['From'] = 'me@example.com'
        message['To'] = 'user@example.com'
        message['message-id'] = utils.make_msgid(domain='localhost.com')

        email = base64.b64encode(str(message).encode("ascii")).decode('utf-8')

        email_content = {'content': email}
        content = json.dumps(email_content)
        
        response = self.client.post(reverse('cvdp:emailapi'),
                                    data=content,
                                    content_type='application/json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


    def test_rando_email(self):

        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.non_service_api_key)

        message = EmailMessage()
        message.set_content('Testing 1 3 4')
        message['Subject'] = "CASE#968520 Bad things"
        message['From'] = 'me@example.com'
        message['To'] = 'user@example.com'
        message['message-id'] = utils.make_msgid(domain='localhost.com')

        email = base64.b64encode(str(message).encode("ascii")).decode('utf-8')

        email_content = {'content': email}
        content = json.dumps(email_content)
        
        response = self.client.post(reverse('cvdp:emailapi'),
                                    data=content,
                                    content_type='application/json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_bounce(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.api_key)
        
        email = {"notificationType":"Bounce",
                 "bounce":{"feedbackId":"0100018f5e334a0b-12a3ee32-86f6-4659-b961-ac1e32f78c72-000000",
                           "bounceType":"Permanent",
                           "bounceSubType":"General",
                           "bouncedRecipients":[{"emailAddress":"test@gmail.com","action":"failed"}]},
                 "mail":{"timestamp":"2024-05-09T16:32:50.346Z",
                         "source":"Vullabs <labs-devops@analygence.com>",
                         "sourceArn":"arn:aws:ses:us-east-1:5000000:identity/labs-devops@analygence.com",
                         "sourceIp":"1.100.1.196",
                         "callerIdentity":"test",
                         "sendingAccountId":"507155647549",
                         "messageId":"0100018f5e3348aa-e2d09430-fde9-426c-833c-edb648f4bd04-000000",
                         "destination":["test@gmail.com"],"headersTruncated": False,
                         "headers":[{"name":"Content-Type",
                                     "value":"multipart/alternative; boundary=\"===============5005381532979749293==\""},{"name":"MIME-Version","value":"1.0"},
                                    {"name":"Subject","value":"You are invited to join"},
                                    {"name":"From","value":"Vullabs <labs-devops@analygence.com>"},
                                    {"name":"To","value":"test@gmail.com"},
                                    {"name":"Reply-To","value":"labs-devops@analygence.com"},
                                    {"name":"Date","value":"Thu, 09 May 2024 16:32:50 -0000"},
                                    {"name":"Message-ID",
                                     "value":"<171527237029.155.10306261281960721556@ip-10-0-1-145.us-east-2.compute.internal>"}],
                         "commonHeaders":{"from":["Vullabs <labs-devops@analygence.com>"],
                                          "replyTo":["labs-devops@analygence.com"],
                                          "date":"Thu, 09 May 2024 16:32:50 -0000","to":["test@gmail.com"],
                                          "messageId":"<171527237029.155.10306261281960721556@ip-10-0-1-145.us-east-2.compute.internal>","subject":"You are invited to join"}}}

        data = {'content': json.dumps(email)}

        response = self.client.post(reverse('cvdp:bounce_api'),
                                    data=data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)


    def test_other_key_bounce(self):
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.non_service_api_key)
        
        email = {"notificationType":"Bounce",
                 "bounce":{"feedbackId":"0100018f5e334a0b-12a3ee32-86f6-4659-b961-ac1e32f78c72-000000",
                           "bounceType":"Permanent",
                           "bounceSubType":"General",
                           "bouncedRecipients":[{"emailAddress":"test@gmail.com","action":"failed"}]},
                 "mail":{"timestamp":"2024-05-09T16:32:50.346Z",
                         "source":"Vullabs <labs-devops@analygence.com>",
                         "sourceArn":"arn:aws:ses:us-east-1:5000000:identity/labs-devops@analygence.com",
                         "sourceIp":"1.100.1.196",
                         "callerIdentity":"test",
                         "sendingAccountId":"507155647549",
                         "messageId":"0100018f5e3348aa-e2d09430-fde9-426c-833c-edb648f4bd04-000000",
                         "destination":["test@gmail.com"],"headersTruncated": False,
                         "headers":[{"name":"Content-Type",
                                     "value":"multipart/alternative; boundary=\"===============5005381532979749293==\""},{"name":"MIME-Version","value":"1.0"},
                                    {"name":"Subject","value":"You are invited to join"},
                                    {"name":"From","value":"Vullabs <labs-devops@analygence.com>"},
                                    {"name":"To","value":"test@gmail.com"},
                                    {"name":"Reply-To","value":"labs-devops@analygence.com"},
                                    {"name":"Date","value":"Thu, 09 May 2024 16:32:50 -0000"},
                                    {"name":"Message-ID",
                                     "value":"<171527237029.155.10306261281960721556@ip-10-0-1-145.us-east-2.compute.internal>"}],
                         "commonHeaders":{"from":["Vullabs <labs-devops@analygence.com>"],
                                          "replyTo":["labs-devops@analygence.com"],
                                          "date":"Thu, 09 May 2024 16:32:50 -0000","to":["test@gmail.com"],
                                          "messageId":"<171527237029.155.10306261281960721556@ip-10-0-1-145.us-east-2.compute.internal>","subject":"You are invited to join"}}}

        data = {'content': json.dumps(email)}

        response = self.client.post(reverse('cvdp:bounce_api'),
                                    data=data)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        
        
