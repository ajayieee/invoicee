'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ShieldCheck, UserPlus, Package, Calculator, Sparkles, AlertCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { FormError, AlertBanner } from '@/components/ui/FormError';
import { Customer, Product, VatRate, DiscountType, VatTreatment } from '@/types/database';
import { invoiceService, InvoiceLineItemInput } from '@/services/invoice.service';
import { customerService } from '@/services/customer.service';
import { productService } from '@/services/product.service';
import { companyService } from '@/services/company.service';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface InvoiceBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (invoiceId: string) => void;
  initialInvoiceId?: string;
  defaultCustomerId?: string;
}

export function InvoiceBuilderModal({
  open,
  onOpenChange,
  onSuccess,
  initialInvoiceId,
  defaultCustomerId,
}: InvoiceBuilderModalProps) {
  const { user } = useAuth();
  const customers = customerService.getCustomers({ pageSize: 100 }).items;
  const products = productService.getProducts({ pageSize: 100 }).items;
  const vatRates = productService.getVatRates();
  const company = companyService.getSettings();

  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplyDate, setSupplyDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [referenceNumber, setReferenceNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [notes, setNotes] = useState('Payment is due per agreed credit terms. UAE 5% VAT applies.');
  const [terms, setTerms] = useState(company.terms_and_conditions || '');
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Line Items
  const [items, setItems] = useState<InvoiceLineItemInput[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Quick Customer Creation modal within builder
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPerson, setQuickCustPerson] = useState('');
  const [quickCustTrn, setQuickCustTrn] = useState('');
  const [quickCustEmirate, setQuickCustEmirate] = useState('DUBAI');

  // Load existing or initialize default state
  useEffect(() => {
    if (open) {
      setFieldErrors({});
      setFormError(null);

      if (initialInvoiceId) {
        const inv = invoiceService.getInvoiceById(initialInvoiceId);
        if (inv) {
          setCustomerId(inv.customer_id);
          setInvoiceDate(inv.invoice_date);
          setSupplyDate(inv.supply_date || inv.invoice_date);
          setPaymentTermsDays(inv.payment_terms_days || 30);
          setDueDate(inv.due_date);
          setReferenceNumber(inv.reference_number || '');
          setPoNumber(inv.po_number || '');
          setNotes(inv.notes || '');
          setTerms(inv.terms || '');
          setDiscountType(inv.discount_type || 'PERCENTAGE');
          setDiscountValue(inv.discount_value || 0);
          setItems(
            inv.items.map((it) => ({
              id: it.id,
              product_id: it.product_id,
              description: it.description,
              quantity: it.quantity,
              unit: it.unit,
              unit_price: it.unit_price,
              discount_type: it.discount_type || 'PERCENTAGE',
              discount_value: it.discount_value,
              vat_rate_id: it.vat_rate_id,
              vat_treatment: it.vat_treatment,
            }))
          );
          return;
        }
      }

      // Default new invoice state
      const initialCustId = defaultCustomerId || customers[0]?.id || '';
      const matchedCust = customers.find((c) => c.id === initialCustId);
      const termsDays = matchedCust?.payment_terms_days || company.default_payment_terms_days || 30;

      const todayStr = new Date().toISOString().split('T')[0];
      const dueStr = new Date(Date.now() + termsDays * 86400000).toISOString().split('T')[0];

      setCustomerId(initialCustId);
      setInvoiceDate(todayStr);
      setSupplyDate(todayStr);
      setPaymentTermsDays(termsDays);
      setDueDate(dueStr);
      setReferenceNumber('');
      setPoNumber('');
      setNotes('Payment is due per agreed credit terms. Subject to standard UAE VAT law.');
      setTerms(company.terms_and_conditions || '');
      setDiscountType('PERCENTAGE');
      setDiscountValue(0);

      const standardVat = vatRates.find((v) => v.treatment === 'STANDARD_RATED') || vatRates[0];
      const defaultProd = products[0];

      setItems([
        {
          id: `item-${Date.now()}-0`,
          product_id: defaultProd?.id,
          description: defaultProd?.name || 'IT Infrastructure & Consulting Services',
          quantity: 1,
          unit: defaultProd?.unit || 'Hour',
          unit_price: defaultProd?.selling_price || 1500,
          discount_type: 'PERCENTAGE',
          discount_value: 0,
          vat_rate_id: defaultProd?.vat_rate_id || standardVat?.id || '',
          vat_treatment: defaultProd?.vat_treatment || standardVat?.treatment || 'STANDARD_RATED',
        },
      ]);
    }
  }, [open, initialInvoiceId, defaultCustomerId]);

  // Recalculate due date whenever invoiceDate or paymentTermsDays changes
  const handlePaymentTermsChange = (days: number) => {
    setPaymentTermsDays(days);
    if (invoiceDate) {
      const invD = new Date(invoiceDate);
      if (!isNaN(invD.getTime())) {
        const calculatedDue = new Date(invD.getTime() + days * 86400000).toISOString().split('T')[0];
        setDueDate(calculatedDue);
      }
    }
  };

  const handleInvoiceDateChange = (dateStr: string) => {
    setInvoiceDate(dateStr);
    const invD = new Date(dateStr);
    if (!isNaN(invD.getTime())) {
      const calculatedDue = new Date(invD.getTime() + paymentTermsDays * 86400000)
        .toISOString()
        .split('T')[0];
      setDueDate(calculatedDue);
    }
  };

  // Live Calculations using VatCalculator
  const totals = invoiceService.calculateInvoiceTotals(items, discountType, discountValue);

  // Line Item Handlers
  const handleItemChange = (index: number, field: keyof InvoiceLineItemInput, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
    // Clear item-specific error if modified
    if (fieldErrors[`item_${index}_${String(field)}`]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[`item_${index}_${String(field)}`];
        return next;
      });
    }
  };

  const handleProductSelect = (index: number, prodId: string) => {
    if (prodId === 'CUSTOM') {
      const standardVat = vatRates.find((v) => v.treatment === 'STANDARD_RATED') || vatRates[0];
      setItems((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          product_id: undefined,
          description: '',
          unit: 'Unit',
          unit_price: 0,
          vat_rate_id: standardVat?.id || '',
          vat_treatment: standardVat?.treatment || 'STANDARD_RATED',
        };
        return copy;
      });
      return;
    }

    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;

    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        product_id: prod.id,
        description: prod.name,
        unit: prod.unit,
        unit_price: prod.selling_price,
        vat_rate_id: prod.vat_rate_id,
        vat_treatment: prod.vat_treatment || 'STANDARD_RATED',
      };
      return copy;
    });
  };

  const handleAddItem = () => {
    const standardVat = vatRates.find((v) => v.treatment === 'STANDARD_RATED') || vatRates[0];
    const defaultProd = products[0];

    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length}`,
        product_id: defaultProd?.id,
        description: defaultProd?.name || 'Custom Service',
        quantity: 1,
        unit: defaultProd?.unit || 'Unit',
        unit_price: defaultProd?.selling_price || 0,
        discount_type: 'PERCENTAGE',
        discount_value: 0,
        vat_rate_id: defaultProd?.vat_rate_id || standardVat?.id || '',
        vat_treatment: defaultProd?.vat_treatment || standardVat?.treatment || 'STANDARD_RATED',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setFormError('An invoice must contain at least one line item.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Quick Customer Creation inline
  const handleQuickCreateCustomer = () => {
    if (!quickCustName.trim()) {
      setFormError('Company or client name is required.');
      return;
    }

    const res = customerService.createCustomer({
      customer_type: 'COMPANY',
      relation_type: 'CUSTOMER',
      company_name: quickCustName.trim(),
      contact_person: quickCustPerson.trim() || quickCustName.trim(),
      trn: quickCustTrn.trim() || undefined,
      billing_emirate: quickCustEmirate as any,
      billing_city: 'Dubai',
      payment_terms_days: 30,
    });

    if (res.success && res.data) {
      setCustomerId(res.data.id);
      setQuickCustomerOpen(false);
      setQuickCustName('');
      setQuickCustPerson('');
      setQuickCustTrn('');
      setFormError(null);
    } else {
      setFormError(res.error || 'Failed to create customer');
    }
  };

  // Save handler (DRAFT or ISSUED)
  const handleSubmit = (targetStatus: 'DRAFT' | 'ISSUED') => {
    setFieldErrors({});
    setFormError(null);

    const payload = {
      customer_id: customerId,
      invoice_date: invoiceDate,
      supply_date: supplyDate,
      due_date: dueDate,
      payment_terms_days: paymentTermsDays,
      reference_number: referenceNumber.trim() || undefined,
      po_number: poNumber.trim() || undefined,
      items,
      discount_type: discountType,
      discount_value: discountValue,
      notes,
      terms,
      status: targetStatus,
    };

    const errors = invoiceService.validateInvoice(payload);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(Object.values(errors)[0]);
      return;
    }

    if (initialInvoiceId) {
      const res = invoiceService.updateDraftInvoice(initialInvoiceId, payload);
      if (res.success && res.data) {
        if (targetStatus === 'ISSUED') {
          const issueRes = invoiceService.issueInvoice(res.data.id);
          if (issueRes.success && issueRes.data) {
            onSuccess(issueRes.data.id);
            onOpenChange(false);
            return;
          }
        }
        onSuccess(res.data.id);
        onOpenChange(false);
      } else {
        setFormError(res.error || 'Failed to update invoice');
      }
    } else {
      const res = invoiceService.createInvoice(payload);
      if (res.success && res.data) {
        onSuccess(res.data.id);
        onOpenChange(false);
      } else {
        setFormError(res.error || 'Failed to create invoice');
      }
    }
  };

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={initialInvoiceId ? 'Edit Draft Tax Invoice' : 'Create New UAE Tax Invoice'}
      description="UAE FTA-compliant VAT invoice with sequential numbering, customer snapshot, and audit controls."
      maxWidth="5xl"
      footer={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between w-full gap-3 sm:gap-4">
          <div className="flex items-center justify-between sm:justify-start gap-3 text-xs">
            <span className="text-slate-500">Payable Total:</span>
            <span className="text-base font-bold font-mono text-slate-900 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
              {formatCurrency(totals.grand_total)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSubmit('DRAFT')}
              className="text-slate-700"
            >
              Save as Draft
            </Button>
            <Button
              variant="emerald"
              onClick={() => handleSubmit('ISSUED')}
              className="font-semibold shadow-xs"
            >
              Issue Official Invoice
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 text-xs">
        {formError && <AlertBanner variant="error" message={formError} />}

        {/* Section 1: Customer & Logistics Bar */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Customer & Commercial Agreement</span>
            </span>
            <button
              type="button"
              onClick={() => setQuickCustomerOpen(true)}
              className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>+ Quick Add Customer</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Customer Dropdown */}
            <div className="sm:col-span-2">
              <Select
                label="Bill To Customer / Client *"
                value={customerId}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomerId(val);
                  const cust = customers.find((c) => c.id === val);
                  if (cust?.payment_terms_days) {
                    handlePaymentTermsChange(cust.payment_terms_days);
                  }
                }}
                error={fieldErrors.customer_id}
              >
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name} {c.trn ? `(TRN: ${c.trn})` : '(No TRN)'}
                  </option>
                ))}
              </Select>
            </div>

            {/* Reference Number */}
            <div>
              <Input
                label="Reference / PO Number"
                placeholder="e.g. PO-2026-984"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            </div>

            {/* Payment Terms Days */}
            <div>
              <Select
                label="Payment Terms"
                value={paymentTermsDays}
                onChange={(e) => handlePaymentTermsChange(Number(e.target.value))}
              >
                <option value={0}>Due Immediately (Net 0)</option>
                <option value={15}>Net 15 Days</option>
                <option value={30}>Net 30 Days (Standard)</option>
                <option value={45}>Net 45 Days</option>
                <option value={60}>Net 60 Days</option>
                <option value={90}>Net 90 Days</option>
              </Select>
            </div>
          </div>

          {/* Dates Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
            <div>
              <Input
                label="Invoice Date (Issue Date) *"
                type="date"
                value={invoiceDate}
                onChange={(e) => handleInvoiceDateChange(e.target.value)}
                error={fieldErrors.invoice_date}
              />
            </div>
            <div>
              <Input
                label="Date of Supply (Mandatory UAE VAT) *"
                type="date"
                value={supplyDate}
                onChange={(e) => setSupplyDate(e.target.value)}
                error={fieldErrors.supply_date}
              />
            </div>
            <div>
              <Input
                label="Payment Due Date *"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                error={fieldErrors.due_date}
              />
            </div>
          </div>

          {/* Customer snapshot preview */}
          {selectedCustomer && (
            <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong>Legal TRN:</strong>{' '}
                {selectedCustomer.trn ? (
                  <span className="font-mono font-bold text-slate-900">{selectedCustomer.trn}</span>
                ) : (
                  <span className="text-slate-400 italic">Not VAT Registered</span>
                )}
                <span className="mx-2">•</span>
                <strong>Emirate:</strong> {selectedCustomer.billing_emirate || 'DUBAI'}
              </div>
              <div>
                <strong>Billing:</strong> {selectedCustomer.billing_address_line_1 || 'Address on file'}
              </div>
            </div>
          )}
        </div>

        {/* Quick Customer Modal */}
        {quickCustomerOpen && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between font-bold text-emerald-900">
              <span className="flex items-center gap-1.5">
                <UserPlus className="h-4 w-4" /> Quick Register Client
              </span>
              <button
                type="button"
                onClick={() => setQuickCustomerOpen(false)}
                className="text-xs text-emerald-700 hover:underline cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <Input
                  label="Company Name *"
                  placeholder="e.g. Al Hilal Tech LLC"
                  value={quickCustName}
                  onChange={(e) => setQuickCustName(e.target.value)}
                />
              </div>
              <div>
                <Input
                  label="Contact Person"
                  placeholder="e.g. Omar Khalid"
                  value={quickCustPerson}
                  onChange={(e) => setQuickCustPerson(e.target.value)}
                />
              </div>
              <div>
                <Input
                  label="15-Digit TRN"
                  placeholder="100XXXXXXXXX003"
                  value={quickCustTrn}
                  onChange={(e) => setQuickCustTrn(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setQuickCustomerOpen(false)}>
                Cancel
              </Button>
              <Button variant="emerald" size="sm" onClick={handleQuickCreateCustomer}>
                Save & Select Customer
              </Button>
            </div>
          </div>
        )}

        {/* Section 2: Line Items Builder */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Package className="h-4 w-4 text-emerald-600" />
              <span>Line Items & UAE Tax Treatment</span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
            </Button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-xs">
            <table className="w-full text-xs text-left min-w-[950px]">
              <thead className="bg-slate-900 text-white font-medium">
                <tr>
                  <th className="px-3 py-2.5 w-10">#</th>
                  <th className="px-3 py-2.5 min-w-[200px]">Product / Service Description *</th>
                  <th className="px-3 py-2.5 w-24">Qty *</th>
                  <th className="px-3 py-2.5 w-20">Unit</th>
                  <th className="px-3 py-2.5 w-28 text-right">Unit Price *</th>
                  <th className="px-3 py-2.5 w-28 text-right">Line Disc.</th>
                  <th className="px-3 py-2.5 w-36 text-center">VAT Rate</th>
                  <th className="px-3 py-2.5 w-24 text-right">Net Subtotal</th>
                  <th className="px-3 py-2.5 w-24 text-right">VAT (5%)</th>
                  <th className="px-3 py-2.5 w-24 text-right">Gross Total</th>
                  <th className="px-3 py-2.5 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, idx) => {
                  const lineCalc = totals.items[idx];
                  return (
                    <tr key={it.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-2 text-slate-400 font-mono text-center">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <div className="space-y-1.5">
                          <select
                            value={it.product_id || 'CUSTOM'}
                            onChange={(e) => handleProductSelect(idx, e.target.value)}
                            className="w-full text-xs px-2 py-1 rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                          >
                            <option value="CUSTOM">✏️ Custom Description...</option>
                            <optgroup label="Catalog Products & Services">
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({formatCurrency(p.selling_price)})
                                </option>
                              ))}
                            </optgroup>
                          </select>
                          <input
                            type="text"
                            placeholder="Enter item description..."
                            value={it.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            className="w-full text-xs px-2 py-1 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                          />
                          {fieldErrors[`item_${idx}_description`] && (
                            <div className="text-[10px] text-rose-600">
                              {fieldErrors[`item_${idx}_description`]}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={it.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full text-xs px-2 py-1 rounded border border-slate-200 font-mono text-center focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={it.unit}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          className="w-full text-xs px-2 py-1 rounded border border-slate-200 text-center focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={it.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                          className="w-full text-xs px-2 py-1 rounded border border-slate-200 font-mono text-right focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={it.discount_value || ''}
                            placeholder="0"
                            onChange={(e) => handleItemChange(idx, 'discount_value', e.target.value)}
                            className="w-full text-xs px-1.5 py-1 rounded border border-slate-200 font-mono text-right focus:outline-none focus:ring-1 focus:ring-emerald-600"
                          />
                          <select
                            value={it.discount_type || 'PERCENTAGE'}
                            onChange={(e) => handleItemChange(idx, 'discount_type', e.target.value)}
                            className="text-[10px] px-1 py-1 rounded border border-slate-200 bg-slate-50"
                          >
                            <option value="PERCENTAGE">%</option>
                            <option value="FIXED_AMOUNT">AED</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <select
                          value={it.vat_rate_id}
                          onChange={(e) => {
                            const vId = e.target.value;
                            const matched = vatRates.find((v) => v.id === vId);
                            handleItemChange(idx, 'vat_rate_id', vId);
                            if (matched) {
                              handleItemChange(idx, 'vat_treatment', matched.treatment);
                            }
                          }}
                          className="w-full text-xs px-2 py-1 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        >
                          {vatRates.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.rate_percentage}%)
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-slate-800">
                        {formatCurrency(lineCalc?.subtotal_net || 0)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">
                        {formatCurrency(lineCalc?.vat_amount || 0)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(lineCalc?.total_gross || 0)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                          title="Remove Line Item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Document-Level Discount & Commercial Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Notes and Terms */}
          <div className="space-y-4">
            <Textarea
              label="Invoice Notes & Bank Settlement Terms"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Standard settlement instructions, bank details, or delivery notes..."
            />
            <Textarea
              label="Standard Terms & Conditions"
              rows={2}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Payment terms, title retention, jurisdiction..."
            />
          </div>

          {/* Document Discount & Financial Calculations Summary */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calculator className="h-4 w-4 text-emerald-600" />
                <span>Financial Totals & UAE VAT Breakdown</span>
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded">
                FTA 5% Standard VAT
              </span>
            </div>

            {/* Document Level Discount Input */}
            <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-3">
              <span className="font-medium text-slate-700">Document Discount:</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={discountValue || ''}
                  placeholder="0"
                  onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                  className="w-24 text-xs px-2 py-1 rounded border border-slate-200 font-mono text-right focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                  className="text-xs px-2 py-1 rounded border border-slate-200 bg-slate-50"
                >
                  <option value="PERCENTAGE">%</option>
                  <option value="FIXED_AMOUNT">AED</option>
                </select>
              </div>
            </div>

            {/* Financial Ledger Breakdown */}
            <div className="space-y-1.5 pt-1 text-slate-600 border-t border-slate-200 font-mono">
              <div className="flex justify-between">
                <span>Subtotal (Net Lines):</span>
                <span>{formatCurrency(totals.subtotal_net)}</span>
              </div>
              {totals.invoice_discount_amount > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Document Discount:</span>
                  <span>- {formatCurrency(totals.invoice_discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-slate-800">
                <span>Taxable Amount (Article 25):</span>
                <span>
                  {formatCurrency(
                    Math.max(0, totals.subtotal_net - totals.invoice_discount_amount)
                  )}
                </span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Total Output VAT (5%):</span>
                <span>+ {formatCurrency(totals.vat_total)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-300 font-bold text-slate-950 text-sm">
                <span>Invoice Grand Total (AED):</span>
                <span>{formatCurrency(totals.grand_total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
