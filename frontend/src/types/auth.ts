export interface AuthenticatedUser {
  id: number;
  name: string;
  username: string;
}

export interface AuthStatusResponse {
  initialized: boolean;
  authenticated: boolean;
  developer_authorized: boolean;
  developer_mode: boolean;
}

export interface AuthSessionResponse {
  user: AuthenticatedUser;
  developer_authorized: boolean;
  developer_mode: boolean;
}

export interface DeveloperModeResponse {
  developer_authorized: boolean;
  developer_mode: boolean;
}

export interface SignupRequest {
  name: string;
  username: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthState {
  setupRequired: boolean;
  authenticated: boolean;
  currentUser: AuthenticatedUser | null;
  developerAuthorized: boolean;
  developerModeEnabled: boolean;
}
