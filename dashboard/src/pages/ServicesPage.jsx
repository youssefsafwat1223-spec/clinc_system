import { useEffect, useMemo, useState } from 'react';
import { Activity, Clock, Edit2, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';

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

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${
        active
          ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
          : 'bg-slate-500/10 text-slate-300 ring-slate-500/20'
      }`}
    >
      {active ? 'نشطة' : 'معطلة'}
    </span>
  );
}

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentService, setCurrentService] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    nameAr: '',
    description: '',
    price: '',
    duration: 30,
    active: true,
  });

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await api.get('/services');
      setServices(res.data.services || []);
    } catch (error) {
      toast.error('فشل في تحميل الخدمات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleOpenModal = (service = null) => {
    if (service) {
      setCurrentService(service);
      setFormData({
        name: service.name || '',
        nameAr: service.nameAr || '',
        description: service.description || '',
        price: service.price ?? '',
        duration: service.duration || 30,
        active: service.active ?? true,
      });
    } else {
      setCurrentService(null);
      setFormData({
        name: '',
        nameAr: '',
        description: '',
        price: '',
        duration: 30,
        active: true,
      });
    }

    setIsModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const payload = {
        ...formData,
        price: formData.price === '' ? null : parseFloat(formData.price),
        duration: parseInt(formData.duration, 10),
      };

      if (currentService) {
        await api.put(`/services/${currentService.id}`, payload);
        toast.success('تم تحديث الخدمة بنجاح');
      } else {
        await api.post('/services', payload);
        toast.success('تمت إضافة الخدمة بنجاح');
      }

      setIsModalOpen(false);
      fetchServices();
    } catch (error) {
      toast.error(error.message || 'حدث خطأ أثناء حفظ الخدمة');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الخدمة؟ لا يمكن التراجع عن هذا الإجراء.')) {
      return;
    }

    try {
      await api.delete(`/services/${id}`);
      toast.success('تم حذف الخدمة بنجاح');
      fetchServices();
    } catch (error) {
      toast.error('فشل في حذف الخدمة');
    }
  };

  const filteredServices = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return services.filter((service) => {
      const haystack = [service.name, service.nameAr, service.description].filter(Boolean).join(' ').toLowerCase();
      return !query || haystack.includes(query);
    });
  }, [searchTerm, services]);

  const summary = useMemo(
    () => ({
      total: services.length,
      active: services.filter((service) => service.active).length,
      priced: services.filter((service) => service.price !== null && service.price !== undefined).length,
      averageDuration:
        services.length > 0 ? Math.round(services.reduce((sum, service) => sum + (service.duration || 0), 0) / services.length) : 0,
    }),
    [services]
  );

  return (
    <AppLayout>
      <div className="space-y-6 fade-in">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">إدارة الخدمات</h1>
            <p className="mt-1 text-sm text-dark-muted">أضف الخدمات، عطّل غير المستخدم منها، واضبط السعر والمدة بشكل أوضح.</p>
          </div>

          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
            <div className="relative w-full md:w-80">
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <Search className="h-4 w-4 text-dark-muted" />
              </div>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ابحث باسم الخدمة أو وصفها..."
                className="input-field border-dark-border bg-dark-card/80 pr-10"
              />
            </div>

            <button onClick={() => handleOpenModal()} className="btn-primary">
              <Plus className="h-5 w-5" />
              إضافة خدمة
            </button>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="إجمالي الخدمات" value={summary.total} hint="كل الخدمات داخل النظام" icon={Activity} accentClass="border-primary-500/20" />
          <SummaryCard title="الخدمات النشطة" value={summary.active} hint="المعروضة للحجز حاليًا" icon={Plus} accentClass="border-emerald-500/20" />
          <SummaryCard title="خدمات مسعرة" value={summary.priced} hint="لها سعر مباشر محدد" icon={Edit2} accentClass="border-sky-500/20" />
          <SummaryCard title="متوسط المدة" value={`${summary.averageDuration} د`} hint="متوسط تقريبي لكل الخدمات" icon={Clock} accentClass="border-amber-500/20" />
        </section>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></span>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center p-16 text-dark-muted">
            <Activity className="mb-4 h-16 w-16 opacity-20" />
            <p className="text-lg">لا توجد خدمات مطابقة للبحث</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredServices.map((service) => (
              <div key={service.id} className="glass-card group relative flex flex-col overflow-hidden p-6">
                <div className="absolute right-0 top-0 -z-10 h-16 w-16 rounded-bl-[100px] bg-gradient-to-br from-primary-500/20 to-transparent"></div>

                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary-500/10 p-2.5 text-primary-400 ring-1 ring-primary-500/30">
                      <Activity className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">{service.nameAr}</h3>
                        <StatusBadge active={service.active} />
                      </div>
                      <p className="mt-1 inline-block rounded bg-dark-bg/50 px-2 py-0.5 font-mono text-xs text-dark-muted">{service.name}</p>
                    </div>
                  </div>
                </div>

                <p className="mb-6 flex-1 text-sm leading-relaxed text-slate-300">
                  {service.description || 'لا يوجد وصف مسجل لهذه الخدمة'}
                </p>

                <div className="mt-auto flex items-center justify-between border-t border-dark-border/50 pt-4">
                  <div className="flex flex-col">
                    <span className="mb-0.5 text-[10px] uppercase tracking-wider text-dark-muted">التكلفة</span>
                    <span className="text-lg font-bold text-emerald-400">
                      {service.price !== null && service.price !== undefined ? `${service.price} ر.س` : 'متغير'}
                    </span>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="mb-0.5 text-[10px] uppercase tracking-wider text-dark-muted">المدة</span>
                    <span className="flex items-center gap-1 text-sm font-medium text-slate-300">
                      <Clock className="h-3.5 w-3.5 text-primary-400" />
                      {service.duration} دقيقة
                    </span>
                  </div>
                </div>

                <div className="absolute left-4 top-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => handleOpenModal(service)}
                    className="rounded-lg border border-dark-border bg-dark-card/80 p-2 text-dark-muted shadow-lg backdrop-blur-md transition-colors hover:bg-primary-500 hover:text-white"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(service.id)}
                    className="rounded-lg border border-dark-border bg-dark-card/80 p-2 text-dark-muted shadow-lg backdrop-blur-md transition-colors hover:bg-red-500 hover:text-white"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-bg/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-dark-border bg-dark-card shadow-2xl">
              <div className="border-b border-dark-border bg-dark-bg/30 p-6">
                <h2 className="text-xl font-bold text-white">
                  {currentService ? 'تعديل خدمة' : 'إضافة خدمة جديدة'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 p-6">
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark-muted">الاسم العربي *</label>
                  <input
                    required
                    type="text"
                    value={formData.nameAr}
                    onChange={(event) => setFormData({ ...formData, nameAr: event.target.value })}
                    className="input-field bg-dark-bg/50"
                    placeholder="استشارة قلب"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-dark-muted">الاسم الداخلي *</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                    className="input-field bg-dark-bg/50 font-mono text-sm"
                    dir="ltr"
                    placeholder="Heart Consultation"
                  />
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-dark-muted">السعر</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(event) => setFormData({ ...formData, price: event.target.value })}
                      className="input-field bg-dark-bg/50"
                      placeholder="200"
                    />
                  </div>

                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-dark-muted">المدة بالدقائق *</label>
                    <input
                      required
                      type="number"
                      min="5"
                      step="5"
                      value={formData.duration}
                      onChange={(event) => setFormData({ ...formData, duration: event.target.value })}
                      className="input-field bg-dark-bg/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-dark-muted">الوصف</label>
                  <textarea
                    value={formData.description}
                    onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                    className="input-field min-h-[100px] resize-none bg-dark-bg/50"
                    placeholder="وصف مختصر لما تقدمه هذه الخدمة"
                  />
                </div>

                <label className="flex items-center gap-2 rounded-xl border border-dark-border/60 bg-dark-bg/30 p-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(event) => setFormData({ ...formData, active: event.target.checked })}
                    className="h-4 w-4 rounded border-dark-border bg-dark-bg text-primary-500 focus:ring-primary-500"
                  />
                  الخدمة نشطة ومتاحة للحجز
                </label>

                <div className="mt-8 flex justify-end gap-3 border-t border-dark-border/50 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl px-5 py-2.5 font-medium text-dark-muted transition-colors hover:bg-dark-border hover:text-white">
                    إلغاء
                  </button>
                  <button type="submit" className="btn-primary rounded-xl px-8 shadow-lg shadow-primary-500/20">
                    حفظ
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
