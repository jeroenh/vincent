from django.contrib.auth.hashers import PBKDF2PasswordHasher
from django.conf import settings

class VinceNTPasswordHasher(PBKDF2PasswordHasher):
    """
    A subclass of PBKDF2PasswordHasher that uses 100 times more iterations.
    """
    if (hasattr(settings, "PBKDF2HASHER_ITERATIONS")):
        iterations = settings.PBKDF2HASHER_ITERATIONS
    else:
        iterations = PBKDF2PasswordHasher.iterations

    
