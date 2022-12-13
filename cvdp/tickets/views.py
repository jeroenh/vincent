from django.shortcuts import render
import logging
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.urls import reverse, reverse_lazy
from django.views import generic, View
from django.http import HttpResponse, Http404, JsonResponse, HttpResponseNotAllowed, HttpResponseServerError, HttpResponseForbidden, HttpResponseRedirect, HttpResponseBadRequest
from django.core.exceptions import ValidationError, PermissionDenied
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.views import APIView
from rest_framework import exceptions, generics, status, authentication, viewsets, mixins, filters
from cvdp.permissions import *
from rest_framework.pagination import PageNumberPagination
from cvdp.tickets.serializers import *
from django.contrib.postgres.search import SearchVectorField, SearchVector, SearchQuery
from cvdp.lib import create_case_action, create_email_ticket, auto_assignment, send_ticket_assignment_email, send_ticket_comment_email
from cvdp.utils import process_query
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from authapp.views import PendingTestMixin
from django.contrib.auth.decorators import login_required, user_passes_test
import traceback
from cvdp.models import *


logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class StandardResultsPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size= 100


class TicketView(LoginRequiredMixin, PendingTestMixin, UserPassesTestMixin, generic.TemplateView):
    template_name="cvdp/dashboard.html"
    login_url="authapp:login"

    def test_func(self):
        return is_coordinator(self.request.user)

    def get_context_data(self, **kwargs):
        context = super(TicketView, self).get_context_data(**kwargs)
        
        
        return context
    

class TicketRedirectView(LoginRequiredMixin, generic.RedirectView):
    login_url = "authapp:login"

    def dispatch(self, request, *args, **kwargs):
        self.ticket = get_object_or_404(Ticket, id=self.kwargs['pk'])

        if self.ticket.thread.case:
            return super().dispatch(request, *args, **kwargs)
        else:
            raise Http404

    def get_redirect_url(self, **kwargs):
        return reverse("cvdp:case", args=[self.ticket.thread.case.case_id])+"/dash"

class UnassignedTicketAPIView(viewsets.ModelViewSet):
    serializer_class = TicketThreadSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)
    pagination_class = StandardResultsPagination

    def get_view_name(self):
        return "Get unassigned tickets"

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return EmailThread.objects.none()

        my_coord_group = None

        s = self.request.query_params.get('status', 'open')
        if s == "open":
            status = [Ticket.OPEN_STATUS]
        elif s == "progress":
            status = [Ticket.IN_PROGRESS_STATUS]
        elif s == "closed":
            status = [Ticket.CLOSED_STATUS]
        else:
            #all
            status = [Ticket.OPEN_STATUS, Ticket.IN_PROGRESS_STATUS, Ticket.CLOSED_STATUS]
        
        if is_in_lead_coord_team(self.request.user):
            coord_teams = Group.objects.filter(groupprofile__vendor_type="Coordinator", groupprofile__active=True).exclude(user=None).count()
            if self.request.query_params.get('team'):
                my_coord_group = Group.objects.filter(name=self.request.query_params['team'])
            elif coord_teams > 1:
                return EmailThread.ordered(EmailThread.triage(status))
            else:
                # return unassigned tickets - doesn't matter which team
                return EmailThread.ordered(EmailThread.team_triage(None, status))

        if not my_coord_group:
            my_coord_group = my_coord_teams(self.request.user)
        if my_coord_group:
            return EmailThread.ordered(EmailThread.team_triage(my_coord_group, status))
        
        return EmailThread.objects.none()

    """
class MessageTicketAPIView(viewsets.ModelViewSet):
    serializer_class = TicketSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)
    pagination_class = StandardResultsPagination
"""
    


    

class TicketAPIView(viewsets.ModelViewSet):
    serializer_class = TicketSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)
    pagination_class = StandardResultsPagination

    def get_serializer_class(self):
        if self.kwargs.get('pk'):
            tkt = self.get_object()
            if isinstance(tkt, EmailTicket):
                return EmailTicketSerializer
            else:
                return TicketSerializer
        else:
            return TicketThreadSerializer

    def get_view_name(self):
        return "View particular ticket"

    def get_object(self):
        try:
            tkt = EmailTicket.objects.get(id = self.kwargs['pk'])
            if is_my_ticket(tkt, self.request.user):
                if tkt.assigned_to == self.request.user:
                    tkt.mark_read(self.request.user)
                return tkt
        except:
            tkt = Ticket.objects.get(id=self.kwargs['pk'])
            if is_my_ticket(tkt, self.request.user):
                if tkt.assigned_to == self.request.user:
                    tkt.mark_read(self.request.user)
                return tkt

        raise Http404


    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return EmailThread.objects.none()

        search_query = None
        user = self.request.user
        if self.request.GET.get('search'):
            search_query=process_query(self.request.GET['search'])


        if self.request.GET.get('team'):
            g = get_object_or_404(Group, groupprofile__uuid=self.request.GET['team'])
            if not (is_in_lead_coord_team(self.request.user) or self.request.user.groups.filter(name=g.name)):
                raise PermissionDenied()
            
            if g.groupprofile.vendor_type == "Coordinator":

                return EmailThread.ordered(EmailThread.team_tickets(g, self.request.GET.get('status'), search_query))

        if self.request.GET.get('user'):
            g = get_object_or_404(Contact, uuid=self.request.GET.get('user'))

            if not (is_my_manager(self.request.user, g.user)):
                raise PermissionDenied()
            user = g.user
            
        if self.request.GET.get('search') or self.request.GET.get('status'):
            qs = EmailThread.mytickets(user, self.request.GET.get('status'))
            if search_query:
                query = SearchQuery(search_query)
                qs = qs.filter(emails__search_vector=query)
                #qs = qs.extra(where=["search_vector @@ (to_tsquery('english', %s))=true"], params=[search_query])

            return EmailThread.ordered(qs)

        else:
            return EmailThread.ordered(EmailThread.mytickets(user))

    def update(self, request, **kwargs):

        logger.debug(request.data)
        instance = self.get_object()
        threadtickets = None
        #is this an emailTicket
        try:
            if instance.emailticket.msg_thread:
                threadtickets = EmailTicket.objects.filter(msg_thread__id = instance.emailticket.msg_thread.id)
            elif instance.emailticket.email_thread:
                threadtickets = EmailTicket.objects.filter(email_thread__id = instance.emailticket.email_thread.id)
        except:
            logger.debug(traceback.format_exc())

        serializer = self.serializer_class(instance, data=request.data, partial=True)
        if serializer.is_valid():
            old_status = instance.status
            ticket = serializer.save()
            if ticket.status != old_status:
                for tkt in threadtickets:
                    tkt.status = ticket.status
                    tkt.save()

                    TicketAction.objects.create(title=f"changed status from {dict(Ticket.STATUS_CHOICES)[old_status]} to {request.data['status']}",
                                                user=request.user,
                                                ticket=tkt)

            if request.data.get('case'):
                #make sure case exists
                if request.data['case'] == "remove":
                    # does a thread exist with this label?
                    #old case:
                    case = ticket.thread.case
                    if not case:
                        return Response({'case': 'this ticket is not associated with a case'}, status=status.HTTP_400_BAD_REQUEST)
                    thread = TicketThread.objects.filter(label=ticket.thread.label).exclude(case__isnull=False).first()
                    if not thread:
                        #create one
                        thread = TicketThread.objects.create(label=ticket.thread.label)
                    ticket.thread = thread
                    ticket.save()

                    
                    for tkt in threadtickets:
                        tkt.thread = thread
                        tkt.save()
                        
                        TicketAction.objects.create(title=f"remove case {case.caseid}",
                                                    user=request.user,
                                                    ticket=tkt)
                else:
                    
                    case = Case.objects.filter(case_id=request.data['case']).first()
                    if not case:
                        return Response({'case': 'invalid case id'}, status=status.HTTP_400_BAD_REQUEST)

                    # does a thread exist on this case with this label?
                    thread = TicketThread.objects.filter(case=case, label=ticket.thread.label).first()
                    if not thread:
                        #create one
                        thread = TicketThread.objects.create(case=case, label=ticket.thread.label)
                    ticket.thread = thread
                    ticket.save()
                    action_title = f"assigned ticket to case {case.caseid}"
                    #get case owner
                    owner = CaseParticipant.objects.filter(role="owner", case=case).exclude(contact__isnull=True).first()
                    if owner:
                        #assign this ticket to the case owner
                        ticket.assign(owner.contact.user, request.user)
                        send_ticket_assignment_email(ticket, request.user)

                    coord_team = get_coord_team(case.id)
                    if (coord_team):
                        ticket.team = coord_team[0]
                        ticket.save()
                        
                    for tkt in threadtickets:
                        tkt.thread = thread
                        tkt.save()
                        tkt.assign(ticket.assigned_to, request.user)
                        
                        TicketAction.objects.create(title=action_title,
                                                    user=request.user,
                                                    ticket=tkt)

            if request.data.get('assign'):
                logger.debug("HERE")
                if request.data['assign'] == "-1":
                    #unassign
                    ticket.unassign(request.user)

                    for tkt in threadtickets:
                        tkt.unassign(request.user)

                elif request.data.get('role'):
                    #autoassign
                    logger.debug("ATTEMPTING TO AUTO ASSIGN")
                    role = get_object_or_404(AssignmentRole, role=request.data['role'])
                    user = auto_assignment(role.id)
                    title = f"auto assigned ticket to {user.screen_name}"
                    logger.debug(title)
                    ticket.assign(user, request.user)
                    send_ticket_assignment_email(ticket, request.user)
                    for tkt in threadtickets:
                        tkt.assign(user, request.user)

                else:
                    try:
                        contact = Contact.objects.get(uuid=request.data.get('assign'))
                        new_assignee = User.objects.filter(id=contact.user.id).first()
                    except:
                        return Response({'assign': 'Invalid assignment value'}, status=status.HTTP_400_BAD_REQUEST)
                    if new_assignee:
                        ticket.assign(new_assignee, request.user)
                        send_ticket_assignment_email(ticket, request.user)
                        for tkt in threadtickets:
                            tkt.assign(new_assignee, request.user)

                        #TODO add activity
                    else:
                        return Response({'assign': 'Invalid user'}, status=status.HTTP_400_BAD_REQUEST)

            if request.data.get('team') and request.data.get('team').get('uuid'):
                logger.debug("ASSIGNING TEAM!!")
                if request.data['team'].get('uuid') == "-1":
                    #unassign
                    ticket.unassign_team(request.user)
                    
                    for tkt in threadtickets:
                        tkt.unassign_team(request.user)
                else:
                    try:
                        team = Group.objects.get(groupprofile__uuid=request.data.get('team').get('uuid'), groupprofile__vendor_type = "Coordinator", groupprofile__active=True)
                    except:
                        return Response({'team': 'Invalid coordination team'}, status=status.HTTP_400_BAD_REQUEST)
                    if team:
                        ticket.assign_team(team, request.user)
                        for tkt in threadtickets:
                            tkt.assign_team(team, request.user)
                    else:
                        return Response({'team': 'Invalid coordination team'}, status=status.HTTP_400_BAD_REQUEST)
            serializer = self.serializer_class(ticket)
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors);
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class EmailAPIView(viewsets.ModelViewSet):
    serializer_class = TicketSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)
    pagination_class = StandardResultsPagination

    def get_view_name(self):
        return "View Email thread tickets"

    def get_queryset(self):
        return EmailTicket.objects.filter(email_thread__id = self.kwargs['pk']).order_by('created')


class CaseTicketAPIView(viewsets.ModelViewSet):
    serializer_class = TicketThreadSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseOwnerWritePermission)
    pagination_class = StandardResultsPagination
    #filterset_fields = ['tickets__status']

    def get_view_name(self):
        return "Get case tickets"

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return EmailThread.objects.none()
        #can't use filterset_fields because we're using a sort on time in the ordered classmethod
        # so we can do distinct 'id' to get threads

        if self.request.GET.get('search') or self.request.GET.get('status'):
            status = self.request.GET.get('status', 'all')
            if status == "all":
                qs = EmailThread.case(self.kwargs['caseid'])
            elif status == "unread":
                qs = EmailThread.unread(self.kwargs['caseid'], self.request.user)
            else:
                qs = EmailThread.case_status(self.kwargs['caseid'], status)
            if self.request.GET.get('search'):
                search_query=process_query(self.request.GET['search'])
                query = SearchQuery(search_query)
                qs = qs.filter(tickets__search_vector=query)
                #qs = qs.extra(where=["cvdp_ticket.search_vector @@ (to_tsquery('english', %s))=true"], params=[search_query])
            return EmailThread.ordered(qs)
            
        return EmailThread.ordered(EmailThread.case(self.kwargs['caseid']))

class TicketActivityAPIView(viewsets.ModelViewSet):
    serializer_class = TicketActivitySerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseOwnerWritePermission)
    pagination_class = StandardResultsPagination

    def get_view_name(self):
        return "Ticket Activity API"

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return TicketAction.objects.none()

        return TicketAction.objects.filter(ticket__id=self.kwargs['pk']).order_by('-created')

    def get_object(self):
        ticket = get_object_or_404(Ticket, id=self.kwargs['pk'])
        if (ticket.thread.case):
            self.check_object_permissions(self.request, ticket.thread.case)
            return ticket
        else:
            if is_coordinator(self.request.user):
                return ticket
        raise PermissionDenied

    def create(self, request, *args, **kwargs):

        ticket = self.get_object()

        if (request.data.get('comment')):
            title="commented on this ticket"
        else:
            title="changed ticket"

        serializer = self.serializer_class(data=request.data)

        if serializer.is_valid():

            if request.data.get('comment'):
                send_ticket_comment_email(ticket, request.user)
            
            note = serializer.save(ticket=ticket, user=request.user, title=title)
            note.save()
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors);
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)




class CaseNoteAPIView(viewsets.ModelViewSet):
    serializer_class = CaseNoteSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission, CaseOwnerWritePermission)
    pagination_class = StandardResultsPagination
    filterset_fields = ['archived', 'flagged']

    def get_view_name(self):
        return "Get Case Notes"

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return CaseNote.objects.none()
        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        self.check_object_permissions(self.request, case)
        return CaseNote.objects.filter(case__case_id=self.kwargs['caseid']).order_by('-created')

    def get_object(self):
        case = get_object_or_404(CaseNote, id=self.kwargs['pk'])
        self.check_object_permissions(self.request, case.case)
        return case

    def create(self, request, *args, **kwargs):

        logger.debug(request.data)
        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        self.check_object_permissions(self.request, case)
        serializer = self.serializer_class(data=request.data)

        if serializer.is_valid():
            action = create_case_action("added note", request.user, case, False)

            note = serializer.save(case = case)
            note.user = request.user
            note.save()
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors);
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


    def update(self, request, **kwargs):
        instance = self.get_object()
	#only case owners can update a case

        serializer = self.serializer_class(instance, data=request.data)
        if serializer.is_valid():
            note = serializer.save()
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors);
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class IncomingEmailAPIView(generics.CreateAPIView):
    serializer_class = EmailSerializer
    permission_classes = (IsAuthenticated, ServiceAccountPermission)

    def get_view_name(self):
        return "Create tickets from emails"

    def create(self, request, *args, **kwargs):

        logger.debug(request.data)

        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            create_email_ticket(request.data['content'])

        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


        return Response({}, status=status.HTTP_200_OK)

