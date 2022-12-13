# middleware.py
import logging
from django.core.exceptions import PermissionDenied
from django.http import HttpResponseForbidden
from django.urls import resolve
from django.shortcuts import redirect, render
from django.conf import settings

logger = logging.getLogger(__name__)

class PermissionDeniedMiddleware:

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        return response

    def process_exception(self, request, exception):

        if isinstance(exception, PermissionDenied):
            logger.warning(
                "Permission Denied: %s %s %s", request.user, request.method, request.path,
            )
            return render(request, "cvdp/403.html", {}, status=403)
        return None


class MaintenanceModeMiddleware:

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        maintenance = getattr(settings, 'MAINTENANCE_MODE', False)
        path = request.get_full_path()

        if not maintenance:
            if 'maintenance' in path:
                return redirect("cvdp:dashboard")
            return response

        if 'maintenance' in path:
            return response

        resolver_match = resolve(request.path_info)
        if resolver_match.app_name == 'admin':
            return response
        
        logger.debug(f"Middleware redirect due to mainteance")
        return redirect("cvdp:maintenance")
    
