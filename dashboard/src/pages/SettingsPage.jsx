import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Save, Settings, Trash2, Upload } from 'lucide-react';
import { toast } from 'react-toastify';
import AppLayout from '../components/Layout';
import api from '../api/client';
import { DataCard, Field, PageHeader, PrimaryButton, SecondaryButton, StatCard, StatusBadge, inputClass } from '../components/ui';

const daysAr = {
  sunday: 'ط§ظ„ط£ط­ط¯',
  monday: 'ط§ظ„ط¥ط«ظ†ظٹظ†',
  tuesday: 'ط§ظ„ط«ظ„ط§ط«ط§ط،',
  wednesday: 'ط§ظ„ط£ط±ط¨ط¹ط§ط،',
  thursday: 'ط§ظ„ط®ظ…ظٹط³',
  friday: 'ط§ظ„ط¬ظ…ط¹ط©',
  saturday: 'ط§ظ„ط³ط¨طھ',
};

const emptyContactForm = { name: '', phone: '', description: '', active: true };
const emptyDiscountForm = {
  name: '',
  type: 'PERCENT',
  value: '',
  targetMode: 'ALL',
  serviceId: '',
  startsAt: '',
  endsAt: '',
  phoneNumbers: '',
  active: true,
};

const discountPatientPeriods = [
  { value: '', label: 'ظƒظ„ ط§ظ„ظ…ط±ط¶ظ‰' },
  { value: 'last7', label: 'ظ…ط±ط¶ظ‰ ط¢ط®ط± ط£ط³ط¨ظˆط¹' },
  { value: 'last30', label: 'ظ…ط±ط¶ظ‰ ط¢ط®ط± ط´ظ‡ط±' },
  { value: 'thisMonth', label: 'ظ…ط±ط¶ظ‰ ظ‡ط°ط§ ط§ظ„ط´ظ‡ط±' },
];

const discountPatientSortOptions = [
  { value: 'createdAt', label: 'ط§ظ„ط£ط­ط¯ط« ط¥ط¶ط§ظپط©' },
  { value: 'mostBooked', label: 'ط§ظ„ط£ظƒط«ط± ط­ط¬ط²ط§ظ‹' },
  { value: 'leastBooked', label: 'ط§ظ„ط£ظ‚ظ„ ط­ط¬ط²ط§ظ‹' },
];

function formatDate(value) {
  if (!value) return 'ط¨ط¯ظˆظ† طھط§ط±ظٹط®';
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(value));
}

function discountValue(discount) {
  return discount.type === 'FIXED' ? `${Number(discount.value || 0).toLocaleString('ar-IQ')} ط¯.ط¹` : `${Number(discount.value || 0).toLocaleString('ar-IQ')}%`;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('clinic');
  const [settings, setSettings] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [services, setServices] = useState([]);
  const [discountPatients, setDiscountPatients] = useState([]);
  const [discountPatientSearch, setDiscountPatientSearch] = useState('');
  const [discountPatientPeriod, setDiscountPatientPeriod] = useState('');
  const [discountPatientSort, setDiscountPatientSort] = useState('createdAt');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contactForm, setContactForm] = useState(emptyContactForm);
  const [discountForm, setDiscountForm] = useState(emptyDiscountForm);
  const promoImageInputRef = useRef(null);

  const activeWorkingDays = useMemo(() => Object.values(settings?.workingHours || {}).filter(Boolean).length, [settings]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsRes, contactsRes, discountsRes, servicesRes] = await Promise.all([
        api.get('/settings'),
        api.get('/contacts').catch(() => ({ data: { contacts: [] } })),
        api.get('/discounts').catch(() => ({ data: { discounts: [] } })),
        api.get('/services').catch(() => ({ data: { services: [] } })),
      ]);
      setSettings(settingsRes.data.settings);
      setContacts(contactsRes.data.contacts || []);
      setDiscounts(discountsRes.data.discounts || []);
      setServices(servicesRes.data.services || []);
      await loadDiscountPatients();
    } catch (error) {
      toast.error('ظپط´ظ„ طھط­ظ…ظٹظ„ ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ');
    } finally {
      setLoading(false);
    }
  };

  const loadDiscountPatients = async (overrides = {}) => {
    const search = overrides.search ?? discountPatientSearch;
    const period = overrides.period ?? discountPatientPeriod;
    const sortBy = overrides.sortBy ?? discountPatientSort;
    try {
      const res = await api.get('/patients', {
        params: {
          limit: 500,
          search: search || undefined,
          period: period || undefined,
          sortBy: sortBy || undefined,
        },
      });
      setDiscountPatients((res.data.patients || []).filter((patient) => patient.platform === 'WHATSAPP' && patient.phone));
    } catch (error) {
      toast.error('ظپط´ظ„ طھط­ظ…ظٹظ„ ط§ظ„ظ…ط±ط¶ظ‰ ظ„ط§ط®طھظٹط§ط± ط§ظ„ط®طµظ…');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateField = (field, value) => {
    setSettings((current) => ({ ...current, [field]: value }));
  };

  const updateWorkingHours = (day, field, value) => {
    setSettings((current) => ({
      ...current,
      workingHours: {
        ...(current?.workingHours || {}),
        [day]: {
          ...(current?.workingHours?.[day] || { start: '09:00', end: '17:00' }),
          [field]: value,
        },
      },
    }));
  };

  const toggleDay = (day) => {
    setSettings((current) => {
      const value = current?.workingHours?.[day];
      return {
        ...current,
        workingHours: {
          ...(current?.workingHours || {}),
          [day]: value ? null : { start: '09:00', end: '17:00' },
        },
      };
    });
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/settings', settings);
      toast.success('طھظ… ط­ظپط¸ ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ');
    } catch (error) {
      toast.error(error.response?.data?.error || 'ظپط´ظ„ ط­ظپط¸ ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ');
    } finally {
      setSaving(false);
    }
  };

  const saveContact = async () => {
    if (!contactForm.name.trim() || !contactForm.phone.trim()) {
      toast.warn('ط§ظƒطھط¨ ط§ط³ظ… ط¬ظ‡ط© ط§ظ„ط§طھطµط§ظ„ ظˆط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ');
      return;
    }
    try {
      const res = await api.post('/contacts', contactForm);
      setContacts((current) => [res.data.contact, ...current]);
      setContactForm(emptyContactForm);
      toast.success('طھظ…طھ ط¥ط¶ط§ظپط© ط¬ظ‡ط© ط§ظ„ط§طھطµط§ظ„');
    } catch (error) {
      toast.error(error.response?.data?.error || 'ظپط´ظ„ ط­ظپط¸ ط¬ظ‡ط© ط§ظ„ط§طھطµط§ظ„');
    }
  };

  const uploadPromoImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await api.post('/upload/campaign-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateField('logoUrl', res.data.url);
      toast.success('تم رفع صورة العرض');
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل رفع صورة العرض');
    }
  };



  const removeContact = async (contact) => {
    if (!window.confirm(`ط­ط°ظپ ط¬ظ‡ط© ط§ظ„ط§طھطµط§ظ„ "${contact.name}"طں`)) return;
    try {
      await api.delete(`/contacts/${contact.id}`);
      setContacts((current) => current.filter((item) => item.id !== contact.id));
      toast.success('طھظ… ط­ط°ظپ ط¬ظ‡ط© ط§ظ„ط§طھطµط§ظ„');
    } catch (error) {
      toast.error(error.response?.data?.error || 'ظپط´ظ„ ط­ط°ظپ ط¬ظ‡ط© ط§ظ„ط§طھطµط§ظ„');
    }
  };

  const saveDiscount = async () => {
    if (!discountForm.name.trim() || !discountForm.value) {
      toast.warn('ط§ظƒطھط¨ ط§ط³ظ… ط§ظ„ط®طµظ… ظˆظ‚ظٹظ…طھظ‡');
      return;
    }

    const service = services.find((item) => item.id === discountForm.serviceId);
    const filteredPhones = discountPatients.map((patient) => patient.phone).filter(Boolean);
    if (discountForm.targetMode === 'FILTERED' && filteredPhones.length === 0) {
      toast.warn('ظ„ط§ ظٹظˆط¬ط¯ ظ…ط±ط¶ظ‰ ظ…ط·ط§ط¨ظ‚ظٹظ† ظ„ظ„ظپظ„ط§طھط± ط§ظ„ط­ط§ظ„ظٹط©');
      return;
    }
    try {
      const res = await api.post('/discounts', {
        ...discountForm,
        value: Number(discountForm.value),
        serviceName: service?.nameAr || service?.name || null,
        phoneNumbers:
          discountForm.targetMode === 'ALL'
            ? []
            : discountForm.targetMode === 'FILTERED'
              ? filteredPhones
            : discountForm.phoneNumbers
                .split(/[\n,طŒ]+/)
                .map((item) => item.trim())
                .filter(Boolean),
      });
      setDiscounts((current) => [res.data.discount, ...current]);
      setDiscountForm(emptyDiscountForm);
      toast.success('طھظ… ط­ظپط¸ ط§ظ„ط®طµظ…');
    } catch (error) {
      toast.error(error.response?.data?.error || 'ظپط´ظ„ ط­ظپط¸ ط§ظ„ط®طµظ…');
    }
  };

  const removeDiscount = async (discount) => {
    if (!window.confirm(`ط­ط°ظپ ط®طµظ… "${discount.name}"طں`)) return;
    try {
      await api.delete(`/discounts/${discount.id}`);
      setDiscounts((current) => current.filter((item) => item.id !== discount.id));
      toast.success('طھظ… ط­ط°ظپ ط§ظ„ط®طµظ…');
    } catch (error) {
      toast.error(error.response?.data?.error || 'ظپط´ظ„ ط­ط°ظپ ط§ظ„ط®طµظ…');
    }
  };

  const tabs = [
    { id: 'clinic', label: 'ط¨ظٹط§ظ†ط§طھ ط§ظ„ط¹ظٹط§ط¯ط©' },
    { id: 'hours', label: 'ط³ط§ط¹ط§طھ ط§ظ„ط¹ظ…ظ„' },
    { id: 'contacts', label: 'ط¬ظ‡ط§طھ ط§ظ„ط§طھطµط§ظ„' },
    { id: 'discounts', label: 'ط§ظ„ط®طµظˆظ…ط§طھ' },
  ];

  if (loading) {
    return (
      <AppLayout>
        <DataCard className="text-center text-slate-300">ط¬ط§ط±ظٹ طھط­ظ…ظٹظ„ ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ...</DataCard>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ"
        description="ط¥ط¯ط§ط±ط© ط¨ظٹط§ظ†ط§طھ ط§ظ„ط¹ظٹط§ط¯ط© ظˆط§ظ„ط¨ط±ط§ظ†ط¯ ظˆط¬ظ‡ط§طھ ط§ظ„ط§طھطµط§ظ„ ظˆط§ظ„ط®طµظˆظ…ط§طھ."
        actions={
          <PrimaryButton type="button" onClick={saveSettings} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? 'ط¬ط§ط±ظٹ ط§ظ„ط­ظپط¸...' : 'ط­ظپط¸ ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ'}
          </PrimaryButton>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard title="ط£ظٹط§ظ… ط§ظ„ط¹ظ…ظ„" value={activeWorkingDays} icon={Settings} tone="blue" />
        <StatCard title="ط¬ظ‡ط§طھ ط§ظ„ط§طھطµط§ظ„" value={contacts.length} icon={Plus} tone="green" />
        <StatCard title="ط§ظ„ط®طµظˆظ…ط§طھ" value={discounts.length} icon={Save} tone="amber" />
        <StatCard title="ط§ط³ظ… ط§ظ„ط¨ظˆطھ" value={settings?.botName ? 'ظ…ط­ط¯ط¯' : 'ط؛ظٹط± ظ…ط­ط¯ط¯'} icon={Settings} tone="slate" />
      </div>

      <DataCard className="mb-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === tab.id
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                  : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </DataCard>

      {activeTab === 'clinic' ? (
        <DataCard>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="ط§ط³ظ… ط§ظ„ط¹ظٹط§ط¯ط© ط¨ط§ظ„ط¹ط±ط¨ظٹط©">
              <input className={inputClass} value={settings?.clinicNameAr || ''} onChange={(event) => updateField('clinicNameAr', event.target.value)} />
            </Field>
            <Field label="ط§ط³ظ… ط§ظ„ط¹ظٹط§ط¯ط© ط¨ط§ظ„ط¥ظ†ط¬ظ„ظٹط²ظٹط©">
              <input className={inputClass} dir="ltr" value={settings?.clinicName || ''} onChange={(event) => updateField('clinicName', event.target.value)} />
            </Field>
            <Field label="ط§ط³ظ… ط§ظ„ط¨ظˆطھ ط§ظ„ط¸ط§ظ‡ط± ظپظٹ ط§ظ„ط±ط³ط§ط¦ظ„">
              <input className={inputClass} value={settings?.botName || ''} onChange={(event) => updateField('botName', event.target.value)} placeholder="ظ…ط«ط§ظ„: ط¹ظٹط§ط¯ط© ط¯. ط¥ط¨ط±ط§ظ‡ظٹظ…" />
            </Field>
            <Field label="ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ">
              <input className={inputClass} value={settings?.phone || ''} onChange={(event) => updateField('phone', event.target.value)} />
            </Field>
            <Field label="ط±ط§ط¨ط· ط´ط¹ط§ط± ط§ظ„ط±ظˆط´طھط©">
              <input className={inputClass} dir="ltr" value={settings?.brandLogoUrl || settings?.logoUrl || ''} onChange={(event) => updateField('brandLogoUrl', event.target.value)} placeholder="/api/images/logo.png" />
            </Field>
            <Field label="طµظˆط±ط© ط§ظ„ط¹ط±ط¶ ط§ظ„ط­ط§ظ„ظٹ">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input className={inputClass} dir="ltr" value={settings?.logoUrl || ''} onChange={(event) => updateField('logoUrl', event.target.value)} placeholder="/api/images/promo.jpg" />
                  <SecondaryButton type="button" onClick={() => promoImageInputRef.current?.click()} className="shrink-0">
                    <Upload className="h-4 w-4" />
                    ط±ظپط¹
                  </SecondaryButton>
                  <input ref={promoImageInputRef} type="file" accept="image/*" className="hidden" onChange={uploadPromoImage} />
                </div>
                {settings?.logoUrl ? (
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1225]">
                    <img src={settings.logoUrl} alt="Promo" className="h-36 w-full object-cover" />
                  </div>
                ) : null}
              </div>
            </Field>
            <Field label="ظ„ظˆظ† ط§ظ„ط¨ط±ط§ظ†ط¯ ط§ظ„ط£ط³ط§ط³ظٹ">
              <input className={inputClass} value={settings?.brandPrimaryColor || ''} onChange={(event) => updateField('brandPrimaryColor', event.target.value)} placeholder="#2563eb" />
            </Field>
            <Field label="ط§ظ„ط¹ظ†ظˆط§ظ†">
              <input className={inputClass} value={settings?.address || ''} onChange={(event) => updateField('address', event.target.value)} />
            </Field>
            <Field label="ط±ط§ط¨ط· ظˆط§طھط³ط§ط¨ ظ…ط¨ط§ط´ط±">
              <input className={inputClass} dir="ltr" value={settings?.whatsappChatLink || ''} onChange={(event) => updateField('whatsappChatLink', event.target.value)} />
            </Field>
          </div>
        </DataCard>
      ) : null}

      {activeTab === 'hours' ? (
        <DataCard>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(daysAr).map(([key, label]) => {
              const day = settings?.workingHours?.[key];
              return (
                <div key={key} className="rounded-2xl border border-white/10 bg-[#0d1225] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-black text-white">{label}</h3>
                    <button
                      type="button"
                      onClick={() => toggleDay(key)}
                      className={`rounded-full px-3 py-1 text-xs font-bold ${day ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-slate-400'}`}
                    >
                      {day ? 'ظٹط¹ظ…ظ„' : 'ط¥ط¬ط§ط²ط©'}
                    </button>
                  </div>
                  {day ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="ظ…ظ†">
                        <input className={inputClass} type="time" value={day.start || '09:00'} onChange={(event) => updateWorkingHours(key, 'start', event.target.value)} />
                      </Field>
                      <Field label="ط¥ظ„ظ‰">
                        <input className={inputClass} type="time" value={day.end || '17:00'} onChange={(event) => updateWorkingHours(key, 'end', event.target.value)} />
                      </Field>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </DataCard>
      ) : null}

      {activeTab === 'contacts' ? (
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <DataCard>
            <h2 className="mb-4 text-lg font-black text-white">ط¥ط¶ط§ظپط© ط¬ظ‡ط© ط§طھطµط§ظ„</h2>
            <div className="space-y-4">
              <Field label="ط§ظ„ط§ط³ظ…">
                <input className={inputClass} value={contactForm.name} onChange={(event) => setContactForm((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label="ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ">
                <input className={inputClass} value={contactForm.phone} onChange={(event) => setContactForm((current) => ({ ...current, phone: event.target.value }))} />
              </Field>
              <Field label="ط§ظ„ظˆطµظپ">
                <input className={inputClass} value={contactForm.description} onChange={(event) => setContactForm((current) => ({ ...current, description: event.target.value }))} />
              </Field>
              <PrimaryButton type="button" onClick={saveContact}>ط¥ط¶ط§ظپط©</PrimaryButton>
            </div>
          </DataCard>

          <div className="grid gap-4">
            {contacts.length === 0 ? (
              <DataCard className="text-center text-slate-400">ظ„ط§ طھظˆط¬ط¯ ط¬ظ‡ط§طھ ط§طھطµط§ظ„ ظ…ط­ظپظˆط¸ط©.</DataCard>
            ) : (
              contacts.map((contact) => (
                <DataCard key={contact.id}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-black text-white">{contact.name}</h3>
                      <p className="mt-1 text-sm text-slate-400" dir="ltr">{contact.phone}</p>
                      {contact.description ? <p className="mt-2 text-sm text-slate-300">{contact.description}</p> : null}
                    </div>
                    <SecondaryButton type="button" onClick={() => removeContact(contact)} className="hover:bg-rose-500/10 hover:text-rose-200">
                      <Trash2 className="h-4 w-4" />
                      ط­ط°ظپ
                    </SecondaryButton>
                  </div>
                </DataCard>
              ))
            )}
          </div>
        </div>
      ) : null}

      {activeTab === 'discounts' ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <DataCard>
            <h2 className="mb-2 text-lg font-black text-white">ط¥ط¶ط§ظپط© ط®طµظ…</h2>
            <p className="mb-5 text-sm leading-6 text-slate-400">
              ط§ط®طھط± ظƒظ„ ط§ظ„ظ…ط±ط¶ظ‰ ط£ظˆ ط£ط±ظ‚ط§ظ… ظ…ط­ط¯ط¯ط©. ط¹ظ†ط¯ ط§ظ„ط­ط¬ط² ظ„ط§ط­ظ‚ط§ظ‹ ظٹط¸ظ‡ط± ط§ظ„ط®طµظ… ظپظٹ ط§ظ„ظ…ط¯ظپظˆط¹ط§طھ ظˆط±ط¯ظˆط¯ ط§ظ„ط£ط³ط¹ط§ط± ط¹ظ„ظ‰ ظˆط§طھط³ط§ط¨.
            </p>
            <div className="mb-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-7 text-amber-100">
              ظ„ظˆ ظ‡طھط¹ظ…ظ„ ط®طµظ… ط¹ط§ظ… ط¬ط¯ظٹط¯ ط¹ظ„ظ‰ ظ†ظپط³ ط§ظ„ط®ط¯ظ…ط©طŒ ط§ط­ط°ظپ ط§ظ„ط®طµظ… ط§ظ„ظ‚ط¯ظٹظ… ط§ظ„ط£ظˆظ„ ظ…ظ† ظ‚ط§ط¦ظ…ط© ط§ظ„ط®طµظˆظ…ط§طھ ط§ظ„ط­ط§ظ„ظٹط© ط­طھظ‰ ظ„ط§ طھطھط¯ط§ط®ظ„ ط§ظ„ط®طµظˆظ…ط§طھ. ط§ظ„ظ†ط¸ط§ظ… ظٹط®طھط§ط± ط£ط¹ظ„ظ‰ ط®طµظ… ظ…ظ†ط§ط³ط¨طŒ ظ„ظƒظ† ط­ط°ظپ ط§ظ„ظ‚ط¯ظٹظ… ط£ظˆط¶ط­ ظ„ظ„ط¥ط¯ط§ط±ط© ظˆط§ظ„ط­ط³ط§ط¨ط§طھ.
            </div>
            <div className="space-y-4">
              <Field label="ط§ط³ظ… ط§ظ„ط®طµظ…">
                <input className={inputClass} value={discountForm.name} onChange={(event) => setDiscountForm((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="ظ†ظˆط¹ ط§ظ„ط®طµظ…">
                  <select className={inputClass} value={discountForm.type} onChange={(event) => setDiscountForm((current) => ({ ...current, type: event.target.value }))}>
                    <option value="PERCENT">ظ†ط³ط¨ط© ظ…ط¦ظˆظٹط©</option>
                    <option value="FIXED">ظ…ط¨ظ„ط؛ ط«ط§ط¨طھ</option>
                  </select>
                </Field>
                <Field label="ط§ظ„ظ‚ظٹظ…ط©">
                  <input className={inputClass} type="number" min="0" value={discountForm.value} onChange={(event) => setDiscountForm((current) => ({ ...current, value: event.target.value }))} />
                </Field>
              </div>
              <Field label="ط§ظ„ط®ط¯ظ…ط© ط§ظ„ظ…ط³طھظ‡ط¯ظپط©">
                <select className={inputClass} value={discountForm.serviceId} onChange={(event) => setDiscountForm((current) => ({ ...current, serviceId: event.target.value }))}>
                  <option value="">ظƒظ„ ط§ظ„ط®ط¯ظ…ط§طھ</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>{service.nameAr || service.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="ط§ظ„ظ…ط³طھظپظٹط¯ظٹظ† ظ…ظ† ط§ظ„ط®طµظ…">
                <select className={inputClass} value={discountForm.targetMode} onChange={(event) => setDiscountForm((current) => ({ ...current, targetMode: event.target.value }))}>
                  <option value="ALL">ظƒظ„ ط§ظ„ظ…ط±ط¶ظ‰ ط§ظ„ط­ط§ظ„ظٹظٹظ† ظˆط§ظ„ط¬ط¯ط¯</option>
                  <option value="FILTERED">ظ…ط±ط¶ظ‰ ط­ط³ط¨ ط§ظ„ظپظ„ط§طھط±</option>
                  <option value="PHONES">ط£ط±ظ‚ط§ظ… ظ…ط­ط¯ط¯ط© ظپظ‚ط·</option>
                </select>
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="ظٹط¨ط¯ط£ ظ…ظ†">
                  <input className={inputClass} type="date" value={discountForm.startsAt} onChange={(event) => setDiscountForm((current) => ({ ...current, startsAt: event.target.value }))} />
                </Field>
                <Field label="ظٹظ†طھظ‡ظٹ ظپظٹ">
                  <input className={inputClass} type="date" value={discountForm.endsAt} onChange={(event) => setDiscountForm((current) => ({ ...current, endsAt: event.target.value }))} />
                </Field>
              </div>
              {discountForm.targetMode === 'FILTERED' ? (
                <div className="space-y-3 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="ط¨ط­ط«">
                      <input
                        className={inputClass}
                        value={discountPatientSearch}
                        onChange={(event) => setDiscountPatientSearch(event.target.value)}
                        placeholder="ط§ط³ظ… ط£ظˆ ط±ظ‚ظ… ط§ظ„ظ…ط±ظٹط¶"
                      />
                    </Field>
                    <Field label="ط§ظ„ظپطھط±ط©">
                      <select className={inputClass} value={discountPatientPeriod} onChange={(event) => setDiscountPatientPeriod(event.target.value)}>
                        {discountPatientPeriods.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="ط§ظ„طھط±طھظٹط¨">
                      <select className={inputClass} value={discountPatientSort} onChange={(event) => setDiscountPatientSort(event.target.value)}>
                        {discountPatientSortOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-bold text-sky-100">ط³ظٹطھظ… طھط·ط¨ظٹظ‚ ط§ظ„ط®طµظ… ط¹ظ„ظ‰ {discountPatients.length} ظ…ط±ظٹط¶ ظ…ط·ط§ط¨ظ‚ ظ„ظ„ظپظ„ط§طھط±.</p>
                    <SecondaryButton
                      type="button"
                      onClick={() => loadDiscountPatients({ search: discountPatientSearch, period: discountPatientPeriod, sortBy: discountPatientSort })}
                    >
                      طھط·ط¨ظٹظ‚ ط§ظ„ظپظ„ط§طھط±
                    </SecondaryButton>
                  </div>
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-black/10 p-3 text-sm text-slate-200">
                    {discountPatients.length === 0 ? (
                      <p className="text-slate-400">ظ„ط§ ظٹظˆط¬ط¯ ظ…ط±ط¶ظ‰ ظ…ط·ط§ط¨ظ‚ظٹظ† ط­ط§ظ„ظٹط§ظ‹.</p>
                    ) : (
                      <div className="grid gap-2">
                        {discountPatients.slice(0, 40).map((patient) => (
                          <div key={patient.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
                            <span className="font-bold text-white">{patient.displayName || patient.name || 'ظ…ط±ظٹط¶'}</span>
                            <span dir="ltr" className="text-slate-300">{patient.phone}</span>
                          </div>
                        ))}
                        {discountPatients.length > 40 ? <p className="text-xs text-slate-400">ظˆ {discountPatients.length - 40} ظ…ط±ظٹط¶ ط¢ط®ط±...</p> : null}
                      </div>
                    )}
                  </div>
                </div>
              ) : discountForm.targetMode === 'PHONES' ? (
                <Field label="ط£ط±ظ‚ط§ظ… ط§ظ„ظ…ط±ط¶ظ‰">
                  <textarea
                    className={`${inputClass} min-h-32`}
                    value={discountForm.phoneNumbers}
                    onChange={(event) => setDiscountForm((current) => ({ ...current, phoneNumbers: event.target.value }))}
                    placeholder="ط±ظ‚ظ… ظپظٹ ظƒظ„ ط³ط·ط± ط£ظˆ ط§ظپطµظ„ ط¨ظپط§طµظ„ط©"
                    dir="ltr"
                  />
                </Field>
              ) : (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-7 text-emerald-100">
                  ط§ط®طھظٹط§ط± ظƒظ„ ط§ظ„ظ…ط±ط¶ظ‰ ظٹط¹ظ†ظٹ ط£ظ† ط§ظ„ط®طµظ… ط³ظٹط·ط¨ظ‚ ط¹ظ„ظ‰ ط£ظٹ ظ…ط±ظٹط¶ ظ…ظˆط¬ظˆط¯ ط­ط§ظ„ظٹط§ظ‹طŒ ظˆط£ظٹ ظ…ط±ظٹط¶ ط¬ط¯ظٹط¯ ظٹطھظƒظ„ظ… ط¹ظ„ظ‰ ظˆط§طھط³ط§ط¨ ط£ظˆ ظٹطھظ… ط¥ط¶ط§ظپطھظ‡ ظ„ط§ط­ظ‚ط§ظ‹.
                </div>
              )}
              <label className="flex items-center gap-2 text-sm font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={discountForm.active}
                  onChange={(event) => setDiscountForm((current) => ({ ...current, active: event.target.checked }))}
                  className="h-4 w-4 rounded border-white/20 bg-white/10"
                />
                ط§ظ„ط®طµظ… ظ†ط´ط·
              </label>
              <PrimaryButton type="button" onClick={saveDiscount}>ط­ظپط¸ ط§ظ„ط®طµظ…</PrimaryButton>
            </div>
          </DataCard>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white">ط§ظ„ط®طµظˆظ…ط§طھ ط§ظ„ط­ط§ظ„ظٹط©</h2>
                <p className="mt-1 text-sm text-slate-400">ظٹظ…ظƒظ† ط­ط°ظپ ط£ظٹ ط®طµظ… ظ…ظ† ظ‡ظ†ط§ ظپظˆط±ط§ظ‹.</p>
              </div>
              <StatusBadge tone="amber">{discounts.length} ط®طµظ…</StatusBadge>
            </div>
            <div className="grid gap-4">
              {discounts.length === 0 ? (
                <DataCard className="text-center text-slate-400">ظ„ط§ طھظˆط¬ط¯ ط®طµظˆظ…ط§طھ ظ…ط­ظپظˆط¸ط©.</DataCard>
              ) : (
                discounts.map((discount) => (
                  <DataCard key={discount.id}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap gap-2">
                          <StatusBadge tone={discount.active ? 'green' : 'slate'}>{discount.active ? 'ظ†ط´ط·' : 'ظ…طھظˆظ‚ظپ'}</StatusBadge>
                          <StatusBadge tone="blue">{discountValue(discount)}</StatusBadge>
                          <StatusBadge tone="slate">{discount.type === 'FIXED' ? 'ظ…ط¨ظ„ط؛ ط«ط§ط¨طھ' : 'ظ†ط³ط¨ط© ظ…ط¦ظˆظٹط©'}</StatusBadge>
                        </div>
                        <h3 className="truncate text-lg font-black text-white">{discount.name}</h3>
                        <div className="mt-2 grid gap-2 text-sm text-slate-400">
                          <p>ط§ظ„ظ…ط¬ظ…ظˆط¹ط©: <span className="text-slate-200">{discount.group?.name || 'ظƒظ„ ط§ظ„ظ…ط±ط¶ظ‰'}</span></p>
                          <p>ط§ظ„ط®ط¯ظ…ط©: <span className="text-slate-200">{discount.serviceName || 'ظƒظ„ ط§ظ„ط®ط¯ظ…ط§طھ'}</span></p>
                          <p>ط§ظ„ظپطھط±ط©: <span className="text-slate-200">{formatDate(discount.startsAt)} - {formatDate(discount.endsAt)}</span></p>
                        </div>
                      </div>
                      <SecondaryButton type="button" onClick={() => removeDiscount(discount)} className="shrink-0 hover:bg-rose-500/10 hover:text-rose-200">
                        <Trash2 className="h-4 w-4" />
                        ط­ط°ظپ ط§ظ„ط®طµظ…
                      </SecondaryButton>
                    </div>
                  </DataCard>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}





