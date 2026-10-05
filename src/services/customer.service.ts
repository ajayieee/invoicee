import { Customer, CustomerRelation, CustomerType, UAEEmirate, Invoice, Quote, Payment, CreditNote } from '@/types/database';
import { PaginatedResult, ServiceResponse } from '@/types/service';
import { db } from '@/lib/db/repository';
import { ValidationRules } from '@/lib/validation/rules';
import { apiClient } from '@/lib/api/client';

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
  creditNotes: CreditNote[];
  totalInvoiced: number;
  totalPaid: number;
  totalCredited: number;
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

  /**
   * Synchronize all customers from MongoDB Atlas Express API directly into local store.
   */
  async syncCustomers(query: CustomerQuery = {}): Promise<Customer[]> {
    try {
      const res = await apiClient.get<{ success: boolean; items: Customer[] }>('/customers', {
        pageSize: 1000,
        relationType: query.relationType !== 'ALL' ? query.relationType : undefined,
        emirate: query.emirate !== 'ALL' ? query.emirate : undefined,
        search: query.search?.trim() || undefined,
      });

      if (res && res.success && Array.isArray(res.items)) {
        res.items.forEach((c) => {
          db.upsertCustomer(c);
        });
        return res.items;
      }
    } catch (err) {
      console.warn('[CustomerService] Atlas sync failed, using cached store:', err);
    }
    return db.getCustomers();
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
    const creditNotes = db.getCreditNotes().filter((cn) => cn.customer_id === id && cn.status !== 'CANCELLED');

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

    const totalCredited = creditNotes.reduce((sum, cn) => sum + cn.grand_total, 0);

    return {
      customer,
      invoices,
      quotes,
      payments,
      creditNotes,
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalCredited: Math.round(totalCredited * 100) / 100,
      totalBalanceDue: Math.round(totalBalanceDue * 100) / 100,
      overdueCount,
    };
  }

  /**
   * Persists customer directly to MongoDB Atlas REST API and synchronizes locally.
   */
  async createCustomer(
    data: CustomerInput,
    performedBy = 'Current User'
  ): Promise<ServiceResponse<Customer>> {
    const errors = this.validateCustomer(data);
    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        errors,
        error: 'Please resolve form validation errors before submitting.',
      };
    }

    const payload = {
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
    };

    try {
      // 1. Save directly to MongoDB Atlas
      const res = await apiClient.post<{ success: boolean; data: Customer }>('/customers', payload);
      if (res && res.success && res.data) {
        // 2. Synchronize to local DB
        const saved = db.upsertCustomer(res.data);
        return {
          success: true,
          data: saved,
        };
      }
      throw new Error('Unexpected response from customer API');
    } catch (e: any) {
      console.warn('[CustomerService] Cloud API error, saving to local store:', e.message);
      try {
        const localSaved = db.saveCustomer(payload);
        return {
          success: true,
          data: localSaved,
        };
      } catch (localErr: any) {
        return {
          success: false,
          error: e.message || localErr.message || 'Failed to create customer.',
        };
      }
    }
  }

  /**
   * Updates customer in MongoDB Atlas REST API and synchronizes locally.
   */
  async updateCustomer(
    id: string,
    data: CustomerInput,
    performedBy = 'Current User'
  ): Promise<ServiceResponse<Customer>> {
    const errors = this.validateCustomer(data);
    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        errors,
        error: 'Please resolve form validation errors before saving.',
      };
    }

    const payload = {
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
    };

    try {
      const res = await apiClient.put<{ success: boolean; data: Customer }>(`/customers/${id}`, payload);
      if (res && res.success && res.data) {
        const saved = db.upsertCustomer(res.data);
        return { success: true, data: saved };
      }
      throw new Error('Unexpected response from update customer API');
    } catch (e: any) {
      console.warn('[CustomerService] Cloud API error on update, updating local:', e.message);
      try {
        const saved = db.saveCustomer({ id, ...payload });
        return { success: true, data: saved };
      } catch (localErr: any) {
        return {
          success: false,
          error: e.message || localErr.message || 'Failed to update customer.',
        };
      }
    }
  }

  /**
   * Deletes customer in MongoDB Atlas REST API and deletes locally.
   */
  async deleteCustomer(id: string, performedBy = 'Current User'): Promise<ServiceResponse<boolean>> {
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
      await apiClient.delete(`/customers/${id}`);
      db.deleteCustomer(id);
      return {
        success: true,
        data: true,
      };
    } catch (e: any) {
      // If local ID or server returned error, attempt local delete if not present on server
      try {
        db.deleteCustomer(id);
        return { success: true, data: true };
      } catch (localErr: any) {
        return {
          success: false,
          error: e.message || 'Failed to delete customer.',
        };
      }
    }
  }

  async toggleActive(id: string): Promise<ServiceResponse<Customer>> {
    const existing = db.getCustomerById(id);
    if (!existing) {
      return { success: false, error: 'Customer not found.' };
    }

    const nextActive = !existing.is_active;

    try {
      const res = await apiClient.put<{ success: boolean; data: Customer }>(`/customers/${id}`, {
        is_active: nextActive,
      });
      if (res && res.success && res.data) {
        const updated = db.upsertCustomer(res.data);
        return { success: true, data: updated };
      }
    } catch (e) {
      console.warn('[CustomerService] Cloud toggleActive error, updating local:', e);
    }

    const updated = db.saveCustomer({
      ...existing,
      is_active: nextActive,
    });
    return { success: true, data: updated };
  }
}

export const customerService = new CustomerService();
