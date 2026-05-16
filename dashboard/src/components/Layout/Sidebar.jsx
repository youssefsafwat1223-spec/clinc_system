import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bot,
  Calendar,
  ChevronDown,
  CreditCard,
  HelpCircle,
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

const navGroups = [
  {
    id: 'today',
    label: 'اليوم',
    items: [
      { path: '/dashboard', label: 'الرئيسية', icon: Home },
      { path: '/today-patients', label: 'مرضى اليوم', icon: Users, allowedRoles: ['ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'] },
      { path: '/inbox', label: 'صندوق الوارد', icon: MessageSquare },
      { path: '/callback-requests', label: 'طلبات التواصل', icon: MessageSquare, allowedRoles: ['ADMIN', 'STAFF', 'RECEPTION'] },
    ],
  },
  {
    id: 'patients-appointments',
    label: 'المرضى والمواعيد',
    items: [
      { path: '/add-patient', label: 'إضافة مريض / موعد', icon: UserPlus, allowedRoles: ['ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'] },
      { path: '/appointments', label: 'المواعيد', icon: Calendar },
      { path: '/patients', label: 'المرضى', icon: Users },
      { path: '/reschedule-doctor', label: 'إعادة جدولة طبيب', icon: Repeat2, allowedRoles: ['ADMIN'] },
      { path: '/doctor-tasks', label: 'مهام الأطباء', icon: Stethoscope, allowedRoles: ['ADMIN'] },
    ],
  },
  {
    id: 'treatment-billing',
    label: 'العلاج والمدفوعات',
    items: [
      { path: '/prescriptions', label: 'الروشتات', icon: Pill, allowedRoles: ['ADMIN', 'DOCTOR'] },
      { path: '/payments', label: 'المدفوعات', icon: CreditCard, allowedRoles: ['ADMIN', 'STAFF', 'RECEPTION'] },
    ],
  },
  {
    id: 'marketing',
    label: 'التسويق والتواصل',
    items: [
      { path: '/campaigns', label: 'الحملات', icon: Megaphone, allowedRoles: ['ADMIN', 'STAFF'] },
      { path: '/send-offers', label: 'إرسال عروض', icon: Megaphone, allowedRoles: ['ADMIN', 'STAFF'] },
    ],
  },
  {
    id: 'management',
    label: 'الإدارة',
    items: [
      { path: '/services', label: 'الخدمات', icon: Stethoscope, allowedRoles: ['ADMIN'] },
      { path: '/staff', label: 'الكادر الطبي', icon: UserSquare2, allowedRoles: ['ADMIN'] },
      { path: '/reviews', label: 'التقييمات', icon: Star, allowedRoles: ['ADMIN', 'DOCTOR'] },
      { path: '/analytics', label: 'التحليلات', icon: LineChart, allowedRoles: ['ADMIN'] },
    ],
  },
  {
    id: 'system',
    label: 'النظام',
    items: [
      { path: '/system-guide', label: 'شرح النظام', icon: HelpCircle },
      { path: '/ai-settings', label: 'الذكاء الاصطناعي', icon: Bot, allowedRoles: ['ADMIN'] },
      { path: '/settings', label: 'الإعدادات', icon: Settings, allowedRoles: ['ADMIN'] },
    ],
  },
];

const COLLAPSED_KEY = 'dashboard_sidebar_groups_collapsed';

function readCollapsedGroups() {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeCollapsedGroups(state) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(state));
  } catch {
    // localStorage failures are non-fatal.
  }
}

export default function Sidebar({ isOpen = false, isCollapsed = false, onClose }) {
  const location = useLocation();
  const userStr = localStorage.getItem('user');
  let userRole = 'STAFF';
  try {
    userRole = userStr ? JSON.parse(userStr).role : 'STAFF';
  } catch {
    userRole = 'STAFF';
  }

  const [counts, setCounts] = useState({ unreadMessages: 0, pendingAppointments: 0, callbackRequests: 0 });
  const [collapsedGroups, setCollapsedGroups] = useState(readCollapsedGroups);
  const asideRef = useRef(null);
  const touchStartX = useRef(null);
  const touchDeltaX = useRef(0);

  const fetchCounts = async () => {
    try {
      const [notificationsRes, appointmentStatsRes, callbackRequestsRes] = await Promise.all([
        api.get('/notifications'),
        api.get('/appointments/stats'),
        api.get('/callback-requests', { params: { status: 'NEW', limit: 1 } }).catch(() => ({ data: { stats: { NEW: 0 } } })),
      ]);

      const notifications = notificationsRes.data.notifications || [];
      setCounts({
        unreadMessages: notifications.filter((n) => n.type === 'HUMAN_REQUEST' && !n.read).length,
        pendingAppointments: appointmentStatsRes.data.PENDING || 0,
        callbackRequests: callbackRequestsRes.data?.stats?.NEW || 0,
      });
    } catch {
      // Silently ignore: stale counts are better than crashing the sidebar.
    }
  };

  useEffect(() => {
    fetchCounts();
    const interval = window.setInterval(fetchCounts, 60000);
    const handleFocus = () => fetchCounts();
    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const routeBadges = useMemo(
    () => ({
      '/inbox': counts.unreadMessages > 0 ? counts.unreadMessages : null,
      '/appointments': counts.pendingAppointments > 0 ? counts.pendingAppointments : null,
      '/callback-requests': counts.callbackRequests > 0 ? counts.callbackRequests : null,
    }),
    [counts]
  );

  const toggleGroup = (groupId) => {
    setCollapsedGroups((current) => {
      const next = { ...current, [groupId]: !current[groupId] };
      writeCollapsedGroups(next);
      return next;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !item.allowedRoles || item.allowedRoles.includes(userRole)),
        }))
        .filter((group) => group.items.length > 0),
    [userRole]
  );

  const handleTouchStart = (event) => {
    if (window.innerWidth >= 768) return;
    touchStartX.current = event.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (event) => {
    if (touchStartX.current === null) return;
    touchDeltaX.current = event.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null) return;
    if (touchDeltaX.current > 60) onClose?.();
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}
      <aside
        ref={asideRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={clsx(
          'fixed inset-y-0 right-0 z-40 flex h-screen flex-col overflow-y-auto border-l border-white/5 bg-[#060a16]/95 p-5 text-white shadow-2xl shadow-black/40 backdrop-blur-xl transition-all duration-300 md:static md:translate-x-0',
          isCollapsed ? 'md:w-24' : 'md:w-72',
          isOpen ? 'translate-x-0 w-72' : 'translate-x-full md:translate-x-0'
        )}
      >
        <div className={clsx('mb-5 border-b border-white/5 pb-5', isCollapsed && 'md:items-center')}>
          <div className={clsx('flex items-center gap-3', isCollapsed && 'md:justify-center')}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-cyan-600 shadow-lg shadow-sky-500/25">
              <Stethoscope className="h-6 w-6 text-white" />
            </div>
            <div className={clsx(isCollapsed ? 'md:hidden' : 'min-w-0')}>
              <h1 className="text-xl font-black tracking-tight text-white">عيادتي</h1>
              <p className="text-[11px] font-medium text-sky-400/80">نظام الإدارة الذكي</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 pt-1">
          {visibleGroups.map((group) => {
            const isGroupCollapsed = collapsedGroups[group.id];

            return (
              <div key={group.id} className="mb-2">
                {!isCollapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500 transition hover:text-slate-300"
                    aria-expanded={!isGroupCollapsed}
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={clsx(
                        'h-3.5 w-3.5 transition-transform',
                        isGroupCollapsed ? '-rotate-90' : 'rotate-0'
                      )}
                    />
                  </button>
                ) : null}

                {!isGroupCollapsed || isCollapsed ? (
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                      const badge = routeBadges[item.path];

                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={onClose}
                          title={item.label}
                          className={clsx(
                            'relative flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
                            isCollapsed ? 'justify-center gap-0 md:px-3' : 'gap-3',
                            isActive
                              ? 'border border-sky-500/20 bg-sky-500/10 text-sky-300 shadow-lg shadow-sky-950/20'
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          )}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          {!isCollapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
                          {!isCollapsed && badge ? (
                            <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-xs font-bold text-sky-300">
                              {badge > 99 ? '+99' : badge}
                            </span>
                          ) : null}
                          {isCollapsed && badge ? (
                            <span className="absolute -left-1 -top-1 rounded-full bg-sky-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                              {badge > 99 ? '+99' : badge}
                            </span>
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/5 pt-4">
          <button
            onClick={handleLogout}
            title="تسجيل الخروج"
            className={clsx(
              'flex rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300 transition hover:bg-rose-500/20 hover:text-white',
              isCollapsed ? 'w-full items-center justify-center' : 'w-full items-center justify-center gap-2'
            )}
            aria-label="تسجيل الخروج"
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed ? 'تسجيل الخروج' : null}
          </button>
        </div>
      </aside>
    </>
  );
}
