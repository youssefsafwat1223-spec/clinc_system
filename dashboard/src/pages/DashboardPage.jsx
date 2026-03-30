import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  CalendarCheck,
  CalendarClock,
  ChevronLeft,
  Clock3,
  MessageSquare,
  Sparkles,
  Stethoscope,
  Users,
} from 'lucide-react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const defaultStats = {
  overview: {
    totalPatients: 0,
    totalAppointments: 0,
    totalMessages: 0,
  },
  appointmentsByStatus: {},
  messagesByPlatform: {},
  recentAppointments: [],
  topServices: [],
};

const statusConfig = {
  PENDING: { label: 'قيد الانتظار', color: 'rgba(245, 158, 11, 0.8)' },
  CONFIRMED: { label: 'مؤكد', color: 'rgba(16, 185, 129, 0.8)' },
  REJECTED: { label: 'مرفوض', color: 'rgba(239, 68, 68, 0.8)' },
  CANCELLED: { label: 'ملغي', color: 'rgba(244, 63, 94, 0.8)' },
  BLOCKED: { label: 'مغلق', color: 'rgba(100, 116, 139, 0.8)' },
  EXPIRED: { label: 'منتهي', color: 'rgba(71, 85, 105, 0.8)' },
};

const platformConfig = {
  WHATSAPP: { label: 'واتساب', color: 'rgba(16, 185, 129, 0.8)' },
  FACEBOOK: { label: 'فيسبوك', color: 'rgba(59, 130, 246, 0.8)' },
  INSTAGRAM: { label: 'انستجرام', color: 'rgba(236, 72, 153, 0.8)' },
};

const daysAr = {
  sunday: 'الأحد',
  monday: 'الاثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
  saturday: 'السبت',
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#111827',
      titleColor: '#f8fafc',
      bodyColor: '#cbd5e1',
      borderColor: '#334155',
      borderWidth: 1,
      padding: 10,
      rtl: true,
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(51, 65, 85, 0.4)' },
      ticks: { color: '#94a3b8', precision: 0 },
    },
    y: {
      grid: { display: false },
      ticks: { color: '#cbd5e1' },
    },
  },
};

const badgeClasses = {
  PENDING: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  CONFIRMED: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  REJECTED: 'bg-red-500/10 text-red-400 ring-red-500/20',
  CANCELLED: 'bg-rose-500/10 text-rose-400 ring-rose-500/20',
  BLOCKED: 'bg-slate-500/10 text-slate-300 ring-slate-500/20',
  EXPIRED: 'bg-slate-500/10 text-slate-300 ring-slate-500/20',
};

const statCardThemes = [
  {
    accent: 'text-primary-300',
    ring: 'ring-primary-500/20',
    panel: 'bg-primary-500/10',
    iconBg: 'bg-primary-500/10',
  },
  {
    accent: 'text-emerald-300',
    ring: 'ring-emerald-500/20',
    panel: 'bg-emerald-500/10',
    iconBg: 'bg-emerald-500/10',
  },
  {
    accent: 'text-amber-300',
    ring: 'ring-amber-500/20',
    panel: 'bg-amber-500/10',
    iconBg: 'bg-amber-500/10',
  },
  {
    accent: 'text-sky-300',
    ring: 'ring-sky-500/20',
    panel: 'bg-sky-500/10',
    iconBg: 'bg-sky-500/10',
  },
];

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

function formatStatus(status) {
  return statusConfig[status]?.label || status;
}

function formatAppointmentDateTime(value) {
  return format(parseISO(value), 'dd MMM yyyy - hh:mm a', { locale: ar });
}

function formatAppointmentTime(value) {
  return format(parseISO(value), 'hh:mm a', { locale: ar });
}

function StatCard({ title, value, hint, icon: Icon, theme }) {
  return (
    <div className={`glass-card relative overflow-hidden p-5 ring-1 ${theme.ring}`}>
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 ${theme.panel}`}></div>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-dark-muted">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-white">{value}</p>
          <p className={`text-xs font-medium ${theme.accent}`}>{hint}</p>
        </div>
        <div className={`rounded-2xl p-3 ${theme.iconBg}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-dark-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${badgeClasses[status] || badgeClasses.EXPIRED}`}>
      {formatStatus(status)}
    </span>
  );
}

export default function DashboardPage() {
  const user = readStoredUser();
  const isDoctor = user.role === 'DOCTOR';

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(defaultStats);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [doctorProfile, setDoctorProfile] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const today = format(new Date(), 'yyyy-MM-dd');

        const [analyticsResponse, appointmentsResponse, doctorResponse] = await Promise.allSettled([
          api.get('/analytics'),
          api.get('/appointments', { params: { date: today, limit: 50 } }),
          isDoctor ? api.get('/doctors/me') : Promise.resolve(null),
        ]);

        if (cancelled) {
          return;
        }

        const hasAnalytics = analyticsResponse.status === 'fulfilled';
        const hasAppointments = appointmentsResponse.status === 'fulfilled';
        const hasDoctorProfile = !isDoctor || doctorResponse.status === 'fulfilled';

        setStats(hasAnalytics ? analyticsResponse.value?.data || defaultStats : defaultStats);
        setTodayAppointments(hasAppointments ? appointmentsResponse.value?.data?.appointments || [] : []);
        setDoctorProfile(isDoctor && hasDoctorProfile ? doctorResponse.value?.data?.doctor || null : null);

        if (!hasAnalytics || !hasAppointments || !hasDoctorProfile) {
          toast.error('فشل في تحميل لوحة المعلومات', {
            toastId: 'dashboard-load-error',
          });
        }
      } catch (error) {
        toast.error('فشل في تحميل لوحة المعلومات', { toastId: 'dashboard-load-error' });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchDashboard();

    return () => {
      cancelled = true;
    };
  }, [isDoctor]);

  const overview = stats?.overview || defaultStats.overview;
  const appointmentsByStatus = stats?.appointmentsByStatus || {};
  const messagesByPlatform = stats?.messagesByPlatform || {};
  const topServices = stats?.topServices || [];
  const recentAppointments = stats?.recentAppointments || [];

  const statCards = [
    {
      title: isDoctor ? 'مرضاي المرتبطون بي' : 'إجمالي المرضى',
      value: overview.totalPatients || 0,
      hint: isDoctor ? 'مرضى مرتبطون بمواعيدك واستشاراتك' : 'إجمالي المرضى المسجلين في النظام',
      icon: Users,
    },
    {
      title: isDoctor ? 'إجمالي مواعيدي' : 'إجمالي المواعيد',
      value: overview.totalAppointments || 0,
      hint: isDoctor ? 'كل المواعيد المرتبطة بحسابك' : 'عدد الحجوزات داخل العيادة',
      icon: CalendarCheck,
    },
    {
      title: 'مواعيد بانتظار الإجراء',
      value: appointmentsByStatus.PENDING || 0,
      hint: isDoctor ? 'طلبات تحتاج تأكيدًا أو رفضًا منك' : 'طلبات تنتظر مراجعة الفريق',
      icon: Clock3,
    },
    {
      title: isDoctor ? 'الرسائل المرتبطة بي' : 'الرسائل والاستفسارات',
      value: overview.totalMessages || 0,
      hint: isDoctor ? 'رسائل المرضى المرتبطين بك' : 'إجمالي الرسائل عبر القنوات المختلفة',
      icon: MessageSquare,
    },
  ];

  const statusChartData = useMemo(() => {
    const keys = ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'BLOCKED'];
    return {
      labels: keys.map((key) => statusConfig[key].label),
      datasets: [
        {
          data: keys.map((key) => appointmentsByStatus[key] || 0),
          backgroundColor: keys.map((key) => statusConfig[key].color),
          borderRadius: 10,
          borderSkipped: false,
        },
      ],
    };
  }, [appointmentsByStatus]);

  const platformChartData = useMemo(() => {
    const keys = ['WHATSAPP', 'FACEBOOK', 'INSTAGRAM'];
    return {
      labels: keys.map((key) => platformConfig[key].label),
      datasets: [
        {
          data: keys.map((key) => messagesByPlatform[key] || 0),
          backgroundColor: keys.map((key) => platformConfig[key].color),
          borderRadius: 10,
          borderSkipped: false,
        },
      ],
    };
  }, [messagesByPlatform]);

  const orderedTodayAppointments = useMemo(
    () =>
      [...todayAppointments].sort(
        (first, second) => new Date(first.scheduledTime).getTime() - new Date(second.scheduledTime).getTime()
      ),
    [todayAppointments]
  );

  const nextAppointment = useMemo(
    () => orderedTodayAppointments.find((appointment) => new Date(appointment.scheduledTime) >= new Date()) || null,
    [orderedTodayAppointments]
  );

  const activeWorkingDays = useMemo(() => {
    const workingHours = doctorProfile?.workingHours || {};

    return Object.entries(workingHours)
      .filter(([, range]) => range && range.start && range.end)
      .map(([day, range]) => ({
        day,
        label: daysAr[day] || day,
        start: range.start,
        end: range.end,
      }));
  }, [doctorProfile]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-96 items-center justify-center">
          <div className="relative h-14 w-14">
            <div className="absolute inset-0 animate-spin rounded-full border-t-2 border-primary-500"></div>
            <div
              className="absolute inset-2 animate-spin rounded-full border-r-2 border-primary-400 opacity-75"
              style={{ animationDuration: '1.4s' }}
            ></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 fade-in">
        <section className="grid gap-6 xl:grid-cols-[1.55fr,0.95fr]">
          <div className="glass-card relative overflow-hidden p-6 sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_35%)]"></div>
            <div className="relative flex h-full flex-col justify-between gap-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1 text-xs font-bold text-primary-200">
                    <Sparkles className="h-4 w-4" />
                    {isDoctor ? 'لوحة الطبيب' : 'لوحة التحكم الرئيسية'}
                  </span>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                      {isDoctor ? `أهلاً ${doctorProfile?.name || user.name || 'دكتور'}` : 'نظرة سريعة على نشاط النظام'}
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                      {isDoctor
                        ? 'هذه الصفحة تركز على مواعيدك، المرضى المرتبطين بك، والرسائل التي تحتاج متابعة حتى لا تضيع بين بيانات العيادة العامة.'
                        : 'الواجهة الآن تعرض مؤشرات حقيقية من النظام بدل أرقام ثابتة، مع وصول سريع للمواعيد والرسائل وأهم الخدمات.'}
                    </p>
                  </div>
                </div>

                <div className="grid min-w-[220px] gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <Link to="/appointments" className="btn-primary h-11 justify-between px-4">
                    <span>{isDoctor ? 'فتح مواعيدي' : 'إدارة المواعيد'}</span>
                    <ChevronLeft className="h-4 w-4" />
                  </Link>
                  <Link to="/inbox" className="btn-secondary h-11 justify-between px-4">
                    <span>فتح صندوق الرسائل</span>
                    <ChevronLeft className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold text-primary-100">مواعيد اليوم</p>
                  <p className="mt-2 text-2xl font-bold text-white">{orderedTodayAppointments.length}</p>
                  <p className="mt-1 text-xs text-slate-300">
                    {orderedTodayAppointments.length > 0 ? 'محجوزة لهذا اليوم' : 'لا توجد مواعيد لهذا اليوم'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold text-primary-100">الموعد القادم</p>
                  <p className="mt-2 text-lg font-bold text-white">
                    {nextAppointment ? formatAppointmentTime(nextAppointment.scheduledTime) : 'لا يوجد'}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    {nextAppointment ? nextAppointment.patient?.name || 'مريض' : 'لا يوجد موعد متبقٍ اليوم'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold text-primary-100">
                    {isDoctor ? 'أيام العمل النشطة' : 'الخدمة الأكثر طلبًا'}
                  </p>
                  <p className="mt-2 text-lg font-bold text-white">
                    {isDoctor ? activeWorkingDays.length : topServices[0]?.serviceName || 'لا توجد بيانات'}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    {isDoctor
                      ? activeWorkingDays.length > 0
                        ? 'أيام متاحة للحجز في جدولك'
                        : 'لم يتم ضبط جدول العمل بعد'
                      : topServices[0]?._count?.serviceId
                        ? `${topServices[0]._count.serviceId} حجز`
                        : 'ابدأ بتسجيل الحجوزات لظهور البيانات'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <SectionHeader
              title={isDoctor ? 'ملخص جدولك' : 'الخدمات الأكثر طلبًا'}
              subtitle={
                isDoctor
                  ? 'أيام العمل التي تم ضبطها من حساب الطبيب'
                  : 'أكثر الخدمات التي تظهر في الحجوزات الحالية'
              }
            />

            {isDoctor ? (
              activeWorkingDays.length > 0 ? (
                <div className="space-y-3">
                  {activeWorkingDays.map((item) => (
                    <div
                      key={item.day}
                      className="flex items-center justify-between rounded-2xl border border-dark-border bg-dark-bg/50 px-4 py-3"
                    >
                      <div>
                        <p className="font-bold text-white">{item.label}</p>
                        <p className="text-xs text-dark-muted">متاح للحجز</p>
                      </div>
                      <div className="rounded-xl bg-primary-500/10 px-3 py-2 text-sm font-bold text-primary-200" dir="ltr">
                        {item.start} - {item.end}
                      </div>
                    </div>
                  ))}
                  <Link to="/appointments" className="btn-secondary mt-2 h-11 w-full justify-between px-4">
                    <span>تعديل جدول العمل</span>
                    <ChevronLeft className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">
                  لا يوجد جدول عمل مضبوط لهذا الحساب بعد. اضبط الأيام والساعات من صفحة المواعيد حتى يظهر الحجز بشكل صحيح.
                </div>
              )
            ) : topServices.length > 0 ? (
              <div className="space-y-3">
                {topServices.map((service, index) => (
                  <div
                    key={service.serviceId}
                    className="flex items-center justify-between rounded-2xl border border-dark-border bg-dark-bg/50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10 text-sm font-bold text-primary-200">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-bold text-white">{service.serviceName}</p>
                        <p className="text-xs text-dark-muted">الأكثر طلبًا في الحجوزات</p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-300">
                      {service._count?.serviceId || 0}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dark-border bg-dark-bg/40 p-5 text-sm text-dark-muted">
                لا توجد بيانات كافية لإظهار الخدمات الأكثر طلبًا حتى الآن.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card, index) => (
            <StatCard key={card.title} {...card} theme={statCardThemes[index]} />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="glass-card p-6">
            <SectionHeader
              title="توزيع حالات المواعيد"
              subtitle={isDoctor ? 'توزيع حالات مواعيدك الحالية' : 'توزيع عام لحالات المواعيد داخل النظام'}
            />
            <div className="h-[280px]">
              <Bar data={statusChartData} options={chartOptions} />
            </div>
          </div>

          <div className="glass-card p-6">
            <SectionHeader
              title="توزيع الرسائل حسب المنصة"
              subtitle={isDoctor ? 'الرسائل المرتبطة بمرضاك على كل قناة' : 'الرسائل الواردة عبر القنوات المختلفة'}
            />
            <div className="h-[280px]">
              <Bar data={platformChartData} options={chartOptions} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr,0.9fr]">
          <div className="glass-card p-6">
            <SectionHeader
              title={isDoctor ? 'مواعيد اليوم' : 'مواعيد اليوم في العيادة'}
              subtitle={
                orderedTodayAppointments.length > 0
                  ? `${orderedTodayAppointments.length} موعد مسجل لهذا اليوم`
                  : 'لا توجد مواعيد مسجلة لهذا اليوم'
              }
              action={
                <Link to="/appointments" className="text-sm font-medium text-primary-300 transition-colors hover:text-primary-200">
                  عرض الكل
                </Link>
              }
            />

            {orderedTodayAppointments.length > 0 ? (
              <div className="space-y-3">
                {orderedTodayAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex flex-col gap-4 rounded-2xl border border-dark-border bg-dark-bg/45 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="rounded-2xl bg-primary-500/10 p-3 text-primary-200">
                        <CalendarClock className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-white">{appointment.patient?.name || 'مريض غير معروف'}</p>
                        <p className="mt-1 text-sm text-dark-muted">
                          {appointment.service?.nameAr || 'خدمة غير معروفة'}
                          {appointment.doctor?.name ? ` - د. ${appointment.doctor.name}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-slate-400" dir="ltr">
                          {appointment.patient?.phone || 'No phone'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-3 sm:items-end">
                      <div className="rounded-xl bg-dark-bg px-3 py-2 text-sm font-bold text-white" dir="ltr">
                        {formatAppointmentTime(appointment.scheduledTime)}
                      </div>
                      <StatusBadge status={appointment.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dark-border bg-dark-bg/40 p-8 text-center">
                <CalendarCheck className="mx-auto mb-3 h-10 w-10 text-dark-muted" />
                <p className="font-medium text-slate-300">لا توجد مواعيد اليوم</p>
                <p className="mt-2 text-sm text-dark-muted">يمكنك مراجعة الأيام الأخرى أو إضافة موعد من صفحة المواعيد.</p>
              </div>
            )}
          </div>

          <div className="glass-card p-6">
            <SectionHeader
              title={isDoctor ? 'آخر النشاط المرتبط بك' : 'آخر الحجوزات المضافة'}
              subtitle={isDoctor ? 'أحدث الحجوزات التي وصلت إلى حسابك' : 'آخر الحجوزات التي دخلت إلى النظام'}
            />

            {recentAppointments.length > 0 ? (
              <div className="space-y-3">
                {recentAppointments.slice(0, 6).map((appointment) => (
                  <div key={appointment.id} className="rounded-2xl border border-dark-border bg-dark-bg/45 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-sky-500/10 p-2 text-sky-300">
                          {isDoctor ? <Stethoscope className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-bold text-white">{appointment.patient?.name || 'مريض غير معروف'}</p>
                          <p className="mt-1 text-sm text-dark-muted">
                            {appointment.service?.nameAr || 'خدمة غير معروفة'}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {appointment.doctor?.name ? `د. ${appointment.doctor.name}` : 'بدون طبيب'}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={appointment.status} />
                    </div>
                    <div className="mt-3 rounded-xl bg-dark-bg px-3 py-2 text-xs text-slate-300" dir="ltr">
                      {formatAppointmentDateTime(appointment.scheduledTime)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dark-border bg-dark-bg/40 p-8 text-center">
                <Activity className="mx-auto mb-3 h-10 w-10 text-dark-muted" />
                <p className="font-medium text-slate-300">لا توجد أنشطة حديثة</p>
                <p className="mt-2 text-sm text-dark-muted">ستظهر هنا أحدث الحجوزات بمجرد بدء الاستخدام.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
