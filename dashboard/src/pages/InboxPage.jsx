import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  CheckCheck,
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

      const haystack = [patient.name, patient.phone, patient.lastMessage].filter(Boolean).join(' ').toLowerCase();
      return matchesPlatform && matchesState && (!query || haystack.includes(query));
    });
  }, [activeTab, patients, searchTerm]);

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

      <div className="grid gap-4 lg:h-[calc(100vh-220px)] lg:min-h-[620px] lg:grid-cols-[420px_minmax(0,1fr)] xl:grid-cols-[460px_minmax(0,1fr)]">
        <DataCard
          className={`min-w-0 overflow-hidden p-0 ${
            isMobileConversationOpen ? 'hidden lg:flex' : 'flex h-[calc(100vh-220px)] min-h-[460px] flex-col lg:h-auto lg:min-h-0'
          }`}
        >
          <div className="border-b border-white/10 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white">المحادثات</h2>
                <p className="mt-1 text-xs text-slate-400">{patients.length} محادثة مسجلة</p>
              </div>
              <StatusBadge tone="blue">{platformCounts.UNREAD} غير مقروء</StatusBadge>
            </div>

            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-slate-500" />
              <input
                className={`${inputClass} pr-10`}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ابحث بالاسم أو الرقم أو الرسالة..."
              />
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
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
                  {platformLabels[tab]} ({platformCounts[tab] || 0})
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {loadingList ? (
              <div className="p-8 text-center text-sm text-slate-400">جارٍ تحميل المحادثات...</div>
            ) : filteredPatients.length === 0 ? (
              <div className="flex h-52 flex-col items-center justify-center text-center text-slate-400">
                <Inbox className="mb-3 h-10 w-10 text-slate-600" />
                لا توجد محادثات مطابقة للفلاتر.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPatients.map((patient) => {
                  const selected = patient.id === selectedPatientId;
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => {
                        setSelectedPatientId(patient.id);
                        setIsMobileConversationOpen(true);
                      }}
                      className={`w-full rounded-2xl border p-4 text-right transition ${
                        selected
                          ? 'border-sky-500/40 bg-sky-500/10 shadow-lg shadow-sky-500/10'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 text-white">
                          <User className="h-5 w-5" />
                          {(patient.unreadCount || 0) > 0 ? (
                            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
                              {patient.unreadCount}
                            </span>
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-sm font-black leading-6 text-white sm:truncate">{patient.name}</h3>
                              <p className="mt-0.5 text-xs text-slate-500" dir="ltr">{patient.phone || '-'}</p>
                            </div>
                            <span className="shrink-0 text-[11px] text-slate-500">{formatRelative(patient.lastMessageTime)}</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-400 sm:truncate">{patient.lastMessage || 'بدون نص'}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <StatusBadge tone={patient.chatState === 'HUMAN' ? 'amber' : 'green'}>
                              {patient.chatState === 'HUMAN' ? 'متابعة بشرية' : 'البوت يعمل'}
                            </StatusBadge>
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                              <PlatformIcon platform={patient.platform} />
                              {platformLabels[patient.platform] || patient.platform || 'غير محدد'}
                            </span>
                          </div>
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
          className={`min-w-0 overflow-hidden p-0 ${
            !isMobileConversationOpen && !selectedPatientData ? 'hidden lg:flex' : 'flex h-[calc(100vh-220px)] min-h-[560px] flex-col lg:h-auto lg:min-h-0'
          }`}
        >
          {selectedPatientData ? (
            <>
              <div className="border-b border-white/10 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsMobileConversationOpen(false)}
                      className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
                      aria-label="العودة إلى المحادثات"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 text-white">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-white">{selectedPatientData.name}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span dir="ltr">{selectedPatientData.phone || '-'}</span>
                        <PlatformIcon platform={selectedPatientData.platform} />
                        <StatusBadge tone={platformTone[selectedPatientData.platform] || 'slate'}>
                          {platformLabels[selectedPatientData.platform] || selectedPatientData.platform}
                        </StatusBadge>
                        <StatusBadge tone={selectedPatientData.chatState === 'HUMAN' ? 'amber' : 'green'}>
                          {selectedPatientData.chatState === 'HUMAN' ? 'متابعة بشرية' : 'البوت يعمل'}
                        </StatusBadge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
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
                      className="w-full sm:w-auto"
                    >
                      حجز موعد لهذا المريض
                    </PrimaryButton>
                    <SecondaryButton type="button" onClick={() => navigate(`/patients/${selectedPatientData.id}`)} className="w-full sm:w-auto">
                      ملف المريض
                    </SecondaryButton>
                    {selectedPatientData.chatState === 'HUMAN' ? (
                      <PrimaryButton type="button" onClick={handleEndConversation} className="w-full sm:w-auto">
                        <Play className="h-4 w-4" />
                        إنهاء المتابعة
                      </PrimaryButton>
                    ) : (
                      <SecondaryButton type="button" onClick={handlePauseBot} className="w-full sm:w-auto">
                        <Pause className="h-4 w-4" />
                        إيقاف البوت
                      </SecondaryButton>
                    )}
                  </div>
                </div>
              </div>

              <div ref={messagesContainerRef} className="chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#080d1f] p-4 sm:p-5 lg:p-6">
                {loadingChat ? (
                  <div className="flex h-full items-center justify-center text-slate-400">جارٍ تحميل المحادثة...</div>
                ) : groupedMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                    <MessageSquare className="mb-3 h-10 w-10 text-slate-600" />
                    لا توجد رسائل في هذه المحادثة.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {groupedMessages.map((group) => (
                      <div key={group.key} className="space-y-3">
                        <div className="text-center">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-400">{group.label}</span>
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
                                className={`max-w-[92%] rounded-2xl px-4 py-3 shadow-lg sm:max-w-[84%] xl:max-w-[76%] ${
                                  outbound
                                    ? 'rounded-tl-sm bg-sky-500 text-white shadow-sky-500/10'
                                    : 'rounded-tr-sm border border-white/10 bg-white/10 text-slate-100'
                                }`}
                              >
                                <div className="mb-2 flex items-center gap-2 text-[11px] opacity-80">
                                  {outbound ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                                  <span>{outbound ? 'موظف' : 'عميل'}</span>
                                  {source ? <span className="rounded-full bg-black/10 px-2 py-0.5">{source}</span> : null}
                                </div>

                                {messageImageUrl ? (
                                  <div className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-black/10">
                                    <img src={messageImageUrl} alt="attachment" className="max-h-72 w-full object-cover" />
                                  </div>
                                ) : null}

                                {text ? <p className="whitespace-pre-wrap break-words text-sm leading-7">{text}</p> : null}

                                {messageQuickReplies.length > 0 ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {messageQuickReplies.map((reply, index) => (
                                      <span key={`${message.id}_${index}`} className="rounded-full border border-white/15 bg-black/10 px-3 py-1 text-xs">
                                        {reply.caption}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}

                                <div className={`mt-2 flex items-center gap-1 text-[11px] ${outbound ? 'text-sky-100' : 'text-slate-400'}`}>
                                  <span>{formatTime(message.createdAt)}</span>
                                  {outbound ? <CheckCheck className="h-3.5 w-3.5" /> : null}
                                  {message.reviewedAt ? <span>تمت المراجعة</span> : null}
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

              <form onSubmit={handleSend} className="border-t border-white/10 p-4">
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      className={inputClass}
                      placeholder="اكتب رسالتك هنا..."
                    />
                    <PrimaryButton type="submit" disabled={sending || (!replyText.trim() && !imageUrl.trim())} className="w-full sm:w-auto">
                      <Send className="h-4 w-4" />
                      {sending ? 'جارٍ الإرسال...' : 'إرسال'}
                    </PrimaryButton>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <SecondaryButton type="button" onClick={() => imageInputRef.current?.click()}>
                      <ImagePlus className="h-4 w-4" />
                      رفع صورة
                    </SecondaryButton>
                    <SecondaryButton type="button" onClick={() => setShowAdvanced((current) => !current)}>
                      {showAdvanced ? 'إخفاء الخيارات' : 'خيارات متقدمة'}
                    </SecondaryButton>
                    <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={uploadMessageImage} />
                  </div>

                  {imageUrl ? (
                    <div className="rounded-2xl border border-white/10 bg-[#0d1225] p-3">
                      <p className="mb-2 text-xs font-bold text-slate-400">الصورة الحالية</p>
                      <div className="overflow-hidden rounded-2xl border border-white/10">
                        <img src={imageUrl} alt="preview" className="max-h-56 w-full object-cover" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="mt-3 text-xs font-bold text-rose-300 hover:text-rose-200"
                      >
                        إزالة الصورة
                      </button>
                    </div>
                  ) : null}

                  {showAdvanced ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-300">رابط الصورة</label>
                        <input
                          value={imageUrl}
                          onChange={(event) => setImageUrl(event.target.value)}
                          className={inputClass}
                          dir="ltr"
                          placeholder="/api/images/example.jpg"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-300">Quick Replies</label>
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
            <div className="flex flex-1 flex-col items-center justify-center text-center text-slate-400">
              <Inbox className="mb-3 h-12 w-12 text-slate-600" />
              اختر محادثة من القائمة لعرض الرسائل.
            </div>
          )}
        </DataCard>
      </div>

      {showBotGuide ? <BotGuideModal onClose={() => setShowBotGuide(false)} /> : null}
    </AppLayout>
  );
}
