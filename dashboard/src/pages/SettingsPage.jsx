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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('clinic');
  const [settings, setSettings] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', description: '', active: true });
  const [discountForm, setDiscountForm] = useState({
    name: '',
    type: 'PERCENT',
    value: '',
    serviceId: '',
    startsAt: '',
    endsAt: '',
    phoneNumbers: '',
    active: true,
  });

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
    } catch {
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
      toast.error(error.message || 'فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const saveContact = async () => {
    if (!contactForm.name.trim() || !contactForm.phone.trim()) {
      toast.warn('اكتب الاسم ورقم الهاتف');
      return;
    }
    try {
      const res = await api.post('/contacts', contactForm);
      setContacts((current) => [res.data.contact, ...current]);
      setContactForm({ name: '', phone: '', description: '', active: true });
      toast.success('تمت إضافة جهة الاتصال');
    } catch (error) {
      toast.error(error.message || 'فشل حفظ جهة الاتصال');
    }
  };

  const removeContact = async (contact) => {
    try {
      await api.delete(`/contacts/${contact.id}`);
      setContacts((current) => current.filter((item) => item.id !== contact.id));
    } catch (error) {
      toast.error(error.message || 'فشل حذف جهة الاتصال');
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
      setDiscountForm({ name: '', type: 'PERCENT', value: '', serviceId: '', startsAt: '', endsAt: '', phoneNumbers: '', active: true });
      toast.success('تم حفظ الخصم');
    } catch (error) {
      toast.error(error.message || 'فشل حفظ الخصم');
    }
  };

  const removeDiscount = async (discount) => {
    try {
      await api.delete(`/discounts/${discount.id}`);
      setDiscounts((current) => current.filter((item) => item.id !== discount.id));
    } catch (error) {
      toast.error(error.message || 'فشل حذف الخصم');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <DataCard>جاري تحميل الإعدادات...</DataCard>
      </AppLayout>
    );
  }

  const tabs = [
    { id: 'clinic', label: 'بيانات العيادة' },
    { id: 'hours', label: 'ساعات العمل' },
    { id: 'contacts', label: 'جهات الاتصال' },
    { id: 'discounts', label: 'الخصومات' },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="الإعدادات"
        description="إدارة بيانات العيادة والبراند وجهات الاتصال والخصومات."
        actions={
          <PrimaryButton type="button" onClick={saveSettings} disabled={saving}>
            <Save className="h-4 w-4" />
            حفظ الإعدادات
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
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </DataCard>

      {activeTab === 'clinic' && (
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
      )}

      {activeTab === 'hours' && (
        <DataCard>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(daysAr).map(([key, label]) => {
              const day = settings?.workingHours?.[key];
              return (
                <div key={key} className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-bold text-slate-950">{label}</h3>
                    <button type="button" onClick={() => toggleDay(key)} className={`rounded-full px-3 py-1 text-xs font-bold ${day ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {day ? 'يعمل' : 'إجازة'}
                    </button>
                  </div>
                  {day && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="من">
                        <input className={inputClass} type="time" value={day.start || '09:00'} onChange={(event) => updateWorkingHours(key, 'start', event.target.value)} />
                      </Field>
                      <Field label="إلى">
                        <input className={inputClass} type="time" value={day.end || '17:00'} onChange={(event) => updateWorkingHours(key, 'end', event.target.value)} />
                      </Field>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DataCard>
      )}

      {activeTab === 'contacts' && (
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <DataCard>
            <h2 className="mb-4 text-lg font-bold text-slate-950">إضافة جهة اتصال</h2>
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
            {contacts.map((contact) => (
              <DataCard key={contact.id}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-950">{contact.name}</h3>
                    <p className="text-sm text-slate-500">{contact.phone}</p>
                    {contact.description && <p className="mt-1 text-sm text-slate-600">{contact.description}</p>}
                  </div>
                  <SecondaryButton type="button" onClick={() => removeContact(contact)} className="text-rose-600">
                    <Trash2 className="h-4 w-4" />
                    حذف
                  </SecondaryButton>
                </div>
              </DataCard>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'discounts' && (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <DataCard>
            <h2 className="mb-4 text-lg font-bold text-slate-950">إضافة خصم لمجموعة أرقام</h2>
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
                  <input className={inputClass} type="number" value={discountForm.value} onChange={(event) => setDiscountForm((current) => ({ ...current, value: event.target.value }))} />
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
              <Field label="أرقام المرضى">
                <textarea
                  className={`${inputClass} min-h-32`}
                  value={discountForm.phoneNumbers}
                  onChange={(event) => setDiscountForm((current) => ({ ...current, phoneNumbers: event.target.value }))}
                  placeholder="رقم في كل سطر أو افصل بفاصلة"
                  dir="ltr"
                />
              </Field>
              <PrimaryButton type="button" onClick={saveDiscount}>حفظ الخصم</PrimaryButton>
            </div>
          </DataCard>

          <div className="grid gap-4">
            {discounts.map((discount) => (
              <DataCard key={discount.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <StatusBadge tone={discount.active ? 'green' : 'slate'}>{discount.active ? 'نشط' : 'متوقف'}</StatusBadge>
                      <StatusBadge tone="blue">{discount.type === 'FIXED' ? `${discount.value} ج.م` : `${discount.value}%`}</StatusBadge>
                    </div>
                    <h3 className="font-bold text-slate-950">{discount.name}</h3>
                    <p className="text-sm text-slate-500">المجموعة: {discount.group?.name || 'كل المرضى'} - الخدمة: {discount.serviceName || 'كل الخدمات'}</p>
                  </div>
                  <SecondaryButton type="button" onClick={() => removeDiscount(discount)} className="text-rose-600">
                    <Trash2 className="h-4 w-4" />
                    حذف
                  </SecondaryButton>
                </div>
              </DataCard>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
