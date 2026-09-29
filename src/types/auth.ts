import { UAEEmirate } from './database';

export type UserRole = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'SALES' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  name: string;
  title: string;
  role: UserRole;
  organization_id: string;
  avatar_color: string;
}

export interface OrganizationContext {
  id: string;
  name: string;
  trn: string;
  emirate: UAEEmirate;
  currency: string;
}

export interface RolePermissions {
  canEditCompanySettings: boolean;
  canCreateInvoice: boolean;
  canApproveQuote: boolean;
  canRecordPayment: boolean;
  canIssueCreditNote: boolean;
  canManageCustomers: boolean;
  canManageProducts: boolean;
  canViewReports: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  OWNER: {
    canEditCompanySettings: true,
    canCreateInvoice: true,
    canApproveQuote: true,
    canRecordPayment: true,
    canIssueCreditNote: true,
    canManageCustomers: true,
    canManageProducts: true,
    canViewReports: true,
  },
  ADMIN: {
    canEditCompanySettings: true,
    canCreateInvoice: true,
    canApproveQuote: true,
    canRecordPayment: true,
    canIssueCreditNote: true,
    canManageCustomers: true,
    canManageProducts: true,
    canViewReports: true,
  },
  ACCOUNTANT: {
    canEditCompanySettings: false,
    canCreateInvoice: true,
    canApproveQuote: true,
    canRecordPayment: true,
    canIssueCreditNote: true,
    canManageCustomers: true,
    canManageProducts: true,
    canViewReports: true,
  },
  SALES: {
    canEditCompanySettings: false,
    canCreateInvoice: true,
    canApproveQuote: true,
    canRecordPayment: false,
    canIssueCreditNote: false,
    canManageCustomers: true,
    canManageProducts: false,
    canViewReports: false,
  },
  VIEWER: {
    canEditCompanySettings: false,
    canCreateInvoice: false,
    canApproveQuote: false,
    canRecordPayment: false,
    canIssueCreditNote: false,
    canManageCustomers: false,
    canManageProducts: false,
    canViewReports: true,
  },
};
