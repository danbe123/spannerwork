import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { invoicesService } from '@/api/services';
import type { Invoice, ListInvoicesParams } from '@/api/services';
import useAuth from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft,
  FileText,
  Download,
  Calendar,
  Settings,
  TrendingUp,
  TrendingDown,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import SEO from '@/components/SEO';

function formatCurrency(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Invoices(): JSX.Element {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  // Filter state
  const [filters, setFilters] = useState<ListInvoicesParams>({
    page: 1,
    limit: 10,
  });

  // Fetch invoices
  const { data, isLoading } = useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => invoicesService.list(filters),
    enabled: !!user,
  });

  // Fetch current year tax summary
  const currentYear = new Date().getFullYear();
  const { data: taxData } = useQuery({
    queryKey: ['tax-summary', currentYear],
    queryFn: () => invoicesService.getTaxSummary(currentYear),
    enabled: !!user,
  });

  const invoices = data?.invoices ?? [];
  const total = data?.total ?? 0;
  const page = data?.page ?? 1;
  const limit = data?.limit ?? 10;
  const totalPages = Math.ceil(total / limit);
  const taxSummary = taxData?.summary;

  const handleDownload = async (invoice: Invoice) => {
    try {
      const blob = await invoicesService.downloadPdf(invoice.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download invoice');
    }
  };

  const handleExportCsv = async () => {
    try {
      const blob = await invoicesService.exportCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('CSV exported successfully');
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-gray-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-32 w-full rounded-xl mb-4" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/profile');
    return <></>;
  }

  return (
    <>
      <SEO title="Invoices" description="View and download your invoices" />

      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-gray-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/profile')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
                <p className="text-gray-600">View and download your transaction invoices</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/invoice-settings')}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button variant="outline" onClick={handleExportCsv}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Tax Summary Cards */}
          {taxSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-green-600 mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs font-medium">Income</span>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(taxSummary.totalIncome)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-red-600 mb-1">
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-xs font-medium">Expenses</span>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(taxSummary.totalExpenses)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <FileText className="h-4 w-4" />
                    <span className="text-xs font-medium">VAT Collected</span>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(taxSummary.totalVatCollected)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-purple-600 mb-1">
                    <Calendar className="h-4 w-4" />
                    <span className="text-xs font-medium">Invoices</span>
                  </div>
                  <p className="text-xl font-bold">{taxSummary.invoiceCount}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <Filter className="h-4 w-4 text-gray-500" />
                <Select
                  value={filters.type || 'all'}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      type: value === 'all' ? undefined : (value as 'RENTER' | 'PROVIDER'),
                      page: 1,
                    }))
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="RENTER">Renter (Expenses)</SelectItem>
                    <SelectItem value="PROVIDER">Provider (Income)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Invoice List */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice History</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices yet</h3>
                  <p className="text-gray-600">
                    Invoices will appear here after you complete transactions
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                          <FileText className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                          <p className="text-sm text-gray-500">
                            {formatDate(invoice.issueDate)} - {invoice.recipientName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge
                          variant={invoice.type === 'PROVIDER' ? 'default' : 'secondary'}
                          className={
                            invoice.type === 'PROVIDER'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }
                        >
                          {invoice.type === 'PROVIDER' ? 'Income' : 'Expense'}
                        </Badge>
                        <p className="font-semibold text-gray-900 min-w-[80px] text-right">
                          {formatCurrency(invoice.totalAmount)}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(invoice)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setFilters((prev) => ({ ...prev, page: page - 1 }))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setFilters((prev) => ({ ...prev, page: page + 1 }))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
