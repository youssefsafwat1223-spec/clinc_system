import { useEffect, useState } from 'react';
import { Edit2, Plus, Save, Stethoscope, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import EmptyState from '../components/EmptyState';
import {
  DataCard,
  Field,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  inputClass,
} from '../components/ui';
import { confirmDialog } from '../components/dialogs';

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
    const ok = await confirmDialog({
      title: 'حذف الخدمة',
      message: 'سيتم حذف هذه الخدمة نهائياً. هل تريد المتابعة؟',
      confirmLabel: 'حذف',
      tone: 'danger',
    });
    if (!ok) return;

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

  const openCreate = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  return (
    <AppLayout>
      <PageHeader
        title="الخدمات"
        description="إدارة خدمات العيادة وأسعارها."
        actions={
          <PrimaryButton type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            خدمة جديدة
          </PrimaryButton>
        }
      />

      {loading ? (
        <DataCard className="flex h-48 items-center justify-center">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
        </DataCard>
      ) : services.length === 0 ? (
        <DataCard>
          <EmptyState
            icon={Stethoscope}
            title="لا توجد خدمات حالياً"
            description="ابدأ بإضافة الخدمات التي تقدمها العيادة حتى يستطيع المرضى الحجز عليها."
            action={{ label: 'إضافة خدمة', onClick: openCreate }}
          />
        </DataCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <DataCard key={service.id} className="p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-bold text-white">
                    {service.nameAr || service.name}
                  </h3>
                  <p className="truncate text-xs text-slate-500" dir="ltr">
                    {service.name}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleEdit(service)}
                    className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-2 text-sky-300 transition hover:bg-sky-500/20"
                    aria-label="تعديل الخدمة"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(service.id)}
                    className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-rose-300 transition hover:bg-rose-500/20"
                    aria-label="حذف الخدمة"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {service.description ? (
                <p className="mb-3 text-sm leading-7 text-slate-400">{service.description}</p>
              ) : null}

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {formatPriceRange(service) ? <span>السعر: {formatPriceRange(service)}</span> : null}
                {service.duration ? <span>المدة: {service.duration} دقيقة</span> : null}
              </div>
            </DataCard>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="my-4 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0b1020] shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <h2 className="text-lg font-black text-white">
                {editingId ? 'تعديل الخدمة' : 'خدمة جديدة'}
              </h2>
              <button
                onClick={closeForm}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <Field label="الاسم بالعربية">
                <input
                  type="text"
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="الاسم بالإنجليزية">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={inputClass}
                  dir="ltr"
                />
              </Field>

              <Field label="الوصف">
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={inputClass}
                  rows="3"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="السعر الأساسي">
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="المدة بالدقائق">
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="30"
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="السعر من">
                  <input
                    type="number"
                    value={formData.priceFrom}
                    onChange={(e) => setFormData({ ...formData, priceFrom: e.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="السعر إلى">
                  <input
                    type="number"
                    value={formData.priceTo}
                    onChange={(e) => setFormData({ ...formData, priceTo: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="flex gap-3 border-t border-white/10 pt-4">
                <PrimaryButton onClick={handleSave} disabled={saving} className="flex-1">
                  <Save className="h-4 w-4" />
                  {saving ? 'جاري الحفظ...' : 'حفظ'}
                </PrimaryButton>
                <SecondaryButton onClick={closeForm} className="flex-1">
                  إلغاء
                </SecondaryButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
