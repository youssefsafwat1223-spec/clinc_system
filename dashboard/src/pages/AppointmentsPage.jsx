import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { toast } from 'react-toastify';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Calendar as CalendarIcon, CheckCircle, Clock, User, XCircle } from 'lucide-react';
import ManualBookingPanel from '../components/appointments/ManualBookingPanel';

const daysAr = {
  sunday: 'الأحد',
  monday: 'الاثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
  saturday: 'السبت',
};

const statusLabels = {
  ALL: 'الكل',
  PENDING: 'قيد الانتظار',
  CONFIRMED: 'مؤكد',
  COMPLETED: 'تم الكشف',
  CANCELLED: 'ملغي',
  REJECTED: 'مرفوض',
  BLOCKED: 'مغلق',
};

const statusColors = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', badge: 'bg-yellow-500' },
  CONFIRMED: { bg: 'bg-green-100', text: 'text-green-800', badge: 'bg-green-500' },
  COMPLETED: { bg: 'bg-blue-100', text: 'text-blue-800', badge: 'bg-blue-500' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-800', badge: 'bg-red-500' },
  REJECTED: { bg: 'bg-orange-100', text: 'text-orange-800', badge: 'bg-orange-500' },
  BLOCKED: { bg: 'bg-gray-100', text: 'text-gray-800', badge: 'bg-gray-500' },
};

function StatusBadge({ status }) {
  const colors = statusColors[status] || statusColors.PENDING;
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors.bg} ${colors.text} inline-flex items-center gap-1`}>
      {statusLabels[status] || status}
    </span>
  );
}

function StatCard({ title, value, icon: Icon }) {
  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className="bg-green-100 p-3 rounded-lg">
          <Icon className="h-5 w-5 text-green-600" />
        </div>
      </div>
    </div>
  );
}

export default function AppointmentsPage() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isDoctor = user.role === 'DOCTOR';

  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({
    ALL: 0,
    PENDING: 0,
    CONFIRMED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    REJECTED: 0,
    BLOCKED: 0,
  });
  const [loading, setLoading] = useState(true);
  const [doctorLoading, setDoctorLoading] = useState(isDoctor);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [doctorProfile, setDoctorProfile] = useState(null);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const [resApt, resStats] = await Promise.all([
        api.get('/appointments', { params: { status: filter === 'ALL' ? undefined : filter, limit: 50 } }),
        api.get('/appointments/stats').catch(() => ({ data: {} })),
      ]);
      setAppointments(resApt.data.appointments || []);
      if (resStats.data && typeof resStats.data === 'object') {
        setStats((prev) => ({ ...prev, ...resStats.data }));
      }
    } catch (error) {
      toast.error('فشل في تحميل المواعيد');
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctorProfile = async () => {
    if (!isDoctor) return;
    try {
      setDoctorLoading(true);
      const res = await api.get('/doctors/me');
      setDoctorProfile(res.data.doctor || null);
    } catch (error) {
      toast.error('فشل في تحميل جدول الطبيب');
    } finally {
      setDoctorLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [filter]);

  useEffect(() => {
    fetchDoctorProfile();
  }, []);

  const handleAction = async (id, action) => {
    try {
      if (action === 'confirm') {
        await api.post(`/appointments/${id}/confirm`);
        toast.success('تم تأكيد الموعد');
      } else if (action === 'complete') {
        if (!window.confirm('هل تم الكشف على المريض؟')) return;
        await api.post(`/appointments/${id}/complete`);
        toast.success('تم تسجيل الحجز كمكتمل');
      } else if (action === 'cancel') {
        const reason = prompt('سبب الإلغاء:');
        if (reason === null) return;
        await api.post(`/appointments/${id}/cancel`, { reason });
        toast.success('تم إلغاء الحجز');
      } else if (action === 'reject') {
        const reason = prompt('سبب الرفض:');
        if (reason === null) return;
        await api.post(`/appointments/${id}/reject`, { reason });
        toast.success('تم رفض الموعد');
      }
      fetchAppointments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'حدث خطأ');
    }
  };

  const updateWorkingHours = (day, field, value) => {
    setDoctorProfile((prev) => ({
      ...prev,
      workingHours: {
        ...(prev?.workingHours || {}),
        [day]: {
          ...(prev?.workingHours?.[day] || {}),
          [field]: value,
        },
      },
    }));
  };

  const toggleDay = (day) => {
    setDoctorProfile((prev) => {
      const current = prev?.workingHours?.[day];
      return {
        ...prev,
        workingHours: {
          ...(prev?.workingHours || {}),
          [day]: current ? null : { start: '09:00', end: '17:00' },
        },
      };
    });
  };

  const saveSchedule = async () => {
    try {
      setSavingSchedule(true);
      const res = await api.put('/doctors/me/schedule', {
        workingHours: doctorProfile?.workingHours || {},
      });
      setDoctorProfile(res.data.doctor || doctorProfile);
      toast.success('تم حفظ جدولك');
      fetchAppointments();
    } catch (error) {
      toast.error('فشل في حفظ الجدول');
    } finally {
      setSavingSchedule(false);
    }
  };

  const groupedAppointments = appointments.reduce((acc, appointment) => {
    const dateStr = format(parseISO(appointment.scheduledTime), 'yyyy-MM-dd');
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(appointment);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedAppointments).sort();

  const todayAppointmentsCount = useMemo(
    () => appointments.filter((a) => format(parseISO(a.scheduledTime), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length,
    [appointments]
  );

  const nextAppointment = useMemo(
    () =>
      appointments
        .filter((a) => new Date(a.scheduledTime) >= new Date())
        .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))[0] || null,
    [appointments]
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📅 المواعيد</h1>
            <p className="text-sm text-gray-500 mt-1">{isDoctor ? 'إدارة مواعيدك' : 'إدارة طلبات الحجز'}</p>
          </div>

          {/* Status Filters */}
          <div className="flex gap-2 flex-wrap">
            {Object.keys(statusLabels).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                  filter === status
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {statusLabels[status]} ({stats[status] || 0})
              </button>
            ))}
          </div>
        </div>

        {/* Manual Booking Panel */}
        <ManualBookingPanel
          isDoctor={isDoctor}
          doctorProfile={doctorProfile}
          onCreated={() => {
            fetchAppointments();
            fetchDoctorProfile();
          }}
        />

        {/* Doctor Schedule Section */}
        {isDoctor && (
          <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">جدول العمل</h2>
                <p className="text-sm text-gray-500 mt-1">أيام وساعات عملك</p>
              </div>
              <button
                onClick={saveSchedule}
                disabled={savingSchedule || doctorLoading || !doctorProfile}
                className="px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingSchedule ? 'جاري...' : 'حفظ'}
              </button>
            </div>

            {doctorLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent"></div>
              </div>
            ) : !doctorProfile ? (
              <p className="text-sm text-red-600">لا يوجد ملف طبيب</p>
            ) : (
              <div className="space-y-2">
                {Object.keys(daysAr).map((day) => {
                  const isActive = !!doctorProfile?.workingHours?.[day];
                  return (
                    <div
                      key={day}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isActive ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => toggleDay(day)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="font-medium text-gray-900 w-24">{daysAr[day]}</span>
                      </label>
                      {isActive ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={doctorProfile?.workingHours?.[day]?.start || '09:00'}
                            onChange={(e) => updateWorkingHours(day, 'start', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <span className="text-gray-600">إلى</span>
                          <input
                            type="time"
                            value={doctorProfile?.workingHours?.[day]?.end || '17:00'}
                            onChange={(e) => updateWorkingHours(day, 'end', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">إجازة</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="إجمالي" value={stats.ALL || appointments.length} icon={CalendarIcon} />
          <StatCard title="قيد الانتظار" value={stats.PENDING || 0} icon={Clock} />
          <StatCard title="مؤكد" value={stats.CONFIRMED || 0} icon={CheckCircle} />
          <StatCard title="اليوم" value={todayAppointmentsCount} icon={User} />
        </div>

        {/* Appointments List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent"></div>
            </div>
          ) : appointments.length === 0 ? (
            <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
              <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">لا توجد مواعيد</p>
            </div>
          ) : (
            sortedDates.map((dateStr) => (
              <div key={dateStr} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-md">
                {/* Date Header */}
                <div className="bg-green-50 border-b border-green-200 px-6 py-3 flex items-center gap-3">
                  <div className="bg-green-500 text-white rounded-lg px-3 py-1.5 text-sm font-bold">
                    {format(parseISO(dateStr), 'dd MMM')}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{format(parseISO(dateStr), 'EEEE', { locale: ar })}</p>
                    <p className="text-xs text-gray-500">{format(parseISO(dateStr), 'dd/MM/yyyy')}</p>
                  </div>
                </div>

                {/* Appointments for this date */}
                <div className="divide-y divide-gray-200">
                  {groupedAppointments[dateStr].map((apt) => (
                    <div key={apt.id} className="p-4 hover:bg-gray-50 transition">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="bg-gray-100 rounded px-2 py-1 text-sm font-bold text-gray-900">
                              {format(parseISO(apt.scheduledTime), 'hh:mm')}
                            </span>
                            <StatusBadge status={apt.status} />
                          </div>
                          <p className="font-bold text-gray-900">{apt.patient?.name}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            📱 {apt.patient?.phone}
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                            <User className="h-3.5 w-3.5" />
                            <span>د. {apt.doctor?.name}</span>
                          </div>
                          {apt.service?.nameAr && (
                            <p className="text-xs text-gray-500 mt-1">{apt.service.nameAr}</p>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 flex-shrink-0">
                          {apt.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleAction(apt.id, 'confirm')}
                                className="px-3 py-1.5 rounded-lg bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200 transition"
                              >
                                تأكيد
                              </button>
                              <button
                                onClick={() => handleAction(apt.id, 'reject')}
                                className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200 transition"
                              >
                                رفض
                              </button>
                            </>
                          )}
                          {apt.status === 'CONFIRMED' && (
                            <>
                              <button
                                onClick={() => handleAction(apt.id, 'complete')}
                                className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200 transition"
                              >
                                تم
                              </button>
                              <button
                                onClick={() => handleAction(apt.id, 'cancel')}
                                className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200 transition"
                              >
                                إلغاء
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
