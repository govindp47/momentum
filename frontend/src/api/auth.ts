import { ApiError, apiClient } from "./client";
import type {
  AuthSessionResponse,
  AuthState,
  AuthStatusResponse,
  AuthenticatedUser,
  DeveloperModeResponse,
  LoginRequest,
  SignupRequest,
} from "@/types/auth";

const AUTH_BASE = "/v1/auth";

const signedOutState = (setupRequired: boolean): AuthState => ({
  setupRequired,
  authenticated: false,
  currentUser: null,
  developerAuthorized: false,
  developerModeEnabled: false,
});

const sessionState = (session: AuthSessionResponse): AuthState => ({
  setupRequired: false,
  authenticated: true,
  currentUser: session.user,
  developerAuthorized: session.developer_authorized,
  developerModeEnabled: session.developer_mode,
});

export const authApi = {
  async getState(): Promise<AuthState> {
    const status = await apiClient.get<AuthStatusResponse>(
      `${AUTH_BASE}/status`,
    );

    if (!status.initialized) {
      return signedOutState(true);
    }
    if (!status.authenticated) {
      return signedOutState(false);
    }

    try {
      return sessionState(
        await apiClient.get<AuthSessionResponse>(`${AUTH_BASE}/me`),
      );
    } catch (error) {
      // The session may expire between the status and owner requests.
      if (error instanceof ApiError && error.status === 401) {
        return signedOutState(false);
      }
      throw error;
    }
  },

  signup(payload: SignupRequest): Promise<AuthenticatedUser> {
    return apiClient.post<AuthenticatedUser>(`${AUTH_BASE}/signup`, payload);
  },

  login(payload: LoginRequest): Promise<AuthSessionResponse> {
    return apiClient.post<AuthSessionResponse>(`${AUTH_BASE}/login`, payload);
  },

  logout(): Promise<void> {
    return apiClient.post<void>(`${AUTH_BASE}/logout`, undefined);
  },

  setDeveloperMode(enabled: boolean): Promise<DeveloperModeResponse> {
    return apiClient.post<DeveloperModeResponse>(
      `${AUTH_BASE}/developer-mode`,
      {
        enabled,
      },
    );
  },
};

export { sessionState, signedOutState };
