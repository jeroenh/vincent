from cvdp.models import *
from cvdp.components.models import ComponentStatus, Product
from django.contrib.auth.models import Group
from django.conf import settings
from django.core.files.uploadedfile import InMemoryUploadedFile
from cvdp.md_utils import markdown
from cvdp.mailer import send_daily_digest_mail
import random
import base64
from cvdp.permissions import InvalidRoleException, my_case_vendors, is_coordinator, my_coord_teams, my_cases, get_coord_team, get_case_users_in_group, get_coord_teams
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from django.utils.encoding import smart_str
from django.utils.timezone import make_aware
from cvdp.appcomms.appcommunicator import cvdp_send_email
import re
import json
import requests
import email
import email.header
import encodings
import mimetypes
import pkgutil
import os
import time
import logging
from io import BytesIO

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


def validate_recaptcha(token):
    data = {
        "secret": settings.RECAPTCHA_PRIVATE_KEY,
        "response": token,
    }
    req_object = requests.post(url = "https://www.google.com/recaptcha/api/siteverify",
                               data=data,
                               headers={
                                   "Content-type": "application/x-www-form-urlencoded",
                                   "User-agent": "reCAPTCHA Django",
                               })
    resp = req_object.json()
    logger.debug(resp)
    if resp['success']:
        if resp.get('score'):
            #v3 recaptcha
            if resp['score'] > settings.RECAPTCHA_SUCCESS_SCORE:
                return True
            else:
                return False
        return True
    return False


def validate_turnstile(token):

    
    data = {
        "secret": settings.TURNSTILE_SECRET_KEY,
        "response": token
    }
    try:
        response = requests.post(url = "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                                 data=data
                                 )
        response.raise_for_status()
        resp = response.json()
        logger.debug(resp)
        if resp['success']:
            return True
        return False
    except requests.RequestException as e:
        logger.warning(f"Turnstile validation error: {e}")
        return False


#this bumps the case into the next state by order
def bump_case_state(case, state=None, force=False):
    current_case_state = None

    logger.debug(case.state)
    if state:
        if (case.state):
            current_case_state = CaseState.objects.filter(name=case.state).first()
        next_state = CaseState.objects.filter(code = state).first()
        if not next_state:
            return

        logger.debug(next_state)
        if force:
            case.state = next_state.name
            case.save()
        elif next_state.parent:
            parent_state = CaseState.objects.filter(code = next_state.parent).first()
            if (parent_state.order and current_case_state.order and (parent_state.order >= current_case_state.order)):
                case.state = next_state.name
                case.save()
        elif ((not current_case_state) or (current_case_state.order and (next_state.order > current_case_state.order))):
            case.state = next_state.name
            case.save()

        if case.state != current_case_state:
            action = create_case_action("updated case state", None, case, False, state=next_state)
            create_case_change(action, "state", current_case_state, case.state)
        return

    if case.state:
        current_case_state = CaseState.objects.filter(name=case.state).first()
        next_state = CaseState.objects.filter(order = current_case_state.order + 1).exclude(parent__isnull=False).first()
        if next_state:
            case.state = next_state.name
            case.save()
            action = create_case_action("updated case state", None, case, False, state=next_state)
            create_case_change(action, "state", current_case_state, case.state)
            return

    #otherwise get initial state
    next_state = CaseState.objects.filter(parent__isnull=True).order_by('order')
    if next_state:
        case.state = next_state.name
        case.save()


def check_all_cves_published(case):

    #get all vulnerabilities in case
    vuls_can_publish = Vulnerability.objects.filter(case=case, deleted=False, publish=True).count()
    vuls_published = Vulnerability.objects.filter(case=case, deleted=False, publish=True).exclude(date_published__isnull=True).count()
    if vuls_can_publish > 0:
        if vuls_can_publish != vuls_published:
            return
        else:
            #Milestone ACHIEVED.
            bump_case_state(case, "cves_published")

def send_vendor_status_update_email(case):

    send_case_notify_email("case_notify", "Vendor has updated status", case)


def send_case_notify_email(template, action, case):

    context = {'template': template, 'url': f'{settings.SERVER_NAME}{case.get_absolute_url()}', 'prepend': case.caseid, 'action': action}

    owners = list(CaseParticipant.objects.filter(case=case, role='owner').exclude(contact__isnull=True).values_list('contact__user__email', flat=True))

    cvdp_send_email(None, None, owners, **context)


def send_template_email(template, emails, context):

    if context:
        context['template'] =  template
    else:
        context = {'template': template}

    cvdp_send_email(None, None, emails, **context)


def send_ticket_assignment_email(ticket, assigned_by):

    context = {}

    if ticket.assigned_to == assigned_by:
        #same person!
        return

    context['template'] = "ticket_assignment"
    emails = [ticket.assigned_to.email]
    if (assigned_by):
        context['assignee'] = assigned_by.screen_name
    else:
        context['assignee'] = "auto-created"

    context['url'] = f'{settings.SERVER_NAME}{ticket.get_absolute_url()}'

    cvdp_send_email(None, None, emails, **context)


def send_ticket_comment_email(ticket, commenter):
    context = {}

    if not ticket.assigned_to:
        return

    if ticket.assigned_to == commenter:
        #same person!
        return

    context['template'] = "ticket_comment"
    emails = [ticket.assigned_to.email]
    context['assignee'] = commenter.screen_name
    context['url'] = f'{settings.SERVER_NAME}{ticket.get_absolute_url()}'

    cvdp_send_email(None, None, emails, **context)

def check_permissions(user):

    groups = user.groups.exclude(groupprofile__isnull=True)
    #look up contact
    my_contact = Contact.objects.filter(email=user.email).first()

    #am I in all the groups I'm supposed to be in?
    cas = ContactAssociation.objects.filter(contact=my_contact, verified=True)
    for x in cas:
        if not user.groups.filter(id=x.group.id).exists():
            x.group.user_set.add(user)
            logger.debug(f"Adding user {user} to {x.group}")

    if len(cas) != len(groups):
        logger.debug("something doesn't match")
        for g in user.groups.exclude(groupprofile__isnull=True):
            if not(cas.filter(group=g).exists()):
                logger.info(f"Removing {user.username} from group {g.name}")
                g.user_set.remove(user)



#this algorithm is based on the smooth weighted round robin here:
#https://github.com/nginx/nginx/commit/52327e0627f49dbda1e8db695e63a4b0af4448b1

def get_next_assignment(data):
    if len(data) == 0:
        return None
    if len(data) == 1:
        return data[0].user

    total_weight = 0
    result = None

    for entry in data:
        entry.current_weight += entry.effective_weight
        total_weight += entry.effective_weight
        if entry.effective_weight < entry.weight:
            entry.effective_weight += 1
        if not result or result.current_weight < entry.current_weight:
            result = entry
        entry.save()
    if not result:  # this should be unreachable, but check anyway
        logger.warning("Auto Assignment error")
        return None

    result.current_weight -= total_weight
    result.save()
    return result.user


def auto_assignment(role, exclude=None):
    #get users for this role

    users = UserAssignmentWeight.objects.filter(role__id=role)
    """
    #are any of these users OOF today?
    oof_users = get_oof_users()
    if oof_users:
	users = users.exclude(user__in=oof_users)
    """
    if exclude:
        #should anyone be excluded?
        users = users.exclude(user=exclude)

    if users:
        return get_next_assignment(users)

    return None


def create_api_account(group):
    accounts = group.user_set.filter(api_account=True).count()

    #get support email to make the account
    emails = group.groupprofile.support_emails
    not_found = True

    new_account_email = None

    while not_found:
        accounts = accounts + 1
        logger.debug(accounts)
        parts = emails[0].strip().split('@', 1)
        if len(parts) > 1:
            parts[0] = f"{parts[0]}+API{accounts}"
        new_account_email = '@'.join(parts)

        #does user exist ?
        if User.objects.filter(username=new_account_email).exists():
            if accounts > 30:
                break
            continue
        else:
            not_found = False

    return new_account_email

def generate_case_id():
    while (1):
        cid = random.randint(100000, 999999)
        #check if already used
        case = Case.objects.filter(case_id=cid).first()
        if case == None:
            return cid


def create_case_thread(case, official):

    thread, created = CaseThread.objects.update_or_create(case = case,
                                                          defaults = {
                                                              'created_by': case.created_by,
                                                              'subject': 'Official Case Thread',
                                                              'official': official})
    return thread

def setup_new_case(case):

    thread = create_case_thread(case, True)

    case.due_date = datetime.now() + timedelta(days=45)
    case.due_date = make_aware(case.due_date)
    #get initial case state
    state = CaseState.objects.filter(parent__isnull=True).order_by('order').first()
    if state:
        case.state = state.name
    case.save()

    if case.created_by:
        if is_coordinator(case.created_by):
            #add case assignment

            my_coord_team = my_coord_teams(case.created_by)
            if my_coord_team:
                my_team = my_coord_team.first()
                add_new_case_participant(thread, my_team.groupprofile.uuid, case.created_by, "owner")

            cp, created = CaseParticipant.objects.update_or_create(case=case,
                                                                   contact = case.created_by.contact,
                                                                   defaults = {
                                                                       'user':case.created_by,
                                                                       'role': 'owner',
                                                                       'notified': timezone.now(),
                                                                       'title': case.created_by.screen_name,
                                                                   })
            #add owner to official case thread

            CaseThreadParticipant.objects.update_or_create(thread=thread,
                                                       participant=cp,
                                                           defaults = {
                                                               'added_by': case.created_by
                                                           })



def add_new_case_participant(thread, name, user, role):

    #is this uuid a contact or group?
    group = None
    contact = Contact.objects.filter(uuid=name).first()
    created = False
    role_change = False
    if contact:
        cp = CaseParticipant.objects.filter(case=thread.case, contact=contact).first()
        if cp:
            if (role and cp.role != role):
                #TODO: ADD Activity for role change
                if role == "owner":
                    if contact.user:
                        if not is_coordinator(contact.user):
                            raise InvalidRoleException(f"Participant {contact.user.screen_name} can't be case owner")
                        else:
                            team = get_coord_team(thread.case.id).values_list('id', flat=True)
                            if team and contact.user.groups.filter(id__in=team):
                                cp.notified = timezone.now()
                                logger.debug(f"AUTO NOTIFYING USER - user gets assignment email - {timezone.now()}")
                            else:
                                raise InvalidRoleException(f"Participant {contact.user.screen_name} can't be case owner")
                    else:
                        raise InvalidRoleException(f"Participant {contact.user.screen_name} can't be case owner")

                cp.role = role
                cp.save()
                role_change=True

        else:
            if contact.user:
                title = contact.user.screen_name
            else:
                title = contact.name
            cp = CaseParticipant(case=thread.case,
                                 contact = contact,
                                 title = title,
                                 user = user)
            if role:
                if role == "owner":
                    if contact.user:
                        if not is_coordinator(contact.user):
                            raise InvalidRoleException("Participant can't be case owner")
                        else:
                            team = get_coord_team(thread.case.id).values_list('id', flat=True)
                            if team and contact.user.groups.filter(id__in=team):
                                cp.notified = timezone.now()
                                logger.debug(f"AUTO NOTIFYING USER - user gets assignment email - {timezone.now()}")
                            else:
                                raise InvalidRoleException(f"Participant {contact.user.screen_name} can't be case owner")
                    else:
                        raise InvalidRoleException(f"Participant {contact.user.screen_name} can't be case owner")

                cp.role = role
            cp.save()
            created = True
    else:
        group = Group.objects.filter(groupprofile__uuid=name).first()
        if group:
            cp = CaseParticipant.objects.filter(case=thread.case, group=group).first()
            if cp:
                if (role and cp.role != role):
                    if role == "owner":
                        if group.groupprofile.vendor_type != "Coordinator":
                            raise InvalidRoleException(f"Group {group.name} cannot be made owner")
                        cp.notified = timezone.now()
                    #TODO: ADD ACTIVITY
                    cp.role = role
                    role_change = True
                    cp.save()
            else:
                cp = CaseParticipant(case=thread.case,
                                     group=group,
                                     title = group.name,
                                     user = user)
                if role:
                    if role == "owner":
                        if group.groupprofile.vendor_type != "Coordinator":
                            raise InvalidRoleException(f"Group {group.name} cannot be made owner")
                        cp.notified = timezone.now()
                    cp.role = role
                cp.save()
                created=True

    if cp:
        ctp, ctp_created = CaseThreadParticipant.objects.update_or_create(thread=thread,
                                                                          participant=cp,
                                                                          defaults = {
                                                                              'added_by': user
                                                                          })
        """
        #I think an email should only be sent when a post is created
        if ctp_created:
            email_context = {'url': thread.case.get_absolute_url(), 'case': thread.case.caseid, 'template': 'new_thread', 'assignee': user.screen_name}
            if cp.contact and (contact.email != user.email):
                cvdp_send_email(None, None, [cp.contact.email], **email_context)
            elif cp.group:
                group_emails = []
                group_users = User.objects.filter(groups__id=ctp.participant.group.id, is_active=True, api_account=False, pending=False)
                for x in group_users:
                    group_emails.append(x.email)
                cvdp_send_email(None, None, group_emails, **email_context)
        """

    if ((created or role_change) and role == "owner"):
        assigner = "system"
        if user:
            assigner = user.screen_name

        if group:
            email_context = {'url': f'{settings.SERVER_NAME}{thread.case.get_absolute_url()}', 'case': thread.case.caseid, 'template': "team_assignment", 'prepend': thread.case.caseid, 'assignee': assigner}
        else:
            email_context = {'url': f'{settings.SERVER_NAME}{thread.case.get_absolute_url()}', 'case': thread.case.caseid, 'template': "case_assignment", 'prepend': thread.case.caseid, 'assignee': assigner}


        #if this user assigned themselves, don't send an email
        if contact and user and (contact.email != user.email):
            #send email to newly assigned user
            cvdp_send_email(None, None, [contact.email], **email_context)
        elif group and user:
            #WHO DO WE EMAIL WHEN group is assigned?? TEAM EMAIL
            if not user.groups.filter(id=group.id).exists():
                #only email group if user that assigned it isn't in the group
                cvdp_send_email(None, None, [group.groupprofile.support_email], **email_context)

    if created:
        return cp

    if ctp_created:
        #added participant to a new thread
        return cp

    return None

def notify_case_participant(participant, subject, content, user):
     #is this uuid a contact or group?
    participant.notified = timezone.now()
    participant.save()

    # don't send an email if there is no subject or content

    if subject and content:

        email_context={'url': f'{settings.SERVER_NAME}{participant.case.get_absolute_url()}', 'case': participant.case.caseid, 'prepend':participant.case.caseid}
        if participant.contact:
            cvdp_send_email(subject, content, [participant.contact.email], **email_context)
        else:
            #get all emails in group
            group_emails = []
            group_users = User.objects.filter(groups__id=participant.group.id, is_active=True, api_account=False, pending=False)
            for x in group_users:
                group_emails.append(x.email)
            cvdp_send_email(subject, content, group_emails, **email_context)


def add_artifact(file):

    filename = smart_str(file.name)
    print(file.name)
    try:
        mime_type = file.content_type
    except:
        mime_type = mimetypes.guess_type(filename, strict=False)[0]
        if not(mime_type):
            mime_type = 'application/octet-stream'

    att = Attachment(
        file=file,
        filename=os.path.basename(filename),
        mime_type=mime_type,
        size=file.size)
    att.save()
    print(att.filename)
    return att


def get_casethread_user_participants(thread, group=None):

    #only send emails to users that have been notified
    participants = CaseThreadParticipant.objects.filter(thread=thread).exclude(participant__notified__isnull=True)

    contacts = list(participants.filter(participant__contact__isnull=False).values_list('participant__contact__user__email', flat=True))

    groups = participants.filter(participant__group__isnull=False).values_list('participant__group__id', flat=True)
    if group:
        # exclude own user's group
        groups = groups.exclude(participant__group=group)

    users = list(User.objects.filter(groups__id__in=groups, is_active=True, api_account=False, pending=False).values_list('email', flat=True))

    #combine lists and de-duplicate
    return list(set(users) | set(contacts))


def get_post_mentions(post):
    logger.debug(post.content)

    mentions = []
    user_emails = []
    group_emails = []
    html_text = markdown(post.content)

    soup = BeautifulSoup(html_text, 'html.parser')
    user_mentions = []
    for mention in soup.select('span.mention'):
        logger.debug(mention)
        #get data.value
        if mention.get('data-id'):
            cp = CaseParticipant.objects.filter(id=mention['data-id']).first()
            if (cp.case.id == post.post.thread.case.id):
                #case should be the same - if not abort
                m = mention.get_text()
                logger.debug(f"mention is {mention.get_text()}")
                if (cp.contact):
                    if (cp.contact.user.screen_name in m):
                        user_emails.append(cp.contact.user.email)
                elif (cp.group):
                    group_users = get_case_users_in_group(cp)
                    if (cp.group.name in m):
                        #only get users that have access to this case!
                        group_users = list(group_users.values_list('email', flat=True))
                        if group_users:
                            group_emails.extend(group_users)
                    elif group_users.filter(screen_name__contains=m[1:]).exists():
                        gu = group_users.filter(screen_name__contains=m[1:]).first()
                        if gu:
                            user_emails.append(gu.email)
                    else:
                        gs = GlobalSettings.objects.all().first()
                        if gs and gs.coordinator_identity and gs.coordinator_identity in m:
                            group_users = list(group_users.values_list('email', flat=True))
                            logger.debug(group_users)
                            if group_users:
                                group_emails.extend(group_users)

            else:
                logger.warning(f"mention case participant is not related to case {mention}")
            mentions.append(mention['data-id'])


    return user_emails, group_emails


def compare_attributes(vul, action, new_attributes):

    old_attributes = VulAttributes.objects.filter(vul=vul)

    for attr in new_attributes:
        val = old_attributes.filter(name=attr.get('name')).first()
        if val:
            if (attr.get('value')):
                if (val.value != attr.get('value')):
                    #attribute value changed
                    create_case_change(action, "attributes", f"{val.name}: {val.value}", f"{attr.get('name')}: {attr.get('value')}")
            else:
                #attribute removed
                create_case_change(action, "attributes", f"{val.name}: {val.value}", None);
        else:
            #attribute added
            create_case_change(action, "attributes", None, f"{attr.get('name')}: {attr.get('value')}")
            


def create_case_action(title, user, case, share=False, email=False, state=None):
    action = CaseAction(case = case,
                        user=user,
                        title=title,
                        state=state,
                        created=timezone.now())
    if share:
        action.action_type=1
    action.save()

    #this is easier than trying to do it on every model change
    case.modified = timezone.now()
    case.save()

    if email:
        send_case_notify_email("case_notify", title, case)

    return action


def create_case_change(action, field, old_value, new_value):

    if (not old_value and not new_value):
        #ignore if change is going from null to [] or vice versa
        return

    change = CaseChange(action=action,
                        field = field,
                        old_value=old_value,
                        new_value=new_value)
    change.save()
    return change

def create_contact_action(title, user, contact, share=True):
    action = ContactAction(contact=contact,
                           user=user,
                           title=title,
                           share=share,
                           created=timezone.now())
    action.save()
    return action

def create_group_action(title, user, group, share=True):

    action = ContactAction(group=group,
                           user=user,
                           title=title,
                           share=share,
                           created=timezone.now())
    action.save()
    return action

def create_contact_change(action, field, old_value, new_value):
    if (not old_value and not new_value):
	#ignore if change is going from null to [] or vice versa
        return

    change = ContactChange(action=action,
			   field = field,
                           old_value=old_value,
                           new_value=new_value)
    change.save()
    return change

def get_status_status(case, user):
    # if no vuls, no status
    if (not Vulnerability.objects.filter(case=case, deleted=False).exists()):
        return False
    # is status required for this case by this user?

    components = ComponentStatus.objects.filter(vul__case=case).distinct('component__id').order_by('component__id')
    if components:
        case_components = components.values_list('component__id', flat=True)
        my_groups = my_case_vendors(user, case)
        if my_groups:
            if case_components:
                products = Product.objects.filter(supplier__in=my_groups, component__in=case_components).values_list('component__id', flat=True)
                return not(components.filter(component__id__in=products).exists())
        else:
            #any status made by this user?
            return not(components.filter(current_revision__user=user).exists())

    return True


def retrieve_attachment(blob):
    try:
        content_disposition = blob.get("Content-Disposition", None)
    except AttributeError:
        return None
    logger.debug("IN PARSE ATTACHMENT %s" % content_disposition)
    logger.debug(blob.get_content_type())
    if blob.get_content_type() == "application/pgp-signature":
        # don't want pgp attachments
        return

    if content_disposition:
        dispositions = content_disposition.strip().split(";")
        if bool(content_disposition and dispositions[0].lower() in ["attachment", "inline"]):
            file_data = blob.get_payload(decode=True)
            attachment = BytesIO(file_data)
            attachment.content_type = blob.get_content_type()
            if file_data:
                attachment.size = len(file_data)
            else:
                return None
            attachment.name = None
            attachment.create_date = None
            attachment.mod_date = None
            attachment.read_date = None
            for param in dispositions[1:]:
                name,value = param.split("=")
                # remove bogus linefeed junk
                name = name.strip("\\r\\n ").lower()
                # now take care of other whitespace
                name = name.strip()
                # handle multi-entry filenames correctly
                if name.startswith("filename"):
                    # we've got text, so initialize for realz
                    if not attachment.name:
                        attachment.name = ""
                    # remove extraneous quotes
                    value = value.strip('\"')
                    attachment.name += value
                    logger.debug("attachment.name is %s" % attachment.name)
                elif name == "create-date":
                    attachment.create_date = value  #TODO: datetime
                elif name == "modification-date":
                    attachment.mod_date = value #TODO: datetime
                elif name == "read-date":
                    attachment.read_date = value #TODO: datetime
            logger.debug(attachment.name)
            return InMemoryUploadedFile(attachment, None,
                                        attachment.name,
                                        attachment.content_type,
                                        attachment.size, None)
    return None




def decode_email_header(data, errors='backslashreplace'):
    # decode_header returns tuples containing the data field and encoding type.
    # In this usage, we only supply one data field and so we only want the first
    # tuple, and we only care about the returned data part, not the encoding type.

    logger.debug(data)
    if not(data):
        return None

    header_data = email.header.decode_header(data)
    header_parts = []
    for (blob, encoding) in header_data:
        # now we could have bytes, and we need to return ascii-encoded string, so do
        # python decoding magic.
        try:
            if isinstance(blob, bytes):
                blob = blob.decode('us-ascii', errors=errors)
        except UnicodeDecodeError:
            logger.error(f"Failed to decode text from header, data: '{blob}', encoding: '{encoding}'")
            blob = "[encoded text failed to decode]"
        header_parts.append(blob)
    header = " ".join(header_parts)

    return header



def get_encodings():
    enc_types = set([name for importer, name, ispkg in pkgutil.walk_packages(path=[os.path.dirname(encodings.__file__)], prefix='')])
    aliases = set(encodings.aliases.aliases.values())
    return enc_types.union(aliases)

def decode_email(content):
    email_msg = None

    for enctype in get_encodings():
        try:
            email_msg = content.decode(enctype)
        except Exception:
            continue
        else:
            logger.debug(f"used enctype {enctype}")
            break

    return email_msg



def process_email_attachments(ticket, email_attachments):

    if not email_attachments:
        return


    for attachment in email_attachments:

        f = add_artifact(attachment)
        if f:
            EmailAttachment.objects.create(file=f,
                                           ticket=ticket)


def create_bounce_ticket(content):

    bouncetype = BounceEmailNotification.TRANSIENT

    try:
        
        content = json.loads(content)
        
        logger.debug(content)
    
        bounce = content.get('bounce')
        if bounce:
            btype=bounce.get('bounceType')
            if (btype == 'Transient'):
                b_type = BounceEmailNotification.TRANSIENT
            else:
                b_type = BounceEmailNotification.PERMANENT
            bouncetype = b_type
            
        mail = content.get('mail')
    
        headers = mail.get('commonHeaders')
        logger.debug(headers)
        if headers:
            logger.debug(headers)
            subject = headers.get("subject")
            email_to = headers.get("to")
            email_from = headers.get("from")
            date = headers.get("date")

            for email in email_to:
                logger.debug(email)
                #get user
                user = User.objects.filter(email = email).first()

                bounce = BounceEmailNotification(email=email,
                                                 bounce_type = bouncetype,
                                                 subject=subject,
                                                 from_email = email_from[0],
                                                 user=user)
                bounce.save()
    except:
        logger.debug(traceback.format_exc())
        logger.warning("BOUNCE notification malformed or unexpected format")
        
        
    
        

            
def create_email_ticket(content):

    case = None
    label = "no_label"

    try:
        email_msg = base64.b64decode(content).decode('utf-8')
        logger.debug(email)

    except:
        logger.debug(traceback.format_exc())
        cont = base64.b64decode(content)
        email_msg = decode_email(cont)


    if not email_msg:
        logger.warning("Could not decode email")
        return None


    body = email.message_from_string(email_msg)
    to_email = decode_email_header(body['to'])
    from_email = decode_email_header(body['from'])
    subject = decode_email_header(body['subject'])
    message_id = decode_email_header(body['message-id'])
    message_id = message_id.strip()
    references = decode_email_header(body['references'])

    if to_email:
        name_only, to_email_only = email.utils.parseaddr(to_email)
    else:
        to_email_only = None

    logger.debug(body)
    logger.debug(to_email)
    logger.debug(from_email)
    logger.debug(subject)
    logger.debug(message_id)
    logger.debug(references)

    if to_email_only:
        #check if any of the "to" emails listed have a case identifier
        logger.debug(to_email_only)
        reg_ex = r"(mail\+(\d+)\+?([-_0-9a-zA-Z]+)?)"
        m = re.search(reg_ex, to_email_only)
        if m:
            logger.debug(f"MATCHED {m}")
            case_id = m.group(2)
            if len(m.groups()) > 2:
                label = m.group(3)
            #find Case
            logger.debug(f"FOUND A CASE!!! {case_id}")

            case = Case.objects.filter(case_id=case_id).first()

    if not case:
        #check subject!
        m = re.search(fr"{settings.CASE_IDENTIFIER}(\d+)", subject, re.IGNORECASE)
        if m:
            #find Case
            case_id = m.group(1)
            logger.debug(f"FOUND A CASE IN SUBJECT!!! {m.group(1)}")
            case = Case.objects.filter(case_id=case_id).first()

    if not label:
        label = "no_label"

    charset = 'utf-8'
    email_attachments = []

    if body.is_multipart():
        for part in body.walk():
            content_type = part.get_content_type()
            content_dispo = str(part.get('Content-Disposition'))
            content_desc = str(part.get('Content-Description'))
            if content_type == 'text/plain' and 'attachment' not in content_dispo:
                logger.debug("Plaintext part")
                email_body = part.get_payload(decode=True)
                #save this for later to decode
                charset = part.get_content_charset('utf-8')
            elif content_type == 'text/html' and 'attachment' not in content_dispo and email_body is None:
                logger.debug("html part - we only want this if no plain/text exists")
                email_body = part.get_payload(decode=True)
                # try to get the content charset, default to utf-8
                charset = part.get_content_charset('utf-8')
            elif content_type == 'application/pgp-encrypted' or (content_type == 'application/octet-stream' and 'PGP' in content_desc):
                logger.debug("this is encrypted")
                email_encrypted = True
            else:
                if (isinstance(part.get_payload(), list)):
                    if len(part.get_payload()) > 1:
                        i = 1
                        while i < len(part.get_payload()):
                            # this has attachment
                            attachment = part.get_payload()[i]
                            attachment = retrieve_attachment(attachment)
                            i = i+1
                            if attachment:
                                email_attachments.append(attachment)

    else:
        #this is only plain/text
        email_body = body.get_payload(decode=True)

    logger.debug(email_body)

    #Now decode the content of the email
    if email_body:

        try:
            email_content = email_body.decode(charset)
        except:
            logger.debug("trying different enctype")
            email_content = decode_email(email_body)

    logger.debug(email_content)


    if references:
        logger.debug("THIS IS A REPLY!!!")
        #this is a reply - see if we have original message
        reference_list = str(references).strip().replace('"', '').replace('\r', '').replace('\t', '').replace('\n', ' ').replace(' '*3, ' '*2).replace(' '*2, ' ').split(' ')
        orig_msg = reference_list[0]
        #get email tickets with this message id
        orig_tkt = EmailTicket.objects.filter(message_id=orig_msg).first()
        if orig_tkt:
            new_tkt = EmailTicket(thread=orig_tkt.thread,
                                  email_thread = orig_tkt.email_thread,
                                  message_id=message_id,
                                  parent=False,
                                  sent_to={"TO": to_email},
                                  submitted_by=from_email,
                                  team=orig_tkt.team,
                                  content=email_content,
                                  title=subject)
            new_tkt.save()
            #ThreadTopic.objects.create(ethread=orig_tkt.email_thread,
            #                           ticket=new_tkt)

            process_email_attachments(new_tkt, email_attachments)

            if orig_tkt.assigned_to:
                new_tkt.assign(orig_tkt.assigned_to)
                send_ticket_assignment_email(new_tkt, None)
            return new_tkt

    #IF NOT REPLY - or can't find orig message
    #create emailthread
    owner = None
    email_thread = EmailThread.objects.create(topic=subject)

    logger.debug(f"case is {case}")

    tkt_thread = TicketThread.objects.filter(label=label, case=case).first()
    #get case owner

    owner = None
    team = None
    if case:
        owner = CaseParticipant.objects.filter(role="owner", case=case).exclude(contact__isnull=True).first()
        team = get_coord_team(case)
    else:
        #if only 1 coord team on platform - assign it to them
        teams = get_coord_teams()
        if len(teams) == 1:
            #auto assign lead coord team
            team = get_lead_coord_team()

    if not tkt_thread:
        #create one
        tkt_thread = TicketThread.objects.create(label=label, case=case)

    emailtkt = EmailTicket(thread=tkt_thread,
                           email_thread=email_thread,
                           message_id = message_id,
                           parent=True,
                           sent_to = {"TO": to_email},
                           submitted_by = from_email,
                           content=email_content,
                           title=subject)

    if team:
        #if case assigned to a coord team, assign them to the ticket
        emailtkt.team = team.first()

    emailtkt.save()

    if owner:
        emailtkt.assign(owner.contact.user)
        send_ticket_assignment_email(emailtkt, None)

        #ThreadTopic.objects.create(ethread=email_thread,
        #                       ticket=emailtkt)
    process_email_attachments(emailtkt, email_attachments)


    return emailtkt



def unassign_group_case_tickets(case, group, user):

    #get all case related tickets
    casetickets = EmailThread.ordered(EmailThread.case(case.case_id))

    logger.debug(casetickets)

    for thread in casetickets:
        for tkt in thread.emails.all():
            if tkt.assigned_to:
                if tkt.assigned_to.groups.filter(id=group.id).exists():
                    #user was assigned to group that was unassigned
                    tkt.unassign(user)



def adjust_group_emails():

    #this only needs to be run once to fix references

    gp = GroupProfile.objects.all()
    for g in gp:
        if g.support_email:
            g.support_emails = [g.support_email]
            g.save()


# NOP task for testing in worker
def task_five_minute_nop():
    logger.info("5 min NOP task started")
    time.sleep(300)
    logger.info("5 min NOP task complete")
    return


def find_user_groups(user_email):
    company = ''

    parts = user_email.strip().split('@', 1)
    if len(parts) > 1:
        company = parts[1].lower()
        user_contact = Contact.objects.filter(email=user_email).first()
        #find other users
        #check if company contains common email domains (gmail, aol, hotmail, verizon)
        email_domains = ["gmail", "aol", "yahoo", "comcast", "hotmail", "msn", "verizon", "outlook", "icloud"]
        if any(d in company for d in email_domains):
            return []
        contacts = Contact.objects.filter(email__icontains=company).exclude(user__isnull=True)


        #is this user already requesting access
        already_tried = ContactAssociation.objects.filter(contact=user_contact).values_list('group__id', flat=True)
        rejected = RejectedAssociation.objects.filter(contact=user_contact).values_list('group__id', flat=True)
        already_tried = list(already_tried) + list(rejected)

        support_emails = GroupProfile.objects.filter(support_emails__icontains=company).exclude(vendor_type="Coordinator").exclude(group__in=already_tried).values_list('group__id', flat=True)

        if contacts or support_emails:
            associations = []
            if contacts:
                associations = ContactAssociation.objects.filter(contact__in=contacts, verified=True).exclude(group__in=already_tried).values_list('group__id', flat=True)

            associations = list(associations) + list(support_emails)

            if associations:
                groups = Group.objects.filter(id__in=associations)
                return groups

    return []



def get_new_stats(user, last_login):
    context = {'new_posts': 0, 'new_cases': [], 'unseen_cases': 0}

    unseen_cases = []
    mycases = my_cases(user).filter(status = Case.ACTIVE_STATUS)
    for case in mycases:
        last_post = Post.objects.filter(thread__case=case).order_by('-modified')
        last_viewed = CaseViewed.objects.filter(user=user, case=case).first()
        if last_post and last_viewed:
            posts = last_post.filter(created__gt = last_viewed.date_viewed).exclude(author__user=user)
            if posts:
                unseen_cases.append({'title': case.full_title, 'case_id': case.case_id})
                context['new_posts'] += posts.count()
        elif last_viewed == None and last_login != "New":
            context['new_cases'].append(case.caseid)
            context['new_posts'] += last_post.count()
            unseen_cases.append({'title': case.full_title, 'case_id': case.case_id})
        if last_login == "New":
            context['new_cases'].append(case.caseid)

    context['unseen_cases'] = unseen_cases
    if last_login == "New":
        context["new_user"] = True

    return context



def notify_group_admin(group, contact):

    group_admins = list(ContactAssociation.objects.filter(group=group, group_admin=True).values_list('contact__email', flat=True))

    ctx = {'group': group.name, 'request': contact.email}

    if group_admins:
        send_template_email("notify_group_admin", group_admins, ctx)


def find_current_case_state(case_id):
    actions = CaseAction.objects.filter(case__id=case_id).exclude(state__isnull=True).exclude(state__code="unresponsive_vendor").values_list('state__id', flat=True).distinct('state__id').order_by('state__id')
    logger.debug(actions)
    state = CaseState.objects.filter(id__in=actions).order_by('-order').first()

    return state.code


def check_responsiveness(case_id):

    settings = GlobalSettings.objects.all().first()

    if settings:
        if settings.unresponsive_pulse == 0:
            #feature is disabled
            return
    else:
        return

    #doesn't necessarily have to be 30
    thirty_days_ago = timezone.now() - timedelta(days=settings.unresponsive_pulse)
    case = Case.objects.filter(id = case_id).first()

    if case:
        if case.state == "Unresponsive Vendor":
            unresponsive_participants = CaseParticipant.objects.filter(case__id=case_id, role="supplier", pulse__lte=thirty_days_ago).exclude(notified__isnull=True).exclude(pulse__isnull=True).count()
            if unresponsive_participants == 0:
                new_state = find_current_case_state(case_id)
                if new_state:
                    bump_case_state(case, new_state, True)


# move cases to "Unresponsive Vendor" if there are case participants that haven't
# been active for more than 30 days (or whatever it is set to in global settings
# This will be a scheduled task that runs nightly.

def find_unresponsive_vendors():


    settings = GlobalSettings.objects.all().first()

    if settings:
        if settings.unresponsive_pulse == 0:
            logger.debug("Unresponsive vendor task is disabled. Unresponsive Pulse in Global Settings must be > 0")
            #feature is disabled
            return
    else:
        return

    cases = Case.objects.filter(status = Case.ACTIVE_STATUS).exclude(state='Unresponsive Vendor').values_list('id', flat=True)

    #doesn't necessarily have to be 30
    thirty_days_ago = timezone.now() - timedelta(days=settings.unresponsive_pulse)

    unresponsive_participants = CaseParticipant.objects.filter(case__id__in=cases, role="supplier", pulse__lte=thirty_days_ago).exclude(notified__isnull=True).exclude(pulse__isnull=True).distinct('case__id')

    logger.info(f"Changing state on {len(unresponsive_participants)} case participants")

    for x in unresponsive_participants:
        bump_case_state(x.case, "unresponsive_vendor", True)



def send_vincent_daily_email():

    emails = DailyEmailNotification.objects.all()

    for x in emails:
        text = ""
        cases = []

        s = x.user.userprofile.settings.get('email_preference', 1)
        if int(s) == 1:
            html = True
        else:
            html = False

        for c in x.notifications:
            if c["case"] in cases:
                continue
            else:
                if html:
                    text = text + f"<a href=\"{c['url']}\">{c['case']}</a><br/>"
                else:
                    text = text + f"{c['case']} ({c['url']})\r\n"
                cases.append(c["case"])

        send_daily_digest_mail(x.user, text, html)
        x.delete()
                

def create_ticket(message):

    #check for an exsiting ticket
    orig_tkt = EmailTicket.objects.filter(msg_thread = message.thread).first()
    send_email = True
    
    if orig_tkt:

        new_tkt = EmailTicket(
            thread = orig_tkt.thread,
            msg_thread = message.thread,
            email_thread = orig_tkt.email_thread,
            parent=False,
            team=orig_tkt.team,
            title=f"Reply from {message.sender.screen_name}",
            submitted_by = orig_tkt.submitted_by,
            content = message.content)

        if is_coordinator(message.sender):
            new_tkt.status = Ticket.CLOSED_STATUS
            send_email = False

            all_tkts = EmailTicket.objects.filter(msg_thread=message.thread).exclude(status=Ticket.CLOSED_STATUS)
            for t in all_tkts:
                #close all the open tickets associated with this thread 
                t.status = Ticket.CLOSED_STATUS
                t.save()

        new_tkt.save()

        if orig_tkt.assigned_to:
            new_tkt.assign(orig_tkt.assigned_to)

        if send_email:
            send_ticket_assignment_email(new_tkt, None)

        return new_tkt

    else:

        if message.thread.subject:
            title = f"New Message from {message.sender.screen_name}: {message.thread.subject}"
        else:
            title = f"New Message from {message.sender.screen_name}"
            
        email_thread = EmailThread.objects.create(topic=title)

        tkt_thread = TicketThread.objects.filter(label = "messages").first()

        if not tkt_thread:
            tkt_thread = TicketThread.objects.create(label="messages")

        sent_to = []
        for recip in message.thread.userthread_set.exclude(user=message.sender):
            sent_to.append(recip.user.email)
            
        new_tkt = EmailTicket(
            thread = tkt_thread,
            email_thread = email_thread,
            msg_thread = message.thread,
            parent=True,
            sent_to={"TO": ", ".join(sent_to)},
            submitted_by = message.sender.email,
            title=title,
            content = message.content)

        #if coordinator initiated message - autoassign/autoclose 
        if is_coordinator(message.sender):
            new_tkt.status = Ticket.CLOSED_STATUS
            teams = my_coord_teams(message.sender)
            if teams:
                new_tkt.team = teams.first()
            new_tkt.save()
            new_tkt.assign(message.sender)
        else:
            new_tkt.save()


def _gen_id(current, inc):
    placeholder_list = ["YY", "YYYY", "JJJ", "NN"]    
    new_doc_id = current
    if any(substring in new_doc_id for substring in placeholder_list):
        if "JJJ" in new_doc_id:
            day_of_year = datetime.now().strftime('%j')
            new_doc_id = new_doc_id.replace('JJJ', day_of_year)
        if "NN" in new_doc_id:
            #get sequential published advisories for this year
            new_doc_id = new_doc_id.replace('NN', inc)
        if "YYYY" in new_doc_id:
            current_year = datetime.now().year
            new_doc_id = new_doc_id.replace('YYYY', current_year)
        elif "YY" in new_doc_id:
            current_year = datetime.now().strftime('%y')
            new_doc_id = new_doc_id.replace('YY', current_year)
    
    return new_doc_id
            
def assign_csaf_document_id(case):

    csaf_settings = CaseCSAFSettings.objects.filter(case=case).first()
    if csaf_settings:
        if (csaf_settings.doc_id_format):
            counter = 1
            new_doc_id = _gen_id(csaf_settings.doc_id_format, f"{counter:02}")
            while(1 and counter < 100):
                logger.info(f"Assigning CSAF document id {new_doc_id}")
                #check other doc ids and make sure this one is unique, keep incrementing until we find one
                existing = CaseCSAFSettings.objects.filter(doc_id = new_doc_id).exclude(case=case).first()
                if existing:
                    counter = counter + 1
                    new_doc_id = _gen_id(csaf_settings.doc_id_format, f"{counter:02}")
                else:
                    break
            csaf_settings.doc_id = new_doc_id

            refs = csaf_settings.references

            #update references with new document id
            try:
                for x in refs:
                    if "{{doc_id}}" in x["url"]:
                        x["url"] = x["url"].replace("{{doc_id}}", new_doc_id)
                    
                    if "{{doc_id}}" in x["summary"]:
                        x["summary"] = x["summary"].replace("{{doc_id}}", new_doc_id)
                csaf_settings.references = refs
            except:
                logger.debug(traceback.format_exc())
                pass


            csaf_settings.save()
            
                    
                
