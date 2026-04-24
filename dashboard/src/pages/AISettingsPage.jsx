import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bot, BrainCircuit, CheckCircle, Plus, Save, Sparkles, Stethoscope, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';

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

const createEmptyFaq = () => ({ question: '', answer: '' });

const createEmptyKnowledgeCase = () => ({
  title: '',
  symptom: '',
  specialty: '',
  urgency: 'medium',
  keywords: [],
  patientExamples: [],
  explanation: '',
  delayAdvice: '',
  homeAdvice: '',
  solution: '',
  bookingCta: '',
  reassurance: '',
});

const listToText = (value) => (Array.isArray(value) ? value.join(', ') : '');

const textToList = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

function SectionHeader({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4 border-b border-dark-border pb-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-dark-bg/70 p-2">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-dark-muted">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export default function AISettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [faqs, setFaqs] = useState([]);
  const [knowledgeCases, setKnowledgeCases] = useState([]);
  const [previewMessage, setPreviewMessage] = useState('دكتور عندي ألم شديد بالسن وما أگدر أنام، شنو وضعي؟');
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState('append');
  const [importLoading, setImportLoading] = useState(false);
  const [importPreviewLoading, setImportPreviewLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data.settings);
      setFaqs(Array.isArray(res.data.settings.faqs) ? res.data.settings.faqs : []);
      setKnowledgeCases(Array.isArray(res.data.settings.knowledgeCases) ? res.data.settings.knowledgeCases : []);
    } catch (error) {
      toast.error('فشل في تحميل إعدادات الذكاء الاصطناعي');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      await api.put('/settings', {
        ...settings,
        faqs,
        knowledgeCases,
      });
      toast.success('تم حفظ إعدادات الذكاء الاصطناعي');
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'فشل في حفظ البيانات');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!settings) return;
    if (!previewMessage.trim()) {
      toast.error('اكتب رسالة مريض للتجربة');
      return;
    }

    try {
      setPreviewLoading(true);
      const res = await api.post('/settings/preview', {
        clinicName: settings.clinicName,
        clinicNameAr: settings.clinicNameAr,
        phone: settings.phone,
        address: settings.address,
        workingHours: settings.workingHours,
        whatsappChatLink: settings.whatsappChatLink,
        googleMapsLink: settings.googleMapsLink,
        systemPrompt: settings.systemPrompt,
        faqs,
        knowledgeCases,
        userMessage: previewMessage,
      });
      setPreviewResult(res.data);
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'فشل في اختبار الرد');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleImportKnowledge = async () => {
    if (!importText.trim()) {
      toast.error('الصق النص الخام الذي تريد تحويله إلى حالات');
      return;
    }

    try {
      setImportLoading(true);
      const res = await api.post('/settings/import-knowledge', {
        rawText: importText,
        mode: importMode,
      });

      setKnowledgeCases(Array.isArray(res.data.settings?.knowledgeCases) ? res.data.settings.knowledgeCases : []);
      setImportResult(res.data.importResult || null);
      setPreviewResult(null);

      toast.success(importMode === 'replace' ? 'تم استبدال الحالات من النص المستورد' : 'تم استيراد الحالات ودمجها');
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'فشل في استيراد الحالات');
    } finally {
      setImportLoading(false);
    }
  };

  const handlePreviewImport = async () => {
    if (!importText.trim()) {
      toast.error('الصق النص الخام الذي تريد معاينته');
      return;
    }

    try {
      setImportPreviewLoading(true);
      const res = await api.post('/settings/import-knowledge/preview', {
        rawText: importText,
        mode: importMode,
      });

      setImportResult(res.data.importResult || null);
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'فشل في معاينة الاستيراد');
    } finally {
      setImportPreviewLoading(false);
    }
  };

  const addFaq = () => {
    setFaqs((current) => [...current, createEmptyFaq()]);
  };

  const removeFaq = (index) => {
    setFaqs((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const updateFaq = (index, field, value) => {
    setFaqs((current) =>
      current.map((faq, currentIndex) => (currentIndex === index ? { ...faq, [field]: value } : faq))
    );
  };

  const addKnowledgeCase = () => {
    setKnowledgeCases((current) => [...current, createEmptyKnowledgeCase()]);
  };

  const removeKnowledgeCase = (index) => {
    setKnowledgeCases((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const updateKnowledgeCase = (index, field, value) => {
    setKnowledgeCases((current) =>
      current.map((entry, currentIndex) => (currentIndex === index ? { ...entry, [field]: value } : entry))
    );
  };

  const summary = useMemo(
    () => ({
      enabled: settings?.aiEnabled ? 'مفعل' : 'معطل',
      faqCount: faqs.length,
      knowledgeCount: knowledgeCases.length,
      promptLength: (settings?.systemPrompt || '').trim().length,
    }),
    [faqs, knowledgeCases, settings]
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center p-20">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl space-y-6 fade-in">
        <div className="relative overflow-hidden rounded-2xl border border-dark-border bg-dark-card p-6 shadow-lg">
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-primary-500/15 blur-[100px]"></div>

          <div className="relative z-10 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 shadow-lg shadow-sky-500/20 ring-1 ring-white/10">
                <BrainCircuit className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
                  إعدادات الذكاء الاصطناعي
                  <Sparkles className="h-4 w-4 text-amber-400" />
                </h1>
                <p className="mt-1 text-sm text-sky-100/80">
                  تخصيص التوجيه الأساسي وقاعدة المعرفة المنظمة التي يعتمد عليها البوت أثناء الرد.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-3 rounded-xl border border-dark-border bg-dark-bg/50 px-4 py-2">
                <span className="text-sm font-bold text-white">تفعيل الردود الآلية</span>
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={settings?.aiEnabled || false}
                    onChange={(event) => setSettings((current) => ({ ...current, aiEnabled: event.target.checked }))}
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full border border-dark-border bg-dark-card transition-colors peer-checked:bg-emerald-500"></div>
                  <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-dark-muted transition-transform peer-checked:translate-x-5 peer-checked:bg-white"></div>
                </div>
              </label>

              <button onClick={handleSave} disabled={saving} className="btn-primary shadow-lg shadow-primary-500/20">
                {saving ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Save className="h-5 w-5" />
                )}
                حفظ التكوين
              </button>
            </div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="الحالة الحالية" value={summary.enabled} hint="تشغيل أو إيقاف الردود الآلية" icon={Bot} accentClass="border-primary-500/20" />
          <SummaryCard title="عدد FAQ" value={summary.faqCount} hint="أسئلة وأجوبة مباشرة" icon={Plus} accentClass="border-emerald-500/20" />
          <SummaryCard title="الحالات المنظمة" value={summary.knowledgeCount} hint="مداخل المعرفة القابلة للمطابقة" icon={Stethoscope} accentClass="border-amber-500/20" />
          <SummaryCard title="طول الـ Prompt" value={summary.promptLength} hint="عدد الأحرف في التوجيه الأساسي" icon={BrainCircuit} accentClass="border-sky-500/20" />
        </section>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* Left Column: Management */}
          <div className="flex-1 space-y-8">
            {/* System Prompt Section */}
            <div className="glass-card p-6">
              <SectionHeader
                icon={Bot}
                title="توجيهات المساعد الذكي"
                subtitle="هذه التوجيهات تحدد شخصية البوت، اللهجة المستخدمة، والقواعد العامة للرد."
              />
              <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200/80">
                <AlertCircle className="mb-1 h-4 w-4" />
                الأفضل أن يبقى هذا القسم عاماً، بينما التفاصيل الطبية تدار من "قاعدة المعرفة" أدناه.
              </div>
              <textarea
                value={settings?.systemPrompt || ''}
                onChange={(event) => setSettings((current) => ({ ...current, systemPrompt: event.target.value }))}
                className="input-field min-h-[200px] w-full resize-y font-mono text-sm leading-relaxed"
                placeholder="أنت مساعد ذكي لعيادة..."
              />
            </div>

            {/* Knowledge Base Section */}
            <div className="glass-card p-6">
              <SectionHeader
                icon={Stethoscope}
                title="قاعدة المعرفة المنظمة"
                subtitle="توجيه البوت حسب الشكوى والتخصص والاستعجال."
                action={
                  <button
                    onClick={addKnowledgeCase}
                    className="flex items-center gap-1 rounded-lg border border-primary-500/20 bg-primary-500/10 px-3 py-1.5 text-sm font-medium text-primary-300 transition-colors hover:bg-primary-500/20 hover:text-white"
                  >
                    <Plus className="h-4 w-4" />
                    إضافة حالة
                  </button>
                }
              />
              <div className="space-y-4">
                {knowledgeCases.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-dark-border bg-dark-bg/40 p-8 text-center text-dark-muted">
                    لا توجد حالات مضافة.
                  </div>
                ) : (
                  knowledgeCases.map((entry, index) => (
                    <div key={index} className="rounded-2xl border border-dark-border bg-dark-bg/40 p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">الحالة #{index + 1}</h3>
                        <button
                          onClick={() => removeKnowledgeCase(index)}
                          className="rounded-md bg-red-500/10 p-2 text-red-400 transition-colors hover:bg-red-500 hover:text-white"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <input
                          type="text"
                          value={entry.title || ''}
                          onChange={(e) => updateKnowledgeCase(index, 'title', e.target.value)}
                          className="input-field"
                          placeholder="عنوان الحالة"
                        />
                        <input
                          type="text"
                          value={entry.symptom || ''}
                          onChange={(e) => updateKnowledgeCase(index, 'symptom', e.target.value)}
                          className="input-field"
                          placeholder="الشكوى الأساسية"
                        />
                        <input
                          type="text"
                          value={entry.specialty || ''}
                          onChange={(e) => updateKnowledgeCase(index, 'specialty', e.target.value)}
                          className="input-field"
                          placeholder="التخصص"
                        />
                        <select
                          value={entry.urgency || 'medium'}
                          onChange={(e) => updateKnowledgeCase(index, 'urgency', e.target.value)}
                          className="input-field"
                        >
                          <option value="low">منخفض</option>
                          <option value="medium">متوسط</option>
                          <option value="high">مرتفع</option>
                          <option value="urgent">عاجل</option>
                        </select>
                        <textarea
                          value={listToText(entry.keywords)}
                          onChange={(e) => updateKnowledgeCase(index, 'keywords', textToList(e.target.value))}
                          className="input-field min-h-[80px] resize-y md:col-span-2"
                          placeholder="الكلمات المفتاحية (فواصل)"
                        />
                        <textarea
                          value={entry.explanation || ''}
                          onChange={(e) => updateKnowledgeCase(index, 'explanation', e.target.value)}
                          className="input-field min-h-[100px] resize-y md:col-span-2"
                          placeholder="التفسير الطبي"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* FAQ Section */}
            <div className="glass-card p-6">
              <SectionHeader
                icon={BrainCircuit}
                title="الأسئلة الشائعة (FAQ)"
                subtitle="إجابات مباشرة لأسئلة محددة."
                action={
                  <button
                    onClick={addFaq}
                    className="flex items-center gap-1 rounded-lg border border-primary-500/20 bg-primary-500/10 px-3 py-1.5 text-sm font-medium text-primary-300 transition-colors hover:bg-primary-500/20 hover:text-white"
                  >
                    <Plus className="h-4 w-4" />
                    إضافة FAQ
                  </button>
                }
              />
              <div className="space-y-4">
                {faqs.map((faq, index) => (
                  <div key={index} className="rounded-xl border border-dark-border bg-dark-bg/40 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-dark-muted">FAQ #{index + 1}</span>
                      <button onClick={() => removeFaq(index)} className="text-red-400 hover:text-red-300">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={faq.question}
                      onChange={(e) => updateFaq(index, 'question', e.target.value)}
                      className="input-field mb-2"
                      placeholder="السؤال"
                    />
                    <textarea
                      value={faq.answer}
                      onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                      className="input-field min-h-[80px] resize-y"
                      placeholder="الإجابة"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Tools */}
          <div className="w-full space-y-8 lg:w-[380px] xl:w-[440px]">
            <div className="sticky top-24 space-y-8">
              {/* Preview/Test Console */}
              <div className="glass-card border-primary-500/20 p-6 shadow-2xl shadow-primary-500/5">
                <SectionHeader
                  icon={Sparkles}
                  title="اختبار ومعاينة الرد"
                  subtitle="جرب رد البوت بناءً على الإعدادات الحالية."
                />
                <div className="space-y-4">
                  <textarea
                    value={previewMessage}
                    onChange={(e) => setPreviewMessage(e.target.value)}
                    className="input-field min-h-[120px] w-full resize-none text-sm"
                    placeholder="اكتب هنا محاكاة لرسالة مريض..."
                  />
                  <button
                    onClick={handlePreview}
                    disabled={previewLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3 text-sm font-bold text-white transition-all hover:bg-primary-500 disabled:opacity-50"
                  >
                    {previewLoading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    اختبار الآن
                  </button>

                  {previewResult && (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-xl border border-dark-border bg-dark-bg/60 p-4">
                        <p className="mb-2 text-xs font-bold text-primary-400">الرد المتوقع:</p>
                        <div className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
                          {previewResult.reply}
                        </div>
                      </div>
                      {previewResult.matchedKnowledgeCases?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-dark-muted uppercase tracking-wider">الحالات المطابقة:</p>
                          {previewResult.matchedKnowledgeCases.map((match, i) => (
                            <div key={i} className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2 text-xs text-emerald-300 border border-emerald-500/20">
                              <CheckCircle className="h-3 w-3" />
                              {match.title}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Smart Import Section */}
              <div className="glass-card p-6">
                <SectionHeader
                  icon={Sparkles}
                  title="استيراد ذكي"
                  subtitle="حول النصوص الخام إلى حالات منظمة."
                />
                <div className="space-y-4">
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    className="input-field min-h-[160px] w-full text-xs"
                    placeholder="الصق هنا النص الطبي الخام..."
                  />
                  <div className="flex gap-2">
                    <select
                      value={importMode}
                      onChange={(e) => setImportMode(e.target.value)}
                      className="input-field flex-1 py-2 text-xs"
                    >
                      <option value="append">دمج</option>
                      <option value="replace">استبدال</option>
                    </select>
                    <button
                      onClick={handleImportKnowledge}
                      disabled={importLoading}
                      className="rounded-lg bg-dark-bg border border-dark-border px-4 text-xs font-bold text-white hover:bg-dark-card disabled:opacity-50"
                    >
                      {importLoading ? 'جاري...' : 'بدء'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
