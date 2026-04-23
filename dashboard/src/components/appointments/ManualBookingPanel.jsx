import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, CheckCircle2, Clock3, Phone, PlusCircle, UserPlus } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../api/client';

const todayDateValue = () => new Date().toISOString().slice(0, 10);

const emptyPatientForm = {
  name: '',
  phone: '',
  platform: 'WHATSAPP',
  notes: '',
};

export default function ManualBookingPanel({ isDoctor, doctorProfile, onCreated }) {
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [showPatientCreator, setShowPatientCreator] = useState(false);
  const [alternatives, setAlternatives] = useState([]);
  const [lastBooking, setLastBooking] = useState(null);

  const [form, setForm] = useState({
    patientId: '',
    doctorId: '',
    serviceId: '',
    date: todayDateValue(),
    time: '',
    notes: '',
    confirmImmediately: true,
    notifyPatient: true,
  });

  const [patientForm, setPatientForm] = useState(emptyPatientForm);

  useEffect(() => {
    fetchSupportData();
  }, []);

  useEffect(() => {
    if (isDoctor && doctorProfile?.id) {
      setDoctors([doctorProfile]);
      setForm((current) => ({
        ...current,
        doctorId: current.doctorId || doctorProfile.id,
      }));
    }
  }, [isDoctor, doctorProfile]);

  const fetchSupportData = async () => {
    try {
      setLoading(true);
      const requests = [
        api.get('/services'),
        api.get('/patients', { params: { limit: 100 } }),
      ];

      if (!isDoctor) {
        requests.unshift(api.get('/doctors'));
      }

      const responses = await Promise.all(requests);
      let doctorsResponse = null;
      let servicesResponse = null;
      let patientsResponse = null;

      if (isDoctor) {
        [servicesResponse, patientsResponse] = responses;
      } else {
        [doctorsResponse, servicesResponse, patientsResponse] = responses;
      }

      setServices((servicesResponse?.data?.services || []).filter((service) => service.active !== false));
      setPatients(patientsResponse?.data?.patients || []);

      if (!isDoctor) {
        setDoctors((doctorsResponse?.data?.doctors || []).filter((doctor) => doctor.active !== false));
      }
    } catch (error) {
      toast.error(error.message || 'فشل في تحميل بيانات الحجز اليدوي');
    } finally {
      setLoading(false);
    }
  };

  const selectedService = useMemo(
    () => services.find((service) => service.id === form.serviceId) || null,
    [form.serviceId, services]
  );

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === form.patientId) || null,
    [form.patientId, patients]
  );

  const selectedDoctor = useMemo(() => {
    if (isDoctor) {
      return doctorProfile || null;
    }

    return doctors.find((doctor) => doctor.id === form.doctorId) || null;
  }, [doctorProfile, doctors, form.doctorId, isDoctor]);

  const handleFormChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handlePatientCreate = async (event) => {
    event.preventDefault();

    if (!patientForm.name.trim() || !patientForm.phone.trim()) {
      toast.error('اسم المريض ورقم الهاتف مطلوبان');
      return;
    }

    try {
      setCreatingPatient(true);
      const response = await api.post('/patients', patientForm);
      const createdPatient = response.data.patient;

      setPatients((current) => [createdPatient, ...current]);
      setForm((current) => ({ ...current, patientId: createdPatient.id }));
      setPatientForm(emptyPatientForm);
      setShowPatientCreator(false);
      toast.success('تم إنشاء المريض واختياره للحجز');
    } catch (error) {
      toast.error(error.message || 'فشل في إنشاء المريض');
    } finally {
      setCreatingPatient(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const effectiveDoctorId = isDoctor ? doctorProfile?.id : form.doctorId;

    if (!form.patientId || !effectiveDoctorId || !form.serviceId || !form.date || !form.time) {
      toast.error('اختر المريض والطبيب والخدمة والموعد أولًا');
      return;
    }

    try {
      setSubmitting(true);
      setAlternatives([]);

      const response = await api.post('/appointments', {
        patientId: form.patientId,
        doctorId: effectiveDoctorId,
        serviceId: form.serviceId,
        scheduledTime: `${form.date}T${form.time}:00`,
        notes: form.notes || undefined,
        confirmImmediately: form.confirmImmediately,
        notifyPatient: form.notifyPatient,
      });

      const appointment = response.data.appointment;
      setLastBooking(appointment);
      setForm((current) => ({
        ...current,
        patientId: '',
        serviceId: '',
        time: '',
        notes: '',
        confirmImmediately: true,
        notifyPatient: true,
      }));

      toast.success(
        form.confirmImmediately
          ? 'تم إنشاء الموعد وتأكيده وإرسال رسالة للمريض'
          : 'تم إنشاء الموعد بنجاح'
      );
      onCreated?.(appointment);
    } catch (error) {
      const apiAlternatives = error.data?.alternatives || [];
      if (apiAlternatives.length > 0) {
        setAlternatives(apiAlternatives);
      }

      toast.error(error.message || 'فشل في إنشاء الموعد');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="glass-card p-6 md:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarPlus className="w-5 h-5 text-primary-400" />
            الحجز اليدوي
          </h2>
          <p className="text-sm text-dark-muted mt-1">
            يستخدمه الطبيب أو الريسيبشن لإنشاء موعد مباشر، مع كود حجز ورسالة تأكيد تلقائية للمريض.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowPatientCreator((current) => !current)}
          className="inline-flex items-center gap-2 rounded-xl border border-primary-500/20 bg-primary-500/10 px-4 py-2 text-sm font-bold text-primary-300 transition hover:bg-primary-500/20"
        >
          <UserPlus className="w-4 h-4" />
          {showPatientCreator ? 'إخفاء إنشاء المريض' : 'إنشاء مريض سريع'}
        </button>
      </div>

      {showPatientCreator && (
        <form onSubmit={handlePatientCreate} className="grid gap-4 rounded-2xl border border-dark-border bg-dark-bg/40 p-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-dark-muted">اسم المريض</label>
            <input
              value={patientForm.name}
              onChange={(event) => setPatientForm((current) => ({ ...current, name: event.target.value }))}
              className="input-field"
              placeholder="اسم المريض"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-dark-muted">رقم الهاتف</label>
            <input
              value={patientForm.phone}
              onChange={(event) => setPatientForm((current) => ({ ...current, phone: event.target.value }))}
              className="input-field"
              placeholder="9665xxxxxxx+"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-dark-muted">القناة الأساسية</label>
            <select
              value={patientForm.platform}
              onChange={(event) => setPatientForm((current) => ({ ...current, platform: event.target.value }))}
              className="input-field"
            >
              <option value="WHATSAPP">واتساب</option>
              <option value="FACEBOOK">Messenger</option>
              <option value="INSTAGRAM">Instagram</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-dark-muted">ملاحظات</label>
            <input
              value={patientForm.notes}
              onChange={(event) => setPatientForm((current) => ({ ...current, notes: event.target.value }))}
              className="input-field"
              placeholder="اختياري"
            />
          </div>

          <div className="md:col-span-2 xl:col-span-4 flex justify-end">
            <button type="submit" disabled={creatingPatient} className="btn-primary">
              {creatingPatient ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <PlusCircle className="w-4 h-4" />
              )}
              حفظ المريض
            </button>
          </div>
        </form>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-dark-muted">المريض</label>
          <select
            value={form.patientId}
            onChange={(event) => handleFormChange('patientId', event.target.value)}
            className="input-field"
            disabled={loading}
          >
            <option value="">اختر المريض</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name} {patient.phone ? `- ${patient.phone}` : ''}
              </option>
            ))}
          </select>
          {selectedPatient?.phone ? (
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" />
              {selectedPatient.phone}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-dark-muted">الطبيب</label>
          <select
            value={isDoctor ? doctorProfile?.id || '' : form.doctorId}
            onChange={(event) => handleFormChange('doctorId', event.target.value)}
            className="input-field"
            disabled={loading || isDoctor}
          >
            <option value="">اختر الطبيب</option>
            {(isDoctor ? [doctorProfile].filter(Boolean) : doctors).map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name} {doctor.specialization ? `- ${doctor.specialization}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-dark-muted">الخدمة</label>
          <select
            value={form.serviceId}
            onChange={(event) => handleFormChange('serviceId', event.target.value)}
            className="input-field"
            disabled={loading}
          >
            <option value="">اختر الخدمة</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.nameAr || service.name}
              </option>
            ))}
          </select>
          {selectedService ? (
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <Clock3 className="w-3.5 h-3.5" />
              {selectedService.duration} دقيقة
              {selectedService.price ? `• ${Number(selectedService.price).toLocaleString('ar-IQ')} د.ع` : ''}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-dark-muted">التاريخ</label>
          <input
            type="date"
            value={form.date}
            onChange={(event) => handleFormChange('date', event.target.value)}
            className="input-field"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-dark-muted">الوقت</label>
          <input
            type="time"
            value={form.time}
            onChange={(event) => handleFormChange('time', event.target.value)}
            className="input-field"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-xs font-bold text-dark-muted">ملاحظات داخلية</label>
          <input
            value={form.notes}
            onChange={(event) => handleFormChange('notes', event.target.value)}
            className="input-field"
            placeholder="مثال: متابعة بعد الحشو"
          />
        </div>

        <div className="space-y-3 md:col-span-2 xl:col-span-4 rounded-2xl border border-dark-border bg-dark-bg/40 p-4">
          <label className="flex items-center gap-3 text-sm text-white">
            <input
              type="checkbox"
              checked={form.confirmImmediately}
              onChange={(event) => handleFormChange('confirmImmediately', event.target.checked)}
              className="h-4 w-4 rounded border-dark-border bg-dark-card text-primary-500"
            />
            تثبيت الموعد مباشرة بعد الإنشاء
          </label>

          <label className="flex items-center gap-3 text-sm text-white">
            <input
              type="checkbox"
              checked={form.notifyPatient}
              onChange={(event) => handleFormChange('notifyPatient', event.target.checked)}
              className="h-4 w-4 rounded border-dark-border bg-dark-card text-primary-500"
            />
            إرسال رسالة تأكيد للمريض
          </label>
        </div>

        <div className="xl:col-span-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-xs text-slate-400">
            {selectedDoctor ? `الطبيب المختار: ${selectedDoctor.name}` : 'اختر الطبيب'}{' '}
            {selectedService ? `• الخدمة: ${selectedService.nameAr || selectedService.name}` : ''}
          </div>

          <button type="submit" disabled={loading || submitting} className="btn-primary">
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CalendarPlus className="w-4 h-4" />
            )}
            إنشاء الموعد
          </button>
        </div>
      </form>

      {lastBooking ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            تم إنشاء الحجز
          </div>
          <p className="mt-2">كود الحجز: <span className="font-bold">{lastBooking.bookingRef || '—'}</span></p>
        </div>
      ) : null}

      {alternatives.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-bold">الموعد غير متاح. هذه أقرب البدائل:</p>
          <ul className="mt-3 space-y-1 text-xs text-amber-50">
            {alternatives.map((alternative, index) => (
              <li key={`${alternative.time || alternative.label}-${index}`}>- {alternative.label}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
