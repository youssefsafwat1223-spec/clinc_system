import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Image, Megaphone, Plus, Save, Search, Send, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { DataCard, Field, PageHeader, PrimaryButton, SecondaryButton, StatusBadge, inputClass } from '../components/ui';

const steps = [
  { id: 1, label: 'نوع الرسالة' },
  { id: 2, label: 'القالب والمحتوى' },
  { id: 3, label: 'اختيار المرضى' },
  { id: 4, label: 'المراجعة والإرسال' },
];

const emptyTemplateForm = {
  id: null,
  name: '',
  displayName: '',
  category: 'MARKETING',
  languageCode: 'ar',
  headerType: 'NONE',
  bodyText: '',
  footerText: '',
  imageUrl: '',
  active: true,
};

const extractTemplateVariables = (text = '') => {
  const matches = [...String(text || '').matchAll(/\{\{([a-zA-Z_][\w]*|\d+)\}\}/g)];
  const seen = new Set();
  return matches
    .map((match) => match[1])
    .filter((key) => {
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((key) => (/^\d+$/.test(key) ? { key, type: 'number', index: Number(key) } : { key, type: 'named', name: key }));
};

const getParamValue = (params, variable) => {
  if (!variable) return '';
  if (params && typeof params === 'object' && !Array.isArray(params) && params[variable.key] !== undefined) return params[variable.key];
  if (Array.isArray(params) && variable.type === 'number') return params[variable.index - 1];
  return '';
};

const autoTemplateVariables = {
  name: 'اسم كل مريض تلقائياً',
  phone: 'رقم هاتف كل مريض تلقائياً',
};

const numberedAutoTemplateVariablesByTemplate = {
  clinic_custom_message_ar: { 1: autoTemplateVariables.name },
  clinic_offer_text_ar: { 1: autoTemplateVariables.name },
};

const getAutoTemplateVariableLabel = (variable, templateName) => {
  if (!variable) return null;
  if (variable.type === 'named') return autoTemplateVariables[variable.name] || null;
  return numberedAutoTemplateVariablesByTemplate[templateName]?.[variable.key] || null;
};

const getAutoTemplateVariableValue = (variable, templateName) => {
  if (!getAutoTemplateVariableLabel(variable, templateName)) return '';
  if (variable.type === 'named') return `{{${variable.name}}}`;
  if (variable.key === '1') return '{{name}}';
  return '';
};

const isAutoTemplateVariable = (variable, templateName) => Boolean(getAutoTemplateVariableLabel(variable, templateName));

const templateVariableLabels = {
  1: 'اسم المريض',
  2: 'نص الرسالة أو تفاصيل العرض',
  3: 'نص الرسالة أو السعر قبل الخصم',
  4: 'تفاصيل الرسالة أو السعر بعد الخصم',
  5: 'تفاصيل العرض',
  name: 'اسم المريض',
  phone: 'رقم الهاتف',
  service_name: 'اسم الخدمة',
  before_price: 'السعر قبل الخصم',
  after_price: 'السعر بعد الخصم',
  offer_details: 'تفاصيل العرض',
};

const templateVariablePlaceholders = {
  2: 'مثال: خصم 20% على تنظيف الأسنان. السعر قبل الخصم 50000 دينار عراقي، والسعر بعد الخصم 40000 دينار عراقي.',
  3: 'مثال: خصم 20% لفترة محدودة أو 50000',
  4: 'مثال: العرض متاح حتى نهاية الشهر أو 40000',
  5: 'مثال: العرض متاح لفترة محدودة',
  service_name: 'مثال: تنظيف الأسنان',
  before_price: 'مثال: 50000',
  after_price: 'مثال: 40000',
  offer_details: 'مثال: العرض متاح لفترة محدودة',
};

const renderTemplatePreview = (text = '', params = [], samplePatient = null, templateName = null) =>
  String(text || '').replace(/\{\{([a-zA-Z_][\w]*|\d+)\}\}/g, (_, key) => {
    const variable = /^\d+$/.test(key) ? { key, type: 'number', index: Number(key) } : { key, type: 'named', name: key };
    const value = getParamValue(params, variable);
    if (value) return value;
    if (getAutoTemplateVariableLabel(variable, templateName)) return samplePatient?.displayName || samplePatient?.name || 'اسم المريض';
    if (key === 'name') return samplePatient?.displayName || samplePatient?.name || 'اسم المريض';
    if (key === 'phone') return samplePatient?.phone || 'رقم الهاتف';
    return `{{${key}}}`;
  });

const parseAudienceSheet = (text = '') => {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows = lines.map((line) => line.split(line.includes('\t') ? '\t' : ',').map((cell) => cell.trim()));
  const firstRow = rows[0] || [];
  const hasHeader = firstRow.some((cell) => /phone|mobile|رقم|هاتف|name|اسم/i.test(cell));
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const seen = new Set();

  return dataRows
    .map(([phone, name]) => ({
      phone: String(phone || '').replace(/[^\d+]/g, ''),
      name: String(name || '').trim(),
    }))
    .filter((item) => {
      if (!item.phone || item.phone.length < 8 || seen.has(item.phone)) return false;
      seen.add(item.phone);
      return true;
    });
};

const CLINIC_OFFER_TEXT_BODY = [
  'مرحباً {{1}}',
  'يسر عيادة د. إبراهيم التخصصي لطب وتجميل الأسنان تقديم عرض خاص لفترة محدودة.',
  '',
  'تفاصيل العرض:',
  '{{2}}',
  '',
  'للحجز أو معرفة التفاصيل تواصل معنا الآن، وسيقوم فريق الاستقبال بمساعدتك في أقرب وقت.',
].join('\n');

const CLINIC_CUSTOM_MESSAGE_BODY = [
  'مرحباً {{1}}',
  '',
  'يسر عيادة د. إبراهيم التخصصي لطب وتجميل الأسنان أن تشاركك هذا التحديث المهم:',
  '',
  '{{2}}',
  '',
  'للحجز أو معرفة التفاصيل تواصل معنا الآن، وسيقوم فريق الاستقبال بمساعدتك في أقرب وقت.',
].join('\n');

const templateGuideByName = {
  clinic_custom_message_ar: {
    title: 'قالب رسالة مخصصة مرنة',
    where: 'يستخدم من صفحة الحملات عندما تريد إرسال رسالة تسويقية عامة وتغيير العنوان والنص والتفاصيل من داخل السيستم بدون تعديل Meta كل مرة.',
    how: 'اكتب نص الرسالة الكامل في المتغير {{2}}. اسم المريض يتم ملؤه تلقائياً في {{1}}.',
    variables: ['{{1}} اسم كل مريض تلقائياً', '{{2}} نص الرسالة الكامل'],
    body: CLINIC_CUSTOM_MESSAGE_BODY,
  },
  clinic_offer_text_ar: {
    title: 'قالب العرض النصي',
    where: 'يستخدم من صفحة الحملات لإرسال عرض تسويقي نصي للمرضى المختارين.',
    how: 'اكتب تفاصيل العرض كاملة في المتغير {{2}} مثل الخدمة، نسبة الخصم، السعر قبل الخصم، والسعر بعد الخصم. اسم المريض يتم ملؤه تلقائياً في {{1}}.',
    variables: ['{{1}} اسم كل مريض تلقائياً', '{{2}} تفاصيل العرض كاملة'],
    body: CLINIC_OFFER_TEXT_BODY,
  },
  clinic_offer_image_ar: {
    title: 'قالب عرض بصورة',
    where: 'يستخدم من صفحة الحملات عند إرسال عرض يحتوي على صورة.',
    how: 'اختر القالب ثم ارفع صورة الحملة من نفس الخطوة قبل الإرسال.',
    variables: ['الصورة تضاف من Header', 'النص ثابت حسب Meta إلا إذا كان القالب يحتوي على متغيرات'],
  },
  booking_confirmed_ar_v2: {
    title: 'تأكيد الحجز',
    where: 'يرسله النظام تلقائياً عند قبول طلب حجز من صفحة قبول الطلبات والكشف.',
    how: 'يبلغ المريض برقم الحجز والخدمة والطبيب والتاريخ والوقت.',
    variables: ['{{1}} رقم الحجز', '{{2}} الخدمة', '{{3}} الطبيب', '{{4}} التاريخ', '{{5}} الوقت'],
  },
  booking_cancelled_ar_v2: {
    title: 'إلغاء الحجز',
    where: 'يرسله النظام عند إلغاء موعد مؤكد.',
    how: 'يبلغ المريض أن الحجز اتلغى مع ملخص الموعد.',
    variables: ['{{1}} رقم الحجز', '{{2}} ملخص الموعد'],
  },
  booking_rejected_ar_v2: {
    title: 'رفض طلب الحجز',
    where: 'يرسله النظام عند رفض طلب حجز بدون بدائل.',
    how: 'يشرح للمريض أن الموعد غير متاح ويطلب التواصل لتحديد موعد بديل.',
    variables: ['{{1}} الخدمة', '{{2}} سبب الرفض'],
  },
  booking_rejected_with_alternatives_ar_v2: {
    title: 'رفض الحجز مع بدائل',
    where: 'يرسله النظام عند رفض طلب حجز مع اقتراح 3 مواعيد بديلة.',
    how: 'يعرض البدائل المقترحة داخل الرسالة.',
    variables: ['{{1}} الخدمة', '{{2}} السبب', '{{3}} البديل الأول', '{{4}} البديل الثاني', '{{5}} البديل الثالث'],
  },
  appointment_reminder_ar_v2: {
    title: 'تذكير الموعد',
    where: 'يرسله النظام تلقائياً قبل الموعد حسب إعدادات التذكير.',
    how: 'يذكر المريض بتاريخ ووقت الموعد والطبيب والخدمة.',
    variables: ['{{1}} اسم المريض', '{{2}} التاريخ', '{{3}} الوقت', '{{4}} الطبيب', '{{5}} الخدمة'],
  },
  doctor_reschedule_ar_v1: {
    title: 'إعادة جدولة الطبيب',
    where: 'يرسله النظام عند نقل مواعيد طبيب إلى طبيب بديل، خصوصاً خارج نافذة واتساب 24 ساعة.',
    how: 'يبلغ المريض أن الطبيب تغير فقط وأن وقت الموعد والخدمة كما هما.',
    variables: ['{{1}} اسم المريض', '{{2}} رقم الحجز', '{{3}} الخدمة', '{{4}} الطبيب الجديد', '{{5}} الطبيب القديم', '{{6}} التاريخ', '{{7}} الوقت'],
  },
  clinic_review_ar: {
    title: 'طلب تقييم الزيارة',
    where: 'يرسله النظام تلقائياً بعد الموعد بثلاث ساعات تقريباً.',
    how: 'يطلب من المريض تقييم تجربته بعد الزيارة.',
    variables: ['{{1}} اسم المريض', '{{2}} اسم الطبيب'],
  },
  prescription_ready_ar_v1: {
    title: 'إشعار الروشتة',
    where: 'يرسله النظام عند إرسال روشتة للمريض.',
    how: 'يبلغ المريض أن الروشتة الطبية جاهزة ومرفقة/مرسلة من العيادة.',
    variables: ['قد يستخدم Header مستند حسب إعداد Meta'],
  },
};

const getTemplateGuide = (templateName) => templateGuideByName[templateName] || {
  title: 'قالب محفوظ',
  where: 'قالب محفوظ داخل النظام ويستخدم عند اختياره من صفحة الحملات.',
  how: 'تأكد أن الاسم مطابق تماماً لاسم القالب المعتمد في Meta.',
  variables: ['لو القالب في Meta يحتوي على متغيرات، اكتبها في Body داخل النظام بنفس صيغة {{1}} و{{2}}'],
};

const getTemplateBodyPreview = (template) => {
  if (!template) return '';
  if (template.name === 'clinic_offer_text_ar') return CLINIC_OFFER_TEXT_BODY;
  if (template.name === 'clinic_custom_message_ar') return CLINIC_CUSTOM_MESSAGE_BODY;
  return template.bodyText || '';
};

export default function CampaignsPage() {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const canManageTemplates = currentUser?.role === 'ADMIN';

  const [step, setStep] = useState(1);
  const [campaignType, setCampaignType] = useState('TEXT');
  const [messageText, setMessageText] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [campaignImageUrl, setCampaignImageUrl] = useState('');
  const [templateBodyParams, setTemplateBodyParams] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedPatientIds, setSelectedPatientIds] = useState([]);
  const [importedRecipients, setImportedRecipients] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showTemplateGuide, setShowTemplateGuide] = useState(false);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [templateSaving, setTemplateSaving] = useState(false);

  const fetchTemplates = async () => {
    try {
      setTemplatesLoading(true);
      const res = await api.get('/campaigns/templates');
      setTemplates(res.data.templates || []);
    } catch (error) {
      toast.error('فشل تحميل القوالب');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await api.get('/patients', { params: { limit: 500 } });
      setAllPatients((res.data.patients || []).filter((patient) => patient.platform === 'WHATSAPP' && patient.phone));
    } catch (error) {
      toast.error('فشل تحميل المرضى');
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchPatients();
  }, []);

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const selectedTemplateBody = getTemplateBodyPreview(selectedTemplate);
  const selectedTemplateGuide = selectedTemplate ? getTemplateGuide(selectedTemplate.name) : null;
  const templateVariables = useMemo(() => extractTemplateVariables(selectedTemplateBody), [selectedTemplateBody]);
  const missingTemplateParams =
    campaignType === 'TEMPLATE' &&
    templateVariables.some((variable) => !isAutoTemplateVariable(variable, selectedTemplate?.name) && !String(getParamValue(templateBodyParams, variable) || '').trim());
  const filteredPatients = allPatients.filter((patient) => {
    const query = patientSearch.trim().toLowerCase();
    if (!query) return true;
    return `${patient.name || ''} ${patient.displayName || ''} ${patient.phone || ''}`.toLowerCase().includes(query);
  });

  const totalAudienceCount = selectedPatientIds.length + importedRecipients.length;

  const selectedPatients = useMemo(
    () => allPatients.filter((patient) => selectedPatientIds.includes(patient.id)),
    [allPatients, selectedPatientIds]
  );

  const needsImage = campaignType === 'TEMPLATE' && selectedTemplate?.headerType === 'IMAGE';
  const canMoveNext =
    step === 1 ||
    (step === 2 &&
      (campaignType === 'TEXT' ? messageText.trim() : selectedTemplateId && !missingTemplateParams) &&
      (!needsImage || campaignImageUrl || selectedTemplate?.imageUrl)) ||
    (step === 3 && totalAudienceCount > 0) ||
    step === 4;

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      setUploadingImage(true);
      const res = await api.post('/upload/campaign-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCampaignImageUrl(res.data.url);
      toast.success('تم رفع الصورة');
    } catch (error) {
      toast.error(error.message || 'فشل رفع الصورة');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAudienceSheetUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (/\.xlsx$/i.test(file.name)) {
      toast.warn('احفظ الشيت من Excel بصيغة CSV ثم ارفعه هنا حتى تتم قراءة الأرقام.');
      event.target.value = '';
      return;
    }

    const text = await file.text();
    const recipients = parseAudienceSheet(text);
    setImportedRecipients(recipients);
    toast.success(`تم تحميل ${recipients.length} رقم من الشيت`);
  };

  const handleSendCampaign = async () => {
    if (totalAudienceCount === 0) return toast.error('اختر مرضى أولاً');
    if (campaignType === 'TEXT' && !messageText.trim()) return toast.error('أدخل نص الرسالة');
    if (campaignType === 'TEMPLATE' && !selectedTemplateId) return toast.error('اختر قالباً');

    try {
      setSending(true);
      const res = await api.post('/campaigns/broadcast', {
        broadcastType: campaignType,
        messageText: campaignType === 'TEXT' ? messageText : undefined,
        templateId: campaignType === 'TEMPLATE' ? selectedTemplateId : undefined,
        templateBodyParams:
          campaignType === 'TEMPLATE'
            ? templateVariables
                .filter((variable) => variable.type === 'number')
                .map((variable) => getAutoTemplateVariableValue(variable, selectedTemplate?.name) || getParamValue(templateBodyParams, variable) || '')
            : undefined,
        templateBodyNamedParams:
          campaignType === 'TEMPLATE'
            ? templateVariables
                .filter((variable) => variable.type === 'named')
                .map((variable) => ({
                  name: variable.name,
                  value: getAutoTemplateVariableValue(variable, selectedTemplate?.name) || getParamValue(templateBodyParams, variable) || '',
                }))
            : undefined,
        imageUrl: campaignImageUrl || undefined,
        audience: 'SELECTED',
        patientIds: selectedPatientIds,
        externalRecipients: importedRecipients,
      });
      toast.success(res.data.summary || 'تم إرسال الحملة');
      setMessageText('');
      setSelectedTemplateId('');
      setTemplateBodyParams([]);
      setCampaignImageUrl('');
      setSelectedPatientIds([]);
      setImportedRecipients([]);
      setStep(1);
    } catch (error) {
      toast.error(error.message || 'فشل إرسال الحملة');
    } finally {
      setSending(false);
    }
  };

  const saveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.displayName.trim()) return toast.error('اسم القالب واسم العرض مطلوبان');
    try {
      setTemplateSaving(true);
      if (templateForm.id) await api.put(`/campaigns/templates/${templateForm.id}`, templateForm);
      else await api.post('/campaigns/templates', templateForm);
      toast.success('تم حفظ القالب');
      fetchTemplates();
      setShowTemplateForm(false);
      setTemplateForm(emptyTemplateForm);
    } catch (error) {
      toast.error(error.message || 'فشل حفظ القالب');
    } finally {
      setTemplateSaving(false);
    }
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm('حذف هذا القالب؟')) return;
    try {
      await api.delete(`/campaigns/templates/${id}`);
      toast.success('تم حذف القالب');
      fetchTemplates();
    } catch (error) {
      toast.error('فشل حذف القالب');
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="الحملات"
        description="إرسال رسائل جماعية بخطوات واضحة: نوع الرسالة، القالب أو النص، الجمهور، ثم المراجعة."
        actions={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton type="button" onClick={() => setShowTemplateGuide(true)}>
              <BookOpen className="h-4 w-4" />
              شرح القوالب
            </SecondaryButton>
            {canManageTemplates ? (
              <PrimaryButton type="button" onClick={() => setShowTemplateForm(true)}>
                <Plus className="h-4 w-4" />
                قالب جديد
              </PrimaryButton>
            ) : null}
          </div>
        }
      />

      <DataCard className="mb-6">
        <div className="grid gap-3 md:grid-cols-4">
          {steps.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
                step === item.id
                  ? 'border-sky-400 bg-sky-500/15 text-sky-200'
                  : item.id < step
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                    : 'border-white/10 bg-white/5 text-slate-300'
              }`}
            >
              {item.id}. {item.label}
            </button>
          ))}
        </div>
      </DataCard>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <DataCard>
          {step === 1 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Choice selected={campaignType === 'TEXT'} title="رسالة نصية" description="تُرسل داخل نافذة واتساب المتاحة فقط." onClick={() => setCampaignType('TEXT')} />
              <Choice selected={campaignType === 'TEMPLATE'} title="قالب واتساب" description="مناسب للحملات الرسمية وخارج نافذة 24 ساعة." onClick={() => setCampaignType('TEMPLATE')} />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              {campaignType === 'TEXT' ? (
                <Field label="نص الرسالة">
                  <textarea className={`${inputClass} min-h-[180px]`} value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="اكتب الرسالة هنا. يمكنك استخدام {{name}} لاسم المريض." />
                </Field>
              ) : (
                <>
                  <Field label="القالب">
                    <select
                      className={inputClass}
                      value={selectedTemplateId}
                      onChange={(event) => {
                        setSelectedTemplateId(event.target.value);
                        setTemplateBodyParams([]);
                      }}
                      disabled={templatesLoading}
                    >
                      <option value="">اختر قالباً محفوظاً</option>
                      {templates.filter((template) => template.active).map((template) => (
                        <option key={template.id} value={template.id}>{template.displayName || template.name}</option>
                      ))}
                    </select>
                  </Field>

                  {selectedTemplate ? (
                    <DataCard className="bg-white/[0.03]">
                      <StatusBadge tone={selectedTemplate.headerType === 'IMAGE' ? 'blue' : 'slate'}>
                        Header: {selectedTemplate.headerType}
                      </StatusBadge>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                        {renderTemplatePreview(selectedTemplateBody || 'قالب بدون نص معاينة داخلي.', templateBodyParams, selectedPatients[0], selectedTemplate.name)}
                      </p>
                      {selectedTemplateGuide ? (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-slate-200">
                          <p className="font-black text-white">{selectedTemplateGuide.title}</p>
                          <p className="mt-1 text-slate-300">{selectedTemplateGuide.where}</p>
                          <p className="mt-1 text-slate-400">{selectedTemplateGuide.how}</p>
                        </div>
                      ) : null}
                      {templateVariables.length > 0 ? (
                        <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3 text-sm leading-6 text-sky-100">
                          هذا القالب يحتوي على متغيرات. اكتب قيم المتغيرات تحت، وسيتم إرسالها داخل الـ Body مكان {'{{1}}'} و {'{{2}}'}.
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm leading-6 text-emerald-100">
                          القالب ثابت وجاهز للإرسال كما هو. لو العرض مكتوب داخل Meta مثل "خصم 20% على كل الخدمات"، فسيصل للمريض بهذا النص. تحتاج متغيرات فقط لو تريد تغيير الاسم أو السعر أو الخدمة وقت الإرسال.
                        </div>
                      )}
                    </DataCard>
                  ) : null}

                  {templateVariables.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {templateVariables.map((variable) => (
                        <Field key={variable.key} label={templateVariableLabels[variable.key] || `قيمة المتغير {{${variable.key}}}`}>
                          {isAutoTemplateVariable(variable, selectedTemplate?.name) ? (
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-sm font-bold text-emerald-100">
                              {getAutoTemplateVariableLabel(variable, selectedTemplate?.name)}
                            </div>
                          ) : (
                            <input
                              className={inputClass}
                              value={getParamValue(templateBodyParams, variable) || ''}
                              onChange={(event) => setTemplateBodyParams((current) => ({ ...(current || {}), [variable.key]: event.target.value }))}
                              placeholder={templateVariablePlaceholders[variable.key] || 'اكتب القيمة التي ستظهر مكان المتغير'}
                            />
                          )}
                        </Field>
                      ))}
                    </div>
                  ) : selectedTemplate ? null : null}

                  {needsImage ? (
                    <Field label="صورة القالب لهذه الحملة">
                      <div className="flex flex-col gap-3">
                        <input className={inputClass} value={campaignImageUrl} onChange={(event) => setCampaignImageUrl(event.target.value)} placeholder="رابط الصورة أو ارفع صورة" />
                        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/10">
                          <Upload className="h-4 w-4" />
                          {uploadingImage ? 'جاري الرفع...' : 'رفع صورة'}
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                        </label>
                      </div>
                    </Field>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <Field label="بحث في المرضى">
                <div className="relative">
                  <Search className="absolute right-3 top-3 h-4 w-4 text-slate-500" />
                  <input className={`${inputClass} pr-10`} value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} placeholder="اسم أو رقم المريض" />
                </div>
              </Field>
              <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-black text-white">رفع شيت أرقام من Excel</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">احفظ الشيت بصيغة CSV. العمود الأول للأرقام، والعمود الثاني للأسماء اختياري.</p>
                    {importedRecipients.length > 0 ? <p className="mt-2 text-sm font-bold text-sky-100">تم تحميل {importedRecipients.length} رقم من الشيت.</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/10">
                      <Upload className="h-4 w-4" />
                      رفع CSV
                      <input type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleAudienceSheetUpload} />
                    </label>
                    {importedRecipients.length > 0 ? <SecondaryButton type="button" onClick={() => setImportedRecipients([])}>مسح الشيت</SecondaryButton> : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <SecondaryButton type="button" onClick={() => setSelectedPatientIds(filteredPatients.map((patient) => patient.id))}>تحديد الكل ({filteredPatients.length})</SecondaryButton>
                <SecondaryButton type="button" onClick={() => setSelectedPatientIds([])}>إلغاء التحديد</SecondaryButton>
              </div>
              <div className="grid max-h-[520px] gap-2 overflow-y-auto">
                {filteredPatients.map((patient) => (
                  <label key={patient.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <input
                      type="checkbox"
                      checked={selectedPatientIds.includes(patient.id)}
                      onChange={(event) => {
                        setSelectedPatientIds((current) =>
                          event.target.checked ? [...current, patient.id] : current.filter((id) => id !== patient.id)
                        );
                      }}
                    />
                    <span className="flex-1">
                      <span className="block font-bold text-white">{patient.displayName || patient.name}</span>
                      <span className="block text-xs text-slate-400" dir="ltr">{patient.phone}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <h2 className="text-xl font-black text-white">مراجعة الحملة</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <Info label="النوع" value={campaignType === 'TEXT' ? 'رسالة نصية' : 'قالب واتساب'} />
                <Info label="المرضى" value={totalAudienceCount} />
                <Info label="الصورة" value={campaignImageUrl || selectedTemplate?.imageUrl ? 'موجودة' : 'بدون'} />
              </div>
              <PrimaryButton type="button" onClick={handleSendCampaign} disabled={sending} className="w-full">
                <Send className="h-4 w-4" />
                إرسال الحملة
              </PrimaryButton>
            </div>
          ) : null}

          <div className="mt-6 flex justify-between border-t border-white/10 pt-4">
            <SecondaryButton type="button" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}>السابق</SecondaryButton>
            <PrimaryButton type="button" disabled={!canMoveNext || step === 4} onClick={() => setStep((current) => Math.min(4, current + 1))}>التالي</PrimaryButton>
          </div>
        </DataCard>

        <DataCard>
          <div className="mb-4 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-sky-300" />
            <h2 className="text-lg font-black text-white">معاينة</h2>
          </div>
          <div className="rounded-3xl border border-white/10 bg-[#111827] p-4">
            <div className="mb-3 text-xs text-slate-400">واتساب - عيادتي</div>
            {campaignImageUrl || selectedTemplate?.imageUrl ? (
              <div className="mb-3 flex h-36 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400">
                <Image className="h-8 w-8" />
              </div>
            ) : null}
            <p className="whitespace-pre-wrap text-sm leading-7 text-white">
              {campaignType === 'TEXT'
                ? messageText || 'اكتب نص الرسالة لظهور المعاينة.'
                : renderTemplatePreview(selectedTemplateBody || 'اختر قالباً لظهور المعاينة.', templateBodyParams, selectedPatients[0], selectedTemplate?.name)}
            </p>
          </div>
          <div className="mt-4 text-sm text-slate-400">
            المحددون: {selectedPatients.slice(0, 3).map((patient) => patient.displayName || patient.name).join('، ')}
            {selectedPatients.length > 3 ? ` و ${selectedPatients.length - 3} آخرين` : ''}
          </div>
        </DataCard>
      </div>

      {canManageTemplates ? (
        <DataCard className="mt-6">
          <h2 className="mb-4 text-lg font-black text-white">القوالب المحفوظة</h2>
          {templates.length === 0 ? (
            <p className="text-slate-400">لا توجد قوالب محفوظة.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => (
                <div key={template.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-white">{template.displayName}</h3>
                      <p className="text-xs text-slate-500">{template.name}</p>
                    </div>
                    <button type="button" onClick={() => deleteTemplate(template.id)} className="text-rose-300 hover:text-rose-200">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm text-slate-300">{getTemplateBodyPreview(template)}</p>
                  <SecondaryButton type="button" onClick={() => { setTemplateForm(template); setShowTemplateForm(true); }} className="mt-3 w-full">تعديل</SecondaryButton>
                </div>
              ))}
            </div>
          )}
        </DataCard>
      ) : null}

      {showTemplateForm ? (
        <TemplateModal
          form={templateForm}
          setForm={setTemplateForm}
          saving={templateSaving}
          onSave={saveTemplate}
          onClose={() => { setShowTemplateForm(false); setTemplateForm(emptyTemplateForm); }}
        />
      ) : null}

      {showTemplateGuide ? (
        <TemplateGuideModal templates={templates} onClose={() => setShowTemplateGuide(false)} />
      ) : null}
    </AppLayout>
  );
}

function Choice({ selected, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-5 text-right transition ${
        selected ? 'border-sky-400 bg-sky-500/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
      }`}
    >
      <h3 className="text-lg font-black text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </button>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function TemplateModal({ form, setForm, saving, onSave, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0b1020] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-black text-white">{form.id ? 'تعديل القالب' : 'قالب جديد'}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">إغلاق</button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="اسم القالب في Meta">
            <input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="اسم العرض داخل النظام">
            <input className={inputClass} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
          </Field>
          <Field label="نوع الهيدر">
            <select className={inputClass} value={form.headerType} onChange={(event) => setForm({ ...form, headerType: event.target.value })}>
              <option value="NONE">بدون</option>
              <option value="IMAGE">صورة</option>
            </select>
          </Field>
          <Field label="رابط صورة القالب الافتراضية">
            <input className={inputClass} value={form.imageUrl || ''} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} />
          </Field>
          <Field label="نص القالب">
            <textarea className={`${inputClass} min-h-[140px] md:col-span-2`} value={form.bodyText || ''} onChange={(event) => setForm({ ...form, bodyText: event.target.value })} />
          </Field>
          <div className="md:col-span-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100">
            مهم: هذا النص للمعاينة داخل النظام فقط. النص الذي يصل فعلياً من واتساب هو النص المعتمد في Meta. لو تريد أجزاء قابلة للتغيير، أنشئ القالب في Meta بمتغيرات مثل {'{{1}}'} ثم املأها وقت الإرسال.
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <SecondaryButton type="button" onClick={onClose}>إلغاء</SecondaryButton>
          <PrimaryButton type="button" onClick={onSave} disabled={saving}>
            <Save className="h-4 w-4" />
            حفظ
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function TemplateGuideModal({ templates, onClose }) {
  const savedNames = new Set(templates.map((template) => template.name));
  const savedExtraTemplates = templates
    .filter((template) => !templateGuideByName[template.name])
    .map((template) => ({
      name: template.name,
      title: template.displayName || template.name,
      where: 'قالب محفوظ داخل النظام ويظهر في صفحة الحملات عند اختياره.',
      how: 'تأكد أن اسم القالب في النظام مطابق لاسمه المعتمد في Meta، وأن المتغيرات مكتوبة بنفس الترتيب.',
      variables: extractTemplateVariables(template.bodyText).map((variable) =>
        variable.type === 'named' ? `{{${variable.name}}} متغير باسم ${variable.name}` : `{{${variable.index}}} متغير رقم ${variable.index}`
      ),
      body: template.bodyText,
      saved: true,
    }));

  const guideItems = [
    ...Object.entries(templateGuideByName).map(([name, guide]) => ({
      name,
      ...guide,
      saved: savedNames.has(name),
    })),
    ...savedExtraTemplates,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-3xl border border-white/10 bg-[#0b1020] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <h2 className="text-xl font-black text-white">شرح قوالب واتساب داخل النظام</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              هذه القوالب لازم تكون معتمدة في Meta بنفس الاسم. النظام يختار القالب تلقائياً في التشغيل، أو تختاره أنت من صفحة الحملات.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:text-white" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="mb-5 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 text-sm leading-7 text-sky-100">
            <p className="font-black text-white">القالب المطلوب الآن: clinic_offer_text_ar</p>
            <p className="mt-1">استخدمه للعروض النصية العامة. اسم المريض تلقائي، وباقي القيم مثل الخدمة والسعر قبل/بعد الخصم تكتبها من صفحة الحملات قبل الإرسال.</p>
            <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-3 text-right font-sans text-slate-100">{CLINIC_OFFER_TEXT_BODY}</pre>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {guideItems.map((item) => (
              <div key={item.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-white">{item.title}</h3>
                    <p className="mt-1 text-xs text-slate-500" dir="ltr">{item.name}</p>
                  </div>
                  <StatusBadge tone={item.saved ? 'green' : 'slate'}>
                    {item.saved ? 'محفوظ' : 'نظامي'}
                  </StatusBadge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{item.where}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.how}</p>

                {item.variables?.length ? (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/15 p-3">
                    <p className="mb-2 text-xs font-black text-slate-300">المتغيرات:</p>
                    <div className="flex flex-wrap gap-2">
                      {item.variables.map((variable) => (
                        <span key={variable} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                          {variable}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {item.body ? (
                  <pre className="mt-3 max-h-36 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-3 text-right font-sans text-xs leading-6 text-slate-300">
                    {item.body}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
