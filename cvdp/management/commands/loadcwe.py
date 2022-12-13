from __future__ import unicode_literals
import os
import sys
import json
from datetime import datetime
from django.core.management.base import BaseCommand, CommandError
from cvdp.models import CWEDescriptions
from urllib.request import urlopen
from shutil import copyfileobj
from django.utils.timezone import make_aware
import tempfile
import zipfile
import logging
import requests
import traceback
import sys
import xml.etree.ElementTree as ET

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class Command(BaseCommand):
    help = 'Import CVE vulnerability data into postgres db'

    def add_arguments(self, parser):
        parser.add_argument('in', nargs='?', type=str)


    def parse_cwes(self, xml_data):
        # Parse the XML data
        root = ET.fromstring(xml_data)

        # Since the XML has a default namespace, we need to define it for searching tags
        ns = {'default': 'http://cwe.mitre.org/cwe-7'}
        cwes = 0
        added = 0
        id_1003 = []
        #get Cwes in 1003 view
        for member in root.findall("default:Views/default:View[@ID='1003']", ns):
            members = member.findall('default:Members/default:Has_Member', ns)
            for m in members:
                id_1003.append(m.get('CWE_ID'))

        # Navigate through the XML tree and extract details
        for weakness in root.findall('default:Weaknesses/default:Weakness', ns):
            # Extract the attributes of each Weakness element
            slice03 = False
            parents = []
            id = weakness.get('ID')
            name = weakness.get('Name')
            description = weakness.find('default:Description', ns).text if weakness.find('default:Description', ns) is not None else "No description"

            mapnote =  weakness.find('default:Mapping_Notes', ns)
            usage_notes = mapnote.find('default:Usage', ns).text


            if id in id_1003:
                slice03 = True

            # Handling related weaknesses
            related_weaknesses = weakness.find('default:Related_Weaknesses', ns)
            if related_weaknesses is not None:
                for related in related_weaknesses.findall('default:Related_Weakness', ns):
                    cwe_id = related.get('CWE_ID')
                    view_id = related.get('View_ID')
                    parents.append(cwe_id)
                    #print(f"{cwe_id} {view_id}")
                    if view_id == "1003":
                        slice03=True
                        
            # Print out the details
            #print(f"Weakness ID: {id}")
            #print(f"Name: {name}")
            #print(f"Description: {description}")
            cwes = cwes + 1

            #check to see if we have this CWE
            cwe = f"CWE-{id} {name}"
            old_cwe = CWEDescriptions.objects.filter(cwe=cwe).first()
            if old_cwe:
                old_cwe.cweid = f"CWE-{id}"
                old_cwe.description = description
                old_cwe.usage = usage_notes
                old_cwe.slice_1003 = slice03
                old_cwe.save()
            else:
                old_cwe = CWEDescriptions(cwe = cwe,
                                          usage = usage_notes,
                                          cweid = f"CWE-{id}",
                                          slice_1003 = slice03,
                                          description = description)
                old_cwe.save()

                added = added + 1
            #handle parent/children
            for p in parents:
                pcwe = f"CWE-{p}"
                par = CWEDescriptions.objects.filter(cweid=pcwe).first()
                if par:
                    if (old_cwe.cwe not in par.children):
                        par.children.append(old_cwe.cwe)
                        par.save()

                
            # add CWE-no-info
        cwe_no_info = CWEDescriptions.objects.filter(cweid=f"CWE-noinfo").first()
        if not cwe_no_info:
            cwe_no_info = CWEDescriptions(cwe="CWE-noinfo Not enough information",
                                          cweid="CWE-noinfo",
                                          slice_1003 = True,
                                          description="Not enough information")
        cwe_no_info.save()
                                

        logger.warning(f"Parsed {cwes}, Added {added}")

    def handle(self, *args, **options):

        try:

            if options['in']:
                logger.warning("extract CWEs...")
                with open(options['in'], 'r') as in_f:
                    self.parse_cwes(in_f.read().encode('utf-8'))
            else:
                logger.warning("No file provided, downloading latest file")
                #download file
                url = "https://api.github.com/repos/cveproject/cvelistv5/releases/latest"
                logger.warning("sorry not implemented yet")


        except KeyboardInterrupt:
            print("exiting...")
            sys.exit(0)
