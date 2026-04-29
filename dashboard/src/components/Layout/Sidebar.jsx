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
  { path: '/dashboard', label: '🏠 الرئيسية', icon: Home, main: true },
  { path: '/inbox', label: '💬 الرسائل', icon: MessageSquare, main: true },
  { path: '/appointments', label: '📅 المواعيد', icon: Calendar, main: true },
  { path: '/patients', label: '👥 المرضى', icon: Users, main: true },
  { path: '/campaigns', label: '📢 الحملات', icon: Megaphone, allowedRoles: ['ADMIN', 'STAFF'] },
  { path: '/consultations', label: '📋 الاستشارات', icon: FileText },
  { path: '/services', label: '🏥 الخدمات', icon: Stethoscope, allowedRoles: ['ADMIN'] },
  { path: '/staff', label: '👨‍⚕️ الموظفين', icon: UserSquare2, allowedRoles: ['ADMIN'] },
  { path: '/reviews', label: '⭐ التقييمات', icon: Star, allowedRoles: ['ADMIN', 'DOCTOR'] },
  { path: '/analytics', label: '📊 التحليلات', icon: LineChart, allowedRoles: ['ADMIN'] },
  { path: '/ai-settings', label: '🤖 الذكاء الاصطناعي', icon: Bot, allowedRoles: ['ADMIN'] },
  { path: '/settings', label: '⚙️ الإعدادات', icon: Settings, allowedRoles: ['ADMIN'] },
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
          'fixed inset-y-0 right-0 z-40 flex h-screen w-72 flex-col overflow-y-auto border-l-4 border-green-500 bg-white p-6 transition-transform duration-300 md:static md:w-64 md:translate-x-0',
          isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        )}
      >
      <div className="mb-6 border-b-2 border-green-500 pb-4">
        <h1 className="text-2xl font-bold text-green-600">🏥 عيادتي</h1>
        <p className="text-xs text-gray-500 mt-1">نظام إدارة بسيط وسهل</p>
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
                'flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all mb-2',
                isActive
                  ? 'bg-green-500 text-white shadow-lg'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <span className="text-xl">{item.label.split(' ')[0]}</span>
              <span className="flex-1">{item.label.split(' ').slice(1).join(' ')}</span>

              {badge && (
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                  {badge.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t-2 border-gray-200 pt-4">
        <button
          onClick={handleLogout}
          className="w-full bg-red-500 text-white px-4 py-3 rounded-lg font-bold hover:bg-red-600 transition"
        >
          🚪 تسجيل الخروج
        </button>
      </div>
    </aside>
    </>
  );
}
