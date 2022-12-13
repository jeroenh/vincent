import os
from django.shortcuts import render
from django.template.loader import render_to_string
import re
import shlex
import logging
from itertools import chain
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.core.paginator import Paginator
from django.urls import reverse, reverse_lazy, resolve
from django.urls.exceptions import Resolver404
from rest_framework.views import exception_handler as drf_exception_handler
from django.views import generic, View
from django.views.generic.edit import FormView, UpdateView, FormMixin, CreateView
from django.http import HttpResponse, Http404, JsonResponse, HttpResponseNotAllowed, HttpResponseServerError, HttpResponseForbidden, HttpResponseRedirect, HttpResponseBadRequest
from authapp.models import User
from django.core.exceptions import ValidationError, PermissionDenied
from django.utils.translation import gettext as _
from authapp.views import PendingTestMixin
from cvdp.lib import check_permissions, create_bounce_ticket
# Create your views here.
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
import traceback
from cvdp.forms import *
from rest_framework.views import APIView
from rest_framework import exceptions, generics, status, authentication, viewsets, mixins, filters
from cvdp.cases.views import StandardResultsPagination
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.renderers import JSONRenderer
from cvdp.permissions import *
from cvdp.cases.serializers import *
from cvdp.groups.serializers import ContactSerializer, GroupSerializer, UserGroupSerializer, UserGroupWelcomeSerializer
from cvdp.serializers import CoordGenericSerializer, GenericSerializer, BounceEmailSerializer
from cvdp.manage.serializers import ManageEmailBounceSerializer
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib.auth import get_user_model
import json

User = get_user_model()

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

@login_required(login_url="authapp:login")
def assignable_users_api(request):
    if not (is_coordinator(request.user) or is_analyst_mgr(request.user)):
        raise PermissionDenied
    ret_value = {}

    coord_groups = None
    ret_value["teams"] = []
    assignable_users = []
    
    #get coordinator groups - if user is part of global coordinator group
    if is_in_lead_coord_team(request.user):
        coord_groups = get_coord_teams()
        gs = GroupSerializer(coord_groups, many=True)
        ret_value["teams"] = gs.data
    elif is_coordinator_mgr(request.user) or is_analyst_mgr(request.user):
        coord_groups = my_coord_teams(request.user)
        gs = GroupSerializer(coord_groups, many=True)
        ret_value["teams"] = gs.data
        
    logger.debug(coord_groups)
        
    if request.GET.get('coordinator'):
        if coord_groups:
            assignable_users = User.objects.filter(is_active=True, api_account=False, pending=False, groups__name__in=['coordinator', 'coordinator_mgr']).order_by('screen_name').exclude(screen_name__isnull=True).distinct()
            coord_groups_names = coord_groups.values_list('name', flat=True)
            assignable_users = assignable_users.filter(groups__name__in=coord_groups_names)
                                                       
    elif request.GET.get('analyst'):
        assignable_users = User.objects.filter(is_active=True, api_account=False, pending=False, groups__name__in=['analyst', 'analyst_mgr']).order_by('screen_name').exclude(screen_name__isnull=True).distinct()
    else:
        assignable_users = User.objects.filter(is_active=True, api_account=False, pending=False, groups__name__in=['coordinator', 'coordinator_mgr', 'analyst', 'analyst_mgr']).order_by('screen_name').exclude(screen_name__isnull=True).distinct()
        if coord_groups:
            coord_groups_names = coord_groups.values_list('name', flat=True)
            assignable_users = assignable_users.filter(groups__name__in=coord_groups_names)
        
    users = UserGroupSerializer(assignable_users, many=True)
    ret_value['users'] = users.data

    #get roles that have users
    roles = UserAssignmentWeight.objects.all().values_list('role__id', flat=True).distinct()
    ret_value["roles"] = list(AssignmentRole.objects.filter(id__in=roles).values_list('role', flat=True))

    ret_value['lead'] = is_in_lead_coord_team(request.user)
    data = json.dumps(ret_value)
    mimetype='application/json'
    return HttpResponse(data, mimetype)


class DashboardView(LoginRequiredMixin, PendingTestMixin,  generic.TemplateView):
    template_name = "cvdp/dashboard.html"
    login_url = "authapp:login"

    def get_context_data(self, **kwargs):
        context = super(DashboardView, self).get_context_data(**kwargs)

        #check group permissions
        check_permissions(self.request.user)
        
        
        context['dashboard'] = 1
        return context


class ArtifactView(LoginRequiredMixin, PendingTestMixin, generic.TemplateView):

    #TODO is artifact shared?
    
    def get(self, request, *args, **kwargs):
        logger.debug(self.kwargs['path'])
        attachment = Attachment.objects.filter(uuid=self.kwargs['path']).first()
        #all the permission checks!!!
        if attachment:
            #check permissions
            ca = CaseArtifact.objects.filter(file=attachment).first()
            if ca:
                if not(is_my_case(self.request.user, ca.case.id)):
                    raise PermissionDenied()
            else:
                #check thread artifacts
                ta = ThreadArtifact.objects.filter(file=attachment).first()
                if ta:
                    if not(is_my_case_thread(self.request.user, ta.thread)):
                        raise PermissionDenied()
                else:
                    #check messages
                    ma = MessageAttachment.objects.filter(file=attachment).first()
                    if ma:
                        if ma.thread:
                            if not(is_my_msg_thread(self.request.user, ma.thread)):
                                raise PermissionDenied()
                            
                        else:
                            if ma.user != self.request.user:
                                if not(is_coordinator(self.request.user)):
                                    raise PermissionDenied()

            mime_type = attachment.mime_type
            if attachment.file.storage.exists(attachment.file.name):
                # TODO: We should be doing this URL magic and serving from
                #       potentially cached storage. Right now, we're going
                #       quick-and-dirty and doing the same thing we did when
                #       this was only dealing with local files. [JDW]
                #url = attachment.file.storage.url(str(attachment.file.name), parameters={'Content-Disposition': f'attachment; filename="{attachment}"'})
                #logger.debug(f"in ArtifactView: built url {url}")
                #response = HttpResponseRedirect(url)
                logger.debug(attachment.file.size)
                with attachment.file.storage.open(str(attachment.file.name)) as fh:
                    response = HttpResponse(fh.read(), content_type = mime_type)
                    response['Content-Disposition'] = f"attachment; filename=\"{attachment}\""
                    response["Content-type"] = mime_type
                    response["Cache-Control"] = "must-revalidate"
                    response["Pragma"] = "must-revalidate"
                    return response

        raise Http404


class GenerateNewRandomColor(LoginRequiredMixin, PendingTestMixin, generic.TemplateView):
    template_name = 'cvdp/notemplate.html'
    login_url="authapp:login"

    def get(self, request, *args, **kwargs):
        self.request.user.userprofile.logocolor = "#"+''.join([random.choice('0123456789ABCDEF') for j in range(6)])
        self.request.user.userprofile.save()
        messages.success(
            self.request,
            "Hope you like your new color!"
        )
        return redirect("authapp:profile")


def quickSearch(request):
    input = request.GET.get('searchbar', False)
    if input:
        response = redirect("cvdp:search")
        input=input.replace('#', '%23')
        response['Location'] += '?q='+input
        return response
    else:
        return redirect("cvdp:search")

def process_query(s, live=True):
    query = re.sub(r"[!'()|&<>]", ' ', s).strip()
    # get rid of empty quotes
    query = re.sub(r'""', '', query)
    if query == '"':
        return None

    if query.startswith(settings.CASE_IDENTIFIER):
        query = query[len(settings.CASE_IDENTIFIER):]

    if query:
        #sub spaces between quotations with <->
        #if re.search(r'\"', query) and not re.search(r'\".*\"', query):
        try:
            query = '&'.join(shlex.split(query))
        except ValueError:
            query = query + '"'
            query = re.sub(r'\s+', '&', query)
        query = re.sub(r'\s+', '<->', query)
        # Support prefix search on the last word. A tsquery of 'toda:*' will
        # match against any words that start with 'toda', which is good for
        # search-as-you-type.
        if query.endswith("<->"):
            query = query[:-3]
    if query and live:
        query += ':*'

    return query

def process_query_for_tags(s):
    t = s.lower()
    ret = t.split()
    ret.append(s)
    return ret

class APISearchView(APIView):
    permission_classes = (IsAuthenticated, PendingUserPermission)
    search_fields = ['name']
    filterset_fields = ['type']

    def get_serializer_class(self):
        if is_coordinator(self.request.user):
            return CoordGenericSerializer
        return GenericSerializer
    
    def get_view_name(self):
        return "Search VINCE-NT"

    def get(self, request, format=None):
        logger.debug(request.query_params)
        groups = []
        contacts = []
        components = []
        cases = []
        vuls = []
        tickets = []
        artifacts = []
        advisory = []
        casetags = []
        comptags = []
        
        # kind of hacky but will work for now
        # -----------------------------------------------------------
        page_number = request.query_params.get('page', 1)
        page_size = request.query_params.get('page_size ', 20)
	# -----------------------------------------------------------
        search_term = self.request.GET.get('name', None)
        search_query = None
        search_tags = None
        search_type = self.request.GET.get('type', "All").lower()
        logger.debug(f"SEARCH TERM IS {search_term}, type is {search_type}")
        mycases = my_cases(self.request.user)
        if search_term:
            search_query = process_query(search_term)
            search_tags = process_query_for_tags(search_term)


        if (search_type in ['all', 'cases']):
            cases = Case.objects.search_my_cases(mycases, search_query)
            
            vuls = Vulnerability.objects.search_my_cases(mycases, search_query)
            advisory = CaseAdvisory.objects.search_my_cases(mycases, search_query)
            #artifacts isn't doing full text search so use search_term
            artifacts = CaseArtifact.objects.search_my_cases(mycases, search_term)

            if is_coordinator(self.request.user):
                if search_tags:
                    cts = list(CaseTag.objects.filter(case__in=mycases, tag__in=search_tags).values_list('case__id', flat=True))
                    vultags = list(VulnerabilityTag.objects.filter(vulnerability__case__in=mycases, tag__in=search_tags).values_list('vulnerability__case__id', flat=True))
                else:
                    cts = []
                    vultags = []
                if search_term:
                    q = SearchQuery(search_term)
                    comps =  list(ComponentStatus.objects.filter(vul__case__in=mycases).filter(Q(component__name__icontains=search_term)|Q(component__search_vector=q)).values_list('vul__case__id', flat=True))
                else:
                    comps = []
                if comps or cts or vultags:
                    case_list = cts+vultags+comps
                    dedup = list(dict.fromkeys(case_list))
                    casetags = Case.objects.filter(id__in=dedup).exclude(id__in=cases)
                    
                
            if not is_coordinator(self.request.user):
                vuls = vuls.filter(deleted=False, publish=True)
                advisory = advisory.exclude(date_published__isnull=True)
                artifacts = artifacts.exclude(shared=False)

            
        if (search_type in ['all', 'components']):
            my_comps = my_components(self.request.user)
            components = Component.objects.search_my_components(my_comps, search_query)

            if is_coordinator(self.request.user) and search_tags:
                comptags = Component.objects.filter(tags__tag__in=search_tags)
        
        if (search_type in ['all', 'tickets']):
            if is_coordinator(self.request.user):
                tickets = Ticket.objects.search_my_tickets(mycases, self.request.user, search_query)
            #add ticket comments here 
        if (search_type in ['all', 'contacts']):
            if is_coordinator(self.request.user):
                if search_term:
                    groupTag = GroupTag.objects.filter(tag__in=search_tags).values_list('group__id', flat=True)
                    groups = GroupProfile.objects.filter(Q(group__name__icontains=search_term)|Q(group__id__in=groupTag)).order_by('-modified')
                    contacts = Contact.objects.filter(Q(name__icontains=search_term)|Q(email__icontains=search_term)|Q(user__screen_name__icontains=search_term)).exclude(user__api_account=True).order_by('-modified')
                else:
                    groups = GroupProfile.objects.all().order_by('-modified')
                    contacts = Contact.objects.all().exclude(user__api_account=True).order_by('-modified')

        results = chain(groups, contacts, cases, tickets, components, vuls, advisory, artifacts, casetags, comptags)
        qs = sorted(results,
                    key = lambda instance: instance.modified,
                    reverse = True)
        gp = Paginator(qs, page_size)

        sc = self.get_serializer_class()
        serializer = sc(gp.page(page_number), many=True)

        return Response({"data": serializer.data, "count": gp.count, "pages": gp.num_pages, "page_size": page_size}, status=status.HTTP_200_OK)


class SearchAllView(LoginRequiredMixin, PendingTestMixin, generic.TemplateView):
    template_name = 'cvdp/search.html'
    login_url = "authapp:login"

    def get_context_data(self, **kwargs):
        context = super(SearchAllView, self).get_context_data(**kwargs)
        context['search'] = self.request.GET.get('q', False)
        return context

class TriageView(LoginRequiredMixin, UserPassesTestMixin, generic.TemplateView):
    template_name = 'cvdp/triage.html'
    login_url = "authapp:login"
    model = Case

    def test_func(self):
        return is_coordinator(self.request.user)

    def get_context_data(self, **kwargs):
        context = super(TriageView, self).get_context_data(**kwargs)
        context['triagepage'] = 1
        return context


class TriageMetaAPIView(APIView):
    serializer_class = TriageMetaSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)

    def get(self, request, *args, **kwargs):
        context = {"lead": ""}

        #get coordinator groups - if user is part of global coordinator group
        lead = get_lead_coord_team()
        if lead:
            context['lead'] = lead.name
        if is_in_lead_coord_team(request.user):
            g = GroupProfile.objects.filter(vendor_type="Coordinator", active=True).values_list('group__id', flat=True)
            coord_groups = Group.objects.filter(id__in=g).exclude(user=None)
            context['teams'] = coord_groups

        else:
            #get current coord team                                                                                                             
            context['teams'] = my_coord_teams(self.request.user)
        serializer = self.serializer_class(context)
        return Response(serializer.data)
    

class TriageAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)
    serializer_class = CaseSerializer
    search_fields = ['title', 'summary', 'case_id']
    pagination_class=StandardResultsPagination

    def get_queryset(self):
        #get all owners
        my_coord_group = None
        coord_teams = Group.objects.filter(groupprofile__vendor_type="Coordinator", groupprofile__active=True).exclude(user=None).count()
        logger.debug(coord_teams)
        if is_in_lead_coord_team(self.request.user):
            if self.request.query_params.get('team'):
                my_coord_group = Group.objects.filter(name=self.request.query_params['team'])
            elif coord_teams > 1:
                owners = CaseParticipant.objects.filter(role="owner").values_list('case__id', flat=True)
                return Case.objects.exclude(status=Case.INACTIVE_STATUS).exclude(id__in=owners).order_by('-created')
            else:
                #return anything unassigned to an actual user
                owners = CaseParticipant.objects.filter(role="owner", contact__isnull=False).values_list('case__id', flat=True)
                return Case.objects.exclude(status=Case.INACTIVE_STATUS).exclude(id__in=owners).order_by('-created')             

        if not my_coord_group:
            my_coord_group = my_coord_teams(self.request.user)
        if my_coord_group:
            #find cases that are assigned to my coord group
            owners = CaseParticipant.objects.filter(role="owner", group__in=my_coord_group).values_list('case__id', flat=True)
            unassigned = CaseParticipant.objects.filter(case__in=owners, role="owner", contact__isnull=False).values_list('case__id', flat=True)
            return Case.objects.filter(id__in=owners).exclude(status=Case.INACTIVE_STATUS).exclude(id__in=unassigned).order_by('-created')
        return Case.objects.none()

class UserAPIView(generics.RetrieveAPIView):
    permission_classes = (IsAuthenticated, PendingUserPermission)
    serializer_class = UserGroupWelcomeSerializer

    def get_view_name(self):
        return "User Information"
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({"user": self.request.user, "last_login": self.request.session.get("previous_last_login")})
        return context
    
    def get_object(self):
        return self.request.user

class CoordinatorAPIView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)

    def get_view_name(self):
        return "Users available for Coordinator assignment"

    def get_queryset(self):
        return User.objects.filter(is_active=True, pending=False, api_account=False, groups__name__in=['coordinator', 'coordinator_mgr'])



class ManageEmailBounceAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, CoordinatorPermission)
    serializer_class = ManageEmailBounceSerializer
    pagination_class=StandardResultsPagination
    
    def get_view_name(self):
        return "Manage/View Email Bounces"

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return BounceEmailNotification.objects.none()
        if self.request.GET.get('recent'):
            today = datetime.today()
            date_7 = today - timedelta(days=7)
            date_7_str = date_7.strftime('%Y-%m-%d')
            logger.debug(date_7_str)
            return BounceEmailNotification.objects.filter(bounce_date__gte=date_7_str).filter(Q(action__isnull=True)|Q(action__exact='')).order_by('-bounce_date')

        if self.request.GET.get('complete'):
            return BounceEmailNotification.objects.all().order_by('-bounce_date')
        return BounceEmailNotification.objects.filter(Q(action__isnull=True)|Q(action__exact='')).order_by('-bounce_date')

    def update(self, request, **kwargs):
        instance = get_object_or_404(BounceEmailNotification, id=self.kwargs['pk'])
        logger.debug(request.data)
        serializer = self.serializer_class(instance, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({}, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)
        

    
class EmailBounceAPIView(generics.CreateAPIView):
    serializer_class = BounceEmailSerializer
    permission_classes = (IsAuthenticated, ServiceAccountPermission)

    def	get_view_name(self):
        return "A service API to create bounced email records"

    def	create(self, request, *args, **kwargs):

        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            create_bounce_ticket(request.data['content'])
        else:
            logger.warning(serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


        return Response({}, status=status.HTTP_200_OK)
    


    
def is_valid_path(path):
    try:
        resolved_url = resolve(path)
        return True
    except Resolver404:
        return False
    
def page_not_found_view(request, exception):
    data = {}
    requested_url = request.path

    if 'advise' in requested_url:
        requested_url = requested_url.replace("advise", "cvdp")
        if is_valid_path(requested_url):
            data['suggest'] = f"{settings.SERVER_NAME}{requested_url}"
    return render(request, "cvdp/404.html", data, status=404)

def error_view(request):
    data = {}
    return render(request, "cvdp/500.html", data, status=500)

def permission_denied_view(request, exception=None):
    data = {}
    return render(request, "cvdp/403.html", data, status=403)

def bad_request_view(request, exception):
    data = {}
    return render(request, "cvdp/400.html", data, status=400)



def exception_handler(exc, context):
    drf_request = context['request']
    response = drf_exception_handler(exc, context)
    if response:
        logger.warning(
            "DRF %d: %s %s %s", response.status_code, context['request'].user, context['request'].method, context['request'].path)
    return response


"""
This is for generating static html pages of certain templates
-must uncomment in urls.py to use.  Only for dev use
"""
def static_view(request):
    as_file = request.GET.get('as_file')
    context = {}
    if as_file:
        content = render_to_string('cvdp/maintenance.html', context)
        with open('/tmp/maitenance.html', 'w', encoding="UTF-8") as static_file:
            static_file.write(content)

    return render(request, 'cvdp/maintenance.html', context)
