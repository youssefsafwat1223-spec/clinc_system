import { useEffect, useMemo, useState } from 'react';
import { Activity, Calendar, Download, Filter, MessageSquare, RefreshCw, Users } from 'lucide-react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'react-toastify';
import AppLayout from '../components/Layout';
import api from '../api/client';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

ChartJS.defaults.color = '#94a3b8';
ChartJS.defaults.font.family = 'Tajawal, system-ui, sans-serif';

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#cbd5e1',
      },
    },
  },
  scales: {
    y: {
      grid: { color: 'rgba(255,255,255,0.05)' },
      ticks: { color: '#94a3b8', precision: 0 },
    },
    x: {
      grid: { display: false },
      ticks: { color: '#94a3b8' },
    },
  },
};

function SummaryCard({ title, value, hint, icon: Icon, accentClass }) {
  return (
    <div className={`glass-card border p-5 ${accentClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-dark-muted">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-white">{value}</p>
          <p className="text-xs font-medium text-slate-400">{hint}</p>
        </div>
        <div className="rounded-2xl bg-dark-bg/70 p-3">
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function formatStatusLabel(status) {
  if (status === 'CONFIRMED') return 'مؤكد';
  if (status === 'PENDING') return 'قيد الانتظار';
  if (status === 'REJECTED') return 'مرفوض';
  if (status === 'BLOCKED') return 'مغلق';
  if (status === 'EXPIRED') return 'منتهي';
  if (status === 'CANCELLED') return 'ملغي';
  return status;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ from: '', to: '' });

  const fetchAnalytics = async (nextFilters = filters) => {
    try {
      setLoading(true);
      const res = await api.get('/analytics', {
        params: {
          from: nextFilters.from || undefined,
          to: nextFilters.to || undefined,
        },
      });
      setData(res.data);
    } catch (error) {
      toast.error('فشل في تحميل التحليلات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleApplyFilters = () => {
    fetchAnalytics(filters);
  };

  const handleResetFilters = () => {
    const reset = { from: '', to: '' };
    setFilters(reset);
    fetchAnalytics(reset);
  };

  const handleExportCSV = () => {
    if (!data) {
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'التاريخ,المريض,الخدمة,الطبيب,الحالة\n';

    data.recentAppointments.forEach((appointment) => {
      const date = format(parseISO(appointment.scheduledTime), 'yyyy-MM-dd HH:mm');
      const patient = appointment.patient?.name || '';
      const service = appointment.service?.nameAr || '';
      const doctor = appointment.doctor?.name || '';
      const status = appointment.status;
      csvContent += `${date},${patient},${service},${doctor},${status}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('تم تصدير التقرير بنجاح');
  };

  const overview = data?.overview || { totalPatients: 0, totalAppointments: 0, totalMessages: 0 };
  const appointmentsByStatus = data?.appointmentsByStatus || {};
  const messagesByPlatform = data?.messagesByPlatform || {};
  const topServices = data?.topServices || [];
  const recentAppointments = data?.recentAppointments || [];

  const statusChartData = useMemo(
    () => ({
      labels: ['مؤكد', 'قيد الانتظار', 'مرفوض/ملغي/منتهي'],
      datasets: [
        {
          label: 'المواعيد',
          data: [
            appointmentsByStatus.CONFIRMED || 0,
            appointmentsByStatus.PENDING || 0,
            (appointmentsByStatus.REJECTED || 0) +
              (appointmentsByStatus.CANCELLED || 0) +
              (appointmentsByStatus.BLOCKED || 0) +
              (appointmentsByStatus.EXPIRED || 0),
          ],
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
          borderWidth: 0,
          borderRadius: 10,
        },
      ],
    }),
    [appointmentsByStatus]
  );

  const platformsData = useMemo(
    () => ({
      labels: Object.keys(messagesByPlatform).length > 0 ? Object.keys(messagesByPlatform) : ['لا توجد بيانات'],
      datasets: [
        {
          data: Object.keys(messagesByPlatform).length > 0 ? Object.values(messagesByPlatform) : [1],
          backgroundColor:
            Object.keys(messagesByPlatform).length > 0 ? ['#10b981', '#3b82f6', '#ec4899', '#64748b'] : ['#334155'],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    }),
    [messagesByPlatform]
  );

  if (loading && !data) {
    return (
      <AppLayout>
        <div className="flex h-screen items-center justify-center">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 pb-12 fade-in">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
              <Activity className="h-6 w-6 text-primary-500" />
              التقارير والتحليلات
            </h1>
            <p className="mt-1 text-sm text-dark-muted">نظرة أعمق على المرضى والمواعيد والرسائل مع فلترة زمنية مباشرة.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={() => fetchAnalytics()} className="btn-secondary rounded-xl px-4 py-2.5 text-sm">
              <RefreshCw className="h-4 w-4" />
              تحديث
            </button>
            <button onClick={handleExportCSV} className="btn-primary rounded-xl px-4 py-2.5 text-sm">
              <Download className="h-4 w-4" />
              تصدير CSV
            </button>
          </div>
        </div>

        <section className="glass-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary-400" />
            <h2 className="font-bold text-white">فلترة التقرير</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr,1fr,auto,auto]">
            <div>
              <label className="mb-1 block text-sm font-medium text-dark-muted">من تاريخ</label>
              <input
                type="date"
                value={filters.from}
                onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
                className="input-field"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-dark-muted">إلى تاريخ</label>
              <input
                type="date"
                value={filters.to}
                onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
                className="input-field"
              />
            </div>

            <button onClick={handleApplyFilters} className="btn-primary mt-auto rounded-xl px-5 py-2.5">
              تطبيق
            </button>

            <button onClick={handleResetFilters} className="btn-secondary mt-auto rounded-xl px-5 py-2.5">
              إعادة ضبط
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="إجمالي المرضى" value={overview.totalPatients} hint="ضمن النطاق الزمني الحالي" icon={Users} accentClass="border-primary-500/20" />
          <SummaryCard title="إجمالي المواعيد" value={overview.totalAppointments} hint="كل الحجوزات المطابقة للفلاتر" icon={Calendar} accentClass="border-emerald-500/20" />
          <SummaryCard title="إجمالي الرسائل" value={overview.totalMessages} hint="الرسائل الواردة والصادرة المرتبطة" icon={MessageSquare} accentClass="border-sky-500/20" />
          <SummaryCard title="الخدمات الأعلى طلبًا" value={topServices.length} hint="عدد الخدمات الظاهرة في التحليل" icon={Activity} accentClass="border-amber-500/20" />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card p-6">
            <h3 className="mb-6 font-bold text-white">حالة المواعيد</h3>
            <div className="h-72">
              <Bar data={statusChartData} options={chartOptions} />
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="mb-6 font-bold text-white">توزيع الرسائل حسب المنصة</h3>
            <div className="h-72">
              <Doughnut
                data={platformsData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1' } } },
                  cutout: '70%',
                }}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
          <div className="glass-card p-6">
            <h3 className="mb-4 font-bold text-white">الخدمات الأكثر طلبًا</h3>
            {topServices.length === 0 ? (
              <p className="py-4 text-center text-sm text-dark-muted">لا توجد بيانات كافية في هذا النطاق الزمني.</p>
            ) : (
              <div className="space-y-3">
                {topServices.map((service, index) => (
                  <div key={service.serviceId || index} className="flex items-center justify-between rounded-xl border border-dark-border bg-dark-bg/50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10 text-sm font-bold text-primary-300">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-bold text-white">{service.serviceName}</p>
                        <p className="text-xs text-dark-muted">عدد الحجوزات</p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-emerald-300">{service._count?.serviceId || 0}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card p-6">
            <h3 className="mb-4 font-bold text-white">آخر الحجوزات</h3>
            {recentAppointments.length === 0 ? (
              <p className="py-4 text-center text-sm text-dark-muted">لا توجد حجوزات حديثة ضمن الفلاتر الحالية.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="border-b border-dark-border text-dark-muted">
                    <tr>
                      <th className="px-3 py-3 font-medium">المريض</th>
                      <th className="px-3 py-3 font-medium">الخدمة</th>
                      <th className="px-3 py-3 font-medium">الطبيب</th>
                      <th className="px-3 py-3 font-medium">الموعد</th>
                      <th className="px-3 py-3 font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border/50">
                    {recentAppointments.map((appointment) => (
                      <tr key={appointment.id} className="transition-colors hover:bg-dark-bg/30">
                        <td className="px-3 py-4 font-medium text-white">{appointment.patient?.name || 'غير معروف'}</td>
                        <td className="px-3 py-4 text-slate-300">{appointment.service?.nameAr || 'خدمة'}</td>
                        <td className="px-3 py-4 text-slate-300">{appointment.doctor?.name || 'طبيب'}</td>
                        <td className="px-3 py-4 text-slate-300" dir="ltr">
                          {format(parseISO(appointment.scheduledTime), 'dd/MM/yyyy - hh:mm a', { locale: ar })}
                        </td>
                        <td className="px-3 py-4">
                          <span className="rounded-full bg-dark-bg px-2.5 py-1 text-[10px] font-bold text-slate-300">
                            {formatStatusLabel(appointment.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
