import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Calendar,
  CheckCheck,
  FileText,
  HelpCircle,
  ImagePlus,
  Inbox,
  MessageSquare,
  Pause,
  Phone,
  Play,
  Search,
  Send,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { DataCard, PageHeader, PrimaryButton, SecondaryButton, StatusBadge, inputClass } from '../components/ui';

const platformTabs = ['ALL', 'HUMAN', 'UNREAD', 'REVIEWED', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM'];

const platformLabels = {
  ALL: 'الكل',
  HUMAN: 'متابعة بشرية',
  UNREAD: 'غير مقروء',
  REVIEWED: 'تمت المراجعة',
  WHATSAPP: 'واتساب',
  FACEBOOK: 'فيسبوك',
  INSTAGRAM: 'إنستجرام',
};

const dateRangeOptions = [
  { value: 'all', label: 'كل الفترات' },
  { value: 'today', label: 'اليوم' },
  { value: '2days', label: 'آخر يومين' },
  { value: 'week', label: 'آخر أسبوع' },
  { value: 'month', label: 'آخر شهر' },
];

const isWithinDateRange = (value, range) => {
  if (!value || range === 'all') return true;
  const messageDate = new Date(value);
  if (Number.isNaN(messageDate.getTime())) return true;

  const now = new Date();
  if (range === 'today') {
    return messageDate.toDateString() === now.toDateString();
  }

  const diffMs = now.getTime() - messageDate.getTime();
  const day = 24 * 60 * 60 * 1000;

  if (range === '2days') return diffMs <= 2 * day;
  if (range === 'week') return diffMs <= 7 * day;
  if (range === 'month') return diffMs <= 30 * day;
  return true;
};

const parseQuickRepliesInput = (value) =>
  String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [caption = '', type = '', target = ''] = line.split('|').map((item) => item.trim());
      if (!caption || !type) return null;
      if (type === 'url') return { caption, type, url: target };
      return { caption, type, target };
    })
    .filter(Boolean);

const platformTone = {
  WHATSAPP: 'green',
  FACEBOOK: 'blue',
  INSTAGRAM: 'amber',
};

const getSourceLabel = (metadata) => {
  const source = metadata?.source;
  if (source === 'COMMENT') return 'تعليق';
  if (source === 'COMMENT_REPLY') return 'رد تعليق';
  if (source === 'MANUAL_REPLY') return 'رد بشري';
  if (source === 'MANYCHAT') return 'ManyChat';
  return null;
};

const getPatientName = (patient = {}, metadata = null) =>
  patient.displayName ||
  patient.name ||
  metadata?.fullName ||
  metadata?.raw?.full_name ||
  (patient.platform === 'INSTAGRAM'
    ? 'عميل إنستجرام'
    : patient.platform === 'FACEBOOK'
      ? 'عميل فيسبوك'
      : 'عميل');

const getMessageText = (message) =>
  String(
    message?.metadata?.originalContent ||
      message?.content ||
      message?.metadata?.raw?.message_text ||
      message?.metadata?.raw?.comment_text ||
      ''
  ).trim();

const formatDay = (value) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'اليوم';
  if (date.toDateString() === yesterday.toDateString()) return 'أمس';

  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
};

const formatTime = (value) =>
  new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));

const formatRelative = (value) => {
  if (!value) return '-';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  return formatDay(value);
};

function PlatformIcon({ platform, className = 'h-4 w-4' }) {
  if (platform === 'WHATSAPP') return <Phone className={`${className} text-emerald-300`} />;
  if (platform === 'FACEBOOK') return <MessageSquare className={`${className} text-sky-300`} />;
  if (platform === 'INSTAGRAM') return <MessageSquare className={`${className} text-pink-400`} />;
  return <MessageSquare className={`${className} text-slate-400`} />;
}

function BotGuideModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl border border-white/10 bg-[#0b1020] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <h2 className="text-xl font-black text-white">شرح المتابعة البشرية</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              من هذه الشاشة يمكنك الرد البشري، إرسال صورة، وإرسال Quick Replies عبر ManyChat عند توفر بيانات المشترك.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto p-5 text-sm leading-7 text-slate-300">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="font-bold text-white">إيقاف البوت</p>
            <p>يحوّل المحادثة إلى وضع بشري حتى لا يرد البوت تلقائياً.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="font-bold text-white">الإرسال عبر ManyChat</p>
            <p>إذا كان للمريض `manychatSubscriberId` وكان `MANYCHAT_API_KEY` مضبوطاً، سيتم إرسال رد الموظف عبر ManyChat بدلاً من الإرسال المباشر.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="font-bold text-white">صيغة Quick Replies</p>
            <p dir="ltr">caption|type|target</p>
            <p>مثال:</p>
            <p dir="ltr">احجز الآن|flow|123456</p>
            <p dir="ltr">العنوان|node|content_abc</p>
            <p dir="ltr">افتح الموقع|url|https://maps.google.com/...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InboxPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [quickRepliesText, setQuickRepliesText] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');
  const [dateRange, setDateRange] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showBotGuide, setShowBotGuide] = useState(false);
  const [isMobileConversationOpen, setIsMobileConversationOpen] = useState(false);
  const imageInputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const requestedPatientId = searchParams.get('patientId') || '';

  const fetchPatientsList = async (showLoading = true) => {
    try {
      if (showLoading) setLoadingList(true);
      const res = await api.get('/messages', { params: { limit: 500 } });
      const uniquePatientsMap = new Map();

      (res.data.messages || []).forEach((message) => {
        const patient = message.patient || {};
        const existing = uniquePatientsMap.get(message.patientId);

        if (!existing) {
          uniquePatientsMap.set(message.patientId, {
            ...patient,
            id: message.patientId,
            platform: message.platform || patient.platform,
            displayName: getPatientName(patient, message.metadata),
            name: getPatientName(patient, message.metadata),
            lastMessage: getMessageText(message),
            lastMessageTime: message.createdAt,
            lastMessageType: message.type,
            lastMessageMetadata: message.metadata,
            chatState: patient.chatState || 'BOT',
            messageCount: 1,
            unreadCount: message.type === 'INBOUND' && !message.readAt ? 1 : 0,
            reviewedCount: message.reviewedAt ? 1 : 0,
          });
          return;
        }

        existing.messageCount += 1;
        if (message.type === 'INBOUND' && !message.readAt) existing.unreadCount += 1;
        if (message.reviewedAt) existing.reviewedCount += 1;
      });

      const nextPatients = Array.from(uniquePatientsMap.values()).sort(
        (first, second) => new Date(second.lastMessageTime).getTime() - new Date(first.lastMessageTime).getTime()
      );

      setPatients(nextPatients);
      setSelectedPatientId((current) => {
        if (requestedPatientId && nextPatients.some((patient) => patient.id === requestedPatientId)) {
          return requestedPatientId;
        }
        if (current && nextPatients.some((patient) => patient.id === current)) return current;
        return nextPatients[0]?.id || null;
      });
    } catch (error) {
      toast.error('فشل تحميل قائمة الرسائل');
    } finally {
      if (showLoading) setLoadingList(false);
    }
  };

  const fetchConversation = async (patientId, showLoading = true) => {
    try {
      if (showLoading) setLoadingChat(true);
      const res = await api.get(`/messages/conversation/${patientId}`);
      setConversation(res.data.messages || []);

      if (res.data.patient) {
        setPatients((current) =>
          current.map((patient) =>
            patient.id === patientId
              ? {
                  ...patient,
                  ...res.data.patient,
                  unreadCount: 0,
                }
              : patient
          )
        );
      }
    } catch (error) {
      toast.error('فشل تحميل المحادثة');
    } finally {
      if (showLoading) setLoadingChat(false);
    }
  };

  useEffect(() => {
    fetchPatientsList();
  }, []);

  useEffect(() => {
    if (selectedPatientId) fetchConversation(selectedPatientId);
    else setConversation([]);
  }, [selectedPatientId]);

  useEffect(() => {
    if (!selectedPatientId) {
      setIsMobileConversationOpen(false);
    }
  }, [selectedPatientId]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchPatientsList(false);
      if (selectedPatientId) fetchConversation(selectedPatientId, false);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedPatientId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [conversation.length, selectedPatientId]);

  const platformCounts = useMemo(
    () =>
      patients.reduce(
        (accumulator, patient) => {
          accumulator.ALL += 1;
          if (patient.chatState === 'HUMAN') accumulator.HUMAN += 1;
          if ((patient.unreadCount || 0) > 0) accumulator.UNREAD += 1;
          if ((patient.reviewedCount || 0) > 0) accumulator.REVIEWED += 1;
          if (patient.platform && accumulator[patient.platform] !== undefined) accumulator[patient.platform] += 1;
          return accumulator;
        },
        { ALL: 0, HUMAN: 0, UNREAD: 0, REVIEWED: 0, WHATSAPP: 0, FACEBOOK: 0, INSTAGRAM: 0 }
      ),
    [patients]
  );

  const filteredPatients = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return patients.filter((patient) => {
      const isStateTab = activeTab === 'HUMAN' || activeTab === 'UNREAD' || activeTab === 'REVIEWED';
      const matchesPlatform = activeTab === 'ALL' || isStateTab || patient.platform === activeTab;
      const matchesState =
        activeTab === 'HUMAN'
          ? patient.chatState === 'HUMAN'
          : activeTab === 'UNREAD'
            ? (patient.unreadCount || 0) > 0
            : activeTab === 'REVIEWED'
              ? (patient.reviewedCount || 0) > 0
              : true;

      const matchesDateRange = isWithinDateRange(patient.lastMessageTime, dateRange);

      const haystack = [patient.name, patient.phone, patient.lastMessage].filter(Boolean).join(' ').toLowerCase();
      return matchesPlatform && matchesState && matchesDateRange && (!query || haystack.includes(query));
    });
  }, [activeTab, dateRange, patients, searchTerm]);

  useEffect(() => {
    if (filteredPatients.length === 0) {
      setSelectedPatientId(null);
      return;
    }

    if (!selectedPatientId || !filteredPatients.some((patient) => patient.id === selectedPatientId)) {
      setSelectedPatientId(filteredPatients[0].id);
    }
  }, [filteredPatients, requestedPatientId, selectedPatientId]);

  const selectedPatientData = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  const groupedMessages = useMemo(() => {
    return conversation.reduce((groups, message) => {
      const key = new Date(message.createdAt).toISOString().slice(0, 10);
      const last = groups[groups.length - 1];
      if (!last || last.key !== key) {
        groups.push({ key, label: formatDay(message.createdAt), messages: [message] });
      } else {
        last.messages.push(message);
      }
      return groups;
    }, []);
  }, [conversation]);

  const uploadMessageImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await api.post('/upload/campaign-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImageUrl(res.data.url);
      toast.success('تم رفع الصورة');
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل رفع الصورة');
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if ((!replyText.trim() && !imageUrl.trim()) || !selectedPatientId) return;

    setSending(true);
    try {
      const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);
      const currentText = replyText.trim();
      const currentImageUrl = imageUrl.trim();
      const currentQuickReplies = parseQuickRepliesInput(quickRepliesText);
      const createdAt = new Date().toISOString();

      const tempMessage = {
        id: `temp_${Date.now()}`,
        content: currentText || '[image]',
        type: 'OUTBOUND',
        createdAt,
        platform: selectedPatient?.platform,
        metadata: {
          originalContent: currentText,
          imageUrl: currentImageUrl || null,
          quickReplies: currentQuickReplies,
        },
      };

      setConversation((current) => [...current, tempMessage]);
      setReplyText('');
      setImageUrl('');
      setQuickRepliesText('');

      await api.post('/messages/send', {
        patientId: selectedPatientId,
        content: currentText,
        imageUrl: currentImageUrl,
        quickReplies: currentQuickReplies,
        platform: selectedPatient?.platform,
      });

      fetchConversation(selectedPatientId, false);
      fetchPatientsList(false);
    } catch (error) {
      toast.error(error.message || 'فشل إرسال الرسالة');
      fetchConversation(selectedPatientId, false);
      fetchPatientsList(false);
    } finally {
      setSending(false);
    }
  };

  const handleEndConversation = async () => {
    if (!selectedPatientId) return;
    try {
      await api.post(`/messages/${selectedPatientId}/end`);
      toast.success('تم إنهاء المتابعة البشرية وسيعود البوت للرد.');
      setPatients((current) =>
        current.map((patient) => (patient.id === selectedPatientId ? { ...patient, chatState: 'BOT' } : patient))
      );
      fetchConversation(selectedPatientId, false);
    } catch (error) {
      toast.error('فشل إنهاء المحادثة');
    }
  };

  const handlePauseBot = async () => {
    if (!selectedPatientId) return;
    try {
      await api.post(`/messages/${selectedPatientId}/pause`);
      toast.success('تم إيقاف البوت لهذه المحادثة.');
      setPatients((current) =>
        current.map((patient) => (patient.id === selectedPatientId ? { ...patient, chatState: 'HUMAN' } : patient))
      );
      fetchConversation(selectedPatientId, false);
    } catch (error) {
      toast.error('فشل إيقاف البوت');
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="صندوق الوارد"
        description="متابعة رسائل واتساب وFacebook وInstagram مع إمكانية الرد البشري عبر ManyChat عندما تكون بيانات المشترك متوفرة."
        actions={
          <SecondaryButton type="button" onClick={() => setShowBotGuide(true)}>
            <HelpCircle className="h-4 w-4" />
            شرح المتابعة
          </SecondaryButton>
        }
      />

      <div className="grid gap-4 lg:h-[calc(100vh-200px)] lg:min-h-[620px] lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[440px_minmax(0,1fr)]">
        <DataCard
          className={`min-w-0 flex-col overflow-hidden p-0 ${
            isMobileConversationOpen ? 'hidden lg:flex' : 'flex h-[calc(100vh-180px)] min-h-[460px] lg:h-auto lg:min-h-0'
          }`}
        >
          <div className="border-b border-white/10 bg-white/[0.015] px-4 py-4 sm:px-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-base font-black text-white sm:text-lg">المحادثات</h2>
                <p className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">
                  {filteredPatients.length} من {patients.length} محادثة
                </p>
              </div>
              {platformCounts.UNREAD > 0 ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
                  {platformCounts.UNREAD} غير مقروء
                </span>
              ) : null}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className={`${inputClass} pr-10`}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ابحث بالاسم أو الرقم أو الرسالة..."
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 hover:bg-white/5 hover:text-white"
                  aria-label="مسح البحث"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {platformTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition sm:text-xs ${
                    activeTab === tab
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                      : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {platformLabels[tab]}
                  <span className={`ms-1.5 ${activeTab === tab ? 'text-sky-100' : 'text-slate-500'}`}>
                    {platformCounts[tab] || 0}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              {dateRangeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDateRange(option.value)}
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    dateRange === option.value
                      ? 'bg-white/15 text-white'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-3">
            {loadingList ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3, 4].map((index) => (
                  <div key={index} className="flex animate-pulse gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
                    <div className="h-11 w-11 shrink-0 rounded-2xl bg-white/10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 rounded bg-white/10" />
                      <div className="h-2.5 w-1/2 rounded bg-white/10" />
                      <div className="h-2.5 w-full rounded bg-white/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="flex h-52 flex-col items-center justify-center text-center text-slate-400">
                <Inbox className="mb-3 h-10 w-10 text-slate-600" />
                <p className="text-sm font-semibold">لا توجد محادثات مطابقة</p>
                <p className="mt-1 text-xs text-slate-500">جرب تغيير الفلاتر أو البحث</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredPatients.map((patient) => {
                  const selected = patient.id === selectedPatientId;
                  const unread = patient.unreadCount || 0;
                  const isHuman = patient.chatState === 'HUMAN';
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => {
                        setSelectedPatientId(patient.id);
                        setIsMobileConversationOpen(true);
                      }}
                      className={`group w-full rounded-2xl border p-3 text-right transition-all duration-200 sm:p-3.5 ${
                        selected
                          ? 'border-sky-500/40 bg-sky-500/10 shadow-lg shadow-sky-500/10'
                          : unread > 0
                            ? 'border-white/15 bg-white/[0.05] hover:bg-white/[0.08]'
                            : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-md transition ${
                            selected
                              ? 'bg-gradient-to-br from-sky-400 to-cyan-500 shadow-sky-500/30'
                              : 'bg-gradient-to-br from-sky-500/80 to-cyan-500/80 shadow-black/20'
                          }`}>
                            <User className="h-5 w-5" />
                          </div>
                          <span className={`absolute -bottom-0.5 -left-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#0b1020] ${
                            isHuman ? 'bg-amber-400' : 'bg-emerald-400'
                          }`} title={isHuman ? 'متابعة بشرية' : 'البوت يعمل'} />
                          {unread > 0 ? (
                            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white shadow-lg shadow-rose-500/30 ring-2 ring-[#0b1020]">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h3 className={`truncate text-sm leading-5 ${
                                unread > 0 ? 'font-black text-white' : 'font-bold text-slate-100'
                              }`}>{patient.name}</h3>
                              <p className="mt-0.5 truncate text-[11px] text-slate-500" dir="ltr">
                                {patient.phone || '—'}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className={`text-[10px] font-semibold ${
                                unread > 0 ? 'text-sky-300' : 'text-slate-500'
                              }`}>
                                {formatRelative(patient.lastMessageTime)}
                              </span>
                              <PlatformIcon platform={patient.platform} className="h-3.5 w-3.5" />
                            </div>
                          </div>
                          <p className={`mt-1.5 line-clamp-2 text-xs leading-5 ${
                            unread > 0 ? 'text-slate-200' : 'text-slate-400'
                          }`}>
                            {patient.lastMessage || 'بدون نص'}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DataCard>

        <DataCard
          className={`min-w-0 flex-col overflow-hidden p-0 ${
            !isMobileConversationOpen && !selectedPatientData ? 'hidden lg:flex' : 'flex h-[calc(100vh-180px)] min-h-[560px] lg:h-auto lg:min-h-0'
          }`}
        >
          {selectedPatientData ? (
            <>
              <div className="border-b border-white/10 bg-gradient-to-b from-white/[0.02] to-transparent">
                <div className="flex items-center gap-2.5 px-3 py-3 sm:px-5 sm:py-4">
                  <button
                    type="button"
                    onClick={() => setIsMobileConversationOpen(false)}
                    className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
                    aria-label="العودة إلى المحادثات"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <div className="relative shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 text-white shadow-lg shadow-sky-500/20 sm:h-11 sm:w-11">
                      <User className="h-5 w-5 sm:h-5.5 sm:w-5.5" />
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -left-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-[#0b1020] ${
                        selectedPatientData.chatState === 'HUMAN' ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      title={selectedPatientData.chatState === 'HUMAN' ? 'متابعة بشرية' : 'البوت يعمل'}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-black text-white sm:text-base">{selectedPatientData.name}</h2>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400 sm:text-xs">
                      <span dir="ltr" className="truncate">{selectedPatientData.phone || '—'}</span>
                      <span className="hidden h-1 w-1 rounded-full bg-slate-600 sm:inline-block" />
                      <span className="hidden items-center gap-1 sm:inline-flex">
                        <PlatformIcon platform={selectedPatientData.platform} className="h-3 w-3" />
                        <span>{platformLabels[selectedPatientData.platform] || selectedPatientData.platform}</span>
                      </span>
                      <span className="hidden h-1 w-1 rounded-full bg-slate-600 sm:inline-block" />
                      <span className={`hidden font-semibold sm:inline ${
                        selectedPatientData.chatState === 'HUMAN' ? 'text-amber-300' : 'text-emerald-300'
                      }`}>
                        {selectedPatientData.chatState === 'HUMAN' ? 'متابعة بشرية' : 'البوت يعمل'}
                      </span>
                    </div>
                  </div>

                  {/* Desktop action buttons */}
                  <div className="hidden shrink-0 items-center gap-2 lg:flex">
                    <button
                      type="button"
                      onClick={() => navigate(`/patients/${selectedPatientData.id}`)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 hover:text-white"
                      title="ملف المريض"
                    >
                      <FileText className="h-4 w-4" />
                      <span className="hidden xl:inline">الملف</span>
                    </button>
                    {selectedPatientData.chatState === 'HUMAN' ? (
                      <button
                        type="button"
                        onClick={handleEndConversation}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20"
                        title="إنهاء المتابعة وإعادة البوت"
                      >
                        <Play className="h-4 w-4" />
                        <span className="hidden xl:inline">إنهاء المتابعة</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePauseBot}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20"
                        title="إيقاف البوت لهذه المحادثة"
                      >
                        <Pause className="h-4 w-4" />
                        <span className="hidden xl:inline">إيقاف البوت</span>
                      </button>
                    )}
                    <PrimaryButton
                      type="button"
                      onClick={() => {
                        const isSocialLead =
                          selectedPatientData.platform === 'FACEBOOK' || selectedPatientData.platform === 'INSTAGRAM';

                        if (isSocialLead) {
                          navigate('/add-patient');
                          return;
                        }

                        navigate(
                          `/add-patient?patientId=${encodeURIComponent(selectedPatientData.id)}&phone=${encodeURIComponent(selectedPatientData.phone || '')}`
                        );
                      }}
                      className="!px-3 !py-2 !text-xs"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>حجز موعد</span>
                    </PrimaryButton>
                  </div>
                </div>

                {/* Mobile/tablet action buttons row */}
                <div className="grid grid-cols-3 gap-1.5 border-t border-white/5 px-3 pb-3 pt-2 sm:px-5 lg:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      const isSocialLead =
                        selectedPatientData.platform === 'FACEBOOK' || selectedPatientData.platform === 'INSTAGRAM';

                      if (isSocialLead) {
                        navigate('/add-patient');
                        return;
                      }

                      navigate(
                        `/add-patient?patientId=${encodeURIComponent(selectedPatientData.id)}&phone=${encodeURIComponent(selectedPatientData.phone || '')}`
                      );
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-2 py-2 text-[11px] font-bold text-white shadow-md shadow-sky-500/20 transition active:scale-95"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>حجز موعد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/patients/${selectedPatientData.id}`)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-[11px] font-bold text-slate-200 transition active:scale-95"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>الملف</span>
                  </button>
                  {selectedPatientData.chatState === 'HUMAN' ? (
                    <button
                      type="button"
                      onClick={handleEndConversation}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2 py-2 text-[11px] font-bold text-emerald-300 transition active:scale-95"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>إنهاء المتابعة</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePauseBot}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-[11px] font-bold text-amber-300 transition active:scale-95"
                    >
                      <Pause className="h-3.5 w-3.5" />
                      <span>إيقاف البوت</span>
                    </button>
                  )}
                </div>
              </div>

              <div ref={messagesContainerRef} className="chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#080d1f] px-3 py-4 sm:p-5 lg:p-6">
                {loadingChat ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                      جارٍ تحميل المحادثة...
                    </div>
                  </div>
                ) : groupedMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                      <MessageSquare className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                      <p className="text-sm font-semibold text-slate-300">لا توجد رسائل بعد</p>
                      <p className="mt-1 text-xs text-slate-500">ابدأ المحادثة بكتابة رسالة في الأسفل</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {groupedMessages.map((group) => (
                      <div key={group.key} className="space-y-2.5">
                        <div className="sticky top-0 z-10 flex justify-center py-1">
                          <span className="rounded-full border border-white/10 bg-[#0b1020]/90 px-3 py-1 text-[11px] font-bold text-slate-400 backdrop-blur-sm">
                            {group.label}
                          </span>
                        </div>
                        {group.messages.map((message) => {
                          const outbound = message.type === 'OUTBOUND';
                          const source = getSourceLabel(message.metadata);
                          const text = getMessageText(message);
                          const messageImageUrl = message.metadata?.imageUrl || null;
                          const messageQuickReplies = Array.isArray(message.metadata?.quickReplies) ? message.metadata.quickReplies : [];

                          return (
                            <div key={message.id} className={`flex ${outbound ? 'justify-start' : 'justify-end'}`}>
                              <div
                                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-md sm:max-w-[80%] sm:px-4 sm:py-3 xl:max-w-[72%] ${
                                  outbound
                                    ? 'rounded-tl-sm bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-sky-500/20'
                                    : 'rounded-tr-sm border border-white/10 bg-white/[0.08] text-slate-100 backdrop-blur-sm'
                                }`}
                              >
                                <div className="mb-1.5 flex items-center gap-2 text-[10px] opacity-80 sm:text-[11px]">
                                  {outbound ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                                  <span className="font-semibold">{outbound ? 'موظف' : 'عميل'}</span>
                                  {source ? <span className="rounded-full bg-black/15 px-1.5 py-0.5">{source}</span> : null}
                                </div>

                                {messageImageUrl ? (
                                  <div className="mb-2 overflow-hidden rounded-xl border border-white/10 bg-black/10">
                                    <img src={messageImageUrl} alt="attachment" className="max-h-72 w-full object-cover" />
                                  </div>
                                ) : null}

                                {text ? <p className="whitespace-pre-wrap break-words text-sm leading-6 sm:leading-7">{text}</p> : null}

                                {messageQuickReplies.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {messageQuickReplies.map((reply, index) => (
                                      <span key={`${message.id}_${index}`} className="rounded-full border border-white/15 bg-black/10 px-2.5 py-0.5 text-[11px]">
                                        {reply.caption}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}

                                <div className={`mt-1.5 flex items-center gap-1 text-[10px] sm:text-[11px] ${outbound ? 'text-sky-100' : 'text-slate-400'}`}>
                                  <span>{formatTime(message.createdAt)}</span>
                                  {outbound ? <CheckCheck className="h-3 w-3" /> : null}
                                  {message.reviewedAt ? <span className="ms-1">• تمت المراجعة</span> : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleSend} className="border-t border-white/10 bg-[#0b1020]/50 p-3 sm:p-4">
                <div className="space-y-2.5">
                  {imageUrl ? (
                    <div className="flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/5 p-2">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10">
                        <img src={imageUrl} alt="preview" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-sky-300">صورة مرفقة</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500" dir="ltr">{imageUrl}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="shrink-0 rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300 transition hover:bg-rose-500/20"
                        aria-label="إزالة الصورة"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}

                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                      aria-label="رفع صورة"
                      title="رفع صورة"
                    >
                      <ImagePlus className="h-5 w-5" />
                    </button>
                    <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={uploadMessageImage} />

                    <input
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      className={`${inputClass} flex-1`}
                      placeholder="اكتب رسالتك هنا..."
                    />

                    <button
                      type="submit"
                      disabled={sending || (!replyText.trim() && !imageUrl.trim())}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-3 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
                      aria-label="إرسال"
                    >
                      {sending ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">{sending ? 'جارٍ الإرسال...' : 'إرسال'}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced((current) => !current)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
                    >
                      {showAdvanced ? '× إخفاء الخيارات' : '⚙ خيارات متقدمة'}
                    </button>
                    {replyText.length > 0 ? (
                      <span className="text-[10px] text-slate-500">{replyText.length} حرف</span>
                    ) : null}
                  </div>

                  {showAdvanced ? (
                    <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-300">رابط الصورة</label>
                        <input
                          value={imageUrl}
                          onChange={(event) => setImageUrl(event.target.value)}
                          className={inputClass}
                          dir="ltr"
                          placeholder="/api/images/example.jpg"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-300">Quick Replies</label>
                        <textarea
                          value={quickRepliesText}
                          onChange={(event) => setQuickRepliesText(event.target.value)}
                          className={`${inputClass} min-h-28`}
                          placeholder={'النص|flow|target\nالعنوان|node|content_id\nافتح الموقع|url|https://maps.google.com/...'}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 to-cyan-500/20 text-sky-300">
                  <Inbox className="h-8 w-8" />
                </div>
                <p className="text-base font-bold text-white">اختر محادثة للبدء</p>
                <p className="mt-2 text-sm text-slate-400">
                  اختر محادثة من القائمة لعرض الرسائل والرد على المريض
                </p>
              </div>
            </div>
          )}
        </DataCard>
      </div>

      {showBotGuide ? <BotGuideModal onClose={() => setShowBotGuide(false)} /> : null}
    </AppLayout>
  );
}
