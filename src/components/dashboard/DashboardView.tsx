'use client';

import React, { useState } from 'react';
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
  Calendar,
  Wallet,
  PieChart as PieChartIcon,
  BarChart3,
  Layers,
  Sparkles,
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
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts';

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
  const [activeMainChart, setActiveMainChart] = useState<'COMBINED' | 'REVENUE' | 'COLLECTIONS'>('COMBINED');

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setMetrics(dashboardService.getMetrics());
      setRecentInvoices(dashboardService.getRecentInvoices(5));
      setRecentQuotes(dashboardService.getRecentQuotes(5));
      setCompany(companyService.getSettings());
      setLoading(false);
    }, 250);
  };

  const agingColors = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white p-4 sm:p-6 lg:p-8 shadow-sm border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/30">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>UAE Federal Tax Authority (FTA) Ready • TRN {company.trn}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {company.trading_name || company.legal_company_name}
            </h1>
            <p className="text-sm text-slate-300 max-w-xl">
              Welcome back, <strong className="text-white">{user.name}</strong> ({user.role}). Financial overview,
              quotations pipeline, receivables aging, and VAT compliance.
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

      {/* 8 KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Revenue this month */}
        <Card className="hover:shadow-md transition-shadow">
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
              <span className="text-emerald-600 font-semibold">Current Month</span> net invoiced
            </p>
          </CardContent>
        </Card>

        {/* 2. Revenue this year */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Revenue This Year
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Calendar className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(metrics.revenueThisYear)}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-teal-600 font-semibold">{new Date().getFullYear()} Annual Total</span> net sales
            </p>
          </CardContent>
        </Card>

        {/* 3. Outstanding */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Outstanding
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

        {/* 4. Overdue */}
        <Card className={`hover:shadow-md transition-shadow ${metrics.overdueReceivables > 0 ? 'border-rose-200 bg-rose-50/20' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Overdue
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
              Past payment terms • Immediate follow-up
            </p>
          </CardContent>
        </Card>

        {/* 5. Paid this month */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Paid This Month
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(metrics.paymentsReceivedThisMonth)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Cash collections received this month
            </p>
          </CardContent>
        </Card>

        {/* 6. VAT collected */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              VAT Collected
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-950">
              {formatCurrency(metrics.totalVatCollected)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Cumulative Net Output Tax (5% FTA)
            </p>
          </CardContent>
        </Card>

        {/* 7. Open quotations */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Open Quotations
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <FileCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              {metrics.openQuotationCount} <span className="text-sm font-medium text-slate-500">Proposals</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Active draft & sent quotation estimates
            </p>
          </CardContent>
        </Card>

        {/* 8. Quotation pipeline */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Quotation Pipeline
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(metrics.openQuotationValue)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Total potential revenue in conversion funnel
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Primary Charts Row: Monthly Revenue & Collections + Receivables Aging */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1 & 2: Monthly Revenue & Monthly Collections */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Monthly Performance (Revenue & Collections)
                </CardTitle>
                <CardDescription>
                  Invoiced net revenue vs. actual cash collected per month in AED
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveMainChart('COMBINED')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    activeMainChart === 'COMBINED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Both
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMainChart('REVENUE')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    activeMainChart === 'REVENUE' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Revenue
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMainChart('COLLECTIONS')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    activeMainChart === 'COLLECTIONS' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Collections
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {activeMainChart === 'COMBINED' ? (
                  <BarChart data={metrics.monthlyRevenue} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="revenue" fill="#0f766e" radius={[4, 4, 0, 0]} name="Invoiced Revenue" />
                    <Bar dataKey="collected" fill="#0284c7" radius={[4, 4, 0, 0]} name="Cash Collections" />
                  </BarChart>
                ) : activeMainChart === 'REVENUE' ? (
                  <AreaChart data={metrics.monthlyRevenue} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f766e" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
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
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#0f766e"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                      name="Invoiced Revenue"
                    />
                  </AreaChart>
                ) : (
                  <AreaChart data={metrics.monthlyRevenue} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
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
                    <Area
                      type="monotone"
                      dataKey="collected"
                      stroke="#0284c7"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorCollected)"
                      name="Cash Collected"
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 3: Outstanding Receivables Aging */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Outstanding Receivables
                </CardTitle>
                <CardDescription>Aging bracket distribution</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('reports')}>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={metrics.outstandingReceivablesBuckets || []}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Outstanding']}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {(metrics.outstandingReceivablesBuckets || []).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={agingColors[index % agingColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Charts Row: Revenue by Customer & Revenue by Service */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 4: Revenue by Customer */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Revenue by Customer
                </CardTitle>
                <CardDescription>Top UAE clients by invoiced volume</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('reports')}>
                All Clients <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {metrics.salesByCustomer && metrics.salesByCustomer.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={metrics.salesByCustomer.slice(0, 5)}
                    margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#475569"
                      fontSize={11}
                      tickLine={false}
                      width={120}
                      tickFormatter={(val) => (val.length > 16 ? `${val.substring(0, 16)}...` : val)}
                    />
                    <Tooltip
                      formatter={(value: any) => [formatCurrency(Number(value)), 'Revenue']}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#1e293b',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} name="Billed Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                No customer billing records available yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 5: Revenue by Service */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Revenue by Service
                </CardTitle>
                <CardDescription>Product and service breakdown</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('reports')}>
                View Items <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {metrics.revenueByService && metrics.revenueByService.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.revenueByService.slice(0, 5)}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(val) => (val.length > 12 ? `${val.substring(0, 12)}...` : val)}
                    />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip
                      formatter={(value: any) => [formatCurrency(Number(value)), 'Revenue']}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#1e293b',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="revenue" fill="#0d9488" radius={[4, 4, 0, 0]} name="Service Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                No service or product billing records available yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Operations Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {permissions.canCreateInvoice && (
          <button
            onClick={() => onQuickAction('NEW_INVOICE')}
            className="p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 hover:bg-emerald-50/20 text-left transition-all group flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Receipt className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900 group-hover:text-emerald-700">
                  Issue Tax Invoice
                </div>
                <div className="text-[11px] text-slate-500">Sequential UAE FTA invoice</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600" />
          </button>
        )}

        {permissions.canRecordPayment && (
          <button
            onClick={() => onQuickAction('RECORD_PAYMENT')}
            className="p-4 rounded-xl border border-slate-200 bg-white hover:border-amber-500 hover:bg-amber-50/20 text-left transition-all group flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <DollarSign className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900 group-hover:text-amber-700">
                  Record Payment
                </div>
                <div className="text-[11px] text-slate-500">Bank wire, cash, or card</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-amber-600" />
          </button>
        )}

        {permissions.canApproveQuote && (
          <button
            onClick={() => onQuickAction('NEW_QUOTE')}
            className="p-4 rounded-xl border border-slate-200 bg-white hover:border-sky-500 hover:bg-sky-50/20 text-left transition-all group flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                <FileCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900 group-hover:text-sky-700">
                  Prepare Quotation
                </div>
                <div className="text-[11px] text-slate-500">Send estimate to client</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-sky-600" />
          </button>
        )}

        {permissions.canManageCustomers && (
          <button
            onClick={() => onQuickAction('NEW_CUSTOMER')}
            className="p-4 rounded-xl border border-slate-200 bg-white hover:border-purple-500 hover:bg-purple-50/20 text-left transition-all group flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900 group-hover:text-purple-700">
                  Register Client
                </div>
                <div className="text-[11px] text-slate-500">Emirate & 15-digit TRN</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-purple-600" />
          </button>
        )}
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
                <table className="w-full text-xs text-left min-w-[540px]">
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
                          {inv.customer_snapshot?.company_name || inv.customer_snapshot?.contact_person}
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
                <table className="w-full text-xs text-left min-w-[540px]">
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
