import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Image, RotateCcw, Search, Send, Square, Upload } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { DataCard, Field, PageHeader, PrimaryButton, SecondaryButton, StatusBadge, inputClass } from '../components/ui';

const steps = ['اختيار مراجعي واتساب', 'اختيار القالب والرسالة', 'مراجعة وإرسال'];

const offerTemplates = [
  {
    name: 'clinic_custom_message_ar',
    label: 'رسالة مخصصة مرنة',
    hint: 'قالب تسويقي عام. يتم تعبئة {{1}} باسم المريض و{{2}} بنص الرسالة.',
  },
  {
    name: 'clinic_offer_text_ar',
    label: 'عرض نصي',
    hint: 'عرض بدون صورة. يتم تعبئة {{1}} باسم المريض و{{2}} بتفاصيل العرض.',
  },
  {
    name: 'clinic_offer_image_ar',
    label: 'عرض بصورة',
    hint: 'عرض بصورة في Header. يتم تعبئة {{1}} باسم المريض و{{2}} بتفاصيل العرض.',
    needsImage: true,
  },
];

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export default function SendOffersPage() {
  const [step, setStep] = useState(0);
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('recent');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [bookingFilter, setBookingFilter] = useState('ALL');
  const [contactFilter, setContactFilter] = useState('ALL');
  const [minSpent, setMinSpent] = useState('');
  const [maxSpent, setMaxSpent] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [templateName, setTemplateName] = useState('clinic_custom_message_ar');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    const loadPatients = async () => {
      setLoading(true);
      try {
        const res = await api.get('/patients', {
          params: {
            page: 1,
            limit: 500,
            period: periodFilter === 'ALL' ? undefined : periodFilter,
            sortBy,
          },
        });
        setPatients((res.data.patients || []).filter((patient) => patient.platform === 'WHATSAPP'));
      } catch (error) {
        toast.error(error.message || 'فشل تحميل مراجعي واتساب');
      } finally {
        setLoading(false);
      }
    };
    loadPatients();
  }, [periodFilter, sortBy]);

  const selectedTemplate = offerTemplates.find((template) => template.name === templateName) || offerTemplates[0];

  const patientGroups = useMemo(() => {
    const groups = new Map();
    patients.forEach((patient) => {
      (patient.groups || []).forEach((membership) => {
        const group = membership.group || membership;
        if (group?.id) groups.set(group.id, group.name || 'مجموعة بدون اسم');
      });
    });
    return Array.from(groups, ([id, name]) => ({ id, name }));
  }, [patients]);

  const filteredPatients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const minValue = toNumber(minSpent);
    const maxValue = toNumber(maxSpent);

    return patients.filter((patient) => {
      const matchesSearch =
        !term ||
        [patient.name, patient.displayName, patient.phone, patient.email]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      const appointmentCount = patient._count?.appointments || 0;
      const matchesBookings =
        bookingFilter === 'ALL' ||
        (bookingFilter === 'hasBookings' && appointmentCount > 0) ||
        (bookingFilter === 'noBookings' && appointmentCount === 0);

      const matchesContact =
        contactFilter === 'ALL' ||
        (contactFilter === 'hasEmail' && Boolean(patient.email)) ||
        (contactFilter === 'noEmail' && !patient.email);

      const matchesGroup =
        groupFilter === 'ALL' ||
        (patient.groups || []).some(
          (membership) => (membership.groupId || membership.group?.id || membership.id) === groupFilter
        );

      const spent = Number(patient.totalSpent || 0);
      const matchesPriceRange =
        (minValue === null || spent >= minValue) &&
        (maxValue === null || spent <= maxValue);

      return matchesSearch && matchesBookings && matchesContact && matchesGroup && matchesPriceRange;
    });
  }, [patients, searchTerm, bookingFilter, contactFilter, groupFilter, minSpent, maxSpent]);

  const allFilteredSelected =
    filteredPatients.length > 0 && filteredPatients.every((patient) => selectedIds.includes(patient.id));

  const togglePatient = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleAllFiltered = () => {
    const filteredIds = filteredPatients.map((patient) => patient.id);
    setSelectedIds((current) => {
      if (filteredIds.every((id) => current.includes(id))) {
        return current.filter((id) => !filteredIds.includes(id));
      }
      return [...new Set([...current, ...filteredIds])];
    });
  };

  const resetFilters = () => {
    setSearchTerm('');
    setPeriodFilter('ALL');
    setSortBy('recent');
    setGroupFilter('ALL');
    setBookingFilter('ALL');
    setContactFilter('ALL');
    setMinSpent('');
    setMaxSpent('');
  };

  const sendOffers = async () => {
    if (!selectedIds.length) return toast.warn('اختر مراجعين من واتساب أولاً');
    if (!message.trim()) return toast.warn('اكتب نص العرض أولاً');
    if (selectedTemplate.needsImage && !imageUrl.trim()) return toast.warn('صورة العرض مطلوبة لهذا القالب');

    setSending(true);
    try {
      const res = await api.post('/campaigns/send-offers', {
        reviewerIds: selectedIds,
        templateName,
        message,
        imageUrl: imageUrl.trim() || undefined,
      });
      toast.success(`تم الإرسال: نجاح ${res.data.successCount || 0} - فشل ${res.data.failCount || 0}`);
      setStep(0);
      setSelectedIds([]);
      setMessage('');
      setImageUrl('');
    } catch (error) {
      toast.error(error.message || 'فشل إرسال العروض');
    } finally {
      setSending(false);
    }
  };

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
      setImageUrl(res.data.url);
      toast.success('تم رفع صورة العرض');
    } catch (error) {
      toast.error(error.message || 'فشل رفع الصورة');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const previewName = 'اسم المريض';
  const previewText = message
    .replace(/\{\{name\}\}/g, previewName)
    .replace(/\{\{phone\}\}/g, '964xxxxxxxxx');

  return (
    <AppLayout>
      <PageHeader
        title="إرسال عروض واتساب"
        description="الإرسال من هذه الصفحة مختص لمرضى واتساب فقط باستخدام القوالب المعتمدة."
      />

      <DataCard className="mb-6">
        <div className="flex flex-wrap gap-2">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                step === index
                  ? 'bg-sky-500 text-white'
                  : index < step
                    ? 'bg-emerald-500/10 text-emerald-300'
                    : 'bg-white/5 text-slate-300'
              }`}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>
      </DataCard>

      {step === 0 ? (
        <DataCard>
          <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
            لن تظهر هنا محادثات Instagram أو Facebook. هذه الصفحة ترسل فقط قوالب واتساب.
          </div>

          <div className="mb-4 grid gap-3 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className={`${inputClass} pr-10`}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="بحث بالاسم أو الهاتف أو البريد"
              />
            </div>

            <select className={inputClass} value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}>
              <option value="ALL">كل الفترات</option>
              <option value="last7">آخر أسبوع</option>
              <option value="last30">آخر شهر</option>
              <option value="thisMonth">هذا الشهر</option>
            </select>

            <select className={inputClass} value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="recent">الأحدث إضافة</option>
              <option value="mostBooked">الأكثر حجزاً</option>
              <option value="leastBooked">الأقل حجزاً</option>
            </select>

            <select className={inputClass} value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
              <option value="ALL">كل المجموعات</option>
              {patientGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>

            <select className={inputClass} value={bookingFilter} onChange={(event) => setBookingFilter(event.target.value)}>
              <option value="ALL">كل الحجوزات</option>
              <option value="hasBookings">لديهم حجوزات</option>
              <option value="noBookings">بدون حجوزات</option>
            </select>

            <select className={inputClass} value={contactFilter} onChange={(event) => setContactFilter(event.target.value)}>
              <option value="ALL">كل البيانات</option>
              <option value="hasEmail">لديهم بريد</option>
              <option value="noEmail">بدون بريد</option>
            </select>

            <SecondaryButton type="button" onClick={resetFilters}>
              <RotateCcw className="h-4 w-4" />
              إعادة ضبط
            </SecondaryButton>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="من إجمالي إنفاق">
              <input
                className={inputClass}
                type="number"
                min="0"
                value={minSpent}
                onChange={(event) => setMinSpent(event.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="إلى إجمالي إنفاق">
              <input
                className={inputClass}
                type="number"
                min="0"
                value={maxSpent}
                onChange={(event) => setMaxSpent(event.target.value)}
                placeholder="100000"
              />
            </Field>
            <div className="flex items-end">
              <StatusBadge tone="blue">واتساب فقط: {patients.length}</StatusBadge>
            </div>
            <div className="flex items-end">
              <StatusBadge tone="green">نتائج الفلترة: {filteredPatients.length}</StatusBadge>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <StatusBadge tone="amber">المحددون: {selectedIds.length}</StatusBadge>
            <SecondaryButton type="button" onClick={toggleAllFiltered}>
              {allFilteredSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              اختر الكل ({filteredPatients.length})
            </SecondaryButton>
          </div>

          {loading ? (
            <p className="text-slate-400">جارٍ التحميل...</p>
          ) : (
            <div className="grid max-h-[58vh] gap-3 overflow-auto md:grid-cols-2 xl:grid-cols-3">
              {filteredPatients.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => togglePatient(patient.id)}
                  className={`rounded-2xl border p-4 text-right transition ${
                    selectedIds.includes(patient.id)
                      ? 'border-sky-500/50 bg-sky-500/10'
                      : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-white">{patient.displayName || patient.name || 'مريض واتساب'}</h3>
                      <p className="mt-1 text-sm text-slate-400" dir="ltr">{patient.phone || '-'}</p>
                      {patient.email ? <p className="mt-1 text-xs text-slate-500">{patient.email}</p> : null}
                      <p className="mt-2 text-xs text-slate-400">
                        إجمالي الإنفاق: {Number(patient.totalSpent || 0).toLocaleString('ar-IQ')} د.ع
                      </p>
                    </div>
                    {selectedIds.includes(patient.id) ? (
                      <CheckSquare className="h-5 w-5 text-sky-300" />
                    ) : (
                      <Square className="h-5 w-5 text-slate-500" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <PrimaryButton type="button" onClick={() => setStep(1)} disabled={!selectedIds.length}>
              التالي
            </PrimaryButton>
          </div>
        </DataCard>
      ) : null}

      {step === 1 ? (
        <DataCard>
          <div className="grid gap-3 lg:grid-cols-3">
            {offerTemplates.map((template) => (
              <button
                key={template.name}
                type="button"
                onClick={() => setTemplateName(template.name)}
                className={`rounded-2xl border p-4 text-right transition ${
                  templateName === template.name
                    ? 'border-sky-500/50 bg-sky-500/10'
                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <h3 className="font-black text-white">{template.label}</h3>
                <p className="mt-1 text-xs text-slate-500" dir="ltr">{template.name}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{template.hint}</p>
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <Field label="نص العرض أو الرسالة">
                <textarea
                  className={`${inputClass} min-h-[220px]`}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="اكتب الرسالة هنا. يمكنك استخدام {{name}} و {{phone}}."
                />
              </Field>

              {selectedTemplate.needsImage ? (
                <Field label="صورة العرض">
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white">
                      <Upload className="h-4 w-4" />
                      {uploadingImage ? 'جارٍ الرفع...' : 'رفع صورة'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                      />
                    </label>
                    {imageUrl ? (
                      <SecondaryButton type="button" onClick={() => setImageUrl('')}>
                        حذف الصورة
                      </SecondaryButton>
                    ) : null}
                  </div>
                  {imageUrl ? (
                    <p className="mt-2 break-all text-xs text-slate-400" dir="ltr">{imageUrl}</p>
                  ) : null}
                </Field>
              ) : null}
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#0d1225] p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-sky-300">
                {selectedTemplate.needsImage ? <Image className="h-4 w-4" /> : null}
                معاينة واتساب
              </div>
              {selectedTemplate.needsImage && imageUrl ? (
                <div className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  <img src={imageUrl} alt="معاينة صورة العرض" className="max-h-48 w-full object-cover" />
                </div>
              ) : null}
              <p className="text-xs text-slate-500" dir="ltr">{templateName}</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white">
                مرحباً {previewName}
                {'\n\n'}
                {previewText || 'نص العرض سيظهر هنا'}
              </p>
            </div>
          </div>

          <div className="mt-5 flex justify-between gap-2">
            <SecondaryButton type="button" onClick={() => setStep(0)}>السابق</SecondaryButton>
            <PrimaryButton
              type="button"
              onClick={() => setStep(2)}
              disabled={!message.trim() || (selectedTemplate.needsImage && !imageUrl.trim())}
            >
              التالي
            </PrimaryButton>
          </div>
        </DataCard>
      ) : null}

      {step === 2 ? (
        <DataCard>
          <div className="space-y-4">
            <Info label="القالب" value={`${selectedTemplate.label} - ${templateName}`} />
            <Info label="عدد متلقي واتساب" value={selectedIds.length} />
            <Info label="الصورة" value={selectedTemplate.needsImage ? imageUrl : 'لا يوجد'} />
            <div className="rounded-2xl border border-white/10 bg-[#0d1225] p-4">
              <p className="mb-2 text-sm font-bold text-slate-300">{`نص المتغير {{2}}`}</p>
              <p className="whitespace-pre-wrap text-sm leading-7 text-white">{message}</p>
            </div>
          </div>
          <div className="mt-5 flex justify-between gap-2">
            <SecondaryButton type="button" onClick={() => setStep(1)}>السابق</SecondaryButton>
            <PrimaryButton type="button" onClick={sendOffers} disabled={sending}>
              <Send className="h-4 w-4" />
              {sending ? 'جارٍ الإرسال...' : 'إرسال واتساب'}
            </PrimaryButton>
          </div>
        </DataCard>
      ) : null}
    </AppLayout>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 break-words text-lg font-black text-white">{value || '-'}</p>
    </div>
  );
}


