"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";

export type Role = "ADMIN" | "TEACHER" | "STUDENT";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: string[];
};

/** Admins hold every permission; teachers only the ones granted to them. */
export const can = (u: User | null, perm: string) =>
  !!u && (u.role === "ADMIN" || (u.role === "TEACHER" && u.permissions.includes(perm)));

/** Where each role lands after login. */
export const homeFor = (role: Role) => (role === "ADMIN" ? "/admin" : "/dashboard");

type Ctx = {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
};

const AuthCtx = createContext<Ctx>(null as never);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      // Token lives in localStorage, so it can only be read after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    api<User>("/auth/me")
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((token: string, u: User) => {
    setToken(token);
    setUser(u);
  }, []);
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  }, []);

  return <AuthCtx.Provider value={{ user, loading, login, logout }}>{children}</AuthCtx.Provider>;
}

/**
 * Redirects to /login when signed out, and to the user's home when their role
 * is not in `roles`. Returns the user once it is known and allowed.
 */
export function useRequireUser(...roles: Role[]) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = !!user && (roles.length === 0 || roles.includes(user.role));
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!allowed) router.replace(homeFor(user.role));
  }, [user, loading, allowed, router]);
  return allowed ? user : null;
}
