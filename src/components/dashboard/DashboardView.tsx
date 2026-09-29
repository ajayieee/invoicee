'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  AlertCircle,
  FileCheck,
  Receipt,
  Users,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { dashboardService } from '@/services/dashboard.service';
import { companyService } from '@/services/company.service';
import { useAuth } from '@/context/AuthContext';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface DashboardViewProps {
  onNavigate: (tab: any) => void;
  onQuickAction: (action: 'NEW_QUOTE' | 'NEW_INVOICE' | 'RECORD_PAYMENT' | 'NEW_CUSTOMER') => void;
}

export function DashboardView({ onNavigate, onQuickAction }: DashboardViewProps) {
  const { user, permissions } = useAuth();
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState(dashboardService.getMetrics());
  const [recentInvoices, setRecentInvoices] = useState(dashboardService.getRecentInvoices(5));
  const [recentQuotes, setRecentQuotes] = useState(dashboardService.getRecentQuotes(5));
  const [company, setCompany] = useState(companyService.getSettings());

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setMetrics(dashboardService.getMetrics());
      setRecentInvoices(dashboardService.getRecentInvoices(5));
      setRecentQuotes(dashboardService.getRecentQuotes(5));
      setCompany(companyService.getSettings());
      setLoading(false);
    }, 300);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white p-6 sm:p-8 shadow-sm border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/30">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>UAE Federal Tax Authority (FTA) Ready • TRN {company.trn}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {company.trading_name || company.legal_company_name}
            </h1>
            <p className="text-sm text-slate-300 max-w-xl">
              Welcome back, <strong className="text-white">{user.name}</strong> ({user.role}). Monitor UAE sales,
              quotations, VAT compliance, and receivables.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="bg-slate-800/80 hover:bg-slate-800 text-white border-slate-700 flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            {permissions.canCreateInvoice && (
              <Button
                variant="emerald"
                size="sm"
                onClick={() => onQuickAction('NEW_INVOICE')}
                className="shadow-sm font-semibold"
              >
                + Create Tax Invoice
              </Button>
            )}
            {permissions.canApproveQuote && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onQuickAction('NEW_QUOTE')}
                className="bg-slate-800/80 hover:bg-slate-800 text-white border-slate-700"
              >
                + New Quotation
              </Button>
            )}
          </div>
        </div>
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue This Month */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Revenue This Month
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(metrics.revenueThisMonth)}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-600 font-semibold">Current Month</span> billed in {company.default_currency}
            </p>
          </CardContent>
        </Card>

        {/* Outstanding Receivables */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Outstanding Receivables
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(metrics.outstandingReceivables)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Unpaid balances across issued invoices
            </p>
          </CardContent>
        </Card>

        {/* Overdue Receivables */}
        <Card className={metrics.overdueReceivables > 0 ? 'border-rose-200 bg-rose-50/20' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Overdue Receivables
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">
              {formatCurrency(metrics.overdueReceivables)}
            </div>
            <p className="text-xs text-rose-600/80 mt-1 font-medium">
              Immediate collection follow-up needed
            </p>
          </CardContent>
        </Card>

        {/* VAT Collected */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              VAT Collected (5%)
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-800">
              {formatCurrency(metrics.totalVatCollected)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Cumulative output VAT on issued invoices
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <div className="text-xs font-medium text-slate-500">Payments Received This Month</div>
          <div className="text-lg font-bold text-slate-900 mt-1">
            {formatCurrency(metrics.paymentsReceivedThisMonth)}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <div className="text-xs font-medium text-slate-500">Annual Revenue ({new Date().getFullYear()})</div>
          <div className="text-lg font-bold text-slate-900 mt-1">
            {formatCurrency(metrics.revenueThisYear)}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <div className="text-xs font-medium text-slate-500">Open Quotations Value</div>
          <div className="text-lg font-bold text-slate-900 mt-1">
            {formatCurrency(metrics.openQuotationValue)}
            <span className="text-xs font-normal text-slate-500 ml-1.5">
              ({metrics.openQuotationCount} quotes)
            </span>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <div className="text-xs font-medium text-slate-500">Active UAE Clients</div>
          <div className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-1.5">
            <Users className="h-4 w-4 text-emerald-600" />
            <span>{metrics.totalCustomersCount} Accounts</span>
          </div>
        </div>
      </div>

      {/* Monthly Performance Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  {new Date().getFullYear()} Revenue & Payment Collections (AED)
                </CardTitle>
                <CardDescription>
                  Comparison between total invoiced amounts and realized cash collections
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('reports')}>
                View Full Reports <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.monthlyRevenue} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    formatter={(value: any) => [formatCurrency(Number(value)), '']}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="revenue" fill="#0f766e" radius={[4, 4, 0, 0]} name="Invoiced Revenue" />
                  <Bar dataKey="collected" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Cash Collected" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Quick Operations & Receivables Overview */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              Quick Operations
            </CardTitle>
            <CardDescription>Role-governed transaction shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {permissions.canCreateInvoice && (
              <button
                onClick={() => onQuickAction('NEW_INVOICE')}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 flex items-center justify-between text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 group-hover:text-emerald-700">
                      Issue Tax Invoice
                    </div>
                    <div className="text-[11px] text-slate-500">Sequential UAE FTA formatted invoice</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600" />
              </button>
            )}

            {permissions.canRecordPayment && (
              <button
                onClick={() => onQuickAction('RECORD_PAYMENT')}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/30 flex items-center justify-between text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 group-hover:text-amber-700">
                      Record Payment
                    </div>
                    <div className="text-[11px] text-slate-500">Apply cash, cheque, or bank wire</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-amber-600" />
              </button>
            )}

            {permissions.canApproveQuote && (
              <button
                onClick={() => onQuickAction('NEW_QUOTE')}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50/30 flex items-center justify-between text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                    <FileCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 group-hover:text-sky-700">
                      Prepare Quotation
                    </div>
                    <div className="text-[11px] text-slate-500">Send estimate with 1-click invoice conversion</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-sky-600" />
              </button>
            )}

            {permissions.canManageCustomers && (
              <button
                onClick={() => onQuickAction('NEW_CUSTOMER')}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/30 flex items-center justify-between text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 group-hover:text-purple-700">
                      Register Client / Prospect
                    </div>
                    <div className="text-[11px] text-slate-500">Configure Emirate and 15-digit TRN</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-purple-600" />
              </button>
            )}
          </CardContent>
          <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex items-center justify-between text-xs text-slate-500">
            <span>Currency: <strong>{company.default_currency}</strong></span>
            <span>VAT Rate: <strong>{company.default_vat_rate}%</strong></span>
          </div>
        </Card>
      </div>

      {/* Recent Invoices & Recent Quotations Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">Recent Invoices</CardTitle>
              <CardDescription>Latest financial billings</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('invoices')}>
              View All <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <SkeletonTable rows={4} columns={5} />
            ) : recentInvoices.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No Invoices Issued Yet"
                  description="Issue your first FTA-compliant 5% VAT invoice to begin tracking receivables."
                  action={
                    permissions.canCreateInvoice
                      ? { label: 'Create Invoice', onClick: () => onQuickAction('NEW_INVOICE'), icon: Receipt }
                      : undefined
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 border-y border-slate-200/80">
                    <tr>
                      <th className="px-4 py-2 font-medium">Invoice #</th>
                      <th className="px-4 py-2 font-medium">Customer</th>
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium">Total</th>
                      <th className="px-4 py-2 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-slate-900 font-mono">
                          {inv.invoice_number}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 truncate max-w-[140px]">
                          {inv.customer_snapshot.company_name || inv.customer_snapshot.contact_person}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                          {formatDate(inv.invoice_date)}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900">
                          {formatCurrency(inv.grand_total)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <StatusBadge status={inv.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Quotes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">Recent Quotations</CardTitle>
              <CardDescription>Pipeline and active proposals</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('quotes')}>
              View All <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <SkeletonTable rows={4} columns={5} />
            ) : recentQuotes.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No Quotations in Pipeline"
                  description="Create proposals for prospects and active clients with 1-click invoice conversion."
                  action={
                    permissions.canApproveQuote
                      ? { label: 'Create Quote', onClick: () => onQuickAction('NEW_QUOTE'), icon: FileCheck }
                      : undefined
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 border-y border-slate-200/80">
                    <tr>
                      <th className="px-4 py-2 font-medium">Quote #</th>
                      <th className="px-4 py-2 font-medium">Customer</th>
                      <th className="px-4 py-2 font-medium">Expires</th>
                      <th className="px-4 py-2 font-medium">Value</th>
                      <th className="px-4 py-2 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentQuotes.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-slate-900 font-mono">
                          {q.quote_number}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 truncate max-w-[140px]">
                          {q.customer_name}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                          {formatDate(q.expiry_date)}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900">
                          {formatCurrency(q.grand_total)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <StatusBadge status={q.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
