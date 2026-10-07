import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authApi, sessionState, signedOutState } from "@/api/auth";
import { ApiError } from "@/api/client";
import type {
  AuthState,
  DeveloperModeResponse,
  LoginRequest,
  SignupRequest,
} from "@/types/auth";

export const AUTH_QUERY_KEY = ["auth", "session"] as const;

export function useAuth() {
  const query = useQuery<AuthState, Error>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: authApi.getState,
    staleTime: 60_000,
    retry: false,
  });

  return {
    ...query,
    loading: query.isPending,
    setupRequired: query.data?.setupRequired ?? false,
    authenticated: query.data?.authenticated ?? false,
    currentUser: query.data?.currentUser ?? null,
    developerAuthorized: query.data?.developerAuthorized ?? false,
    developerModeEnabled: query.data?.developerModeEnabled ?? false,
  };
}

export function useSignup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SignupRequest) => authApi.signup(payload),
    onSettled: async () => {
      // A conflict can mean setup completed in another tab or process.
      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginRequest) => authApi.login(payload),
    onSuccess: (session) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, sessionState(session));
    },
  });
}

function clearProtectedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== AUTH_QUERY_KEY[0],
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const completeLogout = () => {
    clearProtectedQueries(queryClient);
    queryClient.setQueryData(AUTH_QUERY_KEY, signedOutState(false));
  };

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: completeLogout,
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        completeLogout();
      }
    },
  });
}

export function useSetDeveloperMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.setDeveloperMode,
    onSuccess: (result: DeveloperModeResponse) => {
      queryClient.setQueryData<AuthState>(AUTH_QUERY_KEY, (current) =>
        current?.currentUser
          ? {
              ...current,
              developerAuthorized: result.developer_authorized,
              developerModeEnabled: result.developer_mode,
            }
          : current,
      );
    },
  });
}

export function expireSession(
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  clearProtectedQueries(queryClient);
  queryClient.setQueryData(AUTH_QUERY_KEY, signedOutState(false));
}
