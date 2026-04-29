import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Search, Send, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import AppLayout from '../components/Layout';
import api from '../api/client';
import { DataCard, Field, PageHeader, PrimaryButton, SecondaryButton, StatusBadge, inputClass } from '../components/ui';

const frequencyOptions = ['مرة يومياً', 'مرتين يومياً', 'ثلاث مرات يومياً', 'كل 8 ساعات', 'كل 12 ساعة', 'عند اللزوم'];
const timingOptions = ['بعد الأكل', 'قبل الأكل', 'مع الأكل', 'قبل النوم', 'بدون شرط'];

const emptyMedication = () => ({
  name: '',
  dosage: '',
  frequency: 'مرتين يومياً',
  interval: '',
  duration: '',
  timing: 'بعد الأكل',
  notes: '',
});

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function PrescriptionsPage() {
  const [appointmentId, setAppointmentId] = useState('');
  const [appointment, setAppointment] = useState(null);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [medications, setMedications] = useState([emptyMedication()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdPrescription, setCreatedPrescription] = useState(null);

  useEffect(() => {
    const loadBasics = async () => {
      try {
        const [doctorsRes, patientsRes] = await Promise.all([
          api.get('/doctors'),
          api.get('/patients', { params: { limit: 50 } }),
        ]);
        setDoctors(doctorsRes.data.doctors || []);
        setPatients(patientsRes.data.patients || []);
      } catch {
        toast.error('فشل تحميل بيانات الروشتة');
      }
    };
    loadBasics();
  }, []);

  const selectedPatient = useMemo(
    () => appointment?.patient || patients.find((patient) => patient.id === selectedPatientId),
    [appointment, patients, selectedPatientId]
  );

  const selectedDoctor = useMemo(
    () => appointment?.doctor || doctors.find((doctor) => doctor.id === doctorId),
    [appointment, doctors, doctorId]
  );

  const filteredPatients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return patients.slice(0, 8);
    return patients
      .filter((patient) => `${patient.name} ${patient.phone}`.toLowerCase().includes(term))
      .slice(0, 8);
  }, [patients, search]);

  const resolveAppointment = async () => {
    if (!appointmentId.trim()) {
      toast.warn('اكتب Appointment ID أولاً');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/prescriptions/resolve', { params: { appointmentId: appointmentId.trim() } });
      setAppointment(res.data.appointment);
      setSelectedPatientId(res.data.appointment.patientId);
      setDoctorId(res.data.appointment.doctorId);
      toast.success('تم تحميل بيانات الحجز');
    } catch (error) {
      toast.error(error.message || 'لم يتم العثور على الحجز');
    } finally {
      setLoading(false);
    }
  };

  const updateMedication = (index, key, value) => {
    setMedications((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  };

  const addMedication = () => setMedications((current) => [...current, emptyMedication()]);
  const removeMedication = (index) => setMedications((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const savePrescription = async (sendAfterSave = false) => {
    const cleanMedications = medications.filter((medication) => medication.name.trim());
    if (!selectedPatient?.id || !diagnosis.trim() || cleanMedications.length === 0) {
      toast.warn('اختار المريض واكتب التشخيص ودواء واحد على الأقل');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/prescriptions', {
        appointmentId: appointment?.id || undefined,
        patientId: selectedPatient.id,
        doctorId: selectedDoctor?.id || doctorId || undefined,
        diagnosis,
        medications: cleanMedications,
        notes,
      });
      setCreatedPrescription(res.data.prescription);

      if (sendAfterSave) {
        await api.post(`/prescriptions/${res.data.prescription.id}/send`);
        toast.success('تم حفظ الروشتة وإرسالها للمريض');
      } else {
        toast.success('تم حفظ الروشتة');
      }
    } catch (error) {
      toast.error(error.message || 'فشل حفظ الروشتة');
    } finally {
      setSaving(false);
    }
  };

  const sendExisting = async () => {
    if (!createdPrescription?.id) return;
    setSaving(true);
    try {
      await api.post(`/prescriptions/${createdPrescription.id}/send`);
      toast.success('تم إرسال الروشتة للمريض');
    } catch (error) {
      toast.error(error.message || 'فشل إرسال الروشتة');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="الروشتات"
        description="اكتب الروشتة من Appointment ID أو من ملف المريض، وراجع شكلها قبل إرسالها على واتساب."
        actions={
          <StatusBadge tone={createdPrescription ? 'green' : 'blue'}>
            {createdPrescription ? `روشتة محفوظة: ${createdPrescription.id}` : 'روشتة جديدة'}
          </StatusBadge>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <DataCard>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <Field label="Appointment ID">
                <input
                  className={inputClass}
                  value={appointmentId}
                  onChange={(event) => setAppointmentId(event.target.value)}
                  placeholder="مثال: cm..."
                  dir="ltr"
                />
              </Field>
              <PrimaryButton type="button" onClick={resolveAppointment} disabled={loading} className="self-end">
                <Search className="h-4 w-4" />
                تحميل الحجز
              </PrimaryButton>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="بحث عن مريض">
                <input
                  className={inputClass}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="اسم أو رقم المريض"
                />
              </Field>
              <Field label="اختيار المريض">
                <select
                  className={inputClass}
                  value={selectedPatientId}
                  onChange={(event) => {
                    setAppointment(null);
                    setSelectedPatientId(event.target.value);
                  }}
                >
                  <option value="">اختر المريض</option>
                  {filteredPatients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name} - {patient.phone}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </DataCard>

          <DataCard>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="الطبيب">
                <select className={inputClass} value={doctorId} onChange={(event) => setDoctorId(event.target.value)} disabled={Boolean(appointment)}>
                  <option value="">اختر الطبيب</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} - {doctor.specialization}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="التشخيص">
                <input className={inputClass} value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} placeholder="مثال: التهاب عصب حاد" />
              </Field>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-950">الأدوية</h2>
                <SecondaryButton type="button" onClick={addMedication}>
                  <Plus className="h-4 w-4" />
                  إضافة دواء
                </SecondaryButton>
              </div>

              {medications.map((medication, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="اسم الدواء">
                      <input className={inputClass} value={medication.name} onChange={(event) => updateMedication(index, 'name', event.target.value)} placeholder="Augmentin 1gm" />
                    </Field>
                    <Field label="الجرعة">
                      <input className={inputClass} value={medication.dosage} onChange={(event) => updateMedication(index, 'dosage', event.target.value)} placeholder="قرص" />
                    </Field>
                    <Field label="التكرار">
                      <select className={inputClass} value={medication.frequency} onChange={(event) => updateMedication(index, 'frequency', event.target.value)}>
                        {frequencyOptions.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="كل كام ساعة/يوم">
                      <input className={inputClass} value={medication.interval} onChange={(event) => updateMedication(index, 'interval', event.target.value)} placeholder="كل 12 ساعة" />
                    </Field>
                    <Field label="المدة">
                      <input className={inputClass} value={medication.duration} onChange={(event) => updateMedication(index, 'duration', event.target.value)} placeholder="5 أيام" />
                    </Field>
                    <Field label="قبل/بعد الأكل">
                      <select className={inputClass} value={medication.timing} onChange={(event) => updateMedication(index, 'timing', event.target.value)}>
                        {timingOptions.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                    <input className={inputClass} value={medication.notes} onChange={(event) => updateMedication(index, 'notes', event.target.value)} placeholder="ملاحظات خاصة بالدواء" />
                    {medications.length > 1 && (
                      <SecondaryButton type="button" onClick={() => removeMedication(index)} className="text-rose-600">
                        <Trash2 className="h-4 w-4" />
                        حذف
                      </SecondaryButton>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Field label="ملاحظات عامة">
              <textarea className={`${inputClass} min-h-28`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="تعليمات إضافية للمريض" />
            </Field>

            <div className="mt-5 flex flex-wrap gap-3">
              <PrimaryButton type="button" onClick={() => savePrescription(false)} disabled={saving}>
                <FileText className="h-4 w-4" />
                حفظ الروشتة
              </PrimaryButton>
              <PrimaryButton type="button" onClick={() => savePrescription(true)} disabled={saving}>
                <Send className="h-4 w-4" />
                حفظ وإرسال واتساب
              </PrimaryButton>
              {createdPrescription && (
                <SecondaryButton type="button" onClick={sendExisting} disabled={saving}>
                  إعادة الإرسال
                </SecondaryButton>
              )}
            </div>
          </DataCard>
        </div>

        <DataCard className="xl:sticky xl:top-24 xl:self-start">
          <h2 className="mb-4 text-xl font-bold text-slate-950">معاينة الروشتة</h2>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="border-b border-slate-200 pb-4 text-center">
              <p className="text-2xl font-bold text-blue-700">عيادتي</p>
              <p className="text-sm text-slate-500">روشتة طبية إلكترونية</p>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-700">
              <p><span className="font-bold">المريض:</span> {selectedPatient?.name || '-'}</p>
              <p><span className="font-bold">الهاتف:</span> {selectedPatient?.phone || '-'}</p>
              <p><span className="font-bold">الطبيب:</span> {selectedDoctor?.name || '-'}</p>
              <p><span className="font-bold">الخدمة:</span> {appointment?.service?.nameAr || appointment?.service?.name || '-'}</p>
              <p><span className="font-bold">موعد الحجز:</span> {formatDate(appointment?.scheduledTime)}</p>
              <p><span className="font-bold">التشخيص:</span> {diagnosis || '-'}</p>
            </div>
            <div className="mt-5 space-y-3">
              {medications.filter((medication) => medication.name).map((medication, index) => (
                <div key={index} className="rounded-xl bg-blue-50 p-3 text-sm text-slate-800">
                  <p className="font-bold">{index + 1}. {medication.name}</p>
                  <p>{[medication.dosage, medication.frequency, medication.interval, medication.duration, medication.timing].filter(Boolean).join(' - ')}</p>
                  {medication.notes && <p className="mt-1 text-slate-500">{medication.notes}</p>}
                </div>
              ))}
              {!medications.some((medication) => medication.name) && <p className="text-sm text-slate-400">لم يتم إدخال أدوية بعد.</p>}
            </div>
            {notes && <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{notes}</p>}
          </div>
        </DataCard>
      </div>
    </AppLayout>
  );
}
