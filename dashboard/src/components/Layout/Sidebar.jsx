import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bot,
  Calendar,
  FileText,
  Home,
  LineChart,
  LogOut,
  Megaphone,
  MessageSquare,
  Settings,
  Star,
  Stethoscope,
  UserSquare2,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../api/client';

const navItems = [
  { path: '/dashboard', label: 'الرئيسية', icon: Home },
  { path: '/inbox', label: 'صندوق الوارد', icon: MessageSquare },
  { path: '/appointments', label: 'المواعيد', icon: Calendar },
  { path: '/consultations', label: 'الاستشارات', icon: FileText },
  { path: '/patients', label: 'المرضى', icon: Users },
  { path: '/campaigns', label: 'الحملات', icon: Megaphone, allowedRoles: ['ADMIN', 'STAFF'] },
  { path: '/services', label: 'الخدمات', icon: Stethoscope, allowedRoles: ['ADMIN'] },
  { path: '/staff', label: 'الكادر الطبي', icon: UserSquare2, allowedRoles: ['ADMIN'] },
  { path: '/settings', label: 'إعدادات العيادة', icon: Settings, allowedRoles: ['ADMIN'] },
  { path: '/ai-settings', label: 'الذكاء الاصطناعي', icon: Bot, allowedRoles: ['ADMIN'] },
  { path: '/analytics', label: 'التحليلات', icon: LineChart, allowedRoles: ['ADMIN'] },
  { path: '/reviews', label: 'التقييمات', icon: Star, allowedRoles: ['ADMIN', 'DOCTOR'] },
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
  const [counts, setCounts] = useState({
    unreadMessages: 0,
    pendingAppointments: 0,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchCounts = async () => {
      try {
        const [notificationsRes, appointmentStatsRes] = await Promise.all([
          api.get('/notifications'),
          api.get('/appointments/stats'),
        ]);

        if (cancelled) {
          return;
        }

        const notifications = notificationsRes.data.notifications || [];
        const unreadMessages = notifications.filter(
          (notification) => notification.type === 'HUMAN_REQUEST' && !notification.read
        ).length;

        setCounts({
          unreadMessages,
          pendingAppointments: appointmentStatsRes.data.PENDING || 0,
        });
      } catch {
        if (!cancelled) {
          setCounts({ unreadMessages: 0, pendingAppointments: 0 });
        }
      }
    };

    fetchCounts();
    return () => {
      cancelled = true;
    };
  }, []);

  const routeBadges = useMemo(
    () => ({
      '/inbox':
        counts.unreadMessages > 0
          ? {
              label: counts.unreadMessages > 9 ? '+9' : counts.unreadMessages,
              className: 'border border-primary-500/30 bg-primary-500/20 text-primary-400',
            }
          : null,
      '/appointments':
        counts.pendingAppointments > 0
          ? {
              label: counts.pendingAppointments > 99 ? '+99' : counts.pendingAppointments,
              className: 'border border-amber-500/30 bg-amber-500/20 font-bold text-amber-400',
            }
          : null,
    }),
    [counts.pendingAppointments, counts.unreadMessages]
  );

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const handleClose = () => {
    if (onClose) onClose();
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={handleClose}
        />
      )}
      <aside
        className={clsx(
          'fixed inset-y-0 right-0 z-40 flex h-screen w-72 flex-col overflow-y-auto border-l border-dark-border bg-dark-card/80 p-4 backdrop-blur-xl transition-transform duration-300 md:static md:w-64 md:translate-x-0 md:bg-dark-card/50',
          isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        )}
      >
      <div className="mb-8 flex items-center gap-3 border-b border-dark-border/50 px-2 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 shadow-lg shadow-primary-500/30">
          <Stethoscope className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-wide text-white">عيادتي</h1>
          <p className="text-xs font-medium text-primary-400">نظام الإدارة الذكي</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col space-y-1.5 pt-2">
        {navItems.map((item) => {
          if (item.allowedRoles && !item.allowedRoles.includes(userRole)) {
            return null;
          }

          const Icon = item.icon;
          const isActive =
            location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          const badge = routeBadges[item.path];

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleClose}
              className={clsx(
                'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300',
                isActive
                  ? 'border border-primary-500/20 bg-primary-500/10 text-primary-400 shadow-inner'
                  : 'text-dark-muted hover:bg-dark-border/50 hover:text-white'
              )}
            >
              <Icon className={clsx('h-5 w-5 transition-transform duration-300', isActive ? 'scale-110' : 'group-hover:scale-110')} />
              <span>{item.label}</span>

              {badge && (
                <span className={clsx('mr-auto rounded-full px-2 py-0.5 text-xs', badge.className)}>
                  {badge.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 border-t border-dark-border/50 pt-6">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-900/20 hover:text-red-300"
        >
          <LogOut className="h-5 w-5" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
    </>
  );
}
