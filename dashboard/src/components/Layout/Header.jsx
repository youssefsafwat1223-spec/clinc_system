import { Bell, Menu, User } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const routeTitles = {
  '/dashboard': 'الرئيسية',
  '/inbox': 'الرسائل',
  '/appointments': 'المواعيد',
  '/patients': 'المرضى',
  '/campaigns': 'الحملات',
  '/settings': 'الإعدادات',
};

export default function Header({ onMenuClick }) {
  const location = useLocation();
  const title = routeTitles[location.pathname] || 'النظام';
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <header className="sticky top-0 z-30 bg-white border-b-2 border-gray-200 px-6 py-4 flex items-center justify-between">
      <button
        type="button"
        onClick={onMenuClick}
        className="text-gray-700 hover:text-green-600 md:hidden"
      >
        <Menu className="h-6 w-6" />
      </button>

      <h2 className="hidden md:block text-2xl font-bold text-gray-900">
        {title}
      </h2>

      <div className="flex items-center gap-4">
        <button className="text-gray-600 hover:text-gray-900">
          <Bell className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-3 pl-4 border-l-2 border-gray-200">
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">{user.name || 'المستخدم'}</p>
            <p className="text-xs text-gray-500">{user.role}</p>
          </div>
          <div className="bg-green-500 text-white rounded-full p-2">
            <User className="h-5 w-5" />
          </div>
        </div>
      </div>
    </header>
  );
}
