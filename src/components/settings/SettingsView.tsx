'use client';

import React, { useState } from 'react';
import {
  Building2,
  ShieldCheck,
  CreditCard,
  FileCode,
  History,
  Save,
  Check,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { FormError, AlertBanner } from '@/components/ui/FormError';
import { CompanySettings, UAEEmirate } from '@/types/database';
import { companyService } from '@/services/company.service';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/utils';

export function SettingsView() {
  const { user, permissions, refreshOrgContext } = useAuth();
  const [settings, setSettings] = useState<CompanySettings>(companyService.getSettings());
  const auditLogs = companyService.getAuditTrail().slice(0, 25);
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'VAT' | 'NUMBERING' | 'BANK' | 'AUDIT'>('PROFILE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form Fields
  const [legalName, setLegalName] = useState(settings.legal_company_name);
  const [tradingName, setTradingName] = useState(settings.trading_name || '');
  const [trn, setTrn] = useState(settings.trn);
  const [emirate, setEmirate] = useState<UAEEmirate>(settings.emirate);
  const [addressLine1, setAddressLine1] = useState(settings.address_line_1);
  const [city, setCity] = useState(settings.city);
  const [poBox, setPoBox] = useState(settings.po_box || '');
  const [email, setEmail] = useState(settings.email);
  const [phone, setPhone] = useState(settings.phone);
  const [mobile, setMobile] = useState(settings.mobile || '');
  const [website, setWebsite] = useState(settings.website || '');
  const [defaultCurrency, setDefaultCurrency] = useState(settings.default_currency);
  const [defaultVatRate, setDefaultVatRate] = useState(settings.default_vat_rate);
  const [invoicePrefix, setInvoicePrefix] = useState(settings.invoice_prefix);
  const [quotePrefix, setQuotePrefix] = useState(settings.quote_prefix);
  const [creditNotePrefix, setCreditNotePrefix] = useState(settings.credit_note_prefix);
  const [paymentPrefix, setPaymentPrefix] = useState(settings.payment_prefix);
  const [paymentTermsDays, setPaymentTermsDays] = useState(settings.default_payment_terms_days);
  const [bankName, setBankName] = useState(settings.bank_name || '');
  const [accountName, setAccountName] = useState(settings.bank_account_name || '');
  const [accountNumber, setAccountNumber] = useState(settings.bank_account_number || '');
  const [iban, setIban] = useState(settings.bank_iban || '');
  const [swift, setSwift] = useState(settings.bank_swift_bic || '');
  const [branch, setBranch] = useState(settings.bank_branch || '');
  const [footerNotes, setFooterNotes] = useState(settings.invoice_footer_notes || '');
  const [terms, setTerms] = useState(settings.terms_and_conditions || '');

  const canEdit = permissions.canEditCompanySettings;

  const handleSave = () => {
    if (!canEdit) {
      setFeedback({
        type: 'error',
        message: `Action denied: Users with role "${user.role}" do not have permission to modify company legal and tax settings.`,
      });
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setFeedback(null);

    const payload: Partial<CompanySettings> = {
      legal_company_name: legalName.trim(),
      trading_name: tradingName.trim() || undefined,
      trn: trn.trim(),
      emirate,
      address_line_1: addressLine1.trim(),
      city: city.trim(),
      po_box: poBox.trim() || undefined,
      email: email.trim(),
      phone: phone.trim(),
      mobile: mobile.trim() || undefined,
      website: website.trim() || undefined,
      default_currency: defaultCurrency,
      default_vat_rate: Number(defaultVatRate),
      invoice_prefix: invoicePrefix.trim(),
      quote_prefix: quotePrefix.trim(),
      credit_note_prefix: creditNotePrefix.trim(),
      payment_prefix: paymentPrefix.trim(),
      default_payment_terms_days: Number(paymentTermsDays),
      bank_name: bankName.trim() || undefined,
      bank_account_name: accountName.trim() || undefined,
      bank_account_number: accountNumber.trim() || undefined,
      bank_iban: iban.trim() || undefined,
      bank_swift_bic: swift.trim() || undefined,
      bank_branch: branch.trim() || undefined,
      invoice_footer_notes: footerNotes.trim() || undefined,
      terms_and_conditions: terms.trim() || undefined,
    };

    const res = companyService.updateSettings(payload, user.name);
    setIsSubmitting(false);

    if (!res.success) {
      if (res.errors) {
        setFieldErrors(res.errors);
      }
      setFeedback({
        type: 'error',
        message: res.error || 'Please correct validation issues before saving.',
      });
      return;
    }

    if (res.data) {
      setSettings(res.data);
      refreshOrgContext();
      setFeedback({
        type: 'success',
        message: 'Organization profile and tax settings successfully saved and updated across all document templates.',
      });
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Organization & Tax Settings</h1>
            {!canEdit && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <Lock className="h-3 w-3" /> Read-Only
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure legal company details, UAE TRN, bank wire coordinates, and numbering prefixes.
          </p>
        </div>

        {canEdit && (
          <Button
            variant="emerald"
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 shadow-sm font-semibold"
          >
            {isSubmitting ? (
              <span className="animate-spin">⏳</span>
            ) : feedback?.type === 'success' ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>{isSubmitting ? 'Saving...' : 'Save Settings'}</span>
          </Button>
        )}
      </div>

      {/* Permissions / Status Feedback */}
      {!canEdit && (
        <AlertBanner
          variant="info"
          title="Administrative Permission Required"
          message={`You are viewing company settings as "${user.name}" (${user.role}). Modifications require OWNER or ADMIN credentials.`}
        />
      )}

      {feedback && (
        <AlertBanner
          variant={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-px overflow-x-auto text-xs font-semibold">
        {[
          { id: 'PROFILE' as const, label: 'Business Profile & Tax', icon: Building2 },
          { id: 'BANK' as const, label: 'Bank Coordinates', icon: CreditCard },
          { id: 'VAT' as const, label: 'VAT Configuration Layer', icon: ShieldCheck },
          { id: 'NUMBERING' as const, label: 'Document Numbering', icon: FileCode },
          { id: 'AUDIT' as const, label: 'System Audit Trail', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Profile & Tax */}
      {activeTab === 'PROFILE' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">UAE Corporate Identification</CardTitle>
            <CardDescription>
              Legal entity details and 15-digit TRN printed on all official UAE Tax Invoices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Input
                  label="Legal Registered Company Name *"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  disabled={!canEdit}
                />
                <FormError message={fieldErrors.legal_company_name} />
              </div>
              <div>
                <Input
                  label="Trading / Brand Name"
                  value={tradingName}
                  onChange={(e) => setTradingName(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Input
                  label="UAE 15-Digit Tax Registration Number (TRN) *"
                  value={trn}
                  onChange={(e) => setTrn(e.target.value)}
                  disabled={!canEdit}
                  placeholder="100xxxxxxxx0003"
                />
                <FormError message={fieldErrors.trn} />
              </div>
              <div>
                <Select
                  label="Registered UAE Emirate *"
                  value={emirate}
                  onChange={(e) => setEmirate(e.target.value as UAEEmirate)}
                  disabled={!canEdit}
                  options={[
                    { label: 'Dubai', value: 'DUBAI' },
                    { label: 'Abu Dhabi', value: 'ABU_DHABI' },
                    { label: 'Sharjah', value: 'SHARJAH' },
                    { label: 'Ajman', value: 'AJMAN' },
                    { label: 'Ras Al Khaimah', value: 'RAS_AL_KHAIMAH' },
                    { label: 'Fujairah', value: 'FUJAIRAH' },
                    { label: 'Umm Al Quwain', value: 'UMM_AL_QUWAIN' },
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input
                  label="Office Physical Address *"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  disabled={!canEdit}
                />
                <FormError message={fieldErrors.address_line_1} />
              </div>
              <div>
                <Input
                  label="City / Free Zone *"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={!canEdit}
                />
                <FormError message={fieldErrors.city} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Input
                  label="Corporate Billing Email *"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!canEdit}
                />
                <FormError message={fieldErrors.email} />
              </div>
              <div>
                <Input
                  label="Primary Phone *"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!canEdit}
                />
                <FormError message={fieldErrors.phone} />
              </div>
              <div>
                <Input
                  label="PO Box"
                  value={poBox}
                  onChange={(e) => setPoBox(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Textarea
                label="Default Invoice Footer / Compliance Notice"
                value={footerNotes}
                onChange={(e) => setFooterNotes(e.target.value)}
                disabled={!canEdit}
                rows={2}
              />
              <Textarea
                label="Default Terms & Conditions"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                disabled={!canEdit}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Bank Coordinates */}
      {activeTab === 'BANK' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">UAE Banking Coordinates</CardTitle>
            <CardDescription>
              Bank wire instructions displayed on customer invoices for direct settlement
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Bank Name"
                placeholder="e.g. Emirates NBD, First Abu Dhabi Bank (FAB)"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                disabled={!canEdit}
              />
              <Input
                label="Account Beneficiary Name"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                disabled={!canEdit}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Input
                  label="UAE IBAN (Starts with AE + 21 digits)"
                  placeholder="AE290330000000000000000"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  disabled={!canEdit}
                />
                <FormError message={fieldErrors.bank_iban} />
              </div>
              <Input
                label="Account Number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                disabled={!canEdit}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="SWIFT / BIC Code"
                value={swift}
                onChange={(e) => setSwift(e.target.value)}
                disabled={!canEdit}
              />
              <Input
                label="Bank Branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: VAT Configuration Layer */}
      {activeTab === 'VAT' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">
              UAE Federal Decree-Law No. (8) on VAT
            </CardTitle>
            <CardDescription>
              Standard 5% tax configuration, Zero-Rated exports, and FTA compliance rules
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-semibold text-slate-900 text-xs">Default Tax Rate</div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={defaultVatRate}
                    onChange={(e) => setDefaultVatRate(Number(e.target.value))}
                    disabled={!canEdit}
                    className="w-24"
                  />
                  <span className="text-xs text-slate-600 font-semibold">% (Standard UAE VAT)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Applied to standard taxable goods and services supplied in UAE mainland or free zones.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-semibold text-slate-900 text-xs">Operating Currency</div>
                <div className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                  <span>🇦🇪</span>
                  <span>{defaultCurrency} (United Arab Emirates Dirham)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  FTA mandates all tax invoices must state amounts in AED or provide central bank exchange rates.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600 mt-0.5" />
                <div>
                  <div className="font-semibold text-emerald-950 text-xs">E-Invoicing Phase 2 Ready</div>
                  <div className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                    This tenant repository supports SHA-256 cryptographic chaining, UUID generation, and Peppol-compatible UBL 2.1 schema formatting for upcoming UAE Ministry of Finance mandates.
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Document Numbering */}
      {activeTab === 'NUMBERING' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">Sequential Document Sequences</CardTitle>
            <CardDescription>
              Strict uninterrupted sequential numbering mandated by UAE FTA tax invoice requirements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Tax Invoice Prefix"
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value)}
                  disabled={!canEdit}
                />
                <FormError message={fieldErrors.invoice_prefix} />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Format: {invoicePrefix}-2026-00001
                </span>
              </div>

              <div>
                <Input
                  label="Commercial Quote Prefix"
                  value={quotePrefix}
                  onChange={(e) => setQuotePrefix(e.target.value)}
                  disabled={!canEdit}
                />
                <FormError message={fieldErrors.quote_prefix} />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Format: {quotePrefix}-2026-00001
                </span>
              </div>

              <div>
                <Input
                  label="Credit Note Prefix"
                  value={creditNotePrefix}
                  onChange={(e) => setCreditNotePrefix(e.target.value)}
                  disabled={!canEdit}
                />
                <FormError message={fieldErrors.credit_note_prefix} />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Format: {creditNotePrefix}-2026-00001
                </span>
              </div>

              <div>
                <Input
                  label="Payment Receipt Prefix"
                  value={paymentPrefix}
                  onChange={(e) => setPaymentPrefix(e.target.value)}
                  disabled={!canEdit}
                />
                <FormError message={fieldErrors.payment_prefix} />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Format: {paymentPrefix}-2026-00001
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 5: System Audit Trail */}
      {activeTab === 'AUDIT' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">Immutable Audit Trail</CardTitle>
            <CardDescription>
              Chronological log of system actions, settings changes, and financial records
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[600px]">
                <thead className="bg-slate-50 text-slate-500 border-y border-slate-200 font-medium">
                  <tr>
                    <th className="px-4 py-2.5">Timestamp</th>
                    <th className="px-4 py-2.5">User</th>
                    <th className="px-4 py-2.5">Action</th>
                    <th className="px-4 py-2.5">Entity</th>
                    <th className="px-4 py-2.5">Entity ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-2 font-sans font-medium text-slate-900">
                        {log.performed_by_name}
                      </td>
                      <td className="px-4 py-2 font-sans">
                        <Badge variant="secondary">{log.action}</Badge>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{log.entity_type}</td>
                      <td className="px-4 py-2 text-slate-400 text-[10px] truncate max-w-[120px]">
                        {log.entity_id}
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        No audit records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
