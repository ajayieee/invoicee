import { Customer, CustomerRelation, CustomerType, UAEEmirate, Invoice, Quote, Payment } from '@/types/database';
import { PaginatedResult, ServiceResponse } from '@/types/service';
import { db } from '@/lib/db/repository';
import { ValidationRules } from '@/lib/validation/rules';

export interface CustomerQuery {
  search?: string;
  relationType?: CustomerRelation | 'ALL';
  emirate?: UAEEmirate | 'ALL';
  page?: number;
  pageSize?: number;
  isActive?: boolean;
}

export interface CustomerInput {
  customer_type: CustomerType;
  relation_type: CustomerRelation;
  company_name?: string;
  contact_person: string;
  email?: string;
  phone?: string;
  mobile?: string;
  trn?: string;
  billing_emirate?: UAEEmirate;
  billing_address_line_1?: string;
  billing_address_line_2?: string;
  billing_city?: string;
  billing_po_box?: string;
  payment_terms_days: number;
  currency?: string;
  notes?: string;
}

export interface Customer360Summary {
  customer: Customer;
  invoices: Invoice[];
  quotes: Quote[];
  payments: Payment[];
  totalInvoiced: number;
  totalPaid: number;
  totalBalanceDue: number;
  overdueCount: number;
}

class CustomerService {
  validateCustomer(data: Partial<CustomerInput>): Record<string, string> {
    const errors: Record<string, string> = {};

    // Contact Person
    const contactCheck = ValidationRules.required(data.contact_person, 'Contact Person');
    if (!contactCheck.isValid && contactCheck.error) {
      errors.contact_person = contactCheck.error;
    }

    // Company Name is required if type is COMPANY
    if (data.customer_type === 'COMPANY') {
      const companyCheck = ValidationRules.required(data.company_name, 'Company Name');
      if (!companyCheck.isValid && companyCheck.error) {
        errors.company_name = companyCheck.error;
      }
    }

    // UAE 15-Digit TRN
    if (data.trn && data.trn.trim()) {
      const trnCheck = ValidationRules.trn(data.trn, false);
      if (!trnCheck.isValid && trnCheck.error) {
        errors.trn = trnCheck.error;
      }
    }

    // Email
    if (data.email && data.email.trim()) {
      const emailCheck = ValidationRules.email(data.email, false);
      if (!emailCheck.isValid && emailCheck.error) {
        errors.email = emailCheck.error;
      }
    }

    // Phone / Mobile
    if (data.phone && data.phone.trim()) {
      const phoneCheck = ValidationRules.phone(data.phone, false);
      if (!phoneCheck.isValid && phoneCheck.error) {
        errors.phone = phoneCheck.error;
      }
    }

    if (data.mobile && data.mobile.trim()) {
      const mobileCheck = ValidationRules.phone(data.mobile, false);
      if (!mobileCheck.isValid && mobileCheck.error) {
        errors.mobile = mobileCheck.error;
      }
    }

    // Payment Terms
    if (data.payment_terms_days !== undefined) {
      const termsCheck = ValidationRules.positiveNumber(
        data.payment_terms_days,
        'Payment Terms',
        true
      );
      if (!termsCheck.isValid && termsCheck.error) {
        errors.payment_terms_days = termsCheck.error;
      }
    }

    return errors;
  }

  getCustomers(query: CustomerQuery = {}): PaginatedResult<Customer> {
    const {
      search = '',
      relationType = 'ALL',
      emirate = 'ALL',
      page = 1,
      pageSize = 10,
      isActive,
    } = query;

    const all = db.getCustomers();

    const filtered = all.filter((c) => {
      // Active filter
      if (isActive !== undefined && c.is_active !== isActive) {
        return false;
      }

      // Relation Filter
      if (relationType !== 'ALL' && c.relation_type !== relationType) {
        return false;
      }

      // Emirate Filter
      if (emirate !== 'ALL' && c.billing_emirate !== emirate) {
        return false;
      }

      // Search Query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName =
          (c.company_name && c.company_name.toLowerCase().includes(q)) ||
          c.contact_person.toLowerCase().includes(q);
        const matchTrn = c.trn && c.trn.toLowerCase().includes(q);
        const matchEmail = c.email && c.email.toLowerCase().includes(q);
        const matchPhone =
          (c.phone && c.phone.includes(q)) || (c.mobile && c.mobile.includes(q));
        const matchCity = c.billing_city && c.billing_city.toLowerCase().includes(q);

        if (!matchName && !matchTrn && !matchEmail && !matchPhone && !matchCity) {
          return false;
        }
      }

      return true;
    });

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const items = filtered.slice(startIndex, startIndex + pageSize);

    return {
      items,
      totalItems,
      currentPage: safePage,
      totalPages,
      pageSize,
    };
  }

  getCustomerById(id: string): Customer | null {
    return db.getCustomerById(id) || null;
  }

  getCustomer360(id: string): Customer360Summary | null {
    const customer = db.getCustomerById(id);
    if (!customer) return null;

    const invoices = db.getInvoices().filter((i) => i.customer_id === id);
    const quotes = db.getQuotes().filter((q) => q.customer_id === id);
    const payments = db.getPayments().filter((p) => p.customer_id === id);

    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalBalanceDue = 0;
    let overdueCount = 0;

    for (const inv of invoices) {
      if (inv.status !== 'CANCELLED') {
        totalInvoiced += inv.grand_total;
        totalPaid += inv.amount_paid;
        totalBalanceDue += inv.balance_due;
        if (inv.status === 'OVERDUE') {
          overdueCount++;
        }
      }
    }

    return {
      customer,
      invoices,
      quotes,
      payments,
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalBalanceDue: Math.round(totalBalanceDue * 100) / 100,
      overdueCount,
    };
  }

  createCustomer(
    data: CustomerInput,
    performedBy = 'Current User'
  ): ServiceResponse<Customer> {
    const errors = this.validateCustomer(data);
    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        errors,
        error: 'Please resolve form validation errors before submitting.',
      };
    }

    try {
      const saved = db.saveCustomer({
        customer_type: data.customer_type,
        relation_type: data.relation_type,
        company_name: data.customer_type === 'COMPANY' ? data.company_name?.trim() : undefined,
        contact_person: data.contact_person.trim(),
        email: data.email?.trim() || undefined,
        phone: data.phone?.trim() || undefined,
        mobile: data.mobile?.trim() || undefined,
        trn: data.trn?.trim() || undefined,
        billing_emirate: data.billing_emirate || 'DUBAI',
        billing_address_line_1: data.billing_address_line_1?.trim() || undefined,
        billing_address_line_2: data.billing_address_line_2?.trim() || undefined,
        billing_city: data.billing_city?.trim() || 'Dubai',
        billing_po_box: data.billing_po_box?.trim() || undefined,
        payment_terms_days: Number(data.payment_terms_days) || 30,
        currency: data.currency || 'AED',
        notes: data.notes?.trim() || undefined,
      });

      return {
        success: true,
        data: saved,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || 'Failed to create customer.',
      };
    }
  }

  updateCustomer(
    id: string,
    data: CustomerInput,
    performedBy = 'Current User'
  ): ServiceResponse<Customer> {
    const errors = this.validateCustomer(data);
    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        errors,
        error: 'Please resolve form validation errors before saving.',
      };
    }

    try {
      const existing = db.getCustomerById(id);
      if (!existing) {
        return { success: false, error: 'Customer not found.' };
      }

      const saved = db.saveCustomer({
        id,
        customer_type: data.customer_type,
        relation_type: data.relation_type,
        company_name: data.customer_type === 'COMPANY' ? data.company_name?.trim() : undefined,
        contact_person: data.contact_person.trim(),
        email: data.email?.trim() || undefined,
        phone: data.phone?.trim() || undefined,
        mobile: data.mobile?.trim() || undefined,
        trn: data.trn?.trim() || undefined,
        billing_emirate: data.billing_emirate || 'DUBAI',
        billing_address_line_1: data.billing_address_line_1?.trim() || undefined,
        billing_address_line_2: data.billing_address_line_2?.trim() || undefined,
        billing_city: data.billing_city?.trim() || 'Dubai',
        billing_po_box: data.billing_po_box?.trim() || undefined,
        payment_terms_days: Number(data.payment_terms_days) || 30,
        currency: data.currency || existing.currency || 'AED',
        notes: data.notes?.trim() || undefined,
      });

      return {
        success: true,
        data: saved,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || 'Failed to update customer.',
      };
    }
  }

  deleteCustomer(id: string, performedBy = 'Current User'): ServiceResponse<boolean> {
    // Check if customer has associated invoices or quotes
    const invoices = db.getInvoices().filter((i) => i.customer_id === id);
    if (invoices.length > 0) {
      return {
        success: false,
        error: `Cannot delete account: ${invoices.length} financial invoices exist for this entity. In accordance with UAE accounting regulations, financial records cannot be orphaned. You can mark this customer as inactive instead.`,
      };
    }

    const quotes = db.getQuotes().filter((q) => q.customer_id === id);
    if (quotes.length > 0) {
      return {
        success: false,
        error: `Cannot delete account: ${quotes.length} quotations are linked to this client. You can deactivate the account instead.`,
      };
    }

    try {
      db.deleteCustomer(id);
      return {
        success: true,
        data: true,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || 'Failed to delete customer.',
      };
    }
  }

  toggleActive(id: string): ServiceResponse<Customer> {
    const existing = db.getCustomerById(id);
    if (!existing) {
      return { success: false, error: 'Customer not found.' };
    }

    const updated = db.saveCustomer({
      ...existing,
      is_active: !existing.is_active,
    });

    return { success: true, data: updated };
  }
}

export const customerService = new CustomerService();
