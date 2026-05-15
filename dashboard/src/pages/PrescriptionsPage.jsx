import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, FileText, Plus, Printer, Search, Send, Trash2 } from 'lucide-react';
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

const emptyToothNote = () => ({
  toothNumber: '',
  note: '',
});

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
};

const todayLabel = () =>
  new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date()
  );

export default function PrescriptionsPage() {
  const [appointmentId, setAppointmentId] = useState('');
  const [appointment, setAppointment] = useState(null);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [clinic, setClinic] = useState({ nameAr: 'عيادتي', name: 'Clinic', phone: '', address: '', logoUrl: null });
  const [search, setSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [toothNotes, setToothNotes] = useState([emptyToothNote()]);
  const [medications, setMedications] = useState([emptyMedication()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdPrescription, setCreatedPrescription] = useState(null);
  const [showToothChart, setShowToothChart] = useState(false);

  useEffect(() => {
    const loadBasics = async () => {
      try {
        const [doctorsRes, patientsRes, settingsRes] = await Promise.all([
          api.get('/doctors'),
          api.get('/patients', { params: { limit: 50 } }),
          api.get('/settings/public').catch(() => null),
        ]);
        setDoctors(doctorsRes.data.doctors || []);
        setPatients(patientsRes.data.patients || []);
        if (settingsRes?.data?.clinic) {
          setClinic((current) => ({ ...current, ...settingsRes.data.clinic }));
        }
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
      toast.warn('اكتب رقم الحجز أولاً');
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
  const updateToothNote = (index, key, value) => {
    setToothNotes((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  };
  const addToothNote = () => setToothNotes((current) => [...current, emptyToothNote()]);
  const removeToothNote = (index) => setToothNotes((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const cleanToothNotes = toothNotes
    .map((item) => ({ toothNumber: String(item.toothNumber || '').trim(), note: String(item.note || '').trim() }))
    .filter((item) => item.toothNumber && item.note);

  const composedNotes = [
    notes.trim(),
    cleanToothNotes.length
      ? ['ملاحظات الأسنان:', ...cleanToothNotes.map((item) => `سن ${item.toothNumber}: ${item.note}`)].join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

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
        notes: composedNotes,
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

  const handlePrint = () => window.print();

  const enteredMedications = medications.filter((medication) => medication.name.trim());
  const clinicName = clinic.nameAr || clinic.name || 'عيادتي';

  return (
    <AppLayout>
      <PageHeader
        title="الروشتات"
        description="اكتب الروشتة من رقم الحجز أو باختيار المريض، وراجع شكلها النهائي قبل الطباعة أو الإرسال على واتساب."
        actions={
          <StatusBadge tone={createdPrescription ? 'green' : 'blue'}>
            {createdPrescription ? `روشتة محفوظة: ${createdPrescription.id}` : 'روشتة جديدة'}
          </StatusBadge>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        {/* ── Form column ── */}
        <div className="space-y-6">
          <DataCard>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <Field label="رقم الحجز (Booking Ref)">
                <input
                  className={inputClass}
                  value={appointmentId}
                  onChange={(event) => setAppointmentId(event.target.value)}
                  placeholder="مثال: B-AMM2YT"
                  dir="ltr"
                />
              </Field>
              <PrimaryButton type="button" onClick={resolveAppointment} disabled={loading}>
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

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="الطبيب">
                <select
                  className={inputClass}
                  value={doctorId}
                  onChange={(event) => setDoctorId(event.target.value)}
                  disabled={Boolean(appointment)}
                >
                  <option value="">اختر الطبيب</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} - {doctor.specialization}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="التشخيص">
                <input
                  className={inputClass}
                  value={diagnosis}
                  onChange={(event) => setDiagnosis(event.target.value)}
                  placeholder="مثال: التهاب عصب حاد"
                />
              </Field>
            </div>
          </DataCard>

          {/* Medications */}
          <DataCard>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-white">الأدوية</h2>
              <SecondaryButton type="button" onClick={addMedication}>
                <Plus className="h-4 w-4" />
                إضافة دواء
              </SecondaryButton>
            </div>

            <div className="space-y-4">
              {medications.map((medication, index) => (
                <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-lg bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-300">
                      دواء {index + 1}
                    </span>
                    {medications.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeMedication(index)}
                        className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-1.5 text-rose-300 transition hover:bg-rose-500/20"
                        aria-label="حذف الدواء"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
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
                  <div className="mt-3">
                    <input className={inputClass} value={medication.notes} onChange={(event) => updateMedication(index, 'notes', event.target.value)} placeholder="ملاحظات خاصة بالدواء (اختياري)" />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <Field label="ملاحظات عامة للمريض">
                <textarea className={`${inputClass} min-h-24`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="تعليمات إضافية للمريض" />
              </Field>
            </div>
          </DataCard>

          {/* Tooth notes (collapsible) */}
          <DataCard>
            <button
              type="button"
              onClick={() => setShowToothChart((current) => !current)}
              className="flex w-full items-center justify-between gap-3"
              aria-expanded={showToothChart}
            >
              <div className="text-right">
                <h2 className="text-lg font-black text-white">ملاحظات الأسنان</h2>
                <p className="mt-1 text-sm text-slate-400">اكتب رقم السن ثم الملاحظة — تُحفظ داخل الروشتة وملف المريض.</p>
              </div>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${showToothChart ? 'rotate-180' : ''}`}
              />
            </button>

            {showToothChart ? (
              <div className="mt-5 grid gap-5 lg:grid-cols-[300px_1fr] lg:items-start">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
                  <img
                    src="/images/teeth-chart.jpg"
                    alt="خريطة ترقيم الأسنان من 1 إلى 32"
                    loading="lazy"
                    decoding="async"
                    className="w-full object-contain"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <SecondaryButton type="button" onClick={addToothNote}>
                      <Plus className="h-4 w-4" />
                      إضافة سن
                    </SecondaryButton>
                  </div>
                  {toothNotes.map((item, index) => (
                    <div key={index} className="grid gap-3 md:grid-cols-[130px_1fr_auto]">
                      <Field label="رقم السن">
                        <select className={inputClass} value={item.toothNumber} onChange={(event) => updateToothNote(index, 'toothNumber', event.target.value)}>
                          <option value="">اختر</option>
                          {Array.from({ length: 32 }, (_, toothIndex) => toothIndex + 1).map((number) => (
                            <option key={number} value={number}>سن {number}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="الملاحظة">
                        <input className={inputClass} value={item.note} onChange={(event) => updateToothNote(index, 'note', event.target.value)} placeholder="مثال: تسوس، حشو، خلع، ألم عند الضغط..." />
                      </Field>
                      {toothNotes.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeToothNote(index)}
                          className="self-end rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-rose-300 transition hover:bg-rose-500/20"
                          aria-label="حذف السن"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </DataCard>

          {/* Action bar */}
          <div className="sticky bottom-4 z-10 flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-[#0b1020]/90 p-4 backdrop-blur-xl">
            <PrimaryButton type="button" onClick={() => savePrescription(false)} disabled={saving}>
              <FileText className="h-4 w-4" />
              حفظ الروشتة
            </PrimaryButton>
            <PrimaryButton type="button" onClick={() => savePrescription(true)} disabled={saving}>
              <Send className="h-4 w-4" />
              حفظ وإرسال واتساب
            </PrimaryButton>
            <SecondaryButton type="button" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              طباعة
            </SecondaryButton>
            {createdPrescription ? (
              <SecondaryButton type="button" onClick={sendExisting} disabled={saving}>
                إعادة الإرسال
              </SecondaryButton>
            ) : null}
          </div>
        </div>

        {/* ── Prescription paper preview ── */}
        <div className="xl:sticky xl:top-24 xl:self-start">
          <p className="mb-3 text-sm font-bold text-slate-400">معاينة الروشتة (هكذا ستُطبع)</p>
          <div
            id="prescription-print"
            className="overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl shadow-black/40"
            dir="rtl"
          >
            {/* Letterhead */}
            <div className="flex items-start justify-between gap-4 border-b-4 border-sky-600 bg-sky-50 px-6 py-5">
              <div className="flex items-center gap-3">
                {clinic.logoUrl ? (
                  <img src={clinic.logoUrl} alt={clinicName} className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-sky-600 text-2xl font-black text-white">
                    {clinicName.slice(0, 1)}
                  </div>
                )}
                <div>
                  <p className="text-xl font-black text-sky-800">{clinicName}</p>
                  <p className="text-xs font-medium text-slate-500">لطب وتجميل الأسنان</p>
                </div>
              </div>
              <div className="text-left text-[11px] leading-5 text-slate-600">
                {clinic.phone ? <p dir="ltr">{clinic.phone}</p> : null}
                {clinic.address ? <p>{clinic.address}</p> : null}
              </div>
            </div>

            <div className="px-6 py-5">
              {/* Patient / date row */}
              <div className="mb-4 flex items-end justify-between gap-4 border-b border-dashed border-slate-300 pb-4">
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-bold text-slate-500">المريض:</span>{' '}
                    <span className="font-bold">{selectedPatient?.name || '—'}</span>
                  </p>
                  <p className="text-slate-600">
                    <span className="font-bold text-slate-500">الهاتف:</span>{' '}
                    <span dir="ltr">{selectedPatient?.phone || '—'}</span>
                  </p>
                </div>
                <div className="text-left text-xs text-slate-600">
                  <p>{appointment?.scheduledTime ? formatDate(appointment.scheduledTime) : todayLabel()}</p>
                  {appointment?.bookingRef ? (
                    <p className="font-mono" dir="ltr">{appointment.bookingRef}</p>
                  ) : null}
                </div>
              </div>

              {/* Rx + diagnosis */}
              <div className="mb-4 flex items-center gap-3">
                <span className="font-serif text-4xl font-black leading-none text-sky-700">℞</span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">التشخيص</p>
                  <p className="text-base font-bold text-slate-800">{diagnosis || '—'}</p>
                </div>
              </div>

              {/* Medications */}
              <div className="space-y-2">
                {enteredMedications.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-400">
                    لم يتم إدخال أدوية بعد.
                  </p>
                ) : (
                  enteredMedications.map((medication, index) => (
                    <div key={index} className="flex gap-3 border-b border-slate-100 pb-2">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-black text-sky-700">
                        {index + 1}
                      </span>
                      <div className="text-sm">
                        <p className="font-black text-slate-900">{medication.name}</p>
                        <p className="text-slate-600">
                          {[medication.dosage, medication.frequency, medication.interval, medication.duration, medication.timing]
                            .filter(Boolean)
                            .join(' — ')}
                        </p>
                        {medication.notes ? <p className="text-xs text-slate-500">{medication.notes}</p> : null}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Tooth notes */}
              {cleanToothNotes.length > 0 ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="mb-1 font-bold text-sky-700">ملاحظات الأسنان</p>
                  {cleanToothNotes.map((item) => (
                    <p key={`${item.toothNumber}-${item.note}`} className="text-slate-700">
                      سن {item.toothNumber}: {item.note}
                    </p>
                  ))}
                </div>
              ) : null}

              {/* General notes */}
              {notes.trim() ? (
                <p className="mt-4 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{notes}</p>
              ) : null}

              {/* Signature */}
              <div className="mt-8 flex items-end justify-between">
                <div className="text-xs text-slate-400">
                  <p>روشتة طبية إلكترونية صادرة من نظام {clinicName}</p>
                </div>
                <div className="text-center">
                  <div className="mb-1 h-10 w-44 border-b border-slate-400" />
                  <p className="text-xs font-bold text-slate-600">توقيع الطبيب</p>
                  <p className="text-sm font-black text-slate-800">{selectedDoctor?.name ? `د. ${selectedDoctor.name}` : '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
