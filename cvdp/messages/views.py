from django.shortcuts import render
import logging
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.urls import reverse, reverse_lazy
from django.views import generic, View
import django_filters
from django.views.generic.edit import FormView, UpdateView, FormMixin, CreateView
from django.http import HttpResponse, Http404, JsonResponse, HttpResponseNotAllowed, HttpResponseServerError, HttpResponseForbidden, HttpResponseRedirect, HttpResponseBadRequest
from rest_framework import exceptions, generics, status, authentication, viewsets, mixins, filters
from cvdp.messages.serializers import *
from authapp.models import User
from django.core.exceptions import ValidationError, PermissionDenied
from django.utils.translation import gettext as _
from authapp.views import PendingTestMixin
# Create your views here.
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from cvdp.permissions import *
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
import traceback
from cvdp.forms import *
from cvdp.lib import validate_recaptcha, add_artifact, validate_turnstile
from cvdp.models import *
from django.core.paginator import Paginator
from rest_framework.views import APIView
from django.template import engines

from_string = engines['django'].from_string

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class UnreadMessageAPI(APIView):
    permission_classes = (IsAuthenticated, PendingUserPermission)

    def get(self, request, format=None):
        data = {}
        data['unread'] = len(MessageThread.ordered(MessageThread.unread(self.request.user)))
        data['user'] = data['unread']
        return Response(data)
    
    #the below code was for group inboxes which I exchanged for tickets
        """for group in self.request.user.groups.exclude(groupprofile__isnull=True):
            count = len(MessageThread.ordered(MessageThread.group_unread(group)))
            data['unread'] = data['unread'] + count
            data[str(group.groupprofile.uuid)] = count"""

class StandardResultsPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size= 100
    
"""
Inbox View - React App 'inbox'
#TODO - show deleted messages
"""
class InboxView(LoginRequiredMixin, PendingTestMixin, generic.TemplateView):
    template_name = "cvdp/new_inbox.html"
    login_url="authapp:login"

    def dispatch(self, request, *args, **kwargs):
        if self.request.user.is_authenticated:
            if self.kwargs.get('pk'):
                thread = get_object_or_404(MessageThread, id=self.kwargs['pk'])
                if is_my_msg_thread(self.request.user, thread):
                    return super().dispatch(request, *args, **kwargs)
                raise Http404
            if self.kwargs.get('contact'):
                if not is_coordinator(self.request.user):
                    return redirect("cvdp:inbox")
        return super().dispatch(request, *args, **kwargs)
    
    def get_context_data(self, **kwargs):
        context = super(InboxView, self).get_context_data(**kwargs)
        context['inboxpage'] = 1

        gs = GlobalSettings.objects.all().first()
        if gs:
            if gs.contact_reasons:
                context['contact_reasons'] = gs.contact_reasons.splitlines()
        if self.kwargs.get('contact'):
            context['contact'] = [self.kwargs['contact']]
        if self.kwargs.get('admin'):
            group = Group.objects.filter(groupprofile__uuid=self.kwargs['contact']).first()
            if group:
                context['contact'] = ContactAssociation.objects.filter(group=group, group_admin=True)
                
            if self.kwargs.get('bounce'):
                context['bounce'] = BounceEmailNotification.objects.filter(id=self.kwargs['bounce']).first()
                if context['bounce']:
                    context['contact'] = context['contact'].exclude(contact__email = context['bounce'].email)
                    context['bounce_template'] = EmailTemplate.objects.filter(template_name='bounce_notify').first()
                    if (context['bounce_template']):
                        msg_context = {}
                        msg_context['email'] = context['bounce'].email
                        if context['bounce'].user and context['bounce'].user.get_full_name():
                            msg_context["name"] = context['bounce'].user.get_full_name()
                        else:
                            msg_context['name'] = "this user"
                            
                        context['bounce_template'] = from_string("%s" % context['bounce_template'].plain_text).render(msg_context)
                    
            context['contact'] = list(context['contact'].values_list('contact__uuid', flat=True))

                
        #get coord team
        context['team'] = GlobalSettings.objects.all().first()
        if self.kwargs.get('pk'):
            num_msgs_before = UserThread.objects.filter(thread__id__gt=self.kwargs['pk'], user=self.request.user).count()
            
            page_number = (num_msgs_before // StandardResultsPagination.page_size) + 1
            context['message'] = self.kwargs.get('pk')
            context['page'] = page_number
            logger.debug(page_number)

        return context

class MessageUploadView(LoginRequiredMixin, generic.TemplateView):
    login_url = "authapp:login"
    template_name='cvdp/notemplate.html'

    def post(self, request, *args, **kwargs):
        thread = None
        if self.kwargs.get('pk'):
            logger.debug("CHECKING....")
            thread = get_object_or_404(MessageThread, id=self.kwargs['pk'])
            if not is_my_msg_thread(self.request.user, thread):
                raise PermissionDenied()
        logger.debug(f"Files Post: {self.request.FILES}")
        artifact = add_artifact(self.request.FILES['image'])
        ca = MessageAttachment(file=artifact,
                               thread=thread,
                               user=self.request.user)
        ca.save()
        url = reverse("cvdp:artifact", args=[ca.file.uuid])
        return JsonResponse({'status': 'success', 'image_url': url}, status=200)


class ThreadAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission)
    serializer_class = ThreadSerializer
    pagination_class = StandardResultsPagination


    def get_serializer_context(self):
        context = super().get_serializer_context()
        if not is_coordinator(self.request.user):
            gs = GlobalSettings.objects.all().first()
            if gs and gs.coordinator_identity:
                context['coordinator'] = gs.coordinator_identity
                context['owner'] = gs.group
        logger.debug(context)
        context['user'] = self.request.user
        return context
    
    """
    def list(self, request, *args, **kwargs):
        logger.debug("IN PAGINATE")
        content = self.get_queryset()
        page = self.paginate_queryset(content)
        if self.request.GET.get('group'):
            group = get_object_or_404(Group, groupprofile__uuid=self.request.GET.get('group'))
            if not self.request.user.groups.filter(id=group.id).exists():
                group = None
        else:
            group = None
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(self.serializer_class(content, many=True,
                                           context={'user': request.user, 'group': group}).data)

    """
    
    def get_object(self):
        thread = UserThread.objects.filter(user=self.request.user, thread__id=self.kwargs['pk']).first()
        if not thread:
            if (is_coordinator(self.request.user)):
                #lookup Ticket
                tkt = EmailTicket.objects.filter(msg_thread = self.kwargs['pk']).first()
                logger.debug(tkt)
                if tkt:
                    if is_my_ticket(tkt, self.request.user):
                        logger.debug("THIS IS MY TICKET")
                        thread = UserThread.objects.filter(thread__id=self.kwargs['pk']).first()
                    else:
                        raise PermissionDenied
                                    
                else:
                    raise Http404
        if thread:
            return thread.thread
        raise Http404
    
    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return MessageThread.objects.none()

        #if group
        if self.request.GET.get('group'):
            group = get_object_or_404(Group, groupprofile__uuid=self.request.GET.get('group'))
            if self.request.user.groups.filter(id=group.id).exists():
                if self.request.GET.get('search'):
                    return MessageThread.ordered(MessageThread.group(group).filter(messages__content__icontains=self.request.GET['search']))
                return MessageThread.ordered(MessageThread.group(group))
        
        # get cases I have access to
        if self.request.GET.get('search'):
            qs = MessageThread.all(self.request.user).filter(messages__content__icontains=self.request.GET['search'])
            return MessageThread.ordered(qs)
        return MessageThread.ordered(MessageThread.all(self.request.user))

    def create(self, request, *args, **kwargs):
        logger.debug(f"ThreadAPI Create: {request.data}")

        token = request.data.get('token', None)
        if token and getattr(settings, "RECAPTCHA_PUBLIC_KEY", None):
            if not validate_recaptcha(token):
                return Response({'message': 'Invalid ReCAPTCHA. Please try again'}, status=status.HTTP_400_BAD_REQUEST)
        elif token and getattr(settings, "TURNSTILE_SITE_KEY", None):
            if not validate_turnstile(token):
                return Response({'message': 'Invalid Turnstile Verification. Please try again'}, status=status.HTTP_400_BAD_REQUEST)

        url = request.data.get('url', None)
        content = request.data.get('content', None)
        if not content or (content == "<p><br></p>"):
            #this is equivalent to an empty message (for some reason when you enter and then remove content,
            #quill automatically adds this and there's no way to remove it"
            return Response({'message': 'No message content present'},
                            status=status.HTTP_400_BAD_REQUEST)
            

        from_group = request.data.get('from')
        user_list = []
        group_list = []

        if is_coordinator(self.request.user):
            gs = GlobalSettings.objects.all().first()
            if gs and gs.coordinator_identity:
                group_list.append(gs.group)
            #TODO how does a coordinator decide who they are sending from?
            elif from_group:
                from_group = Group.objects.filter(groupprofile__uuid=from_group).first()
                if from_group:
                    group_list.append(from_group)
            #get all users
            for user in request.data.getlist('users[]'):
                contact = Contact.objects.filter(uuid=user).first()
                if (contact):
                    user_list.append(contact.user)
                else:
        	    #lookup group
                    group = Group.objects.filter(groupprofile__uuid=user).first()
                    if (group):
        	        #get all users in group                    
                        uglist = group.user_set.filter(is_active=True).exclude(api_account=True).exclude(is_api_service=True)
                        for u in uglist:
                            user_list.append(u)
        	            #group_list.append(
                    else:
                        return Response({'message': 'invalid to: user/group does not exist'},
        	                        status=status.HTTP_400_BAD_REQUEST)

            if user_list and group_list:
                msg = Message.new_group_user_message(self.request.user, from_group,  user_list, group_list, None, "", request.data['content'])
            elif user_list:
                msg = Message.new_message(self.request.user, from_group, user_list, None, "", request.data['content'])
            else:
                msg = Message.new_group_message(self.request.user, from_group, group_list, None, "", request.data['content'])

        else:
            #get coordination tea
            group = GlobalSettings.objects.all().first()
            if not group:
                return Response({'message': 'Invalid Group: VINCE-NT improperly configured'},
                                status = status.HTTP_400_BAD_REQUEST)
            #this is a message to the coordinators
            msg = Message.new_group_message(self.request.user, None, [group.group], None, request.data['title'], request.data['content'])
            

        if msg:

            if 'bounce' in url:
                bounce_match = re.search(r"\/bounce\/(\d+)\/", url)
                if bounce_match:
                    try:
                        bounce_id = bounce_match.group(1)
                        bnot = BounceEmailNotification.objects.filter(id=bounce_id).first()
                        if bnot:
                            bnot.action = "messaged group admin"
                            bnot.save()
                    except:
                        pass
                    
            
            serializer = ThreadSerializer(msg.thread)
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            return Response({'message': 'Error creating message'},
                            status=status.HTTP_400_BAD_REQUEST)
    

class MessageAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission)
    serializer_class = MessageSerializer

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
            return Message.objects.none()
        thread = get_object_or_404(MessageThread, id=self.kwargs['pk'])
        if not UserThread.objects.filter(thread=thread, user=self.request.user).exists():
            my_groups = self.request.user.groups.values_list('id', flat=True)
            gt = GroupThread.objects.filter(thread=thread, group__in=my_groups).first()
            if not gt:
                if (is_coordinator(self.request.user)):
                    tkt = EmailTicket.objects.filter(msg_thread = self.kwargs['pk']).first()
                    logger.debug(tkt)
                    if tkt:
                        if is_my_ticket(tkt, self.request.user):
                            logger.debug("THIS IS MY TICKET")
                        else:
                            raise PermissionDenied
                else:
                    #this isn't your thread, yo
                    raise Http404
            else:
                gt.unread=False
                gt.save()
        else:
            thread.userthread_set.filter(user=self.request.user).update(unread=False)
            # is it also a groupthread?
            #my_groups = self.request.user.groups.values_list('id', flat=True)
            #gt = GroupThread.objects.filter(thread=thread, group__in=my_groups).first()
            #if gt:
            #    gt.unread=False
            #gt.save()

        return Message.objects.filter(thread=thread)

    def create(self, request, *args, **kwargs):
        thread = get_object_or_404(MessageThread, id=self.kwargs.get('pk'))
        logger.debug(request.data)
        
        msg = Message.new_reply(thread, self.request.user, request.data['content'])

        if msg:
            serializer = MessageSerializer(msg)
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            return Response({'error': 'Error creating message'},
                            status=status.HTTP_400_BAD_REQUEST)

