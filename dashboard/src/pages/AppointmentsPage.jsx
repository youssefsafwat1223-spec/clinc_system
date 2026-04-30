import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle, Clock, Save, UserRound } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import ManualBookingPanel from '../components/appointments/ManualBookingPanel';
import AppointmentCard from '../components/appointments/AppointmentCard';
import { DataCard, Field, PageHeader, PrimaryButton, SecondaryButton, StatCard, inputClass } from '../components/ui';
import { appointmentStatusLabels, formatDate } from '../utils/appointmentUi';

const daysAr = {
  sunday: 'الأحد',
  monday: 'الإثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
  saturday: 'السبت',
};

const statusOrder = ['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'BLOCKED'];

const dayKey = (value) => new Date(value).toISOString().slice(0, 10);

export default function AppointmentsPage() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isDoctor = user.role === 'DOCTOR';

  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [doctorLoading, setDoctorLoading] = useState(isDoctor);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const [appointmentsRes, statsRes] = await Promise.all([
        api.get('/appointments', { params: { status: filter === 'ALL' ? undefined : filter, limit: 100 } }),
        api.get('/appointments/stats').catch(() => ({ data: {} })),
      ]);
      setAppointments(appointmentsRes.data.appointments || []);
      setStats(statsRes.data || {});
    } catch (error) {
      toast.error('فشل تحميل المواعيد');
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
      toast.error('فشل تحميل جدول الطبيب');
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

  const handleAction = async (appointment, action) => {
    try {
      if (action === 'confirm') {
        await api.post(`/appointments/${appointment.id}/confirm`);
        toast.success('تم تأكيد الموعد');
      }

      if (action === 'complete') {
        if (!window.confirm('هل تم الكشف على المريض؟')) return;
        await api.post(`/appointments/${appointment.id}/complete`);
        toast.success('تم تسجيل الموعد كمكتمل');
      }

      if (action === 'cancel') {
        const reason = window.prompt('اكتب سبب الإلغاء:');
        if (reason === null) return;
        await api.post(`/appointments/${appointment.id}/cancel`, { reason });
        toast.success('تم إلغاء الحجز');
      }

      if (action === 'reject') {
        const reason = window.prompt('اكتب سبب الرفض:');
        if (reason === null) return;
        await api.post(`/appointments/${appointment.id}/reject`, { reason });
        toast.success('تم رفض الموعد');
      }

      fetchAppointments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'حدث خطأ أثناء تحديث الموعد');
    }
  };

  const updateWorkingHours = (day, field, value) => {
    setDoctorProfile((current) => ({
      ...current,
      workingHours: {
        ...(current?.workingHours || {}),
        [day]: {
          ...(current?.workingHours?.[day] || { start: '09:00', end: '17:00' }),
          [field]: value,
        },
      },
    }));
  };

  const toggleDay = (day) => {
    setDoctorProfile((current) => {
      const currentDay = current?.workingHours?.[day];
      return {
        ...current,
        workingHours: {
          ...(current?.workingHours || {}),
          [day]: currentDay ? null : { start: '09:00', end: '17:00' },
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
      toast.success('تم حفظ جدول العمل');
      fetchAppointments();
    } catch (error) {
      toast.error('فشل حفظ جدول العمل');
    } finally {
      setSavingSchedule(false);
    }
  };

  const todayAppointmentsCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return appointments.filter((appointment) => dayKey(appointment.scheduledTime) === today).length;
  }, [appointments]);

  const upcomingCount = useMemo(
    () => appointments.filter((appointment) => new Date(appointment.scheduledTime) >= new Date()).length,
    [appointments]
  );

  const groupedAppointments = useMemo(() => {
    return appointments
      .slice()
      .sort((first, second) => new Date(first.scheduledTime) - new Date(second.scheduledTime))
      .reduce((groups, appointment) => {
        const key = dayKey(appointment.scheduledTime);
        groups[key] = groups[key] || [];
        groups[key].push(appointment);
        return groups;
      }, {});
  }, [appointments]);

  return (
    <AppLayout>
      <PageHeader
        title="المواعيد"
        description={isDoctor ? 'إدارة مواعيدك وجدول عملك.' : 'إدارة طلبات الحجز والحجوزات اليدوية وحالات الموعد.'}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {statusOrder.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              filter === status
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {appointmentStatusLabels[status]} ({status === 'ALL' ? stats.ALL || appointments.length : stats[status] || 0})
          </button>
        ))}
      </div>

      <ManualBookingPanel
        isDoctor={isDoctor}
        doctorProfile={doctorProfile}
        onCreated={() => {
          fetchAppointments();
          fetchDoctorProfile();
        }}
      />

      {isDoctor ? (
        <DataCard className="mt-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black text-white">جدول العمل</h2>
              <p className="mt-1 text-sm text-slate-400">حدد أيام وساعات عملك ليتم إغلاق الحجز خارجها.</p>
            </div>
            <PrimaryButton type="button" onClick={saveSchedule} disabled={savingSchedule || doctorLoading || !doctorProfile}>
              <Save className="h-4 w-4" />
              {savingSchedule ? 'جاري الحفظ...' : 'حفظ الجدول'}
            </PrimaryButton>
          </div>

          {doctorLoading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-slate-300">جاري تحميل جدول الطبيب...</div>
          ) : !doctorProfile ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">لا يوجد ملف طبيب مرتبط بهذا الحساب.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(daysAr).map(([day, label]) => {
                const workingDay = doctorProfile?.workingHours?.[day];
                const isActive = Boolean(workingDay);
                return (
                  <div key={day} className="rounded-2xl border border-white/10 bg-[#0d1225] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <label className="flex items-center gap-3 text-sm font-black text-white">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => toggleDay(day)}
                          className="h-4 w-4 rounded border-white/20 bg-white/10"
                        />
                        {label}
                      </label>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${isActive ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-slate-400'}`}>
                        {isActive ? 'يعمل' : 'إجازة'}
                      </span>
                    </div>
                    {isActive ? (
                      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                        <Field label="من">
                          <input
                            className={inputClass}
                            type="time"
                            value={workingDay?.start || '09:00'}
                            onChange={(event) => updateWorkingHours(day, 'start', event.target.value)}
                          />
                        </Field>
                        <span className="pb-3 text-sm text-slate-400">إلى</span>
                        <Field label="إلى">
                          <input
                            className={inputClass}
                            type="time"
                            value={workingDay?.end || '17:00'}
                            onChange={(event) => updateWorkingHours(day, 'end', event.target.value)}
                          />
                        </Field>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </DataCard>
      ) : null}

      <div className="my-6 grid gap-4 md:grid-cols-4">
        <StatCard title="إجمالي المواعيد" value={stats.ALL || appointments.length} icon={CalendarDays} tone="blue" />
        <StatCard title="قيد الانتظار" value={stats.PENDING || 0} icon={Clock} tone="amber" />
        <StatCard title="مؤكد" value={stats.CONFIRMED || 0} icon={CheckCircle} tone="green" />
        <StatCard title="مواعيد اليوم" value={todayAppointmentsCount} hint={`${upcomingCount} موعد قادم`} icon={UserRound} tone="slate" />
      </div>

      {loading ? (
        <DataCard className="text-center text-slate-300">جاري تحميل المواعيد...</DataCard>
      ) : appointments.length === 0 ? (
        <DataCard className="text-center">
          <CalendarDays className="mx-auto mb-4 h-12 w-12 text-slate-500" />
          <h2 className="text-lg font-black text-white">لا توجد مواعيد</h2>
          <p className="mt-2 text-sm text-slate-400">غيّر الفلتر أو أنشئ موعداً يدوياً من لوحة الحجز بالأعلى.</p>
        </DataCard>
      ) : (
        <div className="space-y-5">
          {Object.entries(groupedAppointments).map(([date, list]) => (
            <section key={date} className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <h2 className="text-base font-black text-white">{formatDate(date)}</h2>
                  <p className="text-xs text-slate-400">{list.length} موعد في هذا اليوم</p>
                </div>
                <SecondaryButton type="button" onClick={() => setFilter('ALL')}>
                  عرض الكل
                </SecondaryButton>
              </div>
              <div className="grid gap-3">
                {list.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    onConfirm={(item) => handleAction(item, 'confirm')}
                    onReject={(item) => handleAction(item, 'reject')}
                    onComplete={(item) => handleAction(item, 'complete')}
                    onCancel={(item) => handleAction(item, 'cancel')}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
