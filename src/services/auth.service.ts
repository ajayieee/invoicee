import { User, UserRole, OrganizationContext, ROLE_PERMISSIONS, RolePermissions } from '@/types/auth';
import { db } from '@/lib/db/repository';

export const SYSTEM_USERS: User[] = [
  {
    id: 'usr_admin_01',
    name: 'Ajay',
    email: 'ajay@pixelflames.com',
    title: 'Managing Director & Administrator',
    role: 'OWNER',
    organization_id: 'org_pixelflames_001',
    avatar_color: 'bg-emerald-600',
  },
];

const AUTH_USER_KEY = 'uae_invoice_active_user_id';

class AuthService {
  private currentUserId: string = SYSTEM_USERS[0].id;
  private isBrowser: boolean;

  constructor() {
    this.isBrowser = typeof window !== 'undefined';
    if (this.isBrowser) {
      const saved = localStorage.getItem(AUTH_USER_KEY);
      if (saved && SYSTEM_USERS.some((u) => u.id === saved)) {
        this.currentUserId = saved;
      }
    }
  }

  getCurrentUser(): User {
    const user = SYSTEM_USERS.find((u) => u.id === this.currentUserId);
    return user || SYSTEM_USERS[0];
  }

  switchUser(userId: string): User {
    const target = SYSTEM_USERS.find((u) => u.id === userId);
    if (!target) {
      throw new Error(`User with ID ${userId} not found.`);
    }
    this.currentUserId = target.id;
    if (this.isBrowser) {
      localStorage.setItem(AUTH_USER_KEY, target.id);
    }
    return target;
  }

  getAvailableUsers(): User[] {
    return [...SYSTEM_USERS];
  }

  getUserPermissions(role?: UserRole): RolePermissions {
    const targetRole = role || this.getCurrentUser().role;
    return ROLE_PERMISSIONS[targetRole];
  }

  hasPermission(permission: keyof RolePermissions, role?: UserRole): boolean {
    const perms = this.getUserPermissions(role);
    return perms[permission] ?? false;
  }

  getOrganizationContext(): OrganizationContext {
    const settings = db.getCompanySettings();
    return {
      id: settings.organization_id,
      name: settings.trading_name || settings.legal_company_name,
      trn: settings.trn,
      emirate: settings.emirate,
      currency: settings.default_currency,
    };
  }
}

export const authService = new AuthService();
