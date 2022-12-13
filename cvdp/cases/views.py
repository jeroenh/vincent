from django.shortcuts import render
import logging
import uuid
import pytz
from django.utils.timezone import make_aware
from django.contrib.postgres.aggregates import StringAgg
from django.shortcuts import render, redirect, get_object_or_404
from django.utils.encoding import smart_str
from django.contrib import messages
from django.urls import reverse, reverse_lazy
from django.views import generic, View
from django.utils.timesince import timesince
from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_cookie
from django.views.generic.edit import FormView, UpdateView, FormMixin, CreateView
from django.utils.decorators import method_decorator
from django.http import HttpResponse, Http404, JsonResponse, HttpResponseNotAllowed, HttpResponseServerError, HttpResponseForbidden, HttpResponseRedirect, HttpResponseBadRequest
from itertools import chain
from authapp.models import User
from django.utils.safestring import mark_safe
from cvdp.validators import validate_csaf
from django.core.exceptions import ValidationError, PermissionDenied
from django.utils.translation import gettext as _
from django_filters.rest_framework import DjangoFilterBackend
import django_filters
from authapp.views import  PendingTestMixin
from cvdp.utils import process_query
from rest_framework import exceptions, generics, status, authentication, viewsets, mixins, filters
import io
from django.http import FileResponse
import json
import difflib
from collections import OrderedDict
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.renderers import JSONRenderer, BrowsableAPIRenderer
from cvdp.permissions import *
from cvdp.cases.serializers import *
from cvdp.components.serializers import StatusActionSerializer
from cvdp.components.models import StatusRevision, ComponentStatusUpload
from cvdp.lib import *
from django.db.models import F, Count, Q, Func, Value, CharField
from django.db.models.functions import TruncMonth, TruncDay
# Create your views here.
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.contrib.auth.decorators import login_required, user_passes_test
import traceback
from cvdp.cases.forms import *
from cvdp.cases.generate_csaf_pdf import generate_csaf_pdf
from django.core.paginator import Paginator
from random import randint
from cvdp.models import *
from django.conf import settings

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


def get_staff():
    return User.objects.filter(is_staff=True)

def get_coordinators():
    return User.objects.filter(is_active=True, api_account=False, groups__name__in=["coordinator", "coordinator_mgr"]).exclude(screen_name__isnull=True)

def _my_groups(user):
    groups = user.groups.all()
    if not groups:
        return []
    return groups.values_list('id', flat=True)

def assigned_cases(user):
    my_cases = CaseParticipant.objects.filter(contact__user=user, role='owner').values_list('case')
    return Case.objects.filter(id__in=my_cases).order_by('-modified')

def _my_case_roles(user, case):
    #return Case Participant list
    user_groups = user.groups.exclude(groupprofile__isnull=True).values_list('id', flat=True)
    #get my contact
    contact = Contact.objects.filter(user=user).first()
    if user_groups:
        return CaseParticipant.objects.filter(case__id=case).filter(Q(contact=contact) | Q(group__in=user_groups)).exclude(notified__isnull=True)
    else:
        return CaseParticipant.objects.filter(case__id=case, contact=contact).exclude(notified__isnull=True)


def add_pulse(user, case_id):

    cps = _my_case_roles(user, case_id)
    
    for x in cps:
        x.pulse = timezone.now()
        x.save()

    check_responsiveness(case_id)

    
def _my_case_threads(user, case):
    if is_case_owner(user, case.id) or is_user_in_coord_team(user, case.id):
        return CaseThread.objects.filter(case=case)

    #get my participant
    participants = _my_case_roles(user, case.id)
    ctp = CaseThreadParticipant.objects.filter(participant__in=participants).values_list('thread__id', flat=True)
    return CaseThread.objects.filter(id__in=ctp).order_by('created')

def _my_threads(user, cases):
    user_groups = user.groups.exclude(groupprofile__isnull=True).values_list('id', flat=True)

    #get my contact
    contact = Contact.objects.filter(user=user).first()
    if user_groups:
        cps = CaseThreadParticipant.objects.filter(Q(participant__contact=contact) | Q(participant__group__in=user_groups)).exclude(participant__notified__isnull=True).values_list('thread__id', flat=True)
    else:
        cps = CaseThreadParticipant.objects.filter(participant__contact=contact).exclude(participant__notified__isnull=True).values_list('thread__id', flat=True)
    return CaseThread.objects.filter(id__in=cps, case__in=cases)


def _get_case_coordinators(case):

    case_owners = CaseParticipant.objects.filter(case=case, role="owner").exclude(contact__isnull=True)

    return case_owners


#assignee is CONTACT being assigned
#user is person making the change
def assign_case_user(case, assignee, user):
    thread = CaseThread.objects.filter(case=case, official=True).first()
    bump_case_state(case, "triage")
    add_new_case_participant(thread, assignee.uuid, user, 'owner')


@login_required(login_url="authapp:login")
def assignable_case_api(request, caseid):
    if not is_coordinator(request.user):
        raise PermissionDenied

    ret_value = {}

    case = get_object_or_404(Case, case_id=caseid)

    coord_team = get_coord_team(case.id)

    logger.debug(f"coord team is {coord_team}")

    if (coord_team):
        #get users in coord team
        c_teams = coord_team.values_list('id', flat=True)
        assignable_users = User.objects.filter(is_active=True, api_account=False, pending=False, groups__in=c_teams).order_by('screen_name').exclude(screen_name__isnull=True).distinct()
        assignable_users = assignable_users.filter(groups__name__in=['coordinator', 'coordinator_mgr'])
    else:
        assignable_users = []

    users = UserSerializer(assignable_users, many=True)
    ret_value['users'] = users.data

    #get roles that have users
    user_roles = UserAssignmentWeight.objects.all().values_list('role__id', flat=True).distinct()

    ret_value["teams"] = []
    #get coordinator groups - if user is part of global coordinator group
    if is_in_lead_coord_team(request.user):
        g = GroupProfile.objects.filter(vendor_type="Coordinator", active=True).values_list('group__id', flat=True)
        coord_groups = Group.objects.filter(id__in=g).exclude(user__isnull=True).exclude(groupprofile__active=False)
        gs = GroupSerializer(coord_groups, many=True)
        ret_value["teams"] = gs.data
        ret_value["roles"] = list(AssignmentRole.objects.filter(id__in=user_roles).values_list('role', flat=True))

    else:
        if is_coordinator_mgr(request.user):
            #get current coord team
            gs = GroupSerializer(coord_team, many=True)
            ret_value["teams"] = gs.data

            roles = AssignmentRole.objects.filter(group__in=coord_team)
            ret_value["roles"] = list(roles.filter(id__in=user_roles).values_list('role', flat=True))
        else:
            ret_value["users"] = [] # TODO: should a coordinator be allowed to unassign themselvess
            ret_value["teams"] = []
            ret_value["roles"] = []

    data = json.dumps(ret_value)
    mimetype='application/json'
    return HttpResponse(data, mimetype)


@login_required(login_url="authapp:login")
def get_csaf_doc_id(request, caseid):
    if not is_case_owner(request.user, caseid):
        return JsonResponse({"error": "You are not permitted to peform this action"}, status=403)

    case = get_object_or_404(Case, case_id=caseid)

    if not can_publish_case(case, request.user):
        return JsonResponse({"error": "This case has not been approved to publish"}, status=400)

    assign_csaf_document_id(case)

    csaf_settings = CaseCSAFSettings.objects.filter(case=case).first()
    if csaf_settings:
        data = json.dumps({'document_id': csaf_settings.doc_id})
        return HttpResponse(data, 'application/json')

    return JsonResponse({"error": "Save CSAF settings before assignign document ID"}, status=400)

@login_required(login_url="authapp:login")
def assign_case(request, caseid):
    if not is_coordinator_mgr(request.user):
        raise PermissionDenied

    case = get_object_or_404(Case, case_id=caseid)
    title = ""
    user=None
    contact = None

    if request.POST.get('user'):

        try:
            uuid_obj = uuid.UUID(request.POST.get('user'), version=4)
        except ValueError:
            return JsonResponse({'error': f"Invalid request"}, status=400)

        contact = Contact.objects.filter(uuid=uuid_obj).first()
        if contact:
            user = contact.user
            title = f"assigned case to {contact.user.screen_name}"
        else:
            #check groups
            contact = GroupProfile.objects.filter(uuid=uuid_obj).first()
            if (contact):
                #user must be in lead coord team to assign coord group to a case
                if not is_in_lead_coord_team(request.user):
                    raise PermissionDenied
                title = f"assigned case to {contact.group.name}"

    elif request.POST.get('role'):
        #get role
        role = get_object_or_404(AssignmentRole, role=request.POST.get('role'))
        user = auto_assignment(role.id)
        title = f"auto assigned case to {user.screen_name}"
        contact = Contact.objects.filter(user=user).first()
    else:
        raise Http404

    if contact == None:
        raise Http404

    #replaces below code
    try:
        assign_case_user(case, contact, request.user)
    except InvalidRoleException as e:
        return JsonResponse({'error': f"Invalid case owner {str(e)}"}, status=400)
    """
    thread = CaseThread.objects.filter(case=case, official=True).first()
    add_new_case_participant(thread, contact.uuid, request.user, 'owner')
    """
    action = create_case_action(title, request.user, case)
    #create the case change
    if user:
        create_case_change(action, "owner", None, user.screen_name)
    else:
        create_case_change(action, "owner", None, contact.group.name)

    return JsonResponse({'status':'success'}, status=200)


@login_required(login_url="authapp:login")
def unassign_case(request, caseid):
    if not is_coordinator(request.user):
        raise PermissionDenied

    case = get_object_or_404(Case, case_id=caseid)
    #is this my case? - don't allow rando coordinator (non staff) to unassign cases

    if not(is_case_owner(request.user, case.id)):
        raise PermissionDenied

    users = request.POST.getlist('users[]', None)
    reason = request.POST.get('reason', '')
    logger.debug(users)

    case_owners = CaseParticipant.objects.filter(case=case, role="owner")

    if (users):
        #UNASSIGN
        for u in users:
            try:
                uuid_obj = uuid.UUID(u, version=4)
            except ValueError:
                return JsonResponse({'error': f"Invalid request"}, status=400)

            participant = None
            contact = Contact.objects.filter(uuid=uuid_obj).first()
            if not contact:
                #check groups
                contact = GroupProfile.objects.filter(uuid=uuid_obj).first()
                if contact:
                    if (case.status == Case.ACTIVE_STATUS):
                        case_coords = case_owners.exclude(group__isnull=True)
                        if (len(users) == case_coords.count()):
                            return JsonResponse({'error':'Unassignment not permitted. Please assign another team before unassigning.'}, status=400)
                    
                    participant = case_owners.filter(group=contact.group).first()

            else:
                participant = case_owners.filter(contact=contact).first()
                if (case.status == Case.ACTIVE_STATUS):
                    case_coords = case_owners.exclude(contact__isnull=True)
                    if (len(users) == case_coords.count()):
                        return JsonResponse({'error':'Unassignment not permitted. Please assign another user before unassigning.'}, status=400)

            if (participant):

                if participant.group:
                    if not is_coordinator_admin(request.user, participant.group):
                        #user must be coordinator mgr to unassign group or part of lead coord group
                        raise PermissionDenied

                    other_coord_groups = case_owners.exclude(group__isnull=True).values_list('group__id', flat=True)
                    
                    group_users = CaseParticipant.objects.filter(case=case, role="owner").exclude(contact__isnull=True)
                    for gu in group_users:
                        if is_user_in_coord_team(gu.contact.user, case.id):
                            if other_coord_groups:
                                if gu.contact.user.groups.filter(id__in=other_coord_groups).exists():
                                    continue
                            case_coords = case_owners.exclude(contact__isnull=True).count()
                            if ((case_coords - 1) > 0):
                                title = f"{gu.contact.user.screen_name} unassigned from case (team transfer)"
                                action = create_case_action(title, request.user, case)
                                create_case_change(action, "owner", gu.contact.user.screen_name, None)
                                gu.delete()
                            else:
                                return JsonResponse({'error':'Unassignment not permitted. Please assign another user before unassigning.'}, status=400)
                                

                    logger.debug("Unassign group case tickets")
                    unassign_group_case_tickets(case, participant.group, request.user)

                old_value = str(participant)
                if participant.contact:
                    old_value = participant.contact.user.screen_name
                elif participant.group:
                    old_value = participant.group.name
                title = f"unassigned {old_value} from case: {reason}"

	        # remove from  all threads
                participant_threads = CaseThreadParticipant.objects.filter(participant=participant)
                logger.debug(participant_threads)
                for t in participant_threads:
                    logger.debug(t.id)
                    t.delete()
                
                participant.delete()
                action = create_case_action(title, request.user, case)
                create_case_change(action, "owner", old_value, None)
            else:
                return JsonResponse({'error': 'User not assigned'}, status=400)

        new_case_role = my_case_role(request.user, case)

        if not CaseParticipant.objects.filter(case=case, role="owner").exists():
            logger.debug("CASE UNASSIGNED _ MOVE CASE TO NEW")
            bump_case_state(case, "new", True)


        if not new_case_role:
            return JsonResponse({'status': 'success', 'redirect': reverse("cvdp:dashboard")}, status=200)
        return JsonResponse({'status':'success'}, status=200)
    else:
        raise Http404


class StandardResultsPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size= 100


class CaseNotificationAPI(APIView):
    # With cookie: cache requested url for each user for a minute
    permission_classes = (IsAuthenticated, PendingUserPermission)

    @method_decorator(cache_page(300))
    @method_decorator(vary_on_cookie)
    def get(self, request, format=None):
        data = []
        #return Response([])
        #any new posts?
        #should this be assigned cases for coordinators?
        cases = my_cases(request.user)
        active_cases = cases.filter(status = Case.ACTIVE_STATUS).order_by('-modified')[:20]
        for case in active_cases:
            cv = CaseViewed.objects.filter(case=case, user=request.user).first()
            if cv:
                threads = _my_case_threads(request.user, case)
                unseen_posts = Post.objects.filter(thread__in=threads, created__gte=cv.date_viewed).exclude(author__user=request.user).count()
                if unseen_posts > 1:
                    data.append({'case': case, 'text': f'You have {unseen_posts} new posts in {case.caseid}'})
                elif unseen_posts == 1:
                    data.append({'case': case, 'text': f'You have {unseen_posts} new post in {case.caseid}'})

                advisory = AdvisoryRevision.objects.filter(advisory__case=case, date_shared__gte=cv.date_viewed).exclude(date_shared__isnull=True)
                if advisory:
                    data.append({'case': case, 'text': f'There is a new draft of the advisory in {case.caseid} to view'})

                vuls = Vulnerability.objects.filter(case=case, publish=True, deleted=False, date_added__gte=cv.date_viewed).exclude(user=request.user)
                if vuls:
                    data.append({'case': case, 'text': f'There is {len(vuls)} new vulnerabilities in {case.caseid} to view'})
                artifacts = CaseArtifact.objects.filter(case=case, shared=True, action__created__gte=cv.date_viewed).exclude(action__user=request.user)
                if artifacts:
                    data.append({'case': case, 'text': f'There are {len(artifacts)} new files in {case.caseid}'})

            else:
                data.append({'case': case, 'text': f'You have a new case to view: {case.caseid}.'})

        serializer = NotificationSerializer(data, many=True)
        return Response(serializer.data)



class CreateNewCaseView(LoginRequiredMixin, UserPassesTestMixin, FormView):
    form_class = CreateCaseForm
    template_name = "cvdp/newcase.html"
    login_url= "authapp:login"

    def get_success_url(self):
        return

    def test_func(self):
        return is_coordinator(self.request.user)

    def get_initial(self):
        initial = {}
        initial['case_id'] = generate_case_id()
        return initial

    def form_invalid(self, form):
        logger.debug("INVALID FORM")
        logger.debug(f"{self.__class__.__name__} errors: {form.errors}")

        return render(self.request, 'cvdp/newcase.html',
                      {'form': form,})

    def post(self, request, *args, **kwargs):
        logger.debug(f"{self.__class__.__name__} post: {self.request.POST}")

        form_class = self.get_form_class()
        form = self.get_form(form_class)
        if form.is_valid():
            return self.form_valid(form)
        else:
            return self.form_invalid(form)

    def form_valid(self, form):
        logger.debug(f"VALID FORM {form.cleaned_data}")
        case = form.save()
        case.created_by = self.request.user
        case.save()

        new_state = CaseState.objects.filter(code = "new").first()
        action = create_case_action(f"created case {case.caseid}", self.request.user, case, state=new_state)
        
        thread = CaseThread.objects.filter(case=case, official=True).first()
        #assign my coord group to ensure user can see the case
        group = my_coord_teams(self.request.user)
        if group:
            group = group.first()
            add_new_case_participant(thread, group.groupprofile.uuid, self.request.user, 'owner')
            action = create_case_action(f"assigned case to {group.name}", self.request.user, case)
            create_case_change(action, "owner", None, group.name)

        if form.cleaned_data.get('auto_assign'):
            contact = Contact.objects.filter(user=self.request.user).first()
            add_new_case_participant(thread, contact.uuid, self.request.user, 'owner')
            triage_state = CaseState.objects.filter(code='triage').first()
            action = create_case_action(f"assigned case to {self.request.user.screen_name}", self.request.user, case, state=triage_state)
            create_case_change(action, "owner", None, self.request.user.screen_name)
            bump_case_state(case, "triage")

        return redirect("cvdp:case", case.case_id)


class EditCaseView(LoginRequiredMixin, UserPassesTestMixin, generic.UpdateView):
    form_class = EditCaseForm
    model = Case
    login_url = "authapp:login"
    template_name = 'cvdp/edit_case.html'

    def test_func(self):
        case = get_object_or_404(Case, case_id=self.kwargs.get('caseid'))
        return is_case_owner(self.request.user, case.id)

    def get_object(self, queryset=None):
        return Case.objects.get(case_id=self.kwargs.get('caseid'))

    def form_valid(self, form):
        logger.debug(form.cleaned_data)
        case = form.save(user=self.request.user)
        return HttpResponseRedirect(case.get_absolute_url())



class AdvisoryUploadView(LoginRequiredMixin, UserPassesTestMixin, generic.TemplateView):
    login_url = "authapp:login"
    template_name='cvdp/notemplate.html'

    def test_func(self):
        return is_coordinator(self.request.user)


    def post(self, request, *args, **kwargs):
        artifact = add_artifact(self.request.FILES['image'])
        url = reverse("cvdp:artifact", args=[artifact.uuid])
        return JsonResponse({'status': 'success', 'image_url': url}, status=200)


class CSAFSettingsAPIView(viewsets.ModelViewSet):
    serializer_class = CSAFSettingsSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseOwnerWritePermission)

    def get_view_name(self):
        return f"CSAF Settings API"

    def get_object(self):
        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        self.check_object_permissions(self.request, case)
        return get_object_or_404(CaseCSAFSettings, case__case_id=self.kwargs['caseid'])

    def create(self, request, *args, **kwargs):

        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        self.check_object_permissions(self.request, case)
        #only case owners can create advisory
        #if not is_case_owner(self.request.user, case.id):
        #    raise PermissionDenied()

        existing_settings =  CaseCSAFSettings.objects.filter(case=case).first()

        if existing_settings:
            serializer = self.serializer_class(instance=existing_settings, data=request.data, partial=True)
        else:
            serializer = self.serializer_class(data=request.data)

        if serializer.is_valid():
            serializer.save(case=case)
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)


class AdvisoryAPIView(viewsets.ModelViewSet):
    serializer_class = AdvisorySerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseAccessPermission)

    #TODO - add if advisory is shared to participants?

    def get_view_name(self):
        return f"Case Advisory API"

    def get_object(self):
        ca = CaseAdvisory.objects.filter(case__case_id=self.kwargs['caseid']).first()
        if ca:
            if is_coord_team(self.request.user, ca.case.id) or ca.current_revision.date_shared or ca.current_revision.date_published:
                return ca.current_revision
            #get last shared?
            if ca.date_published:
                #get last published
                return AdvisoryRevision.objects.filter(advisory=ca).exclude(date_published__isnull=True).order_by('-revision_number').first()
            elif AdvisoryRevision.objects.filter(advisory=ca).exclude(date_shared__isnull=True).exists():
                #has any revision been shared at any point?
                return AdvisoryRevision.objects.filter(advisory=ca).exclude(date_shared__isnull=True).order_by('-revision_number').first()
        elif is_coordinator(self.request.user):
            raise Http404
        #this revision has not been shared
        raise PermissionDenied()


    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return AdvisoryRevision.objects.none()

        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        if is_coord_team(self.request.user, case.id):
            return AdvisoryRevision.objects.filter(advisory__case__case_id=self.kwargs['caseid']).order_by('-revision_number')
        else:
            return AdvisoryRevision.objects.filter(advisory__case__case_id=self.kwargs['caseid']).exclude(date_shared__isnull=True).order_by('-revision_number')

    def update(self, request, **kwargs):
        #only case owners can share advisory
        ca = get_object_or_404(CaseAdvisory, case__case_id=self.kwargs['caseid'])
        if not is_case_owner(self.request.user, ca.case.id):
            raise PermissionDenied()

        revision = ca.current_revision

        serializer = self.serializer_class(instance=revision, data=request.data, partial=True)

        if serializer.is_valid():
            logger.debug(request.data)

            if request.data.get('date_shared'):

                if revision.date_shared:
                    revision.date_shared = None
                    revision.save()
                    bump_case_state(ca.case, "advisory_development", True)
                    #unshare?
                    action = create_case_action("unshared Advisory draft", self.request.user, ca.case)
                else:

                    if not (can_share_case(ca.case, self.request.user)):
                        raise PermissionDenied("This case has not been approved to share")
                    
                    case_state = CaseState.objects.filter(code="vendor_review").first()
                    revision.date_shared = timezone.now()
                    action = create_case_action("shared Advisory draft", self.request.user, ca.case, True, state=case_state)

                    revision.save()
                    if case_state:
                        bump_case_state(ca.case, "vendor_review")

            elif request.data.get('date_published'):

                log = ""
                version = ""

                if not (can_publish_case(ca.case, self.request.user)):
                    raise PermissionDenied("This case has not been approved to publish")
                
                if not ca.date_published:
                    version = "1.0.0"
                else:
                    #get last published version
                    revs = AdvisoryRevision.objects.filter(advisory=ca).exclude(date_published__isnull=True).order_by('-revision_number').first()
                    version = revs.version_number

                logger.debug(f"VERSION is {version}")
                if not version:
                    version = "1.0.0"

                version_list = version.split('.')
                if len(version_list) < 3:
                    #this is wrong
                    if (len(version_list) > 0):
                        #just use first number
                        version = f"{version_list[0]}.0.0"
                if revision.date_published:
                    if (revision.version_number == version):
                        # this was the last published version
                        # revision already published/ content hasn't changed
                        log = request.data.get('log', 'non-content update')
                        #bump minor version
                        version = f"{version_list[0]}.{int(version_list[1])+1}.0"
                    else:
                        log = request.data.get('log', 'Content update')
                        #bump major version
                        version = f"{int(version_list[0])+1}.0.0"
                else:
                    log = request.data.get('log', revision.user_message)
                    #if not published, this should default to 1.0.0
                    if ca.date_published:
                        #this was already published so bump version #
                        version = f"{int(version_list[0])+1}.0.0"


                ca.add_revision(AdvisoryRevision(user=self.request.user,
                                                 title=revision.title,
                                                 content=revision.content,
                                                 json_content=revision.json_content,
                                                 references=revision.references,
                                                 date_published=timezone.now(),
                                                 version_number = version,
                                                 user_message=log),
                                save=True)



                case_state = CaseState.objects.filter(code="published").first()
                if ca.date_published:
                    action = create_case_action("re-published advisory", self.request.user, ca.case, True, state=case_state)
                    action.advisory = ca.current_revision
                    action.save()

                else:
                    action = create_case_action("published advisory", self.request.user, ca.case, True, state=case_state)
                    ca.date_published = timezone.now()
                    action.advisory = ca.current_revision
                    action.save()

                if case_state:
                    bump_case_state(ca.case, "published")
                ca.date_last_published = timezone.now()
                ca.save()


        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)


        return Response({}, status=status.HTTP_202_ACCEPTED)

    def create(self, request, *args, **kwargs):
        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])

        #only case owners can create advisory
        if not is_case_owner(self.request.user, case.id):
            raise PermissionDenied()

        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            advisory, created = CaseAdvisory.objects.update_or_create(case=case)

            if not created:
                version = advisory.current_revision.version_number
                if version:
                    version_list = version.split('.')
                    if len(version_list) < 3:
                        #this is wrong
                        if (len(version_list) > 0):
                            #just use first number
                            version_number = f"{version_list[0]}.0.0"
                    if advisory.date_published:
                        version_number = f"{int(version_list[0])+1}.0.0"
                    else:
                        version_number = f"{int(version_list[0])}.{int(version_list[1])+1}.0"
                else:
                    version_number = "0.1.0"
            else:
                version_number = "0.1.0"



            advisory.add_revision(AdvisoryRevision(user=self.request.user,
                                                   title=request.data['title'],
                                                   content=request.data['content'],
                                                   json_content=request.data.get('json_content', []),
                                                   references=request.data.get('references'),
                                                   version_number = version_number,
                                                   user_message=request.data.get('user_message', '')),
                                  save=True)

            case_state = CaseState.objects.filter(code="advisory_development").first()
            if created:
                action = create_case_action("created initial case advisory draft", self.request.user, case, case_state)
                action.advisory = advisory.current_revision
                action.save()

                if case_state:
                    bump_case_state(case, "advisory_development")
            else:
                action = create_case_action("modified case advisory", self.request.user, case, state=case_state)
                action.advisory = advisory.current_revision
                action.save()

            serializer = self.serializer_class(instance=advisory.current_revision)
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)


class AdvisoryRevisionAPIView(viewsets.ModelViewSet):
    serializer_class = AdvisorySerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)

    #TODO - add if advisory is shared to participants?
    def get_view_name(self):
        return f"Case Advisory Revisions API"

    def update(self, request, **kwargs):
        #only case owners can share advisory
        ca = get_object_or_404(CaseAdvisory, case__case_id=self.kwargs['caseid'])
        if not is_case_owner(self.request.user, ca.case.id):
            raise PermissionDenied()
        logger.debug(request.data)
        serializer = self.serializer_class(data=request.data, many=True)
        if not serializer.is_valid():
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)
        logger.debug(request.data)


        for rev in request.data:
            instance = AdvisoryRevision.objects.filter(advisory=ca, revision_number=rev['revision_number']).first()
            serializer = self.serializer_class(instance, data=rev, partial=True)
            if serializer.is_valid():
                serializer.save()
            else:
                logger.debug(serializer.errors)
                return Response(serializer.errors,
                                status=status.HTTP_400_BAD_REQUEST)

        if CaseState.objects.filter(code="vendor_review").exists():
            bump_case_state(ca.case, "vendor_review")

        action = create_case_action("modified case advisory revision metadata", self.request.user, ca.case)
        return Response({}, status=status.HTTP_202_ACCEPTED)

class CSAFPDFView(generic.TemplateView):
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)

    def get(self, request, *args, **kwargs):
        caseid = self.kwargs['caseid']
        case = get_object_or_404(Case, case_id=caseid)
        advisory = get_object_or_404(CaseAdvisory, case=case)

        if not is_case_owner(self.request.user, case.id):
            raise PermissionDenied()
        
        serializer = CSAFAdvisorySerializer(case)
        csaf = serializer.data
        
        buffer = io.BytesIO()
        p = generate_csaf_pdf(buffer, csaf)
        
        # Close the PDF object cleanly, and we're done.
        #p.showPage()
        #p.save()
        
        # FileResponse sets the Content-Disposition header so that browsers
        # present the option to save the file.
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=False, filename=f"{case.caseid}_CSAF.pdf")


class CSAFAdvisoryDownloadView(generic.TemplateView):
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseAccessPermission)
    
    def get(self, request, *args, **kwargs):
        
        caseid = self.kwargs['caseid']
        case = get_object_or_404(Case, case_id=caseid)
        advisory = get_object_or_404(CaseAdvisory, case=case)

        if not is_coord_team(self.request.user, case.id):
            #was any revision shared?                                                                                           
            if not AdvisoryRevision.objects.filter(advisory=advisory).filter(Q(date_shared__isnull=False) | Q(date_published__isnull=False)).exists():
                raise Http404

        serializer = CSAFAdvisorySerializer(case)
        csaf = serializer.data

        json_data = json.dumps(csaf)
        
        # Create an HttpResponse object
        response = HttpResponse(json_data, content_type='application/force-download')
        
        # Set the Content-Disposition header to force download and suggest a filename
        response['Content-Disposition'] = f'attachment; filename="{case.caseid}.json"'
    
        return response
    
    

class CSAFAdvisoryAPIView(generics.RetrieveAPIView):
    serializer_class = CSAFAdvisorySerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseAccessPermission)
    renderer_classes=[JSONRenderer, BrowsableAPIRenderer]

    def get_view_name(self):
        return "Case Advisory in CSAF format"

    def get_renderer_context(self, *args, **kwargs):
        context = super().get_renderer_context(*args, **kwargs)
        context['indent'] = 2  # Set indentation to 2 spaces
        return context

    def get_object(self):
        caseid = self.kwargs['caseid']
        case = get_object_or_404(Case, case_id=caseid)
        advisory = get_object_or_404(CaseAdvisory, case=case)
        if is_coord_team(self.request.user, case.id):
            return case
        #was any revision shared?
        if AdvisoryRevision.objects.filter(advisory=advisory).filter(Q(date_shared__isnull=False) | Q(date_published__isnull=False)).exists():
            return case
        raise Http404

    """def get(self, request, *args, **kwargs):

        case = self.get_object()

        serializer = self.serializer_class(case)

        data = JsonResponse(serializer.data)

        logger.debug(data.content)

        jsono = json.loads(data.content)
        logger.debug(jsono)
        valid_csaf = validate_csaf(jsono)

        return Response(serializer.data)"""

class VulVEXAPIView(generics.RetrieveAPIView):
    serializer_class = VEXSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseObjectAccessPermission)

    def get_view_name(self):
        return "Vulnerability Status in VEX format"

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({"user": self.request.user})
        return context

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Vulnerability.objects.none()

        return Vulnerability.objects.filter(id=self.kwargs['pk'])

    def get_object(self):
        vul = get_object_or_404(Vulnerability, id=self.kwargs['pk'])
        self.check_object_permissions(self.request, vul.case)
        #this vulnerability also has to have some status associated with it.
        if is_coord_team(self.request.user, vul.case.id):
            if ComponentStatus.objects.filter(vul=vul).exists():
                return vul
            else:
                raise Http404
        else:
            #can only get component status for this vulnerability for components this user
            #has access to
            my_components = my_components(self.request.user)
            if ComponentStatus.objects.filter(vul=vul, component__in=my_components).exists():
                return vul
            else:
                raise Http404

class AdviseFilterBackend(DjangoFilterBackend):
    def get_filterset_kwargs(self, request, queryset, view):
        kwargs = super().get_filterset_kwargs(request, queryset, view)
        if hasattr(view, 'get_filterset_kwargs'):
            kwargs.update(view.get_filterset_kwargs())

        return kwargs

class CaseAPIFilter(django_filters.FilterSet):

    owner = django_filters.MultipleChoiceFilter(
        field_name="owner",
        method="filter_owner",
        choices=[],
        label="owner"
    )

    status = django_filters.MultipleChoiceFilter(
        field_name="status",
        method="filter_status",
        choices=Case.STATUS_CHOICES,
        label="status"
    )

    owned = django_filters.BooleanFilter(
        field_name="owned",
        method="filter_my_cases",
        label="owned"
    )

    def filter_my_cases(self,queryset, name, value):
        #return cases owned  by me if staff, otherwise ignore
        if is_coordinator(self.request.user) and value:
            cases = CaseParticipant.objects.filter(contact__user=self.request.user, role="owner").values_list('case')
            return queryset.filter(id__in=cases)
        else:
            return queryset

    def filter_owner(self, queryset, name, value):
        unassigned = None
        qs = Case.objects.none()
        if ('0' in value):
            #find unassigned cases - first get all assigned cases
            assigned_cases = CaseParticipant.objects.filter(role="owner").values_list('case__id', flat=True)
            unassigned = queryset.exclude(id__in=assigned_cases)
            value = value.remove('0')
        if value:
            cases = CaseParticipant.objects.filter(Q(contact__uuid__in=value)|Q(group__groupprofile__uuid__in=value), role="owner").values_list('case')
            #get all the cases owned by value, then filter the given queryset
            qs = queryset.filter(id__in=cases)
        if unassigned:
            if qs:
                return unassigned | qs
            return unassigned
        return qs


    def filter_status(self, queryset, name, value):
        return queryset.filter(status__in=value)

    def __init__(self, *args, **kwargs):
        super(CaseAPIFilter, self).__init__(*args, **kwargs)
        users = User.objects.filter(is_active=True, groups__name__in=['coordinator', 'coordinator_mgr'])
        contacts = Contact.objects.filter(user__in=users)
        groups = Group.objects.filter(groupprofile__active=True, groupprofile__vendor_type="Coordinator")
        self.filters["owner"].extra['choices'] = [(0, 'Unassigned')] + [(q.uuid, q.user.screen_name) for q in contacts] + [(q.groupprofile.uuid, q.name) for q in groups]


def process_query_for_tags(s):
    t = s.lower()
    ret = t.split()
    ret.append(s)
    return ret
        
def _search_cases(mycases, searchterm, user):
    search_query = None
    search_tags = []
    
    if searchterm:
        search_query = process_query(searchterm)
        search_tags = process_query_for_tags(searchterm)
        

    casetags = list(CaseTag.objects.filter(case__in=mycases, tag__in=search_tags).values_list('case__id', flat=True))
    vultags = list(VulnerabilityTag.objects.filter(vulnerability__case__in=mycases, tag__in=search_tags).values_list('vulnerability__case__id', flat=True))
    
    cases = list(Case.objects.search_my_cases(mycases, search_query).values_list('id', flat=True))
    vuls = Vulnerability.objects.search_my_cases(mycases, search_query).values_list('case__id', flat=True)
    advisory = CaseAdvisory.objects.search_my_cases(mycases, search_query).values_list('case__id', flat=True)

    search_titles = list(mycases.filter(Q(title__icontains=searchterm)|Q(summary__icontains=searchterm)).values_list('id', flat=True))
    
    artifacts = CaseArtifact.objects.search_my_cases(mycases, searchterm).values_list('case__id', flat=True)

    if not is_coordinator(user):
        vuls = vuls.filter(deleted=False, publish=True)
        advisory = advisory.exclude(current_revision__date_shared__isnull=True)
        artifacts = artifacts.exclude(shared=False)
        comps = []
    else:
        q = SearchQuery(search_query)
        comps = ComponentStatus.objects.filter(vul__case__in=mycases).filter(Q(component__name__icontains=searchterm)|Q(component__search_vector=q)).values_list('vul__case__id', flat=True)

        
    vuls = list(vuls)
    advisory = list(advisory)
    artifacts=list(artifacts)
    comps = list(comps)

    case_list = cases + vuls + advisory + artifacts + search_titles + casetags + vultags + comps

    dedup = list(dict.fromkeys(case_list))

    return Case.objects.filter(id__in=dedup)



class CaseStateAPIView(viewsets.ModelViewSet):
    serializer_class = CaseStateSerializer
    permission_classes = (IsAuthenticated, CoordinatorPermission)


    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return CaseState.objects.none()
        return CaseState.objects.filter(parent__isnull=True).order_by('order')


class CaseMetricsAPIView(APIView):
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)
    serializer_class = CaseMetricsSerializer

    def get_view_name(self):
        return "Case Metrics"

    def get(self, request, *args, **kwargs):
        context = {}

        end = datetime.now(pytz.utc)
        start = datetime.now(pytz.utc) - timedelta(days=30)

        if self.request.GET.get('start') and self.request.GET.get('end'):
            start = make_aware(datetime.strptime(self.request.GET.get('start'), '%Y-%m-%d'))
            end = make_aware(datetime.strptime(self.request.GET.get('end'), '%Y-%m-%d'))

        #end should be the end of the day
        end = end+timedelta(days=1)

        if self.request.GET.get('user'):
            cases = CaseParticipant.objects.filter(contact__uuid=self.request.GET.get('user'), role="owner").values_list('case')
            context['cases'] = Case.objects.filter(id__in=cases)
            context['cases_by_state'] = context['cases'].values("state").annotate(c=Count("id")).order_by("state")
            serializer = UserCaseMetricsSerializer(context)
            return Response(serializer.data)

        context['teams'] = []
        coord_groups = []
        context['lead'] = 0
        
        if is_in_lead_coord_team(request.user):
            g = GroupProfile.objects.filter(vendor_type="Coordinator", active=True).values_list('group__id', flat=True)
            coord_groups = Group.objects.filter(id__in=g).exclude(user__isnull=True).exclude(groupprofile__active=False)
            #gs = GroupSerializer(coord_groups, many=True)
            #context["teams"] = gs.data
            context["teams"] = coord_groups
            context["lead"] = 1
        else:
            coord_groups = my_coord_teams(request.user)
            context["teams"] = coord_groups
            context["cases_per_team"] = []
            context["cases_by_state"] = []

        context['states'] = CaseState.objects.filter(parent__isnull=True).order_by('order')
        #get all cases assigned to available coord_groups
        cases = my_cases(request.user)
        context['team_metrics'] = []

        
        for team in context['teams']:
            team_metric = {}
            team_metric["team_name"] = team.name
            cp = CaseParticipant.objects.filter(role="owner", group=team)
            team_metric["cases_triaged"] = cp.filter(added__gte=start, added__lte=end).count()

            owners = cp.values_list("case")
            team_cases = cases.filter(id__in=owners)
            team_metric["vendors_notified"] = CaseParticipant.objects.filter(case__in=owners, role="supplier", notified__gte=start, notified__lte=end).count()
            team_metric["cases_published"] = CaseAdvisory.objects.filter(case__in=owners, date_published__gte=start, date_published__lte=end).count()
            team_metric["cases_by_status"] = team_cases.values("status").annotate(c=Count("id")).order_by("status")
            team_metric["cases_by_state"] = team_cases.values("state").annotate(c=Count("id")).order_by("state")
            team_metric["cases_per_user"] = CaseParticipant.objects.filter(case__in=team_cases, role="owner", contact__isnull=False).values("contact__user__screen_name", "contact__uuid").annotate(c=Count("id")).order_by("contact__user__screen_name")
            team_metric["team_cases_by_tag"] = CaseTag.objects.filter(case__in=team_cases).values('tag').annotate(c=Count("id")).order_by("tag")
            team_metric["cases_started"] = team_cases.filter(created__gte=start, created__lte=end).count()
            context['team_metrics'].append(team_metric)

        if context['lead']:
            context["cases_per_team"] = CaseParticipant.objects.filter(case__in=cases, role="owner", group__isnull=False).values("group__name").annotate(c=Count("id")).order_by("group__name")
            context["cases_by_state"] = cases.values("state").annotate(c=Count("id")).order_by("state")

        context['groups_added'] = GroupProfile.objects.filter(created__gte=start, created__lte=end).count()
        context['users_added'] = User.objects.filter(date_joined__gte=start, date_joined__lte=end).count()
        context["all_cases_by_tag"] = CaseTag.objects.filter(case__status=Case.ACTIVE_STATUS).values('tag').annotate(c=Count("id")).order_by("tag")

        context['groups_added_per_day'] = GroupProfile.objects.filter(created__gte=start, created__lte=end).annotate(day=Func(TruncDay("created"), Value('yyyy-MM-dd'),                                                                                                                function='to_char', output_field=CharField())) \
                                                   .values("day") \
                                                   .annotate(c=Count("id")) \
                                                   .order_by("day")
         #context['groups_added_per_day'] = dict((x['day'], x['c']) for x in gapd)
        context['users_added_per_day'] = User.objects.filter(date_joined__gte=start, date_joined__lte=end).annotate(
            day=Func(TruncDay("date_joined"), Value('yyyy-MM-dd'),                                                                function='to_char', output_field=CharField())) \
                                                   .values("day") \
                                                   .annotate(c=Count("id")) \
                                                   .order_by("day")
        #context['users_added_per_day'] = dict((x['day'], x['c']) for x in uapd)




        logger.debug(context)
        serializer = self.serializer_class(context)

        return Response(serializer.data)


class CaseMetricsView(LoginRequiredMixin, UserPassesTestMixin, generic.TemplateView):
    template_name = 'cvdp/metrics.html'
    login_url = "authapp:login"

    def test_func(self):
        return is_coordinator(self.request.user) and PendingTestMixin.test_func(self)

    def get_context_data(self, **kwargs):
        context = super(CaseMetricsView, self).get_context_data(**kwargs)
        context['metricspage']=1
        return context


class CaseMetadataAPIView(APIView):
    serializer_class = CaseMetadataSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission)

    def get(self, request, *args, **kwargs):
        context = {}
        case = None
        context['status'] = [{"id": u[0], "name": u[1]} for u in Case.STATUS_CHOICES]
        context['roles'] = []
        context['users'] = []
        context['teams'] = []
        context['states'] = []
        context['resolutions'] = []
        context['milestones'] = []
        context['approvals'] = []
        context['custom_report'] = False
        if (is_coordinator(self.request.user)):
            if self.kwargs.get('caseid'):
                case = get_object_or_404(Case, case_id=self.kwargs['caseid'])

            context['states'] = CaseState.objects.filter(parent__isnull=True).order_by('order')
            context['resolutions'] = CaseResolutionOptions.objects.all()
            #get roles that have users
            user_roles = UserAssignmentWeight.objects.all().values_list('role__id', flat=True).distinct()

            if case:
                context['unread'] = EmailThread.unread(self.kwargs['caseid'], self.request.user).count()
                context['unapproved'] = ComponentStatus.objects.filter(vul__case=case, current_revision__approved=False).distinct('component__name', 'component__product_info__supplier').order_by('component__name', 'component__product_info__supplier').count()
                context['milestones'] = CaseAction.objects.filter(case=case).exclude(state__isnull=True).distinct('state__id').order_by('state__id', '-created')
            #get coordinator groups - if user is part of global coordinator group
            if is_in_lead_coord_team(request.user):
                g = GroupProfile.objects.filter(vendor_type="Coordinator", active=True).values_list('group__id', flat=True)
                coord_groups = Group.objects.filter(id__in=g).exclude(user__isnull=True).exclude(groupprofile__active=False)
                context['teams'] = coord_groups

                if case:
                    #just provide users in team that is assigned to the cases
                    coord_groups = get_coord_team(case.id)
                    logger.debug(f"coord team for {case.case_id} is {coord_groups}")

                coordinators =  User.objects.filter(is_active=True, api_account=False, groups__in=coord_groups)
                context['users'] = coordinators.filter(groups__name__in=['coordinator', 'coordinator_mgr']).distinct('id')
                if case:
                    context['approvals'] = CaseApproval.objects.filter(case=case).order_by('-created')
                else:
                    context['approvals'] = CaseApproval.objects.filter(status=CaseApproval.WAITING).order_by('created')
                
                context["roles"] = list(AssignmentRole.objects.filter(id__in=user_roles).values_list('role', flat=True))

                
            else:
                #get current coord team
                context['teams'] = my_coord_teams(self.request.user)

                coordinators =  User.objects.filter(is_active=True, api_account=False, groups__in=context['teams'])
                context['users'] = coordinators.filter(groups__name__in=['coordinator', 'coordinator_mgr']).distinct('id')
                coord_cases = my_cases(self.request.user)
                if case in coord_cases:
                    context['approvals'] = CaseApproval.objects.filter(case=case).order_by('-created')
                else:
                    context['approvals'] = CaseApproval.objects.filter(case__in=coord_cases, status=CaseApproval.WAITING).order_by('created')
                #get roles in user's group or global groups
                roles = AssignmentRole.objects.filter(Q(group__in=context['teams']) | Q(group__isnull=True))
                context["roles"] = list(roles.filter(id__in=user_roles).values_list('role', flat=True))

        
        serializer = self.serializer_class(context, context={'user': self.request.user})
        return Response(serializer.data)


class CaseAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseObjectAccessPermission)
    lookup_field = "case_id"
    filterset_class=CaseAPIFilter
    pagination_class=StandardResultsPagination

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Case.objects.none()
        # get cases I have access to
        myc = my_cases(self.request.user)

        if self.request.GET.get('search'):
            return _search_cases(myc, self.request.GET['search'], self.request.user)
        return myc

    def get_serializer_class(self):
        if (self.kwargs.get('case_id')):
            case = get_object_or_404(Case, case_id=self.kwargs['case_id'])
            if is_coordinator(self.request.user):
                return CaseCoordinatorSerializer
            if case.status == Case.PENDING_STATUS:
                return PendingCaseSerializer
        if is_coordinator(self.request.user):
            return CaseDetailSerializer
        else:
            return CaseSerializer

    def get_object(self):
        case = get_object_or_404(Case, case_id=self.kwargs['case_id'])
        self.check_object_permissions(self.request, case)
        return case

    def create(self, request, *args, **kwargs):
        logger.debug("IN CASE CREATE VIEW")
        logger.debug(request.data)

        if not is_coordinator_mgr(request.user):
            return Response({'error': 'Permission Denied'}, status = status.HTTP_403_FORBIDDEN)

        serializer = CaseCoordinatorSerializer(data=request.data)
        if serializer.is_valid():
            case = serializer.save(case_id=generate_case_id(), created_by=self.request.user)

            action = create_case_action("created case", request.user, case, False)
            thread = CaseThread.objects.filter(case=case, official=True).first()
            #assign my coord group to ensure user can see the case
            group = my_coord_teams(self.request.user)
            if group:
                group = group.first()
                add_new_case_participant(thread, group.groupprofile.uuid, self.request.user, 'owner')
                action = create_case_action(f"assigned case to {group.name}", self.request.user, case)
                create_case_change(action, "owner", None, group.name)

        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status = status.HTTP_400_BAD_REQUEST)

        return Response(serializer.data, status=status.HTTP_202_ACCEPTED)

    def update(self, request, **kwargs):
        instance = self.get_object()
        #only case owners can update a case
        if not is_case_owner(self.request.user, instance.id):
            raise PermissionDenied()

        data = request.data

        logger.debug(request.data)

        existing_tags = CaseTag.objects.filter(case = instance).values_list('tag', flat=True)
        action = None
        if ('tags' in request.data):

            if len(existing_tags) > 0:
                for tag in existing_tags:
                    if tag not in request.data['tags']:
                        action = create_case_action(f"removed case tag {tag}", request.user, instance, True)
                        rmtag = CaseTag.objects.filter(case=instance, tag=tag).first()
                        rmtag.delete()
            for tag in request.data['tags']:
                tag, created = CaseTag.objects.update_or_create(case=instance, tag=tag,
                                                                defaults={'user':self.request.user})
                if created:
                    action = create_case_action(f"tagged case as {tag}", request.user, instance, True)
                                    
            if (request.data['tags'] == []):
                #remove existing tags
                existing_tags = CaseTag.objects.filter(case=instance)
                for tag in existing_tags:
                    action = create_case_action(f"removed case tag {tag}", request.user, instance, True)
                    tag.delete()


        sc = self.get_serializer_class()
        serializer = sc(instance=instance, data=data, partial=True)
        if serializer.is_valid():

            for field, val in data.items():
                if (val != getattr(instance, field, None)):
                    if not action:
                        action = create_case_action("modified case details", request.user, instance, True)                        
                    if (field == "status"):
                        create_case_change(action, field, instance.get_status_display(), val)
                        if (val == dict(Case.STATUS_CHOICES).get(Case.INACTIVE_STATUS)):
                            if CaseState.objects.filter(code="closed").exists():
                                bump_case_state(instance, "closed")
                    elif (field != "tags"):
                        create_case_change(action, field, getattr(instance, field), val)
            serializer.save()
            logger.debug(serializer.data)
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        return Response({}, status=status.HTTP_405_METHOD_NOT_ALLOWED)


class CasesView(LoginRequiredMixin, PendingTestMixin, generic.TemplateView):
    template_name = 'cvdp/searchcases.html'
    login_url = "authapp:login"
    model = Case

    def get_context_data(self, **kwargs):
        context = super(CasesView, self).get_context_data(**kwargs)
        context['casepage']=1
        return context


class CoordinatorCaseView(LoginRequiredMixin, UserPassesTestMixin, generic.TemplateView):
    template_name = 'cvdp/searchcases.html'
    login_url = "authapp:login"

    def test_func(self):
        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        return is_case_owner(self.request.user, case.id)

    def get_context_data(self, **kwargs):
        context = super(CoordinatorCaseView, self).get_context_data(**kwargs)
        context['casepage']=1
        return context

class ReactPostAPIView(viewsets.ModelViewSet):
    serializer_class = PostLikeSummarySerializer
    permission_classes= (IsAuthenticated, PendingUserPermission, CaseThreadObjectAccessPermission)

    def get_view_name(self):
        return f"Post Reactions"

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return PostLikes.objects.none()
        post = get_object_or_404(Post, id=self.kwargs['pk'])
        self.check_object_permissions(self.request, post.thread)
        return PostLikes.objects.filter(post=post).values('reaction').annotate(count=Count('reaction'),
                                                             users=StringAgg('user__screen_name', delimiter=", ")).order_by('-count')

    def create(self, request, *args, **kwargs):
        post = get_object_or_404(Post, id=self.kwargs['pk'])
        self.check_object_permissions(self.request, post.thread)
        serializer = PostLikeSerializer(data=request.data)
        if serializer.is_valid():
            reaction = PostLikes.objects.filter(user=self.request.user, reaction=request.data['reaction'], post=post)
            if reaction:
                reaction.delete()
            else:
                reaction = PostLikes.objects.create(user=self.request.user,
                                                   reaction=request.data['reaction'],
                                                   post=post)
                create_case_action(f"reacted to {post.author_text}'s post", self.request.user, post.thread.case, True)

            add_pulse(self.request.user, post.thread.case.id)

        logger.debug(self.get_queryset())
        data = self.serializer_class(self.get_queryset(), many=True)
        return Response(data.data, status=status.HTTP_202_ACCEPTED)



class PostAPIView(viewsets.ModelViewSet):
    serializer_class = PostSerializer
    permission_classes= (IsAuthenticated, PendingUserPermission, CaseThreadObjectAccessPermission)
    search_fields = ['current_revision__content']
    pagination_class=StandardResultsPagination

    def get_view_name(self):
        return f"Case Posts"

    def get_object(self):
        obj = get_object_or_404(Post, id=self.kwargs['pk'])
        self.check_object_permissions(self.request, obj.thread)
        if obj.deleted:
            raise Http404
        return obj

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if not is_coordinator(self.request.user):
            gs = GlobalSettings.objects.all().first()
            if gs and gs.coordinator_identity:
                context['coordinator'] = gs.coordinator_identity
                context['owner'] = gs.group
        return context
    
    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Post.objects.none()
        case = get_object_or_404(CaseThread, id=self.kwargs['pk'])
        self.check_object_permissions(self.request, case)
        if self.request.GET.get('pinned'):
            return Post.objects.filter(thread=case, deleted=False, current_revision__isnull=False).exclude(pinned=False).exclude(postreply__isnull=False).order_by('-created')
        else:
            return Post.objects.filter(thread=case, deleted=False, current_revision__isnull=False).exclude(pinned=True).exclude(postreply__isnull=False).order_by('-created')

    #TODO Implement destroy
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        #only post author's and case owners can delete posts
        contact = get_object_or_404(Contact, user=self.request.user)
        if not(instance.author == contact or is_case_owner(self.request.user, instance.thread.case.id)):
            raise PermissionDenied()
        action = create_case_action(f"deleted post {instance.id}", self.request.user, instance.thread.case, False)
        action.post = instance.current_revision
        action.save()
        instance.deleted = True
        instance.save()
        return Response({}, status=status.HTTP_202_ACCEPTED)

    def update(self, request, **kwargs):
        logger.debug("IN POST UPDATE VIEW")
        instance = self.get_object()
        #only post author's and case owners can edit someone's post
        contact = get_object_or_404(Contact, user=self.request.user)
        if not(instance.author == contact or is_case_owner(self.request.user, instance.thread.case.id)):
            raise PermissionDenied()
        data = request.data
        logger.debug(request.data)
        if (instance.thread.archived):
            return Response({'error': 'This thread has been archived and is read-only.'},
                            status=status.HTTP_400_BAD_REQUEST)
        serializer = self.serializer_class(instance=instance, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            instance.current_revision.set_from_request(self.request)

            action = create_case_action(f"updated post", self.request.user, instance.thread.case, True)
            action.post = instance.current_revision
            action.save()
            add_pulse(self.request.user, instance.thread.case.id)            
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

    def create(self, request, *args, **kwargs):
        logger.debug("IN POST CREATE VIEW")
        logger.debug(request.data)
        thread = get_object_or_404(CaseThread, id=self.kwargs['pk'])
        self.check_object_permissions(self.request, thread)
        if (thread.archived):
            return Response({'error': 'This thread has been archived and is read-only.'},
                            status=status.HTTP_400_BAD_REQUEST)
        contact = Contact.objects.filter(user=self.request.user).first()
        #get my group for case?
        groups = my_case_vendors(self.request.user, thread.case)
        logger.debug(groups)
        post = Post(thread = thread,
                    author = contact)
        author_text = f"{self.request.user.screen_name}"
        if groups:
            post.group = groups[0]
            author_text = f"{author_text} from {groups[0].name}"

        post_serializer = WritePostSerializer(data=request.data)
        if post_serializer.is_valid():
            #add some info about author in case user/group is ever removed - we can still
            # create a transcript of what happened/ who said what
            post.author_text = author_text
            post.save()

            json_post = []
            if request.data.get('json'):
                json_post = json.loads(request.data.get('json'))
            post.add_revision(PostRevision(content=request.data['content'], json_content=json_post), save=True)


            case_state = None 
            if not is_coordinator(self.request.user):
                #case discussion begins when a user other than the coordinator
                #posts in a case
                case_state = CaseState.objects.filter(code="case_discussion").first()
                if case_state:
                    bump_case_state(thread.case, "case_discussion")

            action = create_case_action(f"added post", self.request.user, post.thread.case, True, state=case_state)
            action.post = post.current_revision
            action.save()

            add_pulse(self.request.user, post.thread.case.id)
            if request.data.get('reply'):
                #this is a reply to another post
                parent = Post.objects.filter(id=request.data['reply']).first()
                #is this post a reply itself?
                old_pr = PostReply.objects.filter(post=parent).first()
                if old_pr:
                    pt = old_pr.reply
                else:
                    #create the thread
                    pt, created = PostThread.objects.update_or_create(parent=parent)

                #create the reply
                pr = PostReply(reply=pt,
                               post=post)
                pr.save()
                serializer = self.serializer_class(parent)
            else:
                serializer = self.serializer_class(post)

        else:
            return Response(serializer.errors(), status=status.HTTP_400_BAD_REQUEST)


        return Response(serializer.data, status=status.HTTP_202_ACCEPTED)

class ArchivedThreadView(viewsets.ModelViewSet):
    serializer_class = CaseThreadSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseAccessPermission)

    def get_view_name(self):
        return f"Archived Case Threads"

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return CaseThread.objects.none()

        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        #todo only allow threads user has access to
        logger.debug("IN ARCHIVED CASETHREADAPIVIEW")
        my_threads = _my_case_threads(self.request.user, case)
        #get archived threads user has access to
        logger.debug(my_threads)
        return my_threads.filter(archived=True)


class SearchThreadsAPIView(viewsets.ModelViewSet):
    serializer_class = CaseThreadPostSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseObjectAccessWritePermission)
    search_fields = ['current_revision__content', 'author_text', 'group__name']

    def get_view_name(self):
        return f"Search Case Threads"

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return CaseThread.objects.none()

        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        self.check_object_permissions(self.request, case)
        #todo only allow threads user has access to                                                                      
        my_threads = _my_case_threads(self.request.user, case)

        return Post.objects.filter(thread__in=my_threads, deleted=False, current_revision__isnull=False).order_by('-created')

class CaseThreadAPIView(viewsets.ModelViewSet):
    serializer_class = CaseThreadSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseObjectAccessWritePermission)

    def get_view_name(self):
        return f"Case Threads"

    def get_object(self):
        thread = get_object_or_404(CaseThread, id=self.kwargs['pk'])
        if is_my_case_thread(self.request.user, thread):
            return thread
        else:
            raise PermissionDenied

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return CaseThread.objects.none()

        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        self.check_object_permissions(self.request, case)
        #todo only allow threads user has access to
        my_threads = _my_case_threads(self.request.user, case)
        if self.request.GET.get('official'):
            return my_threads.filter(case=case, archived=False, official=True)
        else:
            return my_threads.filter(case=case, archived=False).order_by('created')

    def destroy(self, request, *args, **kwargs):
        thread = get_object_or_404(CaseThread, id=self.kwargs['pk'])
        if not(is_case_owner(self.request.user, thread.case.id)):
            raise PermissionDenied()

        if (thread.archived):
            #this thread is already archived, so unarchive
            thread.archived=False
            thread.save()
            return Response({}, status=status.HTTP_202_ACCEPTED)

        #check to see if this thread has posts?
        if Post.objects.filter(thread=thread).exists():
            #if so, we want to archive vs delete
            thread.archived=True
            thread.save()
            action = create_case_action(f"archived case thread with subject \"{thread.subject}\"",
                                        request.user, thread.case)
        else:
            thread.delete()
            action = create_case_action(f"deleted empty case thread with subject \"{thread.subject}\"",
                                        request.user, thread.case)

        return Response({}, status=status.HTTP_202_ACCEPTED)


    def update(self, request, **kwargs):
        thread = get_object_or_404(CaseThread, id=self.kwargs['pk'])
        if not(is_case_owner(self.request.user, thread.case.id)):
            raise PermissionDenied()
        logger.debug(f"IN UPDATE THREAD {self.request.POST}")

        serializer = self.serializer_class(instance=thread, data=self.request.data, partial=True)
        if serializer.is_valid():
            old_subject = thread.subject
            serializer.save()
            if (request.data.get("subject") and old_subject != request.data['subject']):
                action = create_case_action(f"renamed case thread title from to \"{old_subject}\" to \"{request.data['subject']}.\"", request.user, thread.case)
            serializer = self.get_serializer(thread)
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

    def create(self, request, *args, **kwargs):
        logger.debug(f"{self.__class__.__name__} post: {self.request.data}")
        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])

        if not(is_case_owner(self.request.user, case.id)):
            if CaseThread.objects.filter(created_by=self.request.user, case=case, archived=False).exists():
                #user only gets to create 1 add'l case thread to communicate with coordinator.
                raise PermissionDenied("User may only create 1 private thread on a case")
            
        coord_team = get_coord_team(case.id)

        subject = request.data.get('subject')
        logger.debug(subject)
        logger.debug(coord_team)
        cp = None
        if subject and coord_team:

            #need to find how this user relates to the case first!
            if not is_case_owner(self.request.user, case.id):
                # add the participant that initiated thread creation
                
                contact = Contact.objects.filter(user=self.request.user).first()
                cp = CaseParticipant.objects.filter(contact=contact, case=case).first()
                if not cp:
                    #find the group that this user is apart of
                    my_group = my_case_vendors(self.request.user, case)
                    if my_group: 
                        logger.debug(f"{my_group[0]} requesting new thread")
                        if len(my_group) > 1 and not request.data.get('group'):                    
                            return Response({'error': 'User is assigned to multiple groups'}, status=status.HTTP_400_BAD_REQUEST)
                        else:
                            if len(my_group) > 1:
                                my_group = Group.objects.filter(name=request.data.get('group'))
                                if not my_group:
                                    raise PermissionDenied()
                                if not self.request.user.groups.filter(name = my_group[0].name).exists():
                                    #this person isn't in this group!!!
                                    raise PermissionDenied()
                            cp = CaseParticipant.objects.filter(group=my_group[0], case=case).first()
                            if not cp:
                                raise PermissionDenied()
                    else:
                        raise PermissionDenied()
                    

            ct = CaseThread(case=case,
                            created_by=self.request.user,
                            subject=subject)
            ct.save()

            for coord in coord_team:
                #add the group that created it!
                coord_part = CaseParticipant.objects.filter(group=coord, case=case).first()
                if coord_part:
                    ctp = CaseThreadParticipant(thread=ct,
                                                participant=coord_part,
                                                added_by=self.request.user)
                    ctp.save()


            if cp:
                logger.debug("ADDING THREAD PARTICIPANT")
                ctp = CaseThreadParticipant(thread=ct,
                                            participant=cp,
                                            added_by=self.request.user)
                ctp.save()


            serializer = CaseThreadSerializer(ct)

            action = create_case_action(f"created new case thread with subject \"{subject}\"",
                                        request.user, case)

            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            if not subject:
                return Response({'error': 'subject is required'},
                                status=status.HTTP_400_BAD_REQUEST)
            else:
                return Response({'error': 'case not assigned'},
                                status = status.HTTP_400_BAD_REQUEST)



class CaseParticipantAPIView(viewsets.ModelViewSet):
    serializer_class = CaseParticipantSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseObjectAccessPermission)
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['role']

    def get_view_name(self):
        return f"Case Participants"

    def get_serializer_class(self):
        if is_coordinator(self.request.user):
            return CaseParticipantDetailSerializer
        return self.serializer_class

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if not is_coordinator(self.request.user):
            gs = GlobalSettings.objects.all().first()
            if gs and gs.coordinator_identity:
                context['coordinator'] = gs.coordinator_identity
                context['owner'] = gs.group
        return context
    
    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return CaseParticipant.objects.none()

        logger.debug("IN CASE PARTICIPANT API")
        c = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        self.check_object_permissions(self.request, c)
        if is_coordinator(self.request.user):
            return CaseParticipant.objects.filter(case=c).order_by('title')
        else:
            return CaseParticipant.objects.filter(case=c).exclude(notified__isnull=True).exclude(role='owner').order_by('title')


    def get_object(self):
        obj = get_object_or_404(CaseParticipant, id=self.kwargs['pk'])
        self.check_object_permissions(self.request, obj.case)
        return obj

    def update(self, request, **kwargs):
        logger.debug("IN UPDATE")
        instance = self.get_object()
        logger.debug("updating case participant")
        data = request.data
        logger.debug(request.data)
        gc = self.get_serializer_class()
        serializer = gc(instance=instance, data=data, partial=True)
        if serializer.is_valid():
            if request.data['role'] == 'owner':
                #doing this so we can send the assignment email
                cp = add_new_case_participant(instance.case.official_thread, instance.contact.uuid, request.user, request.data['role'])
                action = create_case_action(f"assigned {instance.name} to case", request.user, instance.case)
                action.participant=instance
                action.save()
            else:
                action = create_case_action(f"updated case participant {instance.name}", request.user, instance.case)
                action.participant=instance
                action.save()
                for field, val in data.items():
                    if (val != getattr(instance, field, None)):
                        create_case_change(action, field, getattr(instance, field), val)
                serializer.save()

            #get updated object
            instance = CaseParticipant.objects.get(id=instance.id)
            serializer = self.get_serializer(instance)
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

    def create(self, request, *args, **kwargs):
        logger.debug(self.request.POST)
        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        self.check_object_permissions(request, case)
        names = self.request.POST.getlist('names[]', [])
        role = self.request.POST.get('role', 'supplier')
        role = role.lower()
        if not(any(role in i for i in CaseParticipant.CASE_ROLES)):
            return Response({'error': 'Invalid Role'},
                            status=status.HTTP_400_BAD_REQUEST)
        thread = CaseThread.objects.filter(case=case, official=True).first()
        added = []
        for n in names:
            try:
                cp = add_new_case_participant(thread, n, self.request.user, role)
                if cp:
                    added.append(cp.name)
            except InvalidRoleException as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        if added:
            action = create_case_action(f"added participants to case: {(', ').join(added)}", request.user, case)
        return Response({}, status=status.HTTP_202_ACCEPTED)

    def destroy(self, request, *args, **kwargs):
        participant = self.get_object()
        self.check_object_permissions(request, participant.case)
        action = create_case_action(f"removed participant {participant.name} from case", request.user, participant.case)
        # get all threads
        threads = CaseThreadParticipant.objects.filter(participant=participant)
        for t in threads:
            t.delete()

        participant.delete()
        return Response({}, status=status.HTTP_202_ACCEPTED)


class CaseParticipantSummaryAPIView(generics.GenericAPIView):
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseObjectAccessPermission)
    serializer_class = CaseParticipantSummarySerializer

    def get_view_name(self):
        return "Case Participant Summary View"

    def summarize(self, request, *args, **kwargs):
        # make sure the filters of the parent class get applied
        queryset = self.filter_queryset(self.get_queryset())
        # do summary stuff here
        stats = {'count': queryset.count(),
                 'notified': queryset.filter(notified__isnull=False).count(),
                 'vendors': queryset.filter(role='supplier').count(),
                 'notified_vendors': queryset.filter(notified__isnull=False, role='supplier').count()}
        return Response(stats)

    def get_queryset(self):
        c = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        if is_coord_team(self.request.user, c.id):
            return CaseParticipant.objects.filter(case=c)
        else:
            return CaseParticipant.objects.filter(case=c).exclude(notified__isnull=True)

    def get(self, request, *args, **kwargs):
        logger.debug("IN CASE PARTICIPANT SUMMARY API")
        c = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        self.check_object_permissions(self.request, c)
        return self.summarize(request, *args, **kwargs)


class CaseThreadParticipantAPIView(viewsets.ModelViewSet):
    serializer_class = CaseThreadParticipantSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseThreadObjectAccessPermission)

    def get_view_name(self):
        return f"Case Thread Participants"

    def get_serializer_class(self):
        if is_coordinator(self.request.user):
            return CaseThreadParticipantDetailSerializer
        return self.serializer_class
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        if not is_coordinator(self.request.user):
            gs = GlobalSettings.objects.all().first()
            if gs and gs.coordinator_identity:
                context['coordinator'] = gs.coordinator_identity
                context['owner'] = gs.group
        return context
    
    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return CaseThreadParticipant.objects.none()
        logger.debug("IN THREADAPI")
        casethread = get_object_or_404(CaseThread, id=self.kwargs['pk'])
        self.check_object_permissions(self.request, casethread)

        if is_case_owner(self.request.user, casethread.case.id):
            return CaseThreadParticipant.objects.filter(thread=casethread).order_by('participant__title')
        else:
            coord_users = CaseThreadParticipant.objects.filter(thread=casethread, participant__role='owner', participant__contact__isnull=False).values_list('id', flat=True)
            return CaseThreadParticipant.objects.filter(thread=casethread).exclude(participant__notified__isnull=True).exclude(id__in=coord_users).order_by('participant__title')


    def create(self, request, *args, **kwargs):
        logger.debug(self.request.POST)
        thread = get_object_or_404(CaseThread, id=self.kwargs['pk'])
        if not(is_case_owner(request.user, thread.case.id)):
            #only case owners can add participants to a thread
            raise PermissionDenied
        names = self.request.POST.getlist('names[]', [])

        role = self.request.POST.get('role', None)

        if thread.official and not role:
            role = 'supplier' #set default

        if (role):
            role = role.lower()

            if not(any(role in i for i in CaseParticipant.CASE_ROLES)):
                return Response({'error': 'Invalid Role'},
                                status=status.HTTP_400_BAD_REQUEST)
        added = []
        for n in names:
            try:
                cp = add_new_case_participant(thread, n, self.request.user, role)
                if cp:
                    added.append(cp.name)
            except InvalidRoleException as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        title = None
        if thread.official:
            if role == "owner":
                title = f" assigned {(', ').join(added)} to the case"
            elif len(added) > 1:
                title = f"added {role}s to case: {(', ').join(added)}"
            elif added:
                title = f"added {added[0]} to case as {role}."
        else:
            if len(added) >  1:
                title = f"added participant to case thread \"{thread.subject}\": {(', ').join(added)}"
            elif added:
                title = f"added {added[0]} to case thread \"{thread.subject}\"."
        if title:
            #make sure this isn't a NOP
            action = create_case_action(title, request.user, thread.case)

        return Response({}, status=status.HTTP_202_ACCEPTED)

    def destroy(self, request, *args, **kwargs):
        participant = get_object_or_404(CaseThreadParticipant, id=self.kwargs['pk'])
        if not(is_case_owner(request.user, participant.thread.case.id)):
            raise PermissionDenied()

        if participant.thread.official:
            #this is the official thread, so remove from Case too
            action = create_case_action(f"removed participant {participant.participant.name} from case", request.user, participant.thread.case)
            participant.participant.delete()
        else:
            action = create_case_action(f"removed participant {participant.participant.name} from case thread \"{participant.thread.subject}\"", request.user, participant.thread.case)
            participant.delete()
        return Response({}, status=status.HTTP_202_ACCEPTED)

class UserCaseStateAPIView(generics.RetrieveAPIView):
    serializer_class = UserCaseStateSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseAccessPermission)

    def get_view_name(self):
        return f"User Case State"

    def get_object(self):
        user = self.request.user
        contact = get_object_or_404(Contact, user__id=user.id)
        #get case last viewed state
        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        role = my_case_role(user, case)
        groups = my_case_vendors(user, case)
        #user has to be part of a coord group to assign themselves
        logger.debug(f"{self.request.user.screen_name} is {role} {groups}")
        if (role == "owner" and not is_coordinator(user)):
            #this is most likely a misconfiguration.
            role = "participant"

        status_needed = False
        if (role != "owner" and is_coordinator(user) and groups):
            #this is a special role - because coordinators should be able to do
            # some special editing things, like initial assignment,
            role = "coordinator"
        elif (role == "supplier"):
            status_needed = get_status_status(case, user)
        cv = CaseViewed.objects.filter(case=case, user=user).first()
        
        if (cv):
            my_threads = _my_case_threads(self.request.user, case)
            priv_thread = my_threads.filter(created_by=self.request.user, archived=False).exists()
            new_posts = list(Post.objects.filter(thread__in=my_threads, created__gte=cv.date_viewed).exclude(author__user=self.request.user).values_list('id', flat=True))
            cs = UserCaseState(user, contact.uuid, cv.date_viewed, role, status_needed, groups, new_posts, priv_thread)

        else:
            cs = UserCaseState(user, contact.uuid, None, role, status_needed, groups)

        #update time viewed
        cviewed, created = CaseViewed.objects.update_or_create(case=case, user=user,
                                                               defaults={'date_viewed':timezone.now})
        return cs


class PostDiffView(LoginRequiredMixin, UserPassesTestMixin, generic.DetailView):
    model = PostRevision
    pk_url_kwarg = 'revision_id'
    login_url = "authapp:login"
    template_name = "cvdp/postdiff.html"

    def test_func(self):
        revision = self.get_object()
        thread = revision.post.thread
        return is_my_case_thread(self.request.user, thread) and PendingTestMixin.test_func(self)

    def get(self, request, *args, **kwargs):
        revision = self.get_object()

        context = {"next_revision": "", "previous_revision": "", "revision_number": revision.revision_number, "last_modified": timesince(revision.modified)}

        other_revision = revision.previous_revision

        baseText = other_revision.content if other_revision is not None else ""
        newText = revision.content

        differ = difflib.Differ(charjunk=difflib.IS_CHARACTER_JUNK)
        diff = differ.compare(
            baseText.splitlines(keepends=True), newText.splitlines(keepends=True)
        )
        if revision.previous_revision:
            context['previous_revision'] = revision.previous_revision.id

        if revision.revision_number < revision.post.current_revision.revision_number:
            nextrev = PostRevision.objects.filter(revision_number=revision.revision_number+1, post=revision.post).first()
            if nextrev:
                context['next_revision'] = nextrev.id
        context['diff'] = list(diff)
        data = json.dumps(context)
        mimetype = 'application/json'
        return HttpResponse(data, mimetype)


class CWEAPIView(viewsets.ModelViewSet):
    serializer_class = CWESerializer
    #permission_classes = (IsAuthenticated, PendingUserPermission, AnalystCoordinatorPermission)
    pagination_class = StandardResultsPagination
    search_fields = ['cwe', 'description']
    filterset_fields = ['slice_1003', 'usage']

    def get_view_name(self):
        return "Get available (non-prohibited) CWE descriptions"

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return CWEDescriptions.objects.none()

        return CWEDescriptions.objects.all().exclude(usage__iexact="Prohibited").exclude(cweid__isnull=True).order_by('cweid')

class VulAPIView(viewsets.ModelViewSet):
    serializer_class = VulSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseObjectAccessPermission)

    def get_view_name(self):
        return f"Case Vulnerabilities"

    def list(self, request, *args, **kwargs):
        content = self.get_queryset()
        return Response(self.serializer_class(content, many=True,
                                              context={'user': request.user}).data)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({"user": self.request.user})
        return context

    def get_queryset(self):
        logger.debug("IN VULS API")
        if getattr(self, 'swagger_fake_view', False):
            return Vulnerability.objects.none()

        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        self.check_object_permissions(self.request, case)
        if is_case_owner(self.request.user, case.id):
            return Vulnerability.objects.filter(case=case, deleted=False)
        else:
            return Vulnerability.objects.filter(case=case, deleted=False, publish=True)

    def get_object(self):
        object = get_object_or_404(Vulnerability, id=self.kwargs['pk'])
        self.check_object_permissions(self.request, object.case)
        if is_case_owner(self.request.user, object.case.id):
            return object
        if object.deleted or not object.publish:
            raise Http404
        else:
            return object

    def create(self, request, *args, **kwargs):
        logger.debug("IN VUL CREATE VIEW")
        logger.debug(request.data)

        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        self.check_object_permissions(request, case)
        # deep copy
        data = json.loads(json.dumps(request.data))
        data['case'] = self.kwargs['caseid']
        if request.data.get('cve'):
            if request.data['cve'].lower().startswith('cve-'):
                cve = request.data['cve'][4:]
            else:
                cve = request.data['cve']

            old_vul = Vulnerability.objects.filter(case=case, cve=cve).first()
            if old_vul:
                if not old_vul.deleted:
                    return Response({'detail':f'CVE {cve} already exists for this case.'}, status=status.HTTP_400_BAD_REQUEST)
                else:
                    #un-delete this vul
                    logger.debug(f"REMOVE DELETED FLAG FROM {cve}")
                    serializer = self.serializer_class(instance=old_vul, data=data, partial=True)
                    if serializer.is_valid():
                        vul = serializer.save(case=case)
                        vul.user=self.request.user
                        #when you first create a vulnerability, mark it as do not publish,
                        #coordinator will have to change it
                        vul.publish=False
                        vul.deleted=False
                        vul.save()
                        action = create_case_action("added new vulnerability", request.user, case, True)
                        action.vulnerability = vul
                        action.save()
                        return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
                    else:
                        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.serializer_class(data=data)
        if serializer.is_valid():
            vul = serializer.save(case=case)
            vul.user=self.request.user
            vul.save()

            #look for cve allocation
            if vul.vul.startswith("CVE-"):
                cveres = CVEReservation.objects.filter(cve_id = vul.vul).first()
                if cveres:
                    cveres.vul = vul
                    cveres.save()
            
            action = create_case_action("added new vulnerability", request.user, case, True)
            action.vulnerability = vul
            action.save()
            #serializer = self.serializer_class(vul)
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, **kwargs):
        logger.debug("IN VUL UPDATE VIEW")
        instance = get_object_or_404(Vulnerability, id=self.kwargs['pk'])
        self.check_object_permissions(request, instance.case)
        data = request.data
        if data.get('tags'):

            existing_tags = VulnerabilityTag.objects.filter(vulnerability=instance)
            if len(existing_tags) > 0:
                for tag in existing_tags:
                    if tag not in data['tags']:
                        rmtag =	VulnerabilityTag.objects.filter(vulnerability=instance, tag=tag).first()
                        rmtag.delete()

            for tag in data['tags']:
                tag, created = VulnerabilityTag.objects.update_or_create(vulnerability=instance, tag=tag,
                                                                         defaults={'user':self.request.user})
        else:
            #remove existing tags
            existing_tags = VulnerabilityTag.objects.filter(vulnerability=instance)
            for tag in existing_tags:
                tag.delete()


        logger.debug(request.data)
        serializer = self.serializer_class(instance=instance, data=data, partial=True)
        if serializer.is_valid():
            logger.debug(serializer.validated_data)
            action = create_case_action(f"modified vulnerability {instance.vul} details", request.user, instance.case, True)
            action.vulnerability = instance
            action.save()

            if request.data.get('attributes'):
                compare_attributes(instance, action, request.data['attributes'])
            
            for field, val in serializer.validated_data.items():
                if (field == "attributes"):
                    continue
                try:
                    oldval = getattr(instance, field)
                except AttributeError:
                    continue
                if (val != oldval):
                    create_case_change(action, field, getattr(instance, field), val)
                    if field == "date_published" and request.data.get('cve_services'):
                        if oldval == None:
                            action = create_case_action(f"published vulnerability {instance.vul} to CVE Services", request.user, instance.case, True)
                        else:
                            action = create_case_action(f"re-published vulnerability {instance.vul} to CVE Services", request.user, instance.case, True)
                        action.vulnerability = instance
                        action.save()
                        check_all_cves_published(instance.case)

            serializer.save()
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
	                    status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        vul = get_object_or_404(Vulnerability, id=self.kwargs['pk'])
        self.check_object_permissions(request, vul.case)
        action = create_case_action(f"deleted vulnerability {vul.vul}", request.user, vul.case, True)
        action.vulnerability = vul
        action.save()

        if vul.case.status == Case.PENDING_STATUS:
            #don't delete if there is status associated with this vul
            if not ComponentStatus.objects.filter(vul=vul).exists():
                vul.delete()
                return Response({}, status=status.HTTP_202_ACCEPTED)

        vul.deleted=True
        vul.save()

        return Response({}, status=status.HTTP_202_ACCEPTED)


class UploadPostFile(LoginRequiredMixin, UserPassesTestMixin, generic.TemplateView):
    login_url = "authapp:login"
    template_name='cvdp/notemplate.html'

    def test_func(self):
        casethread = get_object_or_404(CaseThread, id=self.kwargs['pk'])
        if is_my_case_thread(self.request.user, casethread):
            return True
        return False

    def post(self, request, *args, **kwargs):
        casethread = get_object_or_404(CaseThread, id=self.kwargs['pk'])
        logger.debug(f"Files Post: {self.request.FILES}")

        artifact = add_artifact(self.request.FILES['image'])
        ca = ThreadArtifact(file=artifact,
                            thread=casethread,
                            user=self.request.user)
        ca.save()
        url = reverse("cvdp:artifact", args=[ca.file.uuid])
        return JsonResponse({'status': 'success', 'image_url': url}, status=200)


class CaseArtifactAPIView(viewsets.ModelViewSet):
    serializer_class = ArtifactSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseObjectAccessWritePermission)

    def get_view_name(self):
        return f"Case Artifacts"

    def list(self, request, *args, **kwargs):
        content = self.get_queryset()
        return Response(self.serializer_class(content, many=True,
                                           context={'user': request.user}).data)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({"user": self.request.user})
        return context

    def update(self, request, **kwargs):
        logger.debug(f"IN CASE ARTIFACT PATCH {self.kwargs['uuid']}")
        ca = get_object_or_404(CaseArtifact, file__uuid=self.kwargs['uuid'])
        self.check_object_permissions(request, ca.case)
        #only coordinators can change permissions
        if not(is_case_owner(self.request.user, ca.case.id)):
            raise PermissionDenied()

        if (self.request.data.get('share')):
            if ca.shared:
                action = create_case_action(f"unshared artifact {ca.file.filename}", request.user, ca.case)
                ca.shared=False
                ca.save()
            else:
                ca.shared=True
                action = create_case_action(f"shared artifact {ca.file.filename}", request.user, ca.case, True)
                ca.save()
            action.artifact = ca
            action.save()

        elif (request.data.get('filename')):
            old_filename = ca.file.filename
            ca.file.filename = request.data['filename']
            ca.file.save()
            action = create_case_action(f"changed artifact name from {old_filename} to {ca.file.filename}", request.user, ca.case, True)
            action.artifact = ca
            action.save()
            return Response({}, status=status.HTTP_202_ACCEPTED)

        return Response({}, status=status.HTTP_202_ACCEPTED)

    def get_object(self):
        ca = get_object_or_404(CaseArtifact, file__uuid=self.kwargs['uuid'])
        self.check_object_permissions(self.request, ca.case)
        return ca

    def get_queryset(self):
        logger.debug("IN Artifact API")
        if getattr(self, 'swagger_fake_view', False):
            return CaseArtifact.objects.none()
        if self.kwargs.get('caseid'):
            case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
            self.check_object_permissions(self.request, case)
            if is_coordinator(self.request.user):
                return CaseArtifact.objects.filter(case=case).order_by('-action__created')
            return CaseArtifact.objects.filter(case=case, shared=True).order_by('-action__created')

    def create(self, request, *args, **kwargs):
        logger.debug(f"{self.__class__.__name__} post: {self.request.data}")
        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        self.check_object_permissions(request, case)

        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            artifact = add_artifact(request.data['file'])
            action = create_case_action(f"uploaded document", self.request.user, case)
            b_action = Action.objects.get(id=action.action_ptr_id)
            ca = CaseArtifact(action=b_action,
                         file=artifact,
                         case=case)
            #by default any file shared by a non-coordinator is shared with the group
            if not(is_coordinator(self.request.user)):
                ca.shared=True
                #also share activity
                action.action_type=1
                action.save()
            
            ca.save()
            add_pulse(self.request.user, case.id)
            serializer = ArtifactSerializer(ca, context={'user': request.user})
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        #get artifact
        ca = get_object_or_404(CaseArtifact, file__uuid=self.kwargs['uuid'])
        if request.user.is_superuser or request.user.is_staff:
            action = create_case_action(f"deleted artifact {ca.file.filename}", request.user, ca.case)
            ca.delete()
            return Response({}, status=status.HTTP_202_ACCEPTED)
        if (ca.action.user == request.user):
            ca.shared=False
            action = create_case_action(f"unshared artifact {ca.file.filename}", request.user, ca.case)
            ca.save()
            #TODO - ADD AUDIT LOG
            return Response({}, status.HTTP_202_ACCEPTED)
        if (is_case_owner(self.request.user, ca.case.id)):
            ca.shared=False
            action = create_case_action(f"unshared artifact {ca.file.filename}", request.user, ca.case)
            ca.save()
            return Response({}, status.HTTP_202_ACCEPTED)
        raise PermissionDenied()


class ArtifactTransferAPIView(viewsets.ModelViewSet):
    serializer_class = ArtifactSerializer
    permission_classes = (IsAuthenticated, CaseTransferAccessPermission)

    def create(self, request, *args, **kwargs):
        logger.debug(f"{self.__class__.__name__} post: {self.request.data}")
        logger.debug(request.FILES)
        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])

        #get connection
        connection = AdVISEConnection.objects.filter(incoming_key=request.user.auth_token).first()

        if not request.FILES:
            return Response({'detail': 'No files present'},
                            status=status.HTTP_400_BAD_REQUEST)

        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            logger.debug(request.data['file'])
            fname = smart_str(request.data['file'].name)
            logger.debug(f"size {request.data['file'].size}")
            logger.debug(fname)
            if CaseArtifact.objects.filter(file__filename=fname, case=case).exists():
                return Response({'detail': f'File {fname} already transferred'}, status=status.HTTP_400_BAD_REQUEST)

            if connection:
                action = create_case_action(f"transferred document: {fname} from {connection.group.name}",
                                            self.request.user, case)

            else:
                #TODO: REMOVE THIS
                action = create_case_action(f"Group transferred document {fname}",
                                            self.request.user, case)

                """action = Action(title=f"Group transferred document: {fname}",
                                user=self.request.user)

                action.save()"""

            file = request.data['file']
            artifact = add_artifact(file)

            b_action = Action.objects.get(id=action.action_ptr_id)

            ca = CaseArtifact(action=b_action,
                              file=artifact,
                              case=case)
            ca.save()
            logger.debug("ADDED ARTIFACT")

            return Response({}, status=status.HTTP_202_ACCEPTED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ThreadTransferAPIView(viewsets.ModelViewSet):
    serializer_class = PostTransferSerializer
    permission_classes = (IsAuthenticated, CaseTransferAccessPermission)

    def create(self, request, *args, **kwargs):
        logger.debug("IN THREAD TRANSFER VIEW")
        logger.debug(request.data)

        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        if not(request.data.get('posts')):
            return Response({'detail': 'posts are required'}, status=status.HTTP_400_BAD_REQUEST)
        #confirm thread hasn't already been transferred
        prev = CaseThread.objects.filter(case=case, subject="Transferred Case Thread").first()
        if prev:
            return Response({'detail': 'Thread has already been transferred'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            serializer = self.serializer_class(data=request.data['posts'], many=True)
            if serializer.is_valid():
                #create the case thread
                ct = CaseThread(case=case,
                                created_by=self.request.user,
                                subject="Transferred Case Thread",
                                archived=True)
                ct.save()
                for p in request.data['posts']:
                    post = Post(thread=ct,
                                author_text=p['author'],
                                created=p['created'])
                    post.save()
                    post.add_revision(PostRevision(content=p['content']), save=True)
                    if p.get('replies'):
                        for r in p['replies']:
                            s = self.serializer_class(data=r)
                            if s.is_valid():
                                pr = Post(thread=ct,
                                          author_text=r['author'],
                                          created=r['created'])
                                pr.save()
                                pr.add_revision(PostRevision(content=r['content']), save=True)
                                pt, created = PostThread.objects.update_or_create(parent=post)
                                pr = PostReply(reply=pt, post=pr)
                                pr.save()
                            else:
                                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

                create_case_action(f"transferred case thread with {len(request.data['posts'])} posts", request.user, case)
                return Response({}, status=status.HTTP_202_ACCEPTED)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except:
            logger.debug(traceback.format_exc())
            return Response({'detail': 'An error occurred during transfer.'},
                            status=status.HTTP_400_BAD_REQUEST)


class StatusTransferAPIView(viewsets.ModelViewSet):
    serializer_class = VEXUploadSerializer
    permission_classes = (IsAuthenticated, CaseTransferAccessPermission)

    def create(self, request, *args, **kwargs):
        logger.debug(f"{self.__class__.__name__} post: {self.request.data}")
        logger.debug("IN STATUS TRANSFER VIEW")
        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        if not request.data.get('vex'):
            return Response({'detail': 'vex is required field'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.serializer_class(data=request.data['vex'])
        if serializer.is_valid():
            #get connection
            connection = AdVISEConnection.objects.filter(incoming_key=request.user.auth_token).first()
            if connection:
                action = create_case_action(f"transferred status from {connection.group.name}", self.request.user, case)
            else:
                action = create_case_action(f"uploaded status", self.request.user, case)
            cs = ComponentStatusUpload(vex=request.data['vex'],
                                       user=self.request.user,
                                       case=case)
            cs.save()

            return Response({}, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VulTransferAPIView(viewsets.ModelViewSet):
    serializer_class = VulSerializer
    permission_classes = (IsAuthenticated, CaseTransferAccessPermission)

    def create(self, request, *args, **kwargs):
        logger.debug("IN VUL TRANSFER VIEW")
        logger.debug(request.data)
        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        try:
            #make sure description exists, before saving anything
            for vul in request.data:
                if not vul.get('description'):
                    return Response({'description': 'This field is required'}, status=status.HTTP_400_BAD_REQUEST)

            for vul in request.data:
                cve = None
                if vul.get('cve'):
                    if vul['cve'].lower().startswith('cve-'):
                        cve = vul['cve'][4:]
                    else:
                        cve = vul['cve']
                    #don't replace an already exisiting CVE
                    old_vul = Vulnerability.objects.filter(cve=cve, case=case).first()
                    if old_vul:
                        return Response({'detail': 'Vul already exists.'}, status=status.HTTP_400_BAD_REQUEST)
                vul = Vulnerability(case=case,
                                    cve=cve,
                                    user=self.request.user,
                                    description=vul.get('description'))
                vul.save()
                action = create_case_action("transferred new vulnerability", request.user, case, True)
                action.vulnerability = vul
                action.save()
                serializer = self.serializer_class(vul)

            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)

        except:
            logger.debug(traceback.format_exc())
            return Response({'detail': 'Invalid format'}, status=status.HTTP_400_BAD_REQUEST)


class AdvisoryTransferAPIView(viewsets.ModelViewSet):
    serializer_class = AdvisorySerializer
    permission_clases = (IsAuthenticated, CaseTransferAccessPermission)

    def create(self, request, *args, **kwargs):
        logger.debug("IN ADVISORY TRANSFER VIEW")
        logger.debug(request.data)
        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        try:
            serializer = self.serializer_class(data=request.data)
            if serializer.is_valid():
                advisory, created = CaseAdvisory.objects.update_or_create(case=case)

                advisory.add_revision(AdvisoryRevision(user=self.request.user,
                                                       title=request.data['title'],
                                                       content=request.data['content'],
                                                       references=request.data.get('references'),
                                                       user_message=request.data.get('user_message', '')),
                                  save=True)

                if created:
                    action = Action(title="transferred initial Advisory draft",
                                    user=self.request.user)
                else:
                    action = Action(title="transferred new version of Advisory",
                                    user=self.request.user)

                action.save()
                serializer = self.serializer_class(instance=advisory.current_revision)
                return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
            else:
                logger.debug(serializer.errors)
                return Response(serializer.errors,
                                status=status.HTTP_400_BAD_REQUEST)
        except:
            return Response({'detail': 'error occurred during transfer'},
                            status=status.HTTP_400_BAD_REQUEST)

class ScoreVulCVSSView(LoginRequiredMixin, UserPassesTestMixin, FormView):
    form_class = CVSSForm
    login_url = "authapp:login"
    template_name = "cvdp/cvss.html"

    def test_func(self):
        vul = get_object_or_404(Vulnerability, id=self.kwargs['pk'])
        return is_case_owner(self.request.user, vul.case.id)

    def get_context_data(self, **kwargs):
        context = super(ScoreVulCVSSView, self).get_context_data(**kwargs)
        vul = get_object_or_404(Vulnerability, id=self.kwargs['pk'])
        vulcvss = VulCVSS.objects.filter(vul=vul).first()
        if vulcvss:
            context['form'] = CVSSForm(instance=vulcvss)
        else:
            context['form'] = CVSSForm()

        return context


class CVSSVulView(viewsets.ModelViewSet):
    serializer_class = CVSSSerializer
    permission_classes= (IsAuthenticated, PendingUserPermission, CaseObjectAccessPermission)

    def get_view_name(self):
        return f"Vul CVSS Score"

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return VulCVSS.objects.none
        obj = get_object_or_404(Vulnerability, id=self.kwargs.get('pk'))
        self.check_object_permissions(self.request, obj.case)
        return VulCVSS.objects.filter(vul=self.kwargs.get('pk'))


    def get_object(self):
        version = self.kwargs.get('version')
        obj = VulCVSS.objects.filter(vul=self.kwargs.get('pk'), version=version).first()
        if obj:
            self.check_object_permissions(self.request, obj.vul.case)
            return obj
        else:
            raise Http404

    def create(self, request, *args, **kwargs):
        logger.debug(request.data)

        vul = get_object_or_404(Vulnerability, id=self.kwargs.get('pk'))
        self.check_object_permissions(request, vul.case)
        logger.debug(request.data)
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():

            version = request.data.get("version", "3.1")


            #confirm we don't have a cvss score already
            cvss = VulCVSS.objects.filter(vul=vul, version=version).first()
            if cvss:
                return Response({"cvss": f"CVSS V{version} already exists for this vulnerability. Use PATCH"}, status=status.HTTP_400_BAD_REQUEST)

            if not request.data.get('vectorString'):
                if version == "4.0":
                    return Response({"vectorString": "Vector is required in CVSS v4.0"}, status=status.HTTP_400_BAD_REQUEST)
                else:
                    #if vector isn't here, make sure all other fields are
                    base_metrics = ["AV", "AC", "PR", "UI", "S", "C", "I", "A"]
                    for x in base_metrics:
                        if x not in request.data.keys():
                            return Response({"vectorString": f"Vector is required if decision points are not all present (Missing: {x})."}, status=status.HTTP_400_BAD_REQUEST)

            vcvss = VulCVSS(vul=vul, scored_by=self.request.user, **serializer.validated_data)
            vcvss.save()
            logger.debug(vcvss)
            action = create_case_action(f"scored vulnerability (CVSS) {vul.vul}", request.user, vul.case, True)
            action.vulnerability=vul
            action.save()

            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        logger.debug(serializer.errors)
        return Response(serializer.errors,
                        status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if not(is_case_owner(request.user, obj.vul.case.id)):
            raise PermissionDenied()
        if obj:
            action = create_case_action(f"removed CVSS Score {obj.version} for vulnerability {obj.vul.vul}", request.user, obj.vul.case)
            action.vulnerability=obj.vul
            action.save()
            obj.delete()
            return Response({}, status=status.HTTP_202_ACCEPTED)
        return Response({}, status.HTTP_400_BAD_REQUEST)

    def update(self, request, **kwargs):
        vul = get_object_or_404(Vulnerability, id=self.kwargs.get('pk'))
        if not(is_case_owner(request.user, vul.case.id)):
            raise PermissionDenied()
        logger.debug(request.data)
        version = request.data.get('version')
        if not version:
            return Response({"version": "Version is required"}, status=status.HTTP_400_BAD_REQUEST)
        instance = VulCVSS.objects.filter(vul=vul, version=version).first()
        if not instance:
            # is this an update from 3.0 to 3.1?
            if (version == "3.1"):
                instance = VulCVSS.objects.filter(vul=vul, version="3.0").first()
            if not instance:
                return Response({"version": f"CVSS V{version} does not exist for this vulnerability"}, status=status.HTTP_400_BAD_REQUEST)
            #else this is an upgrade

        serializer = self.serializer_class(instance=instance, data=request.data, partial=True)
        if serializer.is_valid():
            action = create_case_action(f"modified CVSS v{version} score for vulnerability {vul.vul}", request.user, vul.case, True)
            action.vulnerability=vul
            action.save()
            oldscore = instance.score
            oldvector = instance.vectorString
            x = serializer.save()
            x.scored_by = self.request.user
            x.save()
            if oldscore != x.score:
                create_case_change(action, "score", oldscore, x.score)
            if oldvector != x.vectorString:
                create_case_change(action, "vectorString", oldvector, x.vectorString)
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        logger.debug(serializer.errors)
        return Response(serializer.errors,
                        status=status.HTTP_400_BAD_REQUEST)

class SSVCVulView(viewsets.ModelViewSet):
    serializer_class = SSVCSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseObjectAccessPermission)

    def get_view_name(self):
        return f"Vul SSVC Score"

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return VulSSVC.objects.none()

    def get_object(self):
        obj = get_object_or_404(VulSSVC, vul=self.kwargs.get('pk'))
        self.check_object_permissions(self.request, obj.vul.case)
        return obj

    def create(self, request, *args, **kwargs):
        logger.debug(f"{self.__class__.__name__} post: {self.request.POST}")

        vul = get_object_or_404(Vulnerability, id=self.kwargs.get('pk'))
        if not (is_case_owner(request.user, vul.case.id)):
            raise PermissionDenied()

        try:
            if (vul.vulssvc):
                return Response({'error': 'SSVC score already exists for this vulnerability, use PATCH'}, status=status.HTTP_400_BAD_REQUEST)
        except VulSSVC.DoesNotExist:
            pass

        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            ssvc = VulSSVC(vul=vul, user=self.request.user, **serializer.validated_data)
            ssvc.save()
            action = create_case_action(f"scored vulnerability (SSVC) {vul.vul}", request.user, vul.case, True)
            action.vulnerability=vul
            action.save()
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        logger.debug(serializer.errors)
        return Response(serializer.errors,
                        status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        vul = get_object_or_404(Vulnerability, id=self.kwargs.get('pk'))
        if not(is_case_owner(request.user, vul.case.id)):
            raise PermissionDenied()

        vcvss = VulSSVC.objects.filter(vul=vul).first()
        if vcvss:
            action = create_case_action(f"removed SSVC score for vulnerability {vul.vul}", request.user, vul.case)
            action.vulnerability=vul
            action.save()
            vcvss.delete()
            return Response({}, status=status.HTTP_202_ACCEPTED)
        return Response({}, status.HTTP_400_BAD_REQUEST)

    def update(self, request, **kwargs):
        logger.debug(f"{self.__class__.__name__} patch: {self.request.data}")
        vul = get_object_or_404(Vulnerability, id=self.kwargs.get('pk'))
        if not(is_case_owner(request.user, vul.case.id)):
            raise PermissionDenied()
        logger.debug(request.data)
        #does ssvc score exist?
        if VulSSVC.objects.filter(vul=vul).exists():
            serializer = self.serializer_class(instance=vul.vulssvc, data=request.data, partial=True)
            if serializer.is_valid():
                olddecision=vul.vulssvc.final_decision
                x = serializer.save()

                action = create_case_action(f"modified SSVC score for vulnerability {vul.vul}", request.user, vul.case, True)
                action.vulnerability=vul
                action.save()

                if olddecision != x.final_decision:
                    create_case_change(action, "final_decision", olddecision, x.final_decision)
                x.user = self.request.user
                x.last_edit = timezone.now()
                x.save()
                return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
            logger.debug(serializer.errors)
            return Response(serializer.errors,
			    status=status.HTTP_400_BAD_REQUEST)
        else:
            serializer = self.serializer_class(data=request.data)
            if serializer.is_valid():
                ssvc = VulSSVC(vul=vul, user=self.request.user, **serializer.validated_data)
                logger.debug(ssvc)
                ssvc.save()
                action = create_case_action(f"scored vulnerability (SSVC) {vul.vul}", request.user, vul.case, True)
                action.vulnerability=vul
                action.save()
                return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

class NotifyVendorsView(LoginRequiredMixin, UserPassesTestMixin, generic.TemplateView):
    login_url = "authapp:login"
    template_name = 'cvdp/notmpl.html'
    #http_method_names=['post']

    def test_func(self):
        case = get_object_or_404(Case, case_id=self.kwargs.get('caseid'))
        return is_case_owner(self.request.user, case.id)


    def post(self, request, *args, **kwargs):
        logger.debug(f"{self.__class__.__name__} post: {self.request.POST}")
        case = get_object_or_404(Case, case_id=self.kwargs.get('caseid'))
        participants = self.request.POST.getlist('participants[]', None)

        subject = self.request.POST.get('subject', None)
        content = self.request.POST.get('content', None)

        if not participants and "all" in request.path:
            #get all participants that haven't been notified
            participants = CaseParticipant.objects.filter(case=case).exclude(notified__isnull=False).values_list('id', flat=True)

        if not participants:
            return JsonResponse({'message': 'participants required'}, status=400)

        if ((subject and not content) or (content and not subject)):
            return JsonResponse({'message': 'Both subject and content must be provided'}, status=400)

        #is outreach a case state?
        case_state = CaseState.objects.filter(code="outreach").first()
        if case_state:
            bump_case_state(case, "outreach")

        part_list = []
        for p in participants:
            cp = get_object_or_404(CaseParticipant, id=p)
            notify_case_participant(cp, subject, content, self.request.user)
            part_list.append(cp.name)

        if subject and content:
            action = create_case_action(f"notified participants: {', '.join(part_list)}", self.request.user, case, state=case_state)
        else:
            action = create_case_action(f"gave access to: {', '.join(part_list)} (no email sent)", self.request.user, case, state=case_state)

        return JsonResponse({'message': 'success'}, status=200)

class CaseActivityAPIView(viewsets.ModelViewSet):
    serializer_class = CaseActionSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseObjectAccessPermission)
    pagination_class = StandardResultsPagination

    def get_view_name(self):
        return f"Case Activity"

    def get_queryset(self):
        search = self.request.GET.get('q', None)
        if (search):
            search = process_query(search, False)

        cases = []
        if self.kwargs.get('caseid'):
            case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
            self.check_object_permissions(self.request, case)
            cases.append(case)
        else:
            # get all activity
            cases = my_cases(self.request.user)

        actions = CaseAction.objects.search_my_cases(cases, search)
        if is_coordinator(self.request.user):
            return actions.order_by('-created')
        else:

            my_threads = _my_threads(self.request.user, cases)

            posts = PostRevision.objects.search_my_threads(my_threads, search)

            postactions = actions.filter(action_type=1).filter(post__in=posts)

            actions = actions.filter(action_type = 1).exclude(post__isnull=False).exclude(vulnerability__deleted=True).exclude(vulnerability__publish=False)

            all_actions = actions | postactions

            return all_actions.order_by('-created')

        """

        if is_coordinator(self.request.user):
            actions = CaseAction.objects.search_my_cases(cases, search)
            action_serializer = CaseActionSerializer(actions, many=True)
            case_actions = action_serializer.data

            #posts = PostRevision.objects.search_my_cases(cases, search)
            #post_serializer = PostActionSerializer(posts, many=True)
            #post_actions = post_serializer.data

            #this is now done through caes actions
            #advisory = AdvisoryRevision.objects.filter(advisory__case__in=cases)
            #advisory_serializer = AdvisoryActionSerializer(advisory, many=True)
            #advisory_actions = advisory_serializer.data

            #status = StatusRevision.objects.search_my_cases(cases, search)    #filter(component_status__vul__case__in=cases)
            #status_serializer = StatusActionSerializer(status, many=True)
            #status_actions = status_serializer.data

        elif cases:
            actions = CaseAction.objects.search_my_cases(cases, search)
            actions = actions.filter(action_type=1)
            action_serializer = CaseActionSerializer(actions, many=True)
            case_actions = action_serializer.data

            #only get posts in threads this user has access to
            my_threads = _my_threads(request.user, cases)
            posts = PostRevision.objects.search_my_threads(my_threads, search)
            post_serializer = PostActionSerializer(posts, many=True)
            post_actions = post_serializer.data

            #only get advisory if shared
            #advisory = AdvisoryRevision.objects.filter(advisory__case__in=cases).exclude(date_shared__isnull=True)
            #advisory_serializer = AdvisoryActionSerializer(advisory, many=True)
            #advisory_actions = advisory_serializer.data

            status = StatusRevision.objects.filter(component_status__vul__case__in=cases, component_status__share=True)
            status_serializer =	StatusActionSerializer(status, many=True)
            status_actions = status_serializer.data


        #results = case_actions + post_actions + advisory_actions + status_actions
        results = case_actions + post_actions + status_actions
        qs = sorted(results,
                    key=lambda instance: instance['created'],
                    reverse=True)

        paginator = Paginator(qs, page_size)
        data = paginator.page(page_number)
        if data.has_next():
            next_page = data.next_page_number()
        else:
            next_page = None

        return Response({'results':data.object_list, 'next_page': next_page})
        """

class CaseApprovalAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)
    serializer_class = CaseApprovalSerializer
    pagination_class = StandardResultsPagination

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return CaseApproval.objects.none()
        if self.kwargs.get('caseid'):
            case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
            return CaseApproval.objects.filter(case=case).order_by('created')

        return CaseApproval.objects.filter(status = CaseApproval.WAITING).order_by('created')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({"user": self.request.user})
        return context

    def create(self, request, *args, **kwargs):
        logger.debug(request.data)
        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            vul = None
            req = request.data.get('request', 1)
            if request.data.get('vulnerability'):
                vul = Vulnerability.objects.filter(case=case, id=request.data.get('vulnerability')).first()
                req = 2
                if not vul:
                    return Response({'vul': "invalid vulnerability"}, status=status.HTTP_400_BAD_REQUEST)
                
            ca = CaseApproval(case = case,
                              request_comments = request.data.get('request_comments'),
                              request=req,
                              vulnerability=vul,
                              user=self.request.user)
            if (req == 1 or req == 3):
                caseadvisory = CaseAdvisory.objects.filter(case=case).first()
                ca.advisory_version = caseadvisory.current_revision.revision_number
            
            ca.save()
            return Response({}, status=status.HTTP_202_ACCEPTED)
        logger.debug(serializer.errors)
        return Response(serializer.errors,
                        status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, **kwargs):
        #only case owners can share advisory
        ca = get_object_or_404(CaseApproval, id=self.kwargs['pk'])
        if not can_approve_case(ca.case, self.request.user):
            raise PermissionDenied()

        serializer = self.serializer_class(instance=ca, data=request.data, partial=True)

        if serializer.is_valid():
            ca = serializer.save()

            if (ca.status != 0) and request.data.get('status'):
                ca.completed_by = self.request.user
                ca.completed = timezone.now()
                ca.save()
                if ca.vulnerability:
                    title = f"{ca.vulnerability.vul} is {ca.get_status_display()} for publishing"
                    ctx = {'completed_by': self.request.user.screen_name, 'status': ca.get_status_display(),
                           'url': f"{settings.SERVER_NAME}{ca.case.get_absolute_url()}",
                           'case': ca.case.caseid,
                           'prepend': ca.case.caseid, 'title': title}
                else:
                    if ca.request == 1:
                        title = f"Advisory v.{ca.advisory_version} is {ca.get_status_display()} to share"
                    else:
                        title = f"Advisory v.{ca.advisory_version} is {ca.get_status_display()} to publish"

                        if (ca.status == CaseApproval.APPROVED):
                            #update doc id if necessary
                            assign_csaf_document_id(ca.case)

                    ctx = {'completed_by': self.request.user.screen_name, 'status': ca.get_status_display(),
                           'url': f"{settings.SERVER_NAME}{ca.case.get_absolute_url()}",
                           'case': ca.case.caseid,
                           'prepend': ca.case.caseid, 'title': title}
                    
                    
                send_template_email("case_approval", [ca.user.email], ctx)
                
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)



class GroupCasesAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)
    serializer_class = CaseSerializer
    pagination_class=StandardResultsPagination

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Case.objects.none()
        # get cases group is involved in
        group = get_object_or_404(Group, groupprofile__uuid=self.kwargs.get('group'))
        cp = CaseParticipant.objects.filter(group=group).values_list('case__id', flat=True)
        return Case.objects.filter(id__in=cp)

class ContactCasesAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)
    serializer_class = CaseSerializer
    pagination_class=StandardResultsPagination

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Case.objects.none()
        # get cases contact is involved in
        contact = get_object_or_404(Contact, uuid=self.kwargs.get('contact'))
        cp = CaseParticipant.objects.filter(contact=contact).values_list('case__id', flat=True)
        return Case.objects.filter(id__in=cp)

class ContactActivityAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)
    serializer_class = CaseActionSerializer
    pagination_class=StandardResultsPagination

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Case.objects.none()
        # get cases contact is involved in
        contact = get_object_or_404(Contact, uuid=self.kwargs.get('contact'))
        if contact.user:
            return CaseAction.objects.filter(user=contact.user).order_by('-created')

        cp = CaseParticipant.objects.filter(contact=contact)
        return CaseAction.objects.filter(participant__in=cp).order_by('-created')


class CaseTransferAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, CoordinatorPermission)
    serializer_class = CaseTransferSerializer
    pagination_class = StandardResultsPagination

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return CaseTransfer.objects.none()
        if self.kwargs.get('caseid'):
            return CaseTransfer.objects.filter(action__case__case_id=self.kwargs['caseid'])
        return CaseTransfer.objects.all()

    def get_object(self):
        ct = get_object_or_404(CaseTransfer, id=self.kwargs['pk'])
        return ct

    def create(self, request, *args, **kwargs):
        logger.debug(request.data)
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            case = get_object_or_404(Case, case_id=request.data['case'])
            connection = get_object_or_404(AdVISEConnection, id=request.data['connection'])
            dt = request.data.get('data_transferred')
            if dt:
                dt = json.loads(dt)
            else:
                dt = ["case"]

            case_state = CaseState.objects.filter(code="closed").first()
            if case_state:
                bump_case_state(case, "closed", True)

            action = create_case_action(f"transferred {', '.join(dt)} to {connection.group.name}", request.user, case, True, state=case_state)
            action.save()

            ct = CaseTransfer(connection=connection,
                              action=action,
                              data_transferred = dt,
                              transfer_reason=request.data['transfer_reason'],
                              remote_case_id=request.data['remote_case_id'])
            ct.save()

            case.status=Case.INACTIVE_STATUS

            case.resolution = f'Transferred to {connection.group.name}'
            case.save()

            serializer = self.serializer_class(ct)

            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)

        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class VulRedirectView(LoginRequiredMixin, PendingTestMixin, generic.RedirectView):
    login_url = "auth:login"

    def dispatch(self, request, *args, **kwargs):
        vul = get_object_or_404(Vulnerability, id=self.kwargs['pk'])
        self.case = vul.case
        return super().dispatch(request, *args, **kwargs)

    def get_redirect_url(self, **kwargs):
        return reverse('cvdp:case', args=[self.case.case_id])

