import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Search, Send, Square } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { DataCard, Field, PageHeader, PrimaryButton, SecondaryButton, StatusBadge, inputClass } from '../components/ui';

const steps = ['اختيار المراجعين', 'الرسالة', 'مراجعة وإرسال'];

export default function SendOffersPage() {
  const [step, setStep] = useState(0);
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const loadPatients = async () => {
      setLoading(true);
      try {
        const res = await api.get('/patients', { params: { limit: 500 } });
        setPatients(res.data.patients || []);
      } catch (error) {
        toast.error(error.message || 'فشل تحميل المراجعين');
      } finally {
        setLoading(false);
      }
    };
    loadPatients();
  }, []);

  const filteredPatients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return patients;
    return patients.filter((patient) =>
      [patient.name, patient.displayName, patient.phone, patient.email].filter(Boolean).some((value) => String(value).toLowerCase().includes(term))
    );
  }, [patients, searchTerm]);

  const allFilteredSelected = filteredPatients.length > 0 && filteredPatients.every((patient) => selectedIds.includes(patient.id));

  const togglePatient = (id) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const toggleAllFiltered = () => {
    const filteredIds = filteredPatients.map((patient) => patient.id);
    setSelectedIds((current) => {
      if (filteredIds.every((id) => current.includes(id))) return current.filter((id) => !filteredIds.includes(id));
      return [...new Set([...current, ...filteredIds])];
    });
  };

  const sendOffers = async () => {
    if (!selectedIds.length) return toast.warn('اختر مراجعين أولاً');
    if (!message.trim()) return toast.warn('اكتب نص العرض أولاً');

    setSending(true);
    try {
      const res = await api.post('/campaigns/send-offers', { reviewerIds: selectedIds, message });
      toast.success(`تم الإرسال: نجح ${res.data.successCount || 0}، فشل ${res.data.failCount || 0}`);
      setStep(0);
      setSelectedIds([]);
      setMessage('');
    } catch (error) {
      toast.error(error.message || 'فشل إرسال العروض');
    } finally {
      setSending(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title="إرسال عروض جماعي" description="اختر مراجعين محددين، اكتب الرسالة، ثم راجع العدد قبل الإرسال." />

      <DataCard className="mb-6">
        <div className="flex flex-wrap gap-2">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                step === index ? 'bg-sky-500 text-white' : index < step ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-slate-300'
              }`}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>
      </DataCard>

      {step === 0 ? (
        <DataCard>
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input className={`${inputClass} pr-10`} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="بحث بالاسم أو الهاتف أو البريد" />
            </div>
            <SecondaryButton type="button" onClick={toggleAllFiltered}>
              {allFilteredSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              اختر الكل ({filteredPatients.length})
            </SecondaryButton>
          </div>

          {loading ? (
            <p className="text-slate-400">جاري التحميل...</p>
          ) : (
            <div className="grid max-h-[58vh] gap-3 overflow-auto md:grid-cols-2 xl:grid-cols-3">
              {filteredPatients.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => togglePatient(patient.id)}
                  className={`rounded-2xl border p-4 text-right transition ${
                    selectedIds.includes(patient.id) ? 'border-sky-500/50 bg-sky-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-white">{patient.displayName || patient.name || 'مراجع'}</h3>
                      <p className="mt-1 text-sm text-slate-400" dir="ltr">{patient.phone || '-'}</p>
                      {patient.email ? <p className="mt-1 text-xs text-slate-500">{patient.email}</p> : null}
                    </div>
                    {selectedIds.includes(patient.id) ? <CheckSquare className="h-5 w-5 text-sky-300" /> : <Square className="h-5 w-5 text-slate-500" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 flex justify-between gap-2">
            <StatusBadge tone="blue">المحددون: {selectedIds.length}</StatusBadge>
            <PrimaryButton type="button" onClick={() => setStep(1)} disabled={!selectedIds.length}>التالي</PrimaryButton>
          </div>
        </DataCard>
      ) : null}

      {step === 1 ? (
        <DataCard>
          <Field label="نص العرض">
            <textarea
              className={`${inputClass} min-h-[220px]`}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="اكتب العرض هنا. يمكنك استخدام {{name}} لاسم المريض و {{phone}} لرقم الهاتف."
            />
          </Field>
          <div className="mt-5 flex justify-between gap-2">
            <SecondaryButton type="button" onClick={() => setStep(0)}>السابق</SecondaryButton>
            <PrimaryButton type="button" onClick={() => setStep(2)} disabled={!message.trim()}>التالي</PrimaryButton>
          </div>
        </DataCard>
      ) : null}

      {step === 2 ? (
        <DataCard>
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-slate-400">عدد المتلقين</p>
              <p className="mt-1 text-3xl font-black text-white">{selectedIds.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0d1225] p-4">
              <p className="mb-2 text-sm font-bold text-slate-300">معاينة الرسالة</p>
              <p className="whitespace-pre-wrap text-sm leading-7 text-white">{message}</p>
            </div>
          </div>
          <div className="mt-5 flex justify-between gap-2">
            <SecondaryButton type="button" onClick={() => setStep(1)}>السابق</SecondaryButton>
            <PrimaryButton type="button" onClick={sendOffers} disabled={sending}>
              <Send className="h-4 w-4" />
              {sending ? 'جاري الإرسال...' : 'إرسال'}
            </PrimaryButton>
          </div>
        </DataCard>
      ) : null}
    </AppLayout>
  );
}
