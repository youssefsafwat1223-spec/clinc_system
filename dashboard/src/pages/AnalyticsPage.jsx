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
import {
  DataCard,
  Field,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatCard,
  inputClass,
} from '../components/ui';

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
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent"></span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="التقارير والتحليلات"
        description="نظرة أعمق على المرضى والمواعيد والرسائل مع فلترة زمنية مباشرة."
        actions={
          <>
            <SecondaryButton type="button" onClick={() => fetchAnalytics()}>
              <RefreshCw className="h-4 w-4" />
              تحديث
            </SecondaryButton>
            <PrimaryButton type="button" onClick={handleExportCSV}>
              <Download className="h-4 w-4" />
              تصدير CSV
            </PrimaryButton>
          </>
        }
      />

      <DataCard className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-sky-400" />
          <h2 className="font-bold text-white">فلترة التقرير</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr,1fr,auto,auto]">
          <Field label="من تاريخ">
            <input
              type="date"
              value={filters.from}
              onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
              className={inputClass}
            />
          </Field>

          <Field label="إلى تاريخ">
            <input
              type="date"
              value={filters.to}
              onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
              className={inputClass}
            />
          </Field>

          <PrimaryButton onClick={handleApplyFilters} className="mt-auto">
            تطبيق
          </PrimaryButton>

          <SecondaryButton onClick={handleResetFilters} className="mt-auto">
            إعادة ضبط
          </SecondaryButton>
        </div>
      </DataCard>

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="إجمالي المرضى" value={overview.totalPatients} hint="ضمن النطاق الزمني الحالي" icon={Users} tone="blue" />
        <StatCard title="إجمالي المواعيد" value={overview.totalAppointments} hint="كل الحجوزات المطابقة للفلاتر" icon={Calendar} tone="green" />
        <StatCard title="إجمالي الرسائل" value={overview.totalMessages} hint="الرسائل الواردة والصادرة المرتبطة" icon={MessageSquare} tone="blue" />
        <StatCard title="الخدمات الأعلى طلبًا" value={topServices.length} hint="عدد الخدمات الظاهرة في التحليل" icon={Activity} tone="amber" />
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-2">
        <DataCard>
          <h3 className="mb-6 font-bold text-white">حالة المواعيد</h3>
          <div className="h-72">
            <Bar data={statusChartData} options={chartOptions} />
          </div>
        </DataCard>

        <DataCard>
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
        </DataCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
        <DataCard>
          <h3 className="mb-4 font-bold text-white">الخدمات الأكثر طلبًا</h3>
          {topServices.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">لا توجد بيانات كافية في هذا النطاق الزمني.</p>
          ) : (
            <div className="space-y-3">
              {topServices.map((service, index) => (
                <div
                  key={service.serviceId || index}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sm font-bold text-sky-300">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-bold text-white">{service.serviceName}</p>
                      <p className="text-xs text-slate-400">عدد الحجوزات</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-emerald-300">{service._count?.serviceId || 0}</span>
                </div>
              ))}
            </div>
          )}
        </DataCard>

        <DataCard>
          <h3 className="mb-4 font-bold text-white">آخر الحجوزات</h3>
          {recentAppointments.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">لا توجد حجوزات حديثة ضمن الفلاتر الحالية.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="border-b border-white/10 text-slate-400">
                  <tr>
                    <th className="px-3 py-3 font-medium">المريض</th>
                    <th className="px-3 py-3 font-medium">الخدمة</th>
                    <th className="px-3 py-3 font-medium">الطبيب</th>
                    <th className="px-3 py-3 font-medium">الموعد</th>
                    <th className="px-3 py-3 font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentAppointments.map((appointment) => (
                    <tr key={appointment.id} className="transition-colors hover:bg-white/5">
                      <td className="px-3 py-4 font-medium text-white">{appointment.patient?.name || 'غير معروف'}</td>
                      <td className="px-3 py-4 text-slate-300">{appointment.service?.nameAr || 'خدمة'}</td>
                      <td className="px-3 py-4 text-slate-300">{appointment.doctor?.name || 'طبيب'}</td>
                      <td className="px-3 py-4 text-slate-300" dir="ltr">
                        {format(parseISO(appointment.scheduledTime), 'dd/MM/yyyy - hh:mm a', { locale: ar })}
                      </td>
                      <td className="px-3 py-4">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-slate-300">
                          {formatStatusLabel(appointment.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataCard>
      </section>
    </AppLayout>
  );
}
