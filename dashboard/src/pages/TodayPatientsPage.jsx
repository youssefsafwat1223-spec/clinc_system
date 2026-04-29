import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Filter, RefreshCw, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import AppointmentCard from '../components/appointments/AppointmentCard';
import { DataCard, Field, PageHeader, PrimaryButton, StatCard, inputClass } from '../components/ui';
import { appointmentStatusLabels, todayInputValue } from '../utils/appointmentUi';

export default function TodayPatientsPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayInputValue());
  const [status, setStatus] = useState('ALL');
  const [doctorFilter, setDoctorFilter] = useState('ALL');

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/appointments', {
        params: {
          date,
          status: status === 'ALL' ? undefined : status,
          limit: 300,
        },
      });
      setAppointments(res.data.appointments || []);
    } catch (error) {
      toast.error(error.message || 'فشل تحميل مرضى اليوم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [date, status]);

  const doctors = useMemo(() => {
    const map = new Map();
    appointments.forEach((appointment) => {
      if (appointment.doctor?.id) map.set(appointment.doctor.id, appointment.doctor.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [appointments]);

  const filteredAppointments = appointments.filter((appointment) =>
    doctorFilter === 'ALL' ? true : appointment.doctorId === doctorFilter
  );

  const stats = useMemo(
    () => ({
      total: appointments.length,
      pending: appointments.filter((item) => item.status === 'PENDING').length,
      confirmed: appointments.filter((item) => item.status === 'CONFIRMED').length,
      completed: appointments.filter((item) => item.status === 'COMPLETED').length,
    }),
    [appointments]
  );

  return (
    <AppLayout>
      <PageHeader
        title="مرضى اليوم"
        description="عرض كل مواعيد اليوم بكل الحالات، مع فلترة سريعة حسب الحالة والطبيب."
        actions={
          <PrimaryButton type="button" onClick={loadAppointments} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            تحديث
          </PrimaryButton>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="إجمالي اليوم" value={stats.total} icon={Users} tone="blue" />
        <StatCard title="قيد الانتظار" value={stats.pending} icon={CalendarDays} tone="amber" />
        <StatCard title="مؤكد" value={stats.confirmed} icon={CalendarDays} tone="green" />
        <StatCard title="تم الكشف" value={stats.completed} icon={CalendarDays} tone="slate" />
      </div>

      <DataCard className="mb-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="التاريخ">
            <input className={inputClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="الحالة">
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
              {['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'BLOCKED'].map((item) => (
                <option key={item} value={item}>{appointmentStatusLabels[item]}</option>
              ))}
            </select>
          </Field>
          <Field label="الطبيب">
            <select className={inputClass} value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)}>
              <option value="ALL">كل الأطباء</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>د. {doctor.name}</option>
              ))}
            </select>
          </Field>
        </div>
      </DataCard>

      {loading ? (
        <DataCard>جاري تحميل مرضى اليوم...</DataCard>
      ) : filteredAppointments.length === 0 ? (
        <DataCard className="text-center">
          <Filter className="mx-auto mb-3 h-10 w-10 text-slate-500" />
          لا توجد مواعيد مطابقة للفلاتر الحالية.
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
