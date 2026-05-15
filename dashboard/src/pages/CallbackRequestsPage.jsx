import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, MessageSquareShare, Phone, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import {
  DataCard,
  Field,
  PageHeader,
  PageLoader,
  PrimaryButton,
  SecondaryButton,
  StatCard,
  StatusBadge,
  inputClass,
} from '../components/ui';
import EmptyState from '../components/EmptyState';
import {
  buildRecentMonthOptions,
  calendarFilterOptions,
  getMonthWeekOptions,
  isWithinCalendarFilter,
} from '../utils/dateFilters';

const statusOptions = [
  { value: 'ALL', label: 'كل الحالات' },
  { value: 'NEW', label: 'جديد' },
  { value: 'CONTACTED', label: 'تم التواصل' },
];

const platformTabs = ['ALL', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM'];

const platformLabels = {
  ALL: 'الكل',
  WHATSAPP: 'واتساب',
  FACEBOOK: 'فيسبوك',
  INSTAGRAM: 'إنستجرام',
};

const platformTone = {
  WHATSAPP: 'green',
  FACEBOOK: 'blue',
  INSTAGRAM: 'amber',
};

const statusTone = {
  NEW: 'amber',
  CONTACTED: 'blue',
};

const monthOptions = buildRecentMonthOptions();

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  const day = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(date);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return `${day} - ${time}`;
};

export default function CallbackRequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ total: 0, NEW: 0, CONTACTED: 0, CLOSED: 0 });
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('ALL');
  const [dateRange, setDateRange] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value || '');
  const [selectedWeek, setSelectedWeek] = useState('1');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');

  const weekOptions = useMemo(() => getMonthWeekOptions(selectedMonth), [selectedMonth]);

  useEffect(() => {
    if (!weekOptions.some((option) => option.value === selectedWeek)) {
      setSelectedWeek(weekOptions[0]?.value || '1');
    }
  }, [selectedWeek, weekOptions]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/callback-requests', {
        params: {
          status: statusFilter,
          platform: activeTab === 'ALL' ? 'ALL' : activeTab,
          limit: 500,
        },
      });
      setRequests(res.data.requests || []);
      setStats(res.data.stats || { total: 0, NEW: 0, CONTACTED: 0, CLOSED: 0 });
    } catch (error) {
      toast.error(error.message || 'فشل في تحميل طلبات التواصل');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, activeTab]);

  const platformCounts = useMemo(
    () =>
      requests.reduce(
        (accumulator, request) => {
          accumulator.ALL += 1;
          if (request.platform && accumulator[request.platform] !== undefined) {
            accumulator[request.platform] += 1;
          }
          return accumulator;
        },
        { ALL: 0, WHATSAPP: 0, FACEBOOK: 0, INSTAGRAM: 0 }
      ),
    [requests]
  );

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesPlatform = activeTab === 'ALL' || request.platform === activeTab;
      const matchesDate = isWithinCalendarFilter(request.createdAt, dateRange, {
        exactDate: selectedDate,
        monthValue: selectedMonth,
        weekOfMonth: selectedWeek,
      });
      const haystack = [
        request.name,
        request.phone,
        request.requestMessage,
        request.patient?.name,
        request.patient?.displayName,
        request.senderId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesPlatform && matchesDate && (!term || haystack.includes(term));
    });
  }, [requests, activeTab, dateRange, selectedDate, selectedMonth, selectedWeek, search]);

  const updateStatus = async (request, status) => {
    setSavingId(request.id);
    try {
      const res = await api.put(`/callback-requests/${request.id}`, {
        status,
        notes: request.notes || '',
      });

      setRequests((current) => current.map((item) => (item.id === request.id ? res.data.request : item)));
      toast.success('تم تحديث حالة الطلب');
    } catch (error) {
      toast.error(error.message || 'فشل في تحديث الحالة');
    } finally {
      setSavingId('');
    }
  };

  const openBooking = (request) => {
    const params = new URLSearchParams();
    if (request.patient?.id) params.set('patientId', request.patient.id);
    if (request.phone) params.set('phone', request.phone);
    navigate(`/add-patient?${params.toString()}`);
  };

  const openInbox = (request) => {
    if (!request.patient?.id) {
      toast.error('لا يوجد ملف مريض مرتبط بهذه المحادثة بعد.');
      return;
    }

    navigate(`/inbox?patientId=${encodeURIComponent(request.patient.id)}`);
  };

  return (
    <AppLayout>
      <PageHeader
        title="طلبات التواصل"
        description="تابع طلبات الحجز القادمة من واتساب وفيسبوك وإنستجرام، ثم ابدأ الحجز أو افتح المحادثة مباشرة."
        actions={
          <PrimaryButton type="button" onClick={loadData}>
            <MessageSquareShare className="h-4 w-4" />
            تحديث
          </PrimaryButton>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard title="إجمالي الطلبات" value={stats.total || 0} icon={MessageSquareShare} tone="blue" />
        <StatCard title="الطلبات الجديدة" value={stats.NEW || 0} icon={Phone} tone="amber" />
        <StatCard title="تم التواصل" value={stats.CONTACTED || 0} icon={CheckCircle2} tone="green" />
      </div>

      <DataCard className="mb-6">
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {platformTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  activeTab === tab
                    ? 'bg-sky-500 text-white'
                    : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {platformLabels[tab]}
                <span className={`ms-1.5 ${activeTab === tab ? 'text-sky-100' : 'text-slate-500'}`}>
                  ({platformCounts[tab] || 0})
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {calendarFilterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDateRange(option.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  dateRange === option.value
                    ? 'bg-cyan-500 text-white'
                    : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="الحالة">
              <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            {dateRange === 'day' ? (
              <Field label="اليوم المحدد">
                <input className={inputClass} type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              </Field>
            ) : null}

            {dateRange === 'specificMonth' || dateRange === 'specificWeek' ? (
              <Field label="الشهر">
                <select className={inputClass} value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {dateRange === 'specificWeek' ? (
              <Field label="أسبوع الشهر">
                <select className={inputClass} value={selectedWeek} onChange={(event) => setSelectedWeek(event.target.value)}>
                  {weekOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <Field label="بحث" className={dateRange === 'day' || dateRange === 'specificMonth' || dateRange === 'specificWeek' ? '' : 'md:col-span-2 xl:col-span-3'}>
              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  className={`${inputClass} pr-10`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ابحث بالاسم أو الرقم أو نص الرسالة"
                />
              </div>
            </Field>
          </div>

          <div className="flex justify-end">
            <SecondaryButton type="button" onClick={loadData}>
              إعادة تحميل
            </SecondaryButton>
          </div>
        </div>
      </DataCard>

      {loading ? (
        <DataCard><PageLoader label="جاري تحميل الطلبات..." /></DataCard>
      ) : filteredRequests.length === 0 ? (
        <DataCard><EmptyState icon={Phone} title="لا توجد طلبات" description="لا توجد طلبات مطابقة الآن." /></DataCard>
      ) : (
        <div className="grid gap-4">
          {filteredRequests.map((request) => (
            <DataCard key={request.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <StatusBadge tone={statusTone[request.status] || 'slate'}>
                      {request.status === 'NEW' ? 'جديد' : request.status === 'CONTACTED' ? 'تم التواصل' : request.status}
                    </StatusBadge>
                    <StatusBadge tone={platformTone[request.platform] || 'slate'}>
                      {platformLabels[request.platform] || request.platform}
                    </StatusBadge>
                  </div>

                  <h3 className="text-lg font-black text-white">
                    {request.name || request.patient?.displayName || request.patient?.name || 'عميل بدون اسم'}
                  </h3>

                  <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                    <p className="flex items-center gap-2" dir="ltr">
                      <Phone className="h-4 w-4 text-sky-300" />
                      {request.phone}
                    </p>
                    <p>
                      تاريخ الطلب: <span className="text-slate-400">{formatDateTime(request.createdAt)}</span>
                    </p>
                    {request.senderId ? (
                      <p dir="ltr">
                        Sender ID: <span className="text-slate-400">{request.senderId}</span>
                      </p>
                    ) : null}
                    {request.patient?.id ? (
                      <p>
                        المريض المرتبط: <span className="text-slate-400">{request.patient.displayName || request.patient.name}</span>
                      </p>
                    ) : null}
                  </div>

                  {request.requestMessage ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-[#0d1225] p-4">
                      <p className="mb-1 text-xs font-bold text-slate-400">نص الرسالة</p>
                      <p className="text-sm leading-7 text-white">{request.requestMessage}</p>
                    </div>
                  ) : null}
                </div>

                <div className="flex min-w-[220px] flex-col gap-3">
                  <div className="grid gap-2">
                    <PrimaryButton type="button" onClick={() => openBooking(request)}>
                      حجز موعد
                    </PrimaryButton>
                    <SecondaryButton type="button" onClick={() => openInbox(request)}>
                      تواصل مع العميل
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      disabled={savingId === request.id || request.status === 'CONTACTED'}
                      onClick={() => updateStatus(request, 'CONTACTED')}
                    >
                      تم التواصل
                    </SecondaryButton>
                  </div>
                </div>
              </div>
            </DataCard>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
