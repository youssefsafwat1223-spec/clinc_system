import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Image, RotateCcw, Search, Send, Square, Upload } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { DataCard, Field, PageHeader, PrimaryButton, SecondaryButton, StatusBadge, inputClass } from '../components/ui';

const steps = ['ط§ط®طھظٹط§ط± ظ…ط±ط§ط¬ط¹ظٹ ظˆط§طھط³ط§ط¨', 'ط§ط®طھظٹط§ط± ط§ظ„ظ‚ط§ظ„ط¨ ظˆط§ظ„ط±ط³ط§ظ„ط©', 'ظ…ط±ط§ط¬ط¹ط© ظˆط¥ط±ط³ط§ظ„'];

const offerTemplates = [
  {
    name: 'clinic_custom_message_ar',
    label: 'ط±ط³ط§ظ„ط© ظ…ط®طµطµط© ظ…ط±ظ†ط©',
    hint: 'ط§ط³طھط®ط¯ظ…ظ‡ ظ„ط£ظٹ ط±ط³ط§ظ„ط© طھط³ظˆظٹظ‚ظٹط© ط¹ط§ظ…ط©. ط§ظ„ظ…طھط؛ظٹط± {{1}} ط§ط³ظ… ط§ظ„ظ…ط±ظٹط¶ ظˆ {{2}} ظ†طµ ط§ظ„ط±ط³ط§ظ„ط©.',
  },
  {
    name: 'clinic_offer_text_ar',
    label: 'ط¹ط±ط¶ ظ†طµظٹ',
    hint: 'ط§ط³طھط®ط¯ظ…ظ‡ ظ„ط¹ط±ظˆط¶ ط§ظ„ط®طµظ… ط§ظ„ظ†طµظٹط© ط¨ط¯ظˆظ† طµظˆط±ط©. ط§ظ„ظ…طھط؛ظٹط± {{1}} ط§ط³ظ… ط§ظ„ظ…ط±ظٹط¶ ظˆ {{2}} طھظپط§طµظٹظ„ ط§ظ„ط¹ط±ط¶.',
  },
  {
    name: 'clinic_offer_image_ar',
    label: 'ط¹ط±ط¶ ط¨طµظˆط±ط©',
    hint: 'ط§ط³طھط®ط¯ظ…ظ‡ ط¹ظ†ط¯ ظˆط¬ظˆط¯ طµظˆط±ط© ظپظٹ Header ط§ظ„ظ‚ط§ظ„ط¨. ط§ظ„ظ…طھط؛ظٹط± {{1}} ط§ط³ظ… ط§ظ„ظ…ط±ظٹط¶ ظˆ {{2}} طھظپط§طµظٹظ„ ط§ظ„ط¹ط±ط¶.',
    needsImage: true,
  },
];

export default function SendOffersPage() {
  const [step, setStep] = useState(0);
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('recent');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [bookingFilter, setBookingFilter] = useState('ALL');
  const [contactFilter, setContactFilter] = useState('ALL');
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
        toast.error(error.message || 'ظپط´ظ„ طھط­ظ…ظٹظ„ ظ…ط±ط§ط¬ط¹ظٹ ظˆط§طھط³ط§ط¨');
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
    return patients.filter((patient) => {
      const matchesSearch = !term || [patient.name, patient.displayName, patient.phone, patient.email]
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
        (patient.groups || []).some((membership) => (membership.groupId || membership.group?.id || membership.id) === groupFilter);

      return matchesSearch && matchesBookings && matchesContact && matchesGroup;
    });
  }, [patients, searchTerm, bookingFilter, contactFilter, groupFilter]);

  const allFilteredSelected = filteredPatients.length > 0 && filteredPatients.every((patient) => selectedIds.includes(patient.id));

  const togglePatient = (id) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const toggleAllFiltered = () => {
    const filteredIds = filteredPatients.map((patient) => patient.id);
    setSelectedIds((current) => {
      if (filteredIds.every((id) => current.includes(id))) return current.filter((id) => !filteredIds.includes(id));
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
  };

  const sendOffers = async () => {
    if (!selectedIds.length) return toast.warn('ط§ط®طھط± ظ…ط±ط§ط¬ط¹ظٹظ† ظ…ظ† ظˆط§طھط³ط§ط¨ ط£ظˆظ„ط§ظ‹');
    if (!message.trim()) return toast.warn('ط§ظƒطھط¨ ظ†طµ ط§ظ„ط¹ط±ط¶ ط£ظˆظ„ط§ظ‹');
    if (selectedTemplate.needsImage && !imageUrl.trim()) return toast.warn('ط±ط§ط¨ط· ط§ظ„طµظˆط±ط© ظ…ط·ظ„ظˆط¨ ظ„ظ‚ط§ظ„ط¨ ط§ظ„ط¹ط±ط¶ ط¨طµظˆط±ط©');

    setSending(true);
    try {
      const res = await api.post('/campaigns/send-offers', {
        reviewerIds: selectedIds,
        templateName,
        message,
        imageUrl: imageUrl.trim() || undefined,
      });
      toast.success(`طھظ… ط§ظ„ط¥ط±ط³ط§ظ„: ظ†ط¬ط­ ${res.data.successCount || 0}طŒ ظپط´ظ„ ${res.data.failCount || 0}`);
      setStep(0);
      setSelectedIds([]);
      setMessage('');
      setImageUrl('');
    } catch (error) {
      toast.error(error.message || 'ظپط´ظ„ ط¥ط±ط³ط§ظ„ ط§ظ„ط¹ط±ظˆط¶');
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
      toast.success('طھظ… ط±ظپط¹ طµظˆط±ط© ط§ظ„ط¹ط±ط¶');
    } catch (error) {
      toast.error(error.message || 'ظپط´ظ„ ط±ظپط¹ طµظˆط±ط© ط§ظ„ط¹ط±ط¶');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const previewName = 'ط§ط³ظ… ط§ظ„ظ…ط±ظٹط¶';
  const previewText = message.replace(/\{\{name\}\}/g, previewName).replace(/\{\{phone\}\}/g, '964xxxxxxxxx');

  return (
    <AppLayout>
      <PageHeader
        title="ط¥ط±ط³ط§ظ„ ط¹ط±ظˆط¶ ظˆط§طھط³ط§ط¨"
        description="ظ‡ط°ظ‡ ط§ظ„طµظپط­ط© طھط±ط³ظ„ ظپظ‚ط· ظ„ظ…ط±ط§ط¬ط¹ظٹ ظˆط§طھط³ط§ط¨طŒ ظˆطھط³طھط®ط¯ظ… ظ‚ظˆط§ظ„ط¨ Meta ط§ظ„ظ…ط¹طھظ…ط¯ط©: ط±ط³ط§ظ„ط© ظ…ط®طµطµط©طŒ ط¹ط±ط¶ ظ†طµظٹطŒ ط£ظˆ ط¹ط±ط¶ ط¨طµظˆط±ط©."
      />

      <DataCard className="mb-6">
        <div className="flex flex-wrap gap-2">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                step === index ? 'bg-sky-500 text-white' : index < step ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-slate-300'
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
            ظ„ظ† طھط¸ظ‡ط± ظ‡ظ†ط§ ظ…ط­ط§ط¯ط«ط§طھ Instagram ط£ظˆ Facebook. ط§ظ„ط¹ط±ظˆط¶ ظپظٹ ظ‡ط°ظ‡ ط§ظ„طµظپط­ط© ظ…ط®طµطµط© ظ„ط¥ط±ط³ط§ظ„ WhatsApp Templates ظپظ‚ط·.
          </div>

          <div className="mb-4 grid gap-3 xl:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className={`${inputClass} pr-10`}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ط¨ط­ط« ط¨ط§ظ„ط§ط³ظ… ط£ظˆ ط§ظ„ظ‡ط§طھظپ ط£ظˆ ط§ظ„ط¨ط±ظٹط¯"
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
                <option key={group.id} value={group.id}>{group.name}</option>
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

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="blue">واتساب فقط: {patients.length}</StatusBadge>
              <StatusBadge tone="green">نتائج الفلترة: {filteredPatients.length}</StatusBadge>
              <StatusBadge tone="amber">المحددون: {selectedIds.length}</StatusBadge>
            </div>
            <SecondaryButton type="button" onClick={toggleAllFiltered}>
              {allFilteredSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              ط§ط®طھط± ط§ظ„ظƒظ„ ({filteredPatients.length})
            </SecondaryButton>
          </div>

          {loading ? (
            <p className="text-slate-400">ط¬ط§ط±ظٹ ط§ظ„طھط­ظ…ظٹظ„...</p>
          ) : (
            <div className="grid max-h-[58vh] gap-3 overflow-auto md:grid-cols-2 xl:grid-cols-3">
              {filteredPatients.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => togglePatient(patient.id)}
                  className={`rounded-2xl border p-4 text-right transition ${
                    selectedIds.includes(patient.id) ? 'border-sky-500/50 bg-sky-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-white">{patient.displayName || patient.name || 'ظ…ط±ط§ط¬ط¹ ظˆط§طھط³ط§ط¨'}</h3>
                      <p className="mt-1 text-sm text-slate-400" dir="ltr">{patient.phone || '-'}</p>
                      {patient.email ? <p className="mt-1 text-xs text-slate-500">{patient.email}</p> : null}
                    </div>
                    {selectedIds.includes(patient.id) ? <CheckSquare className="h-5 w-5 text-sky-300" /> : <Square className="h-5 w-5 text-slate-500" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 flex justify-between gap-2">
            <StatusBadge tone="blue">ط§ظ„ظ…ط­ط¯ط¯ظˆظ†: {selectedIds.length}</StatusBadge>
            <PrimaryButton type="button" onClick={() => setStep(1)} disabled={!selectedIds.length}>ط§ظ„طھط§ظ„ظٹ</PrimaryButton>
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
                  templateName === template.name ? 'border-sky-500/50 bg-sky-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
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
              <Field label="ظ†طµ ط§ظ„ط¹ط±ط¶ ط£ظˆ ط§ظ„ط±ط³ط§ظ„ط©">
                <textarea
                  className={`${inputClass} min-h-[220px]`}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="ط§ظƒطھط¨ ظ†طµ ط§ظ„ط¹ط±ط¶ ظ‡ظ†ط§. ظٹظ…ظƒظ† ط§ط³طھط®ط¯ط§ظ… {{name}} ظˆ {{phone}} ط¯ط§ط®ظ„ ط§ظ„ظ†طµ."
                />
              </Field>
              {selectedTemplate.needsImage ? (
                <Field label="صورة العرض">
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white">
                      <Upload className="h-4 w-4" />
                      {uploadingImage ? 'جاري الرفع...' : 'رفع صورة'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                    </label>
                    {imageUrl ? <SecondaryButton type="button" onClick={() => setImageUrl('')}>حذف الصورة</SecondaryButton> : null}
                  </div>
                  {imageUrl ? <p className="mt-2 break-all text-xs text-slate-400" dir="ltr">{imageUrl}</p> : null}
                </Field>
              ) : null}
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#0d1225] p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-sky-300">
                {selectedTemplate.needsImage ? <Image className="h-4 w-4" /> : null}
                ظ…ط¹ط§ظٹظ†ط© ظˆط§طھط³ط§ط¨
              </div>
              {selectedTemplate.needsImage && imageUrl ? (
                <div className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  <img src={imageUrl} alt="ظ…ط¹ط§ظٹظ†ط© طµظˆط±ط© ط§ظ„ط¹ط±ط¶" className="max-h-48 w-full object-cover" />
                </div>
              ) : null}
              <p className="text-xs text-slate-500" dir="ltr">{templateName}</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white">ظ…ط±ط­ط¨ط§ظ‹ {previewName}{'\n\n'}{previewText || 'ظ†طµ ط§ظ„ط¹ط±ط¶ ط³ظٹط¸ظ‡ط± ظ‡ظ†ط§'}</p>
            </div>
          </div>

          <div className="mt-5 flex justify-between gap-2">
            <SecondaryButton type="button" onClick={() => setStep(0)}>ط§ظ„ط³ط§ط¨ظ‚</SecondaryButton>
            <PrimaryButton type="button" onClick={() => setStep(2)} disabled={!message.trim() || (selectedTemplate.needsImage && !imageUrl.trim())}>ط§ظ„طھط§ظ„ظٹ</PrimaryButton>
          </div>
        </DataCard>
      ) : null}

      {step === 2 ? (
        <DataCard>
          <div className="space-y-4">
            <Info label="ط§ظ„ظ‚ط§ظ„ط¨" value={`${selectedTemplate.label} - ${templateName}`} />
            <Info label="ط¹ط¯ط¯ ظ…طھظ„ظ‚ظٹ ظˆط§طھط³ط§ط¨" value={selectedIds.length} />
            <Info label="ط§ظ„طµظˆط±ط©" value={selectedTemplate.needsImage ? imageUrl : 'ظ„ط§ ظٹظˆط¬ط¯'} />
            <div className="rounded-2xl border border-white/10 bg-[#0d1225] p-4">
              <p className="mb-2 text-sm font-bold text-slate-300">ظ†طµ ط§ظ„ظ…طھط؛ظٹط± {'{{2}}'}</p>
              <p className="whitespace-pre-wrap text-sm leading-7 text-white">{message}</p>
            </div>
          </div>
          <div className="mt-5 flex justify-between gap-2">
            <SecondaryButton type="button" onClick={() => setStep(1)}>ط§ظ„ط³ط§ط¨ظ‚</SecondaryButton>
            <PrimaryButton type="button" onClick={sendOffers} disabled={sending}>
              <Send className="h-4 w-4" />
              {sending ? 'ط¬ط§ط±ظٹ ط§ظ„ط¥ط±ط³ط§ظ„...' : 'ط¥ط±ط³ط§ظ„ ظˆط§طھط³ط§ط¨'}
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

