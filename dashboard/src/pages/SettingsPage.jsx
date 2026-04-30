import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Settings, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import AppLayout from '../components/Layout';
import api from '../api/client';
import { DataCard, Field, PageHeader, PrimaryButton, SecondaryButton, StatCard, StatusBadge, inputClass } from '../components/ui';

const daysAr = {
  sunday: 'الأحد',
  monday: 'الإثنين',
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
  serviceId: '',
  startsAt: '',
  endsAt: '',
  phoneNumbers: '',
  active: true,
};

function formatDate(value) {
  if (!value) return 'بدون تاريخ';
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(value));
}

function discountValue(discount) {
  return discount.type === 'FIXED' ? `${Number(discount.value || 0).toLocaleString('ar-IQ')} د.ع` : `${Number(discount.value || 0).toLocaleString('ar-IQ')}%`;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('clinic');
  const [settings, setSettings] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contactForm, setContactForm] = useState(emptyContactForm);
  const [discountForm, setDiscountForm] = useState(emptyDiscountForm);

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
    if (!window.confirm(`حذف جهة الاتصال "${contact.name}"؟`)) return;
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
    try {
      const res = await api.post('/discounts', {
        ...discountForm,
        value: Number(discountForm.value),
        serviceName: service?.nameAr || service?.name || null,
        phoneNumbers: discountForm.phoneNumbers
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
    if (!window.confirm(`حذف خصم "${discount.name}"؟`)) return;
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
        <DataCard className="text-center text-slate-300">جاري تحميل الإعدادات...</DataCard>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="الإعدادات"
        description="إدارة بيانات العيادة والبراند وجهات الاتصال والخصومات."
        actions={
          <PrimaryButton type="button" onClick={saveSettings} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
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
            <Field label="لون البراند الأساسي">
              <input className={inputClass} value={settings?.brandPrimaryColor || ''} onChange={(event) => updateField('brandPrimaryColor', event.target.value)} placeholder="#2563eb" />
            </Field>
            <Field label="العنوان">
              <input className={inputClass} value={settings?.address || ''} onChange={(event) => updateField('address', event.target.value)} />
            </Field>
            <Field label="رابط واتساب مباشر">
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
            <h2 className="mb-2 text-lg font-black text-white">إضافة خصم لمجموعة أرقام</h2>
            <p className="mb-5 text-sm leading-6 text-slate-400">
              اكتب أرقام المرضى، وسيتم تكوين مجموعة لهم. عند الحجز لاحقاً يظهر الخصم في المدفوعات وردود الأسعار على واتساب.
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
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="يبدأ من">
                  <input className={inputClass} type="date" value={discountForm.startsAt} onChange={(event) => setDiscountForm((current) => ({ ...current, startsAt: event.target.value }))} />
                </Field>
                <Field label="ينتهي في">
                  <input className={inputClass} type="date" value={discountForm.endsAt} onChange={(event) => setDiscountForm((current) => ({ ...current, endsAt: event.target.value }))} />
                </Field>
              </div>
              <Field label="أرقام المرضى">
                <textarea
                  className={`${inputClass} min-h-32`}
                  value={discountForm.phoneNumbers}
                  onChange={(event) => setDiscountForm((current) => ({ ...current, phoneNumbers: event.target.value }))}
                  placeholder="رقم في كل سطر أو افصل بفاصلة"
                  dir="ltr"
                />
              </Field>
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
