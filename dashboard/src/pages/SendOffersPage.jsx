import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Image, Search, Send, Square, Upload } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { DataCard, Field, PageHeader, PageLoader, PrimaryButton, SecondaryButton, StatusBadge, inputClass } from '../components/ui';

const offerTemplates = [
  {
    name: 'clinic_custom_message_ar',
    label: 'رسالة مخصصة مرنة',
    body: 'مرحباً {{1}} يسر عيادة د. إبراهيم التخصصي لطب وتجميل الأسنان أن تشاركك هذا التحديث المهم: {{2}} للحجز أو معرفة التفاصيل تواصل معنا الآن، وسيقوم فريق الاستقبال بمساعدتك في أقرب وقت.',
  },
  {
    name: 'clinic_offer_text_ar',
    label: 'عرض نصي',
    body: 'مرحباً {{1}} يسر عيادة د. إبراهيم التخصصي لطب وتجميل الأسنان تقديم عرض خاص لفترة محدودة. تفاصيل العرض: {{2}} للحجز أو معرفة التفاصيل تواصل معنا الآن، وسيقوم فريق الاستقبال بمساعدتك في أقرب وقت.',
  },
  {
    name: 'clinic_offer_image_ar',
    label: 'عرض بصورة',
    body: 'يسر عيادة د. إبراهيم التخصصي لطب وتجميل الأسنان تقديم عرض خاص وخدمات مميزة. للحجز أو الاستفسار تواصل معنا الآن.',
    needsImage: true,
  },
];

const channelLabels = {
  WHATSAPP: 'واتساب',
  FACEBOOK: 'فيسبوك',
  INSTAGRAM: 'إنستجرام',
};

export default function SendOffersPage() {
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [platform, setPlatform] = useState('WHATSAPP');
  const [segment, setSegment] = useState('ALL');
  const [serviceId, setServiceId] = useState('');
  const [excludeAlreadySent, setExcludeAlreadySent] = useState(false);
  const [search, setSearch] = useState('');
  const [templateName, setTemplateName] = useState('clinic_custom_message_ar');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);

  const selectedTemplate = offerTemplates.find((template) => template.name === templateName) || offerTemplates[0];

  const loadDrafts = async () => {
    try {
      const res = await api.get('/campaigns/offer-drafts');
      setDrafts(res.data.drafts || []);
    } catch {
      setDrafts([]);
    }
  };

  const applyDraft = (id) => {
    setSelectedDraftId(id);
    const draft = drafts.find((item) => item.id === id);
    if (!draft) {
      setDraftTitle('');
      return;
    }
    setTemplateName(draft.templateName);
    setMessage(draft.bodyText || '');
    setImageUrl(draft.imageUrl || '');
    setDraftTitle(draft.title || '');
    if (draft.serviceId) setServiceId(draft.serviceId);
  };

  const draftPayload = () => ({
    title: draftTitle.trim(),
    templateName,
    bodyText: message,
    imageUrl: imageUrl || undefined,
    serviceId: serviceId || undefined,
    channel: platform,
  });

  const saveDraft = async () => {
    if (!draftTitle.trim()) return toast.warn('اكتب اسماً للعرض المحفوظ');
    setSavingDraft(true);
    try {
      const res = await api.post('/campaigns/offer-drafts', draftPayload());
      toast.success('تم حفظ العرض');
      await loadDrafts();
      setSelectedDraftId(res.data.draft.id);
    } catch (error) {
      toast.error(error.message || 'فشل حفظ العرض');
    } finally {
      setSavingDraft(false);
    }
  };

  const updateDraft = async () => {
    if (!selectedDraftId) return;
    if (!draftTitle.trim()) return toast.warn('اكتب اسماً للعرض المحفوظ');
    setSavingDraft(true);
    try {
      await api.put(`/campaigns/offer-drafts/${selectedDraftId}`, draftPayload());
      toast.success('تم تحديث العرض المحفوظ');
      await loadDrafts();
    } catch (error) {
      toast.error(error.message || 'فشل تحديث العرض');
    } finally {
      setSavingDraft(false);
    }
  };

  const duplicateDraft = async () => {
    setSavingDraft(true);
    try {
      const res = await api.post('/campaigns/offer-drafts', {
        ...draftPayload(),
        title: `${draftTitle.trim() || 'عرض'} - نسخة`,
      });
      toast.success('تم إنشاء نسخة');
      await loadDrafts();
      setSelectedDraftId(res.data.draft.id);
      setDraftTitle(res.data.draft.title);
    } catch (error) {
      toast.error(error.message || 'فشل إنشاء نسخة');
    } finally {
      setSavingDraft(false);
    }
  };

  const deleteDraft = async () => {
    if (!selectedDraftId) return;
    setSavingDraft(true);
    try {
      await api.delete(`/campaigns/offer-drafts/${selectedDraftId}`);
      toast.success('تم حذف العرض المحفوظ');
      setSelectedDraftId('');
      setDraftTitle('');
      await loadDrafts();
    } catch (error) {
      toast.error(error.message || 'فشل حذف العرض');
    } finally {
      setSavingDraft(false);
    }
  };

  const loadRecipients = async () => {
    setLoading(true);
    try {
      const res = await api.get('/campaigns/segments', {
        params: {
          platform,
          segment,
          serviceId: serviceId || undefined,
          templateName,
          offerDraftId: selectedDraftId || undefined,
          excludeAlreadySent: excludeAlreadySent ? 'true' : undefined,
          search: search || undefined,
          limit: 500,
        },
      });
      setPatients(res.data.patients || []);
      setSelectedIds([]);
    } catch (error) {
      toast.error(error.message || 'فشل تحميل الجمهور');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadBasics = async () => {
      try {
        const servicesRes = await api.get('/services');
        setServices((servicesRes.data.services || []).filter((service) => service.active !== false));
      } catch {
        setServices([]);
      }
    };
    loadBasics();
    loadDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadRecipients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, segment, serviceId, excludeAlreadySent, templateName, selectedDraftId]);

  const preview = useMemo(() => {
    const name = patients.find((patient) => selectedIds.includes(patient.id))?.displayName || patients.find((patient) => selectedIds.includes(patient.id))?.name || 'اسم المريض';
    return selectedTemplate.body.replace('{{1}}', name).replace('{{2}}', message || 'نص العرض أو التحديث');
  }, [message, patients, selectedIds, selectedTemplate]);

  const allSelected = patients.length > 0 && patients.every((patient) => selectedIds.includes(patient.id));
  const toggleAll = () => setSelectedIds(allSelected ? [] : patients.map((patient) => patient.id));
  const togglePatient = (id) => setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    setUploadingImage(true);
    try {
      const res = await api.post('/upload/campaign-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImageUrl(res.data.url);
      toast.success('تم رفع الصورة');
    } catch (error) {
      toast.error(error.message || 'فشل رفع الصورة');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const sendOffers = async () => {
    if (!selectedIds.length) return toast.warn('اختر مستلمين أولاً');
    if (!message.trim() && templateName !== 'clinic_offer_image_ar') return toast.warn('اكتب نص العرض أولاً');
    if (selectedTemplate.needsImage && !imageUrl.trim()) return toast.warn('ارفع صورة العرض أولاً');

    setSending(true);
    try {
      const res = await api.post('/campaigns/send-offers', {
        platform,
        reviewerIds: selectedIds,
        templateName,
        message,
        serviceId: serviceId || undefined,
        offerDraftId: selectedDraftId || undefined,
        imageUrl: imageUrl || undefined,
      });
      toast.success(`نجاح ${res.data.successCount || 0} · فشل ${res.data.failCount || 0} · تخطي ${res.data.skippedCount || 0}`);
      setSelectedIds([]);
    } catch (error) {
      toast.error(error.message || 'فشل إرسال العروض');
    } finally {
      setSending(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="إرسال العروض"
        description="إرسال واتساب بالقوالب المعتمدة، وفيسبوك/إنستجرام عبر ManyChat داخل نافذة 24 ساعة."
        actions={<StatusBadge tone="blue">{channelLabels[platform]}</StatusBadge>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <DataCard className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Field label="القناة">
                <select className={inputClass} value={platform} onChange={(event) => setPlatform(event.target.value)}>
                  {Object.entries(channelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="تقسيم الجمهور">
                <select className={inputClass} value={segment} onChange={(event) => setSegment(event.target.value)}>
                  <option value="ALL">كل جهات القناة</option>
                  <option value="BOOKED_ANY">حجزوا (أي خدمة)</option>
                  <option value="BOOKED_SERVICE">حجزوا خدمة محددة</option>
                  <option value="NOT_BOOKED_SERVICE">لم يحجزوا خدمة محددة</option>
                  <option value="CONTACT_ONLY">تواصل فقط بدون حجز</option>
                  <option value="OFFER_SENT">أُرسل لهم هذا العرض</option>
                  <option value="OFFER_NOT_SENT">لم يُرسل لهم هذا العرض</option>
                </select>
              </Field>
              <Field label="الخدمة">
                <select
                  className={inputClass}
                  value={serviceId}
                  onChange={(event) => setServiceId(event.target.value)}
                  disabled={!['BOOKED_SERVICE', 'NOT_BOOKED_SERVICE', 'OFFER_SENT', 'OFFER_NOT_SENT'].includes(segment)}
                >
                  <option value="">كل الخدمات</option>
                  {services.map((service) => <option key={service.id} value={service.id}>{service.nameAr || service.name}</option>)}
                </select>
              </Field>
              <Field label="بحث">
                <div className="relative">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input className={`${inputClass} pr-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="اسم أو رقم" />
                </div>
              </Field>
              <div className="flex items-end">
                <PrimaryButton type="button" onClick={loadRecipients} disabled={loading} className="w-full">تطبيق</PrimaryButton>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <input
                type="checkbox"
                checked={excludeAlreadySent}
                onChange={(event) => setExcludeAlreadySent(event.target.checked)}
              />
              استبعاد من تم إرسال هذا العرض له من قبل
            </label>
          </DataCard>

          <DataCard>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-black text-white">المستلمون ({patients.length})</h2>
              <SecondaryButton type="button" onClick={toggleAll}>
                {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                تحديد الكل
              </SecondaryButton>
            </div>

            {loading ? (
              <PageLoader />
            ) : (
              <div className="grid max-h-[640px] gap-2 overflow-y-auto">
                {patients.map((patient) => {
                  const selected = selectedIds.includes(patient.id);
                  const missingManyChat = platform !== 'WHATSAPP' && !(patient.manychatSubscriberId || patient.manychatContactId || patient.facebookId || patient.instagramId);
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => togglePatient(patient.id)}
                      className={`rounded-2xl border p-3 text-right transition ${selected ? 'border-sky-400 bg-sky-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-white">{patient.displayName || patient.name}</p>
                          <p className="text-xs text-slate-400">{patient.phone || patient.platform} · حجوزات {patient._count?.appointments || 0}</p>
                        </div>
                        {selected ? <CheckSquare className="h-5 w-5 text-sky-300" /> : <Square className="h-5 w-5 text-slate-500" />}
                      </div>
                      {missingManyChat ? <p className="mt-2 text-xs text-amber-300">لا يوجد ManyChat ID، سيتم تخطيه.</p> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </DataCard>
        </div>

        <DataCard className="h-fit space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <Field label="العروض المحفوظة">
              <select className={inputClass} value={selectedDraftId} onChange={(event) => applyDraft(event.target.value)}>
                <option value="">— عرض جديد —</option>
                {drafts.map((draft) => (
                  <option key={draft.id} value={draft.id}>
                    {draft.title} ({offerTemplates.find((t) => t.name === draft.templateName)?.label || draft.templateName})
                  </option>
                ))}
              </select>
            </Field>
            <div className="mt-3">
              <Field label="اسم العرض المحفوظ">
                <input
                  className={inputClass}
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder="مثال: خصم تنظيف مايو"
                />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <PrimaryButton type="button" onClick={saveDraft} disabled={savingDraft} className="px-3 py-2 text-xs">
                حفظ كعرض محفوظ
              </PrimaryButton>
              {selectedDraftId ? (
                <SecondaryButton type="button" onClick={updateDraft} disabled={savingDraft} className="px-3 py-2 text-xs">
                  تحديث المحفوظ
                </SecondaryButton>
              ) : null}
              <SecondaryButton type="button" onClick={duplicateDraft} disabled={savingDraft} className="px-3 py-2 text-xs">
                نسخة جديدة
              </SecondaryButton>
              {selectedDraftId ? (
                <SecondaryButton
                  type="button"
                  onClick={deleteDraft}
                  disabled={savingDraft}
                  className="px-3 py-2 text-xs hover:bg-rose-500/15 hover:text-rose-200"
                >
                  حذف
                </SecondaryButton>
              ) : null}
            </div>
          </div>

          <Field label="القالب">
            <select className={inputClass} value={templateName} onChange={(event) => setTemplateName(event.target.value)}>
              {offerTemplates.map((template) => <option key={template.name} value={template.name}>{template.label}</option>)}
            </select>
          </Field>
          <Field label="نص العرض / التحديث {{2}}">
            <textarea className={inputClass} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="اكتب تفاصيل العرض هنا" />
          </Field>

          {selectedTemplate.needsImage ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200">
                <Upload className="h-4 w-4" />
                {uploadingImage ? 'جاري الرفع...' : 'رفع صورة العرض'}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
              {imageUrl ? <p className="mt-2 text-xs text-emerald-300"><Image className="inline h-4 w-4" /> تم رفع الصورة</p> : null}
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-[#0d1225] p-4">
            <h3 className="mb-2 font-black text-white">معاينة</h3>
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{preview}</p>
          </div>

          <PrimaryButton type="button" onClick={sendOffers} disabled={sending || selectedIds.length === 0} className="w-full">
            <Send className="h-4 w-4" />
            إرسال إلى {selectedIds.length}
          </PrimaryButton>
        </DataCard>
      </div>
    </AppLayout>
  );
}
