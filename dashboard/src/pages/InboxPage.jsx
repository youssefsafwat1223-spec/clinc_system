import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, CheckCheck, MessageSquare, Phone, Search, Send, User } from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';

const platformTabs = ['ALL', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM'];

const platformLabels = {
  ALL: 'الكل',
  WHATSAPP: 'واتساب',
  FACEBOOK: 'فيسبوك',
  INSTAGRAM: 'انستجرام',
};

const chatStateLabels = {
  HUMAN: 'بشري',
  BOT: 'الرد الآلي',
};

function PlatformIcon({ platform, className = 'w-4 h-4' }) {
  if (platform === 'WHATSAPP') return <Phone className={`${className} text-emerald-500`} />;
  if (platform === 'FACEBOOK') return <MessageSquare className={`${className} text-blue-500`} />;
  if (platform === 'INSTAGRAM') return <MessageSquare className={`${className} text-pink-500`} />;
  return <MessageSquare className={`${className} text-slate-500`} />;
}

function formatMessageDayLabel(value) {
  const parsed = parseISO(value);

  if (isToday(parsed)) {
    return 'اليوم';
  }

  if (isYesterday(parsed)) {
    return 'أمس';
  }

  return format(parsed, 'EEEE dd MMMM', { locale: ar });
}

function formatTime(value) {
  return format(parseISO(value), 'hh:mm a', { locale: ar });
}

function getMessageSourceLabel(metadata) {
  const source = metadata?.source;

  if (source === 'COMMENT') return 'تعليق';
  if (source === 'COMMENT_REPLY') return 'رد تعليق';
  if (source === 'APPOINTMENT_CONFIRMATION') return 'تأكيد موعد';
  if (source === 'APPOINTMENT_REJECTION') return 'تعديل موعد';
  return null;
}

function StatusPill({ chatState }) {
  const isHuman = chatState === 'HUMAN';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${
        isHuman
          ? 'bg-amber-500/10 text-amber-300 ring-amber-500/20'
          : 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
      }`}
    >
      {chatStateLabels[chatState] || 'غير معروف'}
    </span>
  );
}

export default function InboxPage() {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    fetchPatientsList();
  }, []);

  useEffect(() => {
    if (selectedPatientId) {
      fetchConversation(selectedPatientId);
    } else {
      setConversation([]);
    }
  }, [selectedPatientId]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchPatientsList(false);
      if (selectedPatientId) {
        fetchConversation(selectedPatientId, false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedPatientId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, [conversation.length, selectedPatientId]);

  const fetchPatientsList = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoadingList(true);
      }

      const res = await api.get('/messages', { params: { limit: 500 } });
      const uniquePatientsMap = new Map();

      (res.data.messages || []).forEach((msg) => {
        const existing = uniquePatientsMap.get(msg.patientId);

        if (!existing) {
          uniquePatientsMap.set(msg.patientId, {
            ...msg.patient,
            id: msg.patientId,
            platform: msg.platform || msg.patient?.platform,
            lastMessage: msg.content,
            lastMessageTime: msg.createdAt,
            lastMessageType: msg.type,
            lastMessageSource: getMessageSourceLabel(msg.metadata),
            chatState: msg.patient?.chatState || 'BOT',
            messageCount: 1,
          });
          return;
        }

        existing.messageCount += 1;
      });

      const nextPatients = Array.from(uniquePatientsMap.values()).sort(
        (first, second) => new Date(second.lastMessageTime).getTime() - new Date(first.lastMessageTime).getTime()
      );

      setPatients(nextPatients);
      setSelectedPatientId((current) => {
        if (current && nextPatients.some((patient) => patient.id === current)) {
          return current;
        }

        return nextPatients[0]?.id || null;
      });
    } catch (error) {
      toast.error('فشل في تحميل قائمة الرسائل');
    } finally {
      if (showLoading) {
        setLoadingList(false);
      }
    }
  };

  const fetchConversation = async (patientId, showLoading = true) => {
    try {
      if (showLoading) {
        setLoadingChat(true);
      }

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
                }
              : patient
          )
        );
      }
    } catch (error) {
      toast.error('فشل في تحميل المحادثة');
    } finally {
      if (showLoading) {
        setLoadingChat(false);
      }
    }
  };

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

    if (!replyText.trim() || !selectedPatientId) {
      return;
    }

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
      toast.error('فشل في إرسال الرسالة');
      fetchConversation(selectedPatientId, false);
      fetchPatientsList(false);
    }
  };

  const handleEndConversation = async () => {
    if (!selectedPatientId) {
      return;
    }

    try {
      await api.post(`/messages/${selectedPatientId}/end`);
      toast.success('تم إنهاء المحادثة وسيعود الرد الآلي للعمل الآن.');
      setPatients((current) =>
        current.map((patient) =>
          patient.id === selectedPatientId ? { ...patient, chatState: 'BOT' } : patient
        )
      );
      fetchConversation(selectedPatientId, false);
    } catch (error) {
      toast.error('فشل في إنهاء المحادثة');
    }
  };

  const platformCounts = useMemo(
    () =>
      patients.reduce(
        (accumulator, patient) => {
          accumulator.ALL += 1;
          if (patient.platform) {
            accumulator[patient.platform] = (accumulator[patient.platform] || 0) + 1;
          }
          return accumulator;
        },
        { ALL: 0, WHATSAPP: 0, FACEBOOK: 0, INSTAGRAM: 0 }
      ),
    [patients]
  );

  const filteredPatients = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return patients.filter((patient) => {
      const matchesPlatform = activeTab === 'ALL' || patient.platform === activeTab;
      const haystack = [patient.name, patient.phone, patient.lastMessage].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      return matchesPlatform && matchesSearch;
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

  const groupedConversation = useMemo(() => {
    const groups = [];

    conversation.forEach((message) => {
      const key = format(parseISO(message.createdAt), 'yyyy-MM-dd');
      const label = formatMessageDayLabel(message.createdAt);
      const lastGroup = groups[groups.length - 1];

      if (!lastGroup || lastGroup.key !== key) {
        groups.push({ key, label, messages: [message] });
        return;
      }

      lastGroup.messages.push(message);
    });

    return groups;
  }, [conversation]);

  const humanThreadsCount = useMemo(
    () => patients.filter((patient) => patient.chatState === 'HUMAN').length,
    [patients]
  );

  return (
    <AppLayout noPadding={true}>
      <div className="relative z-20 flex h-full min-h-0 flex-col overflow-hidden bg-dark-bg/80 backdrop-blur-3xl">
        <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-6 sm:px-6 sm:pb-6 lg:gap-6 lg:pt-7 xl:flex-row xl:overflow-hidden">
          <div className="flex min-h-[320px] w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-dark-border/60 bg-[#0a1120]/75 shadow-2xl backdrop-blur-xl xl:h-full xl:w-[26rem]">
            <div className="space-y-4 border-b border-dark-border/50 bg-[#0a1120]/95 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-wide text-white">
                    <MessageSquare className="h-5 w-5 text-primary-400" />
                    المحادثات
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">قائمة المحادثات الأحدث مع ملخص سريع لكل حالة</p>
                </div>
                <div className="rounded-2xl border border-dark-border/50 bg-dark-bg/50 px-3 py-2 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Threads</p>
                  <p className="mt-1 text-base font-extrabold text-white">{patients.length}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-dark-border/40 bg-dark-bg/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Manual</p>
                  <p className="mt-2 text-lg font-bold text-amber-300">{humanThreadsCount}</p>
                  <p className="mt-1 text-[11px] text-slate-400">تحتاج متابعة بشرية</p>
                </div>
                <div className="rounded-2xl border border-dark-border/40 bg-dark-bg/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Bot</p>
                  <p className="mt-2 text-lg font-bold text-emerald-300">{patients.length - humanThreadsCount}</p>
                  <p className="mt-1 text-[11px] text-slate-400">تعمل بالرد الآلي</p>
                </div>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="ابحث بالاسم أو الرقم أو آخر رسالة..."
                  className="input-field rounded-2xl border-dark-border/60 bg-dark-bg/70 pr-11 text-sm"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto rounded-xl border border-dark-border/40 bg-dark-bg/50 p-1 custom-scrollbar">
                {platformTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex min-w-fit items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                      activeTab === tab
                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                        : 'text-slate-400 hover:bg-dark-border/40 hover:text-white'
                    }`}
                  >
                    <span>{platformLabels[tab]}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                        activeTab === tab ? 'bg-white/15 text-white' : 'bg-dark-border/50 text-slate-300'
                      }`}
                    >
                      {platformCounts[tab] || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
              {loadingList ? (
                <div className="flex justify-center p-8">
                  <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary-500 border-t-transparent shadow-lg shadow-primary-500/20"></span>
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="flex flex-col items-center p-12 text-center text-slate-500">
                  <MessageSquare className="mb-3 h-12 w-12 opacity-30" />
                  <p className="font-semibold text-sm">
                    {patients.length === 0 ? 'صندوق الوارد فارغ' : 'لا توجد محادثات تطابق الفلاتر الحالية'}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">جرّب تغيير التصنيف أو امسح نص البحث.</p>
                </div>
              ) : (
                <div className="divide-y divide-dark-border/30">
                  {filteredPatients.map((patient) => {
                    const isSelected = selectedPatientId === patient.id;
                    const isOutbound = patient.lastMessageType === 'OUTBOUND';

                    return (
                      <button
                        key={patient.id}
                        onClick={() => setSelectedPatientId(patient.id)}
                        className={`flex w-full gap-4 p-4 text-right transition-all duration-200 ${
                          isSelected
                            ? 'border-r-4 border-primary-500 bg-gradient-to-r from-primary-900/30 to-transparent'
                            : 'border-r-4 border-transparent hover:bg-[#111c33]/70'
                        }`}
                      >
                        <div className="relative h-12 w-12 shrink-0 rounded-full bg-slate-800/80 ring-2 ring-slate-700/50 shadow-inner">
                          <div className="flex h-full w-full items-center justify-center">
                            <User className="h-5 w-5 text-slate-300" />
                          </div>
                          <div className="absolute -bottom-1 -left-1 rounded-full bg-[#0a1120] p-1 shadow-md">
                            <PlatformIcon platform={patient.platform} className="h-3.5 w-3.5" />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className={`truncate text-sm font-bold ${isSelected ? 'text-primary-100' : 'text-slate-100'}`}>
                                {patient.name || 'بدون اسم'}
                              </h4>
                              <p className="mt-1 text-[11px] text-slate-500" dir="ltr">
                                {patient.phone || 'No phone'}
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] font-medium tracking-wide text-slate-500" dir="ltr">
                              {patient.lastMessageTime ? formatTime(patient.lastMessageTime) : '--'}
                            </span>
                          </div>

                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <StatusPill chatState={patient.chatState} />
                            <span className="inline-flex items-center gap-1 rounded-full bg-dark-bg/70 px-2.5 py-1 text-[10px] font-bold text-slate-400 ring-1 ring-dark-border/60">
                              <PlatformIcon platform={patient.platform} className="h-3 w-3" />
                              {platformLabels[patient.platform] || 'منصة'}
                            </span>
                            <span className="rounded-full bg-dark-bg/70 px-2.5 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-dark-border/60">
                              {patient.messageCount || 0} رسالة
                            </span>
                          </div>

                          <div className={`flex items-center gap-2 text-xs ${isSelected ? 'text-primary-200/90' : 'text-slate-400'}`}>
                            <span
                              className={`rounded-full px-2 py-0.5 font-bold ${
                                isOutbound ? 'bg-primary-500/10 text-primary-300' : 'bg-slate-700/60 text-slate-300'
                              }`}
                            >
                              {isOutbound ? 'صادر' : 'وارد'}
                            </span>
                            {patient.lastMessageSource ? (
                              <span className="rounded-full bg-sky-500/10 px-2 py-0.5 font-bold text-sky-300">
                                {patient.lastMessageSource}
                              </span>
                            ) : null}
                            <p className="truncate">{patient.lastMessage || 'لا توجد رسالة بعد'}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="relative z-10 flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-2xl border border-dark-border/60 bg-[#060a12]/80 shadow-2xl xl:h-full xl:min-h-0">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] opacity-5"></div>

            {selectedPatientData ? (
              <>
                <div className="relative z-20 flex h-[92px] shrink-0 items-center justify-between border-b border-dark-border/50 bg-[#0a1120]/95 px-6 backdrop-blur-md">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800 shadow-inner ring-1 ring-slate-600/50">
                      <User className="h-6 w-6 text-slate-300" />
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate text-base font-extrabold leading-tight text-white">
                        {selectedPatientData.name || 'بدون اسم'}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium tracking-wide text-primary-300 opacity-90" dir="ltr">
                          {selectedPatientData.phone || 'No phone'}
                        </p>
                        <span className="h-1 w-1 rounded-full bg-dark-muted"></span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                          <PlatformIcon platform={selectedPatientData.platform} className="h-3 w-3" />
                          {platformLabels[selectedPatientData.platform] || 'منصة'}
                        </span>
                        <StatusPill chatState={selectedPatientData.chatState} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden rounded-2xl border border-dark-border/50 bg-dark-bg/50 px-3 py-2 text-right md:block">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Messages</p>
                      <p className="mt-1 text-sm font-bold text-white">{conversation.length}</p>
                    </div>

                    {selectedPatientData.chatState === 'HUMAN' && (
                      <button
                        onClick={handleEndConversation}
                        className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-500 hover:text-white hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                        title="إرجاع المحادثة إلى الرد الآلي"
                      >
                        <Bot className="h-4 w-4" />
                        إنهاء المحادثة
                      </button>
                    )}
                  </div>
                </div>

                <div ref={messagesContainerRef} className="relative z-10 min-h-0 flex-1 overflow-y-auto p-6 custom-scrollbar">
                  {loadingChat ? (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-dark-bg/50 backdrop-blur-sm">
                      <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary-500 border-t-transparent"></span>
                    </div>
                  ) : groupedConversation.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <MessageSquare className="mb-4 h-12 w-12 text-slate-600/50" />
                      <p className="text-base font-bold text-slate-300">لا توجد رسائل داخل هذه المحادثة</p>
                      <p className="mt-2 max-w-sm text-sm text-slate-500">يمكنك إرسال أول رسالة من الصندوق السفلي إذا كانت القناة تسمح بذلك.</p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {groupedConversation.map((group) => (
                        <div key={group.key} className="space-y-4">
                          <div className="flex items-center justify-center gap-4 opacity-80">
                            <div className="h-px w-16 bg-gradient-to-l from-dark-border to-transparent"></div>
                            <span className="rounded-full border border-dark-border/50 bg-[#0a1120] px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              {group.label}
                            </span>
                            <div className="h-px w-16 bg-gradient-to-r from-dark-border to-transparent"></div>
                          </div>

                          {group.messages.map((message) => {
                            const isOutbound = message.type === 'OUTBOUND';

                            return (
                              <div key={message.id} className={`flex w-full ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                                <div
                                  className={`max-w-[82%] rounded-2xl border p-4 shadow-lg lg:max-w-[68%] ${
                                    isOutbound
                                      ? 'rounded-tl-sm border-primary-400/30 bg-gradient-to-br from-primary-600 to-primary-700 text-white'
                                      : 'rounded-tr-sm border-dark-border/60 bg-[#111c33] text-slate-100'
                                  }`}
                                >
                                  <p className="whitespace-pre-wrap text-sm font-medium leading-7">{message.content}</p>

                                  <div
                                    className={`mt-3 flex flex-wrap items-center justify-end gap-1.5 text-[10px] font-bold tracking-wide ${
                                      isOutbound ? 'text-primary-100/90' : 'text-slate-500'
                                    }`}
                                  >
                                    {getMessageSourceLabel(message.metadata) ? (
                                      <span
                                        className={`rounded-full px-2 py-0.5 ${
                                          isOutbound
                                            ? 'bg-white/10 text-primary-50'
                                            : 'bg-sky-500/10 text-sky-300'
                                        }`}
                                      >
                                        {getMessageSourceLabel(message.metadata)}
                                      </span>
                                    ) : null}
                                    <span className="rounded-full px-1.5 py-0.5">
                                      {isOutbound ? 'صادر' : 'وارد'}
                                    </span>
                                    <span className="font-sans" dir="ltr">
                                      {formatTime(message.createdAt)}
                                    </span>
                                    {isOutbound ? <CheckCheck className="h-3.5 w-3.5" /> : null}
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

                <div className="relative z-20 shrink-0 border-t border-dark-border/50 bg-[#0a1120]/95 p-4 backdrop-blur-md">
                  <form onSubmit={handleSend} className="mx-auto flex max-w-5xl items-end gap-3">
                    <div className="group relative flex flex-1 overflow-hidden rounded-2xl border border-dark-border/60 bg-[#060a12] shadow-inner transition-all focus-within:border-primary-500/50 focus-within:ring-2 ring-primary-500/30">
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary-500/5 to-transparent opacity-0 transition-opacity group-focus-within:opacity-100"></div>

                      <textarea
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        placeholder="اكتب رسالتك للمريض..."
                        className="custom-scrollbar relative z-10 min-h-[56px] max-h-32 w-full resize-none bg-transparent px-5 py-4 text-[15px] font-medium text-white placeholder-slate-500 focus:outline-none"
                        rows={1}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            handleSend(event);
                          }
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!replyText.trim()}
                      className="btn-primary group h-14 w-14 shrink-0 rounded-2xl shadow-[0_8px_20px_-6px_rgba(14,165,233,0.4)] transition-all duration-300 disabled:scale-95 disabled:opacity-40"
                    >
                      <Send className="relative z-10 h-5 w-5 text-white transition-transform group-hover:-translate-y-1 group-hover:-translate-x-1 rtl:scale-x-[-1] rtl:group-hover:translate-x-1 rtl:group-hover:-translate-y-1" />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
                <div className="mb-6 flex h-32 w-32 items-center justify-center rounded-full border border-dark-border/30 bg-[#0a1120]/50 shadow-inner backdrop-blur-sm">
                  <MessageSquare className="h-12 w-12 text-slate-600/50" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-300">اختر محادثة من القائمة</h3>
                <p className="max-w-sm text-center text-sm text-slate-500">
                  افتح أي محادثة من الشريط الجانبي لعرض الرسائل، متابعة الحالة، أو إرسال رد سريع.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
