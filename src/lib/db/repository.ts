import {
  CompanySettings,
  VatRate,
  PaymentMethod,
  ProductCategory,
  Product,
  Customer,
  Quote,
  Invoice,
  Payment,
  CreditNote,
  CreditNoteType,
  RefundStatus,
  CreditReasonCode,
  AuditLog,
  InvoiceStatus,
  QuoteStatus,
  CreditNoteStatus,
} from '@/types/database';
import {
  INITIAL_COMPANY_SETTINGS,
  INITIAL_VAT_RATES,
  INITIAL_PAYMENT_METHODS,
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  INITIAL_QUOTES,
  INITIAL_INVOICES,
  INITIAL_PAYMENTS,
  INITIAL_CREDIT_NOTES,
  INITIAL_AUDIT_LOGS,
} from './initialData';
import { DocumentSequencer } from '../numbering/sequencer';

const STORAGE_KEY = 'uae_invoice_saas_db_v1';

interface DatabaseStore {
  companySettings: CompanySettings;
  vatRates: VatRate[];
  paymentMethods: PaymentMethod[];
  categories: ProductCategory[];
  products: Product[];
  customers: Customer[];
  quotes: Quote[];
  invoices: Invoice[];
  payments: Payment[];
  creditNotes: CreditNote[];
  auditLogs: AuditLog[];
  sequences: Record<string, number>;
}

function getInitialStore(): DatabaseStore {
  return {
    companySettings: INITIAL_COMPANY_SETTINGS,
    vatRates: INITIAL_VAT_RATES,
    paymentMethods: INITIAL_PAYMENT_METHODS,
    categories: INITIAL_CATEGORIES,
    products: INITIAL_PRODUCTS,
    customers: INITIAL_CUSTOMERS,
    quotes: INITIAL_QUOTES,
    invoices: INITIAL_INVOICES,
    payments: INITIAL_PAYMENTS,
    creditNotes: INITIAL_CREDIT_NOTES,
    auditLogs: INITIAL_AUDIT_LOGS,
    sequences: {
      INV_2026: 5,
      QUO_2026: 3,
      CN_2026: 1,
      PAY_2026: 3,
    },
  };
}

class Repository {
  private store: DatabaseStore;
  private isBrowser: boolean;

  constructor() {
    this.isBrowser = typeof window !== 'undefined';
    this.store = getInitialStore();

    if (this.isBrowser) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          // If legacy demo branding is detected, clean up
          if (
            parsed.companySettings?.legal_company_name?.includes('Al Thuraya') ||
            parsed.companySettings?.trading_name?.includes('Al Thuraya')
          ) {
            localStorage.removeItem(STORAGE_KEY);
            this.store = getInitialStore();
            this.persist();
          } else {
            this.store = parsed;
            // Ensure default categories are populated if empty
            if (!this.store.categories || this.store.categories.length === 0) {
              this.store.categories = [...INITIAL_CATEGORIES];
              this.persist();
            }
          }
        } else {
          this.persist();
        }

        // Trigger background sync from MongoDB Atlas on load
        setTimeout(() => {
          this.syncFromCloud().catch(() => {});
        }, 100);
      } catch (e) {
        console.error('Failed to load local storage state:', e);
      }
    }
  }

  private persist() {
    if (this.isBrowser) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
      } catch (e) {
        console.error('Failed to save to local storage:', e);
      }
    }
  }

  public resetToDefault() {
    this.store = getInitialStore();
    this.persist();
  }

  public async syncFromCloud(): Promise<void> {
    if (!this.isBrowser) return;
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      let changed = false;

      // Fetch customers from MongoDB Atlas
      try {
        const custRes = await fetch(`${API_BASE}/customers?pageSize=1000`, { headers });
        if (custRes.ok) {
          const custData = await custRes.json();
          if (custData.success && Array.isArray(custData.items)) {
            const atlasCustomers = custData.items;
            if (atlasCustomers.length > 0) {
              this.store.customers = atlasCustomers;
              changed = true;
            }
          }
        }
      } catch (e) {
        console.warn('[DB] Could not sync customers from MongoDB Atlas:', e);
      }

      // Fetch invoices from MongoDB Atlas
      try {
        const invRes = await fetch(`${API_BASE}/invoices?pageSize=1000`, { headers });
        if (invRes.ok) {
          const invData = await invRes.json();
          if (invData.success && Array.isArray(invData.items)) {
            const atlasInvoices = invData.items;
            if (atlasInvoices.length > 0) {
              this.store.invoices = atlasInvoices;
              changed = true;
            }
          }
        }
      } catch (e) {
        console.warn('[DB] Could not sync invoices from MongoDB Atlas:', e);
      }

      // Fetch payments from MongoDB Atlas
      try {
        const payRes = await fetch(`${API_BASE}/payments?pageSize=1000`, { headers });
        if (payRes.ok) {
          const payData = await payRes.json();
          if (payData.success && Array.isArray(payData.items)) {
            const atlasPayments = payData.items;
            if (atlasPayments.length > 0) {
              this.store.payments = atlasPayments;
              changed = true;
            }
          }
        }
      } catch (e) {
        console.warn('[DB] Could not sync payments from MongoDB Atlas:', e);
      }

      // Fetch products from MongoDB Atlas
      try {
        const prodRes = await fetch(`${API_BASE}/products?pageSize=1000`, { headers });
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          if (prodData.success && Array.isArray(prodData.items)) {
            const atlasProducts = prodData.items;
            if (atlasProducts.length > 0) {
              this.store.products = atlasProducts;
              changed = true;
            }
          }
        }
      } catch (e) {
        console.warn('[DB] Could not sync products from MongoDB Atlas:', e);
      }

      // Fetch quotes from MongoDB Atlas
      try {
        const quoRes = await fetch(`${API_BASE}/quotes?pageSize=1000`, { headers });
        if (quoRes.ok) {
          const quoData = await quoRes.json();
          if (quoData.success && Array.isArray(quoData.items)) {
            const atlasQuotes = quoData.items;
            if (atlasQuotes.length > 0) {
              this.store.quotes = atlasQuotes;
              changed = true;
            }
          }
        }
      } catch (e) {
        console.warn('[DB] Could not sync quotes from MongoDB Atlas:', e);
      }

      if (changed) {
        this.persist();
        window.dispatchEvent(new CustomEvent('database-store-updated'));
      }
    } catch (err) {
      console.warn('[DB] syncFromCloud error:', err);
    }
  }

  public upsertCustomer(customer: Customer): Customer {
    const custId = customer.id || (customer as any)._id;
    const idx = this.store.customers.findIndex((c) => c.id === custId || (c as any)._id === custId);
    if (idx !== -1) {
      this.store.customers[idx] = { ...this.store.customers[idx], ...customer, id: custId };
    } else {
      this.store.customers.unshift({ ...customer, id: custId });
    }
    this.persist();
    return customer;
  }

  public upsertProduct(product: Product): Product {
    const prodId = product.id || (product as any)._id;
    const idx = this.store.products.findIndex((p) => p.id === prodId || (p as any)._id === prodId);
    if (idx !== -1) {
      this.store.products[idx] = { ...this.store.products[idx], ...product, id: prodId };
    } else {
      this.store.products.unshift({ ...product, id: prodId });
    }
    this.persist();
    return product;
  }

  public upsertQuote(quote: Quote): Quote {
    const quoId = quote.id || (quote as any)._id;
    const idx = this.store.quotes.findIndex((q) => q.id === quoId || (q as any)._id === quoId);
    if (idx !== -1) {
      this.store.quotes[idx] = { ...this.store.quotes[idx], ...quote, id: quoId };
    } else {
      this.store.quotes.unshift({ ...quote, id: quoId });
    }
    this.persist();
    return quote;
  }

  public upsertInvoice(invoice: Invoice): Invoice {
    const invId = invoice.id || (invoice as any)._id;
    const idx = this.store.invoices.findIndex((i) => i.id === invId || (i as any)._id === invId);
    if (idx !== -1) {
      this.store.invoices[idx] = { ...this.store.invoices[idx], ...invoice, id: invId };
    } else {
      this.store.invoices.unshift({ ...invoice, id: invId });
    }
    this.persist();
    return invoice;
  }

  public upsertPayment(payment: Payment): Payment {
    const payId = payment.id || (payment as any)._id;
    const idx = this.store.payments.findIndex((p) => p.id === payId || (p as any)._id === payId);
    if (idx !== -1) {
      this.store.payments[idx] = { ...this.store.payments[idx], ...payment, id: payId };
    } else {
      this.store.payments.unshift({ ...payment, id: payId });
    }
    this.persist();
    return payment;
  }

  // --- Audit Trail ---
  public logAudit(
    entityType: string,
    entityId: string,
    action: string,
    oldValues?: any,
    newValues?: any,
    performedByName: string = 'Current User'
  ) {
    const entry: AuditLog = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      organization_id: this.store.companySettings.organization_id,
      entity_type: entityType,
      entity_id: entityId,
      action: action,
      old_values: oldValues,
      new_values: newValues,
      performed_by_name: performedByName,
      created_at: new Date().toISOString(),
    };
    this.store.auditLogs.unshift(entry);
    this.persist();
  }

  public getAuditLogs(entityType?: string, entityId?: string): AuditLog[] {
    let list = [...this.store.auditLogs];
    if (entityType) {
      list = list.filter((l) => l.entity_type === entityType);
    }
    if (entityId) {
      list = list.filter((l) => l.entity_id === entityId);
    }
    return list;
  }

  // --- Sequential Number Allocation ---
  private allocateSequenceNumber(docType: 'INV' | 'QUO' | 'CN' | 'PAY', prefix: string): string {
    const year = new Date().getFullYear();
    const seqKey = `${docType}_${year}`;
    const nextVal = (this.store.sequences[seqKey] || 0) + 1;
    this.store.sequences[seqKey] = nextVal;
    this.persist();
    return DocumentSequencer.format(prefix, year, nextVal, 4);
  }

  // --- Company Settings ---
  public getCompanySettings(): CompanySettings {
    return { ...this.store.companySettings };
  }

  public updateCompanySettings(updates: Partial<CompanySettings>): CompanySettings {
    const old = { ...this.store.companySettings };
    this.store.companySettings = {
      ...this.store.companySettings,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.logAudit('COMPANY_SETTINGS', this.store.companySettings.id, 'UPDATED', old, updates);
    this.persist();
    return this.store.companySettings;
  }

  // --- VAT Rates ---
  public getVatRates(): VatRate[] {
    return [...this.store.vatRates];
  }

  public saveVatRate(rate: Partial<VatRate>): VatRate {
    if (rate.id) {
      const idx = this.store.vatRates.findIndex((v) => v.id === rate.id);
      if (idx !== -1) {
        this.store.vatRates[idx] = { ...this.store.vatRates[idx], ...rate } as VatRate;
        this.persist();
        return this.store.vatRates[idx];
      }
    }
    const newRate: VatRate = {
      id: `vat-${Date.now()}`,
      organization_id: this.store.companySettings.organization_id,
      code: rate.code || `VAT_${Date.now()}`,
      name: rate.name || 'Custom Rate',
      rate_percentage: rate.rate_percentage || 0,
      treatment: rate.treatment || 'STANDARD_RATED',
      is_active: rate.is_active ?? true,
      is_default: rate.is_default ?? false,
    };
    this.store.vatRates.push(newRate);
    this.persist();
    return newRate;
  }

  // --- Payment Methods ---
  public getPaymentMethods(): PaymentMethod[] {
    return [...this.store.paymentMethods];
  }

  // --- Categories & Products ---
  public getProductCategories(): ProductCategory[] {
    if (!this.store.categories || this.store.categories.length === 0) {
      this.store.categories = [...INITIAL_CATEGORIES];
      this.persist();
    }
    return [...this.store.categories];
  }

  public addProductCategory(category: Omit<ProductCategory, 'id' | 'organization_id'> & { id?: string }): ProductCategory {
    const newCat: ProductCategory = {
      id: category.id || `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      organization_id: this.store.companySettings?.organization_id || 'org_pixelflames_001',
      name: category.name.trim(),
      description: category.description?.trim(),
    };
    if (!this.store.categories) {
      this.store.categories = [];
    }
    this.store.categories.push(newCat);
    this.persist();
    return newCat;
  }

  public getProducts(): Product[] {
    return [...this.store.products];
  }

  public getProductById(id: string): Product | undefined {
    return this.store.products.find((p) => p.id === id);
  }

  public deleteProduct(id: string): boolean {
    const idx = this.store.products.findIndex((p) => p.id === id);
    if (idx !== -1) {
      const removed = this.store.products.splice(idx, 1)[0];
      this.logAudit('PRODUCT', id, 'DELETED', removed, null);
      this.persist();
      return true;
    }
    return false;
  }

  public saveProduct(product: Partial<Product>): Product {
    if (product.id) {
      const idx = this.store.products.findIndex((p) => p.id === product.id);
      if (idx !== -1) {
        const old = this.store.products[idx];
        this.store.products[idx] = {
          ...this.store.products[idx],
          ...product,
          updated_at: new Date().toISOString(),
        } as Product;
        this.logAudit('PRODUCT', product.id, 'UPDATED', old, product);
        this.persist();
        return this.store.products[idx];
      }
    }
    const category = this.store.categories.find((c) => c.id === product.category_id);
    const newProd: Product = {
      id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      organization_id: this.store.companySettings.organization_id,
      category_id: product.category_id,
      category_name: category?.name,
      name: product.name || 'Untitled Service',
      sku: product.sku || `SKU-${Date.now().toString().slice(-4)}`,
      description: product.description || '',
      unit: product.unit || 'Unit',
      cost_price: Number(product.cost_price || 0),
      selling_price: Number(product.selling_price || 0),
      vat_rate_id: product.vat_rate_id || 'vat-001',
      vat_rate_percentage: product.vat_rate_percentage ?? 5.0,
      vat_treatment: product.vat_treatment || 'STANDARD_RATED',
      is_active: product.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.store.products.unshift(newProd);
    this.logAudit('PRODUCT', newProd.id, 'CREATED', undefined, newProd);
    this.persist();
    return newProd;
  }

  // --- Customers & Prospects ---
  public getCustomers(): Customer[] {
    return [...this.store.customers];
  }

  public getCustomerById(id: string): Customer | undefined {
    return this.store.customers.find((c) => c.id === id);
  }

  public deleteCustomer(id: string): boolean {
    const idx = this.store.customers.findIndex((c) => c.id === id);
    if (idx !== -1) {
      const removed = this.store.customers.splice(idx, 1)[0];
      this.logAudit('CUSTOMER', id, 'DELETED', removed, null);
      this.persist();
      return true;
    }
    return false;
  }

  public saveCustomer(customer: Partial<Customer>): Customer {
    if (customer.id) {
      const idx = this.store.customers.findIndex((c) => c.id === customer.id);
      if (idx !== -1) {
        const old = this.store.customers[idx];
        this.store.customers[idx] = {
          ...this.store.customers[idx],
          ...customer,
          updated_at: new Date().toISOString(),
        } as Customer;
        this.logAudit('CUSTOMER', customer.id, 'UPDATED', old, customer);
        this.persist();
        return this.store.customers[idx];
      }
    }
    const newCust: Customer = {
      id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      organization_id: this.store.companySettings.organization_id,
      customer_type: customer.customer_type || 'COMPANY',
      relation_type: customer.relation_type || 'CUSTOMER',
      company_name: customer.company_name,
      contact_person: customer.contact_person || 'Contact Person',
      email: customer.email,
      phone: customer.phone,
      mobile: customer.mobile,
      trn: customer.trn,
      billing_address_line_1: customer.billing_address_line_1,
      billing_address_line_2: customer.billing_address_line_2,
      billing_city: customer.billing_city || 'Dubai',
      billing_emirate: customer.billing_emirate || 'DUBAI',
      billing_country: customer.billing_country || 'United Arab Emirates',
      billing_po_box: customer.billing_po_box,
      payment_terms_days: customer.payment_terms_days ?? 30,
      currency: customer.currency || 'AED',
      notes: customer.notes,
      is_active: customer.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      contacts: customer.contacts || [],
    };
    this.store.customers.unshift(newCust);
    this.logAudit('CUSTOMER', newCust.id, 'CREATED', undefined, newCust);
    this.persist();
    return newCust;
  }

  // --- Quotations ---
  public getQuotes(): Quote[] {
    return [...this.store.quotes];
  }

  public getQuoteById(id: string): Quote | undefined {
    return this.store.quotes.find((q) => q.id === id);
  }

  public saveQuote(quote: Partial<Quote>): Quote {
    if (quote.id) {
      const idx = this.store.quotes.findIndex((q) => q.id === quote.id);
      if (idx !== -1) {
        const existing = this.store.quotes[idx];
        if (existing.status === 'CONVERTED') {
          throw new Error('Converted quotations cannot be modified.');
        }
        this.store.quotes[idx] = {
          ...existing,
          ...quote,
          updated_at: new Date().toISOString(),
        } as Quote;
        this.logAudit('QUOTE', quote.id, 'UPDATED', existing, quote);
        this.persist();
        return this.store.quotes[idx];
      }
    }

    const customer = this.getCustomerById(quote.customer_id || '');
    const quoteNum = this.allocateSequenceNumber('QUO', this.store.companySettings.quote_prefix);

    const newQuote: Quote = {
      id: `quo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      organization_id: this.store.companySettings.organization_id,
      customer_id: quote.customer_id || '',
      customer_name: customer?.company_name || customer?.contact_person || 'Client',
      customer_email: customer?.email,
      customer_trn: customer?.trn,
      quote_number: quoteNum,
      quote_date: quote.quote_date || new Date().toISOString().split('T')[0],
      expiry_date: quote.expiry_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      status: quote.status || 'DRAFT',
      currency: 'AED',
      exchange_rate: 1.0,
      subtotal_net: Number(quote.subtotal_net || 0),
      discount_type: quote.discount_type,
      discount_value: Number(quote.discount_value || 0),
      discount_amount: Number(quote.discount_amount || 0),
      vat_total: Number(quote.vat_total || 0),
      grand_total: Number(quote.grand_total || 0),
      notes: quote.notes || '',
      terms: quote.terms || '',
      items: quote.items || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.store.quotes.unshift(newQuote);
    this.logAudit('QUOTE', newQuote.id, 'CREATED', undefined, newQuote);
    this.persist();
    return newQuote;
  }

  public deleteQuote(id: string): boolean {
    const idx = this.store.quotes.findIndex((q) => q.id === id);
    if (idx !== -1) {
      const removed = this.store.quotes.splice(idx, 1)[0];
      this.logAudit('QUOTE', id, 'DELETED', removed, null);
      this.persist();
      return true;
    }
    return false;
  }

  public updateQuoteStatus(id: string, status: QuoteStatus): Quote {
    const quote = this.store.quotes.find((q) => q.id === id);
    if (!quote) throw new Error('Quote not found');
    const oldStatus = quote.status;
    quote.status = status;
    quote.updated_at = new Date().toISOString();
    this.logAudit('QUOTE', id, 'STATUS_CHANGE', { status: oldStatus }, { status });
    this.persist();
    return quote;
  }

  public convertQuoteToInvoice(quoteId: string): Invoice {
    const quote = this.store.quotes.find((q) => q.id === quoteId);
    if (!quote) throw new Error('Quote not found');
    if (quote.status === 'CONVERTED' && quote.converted_invoice_id) {
      const existing = this.getInvoiceById(quote.converted_invoice_id);
      if (existing) return existing;
    }

    const customer = this.getCustomerById(quote.customer_id);
    const company = this.getCompanySettings();
    const invoiceNum = this.allocateSequenceNumber('INV', company.invoice_prefix);

    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + (customer?.payment_terms_days || 30) * 86400000).toISOString().split('T')[0];

    const invoice: Invoice = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      organization_id: company.organization_id,
      customer_id: quote.customer_id,
      originating_quote_id: quote.id,
      originating_quote_number: quote.quote_number,
      invoice_number: invoiceNum,
      invoice_date: today,
      supply_date: today,
      due_date: dueDate,
      status: 'ISSUED',
      currency: 'AED',
      exchange_rate: 1.0,
      subtotal_net: quote.subtotal_net,
      discount_type: quote.discount_type,
      discount_value: quote.discount_value,
      discount_amount: quote.discount_amount,
      vat_total: quote.vat_total,
      grand_total: quote.grand_total,
      amount_paid: 0.0,
      balance_due: quote.grand_total,
      customer_snapshot: {
        company_name: customer?.company_name,
        contact_person: customer?.contact_person,
        email: customer?.email,
        phone: customer?.phone,
        trn: customer?.trn,
        billing_address_line_1: customer?.billing_address_line_1,
        billing_city: customer?.billing_city,
        billing_emirate: customer?.billing_emirate,
      },
      company_snapshot: {
        legal_company_name: company.legal_company_name,
        trading_name: company.trading_name,
        trn: company.trn,
        address_line_1: company.address_line_1,
        city: company.city,
        emirate: company.emirate,
        email: company.email,
        phone: company.phone,
      },
      bank_details_snapshot: {
        bank_name: company.bank_name,
        account_name: company.bank_account_name,
        account_number: company.bank_account_number,
        iban: company.bank_iban,
        swift_bic: company.bank_swift_bic,
        branch: company.bank_branch,
      },
      notes: `Converted from Quotation ${quote.quote_number}. ${quote.notes || ''}`.trim(),
      terms: quote.terms || company.terms_and_conditions || '',
      e_invoice_status: 'ACCEPTED',
      e_invoice_uuid: `uae-einvoice-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`,
      e_invoice_hash: `sha256:${Math.random().toString(36).substring(2, 12)}`,
      items: quote.items.map((it, idx) => ({ ...it, id: `inv-item-${Date.now()}-${idx}` })),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.store.invoices.unshift(invoice);
    quote.status = 'CONVERTED';
    quote.converted_invoice_id = invoice.id;
    quote.updated_at = new Date().toISOString();

    this.logAudit('INVOICE', invoice.id, 'CREATED_FROM_QUOTE', { quote_id: quote.id }, invoice);
    this.persist();
    return invoice;
  }

  // --- Invoices ---
  public getInvoices(): Invoice[] {
    return [...this.store.invoices];
  }

  public getInvoiceById(id: string): Invoice | undefined {
    return this.store.invoices.find((inv) => inv.id === id);
  }

  public saveInvoice(invoiceData: Partial<Invoice>): Invoice {
    const company = this.getCompanySettings();
    const customer = this.getCustomerById(invoiceData.customer_id || '');

    if (invoiceData.id) {
      const idx = this.store.invoices.findIndex((i) => i.id === invoiceData.id);
      if (idx !== -1) {
        const existing = this.store.invoices[idx];
        if (existing.status !== 'DRAFT') {
          throw new Error('Issued or Cancelled invoices cannot be directly modified. Use Credit Notes or Cancellation.');
        }
        this.store.invoices[idx] = {
          ...existing,
          ...invoiceData,
          updated_at: new Date().toISOString(),
        } as Invoice;
        this.logAudit('INVOICE', existing.id, 'UPDATED', existing, invoiceData);
        this.persist();
        return this.store.invoices[idx];
      }
    }

    // New invoice
    const isDirectIssue = invoiceData.status === 'ISSUED';
    const invoiceNum = isDirectIssue
      ? this.allocateSequenceNumber('INV', company.invoice_prefix)
      : DocumentSequencer.generateDraftId(company.invoice_prefix);

    const today = new Date().toISOString().split('T')[0];
    const dueDate = invoiceData.due_date || new Date(Date.now() + (customer?.payment_terms_days || 30) * 86400000).toISOString().split('T')[0];
    const grandTotal = Number(invoiceData.grand_total || 0);

    const newInvoice: Invoice = {
      id: invoiceData.id || `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      organization_id: company.organization_id,
      customer_id: invoiceData.customer_id || '',
      originating_quote_id: invoiceData.originating_quote_id,
      originating_quote_number: invoiceData.originating_quote_number,
      invoice_number: invoiceNum,
      reference_number: invoiceData.reference_number || invoiceData.po_number || '',
      po_number: invoiceData.po_number || '',
      payment_terms_days: invoiceData.payment_terms_days || customer?.payment_terms_days || 30,
      invoice_date: invoiceData.invoice_date || today,
      supply_date: invoiceData.supply_date || today,
      due_date: dueDate,
      status: invoiceData.status || 'DRAFT',
      currency: 'AED',
      exchange_rate: 1.0,
      subtotal_net: Number(invoiceData.subtotal_net || 0),
      discount_type: invoiceData.discount_type,
      discount_value: Number(invoiceData.discount_value || 0),
      discount_amount: Number(invoiceData.discount_amount || 0),
      vat_total: Number(invoiceData.vat_total || 0),
      grand_total: grandTotal,
      amount_paid: 0.0,
      balance_due: grandTotal,
      customer_snapshot: {
        company_name: customer?.company_name,
        contact_person: customer?.contact_person,
        email: customer?.email,
        phone: customer?.phone,
        trn: customer?.trn,
        billing_address_line_1: customer?.billing_address_line_1,
        billing_city: customer?.billing_city,
        billing_emirate: customer?.billing_emirate,
      },
      company_snapshot: {
        legal_company_name: company.legal_company_name,
        trading_name: company.trading_name,
        trn: company.trn,
        address_line_1: company.address_line_1,
        city: company.city,
        emirate: company.emirate,
        email: company.email,
        phone: company.phone,
      },
      bank_details_snapshot: {
        bank_name: company.bank_name,
        account_name: company.bank_account_name,
        account_number: company.bank_account_number,
        iban: company.bank_iban,
        swift_bic: company.bank_swift_bic,
        branch: company.bank_branch,
      },
      notes: invoiceData.notes || '',
      terms: invoiceData.terms || company.terms_and_conditions || '',
      e_invoice_status: isDirectIssue ? 'ACCEPTED' : 'NOT_APPLICABLE',
      e_invoice_uuid: isDirectIssue ? `uae-einvoice-${Math.random().toString(36).substring(2, 9)}` : undefined,
      items: invoiceData.items || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.store.invoices.unshift(newInvoice);
    this.logAudit('INVOICE', newInvoice.id, 'CREATED', undefined, newInvoice);
    this.persist();
    return newInvoice;
  }

  public issueInvoice(id: string): Invoice {
    const inv = this.getInvoiceById(id);
    if (!inv) throw new Error('Invoice not found');
    if (inv.status !== 'DRAFT') throw new Error('Only draft invoices can be issued');

    const company = this.getCompanySettings();
    const legalNumber = this.allocateSequenceNumber('INV', company.invoice_prefix);

    inv.invoice_number = legalNumber;
    inv.status = 'ISSUED';
    inv.balance_due = inv.grand_total;
    inv.e_invoice_status = 'ACCEPTED';
    inv.e_invoice_uuid = `uae-einvoice-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
    inv.e_invoice_hash = `sha256:${Math.random().toString(36).substring(2, 12)}`;
    inv.updated_at = new Date().toISOString();

    this.logAudit('INVOICE', inv.id, 'ISSUED', { old_number: inv.invoice_number }, { legalNumber, status: 'ISSUED' });
    this.persist();
    return inv;
  }

  public cancelInvoice(id: string, reason: string): Invoice {
    const inv = this.getInvoiceById(id);
    if (!inv) throw new Error('Invoice not found');
    if (inv.status === 'PAID') {
      throw new Error('Paid invoices cannot be cancelled directly. Please issue a Credit Note or refund first.');
    }
    if (inv.status === 'CANCELLED') {
      throw new Error('Invoice is already cancelled.');
    }

    const oldStatus = inv.status;
    inv.status = 'CANCELLED';
    inv.cancelled_at = new Date().toISOString();
    inv.cancellation_reason = reason;
    inv.balance_due = 0;
    inv.e_invoice_status = 'CANCELLED';
    inv.updated_at = new Date().toISOString();

    this.logAudit('INVOICE', inv.id, 'CANCELLED', { status: oldStatus }, { status: 'CANCELLED', reason });
    this.persist();
    return inv;
  }

  // --- Payments ---
  public getPayments(): Payment[] {
    return [...this.store.payments];
  }

  public recordPayment(data: {
    invoice_id: string;
    payment_method_id: string;
    amount: number;
    payment_date?: string;
    reference_number?: string;
    notes?: string;
    payment_proof_url?: string;
    payment_proof_name?: string;
  }): Payment {
    const inv = this.getInvoiceById(data.invoice_id);
    if (!inv) throw new Error('Invoice not found');
    if (inv.status === 'CANCELLED' || inv.status === 'DRAFT') {
      throw new Error(`Cannot record payment against invoice with status ${inv.status}.`);
    }

    const payAmount = Number(data.amount);
    if (payAmount <= 0) throw new Error('Payment amount must be greater than zero.');

    // Overpayment check
    if (payAmount > inv.balance_due) {
      throw new Error(
        `Overpayment Warning: Entered payment (AED ${payAmount.toFixed(2)}) exceeds invoice balance due (AED ${inv.balance_due.toFixed(2)}).`
      );
    }

    const company = this.getCompanySettings();
    const pm = this.store.paymentMethods.find((p) => p.id === data.payment_method_id);
    const payNum = this.allocateSequenceNumber('PAY', company.payment_prefix);

    const payment: Payment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      organization_id: company.organization_id,
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      customer_id: inv.customer_id,
      customer_name: inv.customer_snapshot.company_name || inv.customer_snapshot.contact_person,
      payment_number: payNum,
      payment_date: data.payment_date || new Date().toISOString().split('T')[0],
      payment_method_id: data.payment_method_id,
      payment_method_name: pm?.name || 'Payment',
      amount: payAmount,
      currency: 'AED',
      exchange_rate: 1.0,
      reference_number: data.reference_number || '',
      notes: data.notes || '',
      payment_proof_url: data.payment_proof_url,
      payment_proof_name: data.payment_proof_name,
      status: 'RECORDED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.store.payments.unshift(payment);

    // Update invoice balance
    const newPaid = Number((inv.amount_paid + payAmount).toFixed(2));
    const newBalance = Number(Math.max(0, inv.grand_total - newPaid).toFixed(2));
    inv.amount_paid = newPaid;
    inv.balance_due = newBalance;
    inv.status = newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';
    inv.updated_at = new Date().toISOString();

    this.logAudit('PAYMENT', payment.id, 'RECORDED', undefined, payment);
    this.persist();
    return payment;
  }

  public reversePayment(paymentId: string, reason: string): Payment {
    const payment = this.store.payments.find((p) => p.id === paymentId);
    if (!payment) throw new Error('Payment record not found');
    if (payment.status === 'REVERSED') throw new Error('Payment is already reversed');

    payment.status = 'REVERSED';
    payment.reversed_at = new Date().toISOString();
    payment.reversal_reason = reason;
    payment.updated_at = new Date().toISOString();

    // Reopen invoice balance
    const inv = this.getInvoiceById(payment.invoice_id);
    if (inv) {
      const newPaid = Number(Math.max(0, inv.amount_paid - payment.amount).toFixed(2));
      const newBalance = Number((inv.grand_total - newPaid).toFixed(2));
      inv.amount_paid = newPaid;
      inv.balance_due = newBalance;

      const isOverdue = new Date(inv.due_date) < new Date();
      if (newBalance === 0) {
        inv.status = 'PAID';
      } else if (newPaid > 0) {
        inv.status = 'PARTIALLY_PAID';
      } else {
        inv.status = isOverdue ? 'OVERDUE' : 'ISSUED';
      }
      inv.updated_at = new Date().toISOString();
    }

    this.logAudit('PAYMENT', payment.id, 'REVERSED', { status: 'RECORDED' }, { status: 'REVERSED', reason });
    this.persist();
    return payment;
  }

  // --- Credit Notes ---
  public getCreditNotes(): CreditNote[] {
    return [...this.store.creditNotes];
  }

  public getCreditNoteById(id: string): CreditNote | undefined {
    return this.store.creditNotes.find((cn) => cn.id === id);
  }

  public createCreditNoteFromInvoice(
    invoiceId: string,
    itemsToCredit: Array<{
      invoice_item_id: string;
      quantity_to_credit: number;
      unit_price?: number;
      amount_to_credit?: number;
      reason?: string;
      description?: string;
    }>,
    reason: string,
    allocationType: 'INVOICE_OFFSET' | 'CASH_REFUND' | 'BANK_REFUND' | 'CREDIT_ON_ACCOUNT' = 'INVOICE_OFFSET',
    creditType?: CreditNoteType,
    creditReasonCode: CreditReasonCode = 'RE_OTHER',
    performedByName: string = 'Current User'
  ): CreditNote {
    const inv = this.getInvoiceById(invoiceId);
    if (!inv) throw new Error('Invoice not found');
    if (inv.status === 'CANCELLED' || inv.status === 'DRAFT') {
      throw new Error(`Cannot issue a credit note against invoice with status ${inv.status}.`);
    }

    if (!itemsToCredit || itemsToCredit.length === 0) {
      throw new Error('At least one invoice line item must be selected for crediting.');
    }

    // Check existing non-cancelled credit notes on this invoice
    const existingNotes = this.store.creditNotes.filter(
      (cn) => cn.invoice_id === invoiceId && cn.status !== 'CANCELLED'
    );

    const company = this.getCompanySettings();
    const cnNumber = this.allocateSequenceNumber('CN', company.credit_note_prefix);

    let subtotalNet = 0;
    let vatTotal = 0;
    let hasQuantityAdjustment = false;
    let hasAmountAdjustment = false;

    const cnItems = itemsToCredit.map((it, idx) => {
      const originalLine = inv.items.find((orig) => orig.id === it.invoice_item_id);
      if (!originalLine) {
        throw new Error(`Originating invoice line ${it.invoice_item_id} not found.`);
      }

      // Calculate previously credited quantity for this line item
      let previouslyCreditedQty = 0;
      let previouslyCreditedNet = 0;
      existingNotes.forEach((cn) => {
        cn.items.forEach((cni) => {
          if (cni.invoice_item_id === it.invoice_item_id) {
            previouslyCreditedQty += cni.quantity;
            previouslyCreditedNet += cni.subtotal_net;
          }
        });
      });

      const maxAvailableQty = Number((originalLine.quantity - previouslyCreditedQty).toFixed(4));
      const requestedQty = Number(it.quantity_to_credit);

      if (requestedQty <= 0) {
        throw new Error(`Credited quantity for "${originalLine.description}" must be greater than zero.`);
      }

      if (requestedQty > maxAvailableQty + 0.0001) {
        throw new Error(
          `Cannot credit ${requestedQty} of "${originalLine.description}". Maximum remaining non-credited quantity is ${maxAvailableQty}.`
        );
      }

      // Check whether quantity or amount was adjusted
      if (requestedQty < originalLine.quantity) {
        hasQuantityAdjustment = true;
      }

      const originalPrice = originalLine.unit_price;
      const price = it.unit_price !== undefined ? Number(it.unit_price) : originalPrice;
      if (price !== originalPrice) {
        hasAmountAdjustment = true;
      }

      // Line Net calculation
      let lineNet: number;
      if (it.amount_to_credit !== undefined && it.amount_to_credit > 0) {
        hasAmountAdjustment = true;
        lineNet = Number(it.amount_to_credit.toFixed(2));
      } else {
        lineNet = Number((requestedQty * price).toFixed(2));
      }

      // Prevent exceeding original line net value
      const remainingLineNet = Number((originalLine.subtotal_net - previouslyCreditedNet).toFixed(2));
      if (lineNet > remainingLineNet + 0.01) {
        throw new Error(
          `Credit amount (${lineNet} AED) for "${originalLine.description}" exceeds remaining line value (${remainingLineNet} AED).`
        );
      }

      const vatRate = originalLine.vat_rate_percentage;
      const vatAmt = Number(((lineNet * vatRate) / 100).toFixed(2));
      const gross = Number((lineNet + vatAmt).toFixed(2));

      subtotalNet += lineNet;
      vatTotal += vatAmt;

      let adjustmentType: 'FULL' | 'QUANTITY' | 'AMOUNT' | 'LINE' = 'FULL';
      if (it.amount_to_credit !== undefined || price !== originalPrice) {
        adjustmentType = 'AMOUNT';
      } else if (requestedQty < originalLine.quantity) {
        adjustmentType = 'QUANTITY';
      } else if (itemsToCredit.length < inv.items.length) {
        adjustmentType = 'LINE';
      }

      return {
        id: `cni-${Date.now()}-${idx}`,
        credit_note_id: '',
        invoice_item_id: it.invoice_item_id,
        product_id: originalLine.product_id,
        item_order: idx + 1,
        description: it.description || (originalLine.description ? `Credit: ${originalLine.description}` : 'Credit Adjustment'),
        original_invoiced_quantity: originalLine.quantity,
        original_unit_price: originalLine.unit_price,
        quantity: requestedQty,
        unit_price: price,
        unit: originalLine.unit || 'Unit',
        discount_amount: 0,
        subtotal_net: lineNet,
        vat_rate_id: originalLine.vat_rate_id || 'vat-001',
        vat_rate_percentage: vatRate,
        vat_amount: vatAmt,
        total_gross: gross,
        adjustment_type: adjustmentType,
      };
    });

    const grandTotal = Number((subtotalNet + vatTotal).toFixed(2));

    // Guard: Total credit cannot exceed remaining non-credited value of the invoice
    const alreadyCreditedTotal = existingNotes.reduce((s, cn) => s + cn.grand_total, 0);
    const remainingInvoiceCapacity = Number((inv.grand_total - alreadyCreditedTotal).toFixed(2));
    if (grandTotal > remainingInvoiceCapacity + 0.01) {
      throw new Error(
        `Total credit (${grandTotal} AED) exceeds the remaining invoice capacity of ${remainingInvoiceCapacity} AED.`
      );
    }

    // Determine Credit Note Type
    let computedCreditType: CreditNoteType = 'PARTIAL';
    if (creditType) {
      computedCreditType = creditType;
    } else if (
      itemsToCredit.length === inv.items.length &&
      !hasQuantityAdjustment &&
      !hasAmountAdjustment
    ) {
      computedCreditType = 'FULL';
    } else if (hasAmountAdjustment) {
      computedCreditType = 'AMOUNT_ADJUSTMENT';
    } else if (hasQuantityAdjustment) {
      computedCreditType = 'QUANTITY_ADJUSTMENT';
    } else if (itemsToCredit.length < inv.items.length) {
      computedCreditType = 'LINE_SELECTION';
    }

    // Determine Refund Status & Offsets
    let refundStatus: RefundStatus = 'APPLIED_TO_INVOICE';
    let remainingBalance = 0;
    let offsetAmount = 0;

    if (allocationType === 'INVOICE_OFFSET') {
      refundStatus = 'APPLIED_TO_INVOICE';
      offsetAmount = Math.min(inv.balance_due, grandTotal);
      const newBal = Number(Math.max(0, inv.balance_due - offsetAmount).toFixed(2));
      inv.balance_due = newBal;
      if (newBal === 0 && inv.status !== 'PAID') {
        inv.status = 'PAID';
      }
      inv.updated_at = new Date().toISOString();
      remainingBalance = Number(Math.max(0, grandTotal - offsetAmount).toFixed(2));
      if (remainingBalance > 0) {
        refundStatus = 'CREDIT_ON_ACCOUNT';
      }
    } else if (allocationType === 'CASH_REFUND') {
      refundStatus = 'REFUNDED_CASH';
    } else if (allocationType === 'BANK_REFUND') {
      refundStatus = 'REFUNDED_BANK';
    } else if (allocationType === 'CREDIT_ON_ACCOUNT') {
      refundStatus = 'CREDIT_ON_ACCOUNT';
      remainingBalance = grandTotal;
    }

    // Prepare UAE E-Invoicing & ASP digital footprint
    const eInvoiceUuid = `uae-cn-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
    const docHash = `sha256:${Buffer.from(`${cnNumber}:${inv.customer_id}:${grandTotal}`).toString('hex').slice(0, 32)}`;
    const qrCode = `https://tax.gov.ae/verify?doc=${cnNumber}&trn=${company.trn || ''}&orig=${inv.invoice_number}&tot=${grandTotal.toFixed(2)}`;

    const creditNote: CreditNote = {
      id: `cn-${Date.now()}`,
      organization_id: company.organization_id,
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      original_invoice_total: inv.grand_total,
      customer_id: inv.customer_id,
      customer_name: inv.customer_snapshot.company_name || inv.customer_snapshot.contact_person,
      credit_note_number: cnNumber,
      credit_note_date: new Date().toISOString().split('T')[0],
      status: 'ISSUED',
      credit_type: computedCreditType,
      refund_status: refundStatus,
      credit_reason_code: creditReasonCode,
      reason: reason,
      currency: 'AED',
      subtotal_net: subtotalNet,
      discount_amount: 0,
      vat_total: vatTotal,
      grand_total: grandTotal,
      remaining_balance: remainingBalance,
      customer_snapshot: inv.customer_snapshot,
      company_snapshot: inv.company_snapshot,
      refund_processed_at:
        allocationType === 'CASH_REFUND' || allocationType === 'BANK_REFUND'
          ? new Date().toISOString()
          : undefined,
      e_invoice_status: 'ACCEPTED',
      e_invoice_uuid: eInvoiceUuid,
      e_invoice_hash: docHash,
      e_invoice_qr_code: qrCode,
      asp_provider_name: 'Simulated UAE ASP (Accredited Service Provider)',
      asp_submission_id: `ASP-CN-${Date.now()}`,
      asp_cleared_at: new Date().toISOString(),
      items: cnItems,
      allocations: [
        {
          id: `cna-${Date.now()}`,
          organization_id: company.organization_id,
          credit_note_id: '',
          invoice_id: inv.id,
          amount: grandTotal,
          allocation_type: allocationType,
          allocated_at: new Date().toISOString(),
          notes:
            allocationType === 'INVOICE_OFFSET'
              ? `Applied ${offsetAmount.toFixed(2)} AED against invoice balance due`
              : `Processed via ${allocationType}`,
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    creditNote.items.forEach((i) => (i.credit_note_id = creditNote.id));
    creditNote.allocations?.forEach((a) => (a.credit_note_id = creditNote.id));

    this.store.creditNotes.unshift(creditNote);
    this.logAudit('CREDIT_NOTE', creditNote.id, 'CREATED', undefined, creditNote, performedByName);
    this.logAudit(
      'INVOICE',
      inv.id,
      'CREDIT_NOTE_APPLIED',
      { balance_due: inv.balance_due + offsetAmount },
      { balance_due: inv.balance_due, credit_note_number: cnNumber, credit_amount: grandTotal },
      performedByName
    );
    this.persist();
    return creditNote;
  }

  public processCreditNoteRefund(
    creditNoteId: string,
    refundMethod: 'CASH' | 'BANK',
    refundReference?: string,
    notes?: string,
    performedByName: string = 'Current User'
  ): CreditNote {
    const cn = this.getCreditNoteById(creditNoteId);
    if (!cn) throw new Error('Credit Note not found');
    if (cn.status === 'CANCELLED') {
      throw new Error('Cannot process refund for a cancelled credit note.');
    }
    if (cn.refund_status === 'REFUNDED_CASH' || cn.refund_status === 'REFUNDED_BANK') {
      throw new Error(`Refund has already been recorded for credit note ${cn.credit_note_number}.`);
    }

    const oldStatus = cn.refund_status;
    cn.refund_status = refundMethod === 'CASH' ? 'REFUNDED_CASH' : 'REFUNDED_BANK';
    cn.status = 'REFUNDED';
    cn.refund_processed_at = new Date().toISOString();
    cn.refund_reference = refundReference || `REF-${Date.now()}`;
    cn.updated_at = new Date().toISOString();

    if (!cn.allocations) cn.allocations = [];
    cn.allocations.push({
      id: `cna-${Date.now()}`,
      organization_id: cn.organization_id,
      credit_note_id: cn.id,
      amount: cn.remaining_balance > 0 ? cn.remaining_balance : cn.grand_total,
      allocation_type: refundMethod === 'CASH' ? 'CASH_REFUND' : 'BANK_REFUND',
      allocated_at: new Date().toISOString(),
      notes: notes || `Direct ${refundMethod} refund processed with ref ${cn.refund_reference}`,
    });

    cn.remaining_balance = 0;

    this.logAudit(
      'CREDIT_NOTE',
      cn.id,
      'REFUND_PROCESSED',
      { refund_status: oldStatus },
      { refund_status: cn.refund_status, refund_reference: cn.refund_reference },
      performedByName
    );
    this.persist();
    return cn;
  }

  public cancelCreditNote(
    creditNoteId: string,
    cancellationReason: string,
    performedByName: string = 'Current User'
  ): CreditNote {
    const cn = this.getCreditNoteById(creditNoteId);
    if (!cn) throw new Error('Credit Note not found');
    if (cn.status === 'CANCELLED') {
      throw new Error(`Credit Note ${cn.credit_note_number} is already cancelled.`);
    }
    if (!cancellationReason || !cancellationReason.trim()) {
      throw new Error('A documented reason is mandatory when cancelling a credit note.');
    }

    // If offset was applied against invoice balance, reopen the invoice balance
    const inv = this.getInvoiceById(cn.invoice_id);
    if (inv && cn.allocations) {
      const offsetAlloc = cn.allocations.find((a) => a.allocation_type === 'INVOICE_OFFSET');
      if (offsetAlloc) {
        inv.balance_due = Number((inv.balance_due + offsetAlloc.amount).toFixed(2));
        if (inv.status === 'PAID' && inv.balance_due > 0) {
          inv.status = 'PARTIALLY_PAID';
        }
        inv.updated_at = new Date().toISOString();
      }
    }

    const oldValues = { status: cn.status, refund_status: cn.refund_status };
    cn.status = 'CANCELLED';
    cn.cancelled_at = new Date().toISOString();
    cn.cancellation_reason = cancellationReason.trim();
    cn.updated_at = new Date().toISOString();

    this.logAudit('CREDIT_NOTE', cn.id, 'CANCELLED', oldValues, cn, performedByName);
    this.persist();
    return cn;
  }

  public deleteCreditNote(creditNoteId: string): void {
    const cn = this.getCreditNoteById(creditNoteId);
    if (!cn) throw new Error('Credit Note not found');
    if (cn.status !== 'DRAFT') {
      throw new Error(
        `Accounting Principle Violation: Cannot delete non-draft credit note (${cn.credit_note_number}). Issued financial records must remain permanently recorded for unbroken sequence auditing. Cancel the credit note instead.`
      );
    }

    this.store.creditNotes = this.store.creditNotes.filter((c) => c.id !== creditNoteId);
    this.persist();
  }

  public async submitCreditNoteToAsp(creditNoteId: string): Promise<CreditNote> {
    const cn = this.getCreditNoteById(creditNoteId);
    if (!cn) throw new Error('Credit Note not found');

    const uuid = `uae-cn-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
    const hash = `sha256:${Buffer.from(`CN:${cn.credit_note_number}:${cn.grand_total}:${Date.now()}`).toString('hex').slice(0, 32)}`;
    const qr = `https://tax.gov.ae/verify?doc=${cn.credit_note_number}&trn=${cn.company_snapshot.trn || ''}&tot=${cn.grand_total}`;

    cn.e_invoice_status = 'ACCEPTED';
    cn.e_invoice_uuid = uuid;
    cn.e_invoice_hash = hash;
    cn.e_invoice_qr_code = qr;
    cn.asp_provider_name = 'Simulated UAE ASP (Accredited Service Provider)';
    cn.asp_submission_id = `ASP-CN-${Date.now()}`;
    cn.asp_cleared_at = new Date().toISOString();
    cn.updated_at = new Date().toISOString();

    this.logAudit('CREDIT_NOTE', cn.id, 'ASP_E_INVOICE_SUBMITTED', undefined, {
      e_invoice_uuid: uuid,
      e_invoice_hash: hash,
      e_invoice_status: 'ACCEPTED',
    });
    this.persist();
    return cn;
  }

  // --- Executive Dashboard Metrics ---
  public getDashboardMetrics() {
    const invoices = this.store.invoices.filter((i) => i.status !== 'CANCELLED' && i.status !== 'DRAFT');
    const payments = this.store.payments.filter((p) => p.status === 'RECORDED');
    const quotes = this.store.quotes.filter((q) => q.status !== 'REJECTED' && q.status !== 'EXPIRED');
    const activeCreditNotes = this.store.creditNotes.filter((cn) => cn.status !== 'CANCELLED');

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const grossRevenueThisYear = invoices
      .filter((i) => new Date(i.invoice_date).getFullYear() === currentYear)
      .reduce((sum, i) => sum + i.grand_total, 0);
    const creditThisYear = activeCreditNotes
      .filter((cn) => new Date(cn.credit_note_date).getFullYear() === currentYear)
      .reduce((sum, cn) => sum + cn.grand_total, 0);
    const revenueThisYear = Number(Math.max(0, grossRevenueThisYear - creditThisYear).toFixed(2));

    const grossRevenueThisMonth = invoices
      .filter((i) => {
        const d = new Date(i.invoice_date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      })
      .reduce((sum, i) => sum + i.grand_total, 0);
    const creditThisMonth = activeCreditNotes
      .filter((cn) => {
        const d = new Date(cn.credit_note_date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      })
      .reduce((sum, cn) => sum + cn.grand_total, 0);
    const revenueThisMonth = Number(Math.max(0, grossRevenueThisMonth - creditThisMonth).toFixed(2));

    const paymentsReceivedThisMonth = payments
      .filter((p) => {
        const d = new Date(p.payment_date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      })
      .reduce((sum, p) => sum + p.amount, 0);

    const grossVatCollected = invoices.reduce((sum, i) => sum + i.vat_total, 0);
    const vatCredited = activeCreditNotes.reduce((sum, cn) => sum + cn.vat_total, 0);
    const totalVatCollected = Number(Math.max(0, grossVatCollected - vatCredited).toFixed(2));

    const grossReceivables = invoices.reduce((sum, i) => sum + i.balance_due, 0);
    const unallocatedCredit = activeCreditNotes
      .filter((cn) => cn.refund_status === 'CREDIT_ON_ACCOUNT' && cn.remaining_balance > 0)
      .reduce((sum, cn) => sum + cn.remaining_balance, 0);
    const outstandingReceivables = Number(Math.max(0, grossReceivables - unallocatedCredit).toFixed(2));

    const overdueReceivables = invoices
      .filter((i) => i.status === 'OVERDUE' || (i.balance_due > 0 && new Date(i.due_date) < now))
      .reduce((sum, i) => sum + i.balance_due, 0);

    const openQuotations = quotes.filter((q) => q.status === 'SENT' || q.status === 'DRAFT');
    const openQuotationValue = openQuotations.reduce((sum, q) => sum + q.grand_total, 0);

    // Monthly revenue chart data for current year
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyRevenue = months.map((monthName, idx) => {
      const invRev = invoices
        .filter((i) => {
          const d = new Date(i.invoice_date);
          return d.getFullYear() === currentYear && d.getMonth() === idx;
        })
        .reduce((sum, i) => sum + i.grand_total, 0);

      const cnRev = activeCreditNotes
        .filter((cn) => {
          const d = new Date(cn.credit_note_date);
          return d.getFullYear() === currentYear && d.getMonth() === idx;
        })
        .reduce((sum, cn) => sum + cn.grand_total, 0);

      const payReceived = payments
        .filter((p) => {
          const d = new Date(p.payment_date);
          return d.getFullYear() === currentYear && d.getMonth() === idx;
        })
        .reduce((sum, p) => sum + p.amount, 0);

      return {
        month: monthName,
        revenue: Number(Math.max(0, invRev - cnRev).toFixed(2)),
        collected: payReceived,
      };
    });

    // Sales by customer
    const customerMap: Record<string, number> = {};
    invoices.forEach((inv) => {
      const name = inv.customer_snapshot.company_name || inv.customer_snapshot.contact_person || 'Client';
      customerMap[name] = (customerMap[name] || 0) + inv.grand_total;
    });
    activeCreditNotes.forEach((cn) => {
      const name = cn.customer_name || 'Client';
      if (customerMap[name] !== undefined) {
        customerMap[name] = Number(Math.max(0, customerMap[name] - cn.grand_total).toFixed(2));
      }
    });
    const salesByCustomer = Object.entries(customerMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Outstanding receivables aging distribution
    const agingBuckets = [
      { name: '0-30 Days', amount: 0, count: 0 },
      { name: '31-60 Days', amount: 0, count: 0 },
      { name: '61-90 Days', amount: 0, count: 0 },
      { name: '90+ Days', amount: 0, count: 0 },
    ];
    invoices
      .filter((i) => i.balance_due > 0)
      .forEach((i) => {
        const diffDays = Math.max(0, Math.ceil((now.getTime() - new Date(i.due_date).getTime()) / (1000 * 3600 * 24)));
        if (diffDays <= 30) {
          agingBuckets[0].amount += i.balance_due;
          agingBuckets[0].count += 1;
        } else if (diffDays <= 60) {
          agingBuckets[1].amount += i.balance_due;
          agingBuckets[1].count += 1;
        } else if (diffDays <= 90) {
          agingBuckets[2].amount += i.balance_due;
          agingBuckets[2].count += 1;
        } else {
          agingBuckets[3].amount += i.balance_due;
          agingBuckets[3].count += 1;
        }
      });
    agingBuckets.forEach((b) => {
      b.amount = Number(b.amount.toFixed(2));
    });

    // Revenue by Product / Service
    const serviceMap: Record<string, { revenue: number; quantity: number }> = {};
    invoices.forEach((inv) => {
      inv.items.forEach((item) => {
        const name = item.description || 'Service Item';
        if (!serviceMap[name]) {
          serviceMap[name] = { revenue: 0, quantity: 0 };
        }
        serviceMap[name].revenue += item.subtotal_net;
        serviceMap[name].quantity += item.quantity;
      });
    });
    const revenueByService = Object.entries(serviceMap)
      .map(([name, data]) => ({
        name,
        revenue: Number(data.revenue.toFixed(2)),
        quantity: data.quantity,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    const monthlyCollections = monthlyRevenue.map((m) => ({
      month: m.month,
      amount: m.collected,
    }));

    return {
      revenueThisMonth,
      revenueThisYear,
      outstandingReceivables,
      overdueReceivables,
      paymentsReceivedThisMonth,
      totalVatCollected,
      openQuotationCount: openQuotations.length,
      openQuotationValue,
      totalInvoicesCount: this.store.invoices.length,
      totalCustomersCount: this.store.customers.filter((c) => c.is_active).length,
      monthlyRevenue,
      salesByCustomer,
      monthlyCollections,
      outstandingReceivablesBuckets: agingBuckets,
      revenueByService,
    };
  }

  // --- 11 Reports Generator ---
  public getReportData(reportType: string, filters?: { customerId?: string; startDate?: string; endDate?: string }) {
    const invoices = this.store.invoices.filter((i) => i.status !== 'DRAFT');
    const payments = this.store.payments;
    const creditNotes = this.store.creditNotes;
    const customers = this.store.customers;

    switch (reportType) {
      case 'SALES_REPORT':
        return invoices
          .filter((i) => i.status !== 'CANCELLED')
          .map((i) => ({
            date: i.invoice_date,
            number: i.invoice_number,
            customer: i.customer_snapshot.company_name || i.customer_snapshot.contact_person,
            net_subtotal: i.subtotal_net,
            discount: i.discount_amount,
            vat_amount: i.vat_total,
            grand_total: i.grand_total,
            status: i.status,
          }));

      case 'INVOICE_REPORT':
        return invoices.map((i) => ({
          number: i.invoice_number,
          date: i.invoice_date,
          due_date: i.due_date,
          customer: i.customer_snapshot.company_name || i.customer_snapshot.contact_person,
          total: i.grand_total,
          amount_paid: i.amount_paid,
          balance_due: i.balance_due,
          status: i.status,
        }));

      case 'PAYMENT_REPORT':
        return payments.map((p) => ({
          payment_number: p.payment_number,
          date: p.payment_date,
          invoice_number: p.invoice_number,
          customer: p.customer_name,
          method: p.payment_method_name,
          reference: p.reference_number || '-',
          amount: p.amount,
          status: p.status,
        }));

      case 'OUTSTANDING_INVOICES':
        return invoices
          .filter((i) => i.status !== 'CANCELLED' && i.balance_due > 0)
          .map((i) => ({
            number: i.invoice_number,
            date: i.invoice_date,
            due_date: i.due_date,
            customer: i.customer_snapshot.company_name || i.customer_snapshot.contact_person,
            total: i.grand_total,
            paid: i.amount_paid,
            balance_due: i.balance_due,
            status: i.status,
          }));

      case 'OVERDUE_INVOICES':
        const now = new Date();
        return invoices
          .filter((i) => i.status !== 'CANCELLED' && i.balance_due > 0 && new Date(i.due_date) < now)
          .map((i) => {
            const diffDays = Math.ceil((now.getTime() - new Date(i.due_date).getTime()) / (1000 * 3600 * 24));
            return {
              number: i.invoice_number,
              date: i.invoice_date,
              due_date: i.due_date,
              days_overdue: diffDays,
              customer: i.customer_snapshot.company_name || i.customer_snapshot.contact_person,
              total: i.grand_total,
              balance_due: i.balance_due,
            };
          });

      case 'CUSTOMER_STATEMENT': {
        const custId = filters?.customerId || customers[0]?.id;
        const customer = this.getCustomerById(custId);
        const custInvoices = invoices.filter((i) => i.customer_id === custId && i.status !== 'CANCELLED');
        const custPayments = payments.filter((p) => p.customer_id === custId && p.status === 'RECORDED');
        const custCreditNotes = creditNotes.filter((cn) => cn.customer_id === custId && cn.status !== 'CANCELLED');

        // Merge into ledger transactions
        interface LedgerRow {
          date: string;
          type: string;
          reference: string;
          debit: number; // Invoices increase receivable
          credit: number; // Payments and CN reduce receivable
          running_balance: number;
        }

        const entries: Array<{ date: string; type: string; reference: string; debit: number; credit: number }> = [];

        custInvoices.forEach((i) => {
          entries.push({ date: i.invoice_date, type: 'Tax Invoice', reference: i.invoice_number, debit: i.grand_total, credit: 0 });
        });

        custPayments.forEach((p) => {
          entries.push({ date: p.payment_date, type: 'Payment', reference: p.payment_number, debit: 0, credit: p.amount });
        });

        custCreditNotes.forEach((cn) => {
          entries.push({ date: cn.credit_note_date, type: 'Credit Note', reference: cn.credit_note_number, debit: 0, credit: cn.grand_total });
        });

        entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let running = 0;
        const ledger: LedgerRow[] = entries.map((e) => {
          running += e.debit - e.credit;
          return {
            date: e.date,
            type: e.type,
            reference: e.reference,
            debit: e.debit,
            credit: e.credit,
            running_balance: Number(running.toFixed(2)),
          };
        });

        return {
          customer,
          ledger,
          totalBilled: custInvoices.reduce((s, i) => s + i.grand_total, 0),
          totalPaid: custPayments.reduce((s, p) => s + p.amount, 0),
          totalCredited: custCreditNotes.reduce((s, cn) => s + cn.grand_total, 0),
          currentBalance: Number(running.toFixed(2)),
        };
      }

      case 'VAT_SUMMARY': {
        // UAE VAT Return 201 breakdown
        let standardRatedSales = 0;
        let standardVatCollected = 0;
        let zeroRatedSales = 0;
        let exemptSales = 0;

        invoices
          .filter((i) => i.status !== 'CANCELLED')
          .forEach((inv) => {
            inv.items.forEach((item) => {
              if (item.vat_rate_percentage > 0) {
                standardRatedSales += item.subtotal_net;
                standardVatCollected += item.vat_amount;
              } else {
                zeroRatedSales += item.subtotal_net;
              }
            });
          });

        // Credit Note Adjustments for UAE VAT 201 Box 1
        let creditNotesStandardAdjustment = 0;
        let creditNotesVatAdjustment = 0;
        const activeCreditNotes = creditNotes.filter((cn) => cn.status !== 'CANCELLED');
        activeCreditNotes.forEach((cn) => {
          creditNotesStandardAdjustment += cn.subtotal_net;
          creditNotesVatAdjustment += cn.vat_total;
        });

        const netStandardRatedSales = Math.max(0, standardRatedSales - creditNotesStandardAdjustment);
        const netVatPayable = Math.max(0, standardVatCollected - creditNotesVatAdjustment);

        return {
          standardRatedSales: Number(standardRatedSales.toFixed(2)),
          creditNotesStandardAdjustment: Number(creditNotesStandardAdjustment.toFixed(2)),
          netStandardRatedSales: Number(netStandardRatedSales.toFixed(2)),
          standardVatCollected: Number(standardVatCollected.toFixed(2)),
          creditNotesVatAdjustment: Number(creditNotesVatAdjustment.toFixed(2)),
          zeroRatedSales: Number(zeroRatedSales.toFixed(2)),
          exemptSales: Number(exemptSales.toFixed(2)),
          totalSupplies: Number((netStandardRatedSales + zeroRatedSales + exemptSales).toFixed(2)),
          netVatPayable: Number(netVatPayable.toFixed(2)),
        };
      }

      case 'CREDIT_NOTE_REPORT':
        return creditNotes.map((cn) => ({
          number: cn.credit_note_number,
          date: cn.credit_note_date,
          invoice_number: cn.invoice_number,
          invoice_date: cn.invoice_date,
          customer: cn.customer_name,
          reason: cn.reason,
          credit_type: cn.credit_type,
          original_amount: cn.original_invoice_total || 0,
          subtotal: cn.subtotal_net,
          vat: cn.vat_total,
          total: cn.grand_total,
          refund_status: cn.refund_status,
          status: cn.status,
          e_invoice_status: cn.e_invoice_status,
        }));

      case 'REVENUE_BY_CUSTOMER': {
        const revMap: Record<string, { total: number; invoiceCount: number; paid: number; credited: number; outstanding: number }> = {};
        invoices
          .filter((i) => i.status !== 'CANCELLED')
          .forEach((i) => {
            const name = i.customer_snapshot.company_name || i.customer_snapshot.contact_person || 'Client';
            if (!revMap[name]) {
              revMap[name] = { total: 0, invoiceCount: 0, paid: 0, credited: 0, outstanding: 0 };
            }
            revMap[name].total += i.grand_total;
            revMap[name].invoiceCount += 1;
            revMap[name].paid += i.amount_paid;
            revMap[name].outstanding += i.balance_due;
          });

        creditNotes
          .filter((cn) => cn.status !== 'CANCELLED')
          .forEach((cn) => {
            const name = cn.customer_name || 'Client';
            if (revMap[name]) {
              revMap[name].total = Number(Math.max(0, revMap[name].total - cn.grand_total).toFixed(2));
              revMap[name].credited += cn.grand_total;
            }
          });

        return Object.entries(revMap).map(([customer, data]) => ({
          customer,
          ...data,
        }));
      }

      case 'REVENUE_BY_PRODUCT': {
        const prodMap: Record<string, { quantity: number; revenue: number; vat: number }> = {};
        invoices
          .filter((i) => i.status !== 'CANCELLED')
          .forEach((i) => {
            i.items.forEach((it) => {
              const name = it.description;
              if (!prodMap[name]) {
                prodMap[name] = { quantity: 0, revenue: 0, vat: 0 };
              }
              prodMap[name].quantity += it.quantity;
              prodMap[name].revenue += it.subtotal_net;
              prodMap[name].vat += it.vat_amount;
            });
          });
        return Object.entries(prodMap).map(([product, data]) => ({
          product,
          ...data,
        }));
      }

      case 'RECEIVABLES_AGEING': {
        const today = new Date();
        const agingBuckets = {
          current: 0, // 0 - 30 days
          days31_60: 0,
          days61_90: 0,
          days90_plus: 0,
        };

        const rows: Array<{
          customer: string;
          invoice_number: string;
          due_date: string;
          days: number;
          current: number;
          days31_60: number;
          days61_90: number;
          days90_plus: number;
          total_due: number;
        }> = [];

        invoices
          .filter((i) => i.status !== 'CANCELLED' && i.balance_due > 0)
          .forEach((i) => {
            const diffDays = Math.max(0, Math.ceil((today.getTime() - new Date(i.due_date).getTime()) / (1000 * 3600 * 24)));
            let bCurrent = 0,
              b31 = 0,
              b61 = 0,
              b90 = 0;

            if (diffDays <= 30) {
              bCurrent = i.balance_due;
              agingBuckets.current += i.balance_due;
            } else if (diffDays <= 60) {
              b31 = i.balance_due;
              agingBuckets.days31_60 += i.balance_due;
            } else if (diffDays <= 90) {
              b61 = i.balance_due;
              agingBuckets.days61_90 += i.balance_due;
            } else {
              b90 = i.balance_due;
              agingBuckets.days90_plus += i.balance_due;
            }

            rows.push({
              customer: i.customer_snapshot.company_name || i.customer_snapshot.contact_person || 'Client',
              invoice_number: i.invoice_number,
              due_date: i.due_date,
              days: diffDays,
              current: bCurrent,
              days31_60: b31,
              days61_90: b61,
              days90_plus: b90,
              total_due: i.balance_due,
            });
          });

        return {
          buckets: agingBuckets,
          rows,
          totalReceivables: Object.values(agingBuckets).reduce((a, b) => a + b, 0),
        };
      }

      default:
        return [];
    }
  }
}

export const db = new Repository();
