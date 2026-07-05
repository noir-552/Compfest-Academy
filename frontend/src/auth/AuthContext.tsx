import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import type { AuthUser, LoginResponse, RoleType } from '../api/auth';
import { getToken, setToken } from '../api/client';

export interface AuthContextValue {
  user: AuthUser | null;
  roles: RoleType[];
  activeRole: RoleType | null;
  /** True while the boot-time `/auth/me` check (when a token is present) is in flight. */
  loading: boolean;
  login: (username: string, password: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  setActiveRole: (role: RoleType) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [roles, setRoles] = useState<RoleType[]>([]);
  const [activeRole, setActiveRoleState] = useState<RoleType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    authApi
      .me()
      .then((res) => {
        setUser(res.user);
        setRoles(res.roles);
        setActiveRoleState(res.activeRole);
      })
      .catch(() => {
        setToken(null);
        setUser(null);
        setRoles([]);
        setActiveRoleState(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login(username, password);
    setToken(res.token);
    setUser(res.user);
    setRoles(res.roles);
    setActiveRoleState(res.activeRole);
    return res;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setToken(null);
      setUser(null);
      setRoles([]);
      setActiveRoleState(null);
    }
  }, []);

  const setActiveRole = useCallback(async (role: RoleType) => {
    const res = await authApi.setActiveRoleRequest(role);
    setActiveRoleState(res.activeRole);
  }, []);

  return (
    <AuthContext.Provider value={{ user, roles, activeRole, loading, login, logout, setActiveRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
