'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  User,
  Phone,
  Mail,
  MapPin,
  Search,
  ShieldCheck,
  Edit2,
  Trash2,
  Power,
  RotateCcw,
  Receipt,
  FileText,
  Filter,
  CreditCard,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { FormError, AlertBanner } from '@/components/ui/FormError';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';
import { Customer, CustomerType, CustomerRelation, UAEEmirate } from '@/types/database';
import { customerService, Customer360Summary } from '@/services/customer.service';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils';

interface CustomersViewProps {
  onSelectCustomerForInvoice?: (customer: Customer) => void;
  onSelectCustomerForQuote?: (customer: Customer) => void;
}

export function CustomersView({ onSelectCustomerForInvoice, onSelectCustomerForQuote }: CustomersViewProps) {
  const { user, permissions } = useAuth();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRelation, setSelectedRelation] = useState<CustomerRelation | 'ALL'>('ALL');
  const [selectedEmirate, setSelectedEmirate] = useState<UAEEmirate | 'ALL'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Data State
  const [pagedData, setPagedData] = useState(() =>
    customerService.getCustomers({
      search: '',
      relationType: 'ALL',
      emirate: 'ALL',
      page: 1,
      pageSize: 10,
    })
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detail360, setDetail360] = useState<Customer360Summary | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCustomerType, setFormCustomerType] = useState<CustomerType>('COMPANY');
  const [formRelationType, setFormRelationType] = useState<CustomerRelation>('CUSTOMER');
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [trn, setTrn] = useState('');
  const [emirate, setEmirate] = useState<UAEEmirate>('DUBAI');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('Dubai');
  const [poBox, setPoBox] = useState('');
  const [paymentTerms, setPaymentTerms] = useState(30);
  const [notes, setNotes] = useState('');

  // Errors & Feedback
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [alertFeedback, setAlertFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Delete Confirmation State
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      await customerService.syncCustomers({
        search,
        relationType: selectedRelation,
        emirate: selectedEmirate,
      });
    } catch (e) {
      console.warn('Customer cloud sync failed:', e);
    }
    const result = customerService.getCustomers({
      search,
      relationType: selectedRelation,
      emirate: selectedEmirate,
      page: currentPage,
      pageSize,
    });
    setPagedData(result);
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, [search, selectedRelation, selectedEmirate, currentPage, pageSize]);

  const handleOpenCreate = (relationType?: unknown) => {
    const targetRelation: CustomerRelation =
      relationType === 'PROSPECT' || relationType === 'CUSTOMER'
        ? relationType
        : selectedRelation === 'PROSPECT'
        ? 'PROSPECT'
        : 'CUSTOMER';
    setEditingId(null);
    setFormCustomerType('COMPANY');
    setFormRelationType(targetRelation);
    setCompanyName('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setMobile('');
    setTrn('');
    setEmirate('DUBAI');
    setAddressLine1('');
    setCity('Dubai');
    setPoBox('');
    setPaymentTerms(30);
    setNotes('');
    setFieldErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingId(c.id);
    setFormCustomerType(c.customer_type);
    setFormRelationType(c.relation_type);
    setCompanyName(c.company_name || '');
    setContactPerson(c.contact_person);
    setEmail(c.email || '');
    setPhone(c.phone || '');
    setMobile(c.mobile || '');
    setTrn(c.trn || '');
    setEmirate(c.billing_emirate || 'DUBAI');
    setAddressLine1(c.billing_address_line_1 || '');
    setCity(c.billing_city || 'Dubai');
    setPoBox(c.billing_po_box || '');
    setPaymentTerms(c.payment_terms_days);
    setNotes(c.notes || '');
    setFieldErrors({});
    setModalOpen(true);
  };

  const handleSaveCustomer = async () => {
    setFieldErrors({});

    const payload = {
      customer_type: formCustomerType,
      relation_type: formRelationType,
      company_name: formCustomerType === 'COMPANY' ? companyName.trim() : undefined,
      contact_person: contactPerson.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      mobile: mobile.trim() || undefined,
      trn: trn.trim() || undefined,
      billing_emirate: emirate,
      billing_address_line_1: addressLine1.trim() || undefined,
      billing_city: city.trim() || 'Dubai',
      billing_po_box: poBox.trim() || undefined,
      payment_terms_days: Number(paymentTerms) || 30,
      notes: notes.trim() || undefined,
    };

    const res = await (editingId
      ? customerService.updateCustomer(editingId, payload, user.name)
      : customerService.createCustomer(payload, user.name));

    if (!res.success) {
      if (res.errors) {
        setFieldErrors(res.errors);
      }
      setAlertFeedback({
        type: 'error',
        message: res.error || 'Please correct the highlighted form errors.',
      });
      return;
    }

    setModalOpen(false);
    setAlertFeedback({
      type: 'success',
      message: `Account "${payload.company_name || payload.contact_person}" successfully ${
        editingId ? 'updated' : 'registered'
      }.`,
    });
    setTimeout(() => setAlertFeedback(null), 4000);
    await fetchCustomers();
  };

  const handleView360 = (c: Customer) => {
    const summary = customerService.getCustomer360(c.id);
    setDetail360(summary);
    setDetailModalOpen(true);
  };

  const handleToggleActive = async (c: Customer) => {
    await customerService.toggleActive(c.id);
    await fetchCustomers();
    if (detail360 && detail360.customer.id === c.id) {
      setDetail360(customerService.getCustomer360(c.id));
    }
  };

  const handleDeleteClick = (c: Customer) => {
    setCustomerToDelete(c);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    const displayName = customerToDelete.company_name || customerToDelete.contact_person;
    setIsDeleting(true);
    try {
      const res = await customerService.deleteCustomer(customerToDelete.id, user.name);
      if (!res.success) {
        setAlertFeedback({
          type: 'error',
          message: res.error || 'Failed to delete customer.',
        });
        return;
      }

      setAlertFeedback({
        type: 'success',
        message: `Account "${displayName}" deleted successfully.`,
      });
      setTimeout(() => setAlertFeedback(null), 4000);
      await fetchCustomers();
      setCustomerToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Customers & Prospects</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage UAE commercial clients, individual buyers, 15-digit TRNs, and sales leads.
          </p>
        </div>

        {permissions.canManageCustomers && (
          <Button variant="emerald" onClick={() => handleOpenCreate()} className="flex items-center gap-1.5 shadow-sm font-semibold">
            <Plus className="h-4 w-4" />
            <span>New Customer / Prospect</span>
          </Button>
        )}
      </div>

      {alertFeedback && (
        <AlertBanner
          variant={alertFeedback.type}
          message={alertFeedback.message}
          onClose={() => setAlertFeedback(null)}
        />
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        {/* Relation Status Tabs */}
        <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => {
              setSelectedRelation('ALL');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              selectedRelation === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            All Accounts
          </button>
          <button
            onClick={() => {
              setSelectedRelation('CUSTOMER');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              selectedRelation === 'CUSTOMER'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Active Customers
          </button>
          <button
            onClick={() => {
              setSelectedRelation('PROSPECT');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              selectedRelation === 'PROSPECT'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Sales Prospects
          </button>
        </div>

        {/* Emirate Filter & Search Input */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedEmirate}
            onChange={(e) => {
              setSelectedEmirate(e.target.value as UAEEmirate | 'ALL');
              setCurrentPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            <option value="ALL">All 7 Emirates</option>
            <option value="DUBAI">Dubai</option>
            <option value="ABU_DHABI">Abu Dhabi</option>
            <option value="SHARJAH">Sharjah</option>
            <option value="AJMAN">Ajman</option>
            <option value="RAS_AL_KHAIMAH">Ras Al Khaimah</option>
            <option value="FUJAIRAH">Fujairah</option>
            <option value="UMM_AL_QUWAIN">Umm Al Quwain</option>
          </select>

          <div className="relative flex-1 md:w-64">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, TRN, email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <SkeletonTable rows={5} columns={7} />
          ) : pagedData.items.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Users}
                title={
                  search || selectedEmirate !== 'ALL'
                    ? 'No Matching Accounts Found'
                    : selectedRelation === 'PROSPECT'
                    ? 'No Sales Prospects Found'
                    : selectedRelation === 'CUSTOMER'
                    ? 'No Active Customers Found'
                    : 'No Customers or Prospects Found'
                }
                description={
                  search || selectedEmirate !== 'ALL'
                    ? 'No accounts match your search filters. Try clearing filters or searching for another keyword.'
                    : selectedRelation === 'PROSPECT'
                    ? 'Register your first sales prospect or lead to start tracking pipeline opportunities.'
                    : selectedRelation === 'CUSTOMER'
                    ? 'Register your first commercial client with UAE TRN registration.'
                    : 'Register your first commercial client or sales lead with UAE TRN registration.'
                }
                action={
                  search || selectedEmirate !== 'ALL'
                    ? {
                        label: 'Reset Filters',
                        onClick: () => {
                          setSearch('');
                          setSelectedEmirate('ALL');
                        },
                        icon: RotateCcw,
                      }
                    : permissions.canManageCustomers
                    ? {
                        label: selectedRelation === 'PROSPECT' ? 'Register Sales Prospect' : 'Register First Client',
                        onClick: () => handleOpenCreate(selectedRelation === 'PROSPECT' ? 'PROSPECT' : 'CUSTOMER'),
                        icon: Plus,
                      }
                    : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[800px]">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                  <tr>
                    <th className="px-4 py-3">Account Name / Contact</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Emirate / City</th>
                    <th className="px-4 py-3">UAE TRN (Tax No)</th>
                    <th className="px-4 py-3">Contact Details</th>
                    <th className="px-4 py-3">Terms</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedData.items.map((c) => (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !c.is_active ? 'opacity-50 bg-slate-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-slate-900">
                            {c.company_name || c.contact_person}
                          </div>
                          {!c.is_active && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-medium">
                              Inactive
                            </span>
                          )}
                        </div>
                        {c.company_name && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3" />
                            <span>Attn: {c.contact_person}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={c.relation_type === 'CUSTOMER' ? 'success' : 'converted'}>
                            {c.relation_type}
                          </Badge>
                          <span className="text-[10px] text-slate-500 uppercase font-mono">
                            {c.customer_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          <span>{c.billing_emirate || c.billing_city || 'UAE'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {c.trn ? (
                          <span className="inline-flex items-center gap-1 text-slate-800 font-medium">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                            {c.trn}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unregistered</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 space-y-0.5">
                        {c.email && (
                          <div className="flex items-center gap-1 truncate max-w-[160px]">
                            <Mail className="h-3 w-3 text-slate-400" />
                            <span>{c.email}</span>
                          </div>
                        )}
                        {(c.phone || c.mobile) && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{c.phone || c.mobile}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {c.payment_terms_days} Days
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView360(c)}
                            className="h-7 text-xs px-2"
                          >
                            View 360°
                          </Button>

                          {permissions.canManageCustomers && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEdit(c)}
                                className="h-7 text-xs px-2"
                              >
                                <Edit2 className="h-3 w-3 mr-1" /> Edit
                              </Button>
                              <button
                                onClick={() => handleToggleActive(c)}
                                title={c.is_active ? 'Deactivate account' : 'Activate account'}
                                className={`p-1.5 rounded hover:bg-slate-100 cursor-pointer ${
                                  c.is_active ? 'text-slate-500 hover:text-amber-600' : 'text-amber-600'
                                }`}
                              >
                                <Power className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(c)}
                                title="Delete account (checked for financial links)"
                                className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          <Pagination
            currentPage={pagedData.currentPage}
            totalPages={pagedData.totalPages}
            totalItems={pagedData.totalItems}
            pageSize={pagedData.pageSize}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </CardContent>
      </Card>

      {/* Customer 360 Detail Modal */}
      {detailModalOpen && detail360 && (
        <Dialog
          open={detailModalOpen}
          onOpenChange={(open) => !open && setDetailModalOpen(false)}
          title={`${detail360.customer.company_name || detail360.customer.contact_person} (360° Overview)`}
          description={`Comprehensive financial ledger and sales history • Registered in ${
            detail360.customer.billing_emirate || 'UAE'
          }`}
          maxWidth="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                {onSelectCustomerForInvoice && permissions.canCreateInvoice && (
                  <Button
                    variant="emerald"
                    size="sm"
                    onClick={() => {
                      const c = detail360.customer;
                      setDetailModalOpen(false);
                      onSelectCustomerForInvoice(c);
                    }}
                  >
                    <Receipt className="h-3.5 w-3.5 mr-1" /> New Invoice
                  </Button>
                )}
                {onSelectCustomerForQuote && permissions.canApproveQuote && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const c = detail360.customer;
                      setDetailModalOpen(false);
                      onSelectCustomerForQuote(c);
                    }}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1" /> New Quote
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {permissions.canManageCustomers && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const c = detail360.customer;
                      setDetailModalOpen(false);
                      handleOpenEdit(c);
                    }}
                  >
                    Edit Account
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => setDetailModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Financial Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Total Billed</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">
                  {formatCurrency(detail360.totalInvoiced)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
                <div className="text-[10px] text-emerald-800 font-semibold uppercase">Total Paid</div>
                <div className="text-base font-bold text-emerald-800 mt-0.5">
                  {formatCurrency(detail360.totalPaid)}
                </div>
              </div>
              <div
                className={`p-3 rounded-xl border ${
                  detail360.totalBalanceDue > 0
                    ? 'bg-rose-50/60 border-rose-200 text-rose-800'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <div className="text-[10px] font-semibold uppercase">Outstanding Due</div>
                <div className="text-base font-bold mt-0.5">
                  {formatCurrency(detail360.totalBalanceDue)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Active Quotes</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">
                  {detail360.quotes.length} Quotes
                </div>
              </div>
            </div>

            {/* Profile Info */}
            <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5">
              <div className="font-semibold text-slate-900 flex items-center justify-between">
                <span>Account Information</span>
                <span className="font-mono text-slate-600 font-normal">
                  TRN: {detail360.customer.trn || 'Unregistered'}
                </span>
              </div>
              <div className="text-slate-600">
                {detail360.customer.billing_address_line_1 || 'No street address specified'}
                {detail360.customer.billing_address_line_2 && `, ${detail360.customer.billing_address_line_2}`}
              </div>
              <div className="text-slate-600">
                {detail360.customer.billing_city}, {detail360.customer.billing_emirate}, United Arab Emirates
                {detail360.customer.billing_po_box && ` • PO Box: ${detail360.customer.billing_po_box}`}
              </div>
              <div className="pt-1.5 flex flex-wrap gap-4 text-slate-700">
                {detail360.customer.email && <span>📧 {detail360.customer.email}</span>}
                {detail360.customer.phone && <span>📞 {detail360.customer.phone}</span>}
                {detail360.customer.mobile && <span>📱 {detail360.customer.mobile}</span>}
              </div>
            </div>

            {/* Invoices List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">Invoices Billed to Account</span>
                <span className="text-[11px] text-slate-500">{detail360.invoices.length} invoices found</span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-left min-w-[500px]">
                  <thead className="bg-slate-50 text-slate-500 text-[11px] sticky top-0">
                    <tr>
                      <th className="p-2 font-medium">Invoice #</th>
                      <th className="p-2 font-medium">Date</th>
                      <th className="p-2 font-medium">Grand Total</th>
                      <th className="p-2 font-medium">Balance Due</th>
                      <th className="p-2 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail360.invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="p-2 font-mono font-semibold text-slate-900">{inv.invoice_number}</td>
                        <td className="p-2 text-slate-500">{formatDate(inv.invoice_date)}</td>
                        <td className="p-2 font-semibold text-slate-900">{formatCurrency(inv.grand_total)}</td>
                        <td className="p-2 font-semibold text-rose-600">{formatCurrency(inv.balance_due)}</td>
                        <td className="p-2 text-right">
                          <Badge
                            variant={
                              inv.status === 'PAID'
                                ? 'success'
                                : inv.status === 'OVERDUE'
                                ? 'danger'
                                : 'info'
                            }
                          >
                            {inv.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {detail360.invoices.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400">
                          No invoices recorded for this account.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payments List */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  <span>Payments Received from Account</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  {detail360.payments?.length || 0} payments found
                </span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-left min-w-[550px]">
                  <thead className="bg-slate-50 text-slate-500 text-[11px] sticky top-0">
                    <tr>
                      <th className="p-2 font-medium">Receipt #</th>
                      <th className="p-2 font-medium">Date</th>
                      <th className="p-2 font-medium">Invoice #</th>
                      <th className="p-2 font-medium">Method</th>
                      <th className="p-2 font-medium">Ref #</th>
                      <th className="p-2 font-medium text-right">Amount (AED)</th>
                      <th className="p-2 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail360.payments?.map((pmt) => (
                      <tr key={pmt.id} className="hover:bg-slate-50">
                        <td className="p-2 font-mono font-semibold text-slate-900">
                          {pmt.payment_number}
                        </td>
                        <td className="p-2 text-slate-500">{formatDate(pmt.payment_date)}</td>
                        <td className="p-2 font-mono text-slate-700">{pmt.invoice_number || '-'}</td>
                        <td className="p-2 text-slate-600">{pmt.payment_method_name || 'Payment'}</td>
                        <td className="p-2 text-slate-500 font-mono text-[10px]">
                          {pmt.reference_number || '-'}
                        </td>
                        <td className="p-2 font-semibold text-emerald-700 text-right">
                          {formatCurrency(pmt.amount)}
                        </td>
                        <td className="p-2 text-right">
                          <Badge variant={pmt.status === 'RECORDED' ? 'success' : 'secondary'}>
                            {pmt.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {(!detail360.payments || detail360.payments.length === 0) && (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-400">
                          No payments recorded for this account.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* Create / Edit Customer Modal */}
      <Dialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingId ? 'Edit Account Details' : 'Register New UAE Customer or Prospect'}
        description="Configure commercial entity, Emirate jurisdiction, and 15-digit UAE TRN."
        maxWidth="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="emerald" onClick={handleSaveCustomer}>
              {editingId ? 'Save Changes' : 'Create Account'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Account Category Selection */}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Account Relationship *"
              value={formRelationType}
              onChange={(e) => setFormRelationType(e.target.value as CustomerRelation)}
              options={[
                { label: 'Active Customer', value: 'CUSTOMER' },
                { label: 'Sales Prospect (Lead)', value: 'PROSPECT' },
              ]}
            />
            <Select
              label="Entity Type *"
              value={formCustomerType}
              onChange={(e) => setFormCustomerType(e.target.value as CustomerType)}
              options={[
                { label: 'Corporate / Company', value: 'COMPANY' },
                { label: 'Individual Person', value: 'INDIVIDUAL' },
              ]}
            />
          </div>

          {/* Company & Contact Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {formCustomerType === 'COMPANY' && (
              <div>
                <Input
                  label="Legal Company Name *"
                  placeholder="e.g. Dubai Logistics Global FZ-LLC"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
                <FormError message={fieldErrors.company_name} />
              </div>
            )}
            <div>
              <Input
                label="Primary Contact Person *"
                placeholder="e.g. Farhan Siddiqui"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
              <FormError message={fieldErrors.contact_person} />
            </div>
          </div>

          {/* UAE TRN & Emirate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                label="UAE 15-Digit TRN (Tax Registration Number)"
                placeholder="100xxxxxxxx0003"
                value={trn}
                onChange={(e) => setTrn(e.target.value)}
              />
              <FormError message={fieldErrors.trn} />
            </div>
            <div>
              <Select
                label="UAE Emirate *"
                value={emirate}
                onChange={(e) => setEmirate(e.target.value as UAEEmirate)}
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

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Input
                label="Email Address"
                type="email"
                placeholder="billing@company.ae"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <FormError message={fieldErrors.email} />
            </div>
            <div>
              <Input
                label="Landline Phone"
                placeholder="+971 4 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <FormError message={fieldErrors.phone} />
            </div>
            <div>
              <Input
                label="Mobile Number"
                placeholder="+971 50 123 4567"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
              <FormError message={fieldErrors.mobile} />
            </div>
          </div>

          {/* Billing Address */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Input
                label="Billing Address"
                placeholder="Building name, Street, Free Zone or Area"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
              />
            </div>
            <Input
              label="PO Box"
              placeholder="e.g. 500123"
              value={poBox}
              onChange={(e) => setPoBox(e.target.value)}
            />
          </div>

          {/* Payment Terms & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Input
                label="Payment Terms (Days)"
                type="number"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(Number(e.target.value))}
              />
              <FormError message={fieldErrors.payment_terms_days} />
            </div>
            <div className="sm:col-span-2">
              <Input
                label="Internal Account Notes"
                placeholder="Key billing details or partner arrangements"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Dialog>

      {/* Custom Confirmation Delete Modal */}
      <ConfirmDeleteModal
        open={!!customerToDelete}
        onOpenChange={(open) => {
          if (!open) setCustomerToDelete(null);
        }}
        title="Confirm Delete"
        itemType="customer account"
        itemName={customerToDelete ? (customerToDelete.company_name || customerToDelete.contact_person) : undefined}
        description="This action cannot be undone. Customer accounts with active invoices, quotations, or ledger transactions are protected against deletion."
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
