'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, UserRole, RolePermissions, OrganizationContext } from '@/types/auth';
import { authService, SYSTEM_USERS } from '@/services/auth.service';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const AUTH_TOKEN_KEY = 'auth_token';

const DEFAULT_USER: User = SYSTEM_USERS[0] || {
  id: 'usr_guest',
  name: 'User',
  email: '',
  title: 'Staff Member',
  role: 'VIEWER',
  organization_id: 'org_pixelflames_001',
  avatar_color: 'bg-emerald-600',
};

interface AuthContextType {
  user: User;
  organization: OrganizationContext;
  permissions: RolePermissions;
  availableUsers: User[];
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  inviteMember: (data: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    title: string;
  }) => Promise<{ success: boolean; error?: string }>;
  updateUserRole: (
    userId: string,
    role: UserRole,
    title?: string
  ) => Promise<{ success: boolean; error?: string }>;
  hasPermission: (permission: keyof RolePermissions) => boolean;
  refreshOrgContext: () => void;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapMongoUser(doc: any): User {
  return {
    id: doc._id?.toString() || doc.id || 'usr_unknown',
    name: doc.name || 'User',
    email: doc.email || '',
    title: doc.title || 'Team Member',
    role: doc.role || 'VIEWER',
    organization_id: doc.organizationId || doc.organization_id || 'org_pixelflames_001',
    avatar_color: doc.avatarColor || doc.avatar_color || 'bg-emerald-600',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User>(DEFAULT_USER);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [availableUsers, setAvailableUsers] = useState<User[]>(SYSTEM_USERS);
  const [orgContext, setOrgContext] = useState<OrganizationContext>(authService.getOrganizationContext());

  const refreshOrgContext = () => {
    setOrgContext(authService.getOrganizationContext());
  };

  const refreshUsers = useCallback(async () => {
    try {
      const savedToken = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
      if (!savedToken) return;

      const res = await fetch(`${API_BASE_URL}/auth/users`, {
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        const mapped = data.data.map(mapMongoUser);
        setAvailableUsers(mapped);
      }
    } catch {
      // Backend offline or unreachable, retain fallback
    }
  }, []);

  useEffect(() => {
    async function initAuth() {
      if (typeof window === 'undefined') return;

      const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!savedToken) {
        setIsLoading(false);
        setIsAuthenticated(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        });
        const data = await res.json();
        if (data.success && data.data) {
          const mapped = mapMongoUser(data.data);
          setCurrentUser(mapped);
          setToken(savedToken);
          setIsAuthenticated(true);
          await refreshUsers();
        } else {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          setIsAuthenticated(false);
          setCurrentUser(DEFAULT_USER);
        }
      } catch {
        setIsAuthenticated(false);
        setCurrentUser(DEFAULT_USER);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, [refreshUsers]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Invalid email or password.' };
      }

      const receivedToken = data.token;
      const mappedUser = mapMongoUser(data.user);

      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_TOKEN_KEY, receivedToken);
      }

      setToken(receivedToken);
      setCurrentUser(mappedUser);
      setIsAuthenticated(true);

      setTimeout(() => {
        refreshUsers();
      }, 100);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Authentication server connection error.' };
    }
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    setToken(null);
    setCurrentUser(DEFAULT_USER);
    setIsAuthenticated(false);
  };

  const inviteMember = async (data: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    title: string;
  }) => {
    if (currentUser?.role !== 'OWNER' && currentUser?.role !== 'ADMIN') {
      return { success: false, error: 'Access denied: Only organization administrators can invite new members.' };
    }

    try {
      const savedToken = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (savedToken) {
        headers['Authorization'] = `Bearer ${savedToken}`;
      }

      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Failed to create user account.' };
      }

      await refreshUsers();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error while contacting registration service.' };
    }
  };

  const updateUserRole = async (
    userId: string,
    role: UserRole,
    title?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (currentUser?.role !== 'OWNER' && currentUser?.role !== 'ADMIN') {
      return { success: false, error: 'Administrative privileges required to modify user roles.' };
    }

    if (currentUser?.id === userId) {
      return { success: false, error: 'Administrators cannot modify their own role. Your administrator account is protected.' };
    }

    try {
      const savedToken = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (savedToken) {
        headers['Authorization'] = `Bearer ${savedToken}`;
      }

      const res = await fetch(`${API_BASE_URL}/auth/users/${userId}/role`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ role, title }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Failed to update user role.' };
      }

      await refreshUsers();

      if (currentUser?.id === userId) {
        setCurrentUser((prev) => ({
          ...prev,
          role,
          title: title || prev.title,
        }));
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error while updating user role.' };
    }
  };

  const permissions: RolePermissions = currentUser
    ? authService.getUserPermissions(currentUser.role)
    : {
        canEditCompanySettings: false,
        canCreateInvoice: false,
        canApproveQuote: false,
        canRecordPayment: false,
        canIssueCreditNote: false,
        canManageCustomers: false,
        canManageProducts: false,
        canViewReports: false,
      };

  const hasPermission = (permission: keyof RolePermissions): boolean => {
    return permissions[permission] ?? false;
  };

  return (
    <AuthContext.Provider
      value={{
        user: currentUser,
        organization: orgContext,
        permissions,
        availableUsers,
        token,
        isAuthenticated,
        isLoading,
        login,
        logout,
        inviteMember,
        updateUserRole,
        hasPermission,
        refreshOrgContext,
        refreshUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
