from django.contrib import admin
# Register your models here.
from django.contrib import messages
from django import forms
from django.utils import timezone
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from authapp.models import User
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from django.contrib.auth import views as auth_views
from django.contrib.auth.models import Group
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin
from cvdp.models import UserProfile, GroupProfile, Contact, CaseThreadParticipant, CaseParticipant, EmailTemplate, Case, AssignmentRole, UserAssignmentWeight, CaseReport, GlobalSettings, MessageThread, UserThread, CaseThread, Vulnerability, CaseResolutionOptions, Ticket, TicketThread, EmailTicket, EmailThread, EmailAttachment, CaseAdvisory, AdvisoryRevision, CaseCSAFSettings, CWEDescriptions, CaseAction, VulCVSS, CaseState, VulAttributes, CaseApproval, CVEReservation, BounceEmailNotification
from cvdp.components.models import Component, Product, ComponentStatus, StatusRevision, ComponentAction
from cvdp.manage.models import AdVISEConnection, AdviseTask, AdviseScheduledTask, FormEntry
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from django.contrib.admin import helpers
from django.contrib.admin.helpers import ActionForm
from django.template.response import TemplateResponse
from cvdp.permissions import is_user_admin, get_coord_teams
from cvdp.forms import AdminVulCloneForm
from django.shortcuts import render
from django.http import HttpResponseRedirect


@admin.action(description="Duplicate selected records")
def duplicate_vulnerability(modeladmin, request, queryset):

    if 'apply' in request.POST:

        form = AdminVulCloneForm(request.POST)

        if form.is_valid():

            case = None
            new_cve = form.cleaned_data['new_cve']
            new_case = form.cleaned_data['new_case_id']

            if new_cve.lower().startswith('cve-'):
                new_cve = new_cve[4:]

            if new_case:
                case = Case.objects.filter(case_id = new_case).first()
                if not case:
                    messages.error(request, "Case ID does note exist.")
                    return HttpResponseRedirect(request.get_full_path());
                
            for obj in queryset:
                # 1. Store the original PK to handle M2M later
                orig_pk = obj.pk
                obj.date_added = timezone.now()
                # 2. Set PK to None to create a new record
                obj.pk = None
        
                if new_cve:
                    obj.cve = new_cve

                if case:
                    obj.case = case
                    
                obj.save()
                
                # 4. Handle Many-to-Many relationships
                # We fetch the original object using the stored PK
                old_obj = modeladmin.model.objects.get(pk=orig_pk)
                for m2m in old_obj._meta.many_to_many:
                    # Get the related manager (e.g., obj.tags)
                    related_manager = getattr(old_obj, m2m.name)
                    # Assign the same relations to the new object
                    getattr(obj, m2m.name).set(related_manager.all())

                for child in old_obj.vulnerabilitytag_set.all():
                    child.pk = None # Make it a new record
                    child.created = timezone.now()
                    child.vulnerability = obj # Point it to the NEW parent we just saved
                    child.save()

                for child in old_obj.cvss.all():
                    child.pk = None # Make it a new record
                    child.vul = obj # Point it to the NEW parent we just saved
                    child.save()

                if hasattr(old_obj, 'vulssvc'):
                    child = old_obj.vulssvc
                    child.pk = None  # Create new child record
                    child.vul = obj # Point to the NEW parent
                    child.save()

                    
            modeladmin.message_user(request, f"Successfully duplicated {queryset.count()} records.")
            return HttpResponseRedirect(request.get_full_path())

    else:
        selected_ids = queryset.values_list('id', flat=True)
        # Initial request: show the form
        form = AdminVulCloneForm(initial={'_selected_action': selected_ids})

    return render(request, 'cvdp/admin_vul_clone.html', {
        'items': queryset,
        'form': form,
        'action': 'duplicate_vulnerability'
    })




def create_component_action(title, user, comp, action):
    action = ComponentAction(component = comp,
                             user=user,
                             title=title,
                             action_type=action,
                             created=timezone.now())
    action.save()
    return action


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = "User Profile"
    fk_name = 'user'


class CVSSInline(admin.StackedInline):
    model = VulCVSS
    verbose_name_plural = "CVSS Revisions"
    fk_name = 'vul'

class AttributesInline(admin.StackedInline):
    model = VulAttributes
    verbose_name_plural = 'Vul Attributes'
    fk_name = 'vul'
    
class VulAdmin(admin.ModelAdmin):
    list_display = ('get_vul_id', 'cve', 'case', 'description', 'date_added', 'modified')
    search_fields=['description', 'case__case_id', 'cve']
    actions = ['get_vul_id']
    actions=[duplicate_vulnerability]
    title = "Vulnerabilities"
    inlines = (AttributesInline, CVSSInline, )

    def get_vul_id(self, instance):
        return instance.vul
    get_vul_id.short_description = "Vul ID"

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return False

class ReportInlines(admin.StackedInline):
    model = CaseReport
    fk_name= 'entry'
    
class FormEntryAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'created', 'created_by')
    #inlines = (ReportInlines, )
    
class CaseReportAdmin(admin.ModelAdmin):
    list_display = ('received', 'entry__title', 'report')
    readonly_fields = ['entry', ]
    

class GroupListFilter(admin.SimpleListFilter):
    title = _('role')
    parameter_name = 'group'

    def lookups(self, request, model_admin):
        items = ()
        for group in Group.objects.filter(groupprofile__isnull=True):
            items += ((str(group.id), str(group.name),),)
        return items

    def queryset(self, request, queryset):
        group_id = request.GET.get(self.parameter_name, None)
        if group_id:
            return queryset.filter(groups=group_id)
        return queryset


class VendorGroupFilter(admin.SimpleListFilter):
    title = _('group')
    parameter_name = 'group'

    def	lookups(self, request, model_admin):
        items =	()
        for group in Group.objects.filter(groupprofile__isnull=False).order_by('name'):
            items += ((str(group.id), str(group.name),),)
        return items

    def queryset(self, request, queryset):
        group_id = request.GET.get(self.parameter_name, None)
        if group_id:
            return queryset.filter(groups=group_id)
        return queryset

class CustomUserAdmin(BaseUserAdmin):
    model = User
    inlines = (UserProfileInline, )
    list_display = ('username', 'first_name', 'last_name', 'is_staff', 'email', 'screen_name', 'api_account', 'org_groups', 'role_groups')
    list_select_related = ('userprofile',)
    search_fields=BaseUserAdmin.search_fields + ('groups__name', )
    list_filter = ('is_staff', 'is_active', 'is_superuser', 'api_account', GroupListFilter, VendorGroupFilter,)
    fieldsets = BaseUserAdmin.fieldsets + ((None,{'fields':('screen_name', 'title', 'org', 'pending', 'is_coordinator', 'is_api_service', 'api_account')}),)


    def org_groups(self, obj):
        """
        get group, separate by comma, and display empty string if user has no group
        """
        if obj.groups.count():
            return ','.join([g.name for g in obj.groups.filter(groupprofile__isnull=False)])
        else:
            return ""

    def role_groups(self, obj):
        """
        get group, separate by comma, and display empty string if user has no group
        """
        if obj.groups.count():
            return ','.join([g.name for g in obj.groups.filter(groupprofile__isnull=True)])
        else:
            return ""

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return False


    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        is_superuser = request.user.is_superuser
        user_admin = is_user_admin(request.user)
        disabled_fields = set()

        if not is_superuser:
            disabled_fields |= {
                'username',
                'is_staff',
		'is_superuser',
                'email',
                'user_permissions',
            }

        if (not is_superuser
            and obj is not None
            and obj == request.user
        ):
            disabled_fields |= {
                'is_staff',
                'is_superuser',
                'groups',
                'user_permissions',
            }

        for f in disabled_fields:
            if f in form.base_fields:
                form.base_fields[f].disabled = True

        return form


class GroupProfileInline(admin.StackedInline):
    model = GroupProfile
    can_delete=False
    verbose_name_plural = 'Group Details'

class GroupAdmin(BaseGroupAdmin):
    inlines = (GroupProfileInline, )
    list_display = ('name', 'get_group_type', 'get_group_uuid')
    search_fields=['name']

    def get_group_type (self, instance):
        if instance.groupprofile:
            return instance.groupprofile.vendor_type
        return "None"
    get_group_type.short_description="Group Type"

    def get_group_uuid(self, instance):
        if instance.groupprofile:
            return instance.groupprofile.uuid
        return "None"
    get_group_uuid.short_description="UUID"

    def has_delete_permission(self, request, obj=None):
       if request.user.is_superuser:
           return True
       return False

    
class VINCENTAdminSite(admin.AdminSite):
    site_header = "VINCE-NT Administration"
    site_title = "VINCE-NT"
    index_title = "VINCE-NT Site Administration"

@admin.register(EmailTemplate)
class EmailTemplateAdmin (admin.ModelAdmin):
   list_display = ('template_name', 'template_type', 'subject', 'plain_text', 'locale' )
   search_fields = ('template_name', 'locale', 'plain_text', )
   list_filter = ('locale', 'template_type', )

   def has_delete_permission(self, request, obj=None):
       if request.user.is_superuser:
           return True
       return False

def bulk_assign_team(modeladmin, request, queryset):
    ct = queryset.count()
    if int(request.POST['group']) == 0:
        title = "Bulk unassign coord team"
        group = None
    else:
        group = Group.objects.get(id=request.POST['group'])
        title = f"Bulk assign cases to coord team {group.name}"


    for c in queryset:
        case = Case.objects.filter(id=c.id).first()
        p = CaseParticipant.objects.filter(case__id=c.id, role="owner", group=group).first()
        
        if not p:
            cp = CaseParticipant.objects.create(case=case, role="owner", group=group, notified=timezone.now(), user=request.user)
            thread = CaseThread.objects.filter(case=case, official=True).first()
            ctp, ctp_created = CaseThreadParticipant.objects.update_or_create(thread=thread,
                                                                              participant=cp,
                                                                              defaults={
                                                                                  'added_by': request.user
                                                                              })
            CaseAction.objects.create(case=case, user=request.user, title=f"assigned {group.name} through admin interface")
        else:
            if not p.notified:
                p.notified = timezone.now()
                p.save()
            thread = CaseThread.objects.filter(case=case, official=True).first()
            ctp, ctp_created = CaseThreadParticipant.objects.update_or_create(thread=thread,
                                                                              participant=p,
                                                                              defaults={
                                                                                  'added_by': request.user
                                                                              })

    messages.success(request, f"Successfully updated {ct} cases")



def bulk_state_change(modeladmin, request, queryset):
    ct = queryset.count()
    state = request.POST['state']
    
    for c in queryset:
        case = Case.objects.filter(id=c.id).first()
        case.state = state
        case.save()
    
    messages.success(request, f"Successfully updates {ct} cases")

    
class ProductInline(admin.StackedInline):
    model = Product
    can_delete=False
    verbose_name_plural = 'Component Details'


def bulk_change_owner(modeladmin, request, queryset):
    ct = queryset.count()
    if int(request.POST['group']) == 0:
        title = "Bulk unassign group"
        group = None
    else:
        group = Group.objects.get(id=request.POST['group'])
        title = f"Bulk assign components to group {group.name}"

    for comp in queryset:
        p = Product.objects.filter(component__id=comp.id).first()
        if p:
            action_title = f"changed ownership from {p.supplier} to {group}"
            p.supplier = group
            p.save()
        else:
            Product.objects.create(component=comp, supplier=group)
            action_title = f"added owner {group}"
            comp.parent = True
            comp.save()
        ComponentAction.objects.create(component=comp, user=request.user, title=action_title, action_type=2)

    messages.success(request, f"Successfully updated {ct} components")


def merge_components(modeladmin, request, queryset):
    ct = queryset.count()
    if ct > 2:
        messages.error(request, f"Can only merge 2 components, {ct} selected.")
        return None

    if request.POST.get('post'):
        comp1 = queryset[0]
        comp2 = queryset[1]
        if comp1.version != comp2.version or comp1.name != comp2.name:
            messages.error(request, f"Components must have same name and version")
            return None
        elif comp1.product_info.supplier != comp2.product_info.supplier:
            messages.error(request, f"Components must have same owner")
            return None
        elif comp1.deleted and comp2.deleted:
            messages.error(request, f"Can not merge 2 deleted components")
            return None

        comp1.supplier = comp1.supplier if comp1.supplier else comp2.supplier
        comp1.source = comp1.source if comp1.source else comp2.source
        comp1.homepage = comp1.homepage if comp1.homepage else comp1.homepage
        comp1.checksum = comp1.checksum if comp1.checksum else comp2.checksum
        comp1.external_ids = comp1.external_ids if comp1.external_ids else comp2.external_ids
        comp1.comment = comp1.comment if comp1.comment else comp2.comment
        comp1.parent = comp1.parent if comp1.parent else comp2.parent
        comp1.deleted = False
        comp1.save()

        #get all status with component 2
        status = ComponentStatus.objects.filter(component=comp2)
        try:
            for x in status:
                x.component = comp1
                x.save()
                action = create_component_action(f"add component status for {x.vul} through component merge", request.user, comp1, 6)

        except Exception as e:
            messages.error(f"Unable to merge components: {repr(e)}")
            return None

        #merge dependencies
        for dep in comp2.product_info.dependencies.all():
            comp1.dependencies.add(dep)
            action = create_component_action(f"added dependency {dep} during component merge", request.user, comp1, 4)

        action = create_component_action(f"merged components", request.user, comp1, 2)
        comp2.delete()
        messages.success(request, "Successfully merged components")

    else:
        request.current_app = modeladmin.admin_site.name
        return TemplateResponse(request,
                                'admin/confirm_merge.html',
                                {'queryset': queryset,
                                 "action_checkbox_name": helpers.ACTION_CHECKBOX_NAME})

def get_group_choices():
    return [(0, '--------')] + [(q.id, q.name) for q in Group.objects.all().order_by('name')]

class ComponentOwnershipForm(ActionForm):

    group = forms.ChoiceField(choices=get_group_choices,
                              label=_('Change Owner'),
                              required=False
    )


@admin.register(Component)
class ComponentAdmin(admin.ModelAdmin):
    list_display = ('name', 'supplier', 'version', 'parent', 'get_component_owner', 'created')
    search_fields = ('name', 'supplier', 'product_info__supplier__name', )
    list_filter = ('deleted', 'parent')
    inlines = (ProductInline, )
    list_per_page = 250
    action_form = ComponentOwnershipForm
    actions = [bulk_change_owner, merge_components]

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return False

    def get_component_owner(self, instance):
        try:
            return instance.product_info.supplier.name
        except:
            return ""


class AdvisoryRevisionInline(admin.StackedInline):
    model = AdvisoryRevision
    verbose_name_plural = "Advisory Revision"
    fk_name = 'advisory'
    
        
@admin.register(CaseAdvisory)
class AdvisoryAdmin(admin.ModelAdmin):
    inlines = (AdvisoryRevisionInline, )


class CaseOwnerFilter(admin.SimpleListFilter):
    title = "Owner"
    parameter_name = 'owner'

    def lookups(self, request, model_admin):
        return [(0, '--------')] + [(q.id, q.username) for q in get_user_model().objects.filter(groups__name__in=["coordinator", "coordinator_mgr"])]

    def queryset(self, request, queryset):
        if self.value() == 0:
            #get unassigned cases
            assignments = CaseParticipant.objects.filter(role="owner").values_list('case__id', flat=True)
            return queryset.exclude(id__in=assignments)
        elif self.value():
            assignments = CaseParticipant.objects.filter(contact__user__id=self.value(), role="owner").values_list('case__id', flat=True)
            return queryset.filter(id__in=assignments)
        else:
            return queryset

def get_coord_team_choices():
    return [(0, '--------')] + [(q.id, q.name) for q in get_coord_teams().order_by('name')]


def get_case_state_choices():
    return [('Unknown', '------')] + [(q.name, q.name) for q in CaseState.objects.all().order_by('order')]

                                      
class CaseOwnershipForm(ActionForm):

    group = forms.ChoiceField(choices=get_coord_team_choices,
                              label=_('Change Owner'),
                              required=False
    )

    state = forms.ChoiceField(choices=get_case_state_choices,
                               label=_('Case State'),
                               required=False
                               )
        
@admin.register(Case)
class CaseAdmin(admin.ModelAdmin):
    list_display = ('case_id', 'title', 'created', 'status', 'case_get_team', 'case_get_owners', 'state')
    search_fields = ('case_id', 'title', )
    list_filter = ('status', CaseOwnerFilter, 'state')
    action_form = CaseOwnershipForm
    actions = [bulk_assign_team, bulk_state_change]

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return False

    def case_get_team(self, obj):
        return obj.get_coordinators

    def case_get_owners(self, obj):
        return obj.get_owners

    case_get_owners.short_description = _('Case Owners')
"""
class CustomAuthenticator(admin.ModelAdmin):
    list_display = ('user', 'type')
    search_fields=['user__email']
    title = "MFA"

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return False
"""

class ConnectionAdmin(admin.ModelAdmin):
    list_display = ('get_group_name', 'url', )

    def get_group_name(self, obj):
        return obj.group.name

class ContactAdmin(admin.ModelAdmin):
    search_fields=['email', 'name']
    list_display=['email', 'name', 'user_id',]


    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return False

class CWEDescriptionAdmin(admin.ModelAdmin):
    search_fields = ['cweid', 'description']
    list_display=('cweid', 'slice_1003', 'children', 'usage')
    list_filter=('slice_1003', 'usage', )


class CaseParticipantAdmin(admin.ModelAdmin):
    search_fields = ['case__case_id']
    list_display = ('case__case_id', 'role', 'contact__name', 'group__name')
    list_filter=('role', )


class CaseStateAdmin(admin.ModelAdmin):
    search_fields = ['name', 'description']
    list_display = ('name', 'description', 'code', 'parent', 'color')

class ScheduledTaskAdmin(admin.ModelAdmin):
    list_filter=('enabled', 'running', )
    list_display = ('task', 'running', 'enabled', 'last_run', 'next_run', 'period')

class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'created', 'completed')

class CVEResAdmin(admin.ModelAdmin):
    search_fields = ['cve', 'user_reserved__screen_name']
    list_display = ('cve_id', 'user_reserved', 'account')
    list_filter = ('user_reserved', 'account', )
    
class RevisionInline(admin.StackedInline):
    model = StatusRevision
    can_delete=False
    verbose_name_plural = 'Component Status Revision'


class ComponentStatusAdmin(admin.ModelAdmin):
    search_fields = ['vul__case__case_id', 'vul__cve', 'component__name']
    list_display = ['id', 'get_case', 'get_vul', 'get_component_name']
    inlines = (RevisionInline, )
    readonly_fields = ('component', 'vul', 'current_revision' )

    def get_case(self, obj):
        return obj.vul.case

    def get_vul(self, obj):
        return obj.vul.vul

    def get_component_name(self, obj):
        try:
            if obj.component.product_info:
                if obj.component.product_info.supplier:
                    return f"{obj.component.product_info.supplier.name} {obj.component.name}"
        except:
            pass
        return obj.component.name

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        return False

admin.site.site_header = "VINCE-NT Admin"
admin.site.site_title = "VINCE-NT Admin Portal"

admin.site.register(User, CustomUserAdmin)
admin.site.register(GlobalSettings)
admin.site.unregister(Group)
admin.site.register(Group, GroupAdmin)
admin.site.register(Contact, ContactAdmin)
admin.site.register(CaseCSAFSettings)
admin.site.register(CaseThreadParticipant)
admin.site.register(CaseParticipant, CaseParticipantAdmin)
admin.site.register(AssignmentRole)
admin.site.register(MessageThread)
admin.site.register(UserAssignmentWeight)
admin.site.register(CaseReport, CaseReportAdmin)
admin.site.register(CaseResolutionOptions)
admin.site.register(CaseApproval)
admin.site.register(UserThread)
admin.site.register(AdVISEConnection, ConnectionAdmin)
admin.site.register(CaseThread)
admin.site.register(Vulnerability, VulAdmin)
admin.site.register(AdviseTask, TaskAdmin)
admin.site.register(AdviseScheduledTask, ScheduledTaskAdmin)
#admin.site.register(Authenticator, CustomAuthenticator)
admin.site.register(ComponentStatus, ComponentStatusAdmin)
admin.site.register(TicketThread)
admin.site.register(Ticket)
admin.site.register(EmailTicket)
admin.site.register(EmailThread)
admin.site.register(EmailAttachment)
admin.site.register(CWEDescriptions, CWEDescriptionAdmin)
admin.site.register(CaseState, CaseStateAdmin)
admin.site.register(FormEntry, FormEntryAdmin)
admin.site.register(CVEReservation, CVEResAdmin)
admin.site.register(BounceEmailNotification)
