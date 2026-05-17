import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Pause, Play, Send, X } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../api/client';
import { DataCard, PageLoader, PrimaryButton, SecondaryButton, inputClass } from '../ui';
import EmptyState from '../EmptyState';

const formatMessageTime = (value) =>
  value ? new Date(value).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '';

const parseQuickRepliesInput = (value) =>
  String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [caption = '', type = '', target = ''] = line.split('|').map((part) => part.trim());
      if (!caption || !type) return null;
      if (type === 'url') return { caption, type, url: target };
      return { caption, type, target };
    })
    .filter(Boolean);

export default function ConversationView({ patientId, platform = '', title = 'المحادثة' }) {
  const [messages, setMessages] = useState([]);
  const [patient, setPatient] = useState(null);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [quickRepliesText, setQuickRepliesText] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(Boolean(patientId));
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const bottomRef = useRef(null);
  const imageInputRef = useRef(null);

  const loadConversation = async (showLoading = true) => {
    if (!patientId) return;
    if (showLoading) setLoading(true);
    try {
      const res = await api.get(`/messages/conversation/${patientId}`);
      setMessages(res.data.messages || []);
      setPatient(res.data.patient || null);
    } catch (error) {
      if (showLoading) toast.error(error.message || 'فشل تحميل المحادثة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return undefined;
    const interval = setInterval(() => loadConversation(false), 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const isHuman = patient?.chatState === 'HUMAN';

  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = '';
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    setUploadingImage(true);
    try {
      const res = await api.post('/upload/campaign-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImageUrl(res.data.url);
      toast.success('تم رفع الصورة');
    } catch (error) {
      toast.error(error.message || 'فشل رفع الصورة');
    } finally {
      setUploadingImage(false);
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if ((!content.trim() && !imageUrl.trim()) || !patientId) return;
    setSending(true);
    try {
      await api.post('/messages/send', {
        patientId,
        platform: platform || patient?.platform || 'WHATSAPP',
        content: content.trim(),
        imageUrl: imageUrl.trim() || undefined,
        quickReplies: parseQuickRepliesInput(quickRepliesText),
      });
      setContent('');
      setImageUrl('');
      setQuickRepliesText('');
      await loadConversation(false);
    } catch (error) {
      toast.error(error.message || 'فشل إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  const toggleBot = async () => {
    if (!patientId) return;
    try {
      await api.post(`/messages/${patientId}/${isHuman ? 'end' : 'pause'}`);
      toast.success(isHuman ? 'تمت إعادة المحادثة للبوت' : 'تم إيقاف البوت لهذه المحادثة');
      await loadConversation(false);
    } catch (error) {
      toast.error(error.message || 'تعذر تغيير حالة البوت');
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
    <DataCard className="flex min-h-[560px] flex-col">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h3 className="text-lg font-black text-white">{title}</h3>
          <p className="text-sm text-slate-400">
            {patient?.displayName || patient?.name || ''}
            {patient ? (
              <span className={`ms-2 text-xs font-bold ${isHuman ? 'text-amber-300' : 'text-emerald-300'}`}>
                {isHuman ? 'متابعة بشرية' : 'البوت يعمل'}
              </span>
            ) : null}
          </p>
        </div>
        <SecondaryButton
          type="button"
          onClick={toggleBot}
          className={isHuman ? 'hover:bg-emerald-500/15' : 'hover:bg-amber-500/15'}
        >
          {isHuman ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          {isHuman ? 'إرجاع للبوت' : 'إيقاف البوت'}
        </SecondaryButton>
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
              const messageImageUrl = message.metadata?.imageUrl || null;
              const quickReplies = Array.isArray(message.metadata?.quickReplies)
                ? message.metadata.quickReplies
                : [];
              return (
                <div key={message.id} className={`flex ${outbound ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      outbound ? 'bg-sky-500 text-white' : 'border border-white/10 bg-white/5 text-slate-200'
                    }`}
                  >
                    {messageImageUrl ? (
                      <a href={messageImageUrl} target="_blank" rel="noreferrer">
                        <img
                          src={messageImageUrl}
                          alt="مرفق"
                          className="mb-2 max-h-48 rounded-xl object-cover"
                          loading="lazy"
                        />
                      </a>
                    ) : null}
                    {message.content ? <p>{message.content}</p> : null}
                    {quickReplies.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {quickReplies.map((qr, index) => (
                          <span
                            key={index}
                            className="rounded-lg border border-white/20 px-2 py-0.5 text-[11px] opacity-90"
                          >
                            {qr.caption}
                          </span>
                        ))}
                      </div>
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

      {imageUrl ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2">
          <img src={imageUrl} alt="معاينة" className="h-12 w-12 rounded-lg object-cover" />
          <span className="flex-1 truncate text-xs text-slate-400" dir="ltr">
            {imageUrl}
          </span>
          <button
            type="button"
            onClick={() => setImageUrl('')}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="إزالة الصورة"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {showAdvanced ? (
        <div className="mt-3">
          <label className="mb-1 block text-xs font-bold text-slate-300">
            ردود سريعة (سطر لكل زر: caption|type|target)
          </label>
          <textarea
            className={inputClass}
            rows={3}
            value={quickRepliesText}
            onChange={(event) => setQuickRepliesText(event.target.value)}
            placeholder={'احجز الآن|flow|123456\nالموقع|url|https://maps.google.com/...'}
            dir="ltr"
          />
        </div>
      ) : null}

      <form onSubmit={sendMessage} className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          disabled={uploadingImage}
          className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          aria-label="رفع صورة"
          title="رفع صورة"
        >
          <ImagePlus className="h-5 w-5" />
        </button>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={uploadImage} />
        <button
          type="button"
          onClick={() => setShowAdvanced((current) => !current)}
          className={`rounded-xl border border-white/10 px-3 py-2.5 text-xs font-bold transition ${
            showAdvanced ? 'bg-sky-500/15 text-sky-200' : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          ردود سريعة
        </button>
        <input
          className={`${inputClass} flex-1`}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="اكتب رسالة..."
        />
        <PrimaryButton type="submit" disabled={sending || (!content.trim() && !imageUrl.trim())}>
          <Send className="h-4 w-4" />
          إرسال
        </PrimaryButton>
      </form>
    </DataCard>
  );
}
