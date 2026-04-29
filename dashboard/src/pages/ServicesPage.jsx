import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ nameAr: '', name: '', description: '', price: '', duration: '' });
  const [saving, setSaving] = useState(false);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await api.get('/services');
      setServices(res.data.services || res.data || []);
    } catch (error) {
      toast.error('فشل في تحميل الخدمات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleSave = async () => {
    if (!formData.nameAr.trim() || !formData.name.trim()) {
      toast.error('الاسم بالعربية والإنجليزية مطلوب');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...formData,
        price: formData.price === '' ? null : Number(formData.price),
        duration: formData.duration === '' ? 30 : Number(formData.duration),
      };
      if (editingId) {
        await api.put(`/services/${editingId}`, payload);
        toast.success('تم تحديث الخدمة');
      } else {
        await api.post('/services', payload);
        toast.success('تمت إضافة الخدمة');
      }
      setFormData({ nameAr: '', name: '', description: '', price: '', duration: '' });
      setEditingId(null);
      setShowForm(false);
      fetchServices();
    } catch (error) {
      toast.error('فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('حذف هذه الخدمة؟')) return;
    try {
      await api.delete(`/services/${id}`);
      toast.success('تم حذف الخدمة');
      fetchServices();
    } catch (error) {
      toast.error('فشل الحذف');
    }
  };

  const handleEdit = (service) => {
    setFormData({
      nameAr: service.nameAr || service.name || '',
      name: service.name || '',
      description: service.description || '',
      price: service.price || '',
      duration: service.duration || '',
    });
    setEditingId(service.id);
    setShowForm(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🏥 الخدمات</h1>
            <p className="text-sm text-gray-500 mt-1">إدارة خدمات العيادة</p>
          </div>
          <button
            onClick={() => {
              setFormData({ nameAr: '', name: '', description: '', price: '', duration: '' });
              setEditingId(null);
              setShowForm(true);
            }}
            className="px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            خدمة جديدة
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent"></div>
          </div>
        ) : services.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
            <p className="text-gray-500">لا توجد خدمات</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div key={service.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{service.nameAr || service.name}</h3>
                    <p className="text-xs text-gray-500" dir="ltr">{service.name}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(service)}
                      className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(service.id)}
                      className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {service.description && <p className="text-sm text-gray-600 mb-2">{service.description}</p>}

                <div className="flex gap-3 text-xs text-gray-500">
                  {service.price && <span>💰 {service.price}</span>}
                  {service.duration && <span>⏱️ {service.duration}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg border border-gray-200 shadow-2xl w-full max-w-md my-4">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? 'تعديل الخدمة' : 'خدمة جديدة'}
                </h2>
                <button onClick={() => setShowForm(false)} className="text-gray-600 hover:text-gray-900">
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">الاسم بالعربية</label>
                  <input
                    type="text"
                    value={formData.nameAr}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">الاسم بالإنجليزية</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">الوصف</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    rows="2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">السعر</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">المدة</label>
                    <input
                      type="text"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      placeholder="مثلاً: 30 دقيقة"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    حفظ
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
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
