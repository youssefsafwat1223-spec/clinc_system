import { Bell, Menu, User } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const routeTitles = {
  '/dashboard': 'الرئيسية',
  '/inbox': 'صندوق الوارد',
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

export default function Header({ onMenuClick }) {
  const location = useLocation();
  const title = routeTitles[location.pathname] || 'النظام';
  const user = JSON.parse(localStorage.getItem('user') || '{}');

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
        <button className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white" aria-label="الإشعارات">
          <Bell className="h-5 w-5" />
        </button>
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
