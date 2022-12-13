from django import template
from allauth.mfa.utils import is_mfa_enabled
from cvdp.permissions import is_coordinator, is_analyst, is_coordinator_mgr, is_analyst_mgr, is_user_admin
import random
import os
import traceback

register = template.Library()


@register.filter
def contact_groups(user):
    return user.groups.filter(groupprofile__isnull=False)


@register.filter
def coordinator(user):
    return is_coordinator(user)

@register.filter
def analyst(user):
    return is_analyst(user)

@register.filter
def coord_manager(user):
    return is_coordinator_mgr(user)


@register.filter
def user_admin(user):
    return is_user_admin(user)

@register.filter
def analyst_manager(user):
    return is_analyst_mgr(user)

@register.filter
def mfa_set(user):
    if not user.is_authenticated:
        return False
    return is_mfa_enabled(user)

@register.filter
def userlogo(user, imgclass):
    try:
        if user:
            if user.org:
                org = f", {user.org}"
            else:
                org = ""
            if user.userprofile.photo:
                return f"<img class=\"{imgclass} rounded-circle flex-shrink-0\" src=\"{user.userprofile.photo.url}\" title=\"{user.screen_name}{org}\">"
            else:
                return f"<div class=\"{imgclass} rounded-circle flex-shrink-0 text-center\" style=\"background-color:{user.userprofile.logocolor};\" title=\"{user.screen_name}{org}\"><span class=\"logo-initial\">{user.initial}</span></div>"
    except:
        pass
    



