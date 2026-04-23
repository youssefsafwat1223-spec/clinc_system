import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { toast } from 'react-toastify';
import {
  Activity,
  Edit2,
  ImagePlus,
  Loader2,
  Megaphone,
  Plus,
  Save,
  Send,
  Trash2,
  UploadCloud,
} from 'lucide-react';

const TEMPLATE_CATEGORIES = [
  { value: 'MARKETING', label: 'تسويقي Marketing' },
  { value: 'UTILITY', label: 'خدمي Utility' },
];

const HEADER_TYPES = [
  { value: 'NONE', label: 'بدون صورة Header' },
  { value: 'IMAGE', label: 'صورة Header' },
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

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

const buildAssetUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;

  const apiBase = api.defaults.baseURL || '';
  const siteBase = apiBase.replace(/\/api\/?$/, '');
  return `${siteBase}${url}`;
};

export default function CampaignsPage() {
  const currentUser = getStoredUser();
  const canManageTemplates = currentUser?.role === 'ADMIN';

  const [broadcastType, setBroadcastType] = useState('TEXT');
  const [messageText, setMessageText] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [audience, setAudience] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateUploading, setTemplateUploading] = useState(false);

  const fetchTemplates = async () => {
    try {
      setTemplatesLoading(true);
      const res = await api.get('/campaigns/templates');
      setTemplates(res.data.templates || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل تحميل القوالب');
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const activeTemplates = useMemo(
    () => templates.filter((template) => template.active),
    [templates]
  );

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) || null,
    [templates, templateId]
  );

  const openCreateTemplateModal = () => {
    setTemplateForm(emptyTemplateForm);
    setIsTemplateModalOpen(true);
  };

  const openEditTemplateModal = (template) => {
    setTemplateForm({
      id: template.id,
      name: template.name || '',
      displayName: template.displayName || '',
      category: template.category || 'MARKETING',
      languageCode: template.languageCode || 'ar',
      headerType: template.headerType || 'NONE',
      bodyText: template.bodyText || '',
      footerText: template.footerText || '',
      imageUrl: template.imageUrl || '',
      active: template.active ?? true,
    });
    setIsTemplateModalOpen(true);
  };

  const handleSend = async (e) => {
    e.preventDefault();

    if (broadcastType === 'TEXT' && !messageText.trim()) return;
    if (broadcastType === 'TEMPLATE' && !templateId) return;

    if (!window.confirm('سيتم إرسال الحملة فورًا. هل تريد المتابعة؟')) return;

    try {
      setLoading(true);
      setStats(null);

      const res = await api.post('/campaigns/broadcast', {
        platform: 'WHATSAPP',
        audience,
        broadcastType,
        messageText: broadcastType === 'TEXT' ? messageText : undefined,
        templateId: broadcastType === 'TEMPLATE' ? templateId : undefined,
      });

      toast.success('تم إرسال الحملة');
      setStats(res.data.summary);
      if (broadcastType === 'TEXT') {
        setMessageText('');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'حدث خطأ أثناء الإرسال');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الصورة يجب ألا يتجاوز 5MB');
      return;
    }

    try {
      setTemplateUploading(true);
      const formData = new FormData();
      formData.append('image', file);

      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setTemplateForm((prev) => ({ ...prev, imageUrl: res.data.url }));
      toast.success('تم رفع صورة القالب');
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل رفع الصورة');
    } finally {
      setTemplateUploading(false);
      event.target.value = '';
    }
  };

  const handleSaveTemplate = async (event) => {
    event.preventDefault();

    if (!templateForm.name.trim() || !templateForm.displayName.trim()) {
      toast.error('اسم القالب واسم العرض مطلوبان');
      return;
    }

    if (templateForm.headerType === 'IMAGE' && !templateForm.imageUrl) {
      toast.error('ارفع صورة للقالب الذي يحتوي على Header Image');
      return;
    }

    try {
      setTemplateSaving(true);
      const payload = {
        name: templateForm.name,
        displayName: templateForm.displayName,
        category: templateForm.category,
        languageCode: templateForm.languageCode,
        headerType: templateForm.headerType,
        bodyText: templateForm.bodyText,
        footerText: templateForm.footerText,
        imageUrl: templateForm.headerType === 'IMAGE' ? templateForm.imageUrl : '',
        active: templateForm.active,
      };

      if (templateForm.id) {
        await api.put(`/campaigns/templates/${templateForm.id}`, payload);
        toast.success('تم تحديث القالب');
      } else {
        await api.post('/campaigns/templates', payload);
        toast.success('تم إنشاء القالب');
      }

      setIsTemplateModalOpen(false);
      setTemplateForm(emptyTemplateForm);
      await fetchTemplates();
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل حفظ القالب');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('هل تريد حذف هذا القالب من النظام؟')) return;

    try {
      await api.delete(`/campaigns/templates/${id}`);
      if (templateId === id) {
        setTemplateId('');
      }
      toast.success('تم حذف القالب');
      await fetchTemplates();
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل حذف القالب');
    }
  };

  const insertVariable = (variable) => {
    setMessageText((prev) => `${prev}${variable}`);
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6 fade-in">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
              <Megaphone className="h-6 w-6 text-primary-500" />
              الحملات الإعلانية
            </h1>
            <p className="mt-1 text-sm text-dark-muted">
              إرسال حملات واتساب مع اختيار قالب محفوظ ورفع صورة من الجهاز بدل كتابة رابط يدوي.
            </p>
          </div>

          {canManageTemplates ? (
            <button onClick={openCreateTemplateModal} className="btn-primary">
              <Plus className="h-5 w-5" />
              إضافة قالب جديد
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr,1fr]">
          <div className="space-y-6">
            <div className="glass-card p-6">
              <form onSubmit={handleSend} className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">الجمهور المستهدف</label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-3 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="ALL">جميع مرضى واتساب</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">نوع الحملة</label>
                  <select
                    value={broadcastType}
                    onChange={(e) => setBroadcastType(e.target.value)}
                    className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-3 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="TEXT">رسالة نصية عادية</option>
                    <option value="TEMPLATE">قالب واتساب معتمد Template</option>
                  </select>
                </div>

                {broadcastType === 'TEXT' ? (
                  <div>
                    <div className="mb-2 flex items-end justify-between gap-3">
                      <label className="block text-sm font-medium text-slate-300">نص الرسالة</label>
                      <button
                        type="button"
                        onClick={() => insertVariable(' {{name}} ')}
                        className="rounded-lg border border-dark-border bg-dark-bg px-2 py-1 text-xs font-bold text-primary-400"
                      >
                        + اسم المريض
                      </button>
                    </div>
                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="اكتب رسالة الحملة هنا..."
                      className="h-48 w-full resize-none rounded-xl border border-dark-border bg-dark-bg p-4 leading-relaxed text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-300">اختر القالب المحفوظ</label>
                      <select
                        value={templateId}
                        onChange={(e) => setTemplateId(e.target.value)}
                        className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-3 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        disabled={templatesLoading}
                      >
                        <option value="">اختر قالبًا</option>
                        {activeTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.displayName} - {template.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-dark-muted">
                        القالب المحفوظ في النظام يجب أن يكون اسمه مطابقًا لاسم الـ template المعتمد داخل Meta.
                      </p>
                    </div>

                    {selectedTemplate ? (
                      <div className="rounded-2xl border border-dark-border bg-dark-bg/50 p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-white">{selectedTemplate.displayName}</h3>
                            <p className="mt-1 text-xs text-dark-muted">
                              {selectedTemplate.name} • {selectedTemplate.category} • {selectedTemplate.languageCode}
                            </p>
                          </div>
                          <span className="rounded-full bg-primary-500/10 px-3 py-1 text-xs font-bold text-primary-300">
                            {selectedTemplate.headerType === 'IMAGE' ? 'Template بصورة' : 'Template نصي'}
                          </span>
                        </div>

                        {selectedTemplate.headerType === 'IMAGE' && selectedTemplate.imageUrl ? (
                          <img
                            src={buildAssetUrl(selectedTemplate.imageUrl)}
                            alt={selectedTemplate.displayName}
                            className="mb-4 h-44 w-full rounded-xl object-cover"
                          />
                        ) : null}

                        {selectedTemplate.bodyText ? (
                          <p className="whitespace-pre-line rounded-xl bg-dark-card/70 p-4 text-sm leading-7 text-slate-200">
                            {selectedTemplate.bodyText}
                          </p>
                        ) : null}

                        {selectedTemplate.footerText ? (
                          <p className="mt-3 text-xs text-dark-muted">Footer: {selectedTemplate.footerText}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="flex justify-end border-t border-dark-border pt-4">
                  <button
                    type="submit"
                    disabled={loading || (broadcastType === 'TEXT' ? !messageText.trim() : !templateId)}
                    className="btn-primary rounded-xl px-8 py-3 text-lg font-bold disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        جاري الإرسال...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Send className="h-5 w-5 rtl:-scale-x-100" />
                        بدء الإرسال
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {stats ? (
              <div className="glass-card flex items-start gap-4 border border-emerald-500/20 bg-emerald-900/10 p-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                  <Activity className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="mb-1 text-lg font-bold text-emerald-400">تقرير الإرسال</h3>
                  <p className="text-sm text-slate-300">{stats}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="glass-card p-6">
              <h3 className="mb-4 font-bold text-white">القوالب المحفوظة</h3>
              {templatesLoading ? (
                <div className="flex items-center gap-2 text-sm text-dark-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري تحميل القوالب...
                </div>
              ) : templates.length === 0 ? (
                <p className="text-sm text-dark-muted">لا توجد قوالب محفوظة بعد.</p>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div key={template.id} className="rounded-2xl border border-dark-border bg-dark-bg/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-white">{template.displayName}</h4>
                          <p className="mt-1 text-xs text-dark-muted">{template.name}</p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                            template.active
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : 'bg-rose-500/10 text-rose-300'
                          }`}
                        >
                          {template.active ? 'نشط' : 'موقف'}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-dark-muted">
                        <span>{template.headerType === 'IMAGE' ? 'مع صورة' : 'بدون صورة'}</span>
                        <span>{template.category}</span>
                      </div>

                      {canManageTemplates ? (
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => openEditTemplateModal(template)}
                            className="inline-flex items-center gap-2 rounded-lg border border-dark-border px-3 py-2 text-xs font-bold text-slate-200"
                          >
                            <Edit2 className="h-4 w-4" />
                            تعديل
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-bold text-rose-300"
                          >
                            <Trash2 className="h-4 w-4" />
                            حذف
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card p-6">
              <h3 className="mb-4 font-bold text-white">ملاحظات مهمة</h3>
              <ul className="space-y-3 text-sm text-slate-300">
                <li>اسم القالب في النظام يجب أن يطابق اسم القالب المعتمد داخل Meta حرفيًا.</li>
                <li>إذا كان القالب من نوع Image Header، ارفع صورة هنا من الجهاز مثل صورة الطبيب.</li>
                <li>الصورة تُرفع على السيرفر ثم تتحول تلقائيًا إلى رابط عام صالح للإرسال إلى Meta.</li>
              </ul>
            </div>
          </div>
        </div>

        {isTemplateModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-bg/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl border border-dark-border bg-dark-card p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {templateForm.id ? 'تعديل قالب الحملة' : 'إضافة قالب حملة جديد'}
                  </h2>
                  <p className="mt-1 text-sm text-dark-muted">
                    احفظ هنا بيانات القالب الداخلية، واستخدم نفس الاسم عند إنشاء الـ template في Meta.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsTemplateModalOpen(false);
                    setTemplateForm(emptyTemplateForm);
                  }}
                  className="rounded-lg border border-dark-border px-3 py-2 text-sm text-dark-muted"
                >
                  إغلاق
                </button>
              </div>

              <form onSubmit={handleSaveTemplate} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-dark-muted">اسم العرض داخل النظام</label>
                    <input
                      value={templateForm.displayName}
                      onChange={(e) => setTemplateForm((prev) => ({ ...prev, displayName: e.target.value }))}
                      className="input-field"
                      placeholder="عرض تنظيف وتبييض"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-dark-muted">اسم القالب في Meta</label>
                    <input
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="input-field"
                      placeholder="clinic_offer_image_ar"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-dark-muted">التصنيف</label>
                    <select
                      value={templateForm.category}
                      onChange={(e) => setTemplateForm((prev) => ({ ...prev, category: e.target.value }))}
                      className="input-field"
                    >
                      {TEMPLATE_CATEGORIES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-dark-muted">اللغة</label>
                    <input
                      value={templateForm.languageCode}
                      onChange={(e) => setTemplateForm((prev) => ({ ...prev, languageCode: e.target.value }))}
                      className="input-field"
                      placeholder="ar"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-dark-muted">نوع الـ Header</label>
                    <select
                      value={templateForm.headerType}
                      onChange={(e) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          headerType: e.target.value,
                          imageUrl: e.target.value === 'IMAGE' ? prev.imageUrl : '',
                        }))
                      }
                      className="input-field"
                    >
                      {HEADER_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-dark-muted">Body المكتوب داخل القالب</label>
                  <textarea
                    value={templateForm.bodyText}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, bodyText: e.target.value }))}
                    className="h-32 w-full rounded-xl border border-dark-border bg-dark-bg p-4 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="اكتب النص الذي ستسجله في Meta"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-dark-muted">Footer المكتوب داخل القالب</label>
                  <input
                    value={templateForm.footerText}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, footerText: e.target.value }))}
                    className="input-field"
                    placeholder="للحجز والاستفسار"
                  />
                </div>

                {templateForm.headerType === 'IMAGE' ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-dark-muted">صورة القالب</label>
                    <div className="flex items-center gap-4">
                      {templateForm.imageUrl ? (
                        <div className="relative h-20 w-20 overflow-hidden rounded-2xl ring-1 ring-dark-border">
                          <img
                            src={buildAssetUrl(templateForm.imageUrl)}
                            alt="صورة القالب"
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setTemplateForm((prev) => ({ ...prev, imageUrl: '' }))}
                            className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-dark-bg/50 ring-1 ring-dark-border">
                          <ImagePlus className="h-6 w-6 text-dark-muted" />
                        </div>
                      )}

                      <div className="relative flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleTemplateImageUpload}
                          disabled={templateUploading}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                        <div className="flex items-center gap-2 rounded-xl border border-dashed border-dark-border bg-dark-bg/30 px-4 py-3 text-sm text-slate-300">
                          {templateUploading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
                          ) : (
                            <UploadCloud className="h-5 w-5 text-dark-muted" />
                          )}
                          {templateUploading ? 'جاري رفع الصورة...' : 'اختر صورة من الجهاز'}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={templateForm.active}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, active: e.target.checked }))}
                    className="h-4 w-4 rounded border-dark-border bg-dark-bg text-primary-500 focus:ring-primary-500"
                  />
                  قالب نشط وجاهز للاختيار في الحملات
                </label>

                <div className="flex justify-end gap-3 border-t border-dark-border pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTemplateModalOpen(false);
                      setTemplateForm(emptyTemplateForm);
                    }}
                    className="rounded-lg px-4 py-2 font-medium text-dark-muted transition-colors hover:text-white"
                  >
                    إلغاء
                  </button>
                  <button type="submit" disabled={templateSaving} className="btn-primary rounded-lg px-6">
                    {templateSaving ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        جاري الحفظ...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Save className="h-4 w-4" />
                        حفظ القالب
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
