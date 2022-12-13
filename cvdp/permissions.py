from rest_framework.permissions import IsAdminUser, IsAuthenticated, BasePermission, SAFE_METHODS
from django.shortcuts import get_object_or_404
from cvdp.models import Case, CaseParticipant, Contact, CaseThreadParticipant, ContactAssociation, GlobalSettings, MessageThread, UserThread, GroupThread, GroupProfile, Post, CaseAdvisory, CaseApproval
from django.contrib.auth import get_user_model
from cvdp.manage.models import  AdVISEConnection
from cvdp.components.models import Component, Product
from django.db.models import Q
from django.contrib.auth.models import Group
import logging
import traceback
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

User = get_user_model()

class InvalidRoleException(Exception):
    """ Raised when user is assigned an invalid role"""
    pass


def get_lead_coord_team():
    
    gs = GlobalSettings.objects.all().first()
    if gs and gs.group:
        return Group.objects.filter(id = gs.group.id).first()
    return None

def is_in_lead_coord_team(user):

    if user.is_superuser:
        return True
    
    gs = GlobalSettings.objects.all().first()
    if gs and gs.group:
        lead_group = Group.objects.filter(id = gs.group.id).first()
        if lead_group:
            return user.groups.filter(id=lead_group.id).exists()
    return False

def is_my_manager(requestor, user):

    if requestor == user:
        return True

    if is_in_lead_coord_team(requestor):
        return True
    
    if not is_coordinator_mgr(requestor):
        return False
    
    user_coord_teams = my_coord_teams(user)

    if not requestor.groups.filter(id__in=user_coord_teams):
        return False

    return True
    


def get_coord_teams():
    g = GroupProfile.objects.filter(vendor_type="Coordinator", active=True).values_list('group__id', flat=True)
    #exclude any groups that do not have any users or that are inactive                                                                                
    coord_groups = Group.objects.filter(id__in=g).exclude(user__isnull=True).exclude(groupprofile__active=False)
    return coord_groups

def _my_groups(user):
    groups = user.groups.all()
    if not groups:
        return []
    return groups.values_list('id', flat=True)


def my_coord_teams(user):
    #returns groups that user belongs to that are "coordinator groups"
    return user.groups.exclude(groupprofile__isnull=True).filter(groupprofile__vendor_type="Coordinator")


def can_publish_case(case, user):
    
    ca = CaseAdvisory.objects.filter(case=case).first()
    if not ca:
        return False
    
    if not is_case_owner(user, case.id):
        return False

    if not CaseApproval.objects.filter(case=case, request=3, status=CaseApproval.APPROVED).exists():
        return False

    return True


def can_share_case(case, user):
    ca = CaseAdvisory.objects.filter(case=case).first()
    if not ca:
        return False
    
    if not is_case_owner(user, case.id):
        return False
    
    if not CaseApproval.objects.filter(case=case, request=2, status=CaseApproval.APPROVED).exists():
        return False
    
    return True

def can_approve_case(case, user):

    if is_in_lead_coord_team(user):
        return True

    if is_my_case(user, case.id, True):
        if is_coordinator_mgr(user):
            return True

    return False

def get_post_participant(post):

    contact = Contact.objects.filter(id=post.author.id).first()
    if contact:
        cp = CaseParticipant.objects.filter(case=post.thread.case, contact=contact).first()
        if cp:
            return cp
    if (post.group):
        cp = CaseParticipant.objects.filter(case=post.thread.case, group=post.group).first()
        if cp:
            return cp

    return None

def my_components(user):
    if is_coordinator(user):
        return Component.objects.all()

    my_groups = user.groups.all()
    products = Product.objects.filter(supplier__in=my_groups).values_list('component__id', flat=True)
    return Component.objects.filter(id__in=products)



def get_case_users_in_group(participant):
    try:
        if not participant.group.groupprofile.permissions:
            #return all verified users
            return User.objects.filter(groups__id=participant.group.id).exclude(api_account=True).exclude(is_active=False)

        users = list(participant.permissions.keys())
        #if permissions are set, get users that have permission + group admins that have access to all cases
        gadmins = ContactAssociation.objects.filter(group=participant.group, group_admin=True).values_list('contact__uuid', flat=True)
        if gadmins:
            users.extend(gadmins)
        if users:
            return User.objects.filter(contact__uuid__in=users).exclude(api_account=True).exclude(is_active=False)
        
    except:
        logger.debug(traceback.format_exc())
    return User.objects.none()


def get_visible_case_coordinators(participant):

    return Post.objects.filter(group=participant.group, thread__case=participant.case).values_list('author__user__screen_name', flat=True).distinct()


def my_cases(user):
    if is_coordinator(user):
        if is_in_lead_coord_team(user):
            return Case.objects.all()

    my_groups = user.groups.exclude(groupprofile__isnull=True)
    groups_full_access = []
    groups_ltd_access = []
    for g in my_groups:
        if not g.groupprofile.permissions:
            groups_full_access.append(g.id)
        elif ContactAssociation.objects.filter(group=g, contact__user=user, group_admin=True).exists():
            groups_full_access.append(g.id)
        else:
            #this is case by case 
            groups_ltd_access.append(g.id)

    my_cases = list(CaseParticipant.objects.filter(Q(group__in=groups_full_access)|Q(contact__user=user)).exclude(notified__isnull=True).values_list('case__id', flat=True))
    if groups_ltd_access:
        ltd_cases = CaseParticipant.objects.filter(group__in=groups_ltd_access, permissions__has_key=str(user.contact.uuid)).exclude(notified__isnull=True).values_list('case__id', flat=True)
        if ltd_cases:
            my_cases.extend(ltd_cases)
    if my_cases:
        if is_coordinator(user):
            t = Case.objects.filter(id__in=my_cases)
        else:
            t = Case.objects.filter(id__in=my_cases).exclude(status=Case.PENDING_STATUS)
        return t
    else:
        return Case.objects.none()


def is_my_case(user, case, write=False):
    groups = user.groups.exclude(groupprofile__isnull=True)
    if is_coordinator(user):
        #only owners and mgrs can write automatically, otherwise they need to be a participant
        if is_case_owner(user, case):
            return True
        elif not write:
            if is_user_in_coord_team(user, case):
                return True
            
    c = Case.objects.get(id=case)
    if c.status == Case.PENDING_STATUS:
        return False
    user_groups = groups.values_list('id', flat=True)
    #get my contact
    contact = Contact.objects.filter(user=user).first()
    if groups:
        cps = CaseParticipant.objects.filter(case__id=case).filter(group__in=user_groups).exclude(notified__isnull=True)
        for c in cps:
            if write and c.role == "observer":
                continue
            if not c.group.groupprofile.permissions:
                return True
            elif ContactAssociation.objects.filter(group=c.group, contact__user=user, group_admin=True).exists():
                return True
            elif c.permissions.get(str(user.contact.uuid)):
                if write:
                    if not c.permissions[str(user.contact.uuid)] == "rw":
                        continue
                return True
            
    cp = CaseParticipant.objects.filter(case__id=case, contact=contact)
    for c in cp:
        if write and c.role == "observer":
            continue
        else:
            return True
    return False


def is_my_ticket(ticket, user):

    if is_in_lead_coord_team(user):
        return True
    
    if (ticket.assigned_to == user):
        return True

    if (ticket.team and user.groups.filter(name=ticket.team.name).exists()):
        return True

    return False


def get_coord_team(case):
    coord_team = CaseParticipant.objects.filter(case__id=case, role="owner").exclude(group__isnull=True).values_list('group__id', flat=True)
    if coord_team:
        return Group.objects.filter(id__in=coord_team)
    return Group.objects.none()


def is_case_participant(group, case):
    return CaseParticipant.objects.filter(case__id=case).filter(group=group).exclude(notified__isnull=True).exists()


def is_my_case_thread(user, thread, write=False):
    groups = user.groups.exclude(groupprofile__isnull=True)
    if is_coordinator(user):
        #only owners and mgrs can write automatically, otherwise they need to be a participant on the thread
        if is_case_owner(user, thread.case.id):
            return True
        elif not write:
            if is_user_in_coord_team(user, thread.case.id):
                return True

    user_groups = groups.values_list('id', flat=True)
    #check group access first
    
    #get case participant
    cps = CaseParticipant.objects.filter(case=thread.case).filter(group__in=user_groups).exclude(notified__isnull=True)
    for c in cps:
        if write and c.role == "observer":
            continue
        if not c.group.groupprofile.permissions:
            if CaseThreadParticipant.objects.filter(thread=thread, participant=c).exists():
                return True
        elif ContactAssociation.objects.filter(group=c.group, contact__user=user, group_admin=True).exists():
            if CaseThreadParticipant.objects.filter(thread=thread, participant=c).exists():
                return True
        elif c.permissions.get(str(user.contact.uuid)):
            if write:
                if not c.permissions[str(user.contact.uuid)] == "rw":
                    continue
            if CaseThreadParticipant.objects.filter(thread=thread, participant=c).exists():
                return True
    #get my contact
    contact = Contact.objects.filter(user=user).first()
    contact_parts = CaseParticipant.objects.filter(case=thread.case, contact=contact)
    for c in contact_parts:
        if write and c.role == "observer":
            continue
        return CaseThreadParticipant.objects.filter(thread=thread, participant=c).exists()
    return False


def is_my_msg_thread(user, thread):
    if UserThread.objects.filter(thread=thread, user=user).exists():
        return True
    gt = GroupThread.objects.filter(thread=thread).first()
    if gt:
        if user.groups.filter(id=gt.group.id).exists():
            return True
    return False







def is_user_in_coord_team(user, case):
    coord_team = get_coord_team(case)
    if coord_team:
        groups = coord_team.values_list('id', flat=True)
        return user.groups.filter(id__in=groups).exists()
    
    return False
    

def is_case_owner(user, case):
    #get case coord team

    if is_coordinator(user):

        if is_in_lead_coord_team(user):
            return True
        
        if is_user_in_coord_team(user, case):
            if is_coordinator_mgr(user):
                #coordinator managers can write on all cases
                return True
            
        #otherwise check if this user has been specifically assigned as a user 
        contact = Contact.objects.filter(user=user).first()
        return CaseParticipant.objects.filter(case__id=case, contact=contact, role='owner').exists()

    return False


def is_coord_team(user, case):

    if is_case_owner(user, case):
        return True

    if is_user_in_coord_team(user, case):
        return True

    return False

def is_case_owner_or_staff(user, case):
    #more permissive then above
    if user.is_staff or user.is_superuser:
        return True
    return is_case_owner(user, case)


def is_coordinator(user):
    #return user.is_coordinator
    if user.is_superuser:
        return True
    return user.groups.filter(name__in=['coordinator', 'coordinator_mgr']).exists()

def is_coordinator_mgr(user):
    if user.is_superuser:
        return True
    return user.groups.filter(name='coordinator_mgr').exists()

def is_coordinator_admin(user, group):
    #this is special permission group to allow users from
    #lead coord team or coord managers to do certain tasks
    if is_coordinator_mgr(user) and user.groups.filter(id=group.id).exists():
        return True
    if is_in_lead_coord_team(user):
        return True
    return False

def is_analyst(user):
    if user.is_superuser:
        return True
    return user.groups.filter(name__in=['analyst', 'analyst_mgr']).exists()                              

def is_analyst_mgr(user):
    if user.is_superuser:
        return True
    return user.groups.filter(name='analyst_mgr').exists()

def is_analysis_creator(user):
    if user.is_superuser:
        return True
    return user.groups.filter(name="analysis_creator").exists()

def is_user_admin(user):
    if user.is_superuser:
        return True
    return user.groups.filter(name='user_admin').exists()

def is_staff_member(user):
    return user.is_staff

def my_case_role(user, case):
    if user.is_superuser:
        return "owner"
    contact = Contact.objects.filter(user=user).first()

    if is_case_owner(user, case.id):
        return "owner"
    elif is_user_in_coord_team(user, case.id) and is_coordinator(user):
        return "coordinator"
        
    #is this a vendor?
    groups = user.groups.exclude(groupprofile__isnull=True)
    cp = CaseParticipant.objects.filter(case=case, group__in=groups).values_list('role', flat=True)

    if not cp:
        #check if this user is a reporter/participant
        cp = CaseParticipant.objects.filter(case=case, contact=contact).first()
        if cp:
            return cp.role
        return None
    elif len(cp) == 1:
        return cp[0]
    else:
        #length is greater than 1, which means we need to return most permissive
        if 'owner' in cp:
            return 'owner'
        elif 'supplier' in cp:
            return 'supplier'
        elif 'participant' in cp:
            return 'participant'
        elif 'reporter' in cp:
            return 'reporter'
        else:
            return 'observer' # < --- read only

#returns a list of all groups in this case that the user belongs to
def my_case_vendors(user, case):
    groups = user.groups.exclude(groupprofile__isnull=True)
    if is_coordinator(user):
        #contact = Contact.objects.filter(user=user).first()
        #cp = CaseParticipant.objects.filter(case=case, contact=contact).first()
        #if cp and cp.role=="owner":
        #get coord group
        coord_groups = CaseParticipant.objects.filter(case=case, group__in=groups, role="owner").values_list('group__id', flat=True)
        if coord_groups:
            return Group.objects.filter(id__in=coord_groups)
        if is_in_lead_coord_team(user):
            gs = get_lead_coord_team()
            #return a list
            return Group.objects.filter(id=gs.id)
        return []

    cp = CaseParticipant.objects.filter(case=case, group__in=groups).values_list('group__id', flat=True)
    if cp:
        return Group.objects.filter(id__in=cp)
    return []


class ContactAPIPermission(BasePermission):
    message = "Forbidden"

    def has_permission(self, request, view):
        if request.method in ['POST', 'DELETE']:
            if is_coordinator(request.user):
                return True
            return False
        #otherwise - we're going to check has_object_permission
        return True

    def has_object_permission(self, request, view, obj):

        if is_coordinator(request.user):
            return True
        logger.debug(request.method)
        if request.method in ['PATCH']:
            #obj is actually group
            return ContactAssociation.objects.filter(group=obj, contact__user=request.user, group_admin=True).exists()

        return False


class GroupAdminLevelPermission(BasePermission):
    message = "Forbidden"

    def has_object_permission(self, request, view, obj):

        gs = GlobalSettings.objects.all().first()
        if gs and gs.group.id == obj.id:
            #user is attempting to modify lead coord group
            if request.user.is_superuser:
                return True
            if request.method in SAFE_METHODS:
                return request.user.groups.filter(id=obj.id).exists()
            else:
                #otherwise - only group admin can modify
                return ContactAssociation.objects.filter(group=obj, contact__user=request.user, group_admin=True).exists()
        if is_coordinator(request.user):
            return True
        if request.method in SAFE_METHODS:
            return request.user.groups.filter(id=obj.id).exists()
        else:
            #this user must be group admin

            return ContactAssociation.objects.filter(group=obj, contact__user=request.user, group_admin=True).exists()


class GroupLevelPermission(BasePermission):
    message = "Forbidden"

    def has_object_permission(self, request, view, obj):
        if is_coordinator(request.user):
            return True
        return request.user.groups.filter(id=obj.id).exists()


class GroupLevelWritePermission(BasePermission):
    message = "Forbidden"

    def has_permission(self, request, view):
        #is user a vendor or in any groups
        if is_coordinator(request.user):
            return True
        if request.user.groups.count() > 0:
            return True
        return False
        
    def has_object_permission(self, request, view, obj):
        if is_coordinator(request.user):
            return True
        if request.method in SAFE_METHODS:
            return False
        else:
            return request.user.groups.filter(id=obj.id).exists()


class AdminPermission(BasePermission):
    message = "Forbidden"

    def has_permission(self, request, view):
        return request.user.is_superuser
        
class StaffPermission(BasePermission):
    message = "Forbidden"

    def has_permission(self, request, view):
        return request.user.is_staff

class CoordinatorMgrPermission(BasePermission):
    message = "Forbidden"

    def has_permission(self, request, view):
        return is_coordinator_mgr(request.user)

class ServiceAccountPermission(BasePermission):
    message = "Forbidden"

    def has_permission(self, request, view):
        return request.user.is_api_service

    
class CoordinatorPermission(BasePermission):
    message = "Forbidden"

    def has_permission(self, request, view):
        return is_coordinator(request.user)

class CoordOrAnalystPermission(BasePermission):
    def has_permission(self, request, view):
        return is_coordinator(request.user) or is_analyst(request.user)

class ManagerPermission(BasePermission):
    message = "Forbidden"

    def has_permission(self, request, view):
        return is_coordinator_mgr(request.user) or is_analyst_mgr(request.user)
    
class AnalystMgrPermission(BasePermission):
    message = "Forbidden"

    def has_permission(self, request, view):
        return is_analyst_mgr(request.user)

class AnalystMgrWritePermission(BasePermission):
    message = "Forbidden"

    def has_permission(self, request, view):
        if is_analyst(request.user):
            if request.method in SAFE_METHODS:
                return True
            elif is_analyst_mgr(request.user):
                return True
        return False    

class AnalystCoordinatorPermission(BasePermission):
    message = "Forbidden"

    def has_permission(self, request, view):
        if is_analyst(request.user):
            return True
        elif is_coordinator(request.user):
            return True
        return False
    
class AnalystPermission(BasePermission):
    message = "Forbidden"

    def has_permission(self, request, view):
        return is_analyst(request.user)
    
class CaseOwnerWritePermission(BasePermission):
    message = "Forbidden"
    
    def has_object_permission(self, request, view, obj):
        if is_coordinator(request.user):
            if is_case_owner_or_staff(request.user, obj.id):
                return True
            elif is_user_in_coord_team(request.user, obj.id):
                if request.method in SAFE_METHODS:
                    return True
        return False
    
class CaseObjectAccessWritePermission(BasePermission):
    message = "Forbidden"

    #more permissive than the following class, allows write
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return is_my_case(request.user, obj.id)
        else:
            return is_my_case(request.user, obj.id, True)

class TransferAccessPermission(BasePermission):
    message="Forbidden"

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        else:
            #check permissions for transfer access
            try:
                #logger.debug(request.user.auth_token.last_four)
                return AdVISEConnection.objects.filter(incoming_key = request.user.auth_token, disabled=False).exists()
            except:
                logger.debug(traceback.format_exc())
                return False

class CaseTransferAccessPermission(BasePermission):
    message="Forbidden"

    def has_permission(self, request, view):
        case = get_object_or_404(Case, case_id=view.kwargs.get('caseid'))
        ## did this case originate from the API token that is requesting it
        try:
            connection = AdVISEConnection.objects.filter(incoming_key = request.user.auth_token, disabled=False).first()
            if not connection:
                return False
            if (case.report.connection == connection):
                #ENFORCE A TIME LIMIT?
                return True
        except:
            #user may not have auth_token
            logger.debug(traceback.format_exc())
            return False

class CaseObjectAccessPermission(BasePermission):
    message = "Forbidden"

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            # Check permissions for read-only request
            return is_my_case(request.user, obj.id)
        else:
            # Check permissions for write request
            return is_case_owner(request.user, obj.id)

class CaseThreadObjectAccessPermission(BasePermission):
    message = "Forbidden"

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return is_my_case_thread(request.user, obj)
        else:
            return is_my_case_thread(request.user, obj, True)

class ReadOnlyStaffWrite(BasePermission):
    message = "Forbidden"

    def has_permission(self, request, view):
        if request.user.is_coordinator or request.user.is_staff:
            if request.method in SAFE_METHODS:
                return True
            elif request.user.is_staff:
                return True
        return False
        

class CaseAccessPermission(BasePermission):
    message = "Forbidden"

    def has_permission(self, request, view):
        case = get_object_or_404(Case, case_id=view.kwargs.get('caseid'))
        return is_my_case(request.user, case.id)

class PendingUserPermission(BasePermission):
    message = "Access is Denied. User is in pending state"

    def has_permission(self, request, view):
        return not(request.user.pending)
