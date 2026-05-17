import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, FileText, MessageSquare, Save, Stethoscope, UserRound, Wallet } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import ManualBookingPanel from '../components/appointments/ManualBookingPanel';
import AppointmentCard from '../components/appointments/AppointmentCard';
import ConversationView from '../components/messages/ConversationView';
import RevenueReport from '../components/payments/RevenueReport';
import TeethChart from '../components/teeth/TeethChart';
import { DataCard, Field, PageHeader, PageLoader, PrimaryButton, SecondaryButton, StatCard, StatusBadge, inputClass } from '../components/ui';
import EmptyState from '../components/EmptyState';
import { confirmDialog, promptDialog } from '../components/dialogs';
import { formatDateTime, money } from '../utils/appointmentUi';
import { PrescriptionsWorkspace } from './PrescriptionsPage';

const PLATFORMS = ['WHATSAPP', 'FACEBOOK', 'INSTAGRAM'];

const tabs = [
  { id: 'info', label: 'معلومات عامة', icon: UserRound },
  { id: 'notes', label: 'الملاحظات', icon: UserRound },
  { id: 'booking', label: 'حجز موعد', icon: CalendarDays },
  { id: 'appointments', label: 'المواعيد', icon: CalendarDays },
  { id: 'prescriptions', label: 'الروشتات', icon: FileText },
  { id: 'payments', label: 'المدفوعات', icon: Wallet },
  { id: 'messages', label: 'الرسائل', icon: MessageSquare },
  { id: 'fullFile', label: 'الملف الكامل', icon: FileText },
];

const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2 text-sm">
    <span className="text-slate-400">{label}</span>
    <span className="font-bold text-white" dir="auto">{value || '—'}</span>
  </div>
);

const medicationLine = (medication, index) => {
  if (typeof medication === 'string') return `${index + 1}. ${medication}`;
  return `${index + 1}. ${[medication?.name, medication?.dosage, medication?.frequency, medication?.duration].filter(Boolean).join(' - ')}`;
};

export default function PatientProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [showTeeth, setShowTeeth] = useState(true);
  const [prescriptionAppointmentRef, setPrescriptionAppointmentRef] = useState('');
  const [teethSaveSignal, setTeethSaveSignal] = useState(0);
  const [draft, setDraft] = useState({
    name: '',
    phone: '',
    age: '',
    gender: '',
    platform: 'WHATSAPP',
    displayName: '',
    notes: '',
    accountNotes: '',
    accountingNotes: '',
    creditBalance: 0,
  });

  const loadPatient = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/patients/${id}`);
      const nextPatient = res.data.patient;
      setPatient(nextPatient);
      setDraft({
        name: nextPatient.name || '',
        phone: nextPatient.phone || '',
        age: nextPatient.age ?? '',
        gender: nextPatient.gender || '',
        platform: nextPatient.platform || 'WHATSAPP',
        displayName: nextPatient.displayName || '',
        notes: nextPatient.notes || '',
        accountNotes: nextPatient.accountNotes || '',
        accountingNotes: nextPatient.accountingNotes || '',
        creditBalance: nextPatient.creditBalance ?? nextPatient.accountBalance ?? 0,
      });
    } catch (error) {
      toast.error(error.message || 'فشل تحميل ملف المريض');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatient();
  }, [id]);

  const stats = useMemo(() => {
    const appointments = patient?.appointments || [];
    const payments = patient?.payments || [];
    return {
      appointments: appointments.length,
      prescriptions: patient?.prescriptions?.length || 0,
      paid: payments.reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0),
      debt: payments.reduce((sum, payment) => sum + Math.max(0, Number(payment.finalAmount || 0) - Number(payment.paidAmount || 0)), 0),
    };
  }, [patient]);

  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const saveNotes = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/patients/${id}`, draft);
      setPatient((current) => ({ ...current, ...res.data.patient }));
      toast.success('تم حفظ بيانات المريض');
      return true;
    } catch (error) {
      toast.error(error.message || 'فشل حفظ بيانات المريض');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveAllNotes = async () => {
    const saved = await saveNotes();
    if (saved) setTeethSaveSignal((current) => current + 1);
  };

  const handleAppointmentAction = async (appointment, action) => {
    try {
      if (action === 'complete') {
        const ok = await confirmDialog({
          title: 'تأكيد إكمال الكشف',
          message: 'هل تم الكشف على المريض؟',
          confirmLabel: 'تم الكشف',
          tone: 'primary',
        });
        if (!ok) return;
        await api.post(`/appointments/${appointment.id}/complete`);
        toast.success('تم تسجيل الموعد كمكتمل');
      }
      if (action === 'no-show') {
        const ok = await confirmDialog({
          title: 'تسجيل عدم الحضور',
          message: 'تسجيل هذا الحجز كـ "لم يأت"؟',
          confirmLabel: 'لم يأت',
        });
        if (!ok) return;
        await api.post(`/appointments/${appointment.id}/no-show`);
        toast.success('تم تسجيل الحجز كـ لم يأت');
      }
      if (action === 'cancel') {
        const reason = await promptDialog({
          title: 'إلغاء الحجز',
          message: 'اكتب سبب الإلغاء — سيتم إبلاغ المريض.',
          multiline: true,
          required: true,
          confirmLabel: 'إلغاء الحجز',
          tone: 'danger',
        });
        if (reason === null) return;
        await api.post(`/appointments/${appointment.id}/cancel`, { reason });
        toast.success('تم إلغاء الحجز');
      }
      await loadPatient();
    } catch (error) {
      toast.error(error.message || 'تعذر تنفيذ العملية');
    }
  };

  const handleQueueAssign = async (appointment) => {
    try {
      await api.post(`/appointments/${appointment.id}/assign-queue-position`);
      toast.success('تمت إضافة المريض إلى الدور');
      await loadPatient();
    } catch (error) {
      toast.error(error.message || 'فشل إضافة الدور');
    }
  };

  const handleQueueChange = async (appointment, position, mode) => {
    try {
      await api.patch(`/appointments/${appointment.id}/queue-position`, { position, mode });
      toast.success('تم تحديث الدور');
      await loadPatient();
    } catch (error) {
      toast.error(error.message || 'فشل تحديث الدور');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <DataCard>
          <PageLoader />
        </DataCard>
      </AppLayout>
    );
  }

  if (!patient) {
    return (
      <AppLayout>
        <EmptyState title="المريض غير موجود" description="تعذر العثور على ملف المريض." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title={patient.displayName || patient.name}
        description={`${patient.phone || 'بدون رقم'} · ${patient.platform || 'WHATSAPP'}`}
        actions={
          <>
            <StatusBadge tone={patient.profileType === 'BOOKED' ? 'green' : 'amber'}>
              {patient.profileType === 'BOOKED' ? 'مريض حجز' : 'تواصل فقط'}
            </StatusBadge>
            {patient.phone ? (
              <>
                <SecondaryButton
                  type="button"
                  onClick={() => window.open(`https://wa.me/${String(patient.phone).replace(/\D/g, '')}`, '_blank')}
                >
                  واتساب
                </SecondaryButton>
                <SecondaryButton type="button" onClick={() => window.open(`tel:${patient.phone}`)}>
                  اتصال
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(patient.phone);
                    toast.success('تم نسخ الرقم');
                  }}
                >
                  نسخ الرقم
                </SecondaryButton>
              </>
            ) : null}
            <PrimaryButton type="button" onClick={() => setActiveTab('booking')}>
              حجز موعد
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => navigate('/today-patients')}>مرضى اليوم</SecondaryButton>
          </>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="المواعيد" value={stats.appointments} icon={CalendarDays} tone="blue" />
        <StatCard title="الروشتات" value={stats.prescriptions} icon={FileText} tone="slate" />
        <StatCard title="المدفوع" value={money(stats.paid)} icon={Wallet} tone="green" />
        <StatCard title="الدين" value={money(stats.debt)} icon={Wallet} tone="amber" />
      </div>

      <DataCard className="mb-6">
        <div
          role="tablist"
          aria-label="أقسام ملف المريض"
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  if (tab.id === 'prescriptions') setPrescriptionAppointmentRef('');
                  setActiveTab(tab.id);
                }}
                className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-black transition ${
                  selected ? 'bg-sky-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </DataCard>

      {activeTab === 'info' ? (
        (() => {
          const appointments = patient.appointments || [];
          const lastVisit = appointments
            .map((item) => item.scheduledTime)
            .filter(Boolean)
            .sort((a, b) => new Date(b) - new Date(a))[0];
          const groupNames = (patient.groups || [])
            .map((group) => group.group?.name || group.name)
            .filter(Boolean)
            .join('، ');
          return (
            <div className="grid gap-4 lg:grid-cols-2">
              <DataCard className="lg:col-span-2">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-white">المعلومات العامة</h3>
                    <p className="mt-1 text-sm text-slate-400">تعديل بيانات المريض الأساسية من نفس الصفحة.</p>
                  </div>
                  <PrimaryButton type="button" onClick={saveNotes} disabled={saving}>
                    <Save className="h-4 w-4" />
                    حفظ البيانات
                  </PrimaryButton>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="اسم المريض">
                    <input className={inputClass} value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} />
                  </Field>
                  <Field label="اسم العرض">
                    <input className={inputClass} value={draft.displayName} onChange={(event) => updateDraft('displayName', event.target.value)} />
                  </Field>
                  <Field label="رقم الهاتف">
                    <input className={inputClass} value={draft.phone} onChange={(event) => updateDraft('phone', event.target.value)} dir="ltr" />
                  </Field>
                  <Field label="العمر">
                    <input className={inputClass} type="number" min="0" value={draft.age} onChange={(event) => updateDraft('age', event.target.value)} />
                  </Field>
                  <Field label="النوع">
                    <select className={inputClass} value={draft.gender} onChange={(event) => updateDraft('gender', event.target.value)}>
                      <option value="">غير محدد</option>
                      <option value="male">ذكر</option>
                      <option value="female">أنثى</option>
                    </select>
                  </Field>
                  <Field label="المنصة">
                    <select className={inputClass} value={draft.platform} onChange={(event) => updateDraft('platform', event.target.value)}>
                      {PLATFORMS.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="رصيد / دين">
                    <input className={inputClass} type="number" value={draft.creditBalance} onChange={(event) => updateDraft('creditBalance', event.target.value)} />
                  </Field>
                </div>
              </DataCard>
              <DataCard className="lg:col-span-2">
                <h3 className="mb-3 text-lg font-black text-white">القناة والمعرّفات والتواريخ</h3>
                <div className="grid gap-x-8 md:grid-cols-2">
                  <div>
                    <InfoRow label="البريد" value={patient.email} />
                    <InfoRow
                      label="نوع الملف"
                      value={patient.profileType === 'BOOKED' ? 'مريض حجز' : 'تواصل فقط'}
                    />
                    <InfoRow label="المجموعات" value={groupNames} />
                    <InfoRow label="تاريخ الإنشاء" value={patient.createdAt ? formatDateTime(patient.createdAt) : ''} />
                    <InfoRow label="آخر زيارة" value={lastVisit ? formatDateTime(lastVisit) : 'لا يوجد'} />
                  </div>
                  <div>
                    <InfoRow label="WhatsApp ID" value={patient.whatsappId} />
                    <InfoRow label="Facebook ID" value={patient.facebookId} />
                    <InfoRow label="Instagram ID" value={patient.instagramId} />
                    <InfoRow label="ManyChat ID" value={patient.manychatSubscriberId || patient.manychatContactId} />
                  </div>
                </div>
              </DataCard>
            </div>
          );
        })()
      ) : null}

      {activeTab === 'notes' ? (
        <div className="space-y-4">
          <DataCard className="space-y-4">
            <div>
              <h3 className="text-lg font-black text-white">الملاحظات</h3>
              <p className="mt-1 text-sm text-slate-400">ملاحظات طبية وإدارية وحسابية / شكوى مرتبطة بملف المريض.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="ملاحظات طبية">
                <textarea className={inputClass} rows={5} value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} />
              </Field>
              <Field label="ملاحظات إدارية">
                <textarea className={inputClass} rows={5} value={draft.accountNotes} onChange={(event) => updateDraft('accountNotes', event.target.value)} />
              </Field>
              <Field label="ملاحظات حسابية / شكوى">
                <textarea className={inputClass} rows={5} value={draft.accountingNotes} onChange={(event) => updateDraft('accountingNotes', event.target.value)} />
              </Field>
            </div>
          </DataCard>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowTeeth((current) => !current)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 transition hover:bg-white/10"
            >
              {showTeeth ? 'إخفاء خريطة الأسنان' : 'إظهار خريطة الأسنان'}
            </button>
          </div>

          {showTeeth ? (
            <TeethChart
              patientId={patient.id}
              value={patient.teethNotes || {}}
              saveSignal={teethSaveSignal}
              showSaveButton={false}
              onSaved={(teethNotes) => setPatient((current) => ({ ...current, teethNotes }))}
            />
          ) : null}

          <div className="sticky bottom-4 z-10 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#0b1020]/90 p-3 backdrop-blur-xl">
            <PrimaryButton type="button" onClick={saveAllNotes} disabled={saving}>
              <Save className="h-4 w-4" />
              حفظ الكل
            </PrimaryButton>
            <SecondaryButton type="button" onClick={saveNotes} disabled={saving}>
              حفظ الملاحظات
            </SecondaryButton>
            <SecondaryButton type="button" onClick={() => setTeethSaveSignal((current) => current + 1)}>
              حفظ خريطة الأسنان
            </SecondaryButton>
          </div>
        </div>
      ) : null}

      {activeTab === 'booking' ? (
        <ManualBookingPanel initialPatientId={patient.id} initialPhone={patient.phone || ''} onCreated={loadPatient} />
      ) : null}

      {activeTab === 'appointments' ? (
        (patient.appointments || []).length === 0 ? (
          <DataCard>
            <EmptyState title="لا توجد مواعيد" description="لم يتم حجز أي موعد لهذا المريض بعد." />
          </DataCard>
        ) : (
          <div className="grid gap-4">
            {(patient.appointments || []).map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={{ ...appointment, patient }}
                compact
                onComplete={(item) => handleAppointmentAction(item, 'complete')}
                onNoShow={(item) => handleAppointmentAction(item, 'no-show')}
                onCancel={(item) => handleAppointmentAction(item, 'cancel')}
                onQueueAssign={handleQueueAssign}
                onQueueChange={handleQueueChange}
                onCreatePrescription={() => {
                  setPrescriptionAppointmentRef(appointment.bookingRef || appointment.id || '');
                  setActiveTab('prescriptions');
                }}
              />
            ))}
          </div>
        )
      ) : null}

      {activeTab === 'prescriptions' ? (
        <PrescriptionsWorkspace
          embedded
          initialPatientId={patient.id}
          initialAppointmentId={prescriptionAppointmentRef}
          onCreated={loadPatient}
        />
      ) : null}


      {activeTab === 'payments' ? <RevenueReport patientId={patient.id} compact /> : null}

      {activeTab === 'messages' ? <ConversationView patientId={patient.id} platform={patient.platform} /> : null}


      {activeTab === 'fullFile' ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <PrimaryButton type="button" onClick={() => window.print()}>
              طباعة الملف
            </PrimaryButton>
          </div>
          <DataCard>
            <div id="patient-full-file" className="space-y-5">
              <header className="border-b border-white/10 pb-4">
                <h3 className="text-2xl font-black text-white">الملف الكامل — {patient.displayName || patient.name}</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {patient.phone || 'بدون رقم'} · {patient.platform || 'WHATSAPP'} ·{' '}
                  {patient.gender === 'female' ? 'أنثى' : patient.gender === 'male' ? 'ذكر' : 'النوع غير محدد'}
                  {patient.age ? ` · العمر ${patient.age}` : ''}
                </p>
              </header>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-slate-400">المواعيد</p>
                  <p className="text-lg font-black text-white">{stats.appointments}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-slate-400">الروشتات</p>
                  <p className="text-lg font-black text-white">{stats.prescriptions}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-slate-400">المدفوع</p>
                  <p className="text-lg font-black text-emerald-300">{money(stats.paid)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-slate-400">الدين</p>
                  <p className="text-lg font-black text-amber-300">{money(stats.debt)}</p>
                </div>
              </div>

              <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h4 className="mb-2 font-black text-white">الملاحظات</h4>
                <p className="text-sm leading-7 text-slate-300"><span className="text-slate-500">طبية:</span> {patient.notes || '—'}</p>
                <p className="text-sm leading-7 text-slate-300"><span className="text-slate-500">إدارية:</span> {patient.accountNotes || '—'}</p>
                <p className="text-sm leading-7 text-slate-300"><span className="text-slate-500">حسابية / شكوى:</span> {patient.accountingNotes || '—'}</p>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h4 className="mb-3 font-black text-white">المواعيد ({stats.appointments})</h4>
                {(patient.appointments || []).length === 0 ? (
                  <p className="text-sm text-slate-500">لا توجد مواعيد.</p>
                ) : (
                  <div className="space-y-2">
                    {(patient.appointments || []).map((appointment) => (
                      <div key={appointment.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2 text-sm">
                        <span className="font-bold text-white">{appointment.service?.nameAr || appointment.service?.name || 'خدمة'}</span>
                        <span className="text-slate-400">د. {appointment.doctor?.name || '-'} · {formatDateTime(appointment.scheduledTime)}</span>
                        <StatusBadge>{appointment.status}</StatusBadge>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h4 className="mb-3 font-black text-white">الروشتات ({stats.prescriptions})</h4>
                {(patient.prescriptions || []).length === 0 ? (
                  <p className="text-sm text-slate-500">لا توجد روشتات.</p>
                ) : (
                  <div className="space-y-3">
                    {(patient.prescriptions || []).map((prescription) => (
                      <div key={prescription.id} className="border-b border-white/5 pb-2">
                        <p className="font-bold text-white">{prescription.diagnosis || 'بدون تشخيص'}</p>
                        <p className="text-xs text-slate-400">د. {prescription.doctor?.name || '-'} · {formatDateTime(prescription.createdAt)}</p>
                        <div className="mt-1 text-sm text-slate-300">
                          {(prescription.medications || []).map((medication, index) => (
                            <p key={index}>{medicationLine(medication, index)}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h4 className="mb-3 font-black text-white">ملاحظات الأسنان</h4>
                {Object.keys(patient.teethNotes || {}).length === 0 ? (
                  <p className="text-sm text-slate-500">لا توجد ملاحظات أسنان.</p>
                ) : (
                  <div className="space-y-1 text-sm text-slate-300">
                    {Object.entries(patient.teethNotes || {}).map(([tooth, value]) => {
                      const entry = typeof value === 'string' ? { note: value } : value || {};
                      return (
                        <p key={tooth}>
                          <span className="font-bold text-white">سن {tooth}:</span> {entry.note || '—'}
                          {entry.serviceName ? ` · ${entry.serviceName}` : ''}
                          {entry.done != null ? (entry.done ? ' · ✅ تمت' : ' · ⏳ لم تتم') : ''}
                        </p>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </DataCard>
        </div>
      ) : null}
    </AppLayout>
  );
}
