import { useEffect, useState } from 'react';
import { HelpCircle, MessageSquare, Send } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { DataCard, PageHeader, PrimaryButton, StatCard, StatusBadge, inputClass } from '../components/ui';
import { formatDateTime } from '../utils/appointmentUi';

const statusLabels = {
  PENDING: 'قيد الانتظار',
  REPLIED: 'تم الرد',
  CLOSED: 'مغلقة',
};

const statusTone = {
  PENDING: 'amber',
  REPLIED: 'green',
  CLOSED: 'slate',
};

const getPatientName = (consultation) =>
  consultation?.patientName || consultation?.patient?.displayName || consultation?.patient?.name || 'مريض غير معروف';

const getQuestionText = (consultation) =>
  consultation?.message || consultation?.question || consultation?.symptoms || consultation?.content || '';

export default function ConsultationsPage() {
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [replying, setReplying] = useState(false);

  const fetchConsultations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/consultations');
      const data = res.data || [];
      setConsultations(data);
      setSelectedInquiry((current) => data.find((item) => item.id === current?.id) || data[0] || null);
    } catch (error) {
      toast.error('فشل تحميل الاستشارات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultations();
  }, []);

  const handleReply = async (event) => {
    event.preventDefault();
    if (!selectedInquiry || !replyText.trim()) return;

    try {
      setReplying(true);
      await api.post(`/consultations/${selectedInquiry.id}/reply`, { reply: replyText });
      toast.success('تم إرسال الرد');
      setReplyText('');
      fetchConsultations();
    } catch (error) {
      toast.error('فشل إرسال الرد');
    } finally {
      setReplying(false);
    }
  };

  const filteredConsultations = consultations.filter((consultation) => {
    if (activeFilter !== 'ALL' && consultation.status !== activeFilter) return false;
    const haystack = `${getPatientName(consultation)} ${consultation.patient?.phone || ''} ${getQuestionText(consultation)}`.toLowerCase();
    return !searchTerm || haystack.includes(searchTerm.toLowerCase());
  });

  const stats = {
    total: consultations.length,
    pending: consultations.filter((item) => item.status === 'PENDING').length,
    replied: consultations.filter((item) => item.status === 'REPLIED').length,
    closed: consultations.filter((item) => item.status === 'CLOSED').length,
  };

  return (
    <AppLayout>
      <PageHeader
        title="الاستشارات"
        description="متابعة أسئلة المرضى الطبية والرد عليها من لوحة التحكم."
      />

      <DataCard className="mb-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-sky-500/10 p-3 text-sky-300">
            <HelpCircle className="h-6 w-6" />
          </div>
          <div className="space-y-2 text-sm leading-7 text-slate-300">
            <h2 className="text-lg font-black text-white">شرح استخدام صفحة الاستشارات</h2>
            <p>الاستشارة قيد الانتظار تعني أن المريض أرسل سؤالاً يحتاج رد طبي أو إداري. بعد كتابة الرد وإرساله تتغير الحالة إلى تم الرد.</p>
            <p>لو السؤال يحتاج كشف، اكتب للمريض أن الحالة تحتاج فحص ثم أنشئ له موعد من صفحة إضافة مريض / موعد. لا تكتب تشخيص نهائي من غير كشف.</p>
            <p>الرد يُرسل للمريض على القناة المرتبطة به، ويتسجل في ملف المريض للرجوع له لاحقاً.</p>
          </div>
        </div>
      </DataCard>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="الإجمالي" value={stats.total} icon={MessageSquare} tone="blue" />
        <StatCard title="قيد الانتظار" value={stats.pending} icon={MessageSquare} tone="amber" />
        <StatCard title="تم الرد" value={stats.replied} icon={MessageSquare} tone="green" />
        <StatCard title="مغلقة" value={stats.closed} icon={MessageSquare} tone="slate" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <DataCard className="p-0">
          <div className="border-b border-white/10 p-4">
            <input className={inputClass} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="بحث في الاستشارات" />
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {['ALL', 'PENDING', 'REPLIED', 'CLOSED'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setActiveFilter(status)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                    activeFilter === status ? 'bg-sky-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {status === 'ALL' ? 'الكل' : statusLabels[status]}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[620px] divide-y divide-white/5 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-slate-400">جاري التحميل...</div>
            ) : filteredConsultations.length === 0 ? (
              <div className="p-6 text-slate-400">لا توجد استشارات.</div>
            ) : (
              filteredConsultations.map((consultation) => (
                <button
                  key={consultation.id}
                  type="button"
                  onClick={() => setSelectedInquiry(consultation)}
                  className={`w-full p-4 text-right transition hover:bg-white/5 ${
                    selectedInquiry?.id === consultation.id ? 'bg-sky-500/10' : ''
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="truncate font-bold text-white">{getPatientName(consultation)}</h3>
                    <StatusBadge tone={statusTone[consultation.status]}>{statusLabels[consultation.status]}</StatusBadge>
                  </div>
                  <p className="line-clamp-2 text-sm text-slate-400">{getQuestionText(consultation)}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatDateTime(consultation.createdAt)}</p>
                </button>
              ))
            )}
          </div>
        </DataCard>

        <DataCard className="flex min-h-[560px] flex-col">
          {selectedInquiry ? (
            <>
              <div className="border-b border-white/10 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-white">{getPatientName(selectedInquiry)}</h2>
                    <p className="mt-1 text-sm text-slate-400">{formatDateTime(selectedInquiry.createdAt)}</p>
                  </div>
                  <StatusBadge tone={statusTone[selectedInquiry.status]}>{statusLabels[selectedInquiry.status]}</StatusBadge>
                </div>
              </div>

              <div className="flex-1 space-y-4 py-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="mb-2 text-sm font-bold text-slate-300">السؤال</p>
                  <p className="text-sm leading-7 text-white">{getQuestionText(selectedInquiry)}</p>
                </div>
                {selectedInquiry.reply ? (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <p className="mb-2 text-sm font-bold text-emerald-200">الرد السابق</p>
                    <p className="text-sm leading-7 text-emerald-100">{selectedInquiry.reply}</p>
                  </div>
                ) : null}
              </div>

              {selectedInquiry.status !== 'CLOSED' ? (
                <form onSubmit={handleReply} className="border-t border-white/10 pt-4">
                  <textarea className={`${inputClass} min-h-[120px]`} value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="اكتب الرد الطبي أو الإداري هنا..." />
                  <PrimaryButton type="submit" disabled={replying || !replyText.trim()} className="mt-3 w-full">
                    <Send className="h-4 w-4" />
                    إرسال الرد
                  </PrimaryButton>
                </form>
              ) : null}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-slate-500">
              <MessageSquare className="mb-3 h-12 w-12" />
              اختر استشارة من القائمة
            </div>
          )}
        </DataCard>
      </div>
    </AppLayout>
  );
}
