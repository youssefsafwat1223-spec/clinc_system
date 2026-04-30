import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import AppointmentCard from '../components/appointments/AppointmentCard';
import { DataCard, Field, PageHeader, PrimaryButton, StatCard, StatusBadge, inputClass } from '../components/ui';
import { appointmentStatusLabels, appointmentStatusTone } from '../utils/appointmentUi';

const statusGuide = [
  {
    status: 'PENDING',
    title: 'قيد الانتظار',
    description: 'طلب حجز وصل من واتساب أو من النظام ولم يتم قبوله بعد. من هنا يتم قبوله أو رفضه.',
    action: 'لو قبلته يتحول إلى مؤكد، ولو رفضته يتحول إلى مرفوض ويتم إبلاغ المريض.',
  },
  {
    status: 'CONFIRMED',
    title: 'مؤكد',
    description: 'موعد تم قبوله وتثبيته في جدول الطبيب.',
    action: 'بعد حضور المريض والكشف عليه اضغط تم الكشف، أو ألغ الموعد لو حصل ظرف.',
  },
  {
    status: 'COMPLETED',
    title: 'تم الكشف',
    description: 'المريض حضر وتم الكشف عليه فعلاً.',
    action: 'هذه الحالة لا تتحول تلقائياً. لازم موظف أو طبيب يضغط تم الكشف.',
  },
  {
    status: 'CANCELLED',
    title: 'ملغي',
    description: 'موعد مؤكد تم إلغاؤه بعد التثبيت.',
    action: 'يفضل كتابة سبب الإلغاء عشان يظهر في السجل ويتم إبلاغ المريض.',
  },
  {
    status: 'REJECTED',
    title: 'مرفوض',
    description: 'طلب حجز لم يتم قبوله من الأساس.',
    action: 'استخدمها لو الموعد أو الخدمة غير مناسبين أو لا يوجد توفر.',
  },
  {
    status: 'EXPIRED',
    title: 'منتهي',
    description: 'طلب حجز ظل قيد الانتظار ولم يتم تأكيده قبل انتهاء مدة القفل.',
    action: 'يتحول تلقائياً بواسطة السيرفر لطلبات PENDING فقط، وليس للمواعيد المؤكدة.',
  },
  {
    status: 'BLOCKED',
    title: 'مغلق',
    description: 'وقت مغلق في جدول الطبيب وليس موعد مريض.',
    action: 'يستخدم لحجب وقت من الجدول حتى لا يتم الحجز فيه.',
  },
];

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
        <div className="mb-4">
          <h2 className="text-lg font-black text-white">شرح حالات الطلبات والمواعيد</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            هذه الصفحة مخصصة لتشغيل اليوم: قبول طلبات الحجز، رفضها، إلغاء المواعيد المؤكدة، وتسجيل أن الكشف تم بعد حضور المريض.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {statusGuide.map((item) => (
            <div key={item.status} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-black text-white">{item.title}</h3>
                <StatusBadge tone={appointmentStatusTone[item.status]}>{appointmentStatusLabels[item.status]}</StatusBadge>
              </div>
              <p className="text-sm leading-6 text-slate-300">{item.description}</p>
              <p className="mt-2 text-xs leading-6 text-slate-500">{item.action}</p>
            </div>
          ))}
        </div>
      </DataCard>

      <DataCard className="mb-6">
        <Field label="عرض حسب الحالة">
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            {['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'BLOCKED', 'ALL'].map((item) => (
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
