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
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 md:hidden"
        aria-label="فتح القائمة"
      >
        <Menu className="h-6 w-6" />
      </button>

      <div className="hidden md:block">
        <h2 className="text-xl font-bold text-slate-950">{title}</h2>
        <p className="text-xs text-slate-500">متصل بالسيرفر الحي</p>
      </div>

      <div className="flex items-center gap-3">
        <button className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="الإشعارات">
          <Bell className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-right">
            <p className="text-sm font-bold text-slate-950">{user.name || 'المستخدم'}</p>
            <p className="text-xs text-slate-500">{user.role || '-'}</p>
          </div>
          <div className="rounded-xl bg-blue-600 p-2 text-white">
            <User className="h-4 w-4" />
          </div>
        </div>
      </div>
    </header>
  );
}
