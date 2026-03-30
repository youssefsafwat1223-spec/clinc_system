import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { toast } from 'react-toastify';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AlertCircle, Calendar as CalendarIcon, CheckCircle, Clock, Save, User, XCircle } from 'lucide-react';
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

export default function AppointmentsPage() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isDoctor = user.role === 'DOCTOR';

  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({
    ALL: 0,
    PENDING: 0,
    CONFIRMED: 0,
    RESCHEDULED: 0,
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
      if (resStats.data && typeof resStats.data === 'object' && Object.keys(resStats.data).length > 0) {
        setStats((prev) => ({ ...prev, ...resStats.data }));
      }
    } catch (error) {
      console.error(error);
      toast.error('فشل في تحميل المواعيد');
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctorProfile = async () => {
    if (!isDoctor) {
      return;
    }

    try {
      setDoctorLoading(true);
      const res = await api.get('/doctors/me');
      setDoctorProfile(res.data.doctor || null);
    } catch (error) {
      toast.error(error.message || 'فشل في تحميل جدول الطبيب');
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
        toast.success('تم تأكيد الموعد وإرسال رسالة للمريض');
      } else if (action === 'block') {
        if (!window.confirm('هل أنت متأكد من إغلاق هذا الموعد نهائيًا؟')) return;
        await api.post(`/appointments/${id}/block`);
        toast.success('تم إغلاق الموعد ومنع الحجز فيه');
      } else {
        const reason = prompt('سبب الرفض (اختياري):');
        if (reason === null) return;
        await api.post(`/appointments/${id}/reject`, { reason });
        toast.success('تم رفض الموعد واقتراح بدائل للمريض');
      }
      fetchAppointments();
    } catch (error) {
      toast.error(error.message || 'حدث خطأ أثناء تنفيذ الإجراء');
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
      toast.success('تم حفظ جدولك بنجاح');
      fetchAppointments();
    } catch (error) {
      toast.error(error.message || 'فشل في حفظ الجدول');
    } finally {
      setSavingSchedule(false);
    }
  };

  const StatusBadge = ({ status }) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="px-3 py-1 bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30 rounded-full text-xs font-bold inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> قيد الانتظار
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30 rounded-full text-xs font-bold inline-flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> مؤكد
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-3 py-1 bg-red-500/10 text-red-500 ring-1 ring-red-500/30 rounded-full text-xs font-bold inline-flex items-center gap-1">
            <XCircle className="w-3 h-3" /> مرفوض
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-3 py-1 bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/30 rounded-full text-xs font-bold inline-flex items-center gap-1">
            <XCircle className="w-3 h-3" /> ملغي من المريض
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="px-3 py-1 bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/30 rounded-full text-xs font-bold inline-flex items-center gap-1">
            منتهي
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="px-3 py-1 bg-neutral-800 text-neutral-400 ring-1 ring-neutral-700 rounded-full text-xs font-bold inline-flex items-center gap-1">
            <XCircle className="w-3 h-3" /> مغلق
          </span>
        );
      default:
        return null;
    }
  };

  const SummaryCard = ({ title, value, hint, icon: Icon, accentClass }) => (
    <div className={`glass-card p-5 border ${accentClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-dark-muted">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-white">{value}</p>
          <p className="text-xs font-medium text-slate-400">{hint}</p>
        </div>
        <div className="rounded-2xl bg-dark-bg/70 p-3">
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );

  const groupedAppointments = appointments.reduce((acc, appointment) => {
    const dateStr = format(parseISO(appointment.scheduledTime), 'yyyy-MM-dd');
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(appointment);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedAppointments).sort();
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const todayAppointmentsCount = useMemo(
    () => appointments.filter((appointment) => format(parseISO(appointment.scheduledTime), 'yyyy-MM-dd') === todayKey).length,
    [appointments, todayKey]
  );

  const nextAppointment = useMemo(
    () =>
      [...appointments]
        .filter((appointment) => new Date(appointment.scheduledTime) >= new Date())
        .sort((first, second) => new Date(first.scheduledTime).getTime() - new Date(second.scheduledTime).getTime())[0] || null,
    [appointments]
  );

  const activeWorkingDaysCount = useMemo(
    () => Object.values(doctorProfile?.workingHours || {}).filter(Boolean).length,
    [doctorProfile]
  );

  return (
    <AppLayout>
      <div className="space-y-6 fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {isDoctor ? 'مواعيدي وجدولي' : 'إدارة المواعيد'}
            </h1>
            <p className="text-dark-muted text-sm mt-1">
              {isDoctor ? 'إدارة مواعيدك وتحديد أيام عملك وإجازاتك' : 'مراجعة وتأكيد طلبات الحجز الواردة'}
            </p>
          </div>

          <div className="flex flex-wrap bg-dark-card/50 p-1 border border-dark-border rounded-xl backdrop-blur-md gap-1">
            {['ALL', 'PENDING', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'REJECTED', 'BLOCKED'].map((opt) => (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={`relative px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 ${
                  filter === opt
                    ? 'bg-primary-600 shadow-md text-white shadow-primary-500/20'
                    : 'text-dark-muted hover:text-white hover:bg-dark-border/50'
                }`}
              >
                {opt === 'ALL'
                  ? 'الكل'
                  : opt === 'PENDING'
                    ? 'قيد الانتظار'
                    : opt === 'CONFIRMED'
                      ? 'مؤكد'
                      : opt === 'RESCHEDULED'
                        ? 'معدل'
                        : opt === 'CANCELLED'
                          ? 'ملغي'
                          : opt === 'REJECTED'
                            ? 'مرفوض'
                            : 'مغلق'}

                {stats[opt] > 0 && (
                  <span
                    className={`absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full text-[9px] sm:text-[10px] font-bold text-white shadow-sm ring-2 ring-dark-bg ${
                      opt === 'PENDING'
                        ? 'bg-amber-500'
                        : opt === 'RESCHEDULED'
                          ? 'bg-sky-500'
                          : opt === 'CANCELLED' || opt === 'REJECTED'
                            ? 'bg-rose-500'
                            : opt === 'CONFIRMED'
                              ? 'bg-emerald-500'
                              : 'bg-primary-500'
                    }`}
                  >
                    {stats[opt] > 99 ? '99+' : stats[opt]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title={isDoctor ? 'إجمالي مواعيدي' : 'إجمالي المواعيد'}
            value={stats.ALL || appointments.length}
            hint={isDoctor ? 'تشمل كل الحالات المرتبطة بحسابك' : 'كل المواعيد داخل النظام'}
            icon={CalendarIcon}
            accentClass="border-primary-500/20"
          />
          <SummaryCard
            title="قيد الانتظار"
            value={stats.PENDING || 0}
            hint="تحتاج تأكيدًا أو رفضًا"
            icon={Clock}
            accentClass="border-amber-500/20"
          />
          <SummaryCard
            title="المواعيد المؤكدة"
            value={stats.CONFIRMED || 0}
            hint="جاهزة للتنفيذ"
            icon={CheckCircle}
            accentClass="border-emerald-500/20"
          />
          <SummaryCard
            title={isDoctor ? 'مواعيد اليوم' : 'الحركة الحالية'}
            value={todayAppointmentsCount}
            hint={
              nextAppointment
                ? `التالي ${format(parseISO(nextAppointment.scheduledTime), 'hh:mm a', { locale: ar })}`
                : isDoctor
                  ? `${activeWorkingDaysCount} يوم عمل مفعل`
                  : 'لا يوجد موعد قادم الآن'
            }
            icon={User}
            accentClass="border-sky-500/20"
          />
        </section>

        <ManualBookingPanel
          isDoctor={isDoctor}
          doctorProfile={doctorProfile}
          onCreated={() => {
            fetchAppointments();
            fetchDoctorProfile();
          }}
        />

        {isDoctor && (
          <section className="glass-card p-6 md:p-8 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">جدول العمل الخاص بك</h2>
                <p className="text-sm text-dark-muted mt-1">
                  أي يوم تغلقه هنا لن يظهر فيه حجز جديد لك من النظام أو من البوت.
                </p>
              </div>
              <button onClick={saveSchedule} disabled={savingSchedule || doctorLoading || !doctorProfile} className="btn-primary">
                {savingSchedule ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                حفظ الجدول
              </button>
            </div>

            <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-primary-400 mt-0.5 shrink-0" />
              <p className="text-sm text-primary-100">
                عدل أيام العمل لكل أسبوع من حسابك مباشرة. زميلك الدكتور سيعدل جدوله هو فقط من حسابه، ولن يؤثر ذلك على جدولك.
              </p>
            </div>

            {doctorLoading ? (
              <div className="flex h-32 items-center justify-center">
                <span className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></span>
              </div>
            ) : !doctorProfile ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                لا يوجد ملف طبيب مرتبط بهذا الحساب.
              </div>
            ) : (
              <div className="space-y-3">
                {Object.keys(daysAr).map((day) => {
                  const isActive = !!doctorProfile?.workingHours?.[day];

                  return (
                    <div
                      key={day}
                      className={`flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl border transition-colors ${
                        isActive
                          ? 'bg-dark-bg/50 border-dark-border'
                          : 'bg-dark-bg/20 border-dark-border/30 opacity-70'
                      }`}
                    >
                      <label className="flex flex-1 items-center gap-3 cursor-pointer">
                        <div className="relative flex items-center">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => toggleDay(day)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-dark-card border border-dark-border rounded-full peer peer-checked:bg-primary-500 transition-colors"></div>
                          <div className="absolute left-1 top-1 w-4 h-4 bg-dark-muted rounded-full transition-transform peer-checked:translate-x-5 peer-checked:bg-white"></div>
                        </div>
                        <span className="font-bold text-white w-24">{daysAr[day]}</span>
                      </label>

                      {isActive ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={doctorProfile?.workingHours?.[day]?.start || '09:00'}
                            onChange={(e) => updateWorkingHours(day, 'start', e.target.value)}
                            className="input-field py-1"
                          />
                          <span className="text-dark-muted">إلى</span>
                          <input
                            type="time"
                            value={doctorProfile?.workingHours?.[day]?.end || '17:00'}
                            onChange={(e) => updateWorkingHours(day, 'end', e.target.value)}
                            className="input-field py-1"
                          />
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-dark-muted">إجازة</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-t-2 border-primary-500 animate-spin"></div>
              <div
                className="absolute inset-2 rounded-full border-r-2 border-primary-400 animate-spin opacity-75 inline-block"
                style={{ animationDuration: '1.5s' }}
              ></div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {appointments.length === 0 ? (
              <div className="glass-card p-16 text-center flex flex-col items-center justify-center fade-in">
                <CalendarIcon className="w-12 h-12 text-dark-muted mb-4 opacity-50" />
                <p className="text-lg font-medium text-slate-300">لا توجد مواعيد متاحة</p>
                <p className="text-sm text-dark-muted mt-2">جرّب تغيير حالة الفلتر من الأعلى</p>
              </div>
            ) : (
              sortedDates.map((dateStr, dIndex) => (
                <div key={dateStr} className="relative fade-in" style={{ animationDelay: `${dIndex * 0.1}s` }}>
                  <div className="sticky top-0 z-10 flex items-center gap-4 mb-4 bg-dark-bg/90 backdrop-blur-md py-3 px-2 rounded-xl border border-dark-border/50 shadow-sm">
                    <div className="w-12 h-12 rounded-2xl bg-primary-900/40 border border-primary-500/30 flex flex-col items-center justify-center shrink-0">
                      <span className="text-base font-bold text-primary-400 leading-none">{format(parseISO(dateStr), 'dd')}</span>
                      <span className="text-[10px] text-primary-300 uppercase leading-none mt-1">{format(parseISO(dateStr), 'MMM')}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{format(parseISO(dateStr), 'EEEE', { locale: ar })}</h3>
                      <p className="text-xs text-dark-muted font-sans" dir="ltr">
                        {format(parseISO(dateStr), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 pl-6 rtl:pl-0 rtl:pr-8 border-l-2 rtl:border-l-0 rtl:border-r-2 border-dark-border/60 ml-6 rtl:ml-0 rtl:mr-6 py-2">
                    {groupedAppointments[dateStr].map((apt, index) => (
                      <div
                        key={apt.id}
                        className="glass-card p-5 relative group border hover:border-primary-500/30 transition-all shadow-sm flex flex-col sm:flex-row gap-5 sm:items-center justify-between"
                        style={{ animationDelay: `${(dIndex + index) * 0.05}s` }}
                      >
                        <div className="absolute top-1/2 -translate-y-1/2 -right-[35px] w-4 h-4 rounded-full bg-dark-bg border-4 border-primary-500/60 shadow-[0_0_12px_rgba(var(--color-primary-500),0.4)] z-10 transition-transform group-hover:scale-125"></div>

                        <div className="flex items-center gap-5 md:w-1/3 shrink-0">
                          <div className="flex flex-col items-center justify-center bg-dark-bg/60 rounded-xl p-3 border border-dark-border min-w-[85px] group-hover:bg-primary-900/20 group-hover:border-primary-500/20 transition-colors">
                            <span className="text-lg font-bold text-white font-sans tracking-wide" dir="ltr">
                              {format(parseISO(apt.scheduledTime), 'hh:mm')}
                            </span>
                            <span className="text-xs font-semibold text-primary-400 font-sans mt-0.5">
                              {format(parseISO(apt.scheduledTime), 'a')}
                            </span>
                          </div>

                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-base truncate pr-1">{apt.patient?.name}</span>
                              {apt.notes && apt.notes.includes('تأجيل') && (
                                <span
                                  className="text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded font-bold"
                                  title="تم تعديل هذا الموعد بواسطة المريض"
                                >
                                  معدل
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-sans text-dark-muted mt-0.5" dir="ltr">
                              {apt.patient?.phone}
                            </span>
                            <span className="text-[10px] inline-block mt-1.5 font-bold text-slate-400 bg-dark-bg/60 px-2.5 py-1 rounded w-max uppercase tracking-wider border border-dark-border">
                              REF: {apt.bookingRef}
                            </span>

                            {apt.notes && apt.notes.includes('تأجيل') && (
                              <div className="mt-2 text-xs font-medium text-sky-400/90 bg-sky-500/10 p-2 rounded-lg border border-sky-500/20 w-fit shrink-0 max-w-full">
                                {apt.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 flex flex-col justify-center px-2">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(var(--color-primary-500),0.6)]"></div>
                            <span className="text-sm font-semibold text-slate-200">{apt.service?.nameAr}</span>
                          </div>
                          <p className="text-xs text-dark-muted flex items-center gap-1.5 opacity-80">
                            <User className="w-3.5 h-3.5" /> د. {apt.doctor?.name}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 shrink-0 sm:w-1/4 justify-end">
                          <StatusBadge status={apt.status} />

                          {apt.status === 'PENDING' && (
                            <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all absolute top-4 left-4 sm:relative sm:top-0 sm:left-0 bg-dark-card/95 sm:bg-transparent p-1.5 sm:p-0 rounded-xl shadow-xl sm:shadow-none border border-dark-border sm:border-0 backdrop-blur-md sm:backdrop-blur-none z-20">
                              <button
                                onClick={() => handleAction(apt.id, 'confirm')}
                                className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all hover:scale-110 hover:shadow-lg hover:shadow-emerald-500/20"
                                title="تأكيد الموعد وإرسال رسالة"
                              >
                                <CheckCircle className="w-4.5 h-4.5" />
                              </button>
                              <button
                                onClick={() => handleAction(apt.id, 'reject')}
                                className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white flex items-center justify-center transition-all hover:scale-110 hover:shadow-lg hover:shadow-amber-500/20"
                                title="رفض واقتراح موعد بديل"
                              >
                                <XCircle className="w-4.5 h-4.5" />
                              </button>
                              <button
                                onClick={() => handleAction(apt.id, 'block')}
                                className="w-9 h-9 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all hover:scale-110 hover:shadow-lg hover:shadow-red-500/20"
                                title="إغلاق التوقيت لهذا الموعد"
                              >
                                <Clock className="w-4.5 h-4.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
