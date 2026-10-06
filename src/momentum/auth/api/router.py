"""HTTP routes for single-owner authentication."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from momentum.api.dependencies import get_authentication_service, get_current_session
from momentum.auth.api.schemas import (
    AuthenticatedUserResponse,
    AuthSessionResponse,
    AuthStatusResponse,
    DeveloperModeRequest,
    DeveloperModeResponse,
    LoginRequest,
    SignupRequest,
    session_response,
    user_response,
)
from momentum.auth.constants import AUTH_COOKIE_NAME
from momentum.auth.domain.errors import (
    DeveloperAuthorizationRequired,
    InvalidAuthenticationInput,
    InvalidCredentials,
    OwnerAlreadyExists,
)
from momentum.auth.domain.models import CurrentSession
from momentum.auth.services.authentication_service import AuthenticationService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/status", response_model=AuthStatusResponse, summary="Get authentication status")
def auth_status(
    request: Request,
    service: AuthenticationService = Depends(get_authentication_service),
) -> AuthStatusResponse:
    current = service.authenticate(request.cookies.get(AUTH_COOKIE_NAME))
    return AuthStatusResponse(
        initialized=service.is_initialized(),
        authenticated=current is not None,
        developer_authorized=(
            service.is_developer_authorized(current.user) if current is not None else False
        ),
        developer_mode=service.developer_mode_active(current) if current is not None else False,
    )


@router.post(
    "/signup",
    response_model=AuthenticatedUserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Establish the database owner",
)
def signup(
    payload: SignupRequest,
    service: AuthenticationService = Depends(get_authentication_service),
) -> AuthenticatedUserResponse:
    try:
        user = service.signup(
            name=payload.name, username=payload.username, password=payload.password
        )
    except OwnerAlreadyExists as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except InvalidAuthenticationInput as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc
    return user_response(user)


@router.post("/login", response_model=AuthSessionResponse, summary="Create a persistent session")
def login(
    payload: LoginRequest,
    response: Response,
    service: AuthenticationService = Depends(get_authentication_service),
) -> AuthSessionResponse:
    try:
        result = service.login(username=payload.username, password=payload.password)
    except InvalidCredentials as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=result.raw_token,
        expires=result.current_session.session.expires_at,
        max_age=int(service.session_lifetime.total_seconds()),
        httponly=True,
        secure=service.cookie_secure,
        samesite="lax",
        path="/",
    )
    return session_response(result.current_session, service)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Revoke this session")
def logout(
    request: Request,
    response: Response,
    service: AuthenticationService = Depends(get_authentication_service),
) -> None:
    service.logout(request.cookies.get(AUTH_COOKIE_NAME))
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        path="/",
        secure=service.cookie_secure,
        httponly=True,
        samesite="lax",
    )


@router.get("/me", response_model=AuthSessionResponse, summary="Get the current owner")
def me(
    current: CurrentSession = Depends(get_current_session),
    service: AuthenticationService = Depends(get_authentication_service),
) -> AuthSessionResponse:
    return session_response(current, service)


@router.post(
    "/developer-mode",
    response_model=DeveloperModeResponse,
    summary="Set developer mode for this session",
)
def set_developer_mode(
    payload: DeveloperModeRequest,
    current: CurrentSession = Depends(get_current_session),
    service: AuthenticationService = Depends(get_authentication_service),
) -> DeveloperModeResponse:
    try:
        updated = service.set_developer_mode(current, enabled=payload.enabled)
    except DeveloperAuthorizationRequired as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return DeveloperModeResponse(
        developer_authorized=service.is_developer_authorized(updated.user),
        developer_mode=service.developer_mode_active(updated),
    )
