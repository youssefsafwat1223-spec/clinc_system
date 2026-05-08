import { useEffect, useState } from 'react';
import { Edit2, Plus, Save, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';

const emptyForm = {
  nameAr: '',
  name: '',
  description: '',
  price: '',
  priceFrom: '',
  priceTo: '',
  duration: '',
};

const formatPriceRange = (service) => {
  const from = service.priceFrom;
  const to = service.priceTo;

  if (from != null && to != null) return `${from} - ${to} د.ع`;
  if (from != null) return `من ${from} د.ع`;
  if (to != null) return `إلى ${to} د.ع`;
  if (service.price != null) return `${service.price} د.ع`;
  return '';
};

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
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

  const closeForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

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
        priceFrom: formData.priceFrom === '' ? null : Number(formData.priceFrom),
        priceTo: formData.priceTo === '' ? null : Number(formData.priceTo),
        duration: formData.duration === '' ? 30 : Number(formData.duration),
      };

      if (editingId) {
        await api.put(`/services/${editingId}`, payload);
        toast.success('تم تحديث الخدمة');
      } else {
        await api.post('/services', payload);
        toast.success('تمت إضافة الخدمة');
      }

      closeForm();
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
      price: service.price ?? '',
      priceFrom: service.priceFrom ?? '',
      priceTo: service.priceTo ?? '',
      duration: service.duration ?? '',
    });
    setEditingId(service.id);
    setShowForm(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">الخدمات</h1>
            <p className="mt-1 text-sm text-gray-500">إدارة خدمات العيادة وأسعارها</p>
          </div>
          <button
            onClick={() => {
              setFormData(emptyForm);
              setEditingId(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 font-medium text-white transition hover:bg-green-600"
          >
            <Plus className="h-4 w-4" />
            خدمة جديدة
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
          </div>
        ) : services.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <p className="text-gray-500">لا توجد خدمات حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <div
                key={service.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold text-gray-900">{service.nameAr || service.name}</h3>
                    <p className="truncate text-xs text-gray-500" dir="ltr">
                      {service.name}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(service)}
                      className="rounded-lg bg-blue-100 p-2 text-blue-600 transition hover:bg-blue-200"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(service.id)}
                      className="rounded-lg bg-red-100 p-2 text-red-600 transition hover:bg-red-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {service.description ? (
                  <p className="mb-3 text-sm leading-6 text-gray-600">{service.description}</p>
                ) : null}

                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  {formatPriceRange(service) ? <span>السعر: {formatPriceRange(service)}</span> : null}
                  {service.duration ? <span>المدة: {service.duration} دقيقة</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="my-4 w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? 'تعديل الخدمة' : 'خدمة جديدة'}
                </h2>
                <button onClick={closeForm} className="text-gray-600 transition hover:text-gray-900">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 p-6">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900">الاسم بالعربية</label>
                  <input
                    type="text"
                    value={formData.nameAr}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900">الاسم بالإنجليزية</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900">الوصف</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    rows="3"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-900">السعر الأساسي</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-900">المدة بالدقائق</label>
                    <input
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      placeholder="30"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-900">السعر من</label>
                    <input
                      type="number"
                      value={formData.priceFrom}
                      onChange={(e) => setFormData({ ...formData, priceFrom: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-900">السعر إلى</label>
                    <input
                      type="number"
                      value={formData.priceTo}
                      onChange={(e) => setFormData({ ...formData, priceTo: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2 border-t border-gray-200 pt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2 font-medium text-white transition hover:bg-green-600 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    حفظ
                  </button>
                  <button
                    onClick={closeForm}
                    className="flex-1 rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-200"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
