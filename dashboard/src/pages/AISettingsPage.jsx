import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bot, BrainCircuit, Plus, Save, Sparkles, Stethoscope, Trash2 } from 'lucide-react';
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

        <div className="glass-card p-6">
          <SectionHeader
            icon={Bot}
            title="التوجيه الأساسي للنظام"
            subtitle="هذا النص يحدد أسلوب المساعد، وما الذي يجب أن يقوله أو يتجنبه."
          />

          <div className="mb-6 flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <p className="text-sm leading-relaxed text-amber-100">
              الأفضل أن يبقى هذا القسم عاما وواضحا، بينما التفاصيل التشغيلية للحالات تدار من قسم "قاعدة المعرفة المنظمة" أدناه.
            </p>
          </div>

          <textarea
            value={settings?.systemPrompt || ''}
            onChange={(event) => setSettings((current) => ({ ...current, systemPrompt: event.target.value }))}
            className="input-field min-h-[260px] w-full resize-y border-sky-500/20 bg-dark-bg/60 p-6 font-mono text-sm leading-loose shadow-inner focus:border-sky-500"
            placeholder="أنت مساعد ذكي لعيادة..."
          />
        </div>

        <div className="glass-card p-6">
          <SectionHeader
            icon={BrainCircuit}
            title="اختبار الرد"
            subtitle="جرّب رسالة مريض باستخدام الإعدادات الحالية حتى قبل الحفظ النهائي."
            action={
              <button
                onClick={handlePreview}
                disabled={previewLoading}
                className="flex items-center gap-2 rounded-lg border border-primary-500/20 bg-primary-500/10 px-4 py-2 text-sm font-medium text-primary-300 transition-colors hover:bg-primary-500/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {previewLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                اختبار الآن
              </button>
            }
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <textarea
                value={previewMessage}
                onChange={(event) => setPreviewMessage(event.target.value)}
                className="input-field min-h-[180px] w-full resize-y"
                placeholder="اكتب رسالة مريض للتجربة..."
              />

              <p className="text-xs text-dark-muted">
                يتم استخدام الـ prompt الحالي مع الـ FAQ والحالات المنظمة الموجودة الآن في الشاشة نفسها.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-dark-border bg-dark-bg/40 p-4">
                <p className="mb-3 text-sm font-bold text-white">الرد المتوقع</p>
                <div className="min-h-[180px] whitespace-pre-wrap text-sm leading-7 text-slate-200">
                  {previewResult?.reply || 'لم يتم تشغيل الاختبار بعد.'}
                </div>
              </div>

              <div className="rounded-xl border border-dark-border bg-dark-bg/40 p-4">
                <p className="mb-3 text-sm font-bold text-white">الحالات الملتقطة</p>
                {previewResult?.matchedKnowledgeCases?.length ? (
                  <div className="space-y-2">
                    {previewResult.matchedKnowledgeCases.map((entry, index) => (
                      <div key={`${entry.title}-${index}`} className="rounded-lg border border-dark-border bg-dark-card/60 p-3 text-xs text-slate-300">
                        <p className="font-bold text-white">{entry.title || `حالة ${index + 1}`}</p>
                        <p className="mt-1">الشكوى: {entry.symptom || 'غير محددة'}</p>
                        <p className="mt-1">التخصص: {entry.specialty || 'غير محدد'}</p>
                        <p className="mt-1">الاستعجال: {entry.urgency || 'غير محدد'}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-dark-muted">لا توجد حالات مطابقة ملتقطة حاليا.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <SectionHeader
            icon={Sparkles}
            title="استيراد نصي للحالات"
            subtitle="الصق المستند الخام الذي يحتوي على الحالات، وسيتم تحويله تلقائيا إلى knowledge cases مع إزالة التكرار."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={importMode}
                  onChange={(event) => setImportMode(event.target.value)}
                  className="input-field min-w-[140px] py-2"
                >
                  <option value="append">دمج مع الموجود</option>
                  <option value="replace">استبدال الموجود</option>
                </select>

                <button
                  onClick={handlePreviewImport}
                  disabled={importPreviewLoading}
                  className="flex items-center gap-2 rounded-lg border border-dark-border bg-dark-bg/60 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-primary-500/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {importPreviewLoading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  معاينة
                </button>

                <button
                  onClick={handleImportKnowledge}
                  disabled={importLoading}
                  className="flex items-center gap-2 rounded-lg border border-primary-500/20 bg-primary-500/10 px-4 py-2 text-sm font-medium text-primary-300 transition-colors hover:bg-primary-500/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {importLoading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  استيراد وحفظ
                </button>
              </div>
            }
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                className="input-field min-h-[260px] w-full resize-y"
                placeholder={`1. الحالة:
المريض: دكتور عندي ألم شديد بالأسنان ومرتبط بـ عصب، شنو وضعي؟

التفسير الطبي:
...

هل أأجل؟
...

الحل:
...

نصيحة منزلية:
...

تطمين:
...`}
              />

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs leading-6 text-amber-100">
                هذا الاستيراد يحفظ مباشرة في الإعدادات الحالية. وضع <strong>دمج مع الموجود</strong> يضيف الحالات الجديدة فقط بعد إزالة التكرار،
                بينما <strong>استبدال الموجود</strong> يحذف الحالات الحالية ويضع الناتج المستخرج من النص فقط.
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-dark-border bg-dark-bg/40 p-4">
                <p className="mb-3 text-sm font-bold text-white">نتيجة آخر استيراد</p>

                {importResult ? (
                  <div className="space-y-4">
                    <div className="space-y-2 text-sm text-slate-300">
                      <p>الوضع: <span className="font-bold text-white">{importResult.mode === 'replace' ? 'استبدال' : 'دمج'}</span></p>
                      <p>الحالات السابقة: <span className="font-bold text-white">{importResult.existingCases}</span></p>
                      <p>الحالات النهائية: <span className="font-bold text-white">{importResult.finalCases}</span></p>
                      <p>الحالات المضافة: <span className="font-bold text-white">{importResult.addedCases}</span></p>
                      <p>البلوكات الخام: <span className="font-bold text-white">{importResult.stats?.rawBlocks ?? 0}</span></p>
                      <p>الحالات المستخرجة: <span className="font-bold text-white">{importResult.stats?.parsedCases ?? 0}</span></p>
                      <p>بعد إزالة التكرار الداخلي: <span className="font-bold text-white">{importResult.stats?.dedupedCases ?? 0}</span></p>
                      <p>التكرارات داخل النص: <span className="font-bold text-white">{importResult.stats?.removedDuplicates ?? 0}</span></p>
                      <p>التكرارات مقابل الموجود: <span className="font-bold text-white">{importResult.duplicatesAgainstExisting ?? 0}</span></p>
                    </div>

                    {importResult.previewCases?.length ? (
                      <div className="space-y-2 border-t border-dark-border pt-4">
                        <p className="text-sm font-bold text-white">نماذج من الحالات المستخرجة</p>
                        {importResult.previewCases.map((entry, index) => (
                          <div key={`${entry.title}-${index}`} className="rounded-lg border border-dark-border bg-dark-card/60 p-3 text-xs text-slate-300">
                            <p className="font-bold text-white">{entry.title || `حالة ${index + 1}`}</p>
                            <p className="mt-1">الشكوى: {entry.symptom || 'غير محددة'}</p>
                            <p className="mt-1">التخصص: {entry.specialty || 'غير محدد'}</p>
                            <p className="mt-1">الاستعجال: {entry.urgency || 'غير محدد'}</p>
                            {entry.explanation ? <p className="mt-1 line-clamp-3">التفسير: {entry.explanation}</p> : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-dark-muted">لم يتم تنفيذ أي استيراد بعد.</p>
                )}
              </div>

              <div className="rounded-xl border border-dark-border bg-dark-bg/40 p-4">
                <p className="mb-3 text-sm font-bold text-white">متى تستخدمه؟</p>
                <ul className="space-y-2 text-xs leading-6 text-slate-300">
                  <li>إذا كان عندك مستند طويل فيه مئات الحالات المكررة بصيغة واحدة وتريد تحويله لمدخلات منظمة.</li>
                  <li>إذا استلمت ملف محتوى جديد من العميل وتريد ضمه بسرعة بدون تحرير يدوي لكل حالة.</li>
                  <li>إذا أردت تنظيف النصوص الضخمة وتحويلها إلى قاعدة معرفة قابلة للاختبار من نفس الشاشة.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <SectionHeader
            icon={Stethoscope}
            title="قاعدة المعرفة المنظمة"
            subtitle="هذه المداخل تستخدم لتوجيه البوت حسب الشكوى والتخصص والاستعجال بدل تخزين مئات الردود المكررة."
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
                لا توجد حالات منظمة. أضف مداخل تصف الشكوى، التخصص، درجة الاستعجال، والتوجيه المطلوب.
              </div>
            ) : (
              knowledgeCases.map((entry, index) => (
                <div key={index} className="rounded-2xl border border-dark-border bg-dark-bg/40 p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">الحالة #{index + 1}</h3>
                      <p className="mt-1 text-xs text-dark-muted">مدخل منظم يستخدمه البوت عند مطابقة الرسالة مع الكلمات أو الشكوى.</p>
                    </div>
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
                      onChange={(event) => updateKnowledgeCase(index, 'title', event.target.value)}
                      className="input-field"
                      placeholder="عنوان الحالة"
                    />

                    <input
                      type="text"
                      value={entry.symptom || ''}
                      onChange={(event) => updateKnowledgeCase(index, 'symptom', event.target.value)}
                      className="input-field"
                      placeholder="الشكوى الأساسية"
                    />

                    <input
                      type="text"
                      value={entry.specialty || ''}
                      onChange={(event) => updateKnowledgeCase(index, 'specialty', event.target.value)}
                      className="input-field"
                      placeholder="التخصص المرجح"
                    />

                    <select
                      value={entry.urgency || 'medium'}
                      onChange={(event) => updateKnowledgeCase(index, 'urgency', event.target.value)}
                      className="input-field"
                    >
                      <option value="low">منخفض</option>
                      <option value="medium">متوسط</option>
                      <option value="high">مرتفع</option>
                      <option value="urgent">عاجل</option>
                    </select>

                    <textarea
                      value={listToText(entry.keywords)}
                      onChange={(event) => updateKnowledgeCase(index, 'keywords', textToList(event.target.value))}
                      className="input-field min-h-[96px] resize-y md:col-span-2"
                      placeholder="الكلمات المفتاحية، مفصولة بفواصل"
                    />

                    <textarea
                      value={listToText(entry.patientExamples)}
                      onChange={(event) => updateKnowledgeCase(index, 'patientExamples', textToList(event.target.value))}
                      className="input-field min-h-[96px] resize-y md:col-span-2"
                      placeholder="أمثلة لعبارات المريض، مفصولة بفواصل"
                    />

                    <textarea
                      value={entry.explanation || ''}
                      onChange={(event) => updateKnowledgeCase(index, 'explanation', event.target.value)}
                      className="input-field min-h-[110px] resize-y md:col-span-2"
                      placeholder="التفسير الطبي المبسط"
                    />

                    <textarea
                      value={entry.delayAdvice || ''}
                      onChange={(event) => updateKnowledgeCase(index, 'delayAdvice', event.target.value)}
                      className="input-field min-h-[110px] resize-y"
                      placeholder="هل تؤجل؟"
                    />

                    <textarea
                      value={entry.homeAdvice || ''}
                      onChange={(event) => updateKnowledgeCase(index, 'homeAdvice', event.target.value)}
                      className="input-field min-h-[110px] resize-y"
                      placeholder="نصيحة منزلية"
                    />

                    <textarea
                      value={entry.solution || ''}
                      onChange={(event) => updateKnowledgeCase(index, 'solution', event.target.value)}
                      className="input-field min-h-[110px] resize-y md:col-span-2"
                      placeholder="الحل أو الإجراء المتوقع"
                    />

                    <textarea
                      value={entry.bookingCta || ''}
                      onChange={(event) => updateKnowledgeCase(index, 'bookingCta', event.target.value)}
                      className="input-field min-h-[96px] resize-y"
                      placeholder="دعوة للحجز أو الفحص"
                    />

                    <textarea
                      value={entry.reassurance || ''}
                      onChange={(event) => updateKnowledgeCase(index, 'reassurance', event.target.value)}
                      className="input-field min-h-[96px] resize-y"
                      placeholder="رسالة تطمين"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass-card p-6">
          <SectionHeader
            icon={Sparkles}
            title="الأسئلة الشائعة"
            subtitle="استخدمها للأسئلة المباشرة مثل الحجز، أوقات العمل، أو معلومات ثابتة قصيرة."
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
            {faqs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-dark-border bg-dark-bg/40 p-8 text-center text-dark-muted">
                لا توجد أسئلة شائعة مضافة حاليا.
              </div>
            ) : (
              faqs.map((faq, index) => (
                <div key={index} className="rounded-xl border border-dark-border bg-dark-bg/40 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-white">FAQ #{index + 1}</p>
                    <button
                      onClick={() => removeFaq(index)}
                      className="rounded-md bg-red-500/10 p-2 text-red-400 transition-colors hover:bg-red-500 hover:text-white"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="السؤال الشائع"
                      value={faq.question}
                      onChange={(event) => updateFaq(index, 'question', event.target.value)}
                      className="input-field"
                    />
                    <textarea
                      placeholder="الإجابة النموذجية"
                      value={faq.answer}
                      onChange={(event) => updateFaq(index, 'answer', event.target.value)}
                      className="input-field min-h-[110px] resize-y"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
