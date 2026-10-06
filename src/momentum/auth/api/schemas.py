"""Authentication API schemas and serializers."""

from __future__ import annotations

from pydantic import BaseModel, Field

from momentum.auth.domain.models import CurrentSession, User
from momentum.auth.services.authentication_service import AuthenticationService


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class DeveloperModeRequest(BaseModel):
    enabled: bool


class AuthenticatedUserResponse(BaseModel):
    id: int
    name: str
    username: str


class AuthStatusResponse(BaseModel):
    initialized: bool
    authenticated: bool
    developer_authorized: bool
    developer_mode: bool


class AuthSessionResponse(BaseModel):
    user: AuthenticatedUserResponse
    developer_authorized: bool
    developer_mode: bool


class DeveloperModeResponse(BaseModel):
    developer_authorized: bool
    developer_mode: bool


def user_response(user: User) -> AuthenticatedUserResponse:
    return AuthenticatedUserResponse(id=user.id, name=user.name, username=user.username)


def session_response(
    current: CurrentSession,
    service: AuthenticationService,
) -> AuthSessionResponse:
    return AuthSessionResponse(
        user=user_response(current.user),
        developer_authorized=service.is_developer_authorized(current.user),
        developer_mode=service.developer_mode_active(current),
    )
