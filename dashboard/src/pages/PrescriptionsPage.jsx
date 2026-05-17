import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, FileText, Plus, Printer, Search, Send, Trash2, UserRound } from 'lucide-react';
import { toast } from 'react-toastify';
import AppLayout from '../components/Layout';
import api from '../api/client';
import TeethChart from '../components/teeth/TeethChart';
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
  if (!value) return '—';
  return new Date(value).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
};

const todayLabel = () =>
  new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date()
  );

const toothNumbers = Array.from({ length: 32 }, (_, index) => String(index + 1));

const toothPositions = toothNumbers.map((number, index) => {
  const angle = -155 + index * (310 / 31);
  const radians = (angle * Math.PI) / 180;
  return {
    number,
    left: 50 + 35 * Math.cos(radians),
    top: 50 + 43 * Math.sin(radians),
  };
});

const ToothButton = ({ number, active, marked, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{ left: `${toothPositions.find((item) => item.number === number)?.left || 50}%`, top: `${toothPositions.find((item) => item.number === number)?.top || 50}%` }}
    className={`absolute h-12 w-10 -translate-x-1/2 -translate-y-1/2 text-xs font-black transition md:h-14 md:w-12 ${
      active ? 'text-white' : marked ? 'text-emerald-700' : 'text-slate-900 hover:text-sky-600'
    }`}
  >
    <svg viewBox="0 0 64 76" className="absolute inset-0 h-full w-full drop-shadow-sm" aria-hidden="true">
      <path
        d="M32 4C19.5 4 10 13.5 10 27.5c0 9.5 4.7 17.6 8 25.8 2.2 5.5 3.2 15.8 9.2 16.7 3.1.5 3.8-6.1 4.8-11.2 1 5.1 1.7 11.7 4.8 11.2 6-.9 7-11.2 9.2-16.7 3.3-8.2 8-16.3 8-25.8C54 13.5 44.5 4 32 4Z"
        className={active ? 'fill-sky-500 stroke-sky-700' : marked ? 'fill-emerald-50 stroke-emerald-500' : 'fill-white stroke-slate-500'}
        strokeWidth="2.5"
      />
      <path d="M19 24c5 3 10 3 13 0 3 3 8 3 13 0M23 38c4 2 14 2 18 0" className={active ? 'stroke-white/60' : 'stroke-slate-300'} fill="none" strokeWidth="2" strokeLinecap="round" />
    </svg>
    <span className="relative z-10">{number}</span>
  </button>
);

export function PrescriptionsWorkspace({
  embedded = false,
  initialPatientId = '',
  initialAppointmentId = '',
  onCreated,
} = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPatientId = initialPatientId || searchParams.get('patientId') || '';
  const requestedAppointmentId = initialAppointmentId || searchParams.get('appointmentId') || '';
  const [appointmentId, setAppointmentId] = useState(requestedAppointmentId);
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
  const [profileTeethNotes, setProfileTeethNotes] = useState({});
  const autoResolvedRef = useRef(false);

  useEffect(() => {
    const loadBasics = async () => {
      try {
        const [doctorsRes, patientsRes, settingsRes] = await Promise.all([
          api.get('/doctors'),
          api.get('/patients', { params: { limit: 50 } }),
          api.get('/settings/public').catch(() => null),
        ]);
        setDoctors(doctorsRes.data.doctors || []);
        const list = patientsRes.data.patients || [];
        if (settingsRes?.data?.clinic) {
          setClinic((current) => ({ ...current, ...settingsRes.data.clinic }));
        }

        if (requestedPatientId) {
          let target = list.find((patient) => patient.id === requestedPatientId);
          if (!target) {
            try {
              const patientRes = await api.get(`/patients/${requestedPatientId}`);
              target = patientRes.data.patient;
            } catch {
              target = null;
            }
          }
          if (target) {
            setPatients(list.some((patient) => patient.id === target.id) ? list : [target, ...list]);
            setSelectedPatientId(target.id);
            if (target.name) setSearch(target.name);
          } else {
            setPatients(list);
          }
        } else {
          setPatients(list);
        }
      } catch {
        toast.error('فشل تحميل بيانات الروشتة');
      }
    };
    loadBasics();
  }, [requestedPatientId]);

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

  const selectablePatients = useMemo(() => {
    if (!selectedPatient || filteredPatients.some((patient) => patient.id === selectedPatient.id)) {
      return filteredPatients;
    }
    return [selectedPatient, ...filteredPatients];
  }, [filteredPatients, selectedPatient]);

  useEffect(() => {
    if (!selectedPatient?.id) {
      setProfileTeethNotes({});
      return;
    }

    let alive = true;
    api
      .get(`/patients/${selectedPatient.id}`)
      .then((res) => {
        if (alive) setProfileTeethNotes(res.data.patient?.teethNotes || {});
      })
      .catch(() => {
        if (alive) setProfileTeethNotes({});
      });

    return () => {
      alive = false;
    };
  }, [selectedPatient?.id]);

  const resolveAppointment = async () => {
    if (!appointmentId.trim()) {
      toast.warn('اكتب رقم الحجز أولاً');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/prescriptions/resolve', { params: { appointmentId: appointmentId.trim() } });
      const resolved = res.data.appointment;
      setAppointment(resolved);
      setSelectedPatientId(resolved.patientId);
      setDoctorId(resolved.doctorId);
      if (resolved.patient) {
        setPatients((current) =>
          current.some((patient) => patient.id === resolved.patient.id) ? current : [resolved.patient, ...current]
        );
      }
      toast.success('تم تحميل بيانات الحجز');
    } catch (error) {
      toast.error(error.message || 'لم يتم العثور على الحجز');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!requestedAppointmentId || autoResolvedRef.current) return;
    autoResolvedRef.current = true;
    resolveAppointment();
  }, [requestedAppointmentId]);

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
  const selectToothNumber = (number) => {
    setShowToothChart(true);
    setToothNotes((current) => {
      const existingIndex = current.findIndex((item) => String(item.toothNumber) === String(number));
      if (existingIndex >= 0) return current;
      const emptyIndex = current.findIndex((item) => !String(item.toothNumber || '').trim());
      if (emptyIndex >= 0) {
        return current.map((item, itemIndex) => (itemIndex === emptyIndex ? { ...item, toothNumber: String(number) } : item));
      }
      return [...current, { toothNumber: String(number), note: '' }];
    });
  };

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
      toast.warn('اختر المريض واكتب التشخيص ودواء واحد على الأقل');
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
      onCreated?.(res.data.prescription);

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
  const prescriptionDate = appointment?.scheduledTime ? formatDate(appointment.scheduledTime) : todayLabel();
  const patientAge = selectedPatient?.age || selectedPatient?.birthDate;
  const doctorName = selectedDoctor?.name ? `د. ${selectedDoctor.name}` : '—';

  const content = (
    <>
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
        <div className="space-y-6 print-hidden">
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
                  {selectablePatients.map((patient) => (
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
                      <input
                        className={inputClass}
                        value={medication.name}
                        onChange={(event) => updateMedication(index, 'name', event.target.value)}
                        placeholder="Augmentin 1gm"
                      />
                    </Field>
                    <Field label="الجرعة">
                      <input
                        className={inputClass}
                        value={medication.dosage}
                        onChange={(event) => updateMedication(index, 'dosage', event.target.value)}
                        placeholder="قرص"
                      />
                    </Field>
                    <Field label="التكرار">
                      <select
                        className={inputClass}
                        value={medication.frequency}
                        onChange={(event) => updateMedication(index, 'frequency', event.target.value)}
                      >
                        {frequencyOptions.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="كل كام ساعة/يوم">
                      <input
                        className={inputClass}
                        value={medication.interval}
                        onChange={(event) => updateMedication(index, 'interval', event.target.value)}
                        placeholder="كل 12 ساعة"
                      />
                    </Field>
                    <Field label="المدة">
                      <input
                        className={inputClass}
                        value={medication.duration}
                        onChange={(event) => updateMedication(index, 'duration', event.target.value)}
                        placeholder="5 أيام"
                      />
                    </Field>
                    <Field label="التعليمات">
                      <select
                        className={inputClass}
                        value={medication.timing}
                        onChange={(event) => updateMedication(index, 'timing', event.target.value)}
                      >
                        {timingOptions.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="mt-3">
                    <input
                      className={inputClass}
                      value={medication.notes}
                      onChange={(event) => updateMedication(index, 'notes', event.target.value)}
                      placeholder="ملاحظات خاصة بالدواء (اختياري)"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <Field label="ملاحظات عامة للمريض">
                <textarea
                  className={`${inputClass} min-h-24`}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="تعليمات إضافية للمريض"
                />
              </Field>
            </div>
          </DataCard>

          <DataCard>
            <button
              type="button"
              onClick={() => setShowToothChart((current) => !current)}
              className="flex w-full items-center justify-between gap-3"
              aria-expanded={showToothChart}
            >
              <div className="text-right">
                <h2 className="text-lg font-black text-white">ملاحظات الأسنان</h2>
                <p className="mt-1 text-sm text-slate-400">
                  اكتب رقم السن ثم الملاحظة. تحفظ داخل الروشتة وملف المريض.
                </p>
              </div>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${showToothChart ? 'rotate-180' : ''}`}
              />
            </button>

            {selectedPatient?.id ? (
              <div className="mt-5">
                <TeethChart
                  patientId={selectedPatient.id}
                  value={profileTeethNotes}
                  onSaved={(teeth) => setProfileTeethNotes(teeth)}
                />
              </div>
            ) : (
              <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                اختر المريض أولاً لفتح خريطة الأسنان الكاملة بالخدمة والطبيب وحالة تنفيذ الخدمة.
              </p>
            )}

            {showToothChart ? (
              <div className="mt-5 grid gap-5 lg:grid-cols-[340px_1fr] lg:items-start">
                <div className="relative aspect-[0.78] min-h-[390px] overflow-hidden rounded-2xl border border-white/10 bg-white">
                  {false ? <img
                    src="/images/teeth-chart.jpg"
                    alt="خريطة ترقيم الأسنان من 1 إلى 32"
                    loading="lazy"
                    decoding="async"
                    className="w-full object-contain"
                  /> : null}
                  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
                    <ellipse cx="50" cy="50" rx="24" ry="36" fill="none" stroke="#111827" strokeWidth="1.5" />
                    <ellipse cx="50" cy="50" rx="36" ry="45" fill="none" stroke="#d1d5db" strokeWidth="1" />
                  </svg>
                  {toothNumbers.map((number) => (
                    <ToothButton
                      key={number}
                      number={number}
                      marked={toothNotes.some((item) => String(item.toothNumber) === number)}
                      active={toothNotes.some((item) => String(item.toothNumber) === number && !String(item.note || '').trim())}
                      onClick={() => selectToothNumber(number)}
                    />
                  ))}
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
                        <select
                          className={inputClass}
                          value={item.toothNumber}
                          onChange={(event) => updateToothNote(index, 'toothNumber', event.target.value)}
                        >
                          <option value="">اختر</option>
                          {Array.from({ length: 32 }, (_, toothIndex) => toothIndex + 1).map((number) => (
                            <option key={number} value={number}>
                              سن {number}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="الملاحظة">
                        <input
                          className={inputClass}
                          value={item.note}
                          onChange={(event) => updateToothNote(index, 'note', event.target.value)}
                          placeholder="مثال: تسوس، حشو، خلع، ألم عند الضغط..."
                        />
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
              طباعة / حفظ PDF
            </SecondaryButton>
            {!embedded && selectedPatient?.id ? (
              <SecondaryButton type="button" onClick={() => navigate(`/patients/${selectedPatient.id}`)}>
                <UserRound className="h-4 w-4" />
                ملف المريض
              </SecondaryButton>
            ) : null}
            {createdPrescription ? (
              <SecondaryButton type="button" onClick={sendExisting} disabled={saving}>
                إعادة الإرسال
              </SecondaryButton>
            ) : null}
          </div>
        </div>

        <div className="prescription-print-root xl:sticky xl:top-24 xl:self-start">
          <p className="print-hidden mb-3 text-sm font-bold text-slate-400">معاينة الروشتة كما ستظهر في الطباعة</p>

          <article id="prescription-print" className="prescription-paper" dir="rtl">
            <header className="prescription-letterhead prescription-section">
              <div className="prescription-clinic-identity">
                {clinic.logoUrl ? (
                  <img src={clinic.logoUrl} alt={clinicName} className="prescription-logo" />
                ) : (
                  <div className="prescription-logo-fallback">{clinicName.slice(0, 1)}</div>
                )}
                <div>
                  <p className="prescription-kicker">عيادة أسنان</p>
                  <h1>{clinicName}</h1>
                  <p className="prescription-muted">لطب وتجميل الأسنان</p>
                </div>
              </div>
              <div className="prescription-contact">
                <p className="prescription-date">{prescriptionDate}</p>
                {clinic.phone ? <p dir="ltr">{clinic.phone}</p> : null}
                {clinic.address ? <p>{clinic.address}</p> : null}
              </div>
            </header>

            <section className="prescription-patient-grid prescription-section">
              <div>
                <span>اسم المريض</span>
                <strong>{selectedPatient?.name || '—'}</strong>
              </div>
              <div>
                <span>الهاتف</span>
                <strong dir="ltr">{selectedPatient?.phone || '—'}</strong>
              </div>
              <div>
                <span>العمر / تاريخ الميلاد</span>
                <strong>{patientAge || '—'}</strong>
              </div>
              <div>
                <span>الطبيب</span>
                <strong>{doctorName}</strong>
              </div>
              {appointment?.bookingRef ? (
                <div>
                  <span>رقم الحجز</span>
                  <strong dir="ltr">{appointment.bookingRef}</strong>
                </div>
              ) : null}
            </section>

            <main className="prescription-body">
              <section className="prescription-diagnosis prescription-section">
                <div className="prescription-rx">℞</div>
                <div>
                  <span>التشخيص</span>
                  <p>{diagnosis || '—'}</p>
                </div>
              </section>

              <section className="prescription-section">
                <div className="prescription-section-title">
                  <span>العلاج</span>
                  <strong>{enteredMedications.length || 0} أدوية</strong>
                </div>
                {enteredMedications.length === 0 ? (
                  <p className="prescription-empty">لم يتم إدخال أدوية بعد.</p>
                ) : (
                  <ol className="prescription-medications">
                    {enteredMedications.map((medication, index) => {
                      const instructionLine = [
                        medication.dosage,
                        medication.frequency,
                        medication.interval,
                        medication.duration,
                        medication.timing,
                      ]
                        .filter(Boolean)
                        .join(' - ');

                      return (
                        <li key={`${medication.name}-${index}`} className="prescription-medication-row">
                          <div className="prescription-med-number">{index + 1}</div>
                          <div>
                            <h3>{medication.name}</h3>
                            {instructionLine ? <p>{instructionLine}</p> : null}
                            {medication.notes ? <small>{medication.notes}</small> : null}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>

              {cleanToothNotes.length > 0 ? (
                <section className="prescription-section prescription-tooth-notes">
                  <div className="prescription-section-title">
                    <span>ملاحظات الأسنان</span>
                    <strong>{cleanToothNotes.length} أسنان</strong>
                  </div>
                  <div className="prescription-tooth-grid">
                    {cleanToothNotes.map((item) => (
                      <p key={`${item.toothNumber}-${item.note}`}>
                        <strong>سن {item.toothNumber}</strong>
                        <span>{item.note}</span>
                      </p>
                    ))}
                  </div>
                </section>
              ) : null}

              {notes.trim() ? (
                <section className="prescription-section prescription-notes">
                  <div className="prescription-section-title">
                    <span>ملاحظات</span>
                  </div>
                  <p>{notes}</p>
                </section>
              ) : null}
            </main>

            <footer className="prescription-footer prescription-section">
              <div>
                <span>توقيع الطبيب</span>
                <strong>{doctorName}</strong>
              </div>
              <p>
                هذه الروشتة صادرة إلكترونياً من نظام {clinicName}. يرجى الالتزام بتعليمات الطبيب وعدم تغيير الجرعات
                دون مراجعة العيادة.
              </p>
            </footer>
          </article>
        </div>
      </div>
    </>
  );

  return embedded ? content : <AppLayout>{content}</AppLayout>;
}

export default function PrescriptionsPage() {
  return <PrescriptionsWorkspace />;
}
