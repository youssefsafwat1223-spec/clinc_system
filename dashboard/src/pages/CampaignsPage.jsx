import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { toast } from 'react-toastify';
import { Megaphone, Send, Search, Plus, Save, Trash2 } from 'lucide-react';

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

export default function CampaignsPage() {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const canManageTemplates = currentUser?.role === 'ADMIN';

  const [campaignType, setCampaignType] = useState('TEXT');
  const [messageText, setMessageText] = useState('');
  const [selectedPatientIds, setSelectedPatientIds] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [templateSaving, setTemplateSaving] = useState(false);

  const fetchTemplates = async () => {
    try {
      setTemplatesLoading(true);
      const res = await api.get('/campaigns/templates');
      setTemplates(res.data.templates || []);
    } catch (error) {
      toast.error('فشل تحميل القوالب');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await api.get('/patients', { params: { limit: 500 } });
      const items = res.data.patients || [];
      setAllPatients(
        items
          .filter((p) => p.platform === 'WHATSAPP' && p.phone)
          .map((p) => ({ id: p.id, name: p.name, phone: p.phone }))
      );
    } catch (error) {
      toast.error('فشل تحميل المرضى');
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchPatients();
  }, []);

  const handleSendCampaign = async () => {
    if (!messageText.trim() || selectedPatientIds.length === 0) {
      toast.error('أدخل رسالة واختر مرضى');
      return;
    }

    try {
      setSending(true);
      await api.post('/campaigns/broadcast', {
        broadcastType: 'TEXT',
        messageText,
        audience: 'SELECTED',
        patientIds: selectedPatientIds,
      });
      toast.success('تم إرسال الحملة');
      setMessageText('');
      setSelectedPatientIds([]);
    } catch (error) {
      toast.error('فشل إرسال الحملة');
    } finally {
      setSending(false);
    }
  };

  const saveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.bodyText.trim()) {
      toast.error('اسم القالب والرسالة مطلوبان');
      return;
    }

    try {
      setTemplateSaving(true);
      if (templateForm.id) {
        await api.put(`/campaigns/templates/${templateForm.id}`, templateForm);
        toast.success('تم تحديث القالب');
      } else {
        await api.post('/campaigns/templates', templateForm);
        toast.success('تم إنشاء القالب');
      }
      fetchTemplates();
      setShowTemplateForm(false);
      setTemplateForm(emptyTemplateForm);
    } catch (error) {
      toast.error('فشل حفظ القالب');
    } finally {
      setTemplateSaving(false);
    }
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm('حذف هذا القالب؟')) return;
    try {
      await api.delete(`/campaigns/templates/${id}`);
      toast.success('تم حذف القالب');
      fetchTemplates();
    } catch (error) {
      toast.error('فشل حذف القالب');
    }
  };

  const filteredPatients = allPatients.filter((p) =>
    patientSearch ? p.name.toLowerCase().includes(patientSearch.toLowerCase()) : true
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📢 الحملات</h1>
            <p className="text-sm text-gray-500 mt-1">إرسال رسائل جماعية للمرضى</p>
          </div>
          {canManageTemplates && (
            <button
              onClick={() => setShowTemplateForm(true)}
              className="px-4 py-2 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              قالب جديد
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign Form */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-md">
              <h2 className="text-lg font-bold text-gray-900 mb-4">إنشاء حملة جديدة</h2>

              {/* Message Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-900 mb-2">نوع الرسالة</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={campaignType === 'TEXT'}
                      onChange={() => setCampaignType('TEXT')}
                      className="w-4 h-4"
                    />
                    <span className="text-gray-700">نصية</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={campaignType === 'TEMPLATE'}
                      onChange={() => setCampaignType('TEMPLATE')}
                      className="w-4 h-4"
                    />
                    <span className="text-gray-700">قالب</span>
                  </label>
                </div>
              </div>

              {/* Message Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-900 mb-2">الرسالة</label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="اكتب رسالتك..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows="4"
                />
                <p className="text-xs text-gray-500 mt-1">{messageText.length} حرف</p>
              </div>

              {/* Action Button */}
              <button
                onClick={handleSendCampaign}
                disabled={sending || selectedPatientIds.length === 0 || !messageText.trim()}
                className="w-full px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sending ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
                إرسال ({selectedPatientIds.length})
              </button>
            </div>
          </div>

          {/* Patient Selection */}
          <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-md">
            <h2 className="text-lg font-bold text-gray-900 mb-4">اختيار المرضى</h2>

            <div className="mb-3">
              <input
                type="text"
                placeholder="ابحث..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <button
              onClick={() => setSelectedPatientIds(filteredPatients.map((p) => p.id))}
              className="w-full px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition mb-3"
            >
              تحديد الكل ({filteredPatients.length})
            </button>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredPatients.map((patient) => (
                <label
                  key={patient.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedPatientIds.includes(patient.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPatientIds([...selectedPatientIds, patient.id]);
                      } else {
                        setSelectedPatientIds(selectedPatientIds.filter((id) => id !== patient.id));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{patient.name}</p>
                    <p className="text-xs text-gray-500" dir="ltr">
                      {patient.phone}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Templates Section */}
        {canManageTemplates && (
          <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-md">
            <h2 className="text-lg font-bold text-gray-900 mb-4">القوالب</h2>

            {templatesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent"></div>
              </div>
            ) : templates.length === 0 ? (
              <p className="text-gray-500 text-center py-8">لا توجد قوالب</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-gray-900">{template.displayName}</h3>
                      <button
                        onClick={() => deleteTemplate(template.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{template.bodyText}</p>
                    <button
                      onClick={() => {
                        setTemplateForm(template);
                        setShowTemplateForm(true);
                      }}
                      className="mt-3 w-full px-2 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200 transition"
                    >
                      تعديل
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Template Form Modal */}
        {showTemplateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-auto">
            <div className="bg-white rounded-lg border border-gray-200 shadow-2xl w-full max-w-2xl my-4">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  {templateForm.id ? 'تعديل القالب' : 'قالب جديد'}
                </h2>
                <button
                  onClick={() => {
                    setShowTemplateForm(false);
                    setTemplateForm(emptyTemplateForm);
                  }}
                  className="text-gray-600 hover:text-gray-900"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">اسم القالب</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">الرسالة</label>
                  <textarea
                    value={templateForm.bodyText}
                    onChange={(e) => setTemplateForm({ ...templateForm, bodyText: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    rows="4"
                  />
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={saveTemplate}
                    disabled={templateSaving}
                    className="flex-1 px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    حفظ
                  </button>
                  <button
                    onClick={() => {
                      setShowTemplateForm(false);
                      setTemplateForm(emptyTemplateForm);
                    }}
                    className="flex-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
