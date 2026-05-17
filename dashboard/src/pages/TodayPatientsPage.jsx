import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Filter, RefreshCw, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import AppointmentCard from '../components/appointments/AppointmentCard';
import ManualBookingPanel from '../components/appointments/ManualBookingPanel';
import { DataCard, Field, PageHeader, PageLoader, PrimaryButton, StatCard, inputClass } from '../components/ui';
import EmptyState from '../components/EmptyState';
import { appointmentStatusLabels, todayInputValue } from '../utils/appointmentUi';
import {
  buildRecentMonthOptions,
  calendarFilterOptions,
  getMonthWeekOptions,
  isWithinCalendarFilter,
} from '../utils/dateFilters';

const monthOptions = buildRecentMonthOptions();
const todayFirstFilterOptions = [
  ...calendarFilterOptions.filter((option) => option.value === 'today'),
  ...calendarFilterOptions.filter((option) => option.value !== 'today'),
];

export default function TodayPatientsPage() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('today');
  const [selectedDate, setSelectedDate] = useState(todayInputValue());
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value || '');
  const [selectedWeek, setSelectedWeek] = useState('1');
  const [status, setStatus] = useState('ALL');
  const [doctorFilter, setDoctorFilter] = useState('ALL');

  // Local (not UTC) YYYY-MM-DD so "today" matches the user's calendar day.
  const localDateValue = (date = new Date()) => {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  // For single-day filters, push the date to the server so the 500-row cap
  // (ordered by scheduledTime desc) can't hide the matching appointments.
  const serverDate =
    dateRange === 'today' ? localDateValue() : dateRange === 'day' ? selectedDate : '';

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/appointments', {
        params: {
          status: status === 'ALL' ? undefined : status,
          date: serverDate || undefined,
          limit: 500,
        },
      });
      setAppointments(res.data.appointments || []);
    } catch (error) {
      toast.error(error.message || 'فشل تحميل المرضى');
    } finally {
      setLoading(false);
    }
  };

  const handleQueueChange = async (appointment, position, mode) => {
    try {
      await api.patch(`/appointments/${appointment.id}/queue-position`, { position, mode });
      toast.success('تم تحديث دور المريض');
      await loadAppointments();
    } catch (error) {
      toast.error(error.message || 'فشل تحديث الدور');
    }
  };

  const handleQueueAssign = async (appointment) => {
    try {
      await api.post(`/appointments/${appointment.id}/check-in`);
      toast.success('تم تسجيل حضور المريض وإعطاؤه رقم الدور');
      await loadAppointments();
    } catch (error) {
      toast.error(error.message || 'فشل إضافة الدور');
    }
  };

  const handleEnterRoom = async (appointment) => {
    try {
      await api.post(`/appointments/${appointment.id}/enter-room`);
      toast.success('تم إدخال المريض للطبيب');
      await loadAppointments();
    } catch (error) {
      toast.error(error.message || 'فشل تحديث حالة المريض');
    }
  };

  const updateAppointmentStatus = async (appointment, action, successMessage) => {
    try {
      await api.post(`/appointments/${appointment.id}/${action}`);
      toast.success(successMessage);
      await loadAppointments();
    } catch (error) {
      toast.error(error.message || 'فشل تحديث الموعد');
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [status, serverDate]);

  const weekOptions = useMemo(() => getMonthWeekOptions(selectedMonth), [selectedMonth]);

  useEffect(() => {
    if (!weekOptions.some((option) => option.value === selectedWeek)) {
      setSelectedWeek(weekOptions[0]?.value || '1');
    }
  }, [selectedWeek, weekOptions]);

  const doctors = useMemo(() => {
    const map = new Map();
    appointments.forEach((appointment) => {
      if (appointment.doctor?.id) map.set(appointment.doctor.id, appointment.doctor.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [appointments]);

  const filteredAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => {
          const matchesDoctor = doctorFilter === 'ALL' ? true : appointment.doctorId === doctorFilter;
          const matchesDate = isWithinCalendarFilter(appointment.scheduledTime, dateRange, {
            exactDate: selectedDate,
            monthValue: selectedMonth,
            weekOfMonth: selectedWeek,
          });
          return matchesDoctor && matchesDate;
        })
        .sort((a, b) => {
          const statusRank = {
            IN_ROOM: 0,
            CHECKED_IN: 1,
            CONFIRMED: 2,
            PENDING: 3,
            COMPLETED: 4,
            NO_SHOW: 5,
            CANCELLED: 6,
            REJECTED: 7,
            BLOCKED: 8,
            EXPIRED: 9,
          };
          const rankDiff = (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99);
          if (rankDiff !== 0) return rankDiff;

          const aQ = a.queuePosition;
          const bQ = b.queuePosition;
          if (aQ != null && bQ != null) return aQ - bQ;
          if (aQ != null) return -1;
          if (bQ != null) return 1;
          // Then non-queued patients by appointment time.
          return new Date(a.scheduledTime) - new Date(b.scheduledTime);
        }),
    [appointments, doctorFilter, dateRange, selectedDate, selectedMonth, selectedWeek]
  );

  const stats = useMemo(
    () => ({
      total: filteredAppointments.length,
      booked: filteredAppointments.filter((item) => ['PENDING', 'CONFIRMED'].includes(item.status)).length,
      checkedIn: filteredAppointments.filter((item) => item.status === 'CHECKED_IN').length,
      inRoom: filteredAppointments.filter((item) => item.status === 'IN_ROOM').length,
      completed: filteredAppointments.filter((item) => item.status === 'COMPLETED').length,
    }),
    [filteredAppointments]
  );

  return (
    <AppLayout>
      <PageHeader
        title="مرضى اليوم"
        description="عرض مواعيد المرضى مع فلاتر سريعة حسب الفترة، الحالة، والطبيب."
        actions={
          <PrimaryButton type="button" onClick={loadAppointments} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            تحديث
          </PrimaryButton>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="إجمالي النتائج" value={stats.total} icon={Users} tone="blue" />
        <StatCard title="محجوز" value={stats.booked} icon={CalendarDays} tone="amber" />
        <StatCard title="تم الحضور" value={stats.checkedIn} icon={CalendarDays} tone="blue" />
        <StatCard title="داخل عند الطبيب" value={stats.inRoom} icon={CalendarDays} tone="green" />
        <StatCard title="تم الكشف" value={stats.completed} icon={CalendarDays} tone="slate" />
      </div>

      <DataCard className="mb-6">
        <ManualBookingPanel onCreated={loadAppointments} />
      </DataCard>

      <DataCard className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {todayFirstFilterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDateRange(option.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                dateRange === option.value
                  ? 'bg-cyan-500 text-white'
                  : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="الحالة">
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
              {['ALL', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_ROOM', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'REJECTED', 'BLOCKED'].map((item) => (
                <option key={item} value={item}>
                  {appointmentStatusLabels[item]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="الطبيب">
            <select className={inputClass} value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)}>
              <option value="ALL">كل الأطباء</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  د. {doctor.name}
                </option>
              ))}
            </select>
          </Field>

          {dateRange === 'day' ? (
            <Field label="اليوم المحدد">
              <input className={inputClass} type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </Field>
          ) : null}

          {dateRange === 'specificMonth' || dateRange === 'specificWeek' ? (
            <Field label="الشهر">
              <select className={inputClass} value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          {dateRange === 'specificWeek' ? (
            <Field label="أسبوع الشهر">
              <select className={inputClass} value={selectedWeek} onChange={(event) => setSelectedWeek(event.target.value)}>
                {weekOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>
      </DataCard>

      {loading ? (
        <DataCard>
          <PageLoader />
        </DataCard>
      ) : filteredAppointments.length === 0 ? (
        <DataCard>
          <EmptyState
            icon={Filter}
            title="لا توجد مواعيد مطابقة"
            description="لا توجد مواعيد مطابقة للفلاتر الحالية. جرب تغيير الفترة أو الحالة."
          />
        </DataCard>
      ) : (
        <div className="grid gap-4">
          {filteredAppointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              compact
              onOpenPatientProfile={(item) => item.patientId && navigate(`/patients/${item.patientId}`)}
              onCreatePrescription={(item) => item.patientId && navigate(`/prescriptions?patientId=${encodeURIComponent(item.patientId)}&appointmentId=${encodeURIComponent(item.id)}`)}
              onConfirm={(item) => updateAppointmentStatus(item, 'confirm', 'تم تأكيد الموعد')}
              onComplete={(item) => updateAppointmentStatus(item, 'complete', 'تم تسجيل الكشف')}
              onCheckIn={handleQueueAssign}
              onEnterRoom={handleEnterRoom}
              onNoShow={(item) => updateAppointmentStatus(item, 'no-show', 'تم تسجيل عدم الحضور')}
              onCancel={(item) => updateAppointmentStatus(item, 'cancel', 'تم إلغاء الموعد')}
              onQueueChange={handleQueueChange}
            />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
