import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Calendar, CreditCard, FileText, MessageSquare, Pill, Save, Stethoscope, Trash2, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { DataCard, Field, PageHeader, PageLoader, PrimaryButton, SecondaryButton, StatCard, StatusBadge, inputClass } from '../components/ui';
import { formatDateTime, money } from '../utils/appointmentUi';

const tabs = [
  { id: 'teeth', label: 'ملاحظات الأسنان' },
  { id: 'booking', label: 'حجز موعد' },
  { id: 'overview', label: 'الملف' },
  { id: 'appointments', label: 'المواعيد' },
  { id: 'prescriptions', label: 'الروشتات' },
  { id: 'payments', label: 'المدفوعات' },
  { id: 'consultations', label: 'الاستشارات' },
  { id: 'messages', label: 'الرسائل' },
];

const medicationLine = (medication, index) => {
  if (typeof medication === 'string') return `${index + 1}. ${medication}`;
  const parts = [
    medication?.name,
    medication?.dosage,
    medication?.frequency,
    medication?.interval,
    medication?.duration,
    medication?.timing,
  ].filter(Boolean);
  return `${index + 1}. ${parts.join(' - ')}${medication?.notes ? ` (${medication.notes})` : ''}`;
};

const emptyToothNote = () => ({ toothNumber: '', note: '' });

const notesObjectToRows = (notes = {}) => {
  const rows = Object.entries(notes || {})
    .map(([toothNumber, note]) => ({ toothNumber: String(toothNumber), note: String(note || '') }))
    .filter((item) => item.toothNumber && item.note);
  return rows.length ? rows : [emptyToothNote()];
};

const rowsToNotesObject = (rows = []) =>
  rows.reduce((acc, item) => {
    const toothNumber = String(item.toothNumber || '').trim();
    const note = String(item.note || '').trim();
    if (toothNumber && note) acc[toothNumber] = note;
    return acc;
  }, {});

const buildNext14Days = () =>
  Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return date.toISOString().slice(0, 10);
  });

const timeOptions = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
  '19:00',
  '19:30',
  '20:00',
  '20:30',
  '21:00',
];

export default function PatientProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUserRole = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}').role || 'STAFF';
    } catch {
      return 'STAFF';
    }
  })();
  const canPrescribe = currentUserRole === 'ADMIN' || currentUserRole === 'DOCTOR';
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [draft, setDraft] = useState({ displayName: '', notes: '', accountingNotes: '', creditBalance: 0 });
  const [savingTeeth, setSavingTeeth] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [teethNotes, setTeethNotes] = useState({});
  const [toothRows, setToothRows] = useState([emptyToothNote()]);
  const [services, setServices] = useState([]);
  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [booking, setBooking] = useState({
    date: buildNext14Days()[0],
    time: '09:00',
    doctorId: '',
    serviceId: '',
    appointmentType: 'SCHEDULED',
    targetType: 'SELF',
    familyName: '',
  });

  const loadPatient = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/patients/${id}`);
      const nextPatient = res.data.patient;
      setPatient(nextPatient);
      setDraft({
        displayName: nextPatient.displayName || '',
        notes: nextPatient.notes || '',
        accountingNotes: nextPatient.accountingNotes || nextPatient.accountNotes || '',
        creditBalance: nextPatient.creditBalance ?? nextPatient.accountBalance ?? 0,
      });
      setTeethNotes(nextPatient.teethNotes || {});
      setToothRows(notesObjectToRows(nextPatient.teethNotes || {}));
    } catch (error) {
      toast.error(error.message || 'فشل تحميل ملف المريض');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatient();
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const loadServices = async () => {
      try {
        const res = await api.get('/services');
        const nextServices = res.data.services || [];
        if (cancelled) return;
        setServices(nextServices);
        setBooking((current) => ({ ...current, serviceId: current.serviceId || nextServices[0]?.id || '' }));
      } catch {
        if (!cancelled) setServices([]);
      }
    };
    loadServices();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!booking.date || !booking.time || !booking.serviceId) {
      setAvailableDoctors([]);
      return;
    }

    let cancelled = false;
    const loadDoctors = async () => {
      try {
        const scheduledTime = `${booking.date}T${booking.time}`;
        const res = await api.get('/appointments/availability/doctors', {
          params: { serviceId: booking.serviceId, scheduledTime },
        });
        if (cancelled) return;
        const doctors = res.data.doctors || [];
        setAvailableDoctors(doctors);
        setBooking((current) => ({
          ...current,
          doctorId: doctors.some((doctor) => doctor.id === current.doctorId) ? current.doctorId : doctors[0]?.id || '',
        }));
      } catch {
        if (!cancelled) setAvailableDoctors([]);
      }
    };
    loadDoctors();
    return () => {
      cancelled = true;
    };
  }, [booking.date, booking.time, booking.serviceId]);

  const saveTeethNotes = async (nextTeeth = teethNotes, quiet = false) => {
    setSavingTeeth(true);
    try {
      const res = await api.put(`/patients/${id}/teeth-notes`, { teeth: nextTeeth });
      const savedTeeth = res.data.teeth || res.data.patient?.teethNotes || {};
      setTeethNotes(savedTeeth);
      setToothRows(notesObjectToRows(savedTeeth));
      setPatient((current) => (current ? { ...current, teethNotes: savedTeeth } : current));
      if (!quiet) toast.success('تم حفظ ملاحظات الأسنان');
    } catch (error) {
      toast.error(error.message || 'فشل حفظ ملاحظات الأسنان');
    } finally {
      setSavingTeeth(false);
    }
  };

  const saveToothRows = (rows = toothRows, quiet = false) => saveTeethNotes(rowsToNotesObject(rows), quiet);
  const addToothRow = () => setToothRows((current) => [...current, emptyToothNote()]);
  const updateToothRow = (index, key, value) => {
    setToothRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  };
  const removeToothRow = (index) => {
    const next = toothRows.filter((_, itemIndex) => itemIndex !== index);
    const safeNext = next.length ? next : [emptyToothNote()];
    setToothRows(safeNext);
    saveToothRows(safeNext, true);
  };

  const bookAppointment = async () => {
    if (!booking.date || !booking.time || !booking.doctorId) {
      toast.warn('اختر التاريخ والوقت والطبيب أولاً');
      return;
    }

    setBookingLoading(true);
    try {
      await api.post('/appointments', {
        patientId: id,
        date: booking.date,
        time: booking.time,
        doctorId: booking.doctorId,
      });
      toast.success('تم إنشاء الموعد');
      await loadPatient();
    } catch (error) {
      toast.error(error.message || 'فشل إنشاء الموعد');
    } finally {
      setBookingLoading(false);
    }
  };

  const submitBooking = async () => {
    const needsTime = booking.appointmentType !== 'WALK_IN';
    if (!booking.date || !booking.doctorId || (needsTime && !booking.time)) {
      toast.warn(needsTime ? 'اختر التاريخ والوقت والطبيب أولاً' : 'اختر التاريخ والطبيب أولاً');
      return;
    }

    if (booking.targetType === 'FAMILY' && !booking.familyName.trim()) {
      toast.warn('اكتب اسم فرد العائلة أولاً');
      return;
    }

    setBookingLoading(true);
    try {
      let targetPatientId = id;

      if (booking.targetType === 'FAMILY') {
        const createdPatient = await api.post('/patients', {
          name: booking.familyName.trim(),
          phone: patient.phone,
          platform: patient.platform || 'WHATSAPP',
          profileType: 'BOOKED',
        });
        targetPatientId = createdPatient.data.patient.id;
      }

      await api.post('/appointments', {
        patientId: targetPatientId,
        date: booking.date,
        time: needsTime ? booking.time : undefined,
        serviceId: booking.serviceId,
        doctorId: booking.doctorId,
        appointmentType: booking.appointmentType,
        confirmImmediately: true,
        notifyPatient: true,
      });

      toast.success('تم إنشاء الموعد وإرسال التأكيد');
      await loadPatient();
    } catch (error) {
      toast.error(error.message || 'فشل إنشاء الموعد');
    } finally {
      setBookingLoading(false);
    }
  };

  const savePatient = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/patients/${id}`, {
        displayName: draft.displayName,
        notes: draft.notes,
        accountingNotes: draft.accountingNotes,
        accountNotes: draft.accountingNotes,
        creditBalance: draft.creditBalance,
        accountBalance: draft.creditBalance,
      });
      setPatient((current) => ({ ...current, ...res.data.patient }));
      toast.success('تم حفظ ملف المريض');
    } catch (error) {
      toast.error(error.message || 'فشل حفظ ملف المريض');
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(() => {
    const payments = patient?.payments || [];
    return {
      appointments: patient?.appointments?.length || 0,
      prescriptions: patient?.prescriptions?.length || 0,
      totalPaid: payments.reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0),
      remaining: payments.reduce((sum, payment) => sum + Math.max(0, Number(payment.finalAmount || 0) - Number(payment.paidAmount || 0)), 0),
    };
  }, [patient]);

  if (loading) {
    return (
      <AppLayout>
        <DataCard>
          <PageLoader label="جاري تحميل ملف المريض..." />
        </DataCard>
      </AppLayout>
    );
  }

  if (!patient) {
    return (
      <AppLayout>
        <DataCard className="text-center">ملف المريض غير موجود.</DataCard>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        breadcrumbs={[
          { label: 'المرضى', to: '/patients' },
          { label: patient.displayName || patient.name || 'ملف المريض' },
        ]}
        title={patient.displayName || patient.name || 'ملف المريض'}
        description={`${patient.phone || '-'} - ${patient.platform || 'WHATSAPP'}`}
        actions={
          <>
            <SecondaryButton type="button" onClick={() => window.history.back()}>رجوع</SecondaryButton>
            {canPrescribe ? (
              <SecondaryButton
                type="button"
                onClick={() => navigate(`/prescriptions?patientId=${encodeURIComponent(patient.id)}`)}
              >
                <Pill className="h-4 w-4" />
                إنشاء روشتة
              </SecondaryButton>
            ) : null}
            <PrimaryButton type="button" onClick={savePatient} disabled={saving}>
              <Save className="h-4 w-4" />
              حفظ
            </PrimaryButton>
          </>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="المواعيد" value={summary.appointments} icon={Calendar} tone="blue" />
        <StatCard title="الروشتات" value={summary.prescriptions} icon={FileText} tone="green" />
        <StatCard title="إجمالي المدفوع" value={money(summary.totalPaid)} icon={CreditCard} tone="green" />
        <StatCard title="المتبقي" value={money(summary.remaining)} icon={CreditCard} tone="amber" />
      </div>

      <DataCard className="mb-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === tab.id ? 'bg-sky-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </DataCard>

      {activeTab === 'overview' ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <DataCard>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="اسم العرض">
                <input className={inputClass} value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} />
              </Field>
              <Field label="الرصيد / المتبقي">
                <input className={inputClass} type="number" value={draft.creditBalance} onChange={(event) => setDraft((current) => ({ ...current, creditBalance: event.target.value }))} />
              </Field>
              <Field label="ملاحظات طبية وإدارية">
                <textarea className={`${inputClass} min-h-[150px]`} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
              </Field>
              <Field label="ملاحظات حسابية">
                <textarea className={`${inputClass} min-h-[150px]`} value={draft.accountingNotes} onChange={(event) => setDraft((current) => ({ ...current, accountingNotes: event.target.value }))} />
              </Field>
            </div>
          </DataCard>
          <DataCard>
            <h2 className="mb-4 text-lg font-black text-white">المجموعات والخصومات</h2>
            <div className="space-y-2">
              {(patient.groups || []).length === 0 ? (
                <p className="text-sm text-slate-400">لا توجد مجموعات مرتبطة بهذا المريض.</p>
              ) : (
                patient.groups.map((membership) => (
                  <StatusBadge key={membership.id} tone="blue">{membership.group?.name}</StatusBadge>
                ))
              )}
            </div>
          </DataCard>
        </div>
      ) : null}

      {activeTab === 'teeth' ? (
        <DataCard>
          <div className="grid gap-5 lg:grid-cols-[320px_1fr] lg:items-start">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
              <img src="/images/teeth-chart.jpg" alt="خريطة ترقيم الأسنان من 1 إلى 32" className="w-full object-contain" />
            </div>
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-white">ملاحظات الأسنان</h2>
                  <p className="mt-1 text-sm text-slate-400">اكتب رقم السن من الصورة ثم الملاحظة. نفس طريقة صفحة الروشتة، والحفظ هنا داخل ملف المريض.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <SecondaryButton type="button" onClick={addToothRow}>إضافة سن</SecondaryButton>
                  <PrimaryButton type="button" onClick={() => saveToothRows()} disabled={savingTeeth}>
                    <Save className="h-4 w-4" />
                    {savingTeeth ? 'جاري الحفظ...' : 'حفظ الملاحظات'}
                  </PrimaryButton>
                </div>
              </div>
              <div className="space-y-3">
                {toothRows.map((item, index) => (
                  <div key={index} className="grid gap-3 md:grid-cols-[130px_1fr_auto]">
                    <Field label="رقم السن">
                      <select
                        className={inputClass}
                        value={item.toothNumber}
                        onChange={(event) => updateToothRow(index, 'toothNumber', event.target.value)}
                        onBlur={() => saveToothRows(toothRows, true)}
                      >
                        <option value="">اختر</option>
                        {Array.from({ length: 32 }, (_, toothIndex) => toothIndex + 1).map((number) => (
                          <option key={number} value={number}>سن {number}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="الملاحظة">
                      <input
                        className={inputClass}
                        value={item.note}
                        onChange={(event) => updateToothRow(index, 'note', event.target.value)}
                        onBlur={() => saveToothRows(toothRows, true)}
                        placeholder="مثال: تسوس، حشو، خلع، ألم عند الضغط..."
                      />
                    </Field>
                    {toothRows.length > 1 || item.toothNumber || item.note ? (
                      <SecondaryButton type="button" onClick={() => removeToothRow(index)} className="self-end text-red-300">
                        <Trash2 className="h-4 w-4" />
                        حذف
                      </SecondaryButton>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DataCard>
      ) : null}

      {false && activeTab === 'teeth' ? (
        <DataCard>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-white">ملاحظات كل سن</h2>
              <p className="mt-1 text-sm text-slate-400">اكتب ملاحظة لكل سن. يتم الحفظ تلقائياً عند الخروج من الخانة.</p>
            </div>
            <PrimaryButton type="button" onClick={() => saveTeethNotes()} disabled={savingTeeth}>
              <Save className="h-4 w-4" />
              {savingTeeth ? 'جاري الحفظ...' : 'حفظ الملاحظات'}
            </PrimaryButton>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {toothNumbers.map((tooth) => (
              <div key={tooth} className="rounded-2xl border border-white/10 bg-[#0d1225] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-sky-500/10 px-3 py-1 text-sm font-black text-sky-300">سن {tooth}</span>
                  {teethNotes[tooth] ? (
                    <button
                      type="button"
                      className="rounded-lg border border-rose-500/20 p-1.5 text-rose-300 hover:bg-rose-500/10"
                      onClick={() => {
                        const next = { ...teethNotes };
                        delete next[tooth];
                        setTeethNotes(next);
                        saveTeethNotes(next, true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <textarea
                  className={`${inputClass} min-h-[88px] resize-none`}
                  value={teethNotes[tooth] || ''}
                  placeholder="ملاحظة اختيارية"
                  onChange={(event) => setTeethNotes((current) => ({ ...current, [tooth]: event.target.value }))}
                  onBlur={() => saveTeethNotes(teethNotes, true)}
                />
              </div>
            ))}
          </div>
        </DataCard>
      ) : null}

      {activeTab === 'booking' ? (
        <DataCard>
          <div className="mb-5">
            <h2 className="text-lg font-black text-white">حجز موعد سريع</h2>
            <p className="mt-1 text-sm text-slate-400">اختر التاريخ والوقت والطبيب فقط. لا توجد خانة ملاحظات.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="الحجز باسم">
              <select className={inputClass} value={booking.targetType} onChange={(event) => setBooking((current) => ({ ...current, targetType: event.target.value }))}>
                <option value="SELF">المريض نفسه</option>
                <option value="FAMILY">أحد أفراد العائلة</option>
              </select>
            </Field>
            <Field label="نوع الحجز">
              <select className={inputClass} value={booking.appointmentType} onChange={(event) => setBooking((current) => ({ ...current, appointmentType: event.target.value }))}>
                <option value="SCHEDULED">حجز بموعد</option>
                <option value="WALK_IN">حجز بدون موعد</option>
              </select>
            </Field>
            {booking.targetType === 'FAMILY' ? (
              <Field label="اسم فرد العائلة">
                <input
                  className={inputClass}
                  value={booking.familyName}
                  onChange={(event) => setBooking((current) => ({ ...current, familyName: event.target.value }))}
                  placeholder="اكتب الاسم على نفس الرقم"
                />
              </Field>
            ) : null}
            <Field label="التاريخ">
              <select className={inputClass} value={booking.date} onChange={(event) => setBooking((current) => ({ ...current, date: event.target.value }))}>
                {buildNext14Days().map((date) => <option key={date} value={date}>{date}</option>)}
              </select>
            </Field>
            <Field label="الوقت">
              <select className={inputClass} value={booking.time} onChange={(event) => setBooking((current) => ({ ...current, time: event.target.value }))}>
                {timeOptions.map((time) => <option key={time} value={time}>{time}</option>)}
              </select>
            </Field>
            <Field label="الطبيب المتاح">
              <select className={inputClass} value={booking.doctorId} onChange={(event) => setBooking((current) => ({ ...current, doctorId: event.target.value }))}>
                {availableDoctors.length ? availableDoctors.map((doctor) => <option key={doctor.id} value={doctor.id}>د. {doctor.name}</option>) : <option value="">لا يوجد أطباء متاحون</option>}
              </select>
            </Field>
          </div>
          <div className="mt-5 flex justify-end">
            <PrimaryButton type="button" onClick={submitBooking} disabled={bookingLoading || !booking.doctorId}>
              <Calendar className="h-4 w-4" />
              {bookingLoading ? 'جاري الحجز...' : 'احجز'}
            </PrimaryButton>
          </div>
        </DataCard>
      ) : null}

      {activeTab === 'appointments' ? <List items={patient.appointments} empty="لا توجد مواعيد" render={(item) => (
        <Record key={item.id} title={`${item.service?.nameAr || item.service?.name || 'موعد'} - د. ${item.doctor?.name || '-'}`} meta={formatDateTime(item.scheduledTime)} badge={item.status} />
      )} /> : null}

      {activeTab === 'prescriptions' ? <List items={patient.prescriptions} empty="لا توجد روشتات محفوظة" render={(item) => (
        <Record key={item.id} title={item.diagnosis || 'روشتة بدون تشخيص'} meta={`${item.doctor?.name || '-'} - ${formatDateTime(item.createdAt)}`}>
          <ul className="mt-3 space-y-1 text-sm text-slate-300">
            {(Array.isArray(item.medications) ? item.medications : []).map((medication, index) => (
              <li key={index}>{medicationLine(medication, index)}</li>
            ))}
          </ul>
          {item.notes ? <p className="mt-3 text-sm text-amber-200">{item.notes}</p> : null}
        </Record>
      )} /> : null}

      {activeTab === 'payments' ? <List items={patient.payments} empty="لا توجد مدفوعات" render={(item) => (
        <Record key={item.id} title={item.service?.nameAr || item.appointment?.service?.nameAr || 'دفع'} meta={`${money(item.paidAmount)} مدفوع من ${money(item.finalAmount)}`} badge={item.status} />
      )} /> : null}

      {activeTab === 'consultations' ? <List items={patient.consultations} empty="لا توجد استشارات" render={(item) => (
        <Record key={item.id} title={item.question || 'استشارة'} meta={`${item.doctor?.name || 'بدون طبيب'} - ${formatDateTime(item.createdAt)}`} badge={item.status}>
          {item.reply ? <p className="mt-3 text-sm text-emerald-200">{item.reply}</p> : null}
        </Record>
      )} /> : null}

      {activeTab === 'messages' ? <List items={patient.messages} empty="لا توجد رسائل" render={(item) => (
        <Record key={item.id} title={item.content} meta={`${item.platform} - ${formatDateTime(item.createdAt)}`} badge={item.type} />
      )} /> : null}
    </AppLayout>
  );
}

function List({ items = [], empty, render }) {
  if (!items.length) return <DataCard className="text-center">{empty}</DataCard>;
  return <div className="grid gap-4">{items.map(render)}</div>;
}

function Record({ title, meta, badge, children }) {
  return (
    <DataCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-400">{meta}</p>
        </div>
        {badge ? <StatusBadge tone="slate">{badge}</StatusBadge> : null}
      </div>
      {children}
    </DataCard>
  );
}
