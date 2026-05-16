import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, FileText, MessageSquare, Save, Stethoscope, UserRound, Wallet } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import ManualBookingPanel from '../components/appointments/ManualBookingPanel';
import ConversationView from '../components/messages/ConversationView';
import RevenueReport from '../components/payments/RevenueReport';
import PrescriptionForm from '../components/prescriptions/PrescriptionForm';
import TeethChart from '../components/teeth/TeethChart';
import { DataCard, Field, PageHeader, PageLoader, PrimaryButton, SecondaryButton, StatCard, StatusBadge, inputClass } from '../components/ui';
import EmptyState from '../components/EmptyState';
import { formatDateTime, money } from '../utils/appointmentUi';

const tabs = [
  { id: 'notes', label: 'الملاحظات', icon: UserRound },
  { id: 'booking', label: 'حجز موعد', icon: CalendarDays },
  { id: 'appointments', label: 'المواعيد', icon: CalendarDays },
  { id: 'prescriptions', label: 'الروشتات', icon: FileText },
  { id: 'payments', label: 'المدفوعات', icon: Wallet },
  { id: 'messages', label: 'الرسائل', icon: MessageSquare },
  { id: 'teeth', label: 'الأسنان', icon: Stethoscope },
  { id: 'fullFile', label: 'الملف الكامل', icon: FileText },
];

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
  const [activeTab, setActiveTab] = useState('notes');
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [draft, setDraft] = useState({
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
    } catch (error) {
      toast.error(error.message || 'فشل حفظ بيانات المريض');
    } finally {
      setSaving(false);
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
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${
                  activeTab === tab.id ? 'bg-sky-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </DataCard>

      {activeTab === 'notes' ? (
        <DataCard className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="اسم العرض">
              <input className={inputClass} value={draft.displayName} onChange={(event) => updateDraft('displayName', event.target.value)} />
            </Field>
            <Field label="رصيد / دين">
              <input className={inputClass} type="number" value={draft.creditBalance} onChange={(event) => updateDraft('creditBalance', event.target.value)} />
            </Field>
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
          <PrimaryButton type="button" onClick={saveNotes} disabled={saving}>
            <Save className="h-4 w-4" />
            حفظ الملاحظات
          </PrimaryButton>
        </DataCard>
      ) : null}

      {activeTab === 'booking' ? (
        <ManualBookingPanel initialPatientId={patient.id} initialPhone={patient.phone || ''} onCreated={loadPatient} />
      ) : null}

      {activeTab === 'appointments' ? (
        <DataCard>
          <div className="grid gap-3">
            {(patient.appointments || []).map((appointment) => (
              <div key={appointment.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-black text-white">{appointment.service?.nameAr || appointment.service?.name || 'خدمة غير محددة'}</p>
                    <p className="text-sm text-slate-400">د. {appointment.doctor?.name || '-'} · {formatDateTime(appointment.scheduledTime)}</p>
                  </div>
                  <StatusBadge>{appointment.status}</StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </DataCard>
      ) : null}

      {activeTab === 'prescriptions' ? (
        <div className="space-y-5">
          <div className="flex justify-end">
            <PrimaryButton type="button" onClick={() => setShowPrescriptionForm((current) => !current)}>
              {showPrescriptionForm ? 'إغلاق النموذج' : 'إضافة روشتة'}
            </PrimaryButton>
          </div>
          {showPrescriptionForm ? <PrescriptionForm initialPatientId={patient.id} onCreated={loadPatient} /> : null}
          <DataCard>
            <div className="grid gap-3">
              {(patient.prescriptions || []).map((prescription) => (
                <div key={prescription.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-black text-white">{prescription.diagnosis || 'بدون تشخيص'}</p>
                  <p className="text-sm text-slate-400">د. {prescription.doctor?.name || '-'} · {formatDateTime(prescription.createdAt)}</p>
                  <div className="mt-2 text-sm text-slate-300">
                    {(prescription.medications || []).map((medication, index) => <p key={index}>{medicationLine(medication, index)}</p>)}
                  </div>
                </div>
              ))}
            </div>
          </DataCard>
        </div>
      ) : null}

      {activeTab === 'payments' ? <RevenueReport patientId={patient.id} compact /> : null}

      {activeTab === 'messages' ? <ConversationView patientId={patient.id} platform={patient.platform} /> : null}

      {activeTab === 'teeth' ? (
        <TeethChart
          patientId={patient.id}
          value={patient.teethNotes || {}}
          onSaved={(teethNotes) => setPatient((current) => ({ ...current, teethNotes }))}
        />
      ) : null}

      {activeTab === 'fullFile' ? (
        <DataCard className="space-y-5">
          <h3 className="text-xl font-black text-white">الملف الكامل</h3>
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h4 className="mb-2 font-black text-white">بيانات المريض</h4>
            <p className="text-sm leading-7 text-slate-300">الاسم: {patient.name}</p>
            <p className="text-sm leading-7 text-slate-300">الهاتف: {patient.phone || '-'}</p>
            <p className="text-sm leading-7 text-slate-300">الملاحظات: {patient.notes || '-'}</p>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h4 className="mb-2 font-black text-white">الملخص</h4>
            <p className="text-sm leading-7 text-slate-300">عدد المواعيد: {stats.appointments}</p>
            <p className="text-sm leading-7 text-slate-300">عدد الروشتات: {stats.prescriptions}</p>
            <p className="text-sm leading-7 text-slate-300">المدفوع: {money(stats.paid)}</p>
            <p className="text-sm leading-7 text-slate-300">الدين: {money(stats.debt)}</p>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h4 className="mb-2 font-black text-white">ملاحظات الأسنان</h4>
            <pre className="whitespace-pre-wrap text-sm text-slate-300">{JSON.stringify(patient.teethNotes || {}, null, 2)}</pre>
          </section>
        </DataCard>
      ) : null}
    </AppLayout>
  );
}
