import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Save, Settings, Trash2, Upload } from 'lucide-react';
import { toast } from 'react-toastify';
import AppLayout from '../components/Layout';
import api from '../api/client';
import {
  DataCard,
  Field,
  PageHeader,
  PageLoader,
  PrimaryButton,
  SecondaryButton,
  StatCard,
  StatusBadge,
  inputClass,
} from '../components/ui';
import { confirmDialog } from '../components/dialogs';

const daysAr = {
  sunday: 'الأحد',
  monday: 'الاثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
  saturday: 'السبت',
};

const emptyContactForm = { name: '', phone: '', description: '', active: true };
const emptyDiscountForm = {
  name: '',
  type: 'PERCENT',
  value: '',
  imageUrl: '',
  targetMode: 'ALL',
  serviceId: '',
  startsAt: '',
  endsAt: '',
  phoneNumbers: '',
  active: true,
};

const discountPatientPeriods = [
  { value: '', label: 'كل المرضى' },
  { value: 'last7', label: 'مرضى آخر أسبوع' },
  { value: 'last30', label: 'مرضى آخر شهر' },
  { value: 'thisMonth', label: 'مرضى هذا الشهر' },
];

const discountPatientSortOptions = [
  { value: 'createdAt', label: 'الأحدث إضافة' },
  { value: 'mostBooked', label: 'الأكثر حجزاً' },
  { value: 'leastBooked', label: 'الأقل حجزاً' },
];

const formatDate = (value) => {
  if (!value) return 'بدون تاريخ';
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(value));
};

const discountValue = (discount) =>
  discount.type === 'FIXED'
    ? `${Number(discount.value || 0).toLocaleString('ar-IQ')} د.ع`
    : `${Number(discount.value || 0).toLocaleString('ar-IQ')}%`;

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
  const discountImageInputRef = useRef(null);
  const locationImageInputRef = useRef(null);

  const activeWorkingDays = useMemo(
    () => Object.values(settings?.workingHours || {}).filter(Boolean).length,
    [settings]
  );

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

      setDiscountPatients(
        (res.data.patients || []).filter((patient) => patient.platform === 'WHATSAPP' && patient.phone)
      );
    } catch (error) {
      toast.error('فشل تحميل المرضى لاختيار الخصم');
    }
  };

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
      toast.error('فشل تحميل الإعدادات');
    } finally {
      setLoading(false);
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
      toast.success('تم حفظ الإعدادات');
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const uploadImageToField = async (file, fieldName, successMessage) => {
    const formData = new FormData();
    formData.append('image', file);

    const res = await api.post('/upload/campaign-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    updateField(fieldName, res.data.url);
    toast.success(successMessage);
  };

  const uploadPromoImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      await uploadImageToField(file, 'logoUrl', 'تم رفع صورة العرض');
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل رفع صورة العرض');
    }
  };

  const uploadLocationImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      await uploadImageToField(file, 'locationImageUrl', 'تم رفع صورة موقع العيادة');
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل رفع صورة موقع العيادة');
    }
  };

  const uploadDiscountImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await api.post('/upload/campaign-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDiscountForm((current) => ({ ...current, imageUrl: res.data.url }));
      toast.success('تم رفع صورة الخصم');
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل رفع صورة الخصم');
    }
  };

  const saveContact = async () => {
    if (!contactForm.name.trim() || !contactForm.phone.trim()) {
      toast.warn('اكتب اسم جهة الاتصال ورقم الهاتف');
      return;
    }

    try {
      const res = await api.post('/contacts', contactForm);
      setContacts((current) => [res.data.contact, ...current]);
      setContactForm(emptyContactForm);
      toast.success('تمت إضافة جهة الاتصال');
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل حفظ جهة الاتصال');
    }
  };

  const removeContact = async (contact) => {
    const ok = await confirmDialog({
      title: 'حذف جهة الاتصال',
      message: `سيتم حذف "${contact.name}" نهائياً.`,
      confirmLabel: 'حذف',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await api.delete(`/contacts/${contact.id}`);
      setContacts((current) => current.filter((item) => item.id !== contact.id));
      toast.success('تم حذف جهة الاتصال');
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل حذف جهة الاتصال');
    }
  };

  const saveDiscount = async () => {
    if (!discountForm.name.trim() || !discountForm.value) {
      toast.warn('اكتب اسم الخصم وقيمته');
      return;
    }

    const service = services.find((item) => item.id === discountForm.serviceId);
    const filteredPhones = discountPatients.map((patient) => patient.phone).filter(Boolean);

    if (discountForm.targetMode === 'FILTERED' && filteredPhones.length === 0) {
      toast.warn('لا يوجد مرضى مطابقون للفلاتر الحالية');
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
                  .split(/[\n,،]+/)
                  .map((item) => item.trim())
                  .filter(Boolean),
      });

      setDiscounts((current) => [res.data.discount, ...current]);
      setDiscountForm(emptyDiscountForm);
      toast.success('تم حفظ الخصم');
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل حفظ الخصم');
    }
  };

  const removeDiscount = async (discount) => {
    const ok = await confirmDialog({
      title: 'حذف الخصم',
      message: `سيتم حذف خصم "${discount.name}" نهائياً.`,
      confirmLabel: 'حذف',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await api.delete(`/discounts/${discount.id}`);
      setDiscounts((current) => current.filter((item) => item.id !== discount.id));
      toast.success('تم حذف الخصم');
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل حذف الخصم');
    }
  };

  const tabs = [
    { id: 'clinic', label: 'بيانات العيادة' },
    { id: 'hours', label: 'ساعات العمل' },
    { id: 'contacts', label: 'جهات الاتصال' },
    { id: 'discounts', label: 'الخصومات' },
  ];

  if (loading) {
    return (
      <AppLayout>
        <DataCard>
          <PageLoader label="جارٍ تحميل الإعدادات..." />
        </DataCard>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="الإعدادات"
        description="إدارة بيانات العيادة، البراند، العنوان، صورة الموقع، ونص طلب رقم العميل في الردود الاجتماعية."
        actions={
          <PrimaryButton type="button" onClick={saveSettings} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
          </PrimaryButton>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard title="أيام العمل" value={activeWorkingDays} icon={Settings} tone="blue" />
        <StatCard title="جهات الاتصال" value={contacts.length} icon={Plus} tone="green" />
        <StatCard title="الخصومات" value={discounts.length} icon={Save} tone="amber" />
        <StatCard title="اسم البوت" value={settings?.botName ? 'محدد' : 'غير محدد'} icon={Settings} tone="slate" />
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
            <Field label="اسم العيادة بالعربية">
              <input className={inputClass} value={settings?.clinicNameAr || ''} onChange={(event) => updateField('clinicNameAr', event.target.value)} />
            </Field>
            <Field label="اسم العيادة بالإنجليزية">
              <input className={inputClass} dir="ltr" value={settings?.clinicName || ''} onChange={(event) => updateField('clinicName', event.target.value)} />
            </Field>
            <Field label="اسم البوت الظاهر في الرسائل">
              <input className={inputClass} value={settings?.botName || ''} onChange={(event) => updateField('botName', event.target.value)} placeholder="مثال: عيادة د. إبراهيم" />
            </Field>
            <Field label="رقم الهاتف">
              <input className={inputClass} value={settings?.phone || ''} onChange={(event) => updateField('phone', event.target.value)} />
            </Field>
            <Field label="رابط شعار الروشتة">
              <input className={inputClass} dir="ltr" value={settings?.brandLogoUrl || settings?.logoUrl || ''} onChange={(event) => updateField('brandLogoUrl', event.target.value)} placeholder="/api/images/logo.png" />
            </Field>
            <Field label="صورة العرض الحالية">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input className={inputClass} dir="ltr" value={settings?.logoUrl || ''} onChange={(event) => updateField('logoUrl', event.target.value)} placeholder="/api/images/promo.jpg" />
                  <SecondaryButton type="button" onClick={() => promoImageInputRef.current?.click()} className="shrink-0">
                    <Upload className="h-4 w-4" />
                    رفع
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
            <Field label="لون البراند الأساسي">
              <input className={inputClass} value={settings?.brandPrimaryColor || ''} onChange={(event) => updateField('brandPrimaryColor', event.target.value)} placeholder="#2563eb" />
            </Field>
            <Field label="العنوان">
              <input className={inputClass} value={settings?.address || ''} onChange={(event) => updateField('address', event.target.value)} />
            </Field>
            <Field label="رابط Google Maps">
              <input className={inputClass} dir="ltr" value={settings?.googleMapsLink || ''} onChange={(event) => updateField('googleMapsLink', event.target.value)} />
            </Field>
            <Field label="رابط واتساب مباشر">
              <input className={inputClass} dir="ltr" value={settings?.whatsappChatLink || ''} onChange={(event) => updateField('whatsappChatLink', event.target.value)} />
            </Field>
            <Field label="صورة موقع العيادة">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input className={inputClass} dir="ltr" value={settings?.locationImageUrl || ''} onChange={(event) => updateField('locationImageUrl', event.target.value)} placeholder="/api/images/location-map.jpg" />
                  <SecondaryButton type="button" onClick={() => locationImageInputRef.current?.click()} className="shrink-0">
                    <Upload className="h-4 w-4" />
                    رفع
                  </SecondaryButton>
                  <input ref={locationImageInputRef} type="file" accept="image/*" className="hidden" onChange={uploadLocationImage} />
                </div>
                {settings?.locationImageUrl ? (
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1225]">
                    <img src={settings.locationImageUrl} alt="Location" className="h-36 w-full object-cover" />
                  </div>
                ) : null}
              </div>
            </Field>
            <Field label="نص طلب رقم العميل في الردود الاجتماعية">
              <textarea
                className={`${inputClass} min-h-28`}
                value={settings?.socialContactPrompt || ''}
                onChange={(event) => updateField('socialContactPrompt', event.target.value)}
                placeholder="إذا تحب نخلي الاستقبال يتواصل وياك، ابعت رقمك هنا وسنتواصل معك."
              />
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
                      {day ? 'يعمل' : 'إجازة'}
                    </button>
                  </div>
                  {day ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="من">
                        <input className={inputClass} type="time" value={day.start || '09:00'} onChange={(event) => updateWorkingHours(key, 'start', event.target.value)} />
                      </Field>
                      <Field label="إلى">
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
            <h2 className="mb-4 text-lg font-black text-white">إضافة جهة اتصال</h2>
            <div className="space-y-4">
              <Field label="الاسم">
                <input className={inputClass} value={contactForm.name} onChange={(event) => setContactForm((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label="رقم الهاتف">
                <input className={inputClass} value={contactForm.phone} onChange={(event) => setContactForm((current) => ({ ...current, phone: event.target.value }))} />
              </Field>
              <Field label="الوصف">
                <input className={inputClass} value={contactForm.description} onChange={(event) => setContactForm((current) => ({ ...current, description: event.target.value }))} />
              </Field>
              <PrimaryButton type="button" onClick={saveContact}>إضافة</PrimaryButton>
            </div>
          </DataCard>

          <div className="grid gap-4">
            {contacts.length === 0 ? (
              <DataCard className="text-center text-slate-400">لا توجد جهات اتصال محفوظة.</DataCard>
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
                      حذف
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
            <h2 className="mb-2 text-lg font-black text-white">إضافة خصم</h2>
            <p className="mb-5 text-sm leading-6 text-slate-400">
              يمكنك تحديد الخصم لكل المرضى أو لأرقام محددة. يظهر الخصم في المدفوعات وردود الأسعار على واتساب والردود الاجتماعية.
            </p>
            <div className="space-y-4">
              <Field label="اسم الخصم">
                <input className={inputClass} value={discountForm.name} onChange={(event) => setDiscountForm((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="نوع الخصم">
                  <select className={inputClass} value={discountForm.type} onChange={(event) => setDiscountForm((current) => ({ ...current, type: event.target.value }))}>
                    <option value="PERCENT">نسبة مئوية</option>
                    <option value="FIXED">مبلغ ثابت</option>
                  </select>
                </Field>
                <Field label="القيمة">
                  <input className={inputClass} type="number" min="0" value={discountForm.value} onChange={(event) => setDiscountForm((current) => ({ ...current, value: event.target.value }))} />
                </Field>
              </div>
              <Field label="الخدمة المستهدفة">
                <select className={inputClass} value={discountForm.serviceId} onChange={(event) => setDiscountForm((current) => ({ ...current, serviceId: event.target.value }))}>
                  <option value="">كل الخدمات</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>{service.nameAr || service.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="صورة الخصم">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input className={inputClass} dir="ltr" value={discountForm.imageUrl} onChange={(event) => setDiscountForm((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="/api/images/discount.jpg" />
                    <SecondaryButton type="button" onClick={() => discountImageInputRef.current?.click()} className="shrink-0">
                      <Upload className="h-4 w-4" />
                      رفع
                    </SecondaryButton>
                    <input ref={discountImageInputRef} type="file" accept="image/*" className="hidden" onChange={uploadDiscountImage} />
                  </div>
                  {discountForm.imageUrl ? (
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1225]">
                      <img src={discountForm.imageUrl} alt="Discount" className="h-36 w-full object-cover" />
                    </div>
                  ) : null}
                </div>
              </Field>
              <Field label="المستفيدون من الخصم">
                <select className={inputClass} value={discountForm.targetMode} onChange={(event) => setDiscountForm((current) => ({ ...current, targetMode: event.target.value }))}>
                  <option value="ALL">كل المرضى الحاليين والجدد</option>
                  <option value="FILTERED">مرضى حسب الفلاتر</option>
                  <option value="PHONES">أرقام محددة فقط</option>
                </select>
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="يبدأ من">
                  <input className={inputClass} type="date" value={discountForm.startsAt} onChange={(event) => setDiscountForm((current) => ({ ...current, startsAt: event.target.value }))} />
                </Field>
                <Field label="ينتهي في">
                  <input className={inputClass} type="date" value={discountForm.endsAt} onChange={(event) => setDiscountForm((current) => ({ ...current, endsAt: event.target.value }))} />
                </Field>
              </div>

              {discountForm.targetMode === 'FILTERED' ? (
                <div className="space-y-3 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="بحث">
                      <input className={inputClass} value={discountPatientSearch} onChange={(event) => setDiscountPatientSearch(event.target.value)} placeholder="اسم أو رقم المريض" />
                    </Field>
                    <Field label="الفترة">
                      <select className={inputClass} value={discountPatientPeriod} onChange={(event) => setDiscountPatientPeriod(event.target.value)}>
                        {discountPatientPeriods.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="الترتيب">
                      <select className={inputClass} value={discountPatientSort} onChange={(event) => setDiscountPatientSort(event.target.value)}>
                        {discountPatientSortOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-bold text-sky-100">سيتم تطبيق الخصم على {discountPatients.length} مريض مطابق للفلاتر.</p>
                    <SecondaryButton type="button" onClick={() => loadDiscountPatients({ search: discountPatientSearch, period: discountPatientPeriod, sortBy: discountPatientSort })}>
                      تطبيق الفلاتر
                    </SecondaryButton>
                  </div>
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-black/10 p-3 text-sm text-slate-200">
                    {discountPatients.length === 0 ? (
                      <p className="text-slate-400">لا يوجد مرضى مطابقون حالياً.</p>
                    ) : (
                      <div className="grid gap-2">
                        {discountPatients.slice(0, 40).map((patient) => (
                          <div key={patient.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
                            <span className="font-bold text-white">{patient.displayName || patient.name || 'مريض'}</span>
                            <span dir="ltr" className="text-slate-300">{patient.phone}</span>
                          </div>
                        ))}
                        {discountPatients.length > 40 ? <p className="text-xs text-slate-400">و {discountPatients.length - 40} مريض آخر...</p> : null}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {discountForm.targetMode === 'PHONES' ? (
                <Field label="أرقام المرضى">
                  <textarea
                    className={`${inputClass} min-h-32`}
                    value={discountForm.phoneNumbers}
                    onChange={(event) => setDiscountForm((current) => ({ ...current, phoneNumbers: event.target.value }))}
                    placeholder="رقم في كل سطر أو افصل بفاصلة"
                    dir="ltr"
                  />
                </Field>
              ) : null}

              <label className="flex items-center gap-2 text-sm font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={discountForm.active}
                  onChange={(event) => setDiscountForm((current) => ({ ...current, active: event.target.checked }))}
                  className="h-4 w-4 rounded border-white/20 bg-white/10"
                />
                الخصم نشط
              </label>
              <PrimaryButton type="button" onClick={saveDiscount}>حفظ الخصم</PrimaryButton>
            </div>
          </DataCard>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white">الخصومات الحالية</h2>
                <p className="mt-1 text-sm text-slate-400">يمكن حذف أي خصم من هنا فوراً.</p>
              </div>
              <StatusBadge tone="amber">{discounts.length} خصم</StatusBadge>
            </div>

            <div className="grid gap-4">
              {discounts.length === 0 ? (
                <DataCard className="text-center text-slate-400">لا توجد خصومات محفوظة.</DataCard>
              ) : (
                discounts.map((discount) => (
                  <DataCard key={discount.id}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      {discount.imageUrl ? (
                        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1225] lg:w-40 lg:shrink-0">
                          <img src={discount.imageUrl} alt={discount.name} className="h-28 w-full object-cover" />
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap gap-2">
                          <StatusBadge tone={discount.active ? 'green' : 'slate'}>{discount.active ? 'نشط' : 'متوقف'}</StatusBadge>
                          <StatusBadge tone="blue">{discountValue(discount)}</StatusBadge>
                          <StatusBadge tone="slate">{discount.type === 'FIXED' ? 'مبلغ ثابت' : 'نسبة مئوية'}</StatusBadge>
                        </div>
                        <h3 className="truncate text-lg font-black text-white">{discount.name}</h3>
                        <div className="mt-2 grid gap-2 text-sm text-slate-400">
                          <p>المجموعة: <span className="text-slate-200">{discount.group?.name || 'كل المرضى'}</span></p>
                          <p>الخدمة: <span className="text-slate-200">{discount.serviceName || 'كل الخدمات'}</span></p>
                          <p>الفترة: <span className="text-slate-200">{formatDate(discount.startsAt)} - {formatDate(discount.endsAt)}</span></p>
                        </div>
                      </div>
                      <SecondaryButton type="button" onClick={() => removeDiscount(discount)} className="shrink-0 hover:bg-rose-500/10 hover:text-rose-200">
                        <Trash2 className="h-4 w-4" />
                        حذف الخصم
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
