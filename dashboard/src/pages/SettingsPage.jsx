import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock3, MapPin, Phone, Save, Settings, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';

const daysAr = {
  sunday: 'الأحد',
  monday: 'الاثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
  saturday: 'السبت',
};

function SummaryCard({ title, value, hint, icon: Icon, accentClass }) {
  return (
    <div className={`glass-card border p-5 ${accentClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-dark-muted">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-white">{value}</p>
          <p className="text-xs font-medium text-slate-400">{hint}</p>
        </div>
        <div className="rounded-2xl bg-dark-bg/70 p-3">
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', description: '', priority: 0, active: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data.settings);
      const contactsRes = await api.get('/contacts').catch(() => ({ data: { contacts: [] } }));
      setContacts(contactsRes.data.contacts || []);
    } catch (error) {
      toast.error('فشل في تحميل الإعدادات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!settings) {
      return;
    }

    try {
      setSaving(true);
      await api.put('/settings', settings);
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      toast.error(error.message || 'فشل في الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const saveContact = async () => {
    if (!contactForm.name.trim() || !contactForm.phone.trim()) {
      toast.error('اسم جهة الاتصال ورقم الهاتف مطلوبان');
      return;
    }

    try {
      const res = await api.post('/contacts', contactForm);
      setContacts((current) => [res.data.contact, ...current]);
      setContactForm({ name: '', phone: '', description: '', priority: 0, active: true });
      toast.success('تمت إضافة جهة الاتصال');
    } catch (error) {
      toast.error(error.message || 'فشل حفظ جهة الاتصال');
    }
  };

  const toggleContact = async (contact) => {
    try {
      const res = await api.put(`/contacts/${contact.id}`, { active: !contact.active });
      setContacts((current) => current.map((item) => (item.id === contact.id ? res.data.contact : item)));
    } catch (error) {
      toast.error(error.message || 'فشل تحديث جهة الاتصال');
    }
  };

  const updateField = (field, value) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateWorkingHours = (day, field, value) => {
    setSettings((current) => ({
      ...current,
      workingHours: {
        ...(current?.workingHours || {}),
        [day]: {
          ...(current?.workingHours?.[day] || {}),
          [field]: value,
        },
      },
    }));
  };

  const toggleDay = (day) => {
    setSettings((current) => {
      const hours = current?.workingHours?.[day];
      return {
        ...current,
        workingHours: {
          ...(current?.workingHours || {}),
          [day]: hours ? null : { start: '09:00', end: '17:00' },
        },
      };
    });
  };

  const activeWorkingDays = useMemo(
    () => Object.values(settings?.workingHours || {}).filter(Boolean).length,
    [settings]
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center p-20">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl space-y-6 fade-in">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">إعدادات العيادة</h1>
            <p className="mt-1 text-sm text-dark-muted">معلومات العيادة الأساسية وساعات العمل العامة التي يعتمد عليها النظام.</p>
          </div>

          <button onClick={handleSave} disabled={saving || !settings} className="btn-primary">
            {saving ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            حفظ التغييرات
          </button>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="أيام العمل" value={activeWorkingDays} hint="أيام مفعلة داخل الجدول العام" icon={Clock3} accentClass="border-primary-500/20" />
          <SummaryCard title="حالة الذكاء الاصطناعي" value={settings?.aiEnabled ? 'مفعل' : 'معطل'} hint="الحالة الحالية للردود الآلية" icon={ShieldCheck} accentClass="border-emerald-500/20" />
          <SummaryCard title="رقم التواصل" value={settings?.phone ? 'موجود' : 'غير مضبوط'} hint={settings?.phone || 'أضف رقمًا رسميًا للعيادة'} icon={Phone} accentClass="border-sky-500/20" />
          <SummaryCard title="العنوان" value={settings?.address ? 'موجود' : 'غير مضبوط'} hint={settings?.address || 'أضف عنوان العيادة'} icon={MapPin} accentClass="border-amber-500/20" />
        </section>

        <div className="glass-card space-y-8 p-6 md:p-8">
          <section>
            <h2 className="mb-4 flex items-center gap-2 border-b border-dark-border pb-2 text-lg font-bold text-white">
              <Settings className="h-5 w-5 text-primary-400" />
              المعلومات الأساسية
            </h2>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-dark-muted">اسم العيادة بالعربية</label>
                <input
                  type="text"
                  value={settings?.clinicNameAr || ''}
                  onChange={(event) => updateField('clinicNameAr', event.target.value)}
                  className="input-field"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-dark-muted">اسم العيادة بالإنجليزية</label>
                <input
                  type="text"
                  dir="ltr"
                  value={settings?.clinicName || ''}
                  onChange={(event) => updateField('clinicName', event.target.value)}
                  className="input-field"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-dark-muted">اسم المرسل الآلي في واتساب</label>
                <input
                  type="text"
                  value={settings?.botName || ''}
                  onChange={(event) => updateField('botName', event.target.value)}
                  className="input-field"
                  placeholder={settings?.clinicNameAr || 'اسم العيادة'}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-dark-muted">رقم هاتف التواصل</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="+201000000000"
                  value={settings?.phone || ''}
                  onChange={(event) => updateField('phone', event.target.value)}
                  className="input-field"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-dark-muted">العنوان</label>
                <input
                  type="text"
                  value={settings?.address || ''}
                  onChange={(event) => updateField('address', event.target.value)}
                  className="input-field"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-dark-muted">رابط واتساب المباشر</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="https://wa.me/201000000000?text=..."
                  value={settings?.whatsappChatLink || ''}
                  onChange={(event) => updateField('whatsappChatLink', event.target.value)}
                  className="input-field"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-dark-muted">رابط Google Maps</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="https://maps.google.com/?q=..."
                  value={settings?.googleMapsLink || ''}
                  onChange={(event) => updateField('googleMapsLink', event.target.value)}
                  className="input-field"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b border-dark-border pb-2 text-lg font-bold text-white">براند الروشتة والرسائل</h2>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-dark-muted">رابط لوجو العيادة</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="/uploads/logo.png أو https://..."
                  value={settings?.logoUrl || settings?.brandLogoUrl || ''}
                  onChange={(event) => {
                    updateField('logoUrl', event.target.value);
                    updateField('brandLogoUrl', event.target.value);
                  }}
                  className="input-field"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-dark-muted">ملاحظة أسفل الروشتة</label>
                <input
                  type="text"
                  value={settings?.prescriptionFooter || ''}
                  onChange={(event) => updateField('prescriptionFooter', event.target.value)}
                  className="input-field"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-dark-muted">اللون الأساسي</label>
                <input
                  type="color"
                  value={settings?.brandPrimaryColor || '#0B1929'}
                  onChange={(event) => updateField('brandPrimaryColor', event.target.value)}
                  className="h-12 w-full rounded-xl border border-dark-border bg-dark-bg p-1"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-dark-muted">لون التمييز</label>
                <input
                  type="color"
                  value={settings?.brandSecondaryColor || '#C9A84C'}
                  onChange={(event) => updateField('brandSecondaryColor', event.target.value)}
                  className="h-12 w-full rounded-xl border border-dark-border bg-dark-bg p-1"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b border-dark-border pb-2 text-lg font-bold text-white">أرقام التواصل المباشر</h2>

            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
              <div className="rounded-xl border border-dark-border bg-dark-bg/40 p-4">
                <div className="space-y-3">
                  <input
                    value={contactForm.name}
                    onChange={(event) => setContactForm((current) => ({ ...current, name: event.target.value }))}
                    className="input-field"
                    placeholder="الاسم: الاستقبال، الحسابات، الطوارئ..."
                  />
                  <input
                    value={contactForm.phone}
                    onChange={(event) => setContactForm((current) => ({ ...current, phone: event.target.value }))}
                    className="input-field"
                    dir="ltr"
                    placeholder="+964..."
                  />
                  <input
                    value={contactForm.description}
                    onChange={(event) => setContactForm((current) => ({ ...current, description: event.target.value }))}
                    className="input-field"
                    placeholder="وصف اختياري"
                  />
                  <button type="button" onClick={saveContact} className="btn-secondary w-full justify-center">
                    <Phone className="h-4 w-4" />
                    إضافة الرقم
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {contacts.length === 0 ? (
                  <div className="rounded-xl border border-dark-border bg-dark-bg/30 p-6 text-center text-sm text-dark-muted">
                    لا توجد أرقام مباشرة بعد.
                  </div>
                ) : (
                  contacts.map((contact) => (
                    <div key={contact.id} className="flex items-center justify-between gap-3 rounded-xl border border-dark-border bg-dark-bg/40 p-3">
                      <div>
                        <p className="font-bold text-white">{contact.name}</p>
                        <p className="text-xs text-primary-300" dir="ltr">{contact.phone}</p>
                        {contact.description ? <p className="mt-1 text-xs text-dark-muted">{contact.description}</p> : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleContact(contact)}
                        className={`rounded-lg px-3 py-2 text-xs font-bold ${contact.active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}
                      >
                        {contact.active ? 'مفعل' : 'معطل'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b border-dark-border pb-2 text-lg font-bold text-white">ساعات العمل الموحدة</h2>

            <div className="mb-6 flex gap-3 rounded-xl border border-primary-500/20 bg-primary-500/10 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary-400" />
              <p className="text-sm leading-relaxed text-primary-200">
                هذا هو الجدول العام للعيادة. يعتمد عليه النظام والـ AI كنطاق عمل افتراضي، بينما يظل لكل طبيب جدول عمله الخاص داخل صفحة المواعيد.
              </p>
            </div>

            <div className="space-y-3">
              {Object.keys(daysAr).map((day) => {
                const isActive = !!settings?.workingHours?.[day];

                return (
                  <div
                    key={day}
                    className={`flex flex-col gap-4 rounded-xl border p-4 transition-colors md:flex-row md:items-center ${
                      isActive ? 'border-dark-border bg-dark-bg/50' : 'border-dark-border/30 bg-dark-bg/20 opacity-70'
                    }`}
                  >
                    <label className="flex flex-1 cursor-pointer items-center gap-3">
                      <div className="relative flex items-center">
                        <input type="checkbox" checked={isActive} onChange={() => toggleDay(day)} className="peer sr-only" />
                        <div className="h-6 w-11 rounded-full border border-dark-border bg-dark-card transition-colors peer-checked:bg-primary-500"></div>
                        <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-dark-muted transition-transform peer-checked:translate-x-5 peer-checked:bg-white"></div>
                      </div>
                      <span className="w-24 font-bold text-white">{daysAr[day]}</span>
                    </label>

                    {isActive ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={settings?.workingHours?.[day]?.start || '09:00'}
                          onChange={(event) => updateWorkingHours(day, 'start', event.target.value)}
                          className="input-field py-1"
                        />
                        <span className="text-dark-muted">إلى</span>
                        <input
                          type="time"
                          value={settings?.workingHours?.[day]?.end || '17:00'}
                          onChange={(event) => updateWorkingHours(day, 'end', event.target.value)}
                          className="input-field py-1"
                        />
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-dark-muted">مغلق</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
