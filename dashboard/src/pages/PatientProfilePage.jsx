import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, CreditCard, FileText, MessageSquare, Save, Stethoscope, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { DataCard, Field, PageHeader, PrimaryButton, SecondaryButton, StatCard, StatusBadge, inputClass } from '../components/ui';
import { formatDateTime, money } from '../utils/appointmentUi';

const tabs = [
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

export default function PatientProfilePage() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [draft, setDraft] = useState({ displayName: '', notes: '', accountingNotes: '', creditBalance: 0 });

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
    } catch (error) {
      toast.error(error.message || 'فشل تحميل ملف المريض');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatient();
  }, [id]);

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
        <DataCard>جاري تحميل ملف المريض...</DataCard>
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
        title={patient.displayName || patient.name || 'ملف المريض'}
        description={`${patient.phone || '-'} - ${patient.platform || 'WHATSAPP'}`}
        actions={
          <>
            <SecondaryButton type="button" onClick={() => window.history.back()}>رجوع</SecondaryButton>
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
