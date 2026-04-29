import { useEffect, useMemo, useState } from 'react';
import { Clock, MapPin, Phone, Save, Settings } from 'lucide-react';
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

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', description: '', active: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

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
    if (!settings) return;
    try {
      setSaving(true);
      await api.put('/settings', settings);
      toast.success('تم حفظ الإعدادات');
    } catch (error) {
      toast.error('فشل في الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const saveContact = async () => {
    if (!contactForm.name.trim() || !contactForm.phone.trim()) {
      toast.error('الاسم والرقم مطلوبان');
      return;
    }
    try {
      const res = await api.post('/contacts', contactForm);
      setContacts((current) => [res.data.contact, ...current]);
      setContactForm({ name: '', phone: '', description: '', active: true });
      toast.success('تمت إضافة الرقم');
    } catch (error) {
      toast.error('فشل حفظ الرقم');
    }
  };

  const toggleContact = async (contact) => {
    try {
      const res = await api.put(`/contacts/${contact.id}`, { active: !contact.active });
      setContacts((current) => current.map((item) => (item.id === contact.id ? res.data.contact : item)));
    } catch (error) {
      toast.error('فشل تحديث الرقم');
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
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">⚙️ الإعدادات</h1>
            <p className="text-sm text-gray-500 mt-1">إعدادات العيادة والساعات والتواصل</p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !settings}
            className="px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            ) : (
              <Save className="h-4 w-4" />
            )}
            حفظ
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-600">أيام العمل</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{activeWorkingDays}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-600">رقم التواصل</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{settings?.phone ? '✓' : '✗'}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-600">العنوان</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{settings?.address ? '✓' : '✗'}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-600">أرقام التواصل</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{contacts.length}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-md overflow-hidden">
          <div className="flex border-b border-gray-200">
            {[
              { id: 'basic', label: 'المعلومات الأساسية' },
              { id: 'hours', label: 'ساعات العمل' },
              { id: 'contacts', label: 'أرقام التواصل' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">اسم العيادة بالعربية</label>
                    <input
                      type="text"
                      value={settings?.clinicNameAr || ''}
                      onChange={(e) => updateField('clinicNameAr', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">اسم العيادة بالإنجليزية</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={settings?.clinicName || ''}
                      onChange={(e) => updateField('clinicName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">رقم الهاتف</label>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="+201000000000"
                      value={settings?.phone || ''}
                      onChange={(e) => updateField('phone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">العنوان</label>
                    <input
                      type="text"
                      value={settings?.address || ''}
                      onChange={(e) => updateField('address', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">رابط واتساب</label>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="https://wa.me/..."
                      value={settings?.whatsappChatLink || ''}
                      onChange={(e) => updateField('whatsappChatLink', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">رابط Google Maps</label>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="https://maps.google.com/..."
                      value={settings?.googleMapsLink || ''}
                      onChange={(e) => updateField('googleMapsLink', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Working Hours Tab */}
            {activeTab === 'hours' && (
              <div className="space-y-3">
                {Object.keys(daysAr).map((day) => {
                  const isActive = !!settings?.workingHours?.[day];
                  return (
                    <div
                      key={day}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isActive ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => toggleDay(day)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="font-medium text-gray-900 w-20">{daysAr[day]}</span>
                      </label>
                      {isActive ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={settings?.workingHours?.[day]?.start || '09:00'}
                            onChange={(e) => updateWorkingHours(day, 'start', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <span className="text-gray-600 text-sm">إلى</span>
                          <input
                            type="time"
                            value={settings?.workingHours?.[day]?.end || '17:00'}
                            onChange={(e) => updateWorkingHours(day, 'end', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">مغلق</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Contacts Tab */}
            {activeTab === 'contacts' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="font-bold text-gray-900">إضافة رقم</h3>
                  <input
                    value={contactForm.name}
                    onChange={(e) => setContactForm((c) => ({ ...c, name: e.target.value }))}
                    placeholder="الاسم: الاستقبال، الحسابات..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    value={contactForm.phone}
                    onChange={(e) => setContactForm((c) => ({ ...c, phone: e.target.value }))}
                    dir="ltr"
                    placeholder="+964..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    value={contactForm.description}
                    onChange={(e) => setContactForm((c) => ({ ...c, description: e.target.value }))}
                    placeholder="وصف اختياري"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    onClick={saveContact}
                    className="w-full px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition flex items-center justify-center gap-2"
                  >
                    <Phone className="h-4 w-4" />
                    إضافة
                  </button>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-gray-900">الأرقام المسجلة</h3>
                  {contacts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">لا توجد أرقام بعد</p>
                    </div>
                  ) : (
                    contacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-sm">{contact.name}</p>
                          <p className="text-xs text-gray-500" dir="ltr">{contact.phone}</p>
                          {contact.description && <p className="text-xs text-gray-600 mt-0.5">{contact.description}</p>}
                        </div>
                        <button
                          onClick={() => toggleContact(contact)}
                          className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                            contact.active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {contact.active ? 'مفعل' : 'معطل'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
