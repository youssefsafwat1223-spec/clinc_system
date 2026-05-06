import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Edit2, Mail, Phone, Plus, Save, Stethoscope, Trash2, UserCog, Users, X } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { DataCard, Field, PageHeader, PrimaryButton, SecondaryButton, StatCard, StatusBadge, inputClass } from '../components/ui';

const emptyForm = {
  name: '',
  displayName: '',
  email: '',
  phone: '',
  password: '',
  specialization: '',
  role: 'STAFF',
};

const roleLabels = {
  ADMIN: 'إدارة',
  DOCTOR: 'طبيب',
  STAFF: 'موظف',
  RECEPTION: 'استقبال',
};

const roleTones = {
  ADMIN: 'amber',
  DOCTOR: 'blue',
  STAFF: 'slate',
  RECEPTION: 'green',
};

const daysAr = {
  sunday: 'الأحد',
  monday: 'الاثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
  saturday: 'السبت',
};

const defaultDayHours = { start: '09:00', end: '17:00' };

export default function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [scheduleDoctor, setScheduleDoctor] = useState(null);
  const [scheduleHours, setScheduleHours] = useState({});
  const [savingSchedule, setSavingSchedule] = useState(false);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await api.get('/staff');
      setStaff(res.data.staff || res.data || []);
    } catch (error) {
      toast.error(error.message || 'فشل تحميل الكادر الطبي');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const stats = useMemo(
    () => ({
      total: staff.length,
      doctors: staff.filter((member) => member.role === 'DOCTOR').length,
      reception: staff.filter((member) => member.role === 'RECEPTION').length,
      admins: staff.filter((member) => member.role === 'ADMIN').length,
    }),
    [staff]
  );

  const openCreateForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEditForm = (member) => {
    setFormData({
      name: member.name || '',
      displayName: member.displayName || '',
      email: member.email || '',
      phone: member.phone || member.doctor?.phone || '',
      password: '',
      specialization: member.doctor?.specialization || '',
      role: member.role || 'STAFF',
    });
    setEditingId(member.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.email.trim() || (!editingId && !formData.password.trim())) {
      toast.error('الاسم والبريد وكلمة المرور مطلوبة');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...formData,
        displayName: formData.displayName || formData.name,
        specialization: formData.specialization || 'طبيب',
      };

      if (editingId) {
        await api.put(`/staff/${editingId}`, payload);
        toast.success('تم تحديث بيانات الموظف');
      } else {
        await api.post('/staff', payload);
        toast.success('تم إضافة موظف جديد');
      }

      setFormData(emptyForm);
      setEditingId(null);
      setShowForm(false);
      fetchStaff();
    } catch (error) {
      toast.error(error.message || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل تريد حذف هذا الموظف؟')) return;
    try {
      await api.delete(`/staff/${id}`);
      toast.success('تم حذف الموظف');
      fetchStaff();
    } catch (error) {
      toast.error(error.message || 'فشل الحذف');
    }
  };

  const openSchedule = (member) => {
    if (!member.doctor?.id) {
      toast.error('هذا المستخدم غير مرتبط بملف طبيب');
      return;
    }
    setScheduleDoctor(member);
    setScheduleHours(member.doctor?.workingHours || {});
  };

  const toggleScheduleDay = (day) => {
    setScheduleHours((current) => ({
      ...current,
      [day]: current?.[day] ? null : defaultDayHours,
    }));
  };

  const updateScheduleDay = (day, field, value) => {
    setScheduleHours((current) => ({
      ...current,
      [day]: {
        ...(current?.[day] || defaultDayHours),
        [field]: value,
      },
    }));
  };

  const saveSchedule = async () => {
    if (!scheduleDoctor?.doctor?.id) return;
    try {
      setSavingSchedule(true);
      await api.put(`/doctors/${scheduleDoctor.doctor.id}`, {
        workingHours: scheduleHours || {},
      });
      toast.success('تم حفظ مواعيد الدكتور');
      setScheduleDoctor(null);
      fetchStaff();
    } catch (error) {
      toast.error(error.message || 'فشل حفظ مواعيد الدكتور');
    } finally {
      setSavingSchedule(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="الكادر الطبي"
        description="إدارة حسابات الموظفين والأطباء، وضبط مواعيد عمل كل دكتور مباشرة من نفس الصفحة."
        actions={
          <PrimaryButton type="button" onClick={openCreateForm}>
            <Plus className="h-4 w-4" />
            موظف جديد
          </PrimaryButton>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="إجمالي الكادر" value={stats.total} icon={Users} tone="blue" />
        <StatCard title="الأطباء" value={stats.doctors} icon={Stethoscope} tone="green" />
        <StatCard title="الاستقبال" value={stats.reception} icon={Phone} tone="slate" />
        <StatCard title="الإدارة" value={stats.admins} icon={UserCog} tone="amber" />
      </div>

      {loading ? (
        <DataCard className="text-center text-slate-300">جاري تحميل الكادر الطبي...</DataCard>
      ) : staff.length === 0 ? (
        <DataCard className="text-center">
          <h2 className="text-lg font-black text-white">لا يوجد كادر مسجل</h2>
          <p className="mt-2 text-sm text-slate-400">ابدأ بإضافة طبيب أو موظف استقبال.</p>
        </DataCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {staff.map((member) => (
            <DataCard key={member.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
                    {member.role === 'DOCTOR' ? <Stethoscope className="h-6 w-6" /> : <UserCog className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-black text-white">{member.name}</h2>
                      <StatusBadge tone={roleTones[member.role]}>{roleLabels[member.role] || member.role}</StatusBadge>
                    </div>
                    {member.displayName ? <p className="mt-1 text-sm text-slate-400">اسم الظهور: {member.displayName}</p> : null}
                    {member.doctor?.specialization ? <p className="mt-1 text-sm text-slate-400">التخصص: {member.doctor.specialization}</p> : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {member.role === 'DOCTOR' ? (
                    <SecondaryButton type="button" onClick={() => openSchedule(member)}>
                      <CalendarClock className="h-4 w-4" />
                      مواعيد الدكتور
                    </SecondaryButton>
                  ) : null}
                  <SecondaryButton type="button" onClick={() => openEditForm(member)}>
                    <Edit2 className="h-4 w-4" />
                    تعديل
                  </SecondaryButton>
                  <button
                    type="button"
                    onClick={() => handleDelete(member.id)}
                    className="inline-flex items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-rose-300 transition hover:bg-rose-500/20"
                    aria-label="حذف الموظف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0d1225] px-3 py-2">
                  <Mail className="h-4 w-4 text-slate-500" />
                  <span className="truncate" dir="ltr">{member.email || '-'}</span>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0d1225] px-3 py-2">
                  <Phone className="h-4 w-4 text-slate-500" />
                  <span className="truncate" dir="ltr">{member.phone || member.doctor?.phone || '-'}</span>
                </div>
              </div>

              {member.role === 'DOCTOR' ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="mb-2 text-xs font-bold text-slate-400">أيام العمل المختصرة</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(daysAr).map(([day, label]) => (
                      <StatusBadge key={day} tone={member.doctor?.workingHours?.[day] ? 'green' : 'slate'}>
                        {label}
                      </StatusBadge>
                    ))}
                  </div>
                </div>
              ) : null}
            </DataCard>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-3xl border border-white/10 bg-[#0b1224] p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-white">{editingId ? 'تعديل موظف' : 'موظف جديد'}</h2>
                <p className="mt-1 text-sm text-slate-400">لو اخترت الدور طبيب سيتم إنشاء/تحديث ملف الطبيب المرتبط به.</p>
              </div>
              <button type="button" className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10" onClick={() => setShowForm(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="الاسم">
                <input className={inputClass} value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} />
              </Field>
              <Field label="اسم الظهور">
                <input className={inputClass} value={formData.displayName} onChange={(event) => setFormData({ ...formData, displayName: event.target.value })} placeholder="اختياري" />
              </Field>
              <Field label="البريد الإلكتروني">
                <input className={inputClass} value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} dir="ltr" type="email" />
              </Field>
              <Field label={editingId ? 'كلمة مرور جديدة' : 'كلمة المرور'}>
                <input className={inputClass} value={formData.password} onChange={(event) => setFormData({ ...formData, password: event.target.value })} dir="ltr" type="password" placeholder={editingId ? 'اتركها فارغة بدون تغيير' : ''} />
              </Field>
              <Field label="الهاتف">
                <input className={inputClass} value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} dir="ltr" type="tel" />
              </Field>
              <Field label="الدور">
                <select className={inputClass} value={formData.role} onChange={(event) => setFormData({ ...formData, role: event.target.value })}>
                  <option value="STAFF">موظف</option>
                  <option value="RECEPTION">استقبال</option>
                  <option value="DOCTOR">طبيب</option>
                  <option value="ADMIN">إدارة</option>
                </select>
              </Field>
              {formData.role === 'DOCTOR' ? (
                <Field label="تخصص الطبيب">
                  <input className={inputClass} value={formData.specialization} onChange={(event) => setFormData({ ...formData, specialization: event.target.value })} placeholder="مثال: أسنان، تقويم، تجميل" />
                </Field>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-white/10 pt-5">
              <SecondaryButton type="button" onClick={() => setShowForm(false)}>إلغاء</SecondaryButton>
              <PrimaryButton type="button" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}

      {scheduleDoctor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-3xl border border-white/10 bg-[#0b1224] p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-white">مواعيد د. {scheduleDoctor.name}</h2>
                <p className="mt-1 text-sm text-slate-400">افتح الأيام التي يعمل بها الدكتور وحدد وقت البداية والنهاية. الأيام المغلقة لن تظهر في حجز واتساب.</p>
              </div>
              <button type="button" className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10" onClick={() => setScheduleDoctor(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(daysAr).map(([day, label]) => {
                const workingDay = scheduleHours?.[day];
                const isActive = Boolean(workingDay);
                return (
                  <div key={day} className="rounded-2xl border border-white/10 bg-[#0d1225] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <label className="flex items-center gap-3 text-sm font-black text-white">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => toggleScheduleDay(day)}
                          className="h-4 w-4 rounded border-white/20 bg-white/10 accent-sky-500"
                        />
                        {label}
                      </label>
                      <StatusBadge tone={isActive ? 'green' : 'slate'}>{isActive ? 'يعمل' : 'إجازة'}</StatusBadge>
                    </div>

                    {isActive ? (
                      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                        <Field label="من">
                          <input
                            className={inputClass}
                            type="time"
                            value={workingDay?.start || defaultDayHours.start}
                            onChange={(event) => updateScheduleDay(day, 'start', event.target.value)}
                          />
                        </Field>
                        <span className="pb-3 text-sm text-slate-400">إلى</span>
                        <Field label="إلى">
                          <input
                            className={inputClass}
                            type="time"
                            value={workingDay?.end || defaultDayHours.end}
                            onChange={(event) => updateScheduleDay(day, 'end', event.target.value)}
                          />
                        </Field>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">هذا اليوم مغلق لهذا الدكتور.</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-white/10 pt-5">
              <SecondaryButton type="button" onClick={() => setScheduleDoctor(null)}>إلغاء</SecondaryButton>
              <PrimaryButton type="button" onClick={saveSchedule} disabled={savingSchedule}>
                <Save className="h-4 w-4" />
                {savingSchedule ? 'جاري الحفظ...' : 'حفظ مواعيد الدكتور'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
