import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Filter, RefreshCw, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import AppointmentCard from '../components/appointments/AppointmentCard';
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
      appointments.filter((appointment) => {
        const matchesDoctor = doctorFilter === 'ALL' ? true : appointment.doctorId === doctorFilter;
        const matchesDate = isWithinCalendarFilter(appointment.scheduledTime, dateRange, {
          exactDate: selectedDate,
          monthValue: selectedMonth,
          weekOfMonth: selectedWeek,
        });
        return matchesDoctor && matchesDate;
      }),
    [appointments, doctorFilter, dateRange, selectedDate, selectedMonth, selectedWeek]
  );

  const stats = useMemo(
    () => ({
      total: filteredAppointments.length,
      pending: filteredAppointments.filter((item) => item.status === 'PENDING').length,
      confirmed: filteredAppointments.filter((item) => item.status === 'CONFIRMED').length,
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

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="إجمالي النتائج" value={stats.total} icon={Users} tone="blue" />
        <StatCard title="قيد الانتظار" value={stats.pending} icon={CalendarDays} tone="amber" />
        <StatCard title="مؤكد" value={stats.confirmed} icon={CalendarDays} tone="green" />
        <StatCard title="تم الكشف" value={stats.completed} icon={CalendarDays} tone="slate" />
      </div>

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
              {['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'REJECTED', 'BLOCKED'].map((item) => (
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
            <AppointmentCard key={appointment.id} appointment={appointment} compact />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
