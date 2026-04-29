import { useEffect, useState } from 'react';
import { Calendar, MessageSquare, Users, Activity } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';

export default function DashboardPage() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalAppointments: 0,
    totalMessages: 0,
    pendingAppointments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/analytics');
        const data = res.data || {};
        setStats({
          totalPatients: data.overview?.totalPatients || 0,
          totalAppointments: data.overview?.totalAppointments || 0,
          totalMessages: data.overview?.totalMessages || 0,
          pendingAppointments: data.appointmentsByStatus?.PENDING || 0,
        });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-96 items-center justify-center">
          <div className="text-2xl font-bold text-gray-500">جاري التحميل...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Welcome */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-8 rounded-xl shadow-lg">
          <h1 className="text-4xl font-bold">أهلاً {user.name}</h1>
          <p className="text-lg mt-2">مرحباً بك في نظام إدارة العيادة</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="إجمالي المرضى"
            value={stats.totalPatients}
            icon={Users}
            color="bg-blue-500"
          />
          <StatCard
            title="المواعيد"
            value={stats.totalAppointments}
            icon={Calendar}
            color="bg-green-500"
          />
          <StatCard
            title="الرسائل"
            value={stats.totalMessages}
            icon={MessageSquare}
            color="bg-purple-500"
          />
          <StatCard
            title="قيد الانتظار"
            value={stats.pendingAppointments}
            icon={Activity}
            color="bg-red-500"
          />
        </div>

        {/* Quick Links */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">الوصول السريع</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <QuickLink href="/appointments" icon="📅" title="المواعيد" subtitle="إدارة مواعيد المرضى" />
            <QuickLink href="/inbox" icon="💬" title="الرسائل" subtitle="الرد على رسائل المرضى" />
            <QuickLink href="/patients" icon="👥" title="المرضى" subtitle="عرض ملفات المرضى" />
            <QuickLink href="/campaigns" icon="📢" title="الحملات" subtitle="إرسال رسائل جماعية" />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-md border-t-4 border-gray-200 hover:shadow-lg transition">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-4xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`${color} text-white p-4 rounded-xl`}>
          <Icon className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}

function QuickLink({ href, icon, title, subtitle }) {
  return (
    <a
      href={href}
      className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition border-l-4 border-green-500 hover:bg-green-50 block"
    >
      <div className="flex items-center gap-4">
        <span className="text-4xl">{icon}</span>
        <div>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600">{subtitle}</p>
        </div>
      </div>
    </a>
  );
}
