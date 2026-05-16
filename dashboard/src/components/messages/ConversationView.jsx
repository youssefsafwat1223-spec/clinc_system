import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../api/client';
import { DataCard, PageLoader, PrimaryButton, inputClass } from '../ui';
import EmptyState from '../EmptyState';

const formatMessageTime = (value) =>
  value ? new Date(value).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '';

export default function ConversationView({ patientId, platform = '', title = 'المحادثة' }) {
  const [messages, setMessages] = useState([]);
  const [patient, setPatient] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(Boolean(patientId));
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const loadConversation = async (showLoading = true) => {
    if (!patientId) return;
    if (showLoading) setLoading(true);
    try {
      const res = await api.get(`/messages/conversation/${patientId}`);
      setMessages(res.data.messages || []);
      setPatient(res.data.patient || null);
    } catch (error) {
      toast.error(error.message || 'فشل تحميل المحادثة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversation();
  }, [patientId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!content.trim() || !patientId) return;
    setSending(true);
    try {
      await api.post('/messages/send', {
        patientId,
        platform: platform || patient?.platform || 'WHATSAPP',
        content: content.trim(),
      });
      setContent('');
      await loadConversation(false);
    } catch (error) {
      toast.error(error.message || 'فشل إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  if (!patientId) {
    return (
      <DataCard>
        <EmptyState title="لا توجد محادثة" description="اختر مريضاً لعرض الرسائل." />
      </DataCard>
    );
  }

  return (
    <DataCard className="flex min-h-[520px] flex-col">
      <div className="mb-4 border-b border-white/10 pb-3">
        <h3 className="text-lg font-black text-white">{title}</h3>
        <p className="text-sm text-slate-400">{patient?.displayName || patient?.name || ''}</p>
      </div>

      {loading ? (
        <PageLoader />
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-white/5 bg-[#070b17]/60 p-4">
          {messages.length === 0 ? (
            <EmptyState title="لا توجد رسائل" description="لا توجد رسائل محفوظة لهذا المريض." />
          ) : (
            messages.map((message) => {
              const outbound = message.type === 'OUTBOUND';
              return (
                <div key={message.id} className={`flex ${outbound ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${outbound ? 'bg-sky-500 text-white' : 'border border-white/10 bg-white/5 text-slate-200'}`}>
                    <p>{message.content}</p>
                    {message.metadata?.imageUrl ? (
                      <a className="mt-2 block text-xs underline" href={message.metadata.imageUrl} target="_blank" rel="noreferrer">
                        صورة مرفقة
                      </a>
                    ) : null}
                    <p className="mt-2 text-[11px] opacity-70">{formatMessageTime(message.createdAt)}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <form onSubmit={sendMessage} className="mt-4 flex gap-2">
        <input className={inputClass} value={content} onChange={(event) => setContent(event.target.value)} placeholder="اكتب رسالة..." />
        <PrimaryButton type="submit" disabled={sending || !content.trim()}>
          <Send className="h-4 w-4" />
          إرسال
        </PrimaryButton>
      </form>
    </DataCard>
  );
}
