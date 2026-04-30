import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bot, BrainCircuit, Plus, Save, Sparkles, Stethoscope, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { DataCard, Field, PageHeader, PrimaryButton, StatCard, inputClass } from '../components/ui';

const createEmptyFaq = () => ({ question: '', answer: '' });

const createEmptyKnowledgeCase = () => ({
  title: '',
  symptom: '',
  specialty: '',
  urgency: 'medium',
  keywords: [],
  explanation: '',
  delayAdvice: '',
  homeAdvice: '',
  solution: '',
  bookingCta: '',
});

const listToText = (value) => (Array.isArray(value) ? value.join(', ') : '');
const textToList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);

const sections = [
  {
    id: 'prompt',
    title: 'توجيهات المساعد الذكي',
    icon: Bot,
    description: 'قواعد شخصية البوت: اللهجة، حدود الرد، ما لا يجب قوله، ومتى يوجه المريض للحجز.',
  },
  {
    id: 'knowledge',
    title: 'قاعدة المعرفة المنظمة',
    icon: Stethoscope,
    description: 'حالات أو خدمات منظمة بكلمات مفتاحية وتفسير ونصيحة طبية وإجراء مقترح.',
  },
  {
    id: 'faq',
    title: 'الأسئلة الشائعة (FAQ)',
    icon: BrainCircuit,
    description: 'أسئلة وأجوبة مباشرة مثل طريقة الحجز والإلغاء وتعديل الموعد.',
  },
];

export default function AISettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('prompt');
  const [faqs, setFaqs] = useState([]);
  const [knowledgeCases, setKnowledgeCases] = useState([]);
  const [previewMessage, setPreviewMessage] = useState('عندي ألم شديد في ضرسي ومش قادر أنام');
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data.settings);
      setFaqs(Array.isArray(res.data.settings.faqs) ? res.data.settings.faqs : []);
      setKnowledgeCases(Array.isArray(res.data.settings.knowledgeCases) ? res.data.settings.knowledgeCases : []);
    } catch (error) {
      toast.error('فشل تحميل إعدادات الذكاء الاصطناعي');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const summary = useMemo(
    () => ({
      enabled: settings?.aiEnabled ? 'مفعل' : 'معطل',
      faqCount: faqs.length,
      knowledgeCount: knowledgeCases.length,
      promptLength: (settings?.systemPrompt || '').trim().length,
    }),
    [faqs, knowledgeCases, settings]
  );

  const handleSave = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      await api.put('/settings', { ...settings, faqs, knowledgeCases });
      toast.success('تم حفظ إعدادات الذكاء الاصطناعي');
    } catch (error) {
      toast.error(error.message || 'فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!settings || !previewMessage.trim()) return;
    try {
      setPreviewLoading(true);
      const res = await api.post('/settings/preview', {
        ...settings,
        faqs,
        knowledgeCases,
        userMessage: previewMessage,
      });
      setPreviewResult(res.data);
    } catch (error) {
      toast.error(error.message || 'فشل اختبار الرد');
    } finally {
      setPreviewLoading(false);
    }
  };

  const updateKnowledgeCase = (index, field, value) => {
    setKnowledgeCases((current) => current.map((entry, currentIndex) => (currentIndex === index ? { ...entry, [field]: value } : entry)));
  };

  const updateFaq = (index, field, value) => {
    setFaqs((current) => current.map((faq, currentIndex) => (currentIndex === index ? { ...faq, [field]: value } : faq)));
  };

  if (loading) {
    return (
      <AppLayout>
        <DataCard>جاري تحميل إعدادات الذكاء الاصطناعي...</DataCard>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="إعدادات الذكاء الاصطناعي"
        description="قسم الإعدادات إلى توجيهات عامة، قاعدة معرفة منظمة، وأسئلة شائعة مباشرة."
        actions={
          <PrimaryButton type="button" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            حفظ التكوين
          </PrimaryButton>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="الحالة" value={summary.enabled} icon={Bot} tone={settings?.aiEnabled ? 'green' : 'red'} />
        <StatCard title="FAQ" value={summary.faqCount} icon={BrainCircuit} tone="blue" />
        <StatCard title="الحالات المنظمة" value={summary.knowledgeCount} icon={Stethoscope} tone="amber" />
        <StatCard title="طول التوجيهات" value={summary.promptLength} icon={Sparkles} tone="slate" />
      </div>

      <DataCard className="mb-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <label className="flex items-center gap-3 text-sm font-bold text-white">
            <input
              type="checkbox"
              checked={settings?.aiEnabled || false}
              onChange={(event) => setSettings((current) => ({ ...current, aiEnabled: event.target.checked }))}
            />
            تفعيل الردود الآلية
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`rounded-2xl border p-4 text-right transition ${
                  activeSection === section.id
                    ? 'border-sky-400 bg-sky-500/15'
                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <Icon className="mb-3 h-5 w-5 text-sky-300" />
                <span className="block font-black text-white">{section.title}</span>
                <span className="mt-2 block text-xs leading-6 text-slate-400">{section.description}</span>
              </button>
            );
          })}
        </div>
      </DataCard>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {activeSection === 'prompt' ? (
            <DataCard>
              <SectionTitle
                icon={Bot}
                title="توجيهات المساعد الذكي"
                description="اكتب القواعد العامة التي تحكم ردود البوت. مثال: لا تعطي تشخيصاً نهائياً، استخدم لهجة بسيطة، ووجه الحالات العاجلة للحضور."
              />
              <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-7 text-amber-100">
                <AlertCircle className="mb-2 h-4 w-4" />
                هذا القسم للقواعد العامة فقط. التفاصيل الطبية والخدمات الأفضل إضافتها في قاعدة المعرفة المنظمة.
              </div>
              <textarea
                value={settings?.systemPrompt || ''}
                onChange={(event) => setSettings((current) => ({ ...current, systemPrompt: event.target.value }))}
                className={`${inputClass} min-h-[280px] font-mono leading-7`}
                placeholder="أنت مساعد ذكي لعيادة..."
              />
            </DataCard>
          ) : null}

          {activeSection === 'knowledge' ? (
            <DataCard>
              <SectionTitle
                icon={Stethoscope}
                title="قاعدة المعرفة المنظمة"
                description="لإضافة حالة: اضغط إضافة حالة، اكتب كلمات مفتاحية مثل ألم عصب أو تورم، ثم اكتب التفسير والنصيحة وما يجب أن يقوله البوت."
                action={
                  <PrimaryButton type="button" onClick={() => setKnowledgeCases((current) => [...current, createEmptyKnowledgeCase()])}>
                    <Plus className="h-4 w-4" />
                    إضافة حالة
                  </PrimaryButton>
                }
              />
              <div className="space-y-4">
                {knowledgeCases.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-400">
                    لا توجد حالات مضافة بعد.
                  </div>
                ) : (
                  knowledgeCases.map((entry, index) => (
                    <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-black text-white">الحالة #{index + 1}</h3>
                        <button type="button" onClick={() => setKnowledgeCases((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-rose-300 hover:text-rose-200">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="عنوان الحالة">
                          <input className={inputClass} value={entry.title || ''} onChange={(event) => updateKnowledgeCase(index, 'title', event.target.value)} />
                        </Field>
                        <Field label="الشكوى الأساسية">
                          <input className={inputClass} value={entry.symptom || ''} onChange={(event) => updateKnowledgeCase(index, 'symptom', event.target.value)} />
                        </Field>
                        <Field label="التخصص">
                          <input className={inputClass} value={entry.specialty || ''} onChange={(event) => updateKnowledgeCase(index, 'specialty', event.target.value)} />
                        </Field>
                        <Field label="درجة الاستعجال">
                          <select className={inputClass} value={entry.urgency || 'medium'} onChange={(event) => updateKnowledgeCase(index, 'urgency', event.target.value)}>
                            <option value="low">منخفض</option>
                            <option value="medium">متوسط</option>
                            <option value="high">مرتفع</option>
                            <option value="urgent">عاجل</option>
                          </select>
                        </Field>
                        <Field label="الكلمات المفتاحية">
                          <textarea className={`${inputClass} min-h-[90px] md:col-span-2`} value={listToText(entry.keywords)} onChange={(event) => updateKnowledgeCase(index, 'keywords', textToList(event.target.value))} placeholder="اكتب الكلمات مفصولة بفواصل" />
                        </Field>
                        <Field label="التفسير الطبي">
                          <textarea className={`${inputClass} min-h-[120px] md:col-span-2`} value={entry.explanation || ''} onChange={(event) => updateKnowledgeCase(index, 'explanation', event.target.value)} />
                        </Field>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DataCard>
          ) : null}

          {activeSection === 'faq' ? (
            <DataCard>
              <SectionTitle
                icon={BrainCircuit}
                title="الأسئلة الشائعة (FAQ)"
                description="لإضافة FAQ: اضغط إضافة FAQ، اكتب سؤالاً متوقعاً وإجابة مباشرة. مثال: كيف أحجز؟ أو كيف ألغي موعدي؟"
                action={
                  <PrimaryButton type="button" onClick={() => setFaqs((current) => [...current, createEmptyFaq()])}>
                    <Plus className="h-4 w-4" />
                    إضافة FAQ
                  </PrimaryButton>
                }
              />
              <div className="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-7 text-emerald-100">
                لو أنشأت خصماً عاماً لكل المرضى من صفحة الإعدادات، أضف هنا FAQ باسم الخصم أو العرض حتى يعرفه البوت عندما يسأل المريض عنه. مثال السؤال: "ما تفاصيل خصم العيد؟" والإجابة: "خصم العيد متاح لكل المرضى على كل الخدمات بنسبة 30% حتى نهاية الشهر، وسيظهر السعر بعد الخصم عند اختيار الخدمة أو السؤال عن السعر."
              </div>
              <div className="mb-5 grid gap-3 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setFaqs((current) => [
                    ...current,
                    {
                      question: 'ما تفاصيل خصم العيد؟',
                      answer: 'خصم العيد متاح لكل المرضى على كل الخدمات بنسبة 30% خلال فترة العرض. عند سؤال المريض عن السعر أو اختيار الخدمة، سيظهر له السعر بعد الخصم تلقائياً.',
                    },
                  ])}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-right text-sm font-bold text-slate-200 transition hover:bg-white/[0.06]"
                >
                  مثال خصم عام لكل المرضى
                </button>
                <button
                  type="button"
                  onClick={() => setFaqs((current) => [
                    ...current,
                    {
                      question: 'هل الخصم متاح لي؟',
                      answer: 'إذا كان الخصم عاماً فهو متاح لكل المرضى الحاليين والجدد. وإذا كان الخصم لأرقام محددة فقط، سيظهر للمريض المستحق عند السؤال عن السعر أو اختيار الخدمة.',
                    },
                  ])}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-right text-sm font-bold text-slate-200 transition hover:bg-white/[0.06]"
                >
                  مثال هل الخصم متاح لي؟
                </button>
                <button
                  type="button"
                  onClick={() => setFaqs((current) => [
                    ...current,
                    {
                      question: 'إزاي أستخدم الخصم؟',
                      answer: 'لا يحتاج المريض لعمل أي خطوة إضافية. عند الحجز أو السؤال عن السعر، النظام يراجع الخصومات النشطة ويعرض السعر بعد الخصم إذا كان المريض مستحقاً له.',
                    },
                  ])}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-right text-sm font-bold text-slate-200 transition hover:bg-white/[0.06]"
                >
                  مثال استخدام الخصم
                </button>
              </div>
              <div className="space-y-4">
                {faqs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-400">
                    لا توجد أسئلة شائعة مضافة بعد.
                  </div>
                ) : (
                  faqs.map((faq, index) => (
                    <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-black text-white">FAQ #{index + 1}</span>
                        <button type="button" onClick={() => setFaqs((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-rose-300 hover:text-rose-200">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid gap-3">
                        <Field label="السؤال">
                          <input className={inputClass} value={faq.question || ''} onChange={(event) => updateFaq(index, 'question', event.target.value)} />
                        </Field>
                        <Field label="الإجابة">
                          <textarea className={`${inputClass} min-h-[100px]`} value={faq.answer || ''} onChange={(event) => updateFaq(index, 'answer', event.target.value)} />
                        </Field>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DataCard>
          ) : null}
        </div>

        <DataCard className="h-fit">
          <SectionTitle icon={Sparkles} title="اختبار الرد" description="اكتب رسالة مريض وشاهد الرد المتوقع قبل الحفظ النهائي." />
          <textarea className={`${inputClass} min-h-[120px]`} value={previewMessage} onChange={(event) => setPreviewMessage(event.target.value)} />
          <PrimaryButton type="button" onClick={handlePreview} disabled={previewLoading} className="mt-3 w-full">
            <Sparkles className="h-4 w-4" />
            اختبار الآن
          </PrimaryButton>
          {previewResult ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-2 text-xs font-bold text-sky-300">الرد المتوقع</p>
              <p className="whitespace-pre-wrap text-sm leading-7 text-white">{previewResult.reply}</p>
            </div>
          ) : null}
        </DataCard>
      </div>
    </AppLayout>
  );
}

function SectionTitle({ icon: Icon, title, description, action }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4 border-b border-white/10 pb-4">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-white/5 p-3 text-sky-300">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-white">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
