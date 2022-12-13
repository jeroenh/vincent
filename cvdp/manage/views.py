from django.shortcuts import render
import logging
from datetime import datetime, timedelta
import pytz
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.utils.timezone import make_aware
from django.core.exceptions import PermissionDenied
from django.urls import reverse, reverse_lazy
from django.views import generic, View
from django.utils.timesince import timesince
from django.views.generic.edit import FormView, UpdateView, FormMixin, CreateView
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.forms.models import inlineformset_factory
from authapp.views import PendingTestMixin
from django.http import HttpResponse, Http404, JsonResponse, HttpResponseNotAllowed, HttpResponseServerError, HttpResponseForbidden, HttpResponseRedirect, HttpResponseBadRequest
from authapp.models import User
from cvdp.models import CVEServicesAccount, CVEReservation
from django.utils.safestring import mark_safe
import traceback
from django_filters.rest_framework import DjangoFilterBackend
from cvdp.manage.forms import *
from rest_framework import exceptions, generics, status, authentication, viewsets, mixins, filters
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.views import APIView
from cvdp.permissions import *
from cvdp.manage.serializers import *
from cvdp.cases.serializers import UserSerializer


logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

def date_rel_to_today(today, offset):
    return today - timedelta(days=offset)


class CreateNewReportingForm(LoginRequiredMixin, UserPassesTestMixin, FormView):
    form_class = NewReportingForm
    template_name = "cvdp/newform.html"
    login_url = "authapp:login"

    def test_func(self):
        return self.request.user.is_staff

    def post(self, request, *args, **kwargs):
        logger.debug(f"{self.__class__.__name__} post: {self.request.POST}")
        if self.kwargs.get('pk'):
            form_initial = get_object_or_404(ReportingForm, id=self.kwargs['pk'])
            form = self.form_class(self.request.POST, instance=form_initial)
        else:
            form = self.form_class(self.request.POST)

        if form.is_valid():
            return self.form_valid(form)
        else:
            return self.form_invalid(form)

    def form_valid(self, form):
        logger.debug("VALID FORM")
        f = form.save()
        f.created_by = self.request.user
        f.save()

        return redirect("cvdp:design_form", f.id)

    def get_context_data(self, **kwargs):
        context = super(CreateNewReportingForm, self).get_context_data(**kwargs)
        if self.kwargs.get('pk'):
            form_initial = get_object_or_404(ReportingForm, id=self.kwargs['pk'])
            context['form'] = self.form_class(instance=form_initial)
            context['title'] = "Edit Form"
        else:
            context['title'] = "Create new reporting form"
        return context

    def form_invalid(self, form):
        logger.debug("INVALID FORM")
        logger.debug(f"{self.__class__.__name__} errors: {form.errors}")

        return render(self.request, 'cvdp/newform.html',
                      {'form': form,})


class DesignReportingForm(LoginRequiredMixin, UserPassesTestMixin, generic.TemplateView):
    model = ReportingForm
    form_class = QuestionForm
    template_name = "cvdp/designform.html"
    login_url = "authapp:login"

    def test_func(self):
        return self.request.user.is_staff

    def get_context_data(self, **kwargs):
        context = super(DesignReportingForm, self).get_context_data(**kwargs)
        theform = get_object_or_404(ReportingForm, id=self.kwargs['pk'])
        context['theform'] = theform
        context['questions'] = FormQuestion.objects.filter(form=theform)
        #forms = {'question_formset' :self.QuestionFormSet(prefix='question', queryset=questions, instance=theform)}
        #context.update(forms)
        return context

"""
class QuestionForm(LoginRequiredMixin, UserPassesTestMixin, FormView):
    form_class = QuestionForm
    login_url = "authapp:login"
    template_name = "cvdp/question_form.html"

    def test_func(self):
        return self.request.user.is_coordinator

    def get_context_data(self, **kwargs):
        context = super(QuestionForm, self).get_context_data(**kwargs)
        theform = get_object_or_404(ReportingForm, id=self.kwargs['pk'])
        context['theform'] = theform
        context['form'] = self.form_class(initial = {'form': theform.id })
        return context

    def form_valid(self, form):
        logger.debug(f"{self.__class__.__name__} post: {self.request.POST}")
        theform = get_object_or_404(ReportingForm, id=self.kwargs['pk'])
        q = form.save()
        return redirect("cvdp:question", q.id)


class QuestionDetail(LoginRequiredMixin, UserPassesTestMixin, generic.DetailView):
    model=FormQuestion
    login_url = "authapp:login"
    template_name = "cvdp/question_detail.html"

    def test_func(self):
        return self.request.user.is_coordinator
"""

class QuestionAPIView(viewsets.ModelViewSet):
    serializer_class = QuestionSerializer
    permission_classes= (IsAuthenticated, PendingUserPermission, StaffPermission)

    def get_view_name(self):
        return f"Form Questions"

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return FormQuestion.objects.none()

        form = get_object_or_404(ReportingForm, id=self.kwargs['pk'])
        return FormQuestion.objects.filter(form=form)

    def create(self, request, *args, **kwargs):
        form = get_object_or_404(ReportingForm, id=self.kwargs['pk'])
        logger.debug(request.data)
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            q = serializer.save(form=form)
            if not request.data.get('required'):
                q.required = False
                q.save()
        return Response(serializer.data, status=status.HTTP_202_ACCEPTED)

    def destroy(self, request, *args, **kwargs):
        question = get_object_or_404(FormQuestion, id=self.kwargs['pk'])
        question.delete()
        return Response({}, status=status.HTTP_202_ACCEPTED)

    def update(self, request, **kwargs):
        instance = get_object_or_404(FormQuestion, id=self.kwargs['pk'])
        data = request.data
        logger.debug(request.data)
        serializer = self.serializer_class(instance=instance, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)


class ReportingFormAPIView(viewsets.ModelViewSet):
    queryset = ReportingForm.objects.all()
    serializer_class = ReportingFormSerializer
    permission_classes = (IsAuthenticated, )

    def get_view_name(self):
        return f"Reporting Form"


class FormManagement(LoginRequiredMixin, UserPassesTestMixin, generic.ListView):
    template_name = "cvdp/manage_forms.html"
    login_url = "authapp:login"
    model = ReportingForm

    def test_func(self):
        return is_coordinator_mgr(self.request.user)

    def get_context_data(self, **kwargs):
        context = super(FormManagement, self).get_context_data(**kwargs)
        context['manageform'] = 1
        gs = GlobalSettings.objects.all().first()
        if gs and gs.use_custom_report:
            context['use_custom_form'] = True
        return context


#TODO: can anyone authenticated manage CVE here?  Or just coordinators?
class CVEServicesDashboard(LoginRequiredMixin, UserPassesTestMixin, generic.TemplateView):
    template_name = 'cvdp/cveservices.html'
    login_url="authapp:login"

    def test_func(self):
        return is_coordinator(self.request.user) or is_analyst(self.request.user)

    def get_context_data(self, **kwargs):
        context = super(CVEServicesDashboard, self).get_context_data(**kwargs)
        context['cveservices'] = 1
        context['accounts'] = CVEServicesAccount.objects.all()
        if self.kwargs.get('pk'):
            acc = get_object_or_404(CVEServicesAccount, id=self.kwargs['pk'])
        elif context['accounts']:
            acc = context['accounts'][0]
        return context

class UserAdminView(LoginRequiredMixin, UserPassesTestMixin, generic.TemplateView):
    template_name = 'cvdp/user_admin.html'
    login_url="authapp:login"

    def test_func(self):
        return is_user_admin(self.request.user) or is_coordinator_mgr(self.request.user) or is_analyst_mgr(self.request.user)

    def get_context_data(self, **kwargs):
        context = super(UserAdminView, self).get_context_data(**kwargs)
        context['useradminpage'] = 1
        return context

class SystemAdminView(LoginRequiredMixin, UserPassesTestMixin, generic.TemplateView):
    template_name = 'cvdp/sys_admin.html'
    login_url="authapp:login"

    def test_func(self):
        return is_coordinator_mgr(self.request.user)

    def get_context_data(self, **kwargs):
        context = super(SystemAdminView, self).get_context_data(**kwargs)
        context['sysadminpage'] = 1
        return context


class CSAFAdminView(LoginRequiredMixin, UserPassesTestMixin, generic.TemplateView):
    template_name = 'cvdp/csaf_settings.html'
    login_url="authapp:login"

    def test_func(self):
        return is_user_admin(self.request.user) or is_coordinator(self.request.user)

    def get_context_data(self, **kwargs):
        context = super(CSAFAdminView, self).get_context_data(**kwargs)
        context['csafadminpage'] = 1
        return context

class PendingUsersAPI(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)
    serializer_class = UserSerializer

    def get_object(self):
        return User.objects.filter(contact__uuid=self.kwargs.get('pk'))
    
    def get_queryset(self):
        return User.objects.filter(pending=True)

    def update(self, request, **kwargs):
        user = self.get_object()
        if user.pending:
            user.pending=False;
            user.save()

            return Response({}, status=status.HTTP_202_ACCEPTED)
        else:
            return Response({'error': 'user not pending'}, status=status.HTTP_400_BAD_REQUEST)

class NewUsersAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)
    serializer_class = UserSerializer

    def get_queryset(self):
        today = datetime.today()
        date_7 = date_rel_to_today(today, 7)
        date_7_str = date_7.strftime('%Y-%m-%d')
        return User.objects.filter(date_joined__gte=date_7_str, pending=False, api_account=False).order_by('-date_joined')


"""
This is unused
"""
class AssignRolesView(LoginRequiredMixin, UserPassesTestMixin, generic.TemplateView):
    template_name = 'cvdp/assign_roles.html'
    login_url="authapp:login"

    def test_func(self):
        return self.request.user.is_staff

    def get_context_data(self, **kwargs):
        context = super(AssignRolesView, self).get_context_data(**kwargs)
        return context

class AutoAssignmentAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, ManagerPermission)
    serializer_class = AutoAssignmentSerializer

    def get_queryset(self):
        return AssignmentRole.objects.all()

    def get_serializer_class(self):
        if self.action == 'list' or self.action == "create":
            return AutoAssignmentSerializer
        elif self.action == "update":
            return AssignmentWeightSerializer
        return self.serializer_class

    def create(self, request, *args, **kwargs):
        logger.debug(request.data)

        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            role = serializer.save()
            if (request.data.get('group')):
                #get group
                group = Group.objects.filter(groupprofile__uuid=request.data['group']).first()
                if group:
                    role.group = group
                    role.save()

            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, **kwargs):
        logger.debug(request.data)

        instance = self.get_object()
        data = request.data

        if request.data.get('delete'):
            contact = get_object_or_404(Contact, uuid=request.data.get('user'))
            user = contact.user
            role = UserAssignmentWeight.objects.filter(user=user, role=instance).first()
            role.delete()

            return Response({}, status=status.HTTP_202_ACCEPTED)
        elif request.data.get('user'):
            contact = get_object_or_404(Contact, uuid=request.data.get('user'))
            user = contact.user
            # this is a role meta update
            new = UserAssignmentWeight.objects.update_or_create(user = user, role=instance,
                                                                defaults={'weight': request.data.get('weight', 1)
                                                                          })
            return Response({}, status=status.HTTP_202_ACCEPTED)
        else:
            serializer = AutoAssignmentSerializer(instance=instance, data=data, partial=True)
            if serializer.is_valid():
                serializer.save()
                if (request.data.get('group')):
                    #get group
                    group = Group.objects.filter(groupprofile__uuid=request.data['group']).first()
                    if group:
                        instance.group = group
                        instance.save()

                return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
            else:
                logger.debug(serializer.errors)
                return Response(serializer.errors,
                                status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if UserAssignmentWeight.objects.filter(role=instance).count() > 0:
            return Response({"role": "All users must be removed for removing role."},
                            status=status.HTTP_400_BAD_REQUEST)
        logger.warning(f"User {request.user.username} removed role {instance.role}")
        instance.delete()

        return Response({}, status=status.HTTP_202_ACCEPTED)


class CVEServicesAccountManagement(LoginRequiredMixin, UserPassesTestMixin, FormView):
    template_name = 'cvdp/add_cve_account.html'
    login_url = 'authapp:login'
    form_class = CVEAccountForm

    def get_success_url(self):
        return reverse_lazy("cvdp:cve_services")

    def test_func(self):
        return is_coordinator(self.request.user) or is_analyst(self.request.user)

    def get_context_data(self, **kwargs):
        context = super(CVEServicesAccountManagement, self).get_context_data(**kwargs)
        if self.kwargs.get('pk'):
            account = get_object_or_404(CVEServicesAccount, id=self.kwargs['pk'])
            context['title'] = "Edit Account Information"
            form = CVEAccountForm(instance=account)
            context['form'] = form

            context['action'] = reverse("cvdp:edit_cve_account", args=self.kwargs['pk'])
        else:
            context['title'] = 'Add new account'
            initial = {}
            form = CVEAccountForm()
            context['form'] = form
            context['action'] = reverse("cvdp:add_cve_account")
        return context


    def form_valid(self, form):
        account = form.save()
        account.user_added = self.request.user
        account.save()
        messages.success(
            self.request,
            "Got it! Your changes have been saved"
        )
        return redirect("cvdp:cve_services")


class CVEReservationAPI(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordOrAnalystPermission)
    serializer_class = CVEReservationSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['account__id',]
    
    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return CVEReservation.objects.none()
        #TODO - permissions - should we allow lookups for certain users? 
        return CVEReservation.objects.filter(user_reserved=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)

        if serializer.is_valid():
            cveservices = get_object_or_404(CVEServicesAccount, id=request.data['account_id'])
            res = serializer.save()
            res.account = cveservices
            res.user_reserved = self.request.user
            res.save()
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

    
    
class CVEAccountAPI(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordOrAnalystPermission)
    serializer_class = CVEAccountSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['active', 'server_type',]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return CVEServicesAccount.objects.none()
        
        return CVEServicesAccount.objects.filter(user_added=self.request.user)


    def create(self, request, *args, **kwargs):
        logger.debug(f"{self.__class__.__name__} post: {request.data}")
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            account = serializer.save()
            account.user_added = self.request.user
            account.save()

            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)


    def update(self, request, *args, **kwargs):
        logger.debug(f"{self.__class__.__name__} patch: {request.data}")
        instance = self.get_object()
        data = request.data
        serializer = self.serializer_class(instance=instance, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)


    def destroy(self, request, *args, **kwargs):
        question = get_object_or_404(CVEServicesAccount, id=self.kwargs['pk'])
        question.delete()
        return Response({}, status=status.HTTP_202_ACCEPTED)

class EmailTemplateAPI(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorMgrPermission)
    serializer_class = EmailTemplateSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['template_type']
    search_fields = ['template_name']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return EmailTemplate.objects.none()

        return EmailTemplate.objects.all()


class ConnectionAPI(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, StaffPermission)
    serializer_class = ConnectionSerializer

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return AdVISEConnection.objects.none()
        if self.request.GET.get('all'):
            return AdVISEConnection.objects.all().order_by('disabled')
        else:
            return AdVISEConnection.objects.filter(disabled=False)

    def get_object(self):
        return get_object_or_404(AdVISEConnection, id=self.kwargs['pk'])

    def create(self, request, *args, **kwargs):
        logger.debug(request.data)

        g = get_object_or_404(Group, groupprofile__uuid=request.data['group'])

        connection = AdVISEConnection(
            group = g,
            url = request.data['url'],
            external_key= request.data['external_key'],
            created_by = self.request.user)

        if request.data.get('incoming_api_key'):
            #lookup
            tokens = APIToken.objects.filter(last_four = request.data['incoming_api_key'])
            token = tokens.filter(user__groups__id=g.id)
            if len(token) != 1:
                return Response({'detail': f'API Token lookup returned {len(token)} results.'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                token = token[0]
                connection.incoming_key = token;
        connection.save()
        return Response({}, status=status.HTTP_202_ACCEPTED)

    def update(self, request, *args, **kwargs):
        logger.debug(request.data)
        connection = self.get_object()

        if request.data.get('disabled'):
            connection.disabled=False
            connection.save()
            return Response({}, status=status.HTTP_202_ACCEPTED)

        g = get_object_or_404(Group, groupprofile__uuid=request.data['group'])
        connection.group = g
        connection.url = request.data['url']
        connection.external_key= request.data['external_key']

        if request.data.get('incoming_api_key'):
            #lookup
            tokens = APIToken.objects.filter(last_four = request.data['incoming_api_key'])
            token = tokens.filter(user__groups__id=g.id)
            if len(token) != 1:
                return Response({'detail': f'API Token lookup returned {len(token)} results.'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                token = token[0]
                connection.incoming_key = token;
        connection.save()
        return Response({}, status=status.HTTP_202_ACCEPTED)


    def destroy(self, request, *args, **kwargs):
        connection = get_object_or_404(AdVISEConnection, id=self.kwargs['pk'])
        connection.disabled = True
        connection.save()
        return Response({}, status=status.HTTP_202_ACCEPTED)


class ResolutionAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)
    serializer_class = ResolutionSerializer

    def get_queryset(self):
        return CaseResolutionOptions.objects.all()

    def create(self, request, *args, **kwargs):
        logger.debug(request.data)
        if not is_coordinator_mgr(request.user):
            #only staff members can create new options
            raise PermissionDenied
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)


    def destroy(self, request, *args, **kwargs):
        question = get_object_or_404(CaseResolutionOptions, id=self.kwargs['pk'])
        if not is_coordinator_mgr(request.user):
            #only staff members can delete
            raise PermissionDenied
        question.delete()
        return Response({}, status=status.HTTP_202_ACCEPTED)



class VulAttributesAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordOrAnalystPermission)
    serializer_class = VulAttributesSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['attribute']
    search_fields = ['attribute', 'description']

    def get_queryset(self):
        return VulAttributeKey.objects.all()

    def create(self, request, *args, **kwargs):
        logger.debug(request.data)
        
        if not (is_coordinator_mgr(request.user) or is_analyst_mgr(request.user)):
            raise PermissionDenied
        
        serializer = VulAttributesSerializer(data=request.data)

        if serializer.is_valid():
            newattr, created = VulAttributeKey.objects.update_or_create(attribute = request.data['attribute'],
                                                                        defaults = {
                                                                            'user': self.request.user,
                                                                            'description': request.data.get('description')})
            if created:
                return Response({'detail': 'Attribute successfully created'}, status=status.HTTP_202_ACCEPTED)
            else:
                return Response({'detail': 'Attribute updated successfully'}, status=status.HTTP_202_ACCEPTED)
            
        else:
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        tag = get_object_or_404(VulAttributeKey, id=self.kwargs['pk'])
        if not (is_coordinator_mgr(request.user) or is_analyst_mgr(request.user)):
            #only staff members can delete
            raise PermissionDenied
        tag.delete()
        return Response({}, status=status.HTTP_202_ACCEPTED)

    
class TagAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorMgrPermission)
    serializer_class = TagCategorySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['category']
    search_fields = ['tag', 'description']

    def get_queryset(self):
        return DefinedTag.objects.all()

    def get_serializer_class(self):
        if self.action == 'list':
            if self.request.query_params.get('category') or self.request.query_params.get('search'):
                return TagSerializer
            return TagCategorySerializer
        if self.action == 'create':
            return TagSerializer
        return TagSerializer

    def create(self, request, *args, **kwargs):
        logger.debug(request.data)
        serializer = TagSerializer(data=request.data)

        if serializer.is_valid():

            logger.debug(dict(DefinedTag.TAG_CATEGORY).values())
            cat_int = list(dict(DefinedTag.TAG_CATEGORY).values()).index(request.data['category'])
            newtag, created = DefinedTag.objects.update_or_create(tag=request.data['tag'],
                                                                  category=cat_int+1,
                                                                  defaults = {
                                                                      'user': self.request.user,
                                                                      'description': request.data.get('description')})
            if created:
                return Response({'detail': 'Tag successfully created'}, status=status.HTTP_202_ACCEPTED)
            else:
                return Response({'detail': 'Tag updated successfully'}, status=status.HTTP_202_ACCEPTED)

        else:
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        tag = get_object_or_404(DefinedTag, id=self.kwargs['pk'])
        if not(request.user.is_staff):
            #only staff members can delete
            raise PermissionDenied
        tag.delete()
        return Response({}, status=status.HTTP_202_ACCEPTED)

class CSAFProfilesAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)
    serializer_class = CSAFProfileSerializer

    def get_queryset(self):
        return CSAFProfile.objects.all()


    def create(self, request, *args, **kwargs):

        logger.debug(f"{self.__class__.__name__} post: {request.data}")
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            profile = serializer.save()
            profile.created_by = self.request.user
            profile.save()
            # TO DO: ADD group info
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        logger.debug(f"{self.__class__.__name__} patch: {request.data}")
        instance = self.get_object()
        data = request.data
        serializer = self.serializer_class(instance=instance, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)


    def destroy(self, request, *args, **kwargs):
        profile = get_object_or_404(CSAFProfile, id=self.kwargs['pk'])

        if (profile.created_by == self.request.user or is_coordinator_mgr(self.request.user)):
            profile.delete()

        return Response({}, status=status.HTTP_202_ACCEPTED)

class TriageCalendarMetaAPIView(APIView):
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)
    serializer_class = TriageCalendarSerializer

    def get_view_name(self):
        return "Triage Calendar Events API"

    def get(self, request, *args, **kwargs):
        context = {}

        groups = my_coord_teams(self.request.user)
        if self.request.GET.get('team'):
            if groups.filter(name=self.request.GET.get('team')).exists():
                context['group'] = groups.filter(name=self.request.GET['team']).first()
            elif is_in_lead_coord_team(self.request.user):
                
                context['group'] = Group.objects.filter(name=self.request.GET['team']).first()
                if context['group'].groupprofile.vendor_type != "Coordinator":
                    return Response({'team': 'invalid team'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                raise PermissionDenied()
        else:
            context['group'] = groups.first()
               
        coordinators =  User.objects.filter(is_active=True, api_account=False, groups__name=context['group'].name)
        context['users'] = coordinators.filter(groups__name__in=['coordinator', 'coordinator_mgr']).distinct('id')

        serializer = self.serializer_class(context)
        return Response(serializer.data)

class TriageCalendarEventAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, CoordinatorPermission)
    serializer_class = TriageCalendarEventSerializer        

    def get_queryset(self):

        end = datetime.now(pytz.utc)
        start = datetime.now(pytz.utc) - timedelta(days=30)

        if self.request.GET.get('start') and self.request.GET.get('end'):
            start = datetime.fromisoformat(self.request.GET.get('start'))
            end = datetime.fromisoformat(self.request.GET.get('end'))

        #end should be the end of the day
        end = end.date()+timedelta(days=1)
        start= start.date()

        groups = my_coord_teams(self.request.user)
        group = None
        if self.request.GET.get('team'):
            if groups.filter(name=self.request.GET.get('team')).exists():
                group = groups.filter(name=self.request.GET['team']).first()
            elif is_in_lead_coord_team(self.request.user):

                group = Group.objects.filter(name=self.request.GET['team']).first()
                if group.groupprofile.vendor_type != "Coordinator":
                    return Response({'error': 'invalid team name'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                raise PermissionDenied()
        else:
            group = groups.first()

        if group:
            return TriageCalendarEvent.objects.filter(coord_team=group).filter(Q(date__range=(start,end))|Q(end_date__range=(start,end)))
        return TriageCalendarEvent.objects.none()

    def create(self, request, *args, **kwargs):
        logger.debug(f"{self.__class__.__name__} post: {request.data}")
        user_input = request.data
        try:
            user_input['title'] = list(dict(TriageCalendarEvent.EVENT_CHOICES).values())[int(request.data['event_id'])-1]
        except:
            return Response({'error': 'Invalid event_id (event type)'},
                            status=status.HTTP_400_BAD_REQUEST)
        if (not user_input.get('assign_user')):
            user_input['assign_user'] = self.request.user.id
            user_input['user'] = self.request.user
            if request.data.get('coord_team'):
                user_input['coord_team'] = Group.objects.filter(name=request.data['coord_team']).first()
            else:
                user_input['coord_team'] = my_coord_teams(user_input['user']).first()

            if not self.request.user.groups.filter(id=user_input['coord_team'].id).exists():
                return Response({'error': 'You are not a member of this coordination team.'},
                            status=status.HTTP_400_BAD_REQUEST)
                
        else:
            user_input['user'] = get_object_or_404(User, id=user_input.get('assign_user'))
            if request.data.get('coord_team'):
                user_input['coord_team'] = Group.objects.filter(name=request.data['coord_team']).first()
            else:
                user_input['coord_team'] = my_coord_teams(user_input['user']).first()

            if not user_input['user'].groups.filter(id=user_input['coord_team'].id).exists():
                return Response({'error': 'User is not a member of coordiantion team.'},
                            status=status.HTTP_400_BAD_REQUEST)

        if not is_in_lead_coord_team(self.request.user):
            #make sure user is in assigning group
            if not self.request.user.groups.filter(id=user_input['coord_team'].id).exists():
                raise PermissionDenied()
            
            
        if not user_input['coord_team']:
            return Response({'error': 'Coordination team not provided'}, status=status.HTTP_400_BAD_REQUEST)
        logger.debug(user_input)
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            event, created = TriageCalendarEvent.objects.update_or_create(date = serializer.validated_data['date'],
                                                         event_id = serializer.validated_data['event_id'],
                                                         user=user_input['user'],
                                                         coord_team=user_input['coord_team'],
                                                         defaults={
                                                             'title':serializer.validated_data['title'],
                                                             'user_added':self.request.user})
            serialized = self.serializer_class(instance=event)
            
            return Response(serialized.data, status=status.HTTP_202_ACCEPTED)

        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, **kwargs):
        instance = get_object_or_404(TriageCalendarEvent, id=self.kwargs['pk'])
        data = request.data
        logger.debug(request.data)

        if instance.user_added != self.request.user and instance.user != self.request.user:
            if not is_in_lead_coord_team(self.request.user):
                raise PermissionDenied


        if request.data.get('user'):
            instance.user = get_object_or_404(User, id=request.data['user'])
            if not instance.user.groups.filter(id=instance.coord_team.id).exists():
                return Response({'error': 'User is not a member of coordiantion team.'},
                            status=status.HTTP_400_BAD_REQUEST)
            instance.save()
        if request.data.get('event_id'):
            data['title'] = list(dict(TriageCalendarEvent.EVENT_CHOICES).values())[int(request.data['event_id'])-1]
        logger.debug(data)
        serializer = self.serializer_class(instance=instance, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
        return Response(serializer.errors,
                        status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        question = get_object_or_404(TriageCalendarEvent, id=self.kwargs['pk'])
        question.delete()
        return Response({}, status=status.HTTP_202_ACCEPTED)
