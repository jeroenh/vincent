from django.shortcuts import render
import logging
import os
from io import StringIO
from django.shortcuts import render, redirect, get_object_or_404
from django.core.files.base import ContentFile
from django.contrib import messages
from django.core.exceptions import PermissionDenied
from django.core.management import call_command
from django.urls import reverse, reverse_lazy
from django.views import generic, View
from django.utils.timesince import timesince
from rest_framework import filters
from django.views.generic.edit import FormView, UpdateView, FormMixin, CreateView
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.forms.models import inlineformset_factory
from authapp.views import PendingTestMixin
from django.http import HttpResponse, Http404, JsonResponse, HttpResponseNotAllowed, HttpResponseServerError, HttpResponseForbidden, HttpResponseRedirect, HttpResponseBadRequest
from authapp.models import User
from django.utils.safestring import mark_safe
import traceback
import re
from cvdp.manage.forms import *
from rest_framework.pagination import PageNumberPagination
from rest_framework import exceptions, generics, status, authentication, viewsets, mixins, filters
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.filters import OrderingFilter
import django_filters
import tempfile

from cvdp.permissions import *
from cvdp.components.serializers import *
from cvdp.components.forms import *
from cvdp.lib import create_case_action, send_vendor_status_update_email
from django.db.models import Count, F, Q

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

def _my_products(user):
    my_groups = user.groups.all()
    return Product.my_products(my_groups)

def _my_components(user):
    my_groups = user.groups.all()
    return Product.objects.filter(supplier__in=my_groups, component__deleted=False)

def _my_deleted_products(user):
    my_groups = user.groups.all()
    return Product.objects.filter(supplier__in=my_groups, component__parent=True, component__deleted=True)

def _find_version(name):
    m = re.search(r"(?:(\d+)\.)?(?:(\d+)\.)?(\*|\d+)$", name)
    if m:
        return m.group(0)
    else:
        return "0.0"

def _my_case_components(user, case):
    my_groups = user.groups.all()
    #get case participants
    my_part_groups = CaseParticipant.objects.filter(case=case, group__in=my_groups).values_list('group__id', flat=True)
    return Product.objects.filter(supplier__in=my_part_groups, component__deleted=False)

#components is a queryset of components this user has access to
# that have the component name specified, but we need to get a little more specific

def _find_component(components, data):

    if components:
        c = components.filter(version=data['version'])
        if c:
            return c.first()
        else:
            c = components.filter(version__isnull=True).first()
            if c:
                c.version = data['version']
                c.save()
                return c
    return None


def _is_my_component(user, component):
    if is_coordinator(user):
        return True
    my_groups=user.groups.all()
    return Product.objects.filter(component=component, supplier__in=my_groups).exists()


def create_component_action(title, user, comp, action):
    action = ComponentAction(component = comp,
                             user=user,
                             title=title,
                             action_type=action,
                             created=timezone.now())
    action.save()
    return action


def create_component_change(action, field, old_value, new_value):

    if (not old_value and not new_value):
        return

    change = ComponentChange(action=action,
                             field = field,
			     old_value=old_value,
                             new_value=new_value)
    change.save()
    return change


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

class StandardResultsPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size= 100


def create_component_with_versions(serializer, data, user):
    supplier = None
    parent = None
    versions = []
    versions_added = 0
    components_created = []

    if (data.get('owner')):
        supplier = get_object_or_404(Group, groupprofile__uuid=data['owner'])
    #else:
    #    return Response({"detail": f"owner is required"}, status=status.HTTP_400_BAD_REQUEST)

    if data.get('version'):
        versions = [data['version']]
    elif data.get('versions'):
        versions = data['versions']

    #get parent component, if one exists
    ex_parent = Product.objects.filter(component__name__iexact=data['name'], supplier=supplier, component__parent=True).first()
    if not ex_parent:
        parent = Component(**serializer.validated_data, added_by=user, parent=True)
        parent.version = ""
        parent.save()
        new_component = Product.objects.create(component=parent, supplier=supplier)
        create_component_action(f"created component", user, parent, 1)
        components_created.append(new_component)
    else:
        new_component = ex_parent

    if 'tags' in data and is_coordinator(user):
        existing_tags = ComponentTag.objects.filter(component=parent)
        if len(existing_tags) > 0:
            for tag in existing_tags:
                if tag not in data['tags']:
                    rmtag = ComponentTag.objects.filter(component=parent, tag=tag).first()
                    rmtag.delete()

        for tag in data['tags']:
            if DefinedTag.objects.filter(tag=tag, category=4).exists():
                tag, created = ComponentTag.objects.update_or_create(component=parent, tag=tag,
                                                                     defaults={'user':user})

    #TODO - how about removing versions?
    if versions:
        logger.debug("IN VERSIONS")
        for version in versions:
            if version:
                logger.debug(f"adding version {version}")
                comp = Product.objects.filter(component__name__iexact=data['name'], component__version=version, supplier=supplier).first()
                if comp:
                    continue
                else:
                    new_version = new_component.component
                    new_version.pk = None   # this sets the pk to none so it copies the instance and then we change version
                    new_version.added_by = user
                    new_version.version = version
                    new_version.parent = False
                    new_version.save()
                    new_prod = Product.objects.create(supplier=supplier, component=new_version)
                    versions_added = versions_added + 1
                    create_component_action(f"created component", user, new_version, 1)
                    components_created.append(new_prod)

    if versions_added > 0:
        create_component_action(f"created component with {versions_added} versions", user, new_component.component, 1)
    elif new_component == ex_parent:
        #nothing was added because name/version/supplier already exists
        if new_component.component.deleted:
            #TODO: PROVIDE RESTORE PATH
            return []
            return Response({"detail": f"A component( (name/supplier) alreay exists but has been removed."}, status=status.HTTP_400_BAD_REQUEST)
        return []

    return components_created


class ComponentAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, GroupLevelWritePermission)
    serializer_class = ProductSerializer
    search_fields = ['component__name', 'component__supplier', 'supplier__name', 'component__comment', 'component__tags__tag']
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    pagination_class = StandardResultsPagination
    ordering_fields = ['component__name', 'component__supplier', 'supplier__name', 'component__modified']

    def get_serializer_class(self, *args, **kwargs):
        if self.request.method == 'POST':
            return ComponentDetailSerializer
        return ProductSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({"groups": self.request.user.groups.all().values_list('id', flat=True),
                        "coordinator": is_coordinator(self.request.user)})
        return context

    def get_object(self):
        return get_object_or_404(Product, component__id=self.kwargs['pk'])
        #if _is_my_component(self.request.user, obj.component):
        #return obj
        #else:
        #raise PermissionDenied()

    def get_view_name(self):
        return f"Product Component View"


    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Product.objects.none()

        query_params = self.request.query_params

        #tags = DefinedTag.objects.filter(tag__icontains=search, category=4).values_list('tag', flat=True)
        #compTag = []
	#if (tags and search):
            #compTag = ComponentTag.objects.filter(tag__in=tags).distinct('tag').values_list('tag', flat=True)

        if "deleted" in query_params:
            if is_coordinator(self.request.user):
                prods = Product.deleted_products().distinct('component__name', 'supplier')
            else:
                prods = _my_deleted_products(self.request.user)


        elif "deps" in query_params:
            #get all dependencies of all versions of all my products
            my_prods = _my_components(self.request.user).exclude(dependencies__isnull=True).values_list('dependencies__id', flat=True)
            prods = Product.objects.filter(component__id__in=my_prods)

        elif "case" in query_params:
            my_prods = _my_components(self.request.user).values_list('component__id', flat=True)
            status = ComponentStatus.objects.filter(component__id__in=my_prods).values_list('component__id', flat=True)
            prods = Product.objects.filter(component__id__in=status)

        elif "my" in query_params:
            if is_coordinator(self.request.user):
                prods = Product.all_products()
            else:
                prods = _my_products(self.request.user)
        else:
            prods = Product.all_products()

        if 'ordering' in query_params:
            return prods

        else:
            return prods.distinct('component__name', 'supplier')


    def create(self, request, *args, **kwargs):
        logger.debug(request.data)
        owner = request.data.get('owner')
        if not(is_coordinator(request.user)):
            if not owner:
                return Response({"owner": f"valid owner is required"}, status=status.HTTP_400_BAD_REQUEST)
            group = get_object_or_404(Group, groupprofile__uuid=owner)
            self.check_object_permissions(self.request, group)

        serializer = ComponentDetailSerializer(data=request.data)
        if serializer.is_valid():

            components = create_component_with_versions(serializer, request.data, self.request.user)

            if not components:
                return Response({"data": f"component (name/supplier) already exists"}, status=status.HTTP_400_BAD_REQUEST)

            if request.data.get('clone'):
                #clone all dependencies of old component to ALL VERSIONS of new component
                old_comp = Product.objects.filter(component__id=request.data['clone']).first()
                #get all versions of new component
                new_component_versions = Product.other_versions(components[0])

                if old_comp:
                    logger.debug(f"COPYING {old_comp.dependencies.count()}")
                    if (old_comp.dependencies.count() > 0):
                        for dep in old_comp.dependencies.all():
                            for v in new_component_versions:
                                v.dependencies.add(dep)
                                action = create_component_action(f"added dependency {dep} to cloned component", self.request.user, v.component, 4)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)
        return Response({}, status=status.HTTP_202_ACCEPTED)


    def destroy(self, request, *args, **kwargs):
        #TODO: should vendors be able to remove their own components? Maybe ones they have added?
        if not(is_coordinator(request.user)):
            raise PermissionDenied()
        component = get_object_or_404(Component, id=self.kwargs['pk'])
        comp_status = False
        #is this the parent component? if so, "delete" other versions?
        if component.parent:
            other_versions = Product.objects.filter(component__name=component.name, supplier=component.product_info.supplier).exclude(id=self.kwargs['pk'])
            for x in other_versions:
                action = create_component_action(f"removed version {x.component.version} of this component", self.request.user, x.component, 5)
                if ComponentStatus.objects.filter(component=x.component).exists():
                    x.component.deleted = True
                    x.component.save()
                    comp_status = True
                    action = create_component_action(f"removed this component", self.request.user, component, 5)
                else:
                    x.component.delete()
                    #TODO - log actual deletion
        else:
            #get parent component
            action = create_component_action(f"removed version {component.version} of this component", self.request.user, component, 5)
            comp_status = ComponentStatus.objects.filter(component=component).exists()

        if comp_status:
            component.deleted = True
            component.save()
        else:
            #if no status, just remove
            component.delete()

        return Response({}, status=status.HTTP_202_ACCEPTED)

    def update(self, request, **kwargs):
        instance = self.get_object()

        if not(is_coordinator(request.user)):
            if instance.supplier:
                self.check_object_permissions(self.request, instance.supplier)
            else:
                raise PermissionDenied()

        data = request.data
        logger.debug(request.data)

        if request.data.get('version'):
            versions = [request.data['version']]
        elif request.data.get('versions'):
            versions = request.data['versions']
        else:
            versions = [instance.component.version]

        name = data.get('name', instance.component.name)

        versions_added = 0

        if 'tags' in request.data and is_coordinator(request.user):
            existing_tags = ComponentTag.objects.filter(component=instance.component)
            if len(existing_tags) > 0:
                for tag in existing_tags:
                    if tag not in data['tags']:
                        rmtag = ComponentTag.objects.filter(component=instance.component, tag=tag).first()
                        rmtag.delete()

            for tag in data['tags']:
                if DefinedTag.objects.filter(tag=tag, category=4).exists():
                    tag, created = ComponentTag.objects.update_or_create(component=instance.component, tag=tag,
	                                                                 defaults={'user':self.request.user})
                else:
                    return Response({'tag': f"Tag {tag} does not exist."}, status=status.HTTP_400_BAD_REQUEST)

        if request.data.get('owner'):
            logger.debug("supplier present")
            supplier = get_object_or_404(Group, groupprofile__uuid=request.data['owner'])
        else:
            supplier = None

        serializer = ComponentDetailSerializer(instance=instance.component, data=data, partial=True)

        if serializer.is_valid():

            if (name != instance.component.name):
                #something changed, so check to see if new tuple already exists
                comp = Product.objects.filter(component__name=name, supplier=supplier).first()
                if comp:
                    error_msg = 'component already exists with name/supplier'
                    if comp.component.deleted:
                        error_msg = 'A deleted component already exists with name/supplier.'
                    return Response({'data': error_msg}, status=status.HTTP_400_BAD_REQUEST)
            if (supplier != instance.supplier):
                #ownership is being change, so check to see if this prod exists in the new supplier
                if supplier:
                    comp = Product.objects.filter(component__name__iexact=name, supplier=supplier).first()
                    if comp:
                        logger.debug(comp)
                        return Response({'data': 'component already exists with name/supplier'}, status=status.HTTP_400_BAD_REQUEST)
                if supplier and instance.supplier:
                    action_title = f"changed ownership from {instance.supplier.name} to {supplier.name}"
                elif supplier:
                    action_title = f"added owner {supplier.name}"
                else:
                    action_title = f"removed owner {instance.supplier.name}"
                if (instance.component.parent):
                    #change ownership of all versions
                    all_versions = Product.other_versions(instance)
                    for ov in all_versions:
                        action = create_component_action(action_title, self.request.user, ov.component, 2)
                        ov.supplier = supplier
                        ov.save()
                        if not ov.component.supplier and supplier:
                            ov.component.supplier = supplier.name
                            ov.component.save()
                else:
                    action = create_component_action(action_title, self.request.user, instance.component, 2)
                    instance.supplier=supplier
                    instance.save()
                    if not instance.component.supplier:
                        instance.component.supplier=supplier.name
                        instance.save()

            #check other fields for changes
            action = None
            for field, val in data.items():

                try:
                    oldval = getattr(instance.component, field)
                except AttributeError:
                    continue

                if (val != oldval):
                    if not action:
                        #only create the action if there is a change
                        action = create_component_action("modified component", self.request.user, instance.component, 2)
                    create_component_change(action, field, getattr(instance.component, field), val);

            serializer.save()


            #multiple versions
            for version in versions:
                if version:
                    logger.debug(f"checking for version {version} for {instance.component.name}")
                    comp = Product.objects.filter(component__name__iexact=name, supplier=supplier, component__version=version).first()
                    if comp:
                        logger.debug(f"version {version} already exists for {instance.component.name}")
                        continue
                    else:
                        #add version
                        #get the object
                        prod = self.get_object()
                        comp = prod.component
                        comp.pk = None   # this sets the pk to none so it copies the instance and then we change version
                        comp.added_by = self.request.user
                        comp.version = version
                        comp.parent = False
                        comp.save()
                        versions_added = versions_added + 1
                        Product.objects.create(supplier=supplier, component=comp)

            if versions_added:
                action = create_component_action(f"added {versions_added} version to component", self.request.user, instance.component, 2)


            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

class ComponentDetailView(LoginRequiredMixin, UserPassesTestMixin, generic.DetailView):
    model = Component
    login_url = "authapp:login"
    template_name = "cvdp/component.html"

    def test_func(self):
        component = self.get_object()
        return is_my_component(self.request.user, component)


    def get_object(self, queryset=None):
        return Component.objects.get(id=self.kwargs['pk'])



class DependencyAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission)
    serializer_class = DependencySerializer
    search_fields = ['component__name', 'component__product_info__supplier__name', 'component__comment', 'component__version', 'component__supplier']
    pagination_class = StandardResultsPagination

    def get_view_name(self):
        return f"List Component Dependencies"

    def get_serializer_class(self, *args, **kwargs):
        if self.request.method == 'POST':
            return DependencySerializer
        return ComponentRelationshipSerializer

    def get_object(self):
        product = get_object_or_404(Product, component__id=self.kwargs['pk'])
        if _is_my_component(self.request.user, product.component):
            return product
        else:
            raise PermissionDenied()

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Component.objects.none()

        instance = self.get_object()
        if instance.component.parent:
            #get all dependencies for all versions + de-duplicate
            all_versions = Product.objects.filter(component__name=instance.component.name, component__deleted=False)
            if instance.supplier:
                all_versions = all_versions.filter(supplier=instance.supplier)
            else:
                all_versions = all_versions.exclude(supplier__isnull=False)
            ret = all_versions.values_list('id', flat=True)

            return ComponentRelationship.objects.filter(product__in=ret).distinct('component__name', 'component__product_info__supplier').order_by('component__name', 'component__product_info__supplier')

        return instance.componentrelationship_set.all().order_by('component__name')

    def update(self, request, **kwargs):
        #get component
        logger.debug("IN UPDATE COMPONENT -PRODUCT API VIEW")
        logger.debug(self.kwargs['pk'])
        instance = self.get_object()

        logger.debug(request.data)
        #get dependency
        dependency = get_object_or_404(Component, id=request.data.get('dependency'))
        if instance.component.parent:
            #we want to add this dependency to all versions
            all_versions = Product.other_versions(instance)
        else:
            all_versions = [instance]

        if request.data.get('remove'):
            for v in all_versions:
                action = create_component_action(f"removed dependency {dependency}", self.request.user, v.component, 5)
                v.dependencies.remove(dependency)
        else:
            if instance.component == dependency:
                return Response({'detail': 'You can not add this component as a dependency of itself.'}, status=status.HTTP_400_BAD_REQUEST)
            for v in all_versions:
                action = create_component_action(f"added dependency {dependency}", self.request.user, v.component, 4)
                v.dependencies.add(dependency)

        return Response({}, status=status.HTTP_202_ACCEPTED)


class GroupComponentsAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission, GroupLevelPermission)
    serializer_class = ProductSerializer
    search_fields = ['component__name', 'supplier__name', 'component__comment']
    pagination_class = StandardResultsPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ['component__name', 'component__supplier', 'supplier__name', 'component__modified']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Component.objects.none()

        group = get_object_or_404(Group, groupprofile__uuid=self.kwargs['group'])
        self.check_object_permissions(self.request, group)

        query_params = self.request.query_params
        if 'ordering' in query_params:
            return Product.objects.filter(supplier=group, component__parent=True, component__deleted=False)

        else:
            return Product.objects.filter(supplier=group, component__parent=True, component__deleted=False).distinct('component__name')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({"groups": self.request.user.groups.all().values_list('id', flat=True),
                        "coordinator":is_coordinator(self.request.user)})
        return context

    def get_serializer_class(self, *args, **kwargs):
        if self.request.method == 'POST':
            return ComponentDetailSerializer
        return ProductSerializer

    def get_view_name(self):
        group = get_object_or_404(Group, groupprofile__uuid=self.kwargs['group'])
        return f"{group.name}'s Components"

    def create(self, request, *args, **kwargs):
        logger.debug(request.data)
        group = get_object_or_404(Group, groupprofile__uuid=self.kwargs['group'])
        self.check_object_permissions(self.request, group)

        if request.data.get('owner') != self.kwargs['group']:
            request.data['owner'] = self.kwargs['group']

        sc = self.get_serializer_class()
        serializer = sc(data=request.data)
        if serializer.is_valid():
            #does component already exist?

            components = create_component_with_versions(serializer, request.data, self.request.user)

            if not components:
                return Response({"detail": f"component (name/supplier) already exists"}, status=status.HTTP_400_BAD_REQUEST)


        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)
        return Response({}, status=status.HTTP_202_ACCEPTED)


"""
Components Views - React app "componentapp"
"""
class ComponentView(LoginRequiredMixin, UserPassesTestMixin, generic.TemplateView):
    template_name="cvdp/components.html"
    login_url = "authapp:login"

    def test_func(self):
        if is_coordinator(self.request.user):
            return True
        elif self.request.user.groups.count():
            return True
        return False

    def get(self, request, *args, **kwargs):
        return render(request, self.template_name, {'componentspage': 1})

class AddComponentView(LoginRequiredMixin, PendingTestMixin, FormView):
    template_name = "cvdp/addcomponent.html"
    login_url = "authapp:login"
    form_class = AddComponentForm

    def get_success_url(self):
        return reverse_lazy("cvdp:components")

    def get_context_data(self, **kwargs):
        context = super(AddComponentView, self).get_context_data(**kwargs)
        if self.kwargs.get('pk'):
            component = get_object_or_404(Component, id=self.kwargs['pk'])
            context['form'] = AddComponentForm(instance=component)
        return context


    def form_valid(self, form):
        c = form.save()
        action = create_component_action(f"created component", self.request.user, c, 1)
        messages.success(
            self.request,
            "Got it! Your component has been added."
        )
        return super().form_valid(form)

class ChangeComponentOwnershipView(LoginRequiredMixin, PendingTestMixin, FormView):
    http_method_names=['post']
    template_name="cvdp/notemplate.html"
    login_url="authapp:login"

    def post(self, request, *args, **kwargs):
        logger.debug(f"{self.__class__.__name__} post: {self.request.POST}")
        #get group
        if self.request.POST.get('group') and self.request.POST.get('components[]'):
            group = get_object_or_404(Group, groupprofile__uuid=self.request.POST['group'])
            # check permissions
            if is_coordinator(self.request.user) or self.request.user.groups.filter(id=group.id).exists():
                for c in self.request.POST.getlist('components[]'):
                    product = get_object_or_404(Product, component__id=c)
                    if (product.component.parent):
                        #get other versions
                        all_versions = Product.other_versions(product)
                        for ov in all_versions:
                            # update product
                            action = create_component_action(f"modified component owner", self.request.user, ov.component, 2)
                            create_component_change(action, "owner", ov.component.get_vendor(), group.name)
                            ov.supplier=group
                            ov.save()
                            if not ov.component.supplier:
                                #if no supplier, add group as supplier
                                ov.component.supplier=group.name
                                ov.component.save()
                return JsonResponse({}, status=status.HTTP_202_ACCEPTED)
            else:
                raise PermissionDenied()

        return JsonResponse({'message': 'missing required values'}, status=status.HTTP_400_BAD_REQUEST)


class ComponentStatusTableView(viewsets.ModelViewSet):
    serializer_class = ComponentStatusSerializer
    pagination_class = StandardResultsPagination
    search_fields = ['component__name', 'component__product_info__supplier__name']

    def get_view_name(self):
        return f"Case Component Table Status"

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({"user": self.request.user})
        return context

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return ComponentStatus.objects.none()
        case = get_object_or_404(Case, case_id = self.kwargs['caseid'])
        if not is_my_case(self.request.user, case.id):
            raise PermissionDenied()
        sort_by = self.request.query_params.get('ordering', '')
        #which components should we return here? if coordinator, return all
        if 'modified' in sort_by:
            order_sort_by = f'-{sort_by}'
            #TODO - this may be a different serializer so we're not showing duplicates
            components = ComponentStatus.objects.filter(vul__case=case).distinct(sort_by, 'component__name', 'component__product_info__supplier').order_by(order_sort_by, 'component__name', 'component__product_info__supplier')
        elif 'supplier' in sort_by:
            components = ComponentStatus.objects.filter(vul__case=case).distinct('component__product_info__supplier', 'component__name').order_by('component__product_info__supplier', 'component__name')
        else:
            components = ComponentStatus.objects.filter(vul__case=case).distinct('component__name', 'component__product_info__supplier').order_by('component__name', 'component__product_info__supplier')
        if is_coordinator(self.request.user):
            return components
        else:
            #get my components
            #get all case components
            case_components = components.values_list('component__id', flat=True)
            my_groups = my_case_vendors(self.request.user, case)
            if my_groups:
                products = Product.objects.filter(supplier__in=my_groups, component__in=case_components).values_list('component__id', flat=True)
                return components.filter(component__id__in=products)
            else:
                return components.filter(current_revision__user=self.request.user)


class ApproveStatusAPIView(generics.UpdateAPIView):
    serializer_class = StatusApprovalSerializer

    def update(self, request, **kwargs):
        logger.debug(f"{self.__class__.__name__} post: {self.request.data}")
        if self.kwargs.get('case_id'):
            case = get_object_or_404(Case, case_id = self.kwargs['case_id'])
            if not(is_case_owner(self.request.user, case.id)):
                raise PermissionDenied()

            serializer = StatusApprovalSerializer(data=request.data)
            if serializer.is_valid():
                # get all unapproved status */
                compstatus = ComponentStatus.objects.filter(vul__case=case, current_revision__approved=False)
                actions = []
                for ca in compstatus:
                    ca.current_revision.approved = True
                    ca.current_revision.save()
                    actions.append(f"revision {ca.current_revision.revision_number} for {str(ca)}")

                actions = create_case_action(f"approved the following component status revisions {', '.join(actions)}", self.request.user, ca.vul.case)
                return Response({}, status=status.HTTP_202_ACCEPTED)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


        ca = get_object_or_404(ComponentStatus, id=self.kwargs['pk'])

        if not(is_case_owner(self.request.user, ca.vul.case.id)):
            raise PermissionDenied()

        serializer = StatusApprovalSerializer(data=request.data)
        if serializer.is_valid():
            ca.current_revision.approved = True
            ca.current_revision.save()

            action = create_case_action(f"approved component status revision {ca.current_revision.revision_number} for {str(ca)}", request.user, ca.vul.case)
            return Response({}, status=status.HTTP_202_ACCEPTED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)




class SpecialOrderingFilter(OrderingFilter):
    def get_ordering(self, request, queryset, view):
        ordering = super(SpecialOrderingFilter, self).get_ordering(request, queryset, view)

        if ordering is None:
            return ('component__name', 'component__product_info__supplier')
        else:
            return ['component__name', 'component__product_info__supplier'] + list(ordering)


def check_remediation_available(status):

    for stat in status.current_revision.version_status:
        if stat.get('remediation_category') == "vendor_fix":
            return True

    return False


class ComponentStatusAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission)
    serializer_class = StatusSummarySerializer
    pagination_class = StandardResultsPagination
    search_fields = ['component__name', 'component__product_info__supplier__name']
    filterset_fields = ['current_revision__approved']
    #filter_backends = [SpecialOrderingFilter]
    #ordering_fields = ['current_revision__modified', 'component__name', 'component__product_info__supplier', 'vul__vul']
    #ordering = ['component__name', 'component__product_info__supplier']

    def get_serializer_class(self, *args, **kwargs):
        if self.request.method in ['POST', 'PATCH']:
            return StatusSerializer
        return StatusSummarySerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({"user": self.request.user})
        return context

    def get_view_name(self):
        return f"Case Component Status"

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return ComponentStatus.objects.none()
        if self.kwargs.get('pk'):
            cs = get_object_or_404(ComponentStatus, id=self.kwargs['pk'])
            case = cs.vul.case
        else:
            case = get_object_or_404(Case, case_id = self.kwargs['caseid'])
        if not is_my_case(self.request.user, case.id):
            raise PermissionDenied()
        sort_by = self.request.query_params.get('ordering', '')
        #which components should we return here? if coordinator, return all
        if 'modified' in sort_by:
            order_sort_by = f'-{sort_by}'
            #TODO - this may be a different serializer so we're not showing duplicates
            components = ComponentStatus.objects.filter(vul__case=case).distinct(sort_by, 'component__name', 'component__product_info__supplier').order_by(order_sort_by, 'component__name', 'component__product_info__supplier')
        elif 'supplier' in sort_by:
            components = ComponentStatus.objects.filter(vul__case=case).distinct('component__product_info__supplier', 'component__name').order_by('component__product_info__supplier', 'component__name')
        else:
            components = ComponentStatus.objects.filter(vul__case=case).distinct('component__name', 'component__product_info__supplier').order_by('component__name', 'component__product_info__supplier')
        if is_case_owner(self.request.user, case.id):
            return components
        else:
            #get my components
            #get all case components
            case_components = components.values_list('component__id', flat=True)
            my_groups = my_case_vendors(self.request.user, case)
            if my_groups:
                products = Product.objects.filter(supplier__in=my_groups, component__in=case_components).values_list('component__id', flat=True)
                return components.filter(Q(component__id__in=products) | Q(share=True))
            else:
                return components.filter(Q(current_revision__user=self.request.user) | Q(share=True))


    def check_component(self, component, user, role):

        if component.get('id'):
            existing_component = Component.objects.filter(id=component['id']).first()
            if not existing_component:
                return None, {'detail': 'invalid component id for other component'}, status.HTTP_400_BAD_REQUEST, False
            if existing_component.product_info.supplier:
                if existing_component.product_info.supplier.groupprofile.uuid == component.get('owner'):
                    #product already exists
                    return existing_component, None, None, False
                else:
                    #this is new component since the supplier's don't match
                    component['name'] = existing_component.name
            else:
                #this component doesn't have a supplier, which the user was forced to enter so instead, create a new one
                component['name'] = existing_component.name
            
        
        #if group doesn't exist - fail fast
        if component.get('owner'):
            supplier = Group.objects.filter(groupprofile__uuid=component['owner']).first()
            if not supplier:
                return None, {'detail': 'invalid_owner'}, status.HTTP_400_BAD_REQUEST, False


        elif component.get('supplier'):
            supplier = Group.objects.filter(name__iexact=component['supplier']).first()
            if not supplier:
                errors = {"type": "invalid-format", "status": status.HTTP_400_BAD_REQUEST, "detail":f"Can not find group with name {request.data['component']['supplier']}. Add Group before importing status."}
                return None, errors, status.HTTP_400_BAD_REQUEST, False

        else:
            errors = {'type': 'invalid-format', 'status': status.HTTP_400_BAD_REQUEST, 'detail':'missing required fields or invalid format. Owner is required to create component'}
            return None, errors, status.HTTP_400_BAD_REQUEST, False

        if role == "supplier":
            # is this user a member of this group?
            if not user.groups.filter(id=supplier.id).exists():
                return None, {'error': 'You are not able to perform this action'}, status.HTTP_403_FORBIDDEN, False

        #FIRST CONFIRM COMPONENT DOESN'T ALREADY EXIST:

        old_component = Component.objects.filter(name=component['name'], parent=True, product_info__supplier=supplier).first()

        if not old_component:
            #create the component
            new_component = Component(name=component['name'],
                                  added_by=user,
                                  parent=True,
                                  supplier = supplier.name
                                  )
            new_component.save()
            action = create_component_action(f"created component", user, new_component, 1)
            Product.objects.create(component=new_component, supplier=supplier)
            created_component = True
            return new_component, None, None, True
        else:
            return old_component, None, None, False


    #TO DO ADD A SHARED COMPONENT STATUS VIEW (share = True)
    def create(self, request, *args, **kwargs):
        logger.debug("In STATUS CREATE VIEW")
        case = get_object_or_404(Case, case_id = self.kwargs['caseid'])
        logger.debug(request.data)
        created_component = False
        if not is_my_case(self.request.user, case.id):
            raise PermissionDenied()

        my_role = my_case_role(self.request.user, case)
        my_vendors = None
        if my_role in ["participant", "reporter", "observer"]:
            #these roles don't need to add a status
            raise PermissionDenied()

        other_component = None
        serializer = StatusSerializer(data=request.data)
        if serializer.is_valid():

            #is this a new component?
            component, errors, ret_status, created_component = self.check_component(request.data['component'], self.request.user, my_role)
            if not component:
                return JsonResponse(errors, status=ret_status)

            share = False
            if request.data.get('share'):
                share = True if (request.data['share'] == "true" or request.data['share'] == True) else False
            #get vuls
            if not created_component:
                #make sure we don't already have this component status
                for v in request.data['vuls']:
                    vul = get_object_or_404(Vulnerability, id=v)
                    if ComponentStatus.objects.filter(component=component, vul=vul).exists() and not request.data.get('confirm'):
                        errors = {'detail':f'Component Status for vul {vul.vul} already exists.', 'confirm': 1}
                        return JsonResponse(errors, status=status.HTTP_400_BAD_REQUEST)


            if request.data.get('other_component'):
                other_component, errors, ret_status, created = self.check_component(request.data['other_component'], self.request.user, my_role)
                if not other_component:
                    return JsonResponse(errors, status=ret_status)


            #pop all the fields that aren't in StatusRevision
            try:
                serializer.validated_data.pop('component')
                serializer.validated_data.pop('share')
                serializer.validated_data.pop('component_status')
                serializer.validated_data.pop('other_component')
                #these may not all be populated but serializer will catch the required fields
            except:
                pass

            for v in request.data['vuls']:
                logger.debug(f" VUL IS {v}")
                vul = get_object_or_404(Vulnerability, id=v)
                cs, created = ComponentStatus.objects.update_or_create(component=component,
                                                              vul=vul,
                                                              defaults = {'share': share,
                                                                          'other_component': other_component,
                                                                          'other_component_version': request.data.get('other_component_version', ''),
                                                                          'relationship': request.data.get('relationship', '')})


                sr  = StatusRevision(**serializer.validated_data)
                sr.set_from_request(self.request)
                cs.add_revision(sr, save=True)

                if is_case_owner(self.request.user, vul.case.id):
                    cs.current_revision.approved = True
                    cs.current_revision.save()

                #update case modified
                cs.vul.case.modified = timezone.now()
                cs.vul.case.save()

                case_state = None
                if check_remediation_available(cs):
                    case_state = CaseState.objects.filter(code="vendor_remediation").first()

                caction = create_case_action(f"added component status for {vul.vul}", self.request.user, vul.case, share, state=case_state)
                action = create_component_action(f"add component status for {vul.vul}", self.request.user, component, 6)

            if not is_case_owner(self.request.user, case.id):
                send_vendor_status_update_email(case)

            add_pulse(self.request.user, case.id)
            return Response({}, status=status.HTTP_202_ACCEPTED)

        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)


    def destroy(self, request, *args, **kwargs):
        component = self.get_object()
        #now check if this user has access to this component
        if not is_case_owner(self.request.user, component.vul.case.id):
            if _is_my_component(self.request.user, component.component):
                if is_coordinator(self.request.user):
                    #user must be owner or staff to delete
                    raise PermissionDenied()
            else:
                raise PermissionDenied()

        if component.component.get_vendor():
            action = create_case_action(f"Removed status for {component.component.get_vendor()}'s component {component.component.name} {component.component.version} for vulnerability {component.vul.vul}", request.user, component.vul.case)
        else:
            action = create_case_action(f"Removed status for {component.component.name} {component.component.version} for vulnerability {component.vul.vul}", request.user, component.vul.case)

        action = create_component_action(f"remove component status for {component.vul.vul}", self.request.user, component.component, 6)
        component.delete()

        return Response({}, status=status.HTTP_202_ACCEPTED)

    def update(self, request, **kwargs):

        # get status
        component = self.get_object()

        logger.debug("COMPONENT STATUS UPDATE")
        #now check if this user has access to this component status
        if not is_case_owner(self.request.user, component.vul.case.id):
            if _is_my_component(self.request.user, component.component):
                if is_coordinator(self.request.user):
                    #user must be owner or staff to delete
                    raise PermissionDenied()

        my_role = my_case_role(self.request.user, component.vul.case)
        if my_role in ["participant", "reporter", "observer"]:
            #these roles don't need to add a status
            raise PermissionDenied()

        data = request.data
        logger.debug(request.data)
        other_component = None
        serializer = StatusSerializer(data=data)
        if serializer.is_valid():

            share = False
            if data.get('share'):
                share = True if (data['share'] == "true" or data['share'] == True) else False

            if request.data.get('other_component'):
                other_component, errors, ret_status, created = self.check_component(request.data['other_component'], self.request.user, my_role)
                if not other_component:
                    return JsonResponse(errors, status=ret_status)
                        
            comp_status_change = False
            logger.debug(request.data['vuls'])
            for v in request.data['vuls']:
                logger.debug(f"VUL is {v}")
                vul = get_object_or_404(Vulnerability, id=v)
                logger.debug(f"VUL IS {vul}")
                cs = ComponentStatus.objects.filter(component=component.component, vul=vul).first()
                if cs:
                    data = request.data
                    change = False
                    #are there any actual changes?
                    if (data.get('statement') and cs.current_revision.statement != data["statement"]):
                        change = True
                    elif (data.get('default_status') and cs.current_revision.default_status != data['default_status']):
                        change = True
                    elif (data.get('version_status') and cs.current_revision.version_status != data['version_status']):
                        change = True

                    if (cs.relationship != data.get('relationship', '')):
                        cs.relationship = data.get("relationship", '')
                        action = create_component_action(f"modify component relationships for {vul.vul}", self.request.user, component.component, 6)
                        comp_status_change = True
                    if (data.get('other_component') and cs.other_component != other_component):
                        cs.other_component = other_component
                        action = create_component_action(f"modify other component for {vul.vul}", self.request.user, component.component, 6)
                        comp_status_change = True
                    if (cs.other_component_version != data.get('other_component_version', '')):
                        cs.other_component_version = data.get('other_component_version', '')
                        comp_status_change  = True
                        action = create_component_action(f"modify other component version for {vul.vul}", self.request.user, component.component, 6)
                    if cs.share != share:
                        cs.share = share
                        comp_status_change = True
                        action = create_component_action(f"modify share status for {vul.vul}", self.request.user, component.component, 6)
                    if comp_status_change:
                        cs.save()
                        
                    if not change:
                        continue
                    #return Response({}, status=status.HTTP_202_ACCEPTED)
                else:
                    cs = ComponentStatus(component=component.component,
                                         vul=vul,
                                         share=share)
                    if other_component:
                        cs.other_component = other_component
                        cs.relationship = request.data.get('relationship')
                        cs.other_component_verison = request.data.get('other_component_version')
                    cs.save()

                try:
                    serializer.validated_data.pop('component')
                    serializer.validated_data.pop('share')
                    serializer.validated_data.pop('component_status')
                    serializer.validated_data.pop('other_component')
                    serializer.validated_data.pop('relationship')
                    serializer.validated_data.pop('other_component_version')

                except:
                    #if more than 1 vul, this may have already happened */
                    pass

                logger.debug(serializer.validated_data)
                sr  = StatusRevision(**serializer.validated_data)

                sr.set_from_request(self.request)
                cs.add_revision(sr, save=True)

                if is_case_owner(self.request.user, vul.case.id):
                    cs.current_revision.approved = True
                    cs.current_revision.save()

                case_state = None
                if check_remediation_available(cs):
                    case_state = CaseState.objects.filter(code="vendor_remediation").first()

                caction = create_case_action(f"added component status for {vul.vul}", self.request.user, vul.case, share, state=case_state)

                action = create_component_action(f"modified component status for {vul.vul}", self.request.user, component.component, 6)

            if not is_case_owner(self.request.user, component.vul.case.id):
                send_vendor_status_update_email(component.vul.case)

            add_pulse(self.request.user, component.vul.case.id)

            return Response({}, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

class StatusTransfersAPIView(viewsets.ModelViewSet):
    serializer_class = StatusTransferSerializer
    permission_classes = (IsAuthenticated, CoordinatorPermission)

    def get_view_name(self):
        return f"Status Transfers"

    def get_queryset(self):
        case = get_object_or_404(Case, case_id=self.kwargs['caseid'])
        return ComponentStatusUpload.objects.filter(case=case, merged=False, deleted=False)

    def update(self, request, **kwargs):
        logger.debug(f"{self.__class__.__name__} update: {self.request.POST}")
        transfer = get_object_or_404(ComponentStatusUpload, id=self.kwargs['pk'])
        data = request.data
        case = transfer.case
        if not is_case_owner(self.request.user, case.id):
            raise PermissionDenied()
        sc = self.get_serializer_class()
        serializer = sc(instance=transfer, data=data, partial=True)
        if serializer.is_valid():
            if request.data.get('deleted'):
                action = create_case_action(f"rejected status transfer", request.user, case, False)
            elif request.data.get('merged'):
                #this is where we do all the status merging

                vuls ={}
                for stmt in transfer.vex['statements']:

                    cve = stmt['vulnerability']
                    if type(cve) is dict and 'name' in cve:
                        cve = cve['name']
                    if cve.lower().startswith('cve-'):
                        cve = cve[4:]

                    vul = Vulnerability.objects.filter(cve=cve, case=case).first()
                    if not vul:
                        return Response({'detail': f'No vulnerability {cve} within this case.'}, status=status.HTTP_400_BAD_REQUEST)
                    vstatus = stmt['status']
                    if vstatus in ["not_affected", "unaffected"]:
                        vstatus = "Not Affected"
                    elif vstatus == "affected":
                        vstatus = "Affected"
                    elif vstatus == "fixed":
                        vstatus = "Fixed"
                    else:
                        vstatus = "Under Investigation"
                    if "justification" in stmt:
                        justification = stmt["justification"].replace("_", " ").capitalize()
                    else:
                        justification = None
                    status_stmt = []

                    if vul.id not in vuls:
                        vuls[vul.id] = {}
                    for prod in stmt['products']:
                        val = prod
                        if type(prod) is dict and 'id' in prod:
                            val = prod['id']

                        #attempt to get version
                        version = _find_version(val)
                        if version:
                            #remove version from name
                            val = val.replace(version, '').strip()

                        #create the component  - we can add owner later
                        component = Component.objects.filter(name=val).exclude(product_info__supplier__isnull=False).first()
                        if component == None:
                            component = Component(name=val,
                                                  version = version,
                                                  parent=True,
                                                  added_by=self.request.user)
                            component.save()
                            create_component_action(f"created component through transfer", self.request.user, component, 1)
                            product = Product.objects.create(component=component)

                        version_status = {'status': vstatus,
                                          'justification': justification,
                                           'version_value': version,
                                           'impact_statement': stmt.get('impact_statement', None)}

                        if component.id not in vuls[vul.id]:
                            vuls[vul.id][component.id] = []
                        vuls[vul.id][component.id].append(version_status)

                for key, val in vuls.items():
                    for comp, vstatus in val.items():
                        vul = Vulnerability.objects.get(id=key)
                        component = Component.objects.get(id=comp)
                        cs, created = ComponentStatus.objects.update_or_create(component=component, vul=vul)
                        impact_statement = None
                        logger.debug(vstatus)
                        for y in vstatus:
                            if y['impact_statement']:
                                impact_statement = y['impact_statement']
                            #pop impact statement from version dict
                            del y['impact_statement']

                        sr = StatusRevision(version_status=vstatus,
                                            statement=impact_statement,
                                            user=transfer.user)
                        cs.add_revision(sr, save=True)

                        action = create_case_action(f"merged status transfer from {transfer.user} for vul {vul.vul} and {component.name}",
                                                    request.user, case, False)

            serializer.save()
            logger.debug(serializer.data)
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        else:
            logger.debug(serializer.errors)
            return Response(serializer.errors,
	                    status=status.HTTP_400_BAD_REQUEST)


class ComponentStatusRevisionAPIView(viewsets.ModelViewSet):
    serializer_class = StatusRevisionSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission)

    def get_view_name(self):
        return f"Status Revision API"

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return StatusRevision.objects.none()

        cs = get_object_or_404(ComponentStatus, id=self.kwargs['pk'])
        case = cs.vul.case
        if not(is_my_case(self.request.user, case.id)):
            raise PermissionDenied()
        if not(_is_my_component(self.request.user, cs.component)):
            raise PermissionDenied()
        return StatusRevision.objects.filter(component_status=cs).order_by('-revision_number')


class CaseComponentAPIView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, PendingUserPermission)
    serializer_class = ComponentStatusSerializer
    """
    def list(self, request, *args, **kwargs):
        content = self.get_queryset()
        return Response(self.serializer_class(content, many=True,
                                              context={'user': request.user}).data)"""
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({"user": self.request.user})
        return context

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view',None):
            return ComponentStatus.objects.none()
        component = get_object_or_404(Component, id=self.kwargs['pk'])
        if not(_is_my_component(self.request.user, component)):
            raise PermissionDenied()
        cases = my_cases(self.request.user)
        #get all versions of this component
        if component.parent:
            all_versions = Product.objects.filter(component__name=component.name, component__deleted=False)
            if component.supplier:
                all_versions = all_versions.filter(supplier=component.product_info.supplier)
            else:
                all_versions = all_versions.exclude(supplier__isnull=False)
            ret = all_versions.values_list('component__id', flat=True)

        else:
            ret = [component.id]

        if is_coordinator(self.request.user):
            return ComponentStatus.objects.filter(component__id__in=ret)
        return ComponentStatus.objects.filter(component__id__in=ret, vul__case__in=cases)

class UploadSPDXFile(LoginRequiredMixin, UserPassesTestMixin, generic.TemplateView):
    login_url = "authapp:login"
    template_name='cvdp/notemplate.html'

    def test_func(self):
        if (self.kwargs.get('group')):
            group = get_object_or_404(Group, groupprofile__uuid=self.kwargs['group'])
            if self.request.user.groups.filter(id=group.id).exists():
                return True
        if is_coordinator(self.request.user):
            return True
        raise PermissionDenied()

    def post(self, request, *args, **kwargs):
        group = None
        if (self.kwargs.get('group')):
            group = get_object_or_404(Group, groupprofile__uuid=self.kwargs['group'])

        logger.debug(f"Files Post: {self.request.FILES}")
        (this_file_name, this_file_extension) = os.path.splitext(self.request.FILES['file'].name)

        # valid extensions understood by spdx library:
        # .rdf, .rdf.xml, .tag, .spdx, .json, .xml, .yaml, .yml
        if this_file_extension not in [".rdf", ".rdf.xml", ".tag", ".spdx", ".json", ".xml", ".yaml", ".yml"]:
            logger.debug(f"bad extension on spdx upload: {this_file_extension}")
            return JsonResponse({'error': f'Problem uploading SPDX file: unsupported extension'}, status=400)

        tf = tempfile.NamedTemporaryFile(suffix=this_file_extension)
        with open(tf.name, 'wb+') as destination:
            for chunk in self.request.FILES['file'].chunks():
                destination.write(chunk)
        try:
            if group:
                call_command('loadspdx', tf.name, '--assume-relationships', f'--group={group.id}', f'--user={self.request.user.id}')
            else:
                call_command('loadspdx', tf.name, '--assume-relationships', f'--user={self.request.user.id}')
        except Exception as e:
            logger.debug(traceback.format_exc())
            return JsonResponse({'error': f'Problem uploading SPDX file: {str(e)}'}, status=400)

        return JsonResponse({'status': 'success'}, status=200)

class DownloadSPDXFile(LoginRequiredMixin, UserPassesTestMixin, generic.TemplateView):
    login_url = "authapp:login"
    template_name = "cvdp/notmpl"

    def test_func(self):
        obj = get_object_or_404(Component, id=self.kwargs['pk'])
        if _is_my_component(self.request.user, obj):
            return True
        return False

    def get(self, request, *args, **kwargs):
        obj = get_object_or_404(Component, id=self.kwargs['pk'])
        format = self.request.GET.get('format', 'json')
        # check formats to avoid command injection issue with NamedTemporaryFile.
        # Formats in dropdown located in downloadSBOM UI in ComponentDetailInternal.js
        if format not in ["rdf", "rdf.xml", "tag", "spdx", "json", "xml", "yaml", "yml"]:
            logger.debug(f"bad format on spdx download: {format}")
            return JsonResponse({'error': f'Problem generating SPDX file: unsupported format'}, status=400)

        tf = tempfile.NamedTemporaryFile(suffix=f".{format}")
        try:
            call_command('createspdx', f'--out={tf.name}', f'--id={obj.id}', f'--email={self.request.user.email}', f'--creator={self.request.user.get_full_name()}')
        except Exception as e:
            logger.debug(traceback.format_exc())
            return JsonResponse({'error': f'Problem generating SPDX file: {str(e)}'}, status=400)

        action = create_component_action(f"generated {format} spdx file", self.request.user, obj, 3)
        with open(tf.name, 'r') as content:
            sbom = ContentFile(content.read(), name=f"{obj.name}_{obj.version}.{format}")
            mime_type = 'application/json'
            response = HttpResponse(sbom, content_type = mime_type)
            response['Content-Disposition'] = 'attachment; filename=' + sbom.name
            response["Content-type"] = "application/json"
            response["Cache-Control"] = "must-revalidate"
            response["Pragma"] = "must-revalidate"
            return response

"""
Component Action API
"""
class ComponentActionAPIView(viewsets.ModelViewSet):
    serializer_class = ComponentActionSerializer
    permission_classes = (IsAuthenticated, PendingUserPermission)
    pagination_class=StandardResultsPagination

    def get_view_name(self):
        return f"Component Action"

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return ComponentAction.objects.none()
        actions = []
        if self.kwargs.get('pk'):
            component = get_object_or_404(Component, id=self.kwargs['pk'])

            if not(_is_my_component(self.request.user, component)):
                #raise PermissionDenied()
                # we might want to return actions related to their own components
                return ComponentAction.objects.none()
            if component.parent:
	        #get all actions for all versions + de-duplicate
                all_versions = Product.objects.filter(component__name=component.name, component__deleted=False)
                if component.product_info.supplier:
                    all_versions = all_versions.filter(supplier=component.product_info.supplier)
                else:
                    all_versions = all_versions.exclude(supplier__isnull=False)
                ret = all_versions.values_list('component_id', flat=True)
                return ComponentAction.objects.filter(component__in=ret).order_by('-created')

            actions = ComponentAction.objects.filter(component=component).order_by('-created')

        return actions
