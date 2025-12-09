import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { request } from "../api/http";

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "cte_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserFromToken = useCallback(async (existingToken: string) => {
    try {
      const res = await request<{ user: User }>({
        path: "/auth/me",
        method: "GET",
        token: existingToken,
      });
      setUser(res.user);
      setToken(existingToken);
    } catch (_error) {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      loadUserFromToken(storedToken);
    } else {
      setLoading(false);
    }
  }, [loadUserFromToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const res = await request<{ token: string; user: User }>({
          path: "/auth/login",
          method: "POST",
          body: { email, password },
        });
        localStorage.setItem(TOKEN_KEY, res.token);
        setUser(res.user);
        setToken(res.token);
      } catch (error) {
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      setLoading(true);
      try {
        const res = await request<{ token: string; user: User }>({
          path: "/auth/register",
          method: "POST",
          body: { name, email, password },
        });
        localStorage.setItem(TOKEN_KEY, res.token);
        setUser(res.user);
        setToken(res.token);
      } catch (error) {
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
    }),
    [user, token, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
