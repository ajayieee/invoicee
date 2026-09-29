'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole, RolePermissions, OrganizationContext } from '@/types/auth';
import { authService, SYSTEM_USERS } from '@/services/auth.service';

interface AuthContextType {
  user: User;
  organization: OrganizationContext;
  permissions: RolePermissions;
  availableUsers: User[];
  switchUser: (userId: string) => void;
  switchRole: (role: UserRole) => void;
  hasPermission: (permission: keyof RolePermissions) => boolean;
  refreshOrgContext: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User>(authService.getCurrentUser());
  const [orgContext, setOrgContext] = useState<OrganizationContext>(authService.getOrganizationContext());

  const refreshOrgContext = () => {
    setOrgContext(authService.getOrganizationContext());
  };

  const handleSwitchUser = (userId: string) => {
    const user = authService.switchUser(userId);
    setCurrentUser({ ...user });
  };

  const handleSwitchRole = (role: UserRole) => {
    // Finds first user with this role or creates temporary role view
    const matched = SYSTEM_USERS.find((u) => u.role === role);
    if (matched) {
      handleSwitchUser(matched.id);
    } else {
      const updated = { ...currentUser, role };
      setCurrentUser(updated);
    }
  };

  const permissions = authService.getUserPermissions(currentUser.role);

  const hasPermission = (permission: keyof RolePermissions): boolean => {
    return permissions[permission] ?? false;
  };

  return (
    <AuthContext.Provider
      value={{
        user: currentUser,
        organization: orgContext,
        permissions,
        availableUsers: SYSTEM_USERS,
        switchUser: handleSwitchUser,
        switchRole: handleSwitchRole,
        hasPermission,
        refreshOrgContext,
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
