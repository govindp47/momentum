"""Expected authentication failures."""


class AuthenticationError(Exception):
    """Base class for controlled authentication failures."""


class InvalidAuthenticationInput(AuthenticationError):
    """Signup input does not satisfy the authentication policy."""


class OwnerAlreadyExists(AuthenticationError):
    """The database already has its single owner."""


class InvalidCredentials(AuthenticationError):
    """The supplied username or password is invalid."""


class DeveloperAuthorizationRequired(AuthenticationError):
    """The owner is not in the configured developer allowlist."""
