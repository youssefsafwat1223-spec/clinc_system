import { useEffect, useMemo, useState } from 'react';
import { MessageSquareShare, Phone, Search, CheckCircle2, CircleDashed, Archive } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { DataCard, Field, PageHeader, PrimaryButton, SecondaryButton, StatCard, StatusBadge, inputClass } from '../components/ui';

const statusOptions = [
  { value: 'ALL', label: 'كل الطلبات' },
  { value: 'NEW', label: 'جديد' },
  { value: 'CONTACTED', label: 'تم التواصل' },
  { value: 'CLOSED', label: 'مغلق' },
];

const statusTone = {
  NEW: 'amber',
  CONTACTED: 'blue',
  CLOSED: 'slate',
};

const statusIcon = {
  NEW: CircleDashed,
  CONTACTED: CheckCircle2,
  CLOSED: Archive,
};

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

export default function CallbackRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ total: 0, NEW: 0, CONTACTED: 0, CLOSED: 0 });
  const [statusLabels, setStatusLabels] = useState({});
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/callback-requests', {
        params: {
          status: statusFilter,
          search: search || undefined,
          limit: 300,
        },
      });
      setRequests(res.data.requests || []);
      setStats(res.data.stats || { total: 0, NEW: 0, CONTACTED: 0, CLOSED: 0 });
      setStatusLabels(res.data.statusLabels || {});
    } catch (error) {
      toast.error(error.message || 'فشل تحميل طلبات التواصل');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return requests;

    return requests.filter((request) =>
      [request.name, request.phone, request.requestMessage, request.patient?.name, request.patient?.displayName, request.senderId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [requests, search]);

  const updateStatus = async (request, status) => {
    setSavingId(request.id);
    try {
      const res = await api.put(`/callback-requests/${request.id}`, {
        status,
        notes: request.notes || '',
      });

      setRequests((current) =>
        current.map((item) => (item.id === request.id ? res.data.request : item))
      );
      toast.success('تم تحديث حالة الطلب');
    } catch (error) {
      toast.error(error.message || 'فشل تحديث الحالة');
    } finally {
      setSavingId('');
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="طلبات التواصل"
        description="أي عميل يرسل رقمه من Facebook أو Instagram عبر ManyChat سيظهر هنا لكي يتابع معه الاستقبال."
        actions={
          <PrimaryButton type="button" onClick={loadData}>
            <MessageSquareShare className="h-4 w-4" />
            تحديث
          </PrimaryButton>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="إجمالي الطلبات" value={stats.total || 0} icon={MessageSquareShare} tone="blue" />
        <StatCard title="الجديدة" value={stats.NEW || 0} icon={CircleDashed} tone="amber" />
        <StatCard title="تم التواصل" value={stats.CONTACTED || 0} icon={CheckCircle2} tone="green" />
        <StatCard title="المغلقة" value={stats.CLOSED || 0} icon={Archive} tone="slate" />
      </div>

      <DataCard className="mb-6">
        <div className="grid gap-4 md:grid-cols-[220px_1fr_auto]">
          <Field label="الحالة">
            <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="بحث">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className={`${inputClass} pr-10`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="اسم العميل أو الرقم أو نص الرسالة"
              />
            </div>
          </Field>
          <div className="flex items-end">
            <SecondaryButton type="button" onClick={loadData}>
              إعادة تحميل
            </SecondaryButton>
          </div>
        </div>
      </DataCard>

      {loading ? (
        <DataCard className="text-center text-slate-300">جارٍ تحميل الطلبات...</DataCard>
      ) : filteredRequests.length === 0 ? (
        <DataCard className="text-center text-slate-400">لا توجد طلبات تواصل حالياً.</DataCard>
      ) : (
        <div className="grid gap-4">
          {filteredRequests.map((request) => {
            const StatusIcon = statusIcon[request.status] || CircleDashed;
            return (
              <DataCard key={request.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <StatusBadge tone={statusTone[request.status] || 'slate'}>
                        {statusLabels[request.status] || request.status}
                      </StatusBadge>
                      <StatusBadge tone="blue">{request.platform}</StatusBadge>
                      <StatusBadge tone="slate">{request.source}</StatusBadge>
                    </div>

                    <h3 className="text-lg font-black text-white">
                      {request.name || request.patient?.displayName || request.patient?.name || 'عميل بدون اسم'}
                    </h3>

                    <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                      <p className="flex items-center gap-2" dir="ltr">
                        <Phone className="h-4 w-4 text-sky-300" />
                        {request.phone}
                      </p>
                      <p>تاريخ الطلب: <span className="text-slate-400">{formatDateTime(request.createdAt)}</span></p>
                      {request.senderId ? <p dir="ltr">Sender ID: <span className="text-slate-400">{request.senderId}</span></p> : null}
                      {request.patient?.id ? <p>المريض المرتبط: <span className="text-slate-400">{request.patient.displayName || request.patient.name}</span></p> : null}
                    </div>

                    {request.requestMessage ? (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-[#0d1225] p-4">
                        <p className="mb-1 text-xs font-bold text-slate-400">نص الرسالة</p>
                        <p className="text-sm leading-7 text-white">{request.requestMessage}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex min-w-[220px] flex-col gap-3">
                    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0d1225] px-3 py-2 text-sm text-slate-300">
                      <StatusIcon className="h-4 w-4 text-sky-300" />
                      <span>{statusLabels[request.status] || request.status}</span>
                    </div>
                    <div className="grid gap-2">
                      <SecondaryButton type="button" disabled={savingId === request.id} onClick={() => updateStatus(request, 'CONTACTED')}>
                        تم التواصل
                      </SecondaryButton>
                      <SecondaryButton type="button" disabled={savingId === request.id} onClick={() => updateStatus(request, 'CLOSED')}>
                        إغلاق
                      </SecondaryButton>
                      <SecondaryButton type="button" disabled={savingId === request.id} onClick={() => updateStatus(request, 'NEW')}>
                        إعادة إلى جديد
                      </SecondaryButton>
                    </div>
                  </div>
                </div>
              </DataCard>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
