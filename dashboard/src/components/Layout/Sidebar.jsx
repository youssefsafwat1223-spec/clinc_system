import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bot,
  Calendar,
  ClipboardCheck,
  CreditCard,
  FileText,
  Home,
  LineChart,
  LogOut,
  Megaphone,
  MessageSquare,
  Pill,
  Repeat2,
  Settings,
  Star,
  Stethoscope,
  UserPlus,
  UserSquare2,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../api/client';

const navItems = [
  { path: '/dashboard', label: 'الرئيسية', icon: Home },
  { path: '/inbox', label: 'صندوق الوارد', icon: MessageSquare },
  { path: '/today-patients', label: 'مرضى اليوم', icon: Users },
  { path: '/add-patient', label: 'إضافة مريض / موعد', icon: UserPlus },
  { path: '/appointment-requests', label: 'قبول الطلبات والكشف', icon: ClipboardCheck },
  { path: '/appointments', label: 'المواعيد', icon: Calendar },
  { path: '/patients', label: 'المرضى', icon: Users },
  { path: '/prescriptions', label: 'الروشتات', icon: Pill, allowedRoles: ['ADMIN', 'DOCTOR'] },
  { path: '/payments', label: 'المدفوعات', icon: CreditCard, allowedRoles: ['ADMIN', 'STAFF', 'RECEPTION'] },
  { path: '/reschedule-doctor', label: 'إعادة جدولة طبيب', icon: Repeat2, allowedRoles: ['ADMIN'] },
  { path: '/campaigns', label: 'الحملات', icon: Megaphone, allowedRoles: ['ADMIN', 'STAFF'] },
  { path: '/consultations', label: 'الاستشارات', icon: FileText },
  { path: '/services', label: 'الخدمات', icon: Stethoscope, allowedRoles: ['ADMIN'] },
  { path: '/staff', label: 'الكادر الطبي', icon: UserSquare2, allowedRoles: ['ADMIN'] },
  { path: '/reviews', label: 'التقييمات', icon: Star, allowedRoles: ['ADMIN', 'DOCTOR'] },
  { path: '/analytics', label: 'التحليلات', icon: LineChart, allowedRoles: ['ADMIN'] },
  { path: '/ai-settings', label: 'الذكاء الاصطناعي', icon: Bot, allowedRoles: ['ADMIN'] },
  { path: '/settings', label: 'الإعدادات', icon: Settings, allowedRoles: ['ADMIN'] },
];

export default function Sidebar({ isOpen = false, onClose }) {
  const location = useLocation();
  const userStr = localStorage.getItem('user');
  let userRole = 'STAFF';
  try {
    userRole = userStr ? JSON.parse(userStr).role : 'STAFF';
  } catch {
    userRole = 'STAFF';
  }

  const [counts, setCounts] = useState({ unreadMessages: 0, pendingAppointments: 0 });

  useEffect(() => {
    let cancelled = false;

    const fetchCounts = async () => {
      try {
        const [notificationsRes, appointmentStatsRes] = await Promise.all([
          api.get('/notifications'),
          api.get('/appointments/stats'),
        ]);

        if (cancelled) return;

        const notifications = notificationsRes.data.notifications || [];
        setCounts({
          unreadMessages: notifications.filter((notification) => notification.type === 'HUMAN_REQUEST' && !notification.read).length,
          pendingAppointments: appointmentStatsRes.data.PENDING || 0,
        });
      } catch {
        if (!cancelled) setCounts({ unreadMessages: 0, pendingAppointments: 0 });
      }
    };

    fetchCounts();
    return () => {
      cancelled = true;
    };
  }, []);

  const routeBadges = useMemo(
    () => ({
      '/inbox': counts.unreadMessages > 0 ? counts.unreadMessages : null,
      '/appointments': counts.pendingAppointments > 0 ? counts.pendingAppointments : null,
      '/appointment-requests': counts.pendingAppointments > 0 ? counts.pendingAppointments : null,
    }),
    [counts]
  );

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const visibleItems = navItems.filter((item) => !item.allowedRoles || item.allowedRoles.includes(userRole));

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden" onClick={onClose} />}
      <aside
        className={clsx(
          'fixed inset-y-0 right-0 z-40 flex h-screen w-72 flex-col overflow-y-auto border-l border-white/5 bg-[#060a16]/95 p-5 text-white shadow-2xl shadow-black/40 backdrop-blur-xl transition-transform duration-300 md:static md:w-72 md:translate-x-0',
          isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        )}
      >
        <div className="mb-6 border-b border-white/5 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-cyan-600 shadow-lg shadow-sky-500/25">
              <Stethoscope className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white">عيادتي</h1>
              <p className="text-[11px] font-medium text-sky-400/80">نظام الإدارة الذكي</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5 pt-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            const badge = routeBadges[item.path];

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={clsx(
                  'mb-1 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all',
                  isActive
                    ? 'border border-sky-500/20 bg-sky-500/10 text-sky-300 shadow-lg shadow-sky-950/20'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {badge && (
                  <span className="rounded-full bg-sky-500/20 px-2 py-1 text-xs font-bold text-sky-300">
                    {badge > 99 ? '+99' : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/5 pt-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300 transition hover:bg-rose-500/20 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>
    </>
  );
}
