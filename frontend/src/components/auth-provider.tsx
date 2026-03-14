"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getCurrentUser,
  listDemoUsers,
  login as loginRequest,
  setAuthToken,
} from "@/lib/api";
import type { AuthenticatedUser, DemoUserCredentials } from "@/lib/types";

type AuthContextValue = {
  user: AuthenticatedUser | null;
  demoUsers: DemoUserCredentials[];
  isReady: boolean;
  isLoadingDemoUsers: boolean;
  isAuthenticating: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const STORAGE_KEY = "sigma-demo-auth-token";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [demoUsers, setDemoUsers] = useState<DemoUserCredentials[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isLoadingDemoUsers, setIsLoadingDemoUsers] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDemoUsers() {
      try {
        const response = await listDemoUsers();
        if (!cancelled) {
          setDemoUsers(response.users);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Failed to load demo users.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDemoUsers(false);
        }
      }
    }

    void loadDemoUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const token = window.localStorage.getItem(STORAGE_KEY);
      if (!token) {
        setIsReady(true);
        return;
      }

      setAuthToken(token);
      try {
        const currentUser = await getCurrentUser();
        if (!cancelled) {
          setUser(currentUser);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        setAuthToken(null);
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsAuthenticating(true);
      setError(null);
      try {
        const response = await loginRequest(email, password);
        setAuthToken(response.access_token);
        window.localStorage.setItem(STORAGE_KEY, response.access_token);
        queryClient.clear();
        setUser(response.user);
      } catch (nextError) {
        setAuthToken(null);
        window.localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setError(nextError instanceof Error ? nextError.message : "Login failed.");
        throw nextError;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setError(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      demoUsers,
      isReady,
      isLoadingDemoUsers,
      isAuthenticating,
      error,
      login,
      logout,
    }),
    [demoUsers, error, isAuthenticating, isLoadingDemoUsers, isReady, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
