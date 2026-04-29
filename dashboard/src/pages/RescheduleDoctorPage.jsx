import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import AppLayout from '../components/Layout';
import api from '../api/client';
import { DataCard, Field, PageHeader, PrimaryButton, SecondaryButton, StatusBadge, inputClass } from '../components/ui';

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function RescheduleDoctorPage() {
  const [doctors, setDoctors] = useState([]);
  const [fromDoctorId, setFromDoctorId] = useState('');
  const [toDoctorId, setToDoctorId] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    const loadDoctors = async () => {
      try {
        const res = await api.get('/doctors');
        setDoctors(res.data.doctors || []);
      } catch {
        toast.error('فشل تحميل الأطباء');
      }
    };
    loadDoctors();
  }, []);

  const loadPreview = async () => {
    if (!fromDoctorId || !toDoctorId || fromDoctorId === toDoctorId) {
      toast.warn('اختر طبيبين مختلفين');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/appointments/reschedule-doctor/preview', { fromDoctorId, toDoctorId });
      setPreview(res.data);
    } catch (error) {
      toast.error(error.message || 'فشل تجهيز المعاينة');
    } finally {
      setLoading(false);
    }
  };

  const commit = async () => {
    if (!preview?.canProceed) {
      toast.warn('لا يمكن التنفيذ قبل حل التعارضات');
      return;
    }

    setCommitting(true);
    try {
      await api.post('/appointments/reschedule-doctor', { fromDoctorId, toDoctorId, notifyPatient: true });
      toast.success('تم نقل المواعيد وإرسال إشعار واتساب');
      setPreview(null);
    } catch (error) {
      toast.error(error.message || 'فشل نقل المواعيد');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="إعادة جدولة طبيب"
        description="انقل مواعيد طبيب إلى طبيب بديل بعد مراجعة التعارضات. لا يتم التنفيذ إلا بعد التأكيد."
      />

      <DataCard className="mb-6">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <Field label="الطبيب الحالي">
            <select className={inputClass} value={fromDoctorId} onChange={(event) => setFromDoctorId(event.target.value)}>
              <option value="">اختر الطبيب</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name} - {doctor.specialization}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الطبيب البديل">
            <select className={inputClass} value={toDoctorId} onChange={(event) => setToDoctorId(event.target.value)}>
              <option value="">اختر الطبيب البديل</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name} - {doctor.specialization}
                </option>
              ))}
            </select>
          </Field>
          <PrimaryButton type="button" onClick={loadPreview} disabled={loading} className="self-end">
            <Search className="h-4 w-4" />
            معاينة
          </PrimaryButton>
        </div>
      </DataCard>

      {loading && <DataCard>جاري فحص المواعيد...</DataCard>}

      {preview && (
        <div className="space-y-6">
          <DataCard>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">المعاينة قبل التنفيذ</h2>
                <p className="mt-1 text-sm text-gray-500">
                  من {preview.fromDoctor?.name} إلى {preview.toDoctor?.name}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone={preview.canProceed ? 'green' : 'red'}>
                  {preview.canProceed ? 'جاهز للتنفيذ' : 'يوجد تعارضات'}
                </StatusBadge>
                <StatusBadge tone="blue">{preview.affectedAppointments || 0} موعد متأثر</StatusBadge>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <PrimaryButton type="button" onClick={commit} disabled={!preview.canProceed || committing}>
                <RefreshCw className="h-4 w-4" />
                تنفيذ النقل وإشعار المرضى
              </PrimaryButton>
              <SecondaryButton type="button" onClick={loadPreview}>إعادة الفحص</SecondaryButton>
            </div>
          </DataCard>

          <div className="grid gap-4">
            {(preview.appointments || []).map((appointment) => (
              <DataCard key={appointment.id}>
                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {appointment.targetDoctorAvailable ? (
                        <StatusBadge tone="green"><CheckCircle2 className="ml-1 inline h-3 w-3" /> متاح</StatusBadge>
                      ) : (
                        <StatusBadge tone="red"><AlertTriangle className="ml-1 inline h-3 w-3" /> تعارض</StatusBadge>
                      )}
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-mono text-gray-600">{appointment.id}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{appointment.patient?.name || '-'}</h3>
                    <p className="text-sm text-gray-500">{appointment.patient?.phone || '-'} - {formatDate(appointment.scheduledTime)}</p>
                    <p className="mt-1 text-sm text-gray-600">{appointment.service?.nameAr || appointment.service?.name || '-'}</p>
                  </div>
                  <StatusBadge tone={appointment.status === 'CONFIRMED' ? 'green' : 'amber'}>{appointment.status}</StatusBadge>
                </div>
              </DataCard>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
