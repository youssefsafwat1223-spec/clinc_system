import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, CheckCheck, Inbox, MessageSquare, Pause, Phone, Play, Search, Send, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

const chatStateLabels = {
  HUMAN: 'بشري',
  BOT: 'الرد الآلي',
};

function PlatformIcon({ platform, className = 'h-4 w-4' }) {
  if (platform === 'WHATSAPP') return <Phone className={`${className} text-emerald-300`} />;
  if (platform === 'FACEBOOK') return <MessageSquare className={`${className} text-sky-300`} />;
  if (platform === 'INSTAGRAM') return <MessageSquare className={`${className} text-pink-300`} />;
  return <MessageSquare className={`${className} text-slate-400`} />;
}

function formatDay(value) {
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
}

function formatTime(value) {
  return new Intl.DateTimeFormat('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatRelative(value) {
  if (!value) return '-';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  return formatDay(value);
}

function getMessageSourceLabel(metadata) {
  const source = metadata?.source;
  if (source === 'COMMENT') return 'تعليق';
  if (source === 'COMMENT_REPLY') return 'رد تعليق';
  if (source === 'APPOINTMENT_CONFIRMATION') return 'تأكيد موعد';
  if (source === 'APPOINTMENT_REJECTION') return 'تعديل موعد';
  return null;
}

function ChatStateBadge({ chatState }) {
  const isHuman = chatState === 'HUMAN';
  return (
    <StatusBadge tone={isHuman ? 'amber' : 'green'}>
      {isHuman ? 'تدخل بشري' : 'البوت يعمل'}
    </StatusBadge>
  );
}

export default function InboxPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const messagesContainerRef = useRef(null);

  const fetchPatientsList = async (showLoading = true) => {
    try {
      if (showLoading) setLoadingList(true);
      const res = await api.get('/messages', { params: { limit: 500 } });
      const uniquePatientsMap = new Map();

      (res.data.messages || []).forEach((message) => {
        const existing = uniquePatientsMap.get(message.patientId);
        const patient = message.patient || {};
        if (!existing) {
          uniquePatientsMap.set(message.patientId, {
            ...patient,
            id: message.patientId,
            platform: message.platform || patient.platform,
            lastMessage: message.content,
            lastMessageTime: message.createdAt,
            lastMessageType: message.type,
            lastMessageSource: getMessageSourceLabel(message.metadata),
            chatState: patient.chatState || 'BOT',
            messageCount: 1,
            unreadCount: message.type === 'INBOUND' && !message.readAt ? 1 : 0,
            reviewedCount: message.reviewedAt ? 1 : 0,
          });
          return;
        }

        existing.messageCount += 1;
        if (message.type === 'INBOUND' && !message.readAt) existing.unreadCount = (existing.unreadCount || 0) + 1;
        if (message.reviewedAt) existing.reviewedCount = (existing.reviewedCount || 0) + 1;
      });

      const nextPatients = Array.from(uniquePatientsMap.values()).sort(
        (first, second) => new Date(second.lastMessageTime).getTime() - new Date(first.lastMessageTime).getTime()
      );

      setPatients(nextPatients);
      setSelectedPatientId((current) => {
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
                  platform: res.data.patient.platform || patient.platform,
                  chatState: res.data.patient.chatState || patient.chatState,
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

  const updatePatientSummary = (patientId, content, createdAt) => {
    setPatients((current) =>
      current
        .map((patient) =>
          patient.id === patientId
            ? {
                ...patient,
                lastMessage: content,
                lastMessageTime: createdAt,
                lastMessageType: 'OUTBOUND',
                messageCount: (patient.messageCount || 0) + 1,
              }
            : patient
        )
        .sort((first, second) => new Date(second.lastMessageTime).getTime() - new Date(first.lastMessageTime).getTime())
    );
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (!replyText.trim() || !selectedPatientId) return;

    try {
      const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);
      const currentText = replyText.trim();
      const createdAt = new Date().toISOString();
      const tempMessage = {
        id: `temp_${Date.now()}`,
        content: currentText,
        type: 'OUTBOUND',
        createdAt,
        platform: selectedPatient?.platform,
      };

      setConversation((current) => [...current, tempMessage]);
      updatePatientSummary(selectedPatientId, currentText, createdAt);
      setReplyText('');

      await api.post('/messages/send', {
        patientId: selectedPatientId,
        content: currentText,
        platform: selectedPatient?.platform,
      });

      fetchConversation(selectedPatientId, false);
      fetchPatientsList(false);
    } catch (error) {
      toast.error('فشل إرسال الرسالة');
      fetchConversation(selectedPatientId, false);
      fetchPatientsList(false);
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
      const haystack = [patient.name, patient.displayName, patient.phone, patient.lastMessage].filter(Boolean).join(' ').toLowerCase();
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
  }, [filteredPatients, selectedPatientId]);

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

  return (
    <AppLayout>
      <PageHeader
        title="صندوق الوارد"
        description="متابعة رسائل واتساب وفيسبوك وإنستجرام، مع فصل المحادثات التي تحتاج تدخل بشري أو لم تتم قراءتها."
      />

      <div className="grid gap-4 lg:h-[calc(100vh-220px)] lg:min-h-[620px] lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
        <DataCard className="flex min-h-[520px] min-w-0 flex-col overflow-hidden p-0 lg:min-h-0">
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
              <div className="p-8 text-center text-sm text-slate-400">جاري تحميل المحادثات...</div>
            ) : filteredPatients.length === 0 ? (
              <div className="flex h-52 flex-col items-center justify-center text-center text-slate-400">
                <Inbox className="mb-3 h-10 w-10 text-slate-600" />
                لا توجد محادثات مطابقة للفلتر.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPatients.map((patient) => {
                  const selected = patient.id === selectedPatientId;
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => setSelectedPatientId(patient.id)}
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
                              <h3 className="text-sm font-black leading-6 text-white sm:truncate">{patient.displayName || patient.name || 'بدون اسم'}</h3>
                              <p className="mt-0.5 text-xs text-slate-500" dir="ltr">{patient.phone || '-'}</p>
                            </div>
                            <span className="shrink-0 text-[11px] text-slate-500">{formatRelative(patient.lastMessageTime)}</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-400 sm:truncate">{patient.lastMessage || 'لا توجد رسالة'}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <ChatStateBadge chatState={patient.chatState} />
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                              <PlatformIcon platform={patient.platform} />
                              {platformLabels[patient.platform] || patient.platform || 'غير محدد'}
                            </span>
                            {patient.reviewedCount ? <StatusBadge tone="blue">تمت مراجعة {patient.reviewedCount}</StatusBadge> : null}
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

        <DataCard className="flex min-h-[620px] min-w-0 flex-col overflow-hidden p-0 lg:min-h-0">
          {selectedPatientData ? (
            <>
              <div className="border-b border-white/10 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 text-white">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-white">{selectedPatientData.displayName || selectedPatientData.name || 'بدون اسم'}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span dir="ltr">{selectedPatientData.phone || '-'}</span>
                        <PlatformIcon platform={selectedPatientData.platform} />
                        <ChatStateBadge chatState={selectedPatientData.chatState} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
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

              <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto bg-[#080d1f] p-4 sm:p-5">
                {loadingChat ? (
                  <div className="flex h-full items-center justify-center text-slate-400">جاري تحميل المحادثة...</div>
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
                          const source = getMessageSourceLabel(message.metadata);
                          return (
                            <div key={message.id} className={`flex ${outbound ? 'justify-start' : 'justify-end'}`}>
                              <div
                                className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-lg sm:max-w-[78%] ${
                                  outbound
                                    ? 'rounded-tl-sm bg-sky-500 text-white shadow-sky-500/10'
                                    : 'rounded-tr-sm border border-white/10 bg-white/10 text-slate-100'
                                }`}
                              >
                                <div className="mb-2 flex items-center gap-2 text-[11px] opacity-80">
                                  {outbound ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                                  <span>{outbound ? 'موظف' : 'مريض'}</span>
                                  {source ? <span className="rounded-full bg-black/10 px-2 py-0.5">{source}</span> : null}
                                </div>
                                <p className="whitespace-pre-wrap break-words text-sm leading-7">{message.content}</p>
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
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    className={inputClass}
                    placeholder="اكتب رسالتك هنا..."
                  />
                  <PrimaryButton type="submit" disabled={!replyText.trim()} className="w-full sm:w-auto">
                    <Send className="h-4 w-4" />
                    إرسال
                  </PrimaryButton>
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
    </AppLayout>
  );
}
