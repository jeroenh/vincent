# -*- coding: utf-8 -*-                                                         
from __future__ import unicode_literals
import os
import sys
import json
import base64
import requests
import mimetypes
import environ
from django.core.management.base import BaseCommand, CommandError
from cvdp.models import CWEDescriptions
import logging
import pprint
from email.message import EmailMessage
import email.utils as utils

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Test email->ticket API call'
    
    def add_arguments(self, parser):
        parser.add_argument('--from', nargs='?', type=str, default='me@example.com')
        parser.add_argument('--to', nargs='?', type=str, default='user@example.com')
        parser.add_argument('--subject', nargs='?', type=str, default='Your subject here')
        parser.add_argument('--reply', nargs='?', type=str, default=None)
        parser.add_argument('--token', nargs='?', type=str, default=None)
        parser.add_argument('--files', nargs='*', default=[], action='append')
    def handle(self, *args, **options):

        env = environ.Env(
            DEBUG=(bool, False)
        )
        
        environ.Env.read_env()
        
        message = EmailMessage()
        message.set_content('Message content here')
        message['Subject'] = options['subject']
        message['From'] = options['from']
        message['To'] = options['to']
        message['message-id'] = utils.make_msgid(domain='localhost.com')

        if options['reply']:
            message.add_header('In-Reply-To', options['reply'])
            message.add_header('References', options['reply'])

        if options['token']:
            token = options['token']
        else:
            token = env('API_TOKEN')

        if options['files']:
            
            for filename in options['files']:
                print(filename[0])
                ctype, encoding = mimetypes.guess_type(filename[0])
                if ctype is None or encoding is not None:
                    # No guess could be made, or the file is encoded (compressed), so
                    # use a generic bag-of-bits type.
                    ctype = 'application/octet-stream'
                maintype, subtype = ctype.split('/', 1)
                with open(filename[0], 'rb') as attachedfile:
                    content = attachedfile.read()
                    message.add_attachment(content,
                                           maintype=maintype,
                                           subtype=subtype,
                                           filename=filename[0])
                        #message.attach(filename[0], content)
            
        url = "http://localhost:8000/advise"
        
        #headers={'content-type':'application/json'} #, 'Authorization': "Token {}".format(token) }
        
        api = '/api/incoming/'

        email = base64.b64encode(str(message).encode("ascii"))
        
        data = {'content': email}
        
        r = requests.post(f'{url}{api}', data=data)#, headers=headers, stream=True)
        
        print(f"{api} {r.status_code}")
        if (r == None or (r.status_code != requests.codes.ok)):
            print(r.json())
            print(r.status_code)
        else:
            pprint.pprint(r.json())

        logger.info(f"Message with {message['message-id']} message ID sent.")
                


                        
