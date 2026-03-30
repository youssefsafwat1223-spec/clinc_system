import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Calendar,
  Check,
  Clock3,
  Menu,
  MessageSquare,
  RefreshCw,
  Search,
  Stethoscope,
  Trash2,
  User,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { formatDistanceToNow, isToday, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import api from '../../api/client';

const routeTitles = {
  '/': 'الرئيسية المباشرة',
  '/inbox': 'صندوق الوارد ورسائل الذكاء الاصطناعي',
  '/appointments': 'إدارة المواعيد',
  '/patients': 'سجلات المرضى',
  '/services': 'خدمات العيادة',
  '/staff': 'الكادر الطبي والموظفون',
  '/consultations': 'الاستشارات الطبية',
  '/campaigns': 'الحملات والرسائل الجماعية',
  '/settings': 'إعدادات النظام الأساسية',
  '/ai-settings': 'تخصيص مساعد الذكاء الاصطناعي',
  '/analytics': 'مؤشرات الأداء والتحليلات',
};

const roleLabels = {
  ADMIN: 'مدير النظام',
  DOCTOR: 'طبيب',
  STAFF: 'موظف',
  RECEPTION: 'الاستقبال',
};

const notificationFilters = [
  { id: 'ALL', label: 'الكل' },
  { id: 'UNREAD', label: 'غير المقروء' },
  { id: 'APPOINTMENTS', label: 'المواعيد' },
  { id: 'MESSAGES', label: 'المحادثات' },
  { id: 'CONSULTATIONS', label: 'الاستشارات' },
];

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{"name":"الإدارة","role":"ADMIN"}');
  } catch {
    return { name: 'الإدارة', role: 'ADMIN' };
  }
}

function getNotificationMeta(type) {
  if (type === 'HUMAN_REQUEST') {
    return {
      icon: MessageSquare,
      iconClass: 'text-emerald-400',
      bubbleClass: 'bg-emerald-500/10 ring-emerald-500/20',
      category: 'MESSAGES',
      categoryLabel: 'محادثة',
    };
  }

  if (type === 'NEW_APPOINTMENT') {
    return {
      icon: Calendar,
      iconClass: 'text-sky-400',
      bubbleClass: 'bg-sky-500/10 ring-sky-500/20',
      category: 'APPOINTMENTS',
      categoryLabel: 'موعد جديد',
    };
  }

  if (type === 'CANCELED_APPOINTMENT' || type === 'APPOINTMENT_CANCELLED') {
    return {
      icon: Trash2,
      iconClass: 'text-rose-400',
      bubbleClass: 'bg-rose-500/10 ring-rose-500/20',
      category: 'APPOINTMENTS',
      categoryLabel: 'إلغاء موعد',
    };
  }

  if (type === 'CONSULTATION_REQUEST') {
    return {
      icon: Stethoscope,
      iconClass: 'text-primary-300',
      bubbleClass: 'bg-primary-500/10 ring-primary-500/20',
      category: 'CONSULTATIONS',
      categoryLabel: 'استشارة',
    };
  }

  return {
    icon: AlertCircle,
    iconClass: 'text-slate-400',
    bubbleClass: 'bg-slate-500/10 ring-slate-500/20',
    category: 'ALL',
    categoryLabel: 'تنبيه',
  };
}

function getNotificationFilterCount(notifications, filterId) {
  if (filterId === 'ALL') {
    return notifications.length;
  }

  if (filterId === 'UNREAD') {
    return notifications.filter((notification) => !notification.read).length;
  }

  return notifications.filter((notification) => getNotificationMeta(notification.type).category === filterId).length;
}

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const user = readStoredUser();

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState('ALL');

  const currentPath =
    Object.keys(routeTitles).find((path) => path === location.pathname || (path !== '/' && location.pathname.startsWith(path))) || '/';

  const title = routeTitles[currentPath] || 'لوحة التحكم';
  const footerLink = user.role === 'ADMIN' ? '/settings' : '/appointments';
  const footerLabel = user.role === 'ADMIN' ? 'إعدادات التنبيهات' : 'عرض المواعيد';

  const fetchNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch notifications');
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      await fetchNotifications();
    } catch (error) {
      console.error('Failed to mark as read');
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    if (notification.link) {
      navigate(notification.link);
    }

    setShowNotifications(false);
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/mark-all-read');
      await fetchNotifications();
    } catch (error) {
      console.error('Failed to mark all as read');
    }
  };

  const summary = useMemo(() => {
    const manual = notifications.filter((notification) => notification.type === 'HUMAN_REQUEST').length;
    const appointments = notifications.filter((notification) =>
      ['NEW_APPOINTMENT', 'CANCELED_APPOINTMENT', 'APPOINTMENT_CANCELLED'].includes(notification.type)
    ).length;
    const today = notifications.filter((notification) => {
      try {
        return isToday(parseISO(notification.createdAt));
      } catch {
        return false;
      }
    }).length;

    return {
      total: notifications.length,
      unread: unreadCount,
      manual,
      appointments,
      today,
    };
  }, [notifications, unreadCount]);

  const filteredNotifications = useMemo(() => {
    if (notificationFilter === 'ALL') {
      return notifications;
    }

    if (notificationFilter === 'UNREAD') {
      return notifications.filter((notification) => !notification.read);
    }

    return notifications.filter((notification) => getNotificationMeta(notification.type).category === notificationFilter);
  }, [notificationFilter, notifications]);

  const notificationSections = useMemo(() => {
    const unread = filteredNotifications.filter((notification) => !notification.read);
    const read = filteredNotifications.filter((notification) => notification.read);
    const sections = [];

    if (unread.length > 0) {
      sections.push({ id: 'unread', label: 'غير المقروءة', items: unread });
    }

    if (read.length > 0) {
      sections.push({ id: 'read', label: 'المقروءة حديثًا', items: read });
    }

    return sections;
  }, [filteredNotifications]);

  const formatNotificationTime = (createdAt) => {
    try {
      return formatDistanceToNow(parseISO(createdAt), { addSuffix: true, locale: ar });
    } catch {
      return '';
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-dark-border bg-dark-bg/80 px-6 shadow-sm backdrop-blur-xl lg:px-8">
      <button className="text-dark-muted transition-colors hover:text-white md:hidden">
        <Menu className="h-6 w-6" />
      </button>

      <div className="hidden flex-col md:flex">
        <h2 className="fade-in bg-gradient-to-r from-white to-slate-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
          {title}
        </h2>
        <div className="mt-1 flex items-center text-xs text-dark-muted">
          <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
          <span>متصل بالسيرفر الحي</span>
        </div>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <div className="group relative hidden lg:block">
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pl-3 pr-3">
            <Search className="h-4 w-4 text-dark-muted transition-colors group-focus-within:text-primary-400" />
          </div>
          <input
            type="text"
            className="block w-64 rounded-xl border border-dark-border bg-dark-card/50 py-2 pl-3 pr-10 text-sm text-dark-text placeholder-dark-muted shadow-inner transition-all focus:border-primary-500/50 focus:bg-dark-card focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            placeholder="البحث السريع الموحد..."
          />
        </div>

        <div className="mx-1 hidden h-8 w-px bg-dark-border sm:block"></div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowNotifications((prev) => !prev)}
            className="group relative rounded-xl p-2.5 text-slate-400 transition-all hover:bg-dark-card/80 hover:text-white focus:outline-none focus:ring-2 ring-primary-500/30 active:scale-95"
          >
            <Bell className="h-5 w-5 group-hover:animate-swing" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60"></span>
                <span className="relative inline-flex h-full w-full items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-lg shadow-rose-500/50">
                  {unreadCount > 9 ? '+9' : unreadCount}
                </span>
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              dir="rtl"
              className="absolute left-0 z-50 mt-3 flex w-[calc(100vw-2rem)] max-w-[38rem] origin-top-left flex-col overflow-hidden rounded-2xl border border-dark-border/60 bg-[#0f172a]/95 shadow-2xl backdrop-blur-xl sm:w-[34rem] lg:w-[38rem]"
            >
              <div className="border-b border-dark-border/40 bg-dark-bg/50 p-4 text-right">
                <div className="flex flex-row-reverse items-start justify-between gap-3">
                  <div>
                    <h3 className="flex flex-row-reverse items-center gap-2 font-extrabold text-white">
                      <Bell className="h-4 w-4 text-primary-400" />
                      الإشعارات
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">نظرة سريعة على الجديد وما يحتاج متابعة فورية.</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchNotifications}
                      className="rounded-lg border border-dark-border/60 bg-dark-bg/60 p-2 text-slate-400 transition-colors hover:text-white"
                      title="تحديث"
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingNotifications ? 'animate-spin' : ''}`} />
                    </button>

                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="flex shrink-0 items-center gap-1 rounded-lg border border-primary-500/20 bg-primary-500/10 px-3 py-2 text-xs font-bold text-primary-300 transition-colors hover:text-primary-200"
                      >
                        <Check className="h-3.5 w-3.5" />
                        تحديد الكل كمقروء
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-dark-border/50 bg-dark-bg/50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Unread</p>
                    <p className="mt-2 text-xl font-extrabold text-white">{summary.unread}</p>
                    <p className="mt-1 text-[11px] text-slate-400">تنتظر الفتح</p>
                  </div>
                  <div className="rounded-2xl border border-dark-border/50 bg-dark-bg/50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Manual</p>
                    <p className="mt-2 text-xl font-extrabold text-amber-300">{summary.manual}</p>
                    <p className="mt-1 text-[11px] text-slate-400">محادثات بشرية</p>
                  </div>
                  <div className="rounded-2xl border border-dark-border/50 bg-dark-bg/50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Today</p>
                    <p className="mt-2 text-xl font-extrabold text-sky-300">{summary.today}</p>
                    <p className="mt-1 text-[11px] text-slate-400">إشعارات اليوم</p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2 overflow-x-auto custom-scrollbar">
                  {notificationFilters.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setNotificationFilter(filter.id)}
                      className={`flex min-w-fit items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition-all ${
                        notificationFilter === filter.id
                          ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                          : 'bg-dark-bg/60 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>{filter.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                          notificationFilter === filter.id ? 'bg-white/15 text-white' : 'bg-dark-border/50 text-slate-300'
                        }`}
                      >
                        {getNotificationFilterCount(notifications, filter.id)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[min(72vh,34rem)] flex-1 overflow-y-auto">
                {loadingNotifications && notifications.length === 0 ? (
                  <div className="flex justify-center p-8">
                    <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary-500 border-t-transparent"></span>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center p-10 text-center text-slate-500">
                    <Bell className="mb-3 h-10 w-10 opacity-20" />
                    <p className="text-sm font-semibold">لا توجد إشعارات ضمن هذا التصنيف</p>
                    <p className="mt-2 text-xs text-slate-500">جرّب تغيير الفلتر أو حدّث القائمة.</p>
                  </div>
                ) : (
                  <div className="space-y-5 p-4">
                    {notificationSections.map((section) => (
                      <div key={section.id} className="space-y-2">
                        <div className="flex items-center gap-3 px-1">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{section.label}</span>
                          <div className="h-px flex-1 bg-dark-border/60"></div>
                        </div>

                        <div className="space-y-2">
                          {section.items.map((notification) => {
                            const meta = getNotificationMeta(notification.type);
                            const Icon = meta.icon;

                            return (
                              <button
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-right transition-colors hover:bg-[#1e293b]/50 ${
                                  notification.read
                                    ? 'border-dark-border/50 bg-dark-bg/30'
                                    : 'border-primary-500/20 bg-primary-900/10'
                                }`}
                              >
                                <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${meta.bubbleClass}`}>
                                  <Icon className={`h-4.5 w-4.5 ${meta.iconClass}`} />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="mb-2 flex flex-row-reverse items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="mb-1 flex flex-row-reverse items-center gap-2">
                                        <span className="rounded-full bg-dark-bg/70 px-2 py-1 text-[10px] font-bold text-slate-400 ring-1 ring-dark-border/60">
                                          {meta.categoryLabel}
                                        </span>
                                        {!notification.read ? (
                                          <span className="h-2 w-2 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]"></span>
                                        ) : null}
                                      </div>
                                      <h4 className={`break-words text-sm font-bold leading-6 ${notification.read ? 'text-slate-200' : 'text-white'}`}>
                                        {notification.title}
                                      </h4>
                                    </div>

                                    <span className="shrink-0 text-[10px] font-medium text-slate-500" dir="ltr">
                                      {formatNotificationTime(notification.createdAt)}
                                    </span>
                                  </div>

                                  <p className={`break-words text-xs leading-6 ${notification.read ? 'text-slate-400' : 'text-slate-300'}`}>
                                    {notification.message}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-dark-border/40 bg-dark-bg/80 p-3 text-center">
                <Link
                  to={footerLink}
                  className="text-xs font-bold text-slate-400 transition-colors hover:text-white"
                  onClick={() => setShowNotifications(false)}
                >
                  {footerLabel}
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="group flex cursor-pointer items-center gap-3 rounded-full border border-dark-border/50 bg-dark-card/30 py-1.5 pl-4 pr-2 transition-colors hover:bg-dark-card/60">
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-sm font-semibold text-white transition-colors group-hover:text-primary-300">{user.name}</span>
            <span className="text-xs font-medium tracking-wide text-dark-muted">{roleLabels[user.role] || 'مستخدم النظام'}</span>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-600 shadow-inner ring-2 ring-transparent transition-all group-hover:ring-primary-500/30">
            <User className="h-4 w-4 text-slate-300" />
          </div>
        </div>
      </div>
    </header>
  );
}
