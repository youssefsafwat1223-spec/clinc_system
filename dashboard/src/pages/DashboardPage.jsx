import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CalendarClock,
  ClipboardCheck,
  MessageSquare,
  Phone,
  Stethoscope,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { DataCard, PageHeader, StatCard } from '../components/ui';

const QUICK_LINKS = [
  {
    href: '/today-patients',
    label: 'مرضى اليوم',
    description: 'مواعيد اليوم وحالاتها',
    icon: Users,
    tone: 'sky',
    roles: ['ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'],
  },
  {
    href: '/add-patient',
    label: 'إضافة مريض / موعد',
    description: 'تسجيل مريض جديد وحجز موعد',
    icon: UserPlus,
    tone: 'emerald',
    roles: ['ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'],
  },
  {
    href: '/inbox',
    label: 'صندوق الوارد',
    description: 'الرد على رسائل المرضى',
    icon: MessageSquare,
    tone: 'violet',
  },
  {
    href: '/callback-requests',
    label: 'طلبات التواصل',
    description: 'مراجعة طلبات الاتصال',
    icon: Phone,
    tone: 'rose',
    roles: ['ADMIN', 'STAFF', 'RECEPTION'],
  },
  {
    href: '/appointments',
    label: 'كل المواعيد',
    description: 'إدارة جدول المواعيد',
    icon: Calendar,
    tone: 'cyan',
  },
];

const TONE_CLASSES = {
  sky: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
  emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  violet: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
  rose: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
  cyan: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
};

export default function DashboardPage() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = user.role || 'STAFF';

  const [stats, setStats] = useState({
    totalPatients: 0,
    totalAppointments: 0,
    totalMessages: 0,
    pendingAppointments: 0,
    confirmedAppointments: 0,
    completedAppointments: 0,
    unreadMessages: 0,
    callbackRequests: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [analyticsRes, notificationsRes, appointmentStatsRes, callbackRes] = await Promise.all([
          api.get('/analytics').catch(() => ({ data: {} })),
          api.get('/notifications').catch(() => ({ data: { notifications: [] } })),
          api.get('/appointments/stats').catch(() => ({ data: {} })),
          api
            .get('/callback-requests', { params: { status: 'NEW', limit: 1 } })
            .catch(() => ({ data: { stats: { NEW: 0 } } })),
        ]);

        const analytics = analyticsRes.data || {};
        const notifications = notificationsRes.data?.notifications || [];
        const appointmentStats = appointmentStatsRes.data || {};

        setStats({
          totalPatients: analytics.overview?.totalPatients || 0,
          totalAppointments: analytics.overview?.totalAppointments || 0,
          totalMessages: analytics.overview?.totalMessages || 0,
          pendingAppointments: appointmentStats.PENDING || 0,
          confirmedAppointments: appointmentStats.CONFIRMED || 0,
          completedAppointments: appointmentStats.COMPLETED || 0,
          unreadMessages: notifications.filter((n) => n.type === 'HUMAN_REQUEST' && !n.read).length,
          callbackRequests: callbackRes.data?.stats?.NEW || 0,
        });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const needsAttention = [
    {
      title: 'طلبات بانتظار الرد',
      value: stats.pendingAppointments,
      hint: 'طلبات حجز لم يُتخذ بها قرار بعد',
      icon: ClipboardCheck,
      tone: 'amber',
      href: '/appointments',
    },
    {
      title: 'رسائل تحتاج متابعة',
      value: stats.unreadMessages,
      hint: 'رسائل تحتاج مراجعة بشرية',
      icon: MessageSquare,
      tone: 'red',
      href: '/inbox',
    },
    {
      title: 'مواعيد مؤكدة',
      value: stats.confirmedAppointments,
      hint: 'مواعيد جاهزة للكشف',
      icon: CalendarClock,
      tone: 'green',
      href: '/appointments',
    },
    {
      title: 'طلبات اتصال جديدة',
      value: stats.callbackRequests,
      hint: 'مرضى يطلبون اتصال هاتفي',
      icon: Phone,
      tone: 'blue',
      href: '/callback-requests',
    },
  ];

  const overviewStats = [
    {
      title: 'إجمالي المرضى',
      value: stats.totalPatients.toLocaleString('ar-IQ'),
      hint: 'كل المرضى المسجلين في النظام',
      icon: Users,
      tone: 'blue',
    },
    {
      title: 'إجمالي المواعيد',
      value: stats.totalAppointments.toLocaleString('ar-IQ'),
      hint: 'كل الحجوزات حتى الآن',
      icon: Calendar,
      tone: 'slate',
    },
    {
      title: 'مواعيد مكتملة',
      value: stats.completedAppointments.toLocaleString('ar-IQ'),
      hint: 'مواعيد تم الكشف فيها',
      icon: TrendingUp,
      tone: 'green',
    },
    {
      title: 'إجمالي الرسائل',
      value: stats.totalMessages.toLocaleString('ar-IQ'),
      hint: 'رسائل تمت معالجتها',
      icon: MessageSquare,
      tone: 'slate',
    },
  ];

  const visibleQuickLinks = QUICK_LINKS.filter((link) => !link.roles || link.roles.includes(userRole));

  return (
    <AppLayout>
      <PageHeader
        title={`أهلاً ${user.name || 'بك'}`}
        description="نظرة سريعة على ما يحتاج انتباهك اليوم."
      />

      {loading ? (
        <DataCard className="flex h-64 items-center justify-center">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
        </DataCard>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-4 flex items-center gap-2">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-400" />
              <h2 className="text-sm font-black text-white">يحتاج انتباهك</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {needsAttention.map((item) => (
                <Link key={item.title} to={item.href} className="block transition-transform hover:-translate-y-0.5">
                  <StatCard
                    title={item.title}
                    value={item.value.toLocaleString('ar-IQ')}
                    hint={item.hint}
                    icon={item.icon}
                    tone={item.tone}
                  />
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-sm font-black text-white">نظرة عامة</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {overviewStats.map((item) => (
                <StatCard
                  key={item.title}
                  title={item.title}
                  value={item.value}
                  hint={item.hint}
                  icon={item.icon}
                  tone={item.tone}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-sm font-black text-white">الوصول السريع</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleQuickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="group flex items-center gap-4 rounded-3xl border border-white/5 bg-white/[0.02] p-5 shadow-xl shadow-black/20 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/[0.04]"
                  >
                    <div className={`rounded-2xl border p-3 ${TONE_CLASSES[link.tone]}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold text-white">{link.label}</p>
                      <p className="truncate text-xs text-slate-400">{link.description}</p>
                    </div>
                    <ArrowLeft className="h-5 w-5 flex-shrink-0 text-slate-500 transition-transform group-hover:-translate-x-1 group-hover:text-sky-300" />
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </AppLayout>
  );
}
