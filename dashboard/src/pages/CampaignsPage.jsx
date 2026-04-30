import { useEffect, useMemo, useState } from 'react';
import { Image, Megaphone, Plus, Save, Search, Send, Trash2, Upload } from 'lucide-react';
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
  const matches = [...String(text || '').matchAll(/\{\{(\d+)\}\}/g)];
  return [...new Set(matches.map((match) => Number(match[1])).filter(Boolean))].sort((first, second) => first - second);
};

const renderTemplatePreview = (text = '', params = []) =>
  String(text || '').replace(/\{\{(\d+)\}\}/g, (_, index) => params[Number(index) - 1] || `{{${index}}}`);

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
  const [allPatients, setAllPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
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
  const templateVariables = useMemo(() => extractTemplateVariables(selectedTemplate?.bodyText), [selectedTemplate?.bodyText]);
  const missingTemplateParams = campaignType === 'TEMPLATE' && templateVariables.some((number) => !String(templateBodyParams[number - 1] || '').trim());
  const filteredPatients = allPatients.filter((patient) => {
    const query = patientSearch.trim().toLowerCase();
    if (!query) return true;
    return `${patient.name || ''} ${patient.displayName || ''} ${patient.phone || ''}`.toLowerCase().includes(query);
  });

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
    (step === 3 && selectedPatientIds.length > 0) ||
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

  const handleSendCampaign = async () => {
    if (selectedPatientIds.length === 0) return toast.error('اختر مرضى أولاً');
    if (campaignType === 'TEXT' && !messageText.trim()) return toast.error('أدخل نص الرسالة');
    if (campaignType === 'TEMPLATE' && !selectedTemplateId) return toast.error('اختر قالباً');

    try {
      setSending(true);
      const res = await api.post('/campaigns/broadcast', {
        broadcastType: campaignType,
        messageText: campaignType === 'TEXT' ? messageText : undefined,
        templateId: campaignType === 'TEMPLATE' ? selectedTemplateId : undefined,
        templateBodyParams: campaignType === 'TEMPLATE' ? templateVariables.map((number) => templateBodyParams[number - 1] || '') : undefined,
        imageUrl: campaignImageUrl || undefined,
        audience: 'SELECTED',
        patientIds: selectedPatientIds,
      });
      toast.success(res.data.summary || 'تم إرسال الحملة');
      setMessageText('');
      setSelectedTemplateId('');
      setTemplateBodyParams([]);
      setCampaignImageUrl('');
      setSelectedPatientIds([]);
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
        actions={canManageTemplates ? (
          <PrimaryButton type="button" onClick={() => setShowTemplateForm(true)}>
            <Plus className="h-4 w-4" />
            قالب جديد
          </PrimaryButton>
        ) : null}
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
                        {renderTemplatePreview(selectedTemplate.bodyText || 'قالب بدون نص معاينة داخلي.', templateBodyParams)}
                      </p>
                      <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100">
                        نص قالب واتساب نفسه ثابت من Meta. لو عايز تغير جزء داخل الرسالة، لازم يكون القالب في Meta فيه متغيرات مثل {'{{1}}'} و {'{{2}}'}، وتكتب قيمها هنا قبل الإرسال.
                      </div>
                    </DataCard>
                  ) : null}

                  {templateVariables.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {templateVariables.map((number) => (
                        <Field key={number} label={`قيمة المتغير {{${number}}}`}>
                          <input
                            className={inputClass}
                            value={templateBodyParams[number - 1] || ''}
                            onChange={(event) => {
                              const next = [...templateBodyParams];
                              next[number - 1] = event.target.value;
                              setTemplateBodyParams(next);
                            }}
                            placeholder={number === 1 ? '{{name}} أو نص ثابت' : 'اكتب القيمة التي ستظهر مكان المتغير'}
                          />
                        </Field>
                      ))}
                    </div>
                  ) : selectedTemplate ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-slate-400">
                      هذا القالب لا يحتوي على متغيرات، لذلك سيصل للمريض بنفس النص المعتمد في Meta بدون إضافة كلام جديد داخله.
                    </div>
                  ) : null}

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
                <Info label="المرضى" value={selectedPatientIds.length} />
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
                : renderTemplatePreview(selectedTemplate?.bodyText || 'اختر قالباً لظهور المعاينة.', templateBodyParams)}
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
                  <p className="mt-3 line-clamp-3 text-sm text-slate-300">{template.bodyText}</p>
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
