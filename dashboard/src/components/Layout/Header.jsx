import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, ExternalLink, Menu, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/client';

const routeTitles = {
  '/dashboard': 'الرئيسية',
  '/inbox': 'صندوق الوارد',
  '/today-patients': 'مرضى اليوم',
  '/add-patient': 'إضافة مريض / موعد',
  '/appointment-requests': 'قبول الطلبات والكشف',
  '/appointments': 'المواعيد',
  '/patients': 'المرضى',
  '/prescriptions': 'الروشتات',
  '/payments': 'المدفوعات',
  '/reschedule-doctor': 'إعادة جدولة طبيب',
  '/campaigns': 'الحملات',
  '/consultations': 'الاستشارات',
  '/services': 'الخدمات',
  '/staff': 'الكادر الطبي',
  '/reviews': 'التقييمات',
  '/analytics': 'التحليلات',
  '/ai-settings': 'الذكاء الاصطناعي',
  '/settings': 'الإعدادات',
};

const resolveTitle = (pathname) => {
  if (pathname.startsWith('/patients/')) return 'ملف المريض';
  return routeTitles[pathname] || 'النظام';
};

const formatNotificationTime = (value) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
};

export default function Header({ onMenuClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const title = resolveTitle(location.pathname);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!dropdownRef.current || dropdownRef.current.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const recentNotifications = useMemo(() => notifications.slice(0, 8), [notifications]);

  const markAllAsRead = async () => {
    await api.put('/notifications/mark-all-read');
    await loadNotifications();
  };

  const openNotification = async (notification) => {
    if (!notification.read) {
      await api.put(`/notifications/${notification.id}/read`).catch(() => null);
    }
    setOpen(false);
    if (notification.link) {
      navigate(notification.link);
    } else {
      loadNotifications();
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-[#0a0f1e]/90 px-6 py-4 shadow-lg shadow-black/20 backdrop-blur-xl">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white md:hidden"
        aria-label="فتح القائمة"
      >
        <Menu className="h-6 w-6" />
      </button>

      <div className="hidden md:block">
        <h2 className="text-2xl font-black tracking-tight text-white">{title}</h2>
        <p className="text-xs font-medium text-sky-400/80">متصل بالسيرفر الحي</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => {
              setOpen((current) => !current);
              if (!open) loadNotifications();
            }}
            className="relative rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="الإشعارات"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? (
              <span className="absolute -left-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-black text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </button>

          {open ? (
            <div className="absolute left-0 top-12 z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1020] shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <div>
                  <h3 className="font-black text-white">الإشعارات</h3>
                  <p className="text-xs text-slate-400">{unreadCount} غير مقروء</p>
                </div>
                <button
                  type="button"
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  تعليم الكل كمقروء
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="p-5 text-sm text-slate-400">جاري تحميل الإشعارات...</div>
                ) : recentNotifications.length === 0 ? (
                  <div className="p-5 text-sm text-slate-400">لا توجد إشعارات حالياً.</div>
                ) : (
                  recentNotifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => openNotification(notification)}
                      className={`block w-full border-b border-white/5 p-4 text-right transition hover:bg-white/5 ${
                        notification.read ? 'bg-transparent' : 'bg-sky-500/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">{notification.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{notification.message}</p>
                          <p className="mt-2 text-[11px] text-slate-500">{formatNotificationTime(notification.createdAt)}</p>
                        </div>
                        {notification.link ? <ExternalLink className="mt-1 h-4 w-4 flex-shrink-0 text-slate-500" /> : null}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-sm">
          <div className="text-right">
            <p className="text-sm font-bold text-white">{user.name || 'المستخدم'}</p>
            <p className="text-xs text-slate-400">{user.role || '-'}</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-sky-400 to-cyan-600 p-2 text-white shadow-lg shadow-sky-500/25">
            <User className="h-5 w-5" />
          </div>
        </div>
      </div>
    </header>
  );
}
