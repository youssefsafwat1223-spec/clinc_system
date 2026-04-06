import { useEffect, useMemo, useState } from 'react';
import { Edit2, Mail, Phone, Plus, Search, ShieldCheck, Stethoscope, Trash2, UserSquare2, Users } from 'lucide-react';
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${
        active
          ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
          : 'bg-rose-500/10 text-rose-300 ring-rose-500/20'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
      {active ? 'نشط' : 'معطل'}
    </span>
  );
}

export default function StaffPage() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDoctor, setCurrentDoctor] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    specialization: '',
    phone: '',
    email: '',
    password: '',
    active: true,
  });

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const res = await api.get('/doctors');
      setDoctors(res.data.doctors || []);
    } catch (error) {
      toast.error('فشل في تحميل الكادر الطبي');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleOpenModal = (doctor = null) => {
    if (doctor) {
      setCurrentDoctor(doctor);
      setFormData({
        name: doctor.name || '',
        specialization: doctor.specialization || '',
        phone: doctor.phone || '',
        email: doctor.user?.email || '',
        password: '',
        active: doctor.active ?? doctor.user?.active ?? true,
      });
    } else {
      setCurrentDoctor(null);
      setFormData({
        name: '',
        specialization: '',
        phone: '',
        email: '',
        password: '',
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
        phone: formData.phone || null,
      };

      if (!payload.password) {
        delete payload.password;
      }

      if (!payload.email) {
        delete payload.email;
      }

      if (currentDoctor) {
        await api.put(`/doctors/${currentDoctor.id}`, payload);
        toast.success('تم تحديث بيانات الطبيب بنجاح');
      } else {
        await api.post('/doctors', payload);
        toast.success('تمت إضافة الطبيب بنجاح');
      }

      setIsModalOpen(false);
      fetchDoctors();
    } catch (error) {
      toast.error(error.message || 'خطأ في الحفظ');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('تأكيد حذف الطبيب وحساب دخوله المرتبط؟')) {
      return;
    }

    try {
      await api.delete(`/doctors/${id}`);
      toast.success('تم الحذف بنجاح');
      fetchDoctors();
    } catch (error) {
      toast.error(error.message || 'فشل الحذف');
    }
  };

  const filteredDoctors = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return doctors.filter((doctor) => {
      const haystack = [doctor.name, doctor.specialization, doctor.phone, doctor.user?.email].filter(Boolean).join(' ').toLowerCase();
      return !query || haystack.includes(query);
    });
  }, [doctors, searchTerm]);

  const summary = useMemo(
    () => ({
      total: doctors.length,
      active: doctors.filter((doctor) => doctor.active).length,
      withAccounts: doctors.filter((doctor) => doctor.user?.email).length,
      appointments: doctors.reduce((sum, doctor) => sum + (doctor._count?.appointments || 0), 0),
    }),
    [doctors]
  );

  return (
    <AppLayout>
      <div className="space-y-6 fade-in">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">الكادر الطبي والموظفون</h1>
            <p className="mt-1 text-sm text-dark-muted">إدارة الأطباء، حسابات الدخول، وحالة كل حساب من صفحة واحدة.</p>
          </div>

          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
            <div className="relative w-full md:w-80">
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <Search className="h-4 w-4 text-dark-muted" />
              </div>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ابحث بالاسم أو التخصص أو البريد..."
                className="input-field border-dark-border bg-dark-card/80 pr-10"
              />
            </div>

            <button onClick={() => handleOpenModal()} className="btn-primary">
              <Plus className="h-5 w-5" />
              إضافة طبيب
            </button>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="إجمالي الأطباء" value={summary.total} hint="كل السجلات الحالية" icon={Users} accentClass="border-primary-500/20" />
          <SummaryCard title="الحسابات النشطة" value={summary.active} hint="متاح لها العمل داخل النظام" icon={ShieldCheck} accentClass="border-emerald-500/20" />
          <SummaryCard title="بحساب دخول" value={summary.withAccounts} hint="مربوطة بـ dashboard login" icon={Mail} accentClass="border-sky-500/20" />
          <SummaryCard title="إجمالي الحجوزات" value={summary.appointments} hint="موزعة على جميع الأطباء" icon={Stethoscope} accentClass="border-amber-500/20" />
        </section>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></span>
          </div>
        ) : filteredDoctors.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center p-16 text-dark-muted">
            <Users className="mb-4 h-16 w-16 opacity-20" />
            <p className="text-lg">لا يوجد أطباء مطابقون للبحث</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredDoctors.map((doctor) => {
              const activeWorkingDays = Object.values(doctor.workingHours || {}).filter(Boolean).length;

              return (
                <div key={doctor.id} className="glass-card group overflow-hidden">
                  <div className="relative h-24 bg-gradient-to-r from-slate-800 to-primary-900/40">
                    <div className="absolute left-4 top-4 flex gap-2">
                      <button
                        onClick={() => handleOpenModal(doctor)}
                        className="rounded-md bg-dark-card/50 p-1.5 text-slate-300 backdrop-blur-sm transition-colors hover:bg-primary-500 hover:text-white"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(doctor.id)}
                        className="rounded-md bg-dark-card/50 p-1.5 text-slate-300 backdrop-blur-sm transition-colors hover:bg-red-500 hover:text-white"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="absolute -bottom-10 right-6 flex h-20 w-20 items-center justify-center rounded-full border-4 border-dark-card bg-dark-card shadow-xl">
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary-400/20 to-primary-600/20">
                        <UserSquare2 className="h-8 w-8 text-primary-400" />
                      </div>
                    </div>
                  </div>

                  <div className="p-6 pt-12">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-bold text-white">{doctor.name}</h3>
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-primary-500/20 bg-primary-500/10 px-2.5 py-1 text-sm font-medium text-primary-300 shadow-inner">
                          <Stethoscope className="h-3.5 w-3.5" />
                          {doctor.specialization}
                        </div>
                      </div>
                      <StatusBadge active={doctor.active} />
                    </div>

                    <div className="space-y-3 text-sm">
                      {doctor.phone ? (
                        <div className="flex items-center gap-3 rounded-lg border border-dark-border/50 bg-dark-bg/50 px-3 py-2 text-slate-300">
                          <Phone className="h-4 w-4 text-dark-muted" />
                          <span dir="ltr">{doctor.phone}</span>
                        </div>
                      ) : null}

                      <div className="flex items-center gap-3 rounded-lg border border-dark-border/50 bg-dark-bg/50 px-3 py-2 text-slate-300">
                        <Mail className="h-4 w-4 text-dark-muted" />
                        <span dir="ltr" className="truncate">
                          {doctor.user?.email || 'لا يوجد حساب دخول'}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-dark-border/50 pt-4">
                        <div>
                          <span className="mb-1 block text-[10px] uppercase tracking-wider text-dark-muted">الحجوزات</span>
                          <span className="text-lg font-bold text-white">{doctor._count?.appointments || 0}</span>
                        </div>
                        <div>
                          <span className="mb-1 block text-[10px] uppercase tracking-wider text-dark-muted">أيام العمل</span>
                          <span className="text-lg font-bold text-white">{activeWorkingDays}</span>
                        </div>
                        <div>
                          <span className="mb-1 block text-[10px] uppercase tracking-wider text-dark-muted">الدخول</span>
                          <span className="text-sm font-bold text-slate-300">{doctor.user?.email ? 'مفعل' : 'بدون حساب'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-bg/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-dark-border bg-dark-card p-6 shadow-2xl">
              <h2 className="mb-6 text-xl font-bold text-white">
                {currentDoctor ? 'تعديل بيانات الطبيب' : 'إضافة طبيب جديد'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark-muted">الاسم الكامل</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                    className="input-field"
                    placeholder="د. أحمد محمد"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-dark-muted">التخصص</label>
                  <input
                    required
                    type="text"
                    value={formData.specialization}
                    onChange={(event) => setFormData({ ...formData, specialization: event.target.value })}
                    className="input-field"
                    placeholder="باطنة - أطفال - جلدية"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-dark-muted">رقم الهاتف</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                    className="input-field"
                    dir="ltr"
                    placeholder="+201000000000"
                  />
                </div>

                <div className="rounded-xl border border-dark-border/60 bg-dark-bg/30 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-medium text-primary-300">حساب الدخول إلى الـ Dashboard</h4>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={formData.active}
                        onChange={(event) => setFormData({ ...formData, active: event.target.checked })}
                        className="h-4 w-4 rounded border-dark-border bg-dark-bg text-primary-500 focus:ring-primary-500"
                      />
                      حساب نشط
                    </label>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-dark-muted">البريد الإلكتروني</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                        className="input-field"
                        dir="ltr"
                        placeholder="doctor@clinic.com"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-dark-muted">
                        كلمة المرور {currentDoctor ? '(اتركها فارغة إذا لم ترغب في تغييرها)' : ''}
                      </label>
                      <input
                        type={currentDoctor ? 'password' : 'text'}
                        required={!currentDoctor && !!formData.email}
                        value={formData.password}
                        onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                        className="input-field"
                        dir="ltr"
                        placeholder={currentDoctor ? '********' : 'doctor123'}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-dark-border pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-medium text-dark-muted transition-colors hover:text-white">
                    إلغاء
                  </button>
                  <button type="submit" className="btn-primary rounded-lg px-6">
                    حفظ البيانات
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
