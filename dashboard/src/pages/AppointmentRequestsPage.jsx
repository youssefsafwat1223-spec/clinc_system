import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import AppointmentCard from '../components/appointments/AppointmentCard';
import { DataCard, Field, PageHeader, PrimaryButton, StatCard, inputClass } from '../components/ui';
import { appointmentStatusLabels } from '../utils/appointmentUi';

export default function AppointmentRequestsPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('PENDING');

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/appointments', {
        params: {
          status: status === 'ALL' ? undefined : status,
          limit: 300,
        },
      });
      setAppointments(res.data.appointments || []);
    } catch (error) {
      toast.error(error.message || 'فشل تحميل طلبات الحجز');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [status]);

  const runAction = async (appointment, action) => {
    try {
      if (action === 'confirm') {
        await api.post(`/appointments/${appointment.id}/confirm`);
        toast.success('تم قبول وتأكيد الموعد');
      }
      if (action === 'reject') {
        const reason = window.prompt('سبب رفض الطلب:');
        if (reason === null) return;
        await api.post(`/appointments/${appointment.id}/reject`, { reason });
        toast.success('تم رفض الطلب');
      }
      if (action === 'complete') {
        if (!window.confirm('هل تم الكشف على المريض؟')) return;
        await api.post(`/appointments/${appointment.id}/complete`);
        toast.success('تم تسجيل الكشف');
      }
      if (action === 'cancel') {
        const reason = window.prompt('سبب الإلغاء:');
        if (reason === null) return;
        await api.post(`/appointments/${appointment.id}/cancel`, { reason });
        toast.success('تم إلغاء الموعد');
      }
      loadAppointments();
    } catch (error) {
      toast.error(error.message || 'تعذر تنفيذ العملية');
    }
  };

  const stats = useMemo(
    () => ({
      pending: appointments.filter((item) => item.status === 'PENDING').length,
      confirmed: appointments.filter((item) => item.status === 'CONFIRMED').length,
      completed: appointments.filter((item) => item.status === 'COMPLETED').length,
      rejected: appointments.filter((item) => ['REJECTED', 'CANCELLED'].includes(item.status)).length,
    }),
    [appointments]
  );

  return (
    <AppLayout>
      <PageHeader
        title="قبول الطلبات والكشف"
        description="صفحة تشغيل منفصلة لقبول طلبات الحجز، رفضها، إلغاء المؤكد، وتسجيل أن الكشف تم."
        actions={
          <PrimaryButton type="button" onClick={loadAppointments} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            تحديث
          </PrimaryButton>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="طلبات معلقة" value={stats.pending} icon={Clock} tone="amber" />
        <StatCard title="مواعيد مؤكدة" value={stats.confirmed} icon={CheckCircle} tone="green" />
        <StatCard title="تم الكشف" value={stats.completed} icon={CheckCircle} tone="blue" />
        <StatCard title="مرفوض / ملغي" value={stats.rejected} icon={XCircle} tone="red" />
      </div>

      <DataCard className="mb-6">
        <Field label="عرض حسب الحالة">
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            {['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'ALL'].map((item) => (
              <option key={item} value={item}>{appointmentStatusLabels[item]}</option>
            ))}
          </select>
        </Field>
      </DataCard>

      {loading ? (
        <DataCard>جاري تحميل الطلبات...</DataCard>
      ) : appointments.length === 0 ? (
        <DataCard className="text-center">لا توجد طلبات في هذا التصنيف.</DataCard>
      ) : (
        <div className="grid gap-4">
          {appointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onConfirm={(item) => runAction(item, 'confirm')}
              onReject={(item) => runAction(item, 'reject')}
              onComplete={(item) => runAction(item, 'complete')}
              onCancel={(item) => runAction(item, 'cancel')}
            />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
