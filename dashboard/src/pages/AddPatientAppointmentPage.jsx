import { useEffect, useState } from 'react';
import { CalendarPlus, UserPlus } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import ManualBookingPanel from '../components/appointments/ManualBookingPanel';
import { DataCard, PageHeader, StatCard } from '../components/ui';

export default function AddPatientAppointmentPage() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isDoctor = user.role === 'DOCTOR';
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [createdCount, setCreatedCount] = useState(0);

  useEffect(() => {
    if (!isDoctor) return;
    let cancelled = false;
    api.get('/doctors/me')
      .then((res) => {
        if (!cancelled) setDoctorProfile(res.data.doctor || null);
      })
      .catch(() => toast.error('فشل تحميل بيانات الطبيب'));

    return () => {
      cancelled = true;
    };
  }, [isDoctor]);

  return (
    <AppLayout>
      <PageHeader
        title="إضافة مريض / موعد"
        description="استخدم هذه الصفحة لإنشاء مريض جديد أو اختيار مريض موجود ثم تسجيل موعد مباشر."
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <StatCard title="مريض جديد أو موجود" value="خطوة واحدة" hint="ابحث أو أنشئ ملف المريض أولاً" icon={UserPlus} tone="blue" />
        <StatCard title="المواعيد المنشأة في هذه الجلسة" value={createdCount} hint="عداد محلي للمتابعة السريعة" icon={CalendarPlus} tone="green" />
      </div>

      <DataCard>
        <ManualBookingPanel
          isDoctor={isDoctor}
          doctorProfile={doctorProfile}
          onCreated={() => setCreatedCount((count) => count + 1)}
        />
      </DataCard>
    </AppLayout>
  );
}
