import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../api/client';
import { DataCard, Field, PageLoader, PrimaryButton, StatCard, inputClass } from '../ui';
import EmptyState from '../EmptyState';
import { money, todayInputValue } from '../../utils/appointmentUi';

const defaultFilters = () => ({
  from: todayInputValue(),
  to: todayInputValue(),
  status: 'ALL',
  method: 'ALL',
  search: '',
  cashierExpenses: '',
});

export default function RevenueReport({ patientId = '', compact = false }) {
  const [filters, setFilters] = useState(defaultFilters);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const params = useMemo(
    () => ({
      ...filters,
      patientId: patientId || undefined,
      status: filters.status === 'ALL' ? undefined : filters.status,
      method: filters.method === 'ALL' ? undefined : filters.method,
      cashierExpenses: filters.cashierExpenses || 0,
    }),
    [filters, patientId]
  );

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await api.get('/payments/revenue-report', { params });
      setReport(res.data);
    } catch (error) {
      toast.error(error.message || 'فشل تحميل تقرير الإيرادات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [patientId]);

  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));
  const summary = report?.summary || {};

  return (
    <div className="space-y-5">
      <DataCard className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Field label="من تاريخ">
            <input className={inputClass} type="date" value={filters.from} onChange={(event) => updateFilter('from', event.target.value)} />
          </Field>
          <Field label="إلى تاريخ">
            <input className={inputClass} type="date" value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} />
          </Field>
          <Field label="حالة الدفع">
            <select className={inputClass} value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="ALL">كل الحالات</option>
              <option value="PAID">مدفوع</option>
              <option value="PARTIAL">جزئي</option>
              <option value="UNPAID">غير مدفوع</option>
            </select>
          </Field>
          <Field label="طريقة الدفع">
            <select className={inputClass} value={filters.method} onChange={(event) => updateFilter('method', event.target.value)}>
              <option value="ALL">كل الطرق</option>
              <option value="cash">كاش</option>
              <option value="card">بطاقة</option>
              <option value="transfer">تحويل</option>
            </select>
          </Field>
          <Field label="مصروفات الكاشير">
            <input className={inputClass} type="number" min="0" value={filters.cashierExpenses} onChange={(event) => updateFilter('cashierExpenses', event.target.value)} />
          </Field>
          <div className="flex items-end">
            <PrimaryButton type="button" onClick={loadReport} disabled={loading} className="w-full">
              <RefreshCw className="h-4 w-4" />
              Revenue Report
            </PrimaryButton>
          </div>
        </div>
        {!patientId ? (
          <Field label="بحث باسم المريض أو الخدمة">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input className={`${inputClass} pr-10`} value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="بحث..." />
            </div>
          </Field>
        ) : null}
      </DataCard>

      {loading ? (
        <DataCard>
          <PageLoader />
        </DataCard>
      ) : !report ? (
        <DataCard>
          <EmptyState title="لا يوجد تقرير" description="تعذر تحميل بيانات التقرير." />
        </DataCard>
      ) : (
        <>
          <div className={`grid gap-4 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
            <StatCard title="إجمالي الإيراد" value={money(summary.totalRevenue || 0)} tone="blue" />
            <StatCard title="المدفوع" value={money(summary.totalReceived || 0)} tone="green" />
            <StatCard title="الديون" value={money(summary.totalDebt || 0)} tone="amber" />
            <StatCard title="الربح" value={money(summary.totalProfit || 0)} tone="slate" />
          </div>

          <DataCard>
            <h3 className="mb-4 text-lg font-black text-white">ملخص الخدمات / الحالات</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-slate-400">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2 text-right">الخدمة / الحالة</th>
                    <th className="px-3 py-2 text-right">Net</th>
                    <th className="px-3 py-2 text-right">الديون</th>
                    <th className="px-3 py-2 text-right">المدفوع</th>
                    <th className="px-3 py-2 text-right">عدد الحالات</th>
                    <th className="px-3 py-2 text-right">النوع</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.rows || []).map((row) => (
                    <tr key={row.serviceId} className="border-b border-white/5 text-slate-200">
                      <td className="px-3 py-2 font-bold">{row.serviceName}</td>
                      <td className="px-3 py-2">{money(row.netAmount)}</td>
                      <td className="px-3 py-2">{money(row.debtAmount)}</td>
                      <td className="px-3 py-2">{money(row.receivedAmount)}</td>
                      <td className="px-3 py-2">{row.caseCount}</td>
                      <td className="px-3 py-2">{row.caseType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataCard>

          <DataCard>
            <h3 className="mb-4 text-lg font-black text-white">تفاصيل المدفوعات المستلمة</h3>
            <div className="grid gap-3">
              {(report.payments || []).map((payment) => (
                <div key={payment.id} className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                  <div>
                    <p className="font-bold text-white">{payment.patientName || 'مريض غير محدد'}</p>
                    <p className="text-xs text-slate-400">{payment.treatmentType || '-'} · د. {payment.doctorName || '-'}</p>
                  </div>
                  <div className="text-sm text-slate-300">{new Date(payment.paymentDate).toLocaleString('ar-EG')}</div>
                  <div className="text-sm font-black text-emerald-300">{money(payment.paidAmount || 0)}</div>
                </div>
              ))}
            </div>
          </DataCard>
        </>
      )}
    </div>
  );
}
