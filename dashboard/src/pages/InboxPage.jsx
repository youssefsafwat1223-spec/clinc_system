import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCheck, MessageSquare, Pause, Phone, Play, Search, Send, User } from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';

const platformTabs = ['ALL', 'HUMAN', 'UNREAD', 'REVIEWED', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM'];

const platformLabels = {
  ALL: 'الكل',
  HUMAN: 'متابعة بشرية',
  UNREAD: 'غير مقروء',
  REVIEWED: 'تمت المراجعة',
  WHATSAPP: 'واتساب',
  FACEBOOK: 'فيسبوك',
  INSTAGRAM: 'انستجرام',
};

const chatStateLabels = {
  HUMAN: 'بشري',
  BOT: 'الرد الآلي',
};

function PlatformIcon({ platform, className = 'w-4 h-4' }) {
  if (platform === 'WHATSAPP') return <Phone className={`${className} text-green-500`} />;
  if (platform === 'FACEBOOK') return <MessageSquare className={`${className} text-blue-500`} />;
  if (platform === 'INSTAGRAM') return <MessageSquare className={`${className} text-pink-500`} />;
  return <MessageSquare className={`${className} text-gray-500`} />;
}

function formatMessageDayLabel(value) {
  const parsed = parseISO(value);
  if (isToday(parsed)) return 'اليوم';
  if (isYesterday(parsed)) return 'أمس';
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
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
        isHuman
          ? 'bg-red-100 text-red-700'
          : 'bg-green-100 text-green-700'
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
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, [conversation.length, selectedPatientId]);

  const fetchPatientsList = async (showLoading = true) => {
    try {
      if (showLoading) setLoadingList(true);
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
            unreadCount: msg.type === 'INBOUND' && !msg.readAt ? 1 : 0,
            reviewedCount: msg.reviewedAt ? 1 : 0,
          });
          return;
        }
        existing.messageCount += 1;
        if (msg.type === 'INBOUND' && !msg.readAt) {
          existing.unreadCount = (existing.unreadCount || 0) + 1;
        }
        if (msg.reviewedAt) {
          existing.reviewedCount = (existing.reviewedCount || 0) + 1;
        }
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
                }
              : patient
          )
        );
      }
    } catch (error) {
      toast.error('فشل في تحميل المحادثة');
    } finally {
      if (showLoading) setLoadingChat(false);
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
      toast.error('فشل في إرسال الرسالة');
      fetchConversation(selectedPatientId, false);
      fetchPatientsList(false);
    }
  };

  const handleEndConversation = async () => {
    if (!selectedPatientId) return;
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

  const handlePauseBot = async () => {
    if (!selectedPatientId) return;
    try {
      await api.post(`/messages/${selectedPatientId}/pause`);
      toast.success('تم إيقاف الرد الآلي لهذه المحادثة.');
      setPatients((current) =>
        current.map((patient) =>
          patient.id === selectedPatientId ? { ...patient, chatState: 'HUMAN' } : patient
        )
      );
      fetchConversation(selectedPatientId, false);
    } catch (error) {
      toast.error('فشل في إيقاف الرد الآلي');
    }
  };

  const platformCounts = useMemo(
    () =>
      patients.reduce(
        (accumulator, patient) => {
          accumulator.ALL += 1;
          if (patient.chatState === 'HUMAN') accumulator.HUMAN = (accumulator.HUMAN || 0) + 1;
          if ((patient.unreadCount || 0) > 0) accumulator.UNREAD = (accumulator.UNREAD || 0) + 1;
          if ((patient.reviewedCount || 0) > 0) accumulator.REVIEWED = (accumulator.REVIEWED || 0) + 1;
          if (patient.platform) {
            accumulator[patient.platform] = (accumulator[patient.platform] || 0) + 1;
          }
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
      const matchesSearch = !query || haystack.includes(query);
      return matchesPlatform && matchesState && matchesSearch;
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
    <AppLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        {/* Patient List */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-md border border-gray-200 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">💬 المحادثات</h2>
                <p className="text-sm text-gray-500 mt-1">قائمة الرسائل الأخيرة</p>
              </div>
              <div className="bg-gray-100 rounded-lg px-3 py-2">
                <p className="text-xs font-medium text-gray-600">الإجمالي</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{patients.length}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                <p className="text-xs font-medium text-red-700">متابعة بشرية</p>
                <p className="text-base font-bold text-red-600 mt-1">{humanThreadsCount}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                <p className="text-xs font-medium text-green-700">رد آلي</p>
                <p className="text-base font-bold text-green-600 mt-1">{patients.length - humanThreadsCount}</p>
              </div>
            </div>

            <div className="relative mb-4">
              <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ابحث بالاسم أو الرقم..."
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              {platformTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                    activeTab === tab
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {platformLabels[tab]} ({platformCounts[tab] || 0})
                </button>
              ))}
            </div>
          </div>

          {/* Patients List */}
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent"></div>
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-500 text-center px-4">
                <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm font-medium">لا توجد محادثات</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredPatients.map((patient) => {
                  const isSelected = selectedPatientId === patient.id;
                  return (
                    <button
                      key={patient.id}
                      onClick={() => setSelectedPatientId(patient.id)}
                      className={`w-full p-4 text-right transition ${
                        isSelected
                          ? 'bg-green-50 border-r-4 border-green-500'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <User className="h-5 w-5 text-white" />
                          </div>
                          {patient.unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                              {patient.unreadCount > 9 ? '9+' : patient.unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 truncate text-sm">{patient.name || 'بدون اسم'}</h4>
                          <p className="text-xs text-gray-500 mt-0.5" dir="ltr">
                            📱 {patient.phone || 'لا يوجد رقم'}
                          </p>
                          <div className="flex items-center gap-1 mt-1.5">
                            <StatusPill chatState={patient.chatState} />
                            {patient.unreadCount > 0 && (
                              <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                {patient.unreadCount} جديد
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-1 truncate">{patient.lastMessage || 'لا توجد رسالة'}</p>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0" dir="ltr">
                          {patient.lastMessageTime ? formatTime(patient.lastMessageTime) : '--'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-gray-200 flex flex-col overflow-hidden">
          {selectedPatientData ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedPatientData.name || 'بدون اسم'}</h3>
                    <p className="text-xs text-gray-500 mt-0.5" dir="ltr">
                      📱 {selectedPatientData.phone || 'لا يوجد رقم'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedPatientData.chatState === 'HUMAN' ? (
                    <button
                      onClick={handleEndConversation}
                      className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition flex items-center gap-2"
                    >
                      <Play className="h-4 w-4" />
                      تشغيل البوت
                    </button>
                  ) : (
                    <button
                      onClick={handlePauseBot}
                      className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition flex items-center gap-2"
                    >
                      <Pause className="h-4 w-4" />
                      إيقاف البوت
                    </button>
                  )}
                </div>
              </div>

              {/* Messages Container */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 bg-gray-50">
                {loadingChat ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent"></div>
                  </div>
                ) : groupedConversation.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center">
                    <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
                    <p className="font-medium">لا توجد رسائل</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupedConversation.map((group) => (
                      <div key={group.key}>
                        <div className="flex justify-center mb-3">
                          <span className="text-xs font-medium text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                            {group.label}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {group.messages.map((message) => {
                            const isOutbound = message.type === 'OUTBOUND';
                            return (
                              <div key={message.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                                <div
                                  className={`max-w-xs px-4 py-2 rounded-lg ${
                                    isOutbound
                                      ? 'bg-green-500 text-white rounded-tr-none'
                                      : 'bg-gray-300 text-gray-900 rounded-tl-none'
                                  }`}
                                >
                                  <p className="text-sm">{message.content}</p>
                                  <p className={`text-xs mt-1 ${isOutbound ? 'text-green-100' : 'text-gray-600'}`}>
                                    {formatTime(message.createdAt)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200">
                <form onSubmit={handleSend} className="flex items-end gap-3">
                  <textarea
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    placeholder="اكتب رسالتك..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    rows={2}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleSend(event);
                      }
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim()}
                    className="px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-center">
              <MessageSquare className="h-16 w-16 mb-4 opacity-30" />
              <p className="font-medium text-lg">اختر محادثة من القائمة</p>
              <p className="text-sm mt-2">افتح أي محادثة لعرض الرسائل وإرسال الرد</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
