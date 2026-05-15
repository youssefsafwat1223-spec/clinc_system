import { useEffect, useMemo, useState } from 'react';
import { Edit3, Save, Stethoscope, X } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { DataCard, PageHeader, PageLoader, PrimaryButton, SecondaryButton, StatusBadge, inputClass } from '../components/ui';

export default function DoctorTasksPage() {
  const [doctors, setDoctors] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [selectedTreatmentIds, setSelectedTreatmentIds] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [doctorsRes, treatmentsRes] = await Promise.all([api.get('/doctors'), api.get('/treatments')]);
      setDoctors(doctorsRes.data.doctors || []);
      setTreatments(treatmentsRes.data.services || treatmentsRes.data.treatments || []);
    } catch (error) {
      toast.error(error.message || 'فشل تحميل مهام الأطباء');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openEditor = (doctor) => {
    setEditingDoctor(doctor);
    setSelectedTreatmentIds((doctor.tasks || []).map((task) => task.serviceId));
  };

  const toggleTreatment = (id) => {
    setSelectedTreatmentIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const saveTasks = async () => {
    if (!editingDoctor) return;
    setSaving(true);
    try {
      const res = await api.put(`/doctors/${editingDoctor.id}/tasks`, { treatmentIds: selectedTreatmentIds });
      const updatedDoctor = res.data.doctor;
      setDoctors((current) => current.map((doctor) => (doctor.id === updatedDoctor.id ? updatedDoctor : doctor)));
      setEditingDoctor(null);
      toast.success('تم حفظ مهام الطبيب');
    } catch (error) {
      toast.error(error.message || 'فشل حفظ مهام الطبيب');
    } finally {
      setSaving(false);
    }
  };

  const treatmentMap = useMemo(
    () => Object.fromEntries(treatments.map((treatment) => [treatment.id, treatment.nameAr || treatment.name])),
    [treatments]
  );

  return (
    <AppLayout>
      <PageHeader
        title="مهام الأطباء"
        description="حدد أنواع العلاجات التي يستطيع كل طبيب العمل عليها. الطبيب بدون مهام محددة يظهر كمتاح لكل الخدمات."
      />

      {loading ? (
        <DataCard><PageLoader label="جاري تحميل البيانات..." /></DataCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {doctors.map((doctor) => {
            const tasks = doctor.tasks || [];
            return (
              <DataCard key={doctor.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
                      <Stethoscope className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-white">د. {doctor.name}</h2>
                      <p className="mt-1 text-sm text-slate-400">{doctor.specialization || 'بدون تخصص'}</p>
                    </div>
                  </div>
                  <SecondaryButton type="button" onClick={() => openEditor(doctor)}>
                    <Edit3 className="h-4 w-4" />
                    تعديل
                  </SecondaryButton>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {tasks.length ? (
                    tasks.map((task) => (
                      <StatusBadge key={task.id} tone="blue">
                        {task.service?.nameAr || task.service?.name || treatmentMap[task.serviceId] || 'علاج'}
                      </StatusBadge>
                    ))
                  ) : (
                    <StatusBadge tone="green">كل الخدمات</StatusBadge>
                  )}
                </div>
              </DataCard>
            );
          })}
        </div>
      )}

      {editingDoctor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0b1224] p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-white">تعديل مهام د. {editingDoctor.name}</h2>
                <p className="mt-1 text-sm text-slate-400">اختيارك هنا يؤثر على ظهور الطبيب في الحجز حسب الخدمة.</p>
              </div>
              <button type="button" className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10" onClick={() => setEditingDoctor(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[55vh] space-y-2 overflow-auto rounded-2xl border border-white/10 p-3">
              {treatments.map((treatment) => (
                <label key={treatment.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-white/[0.03] p-3 text-sm font-bold text-slate-200 hover:bg-white/[0.06]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-sky-500"
                    checked={selectedTreatmentIds.includes(treatment.id)}
                    onChange={() => toggleTreatment(treatment.id)}
                  />
                  <span>{treatment.nameAr || treatment.name}</span>
                </label>
              ))}
              {!treatments.length ? <p className="p-4 text-center text-sm text-slate-400">لا توجد خدمات متاحة.</p> : null}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <SecondaryButton type="button" onClick={() => setEditingDoctor(null)}>إلغاء</SecondaryButton>
              <PrimaryButton type="button" onClick={saveTasks} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
