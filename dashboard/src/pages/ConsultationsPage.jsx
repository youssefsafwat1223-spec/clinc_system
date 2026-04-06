import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock3, MessageSquare, Search, Send, Stethoscope, User, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';

const quickReplies = [
  'الأعراض تحتاج مراجعة إكلينيكية أقرب لتأكيد التشخيص بشكل دقيق.',
  'يمكن متابعة العلاج التحفظي أولًا مع العودة إذا زادت الأعراض أو استمرت.',
  'بناءً على الوصف الحالي، يفضل حجز كشف داخل العيادة لمراجعة الحالة بشكل مباشر.',
];

const statusLabels = {
  PENDING: 'قيد الانتظار',
  REPLIED: 'تم الرد',
  CLOSED: 'مغلقة',
};

function SummaryCard({ title, value, hint, icon: Icon, accentClass }) {
  return (
    <div className={`glass-card border p-5 ${accentClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-dark-muted">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-white">{value}</p>
          <p className="text-xs font-medium text-slate-400">{hint}</p>
        </div>
        <div className="rounded-2xl bg-dark-bg/70 p-3">
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const classes =
    status === 'PENDING'
      ? 'bg-amber-500/10 text-amber-300 ring-amber-500/20'
      : status === 'REPLIED'
        ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
        : 'bg-slate-500/10 text-slate-300 ring-slate-500/20';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${classes}`}>
      {statusLabels[status] || status}
    </span>
  );
}

function formatDateTime(value) {
  return format(parseISO(value), 'dd MMM yyyy - hh:mm a', { locale: ar });
}

export default function ConsultationsPage() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isDoctor = user.role === 'DOCTOR';

  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [requestAppointment, setRequestAppointment] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');

  const fetchConsultations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/consultations');
      setConsultations(res.data || []);
      setSelectedInquiry((current) => {
        if (current && (res.data || []).some((consultation) => consultation.id === current.id)) {
          return (res.data || []).find((consultation) => consultation.id === current.id) || current;
        }

        return (res.data || [])[0] || null;
      });
    } catch (error) {
      toast.error('فشل في تحميل الاستشارات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultations();
  }, []);

  const handleReply = async (event) => {
    event.preventDefault();

    if (!selectedInquiry || !replyText.trim()) {
      return;
    }

    try {
      await api.post(`/consultations/${selectedInquiry.id}/reply`, {
        reply: replyText.trim(),
        requestAppointment,
      });

      toast.success('تم إرسال الرد للمريض بنجاح');
      setReplyText('');
      setRequestAppointment(false);
      await fetchConsultations();
    } catch (error) {
      toast.error('فشل في إرسال الرد');
    }
  };

  const handleClose = async (id) => {
    if (!window.confirm('هل أنت متأكد من إغلاق هذه الاستشارة؟')) {
      return;
    }

    try {
      await api.post(`/consultations/${id}/close`);
      toast.success('تم إغلاق الاستشارة');
      await fetchConsultations();
    } catch (error) {
      toast.error('فشل في إغلاق الاستشارة');
    }
  };

  const filteredConsultations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return consultations.filter((consultation) => {
      const matchesFilter = activeFilter === 'ALL' || consultation.status === activeFilter;
      const haystack = [
        consultation.patient?.name,
        consultation.patient?.phone,
        consultation.question,
        consultation.reply,
        consultation.doctor?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !query || haystack.includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, consultations, searchTerm]);

  useEffect(() => {
    if (!filteredConsultations.length) {
      setSelectedInquiry(null);
      return;
    }

    if (!selectedInquiry || !filteredConsultations.some((consultation) => consultation.id === selectedInquiry.id)) {
      setSelectedInquiry(filteredConsultations[0]);
    }
  }, [filteredConsultations, selectedInquiry]);

  const summary = useMemo(
    () => ({
      total: consultations.length,
      pending: consultations.filter((consultation) => consultation.status === 'PENDING').length,
      replied: consultations.filter((consultation) => consultation.status === 'REPLIED').length,
      closed: consultations.filter((consultation) => consultation.status === 'CLOSED').length,
    }),
    [consultations]
  );

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-8rem)] flex-col gap-6 fade-in">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {isDoctor ? 'الاستشارات الطبية والردود' : 'إدارة الاستشارات الطبية'}
            </h1>
            <p className="mt-1 text-sm text-dark-muted">
              راجع الأسئلة الواردة، أرسل ردودًا أوضح، وحدد ما إذا كانت الحالة تحتاج تحويلًا إلى موعد.
            </p>
          </div>

          <div className="relative w-full md:w-96">
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <Search className="h-5 w-5 text-dark-muted" />
            </div>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="ابحث باسم المريض أو السؤال أو الرد..."
              className="input-field border-dark-border bg-dark-card/80 pr-10 shadow-inner backdrop-blur-md"
            />
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="إجمالي الاستشارات" value={summary.total} hint="كل الحالات داخل الصندوق" icon={MessageSquare} accentClass="border-primary-500/20" />
          <SummaryCard title="قيد الانتظار" value={summary.pending} hint="تحتاج ردًا الآن" icon={Clock3} accentClass="border-amber-500/20" />
          <SummaryCard title="تم الرد" value={summary.replied} hint="تم الرد ولم تغلق بعد" icon={CheckCircle} accentClass="border-emerald-500/20" />
          <SummaryCard title="مغلقة" value={summary.closed} hint="انتهت معالجتها" icon={XCircle} accentClass="border-slate-500/20" />
        </section>

        <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[26rem,1fr]">
          <div className="glass-card flex min-h-0 flex-col overflow-hidden">
            <div className="space-y-4 border-b border-dark-border bg-dark-bg/30 p-4">
              <div>
                <h2 className="font-bold tracking-wide text-white">قائمة الاستشارات</h2>
                <p className="mt-1 text-xs text-dark-muted">فلتر سريع بين الحالات المفتوحة والمغلقة</p>
              </div>

              <div className="flex gap-2 overflow-x-auto custom-scrollbar">
                {[
                  { id: 'ALL', label: 'الكل' },
                  { id: 'PENDING', label: 'قيد الانتظار' },
                  { id: 'REPLIED', label: 'تم الرد' },
                  { id: 'CLOSED', label: 'مغلقة' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    className={`min-w-fit rounded-full px-3 py-2 text-xs font-bold transition-all ${
                      activeFilter === filter.id
                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                        : 'bg-dark-bg/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar">
              {loading ? (
                <div className="flex justify-center p-8">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></span>
                </div>
              ) : filteredConsultations.length === 0 ? (
                <div className="flex flex-col items-center p-10 text-center text-dark-muted">
                  <MessageSquare className="mb-3 h-10 w-10 opacity-20" />
                  <p className="text-sm font-semibold">لا توجد استشارات ضمن هذا الفلتر</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredConsultations.map((consultation) => (
                    <button
                      key={consultation.id}
                      onClick={() => {
                        setSelectedInquiry(consultation);
                        if (consultation.status === 'PENDING') {
                          setReplyText('');
                          setRequestAppointment(false);
                        } else {
                          setReplyText(consultation.reply || '');
                        }
                      }}
                      className={`w-full rounded-xl border p-4 text-right transition-all ${
                        selectedInquiry?.id === consultation.id
                          ? 'border-primary-500 bg-primary-900/20'
                          : 'border-dark-border bg-dark-bg/40 hover:border-primary-500/40 hover:bg-dark-bg/70'
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="font-bold text-white">{consultation.patient?.name || 'مريض غير معروف'}</span>
                            <StatusBadge status={consultation.status} />
                          </div>
                          <p className="text-[11px] text-dark-muted" dir="ltr">
                            {consultation.patient?.phone || 'No phone'}
                          </p>
                        </div>

                        <span className="text-[10px] text-dark-muted" dir="ltr">
                          {format(parseISO(consultation.createdAt), 'dd MMM - hh:mm a', { locale: ar })}
                        </span>
                      </div>

                      <p className="line-clamp-2 text-xs leading-6 text-slate-300">{consultation.question}</p>

                      {consultation.doctor?.name ? (
                        <p className="mt-2 text-[11px] text-slate-500">د. {consultation.doctor.name}</p>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="glass-card relative flex min-h-0 flex-col overflow-hidden">
            {selectedInquiry ? (
              <>
                <div className="shrink-0 border-b border-dark-border bg-dark-bg/40 p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700">
                        <User className="h-6 w-6 text-slate-300" />
                      </div>
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-white">{selectedInquiry.patient?.name || 'مريض غير معروف'}</h3>
                          <StatusBadge status={selectedInquiry.status} />
                        </div>
                        <p className="text-sm text-dark-muted" dir="ltr">
                          {selectedInquiry.patient?.phone || 'No phone'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {selectedInquiry.doctor?.name ? `الدكتور المسؤول: ${selectedInquiry.doctor.name}` : 'لم تُسند لدكتور بعد'}
                        </p>
                      </div>
                    </div>

                    {selectedInquiry.status !== 'CLOSED' ? (
                      <button
                        onClick={() => handleClose(selectedInquiry.id)}
                        className="rounded-xl border border-dark-border bg-dark-bg px-4 py-2 text-xs font-bold text-dark-muted transition-colors hover:bg-dark-border hover:text-white"
                      >
                        إغلاق الاستشارة
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-transparent to-dark-bg/20 p-8">
                  <div className="space-y-6">
                    <div className="flex justify-start">
                      <div className="relative max-w-[78%] rounded-2xl rounded-tl-sm border border-dark-border bg-dark-border/80 p-5 text-slate-200">
                        <span className="absolute right-4 top-[-12px] rounded-full border border-dark-border bg-dark-card px-2 py-0.5 text-[10px] font-bold text-dark-muted">
                          سؤال المريض
                        </span>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-7">{selectedInquiry.question}</p>
                        <div className="mt-3 flex items-center justify-end text-[10px] text-slate-400" dir="ltr">
                          {formatDateTime(selectedInquiry.createdAt)}
                        </div>
                      </div>
                    </div>

                    {selectedInquiry.reply ? (
                      <div className="flex justify-end fade-in">
                        <div className="relative max-w-[78%] rounded-2xl rounded-tr-sm border border-primary-500/50 bg-primary-600/90 p-5 text-white">
                          <span className="absolute left-4 top-[-12px] rounded-full border border-primary-500 bg-primary-800 px-2 py-0.5 text-[10px] font-bold text-primary-200">
                            رد الطبيب
                          </span>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-7">{selectedInquiry.reply}</p>
                          <div className="mt-3 flex items-center justify-end text-[10px] text-primary-200" dir="ltr">
                            {formatDateTime(selectedInquiry.updatedAt)}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {selectedInquiry.status === 'PENDING' ? (
                  <div className="shrink-0 border-t border-dark-border bg-dark-bg/60 p-6">
                    <form onSubmit={handleReply} className="space-y-4">
                      <div className="mb-2 flex flex-wrap gap-2">
                        {quickReplies.map((template) => (
                          <button
                            key={template}
                            type="button"
                            onClick={() => setReplyText((current) => (current ? `${current}\n\n${template}` : template))}
                            className="rounded-full border border-dark-border bg-dark-bg px-3 py-1.5 text-xs font-bold text-slate-300 transition-colors hover:text-white"
                          >
                            اقتراح سريع
                          </button>
                        ))}
                      </div>

                      <div className="rounded-xl border border-dark-border bg-dark-bg p-4 shadow-inner transition-all focus-within:border-primary-500/50 focus-within:ring-2 ring-primary-500/50">
                        <textarea
                          value={replyText}
                          onChange={(event) => setReplyText(event.target.value)}
                          placeholder="اكتب ردك الطبي هنا ليتم إرساله للمريض..."
                          className="h-28 w-full resize-none bg-transparent text-sm text-white placeholder-dark-muted focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <label className="group flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={requestAppointment}
                            onChange={(event) => setRequestAppointment(event.target.checked)}
                            className="h-4 w-4 rounded border-dark-border bg-dark-bg text-primary-500 focus:ring-primary-500 focus:ring-offset-dark-card"
                          />
                          <span className="text-sm text-slate-300 transition-colors group-hover:text-white">
                            إرفاق توصية بحجز موعد كشف مع الرد
                          </span>
                        </label>

                        <button
                          type="submit"
                          disabled={!replyText.trim()}
                          className="btn-primary rounded-xl px-6 py-2.5 disabled:opacity-50"
                        >
                          إرسال الرد
                          <Send className="h-4 w-4 rtl:-scale-x-100" />
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="shrink-0 border-t border-dark-border bg-dark-bg/50 px-6 py-4 text-sm text-slate-400">
                    {selectedInquiry.status === 'REPLIED'
                      ? 'تم الرد على هذه الاستشارة ويمكن مراجعة الرد أعلاه.'
                      : 'هذه الاستشارة مغلقة ولا تقبل ردودًا جديدة.'}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-dark-muted">
                <Stethoscope className="mb-4 h-16 w-16 opacity-20" />
                <p>اختر استشارة من القائمة لعرضها والرد عليها</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
