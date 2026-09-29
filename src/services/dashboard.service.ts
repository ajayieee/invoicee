import { Invoice, Quote, Payment } from '@/types/database';
import { db } from '@/lib/db/repository';

export interface DashboardMetricsData {
  revenueThisMonth: number;
  revenueThisYear: number;
  outstandingReceivables: number;
  overdueReceivables: number;
  paymentsReceivedThisMonth: number;
  totalVatCollected: number;
  openQuotationCount: number;
  openQuotationValue: number;
  totalCustomersCount: number;
  monthlyRevenue: { month: string; revenue: number; collected: number }[];
  salesByCustomer: { name: string; value: number }[];
}

class DashboardService {
  getMetrics(): DashboardMetricsData {
    return db.getDashboardMetrics();
  }

  getRecentInvoices(limit = 5): Invoice[] {
    const invoices = db.getInvoices();
    return invoices
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  getRecentQuotes(limit = 5): Quote[] {
    const quotes = db.getQuotes();
    return quotes
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  getRecentPayments(limit = 5): Payment[] {
    const payments = db.getPayments();
    return payments
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }
}

export const dashboardService = new DashboardService();
