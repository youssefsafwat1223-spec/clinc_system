import { useEffect, useMemo, useRef, useState } from 'react';
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

const normalizePhone = (value = '') => String(value || '').replace(/\D/g, '');
const BOOKING_MODES = {
  NEW_PATIENT: 'new_patient',
  WHATSAPP_CONTACT: 'whatsapp_contact',
};

// نوع الحجز: يدوي عادي أو متابعة لمريض سابق.
const BOOKING_KINDS = {
  MANUAL: 'manual',
  FOLLOW_UP: 'follow_up',
};

// المتابعة ممكن تكون مجانية أو بمال (الطبيب يحدد المبلغ بعدين في popup السن).
const FOLLOW_UP_TYPES = {
  FREE: 'free',
  PAID: 'paid',
};

// نشيل أي tag متابعة قديم قبل ما نضيف tag جديد، عشان ما نكرّرش.
const stripFollowUpTag = (notes = '') => String(notes || '').replace(/\[follow-up:(free|paid)\]\s*/gi, '').trim();

export default function ManualBookingPanel({ isDoctor, doctorProfile, onCreated, initialPhone = '', initialPatientId = '' }) {
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [showPatientCreator, setShowPatientCreator] = useState(false);
  const [alternatives, setAlternatives] = useState([]);
  const [lastBooking, setLastBooking] = useState(null);
  const [bookingMode, setBookingMode] = useState(
    initialPhone ? BOOKING_MODES.WHATSAPP_CONTACT : BOOKING_MODES.NEW_PATIENT
  );
  const [bookingKind, setBookingKind] = useState(BOOKING_KINDS.MANUAL);
  const [followUpType, setFollowUpType] = useState(FOLLOW_UP_TYPES.FREE);

  const [form, setForm] = useState({
    patientId: '',
    doctorId: '',
    serviceId: '',
    appointmentType: 'WALK_IN',
    targetType: 'SELF',
    familyName: '',
    date: todayDateValue(),
    time: '',
    notes: '',
    confirmImmediately: true,
    notifyPatient: true,
  });

  const [patientForm, setPatientForm] = useState(emptyPatientForm);
  const [patientSearch, setPatientSearch] = useState(initialPhone || '');

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

  useEffect(() => {
    setPatientSearch(initialPhone || '');
    setBookingMode(initialPhone ? BOOKING_MODES.WHATSAPP_CONTACT : BOOKING_MODES.NEW_PATIENT);
  }, [initialPhone]);

  useEffect(() => {
    setShowPatientCreator(bookingMode === BOOKING_MODES.NEW_PATIENT);
    if (bookingMode === BOOKING_MODES.NEW_PATIENT) {
      setPatientForm((current) => ({
        ...current,
        platform: 'WHATSAPP',
        phone: current.phone || initialPhone,
      }));
    }
  }, [bookingMode, initialPhone]);

  // في وضع المتابعة بنختار خدمة "متابعة" المخصصة لو موجودة، وإلا أول خدمة (مع تنبيه).
  // كمان بنقفل إرسال التأكيد افتراضيًا عشان رسالة الـ template بتذكر اسم الخدمة وممكن تربك المريض.
  useEffect(() => {
    if (bookingKind !== BOOKING_KINDS.FOLLOW_UP) return;
    if (!services.length) return;
    const followUpService =
      services.find((service) =>
        /(^|\s)متابعة(\s|$)|follow[- ]?up/i.test(`${service.nameAr || ''} ${service.name || ''}`)
      ) || services[0];
    setForm((current) => ({
      ...current,
      serviceId: followUpService.id,
      notifyPatient: false,
    }));
  }, [bookingKind, services]);

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

  // Server-side search: the initial fetch is capped, so without this any
  // patient outside that window can never be found by name or phone.
  const searchTimer = useRef(null);
  useEffect(() => {
    const term = patientSearch.trim();
    if (term.length < 2) return undefined;

    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const digits = normalizePhone(term);
        const queryTerm = digits.length >= 4 ? digits : term;
        const res = await api.get('/patients', { params: { search: queryTerm, limit: 25 } });
        const found = res.data.patients || [];
        if (found.length === 0) return;
        setPatients((current) => {
          const seen = new Set(current.map((patient) => patient.id));
          const merged = [...current];
          found.forEach((patient) => {
            if (!seen.has(patient.id)) merged.push(patient);
          });
          return merged;
        });
      } catch {
        // Search failures are non-fatal; the locally loaded list still works.
      }
    }, 300);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [patientSearch]);

  const filteredPatients = useMemo(() => {
    const term = patientSearch.trim().toLowerCase();
    if (!term) return patients;

    const normalizedTerm = normalizePhone(term);
    return patients.filter((patient) => {
      const nameMatch = String(patient.name || '').toLowerCase().includes(term);
      const displayNameMatch = String(patient.displayName || '').toLowerCase().includes(term);
      const phoneMatch = normalizedTerm
        ? normalizePhone(patient.phone || '').includes(normalizedTerm)
        : String(patient.phone || '').toLowerCase().includes(term);
      return nameMatch || displayNameMatch || phoneMatch;
    });
  }, [patientSearch, patients]);

  const selectedDoctor = useMemo(() => {
    if (isDoctor) {
      return doctorProfile || null;
    }

    return doctors.find((doctor) => doctor.id === form.doctorId) || null;
  }, [doctorProfile, doctors, form.doctorId, isDoctor]);

  const handleFormChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  useEffect(() => {
    if (initialPatientId && patients.some((patient) => patient.id === initialPatientId)) {
      setForm((current) => ({
        ...current,
        patientId: current.patientId || initialPatientId,
      }));
      setBookingMode(BOOKING_MODES.WHATSAPP_CONTACT);
      return;
    }

    if (!patients.length || !initialPhone) return;

    const normalizedTarget = normalizePhone(initialPhone);
    const matchedPatient = patients.find((patient) => normalizePhone(patient.phone || '') === normalizedTarget);

    if (matchedPatient) {
      setForm((current) => ({
        ...current,
        patientId: current.patientId || matchedPatient.id,
      }));
      setBookingMode(BOOKING_MODES.WHATSAPP_CONTACT);
      return;
    }

    setPatientForm((current) => ({
      ...current,
      phone: current.phone || initialPhone,
    }));
  }, [initialPatientId, initialPhone, patients]);

  const switchBookingMode = (mode) => {
    setBookingMode(mode);
    if (mode === BOOKING_MODES.NEW_PATIENT) {
      setForm((current) => ({ ...current, patientId: '' }));
      return;
    }

    setPatientSearch(initialPhone || '');
  };

  const handlePatientCreate = async (event) => {
    event.preventDefault();

    if (!patientForm.name.trim() || !patientForm.phone.trim()) {
      toast.error('اسم المريض ورقم الهاتف مطلوبان');
      return;
    }

    const normalizedPhone = normalizePhone(patientForm.phone);
    const existingPatient = patients.find((patient) => normalizePhone(patient.phone || '') === normalizedPhone);
    if (existingPatient) {
      setForm((current) => ({ ...current, patientId: existingPatient.id }));
      setPatientSearch(existingPatient.phone || patientForm.phone);
      setShowPatientCreator(false);
      toast.info('هذا الرقم مسجل بالفعل، وتم اختيار المريض الموجود.');
      return;
    }

    try {
      setCreatingPatient(true);
      const response = await api.post('/patients', patientForm);
      const createdPatient = response.data.patient;

      setPatients((current) => [createdPatient, ...current]);
      setForm((current) => ({ ...current, patientId: createdPatient.id }));
      setPatientSearch(createdPatient.phone || '');
      setPatientForm(emptyPatientForm);
      setShowPatientCreator(false);
      toast.success('تم إنشاء المريض واختياره للحجز');
    } catch (error) {
      const duplicatePatient = error.data?.patient;
      if (duplicatePatient?.id) {
        setPatients((current) => {
          const exists = current.some((item) => item.id === duplicatePatient.id);
          return exists ? current : [duplicatePatient, ...current];
        });
        setForm((current) => ({ ...current, patientId: duplicatePatient.id }));
        setPatientSearch(duplicatePatient.phone || patientForm.phone);
        setShowPatientCreator(false);
        toast.info('هذا الرقم مسجل بالفعل، وتم اختيار المريض الموجود.');
        return;
      }
      toast.error(error.message || 'فشل في إنشاء المريض');
    } finally {
      setCreatingPatient(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const effectiveDoctorId = isDoctor ? doctorProfile?.id : form.doctorId;

    const requiresTime = form.appointmentType !== 'WALK_IN';
    const bookingForFamily = form.targetType === 'FAMILY';

    if (!form.patientId || !effectiveDoctorId || !form.serviceId || !form.date || (requiresTime && !form.time)) {
      toast.error(requiresTime ? 'اختر المريض والطبيب والخدمة والموعد أولًا' : 'اختر المريض والطبيب والخدمة والتاريخ أولًا');
      return;
    }

    if (bookingForFamily && !form.familyName.trim()) {
      toast.error('اكتب اسم فرد العائلة أولًا');
      return;
    }

    if (bookingForFamily && !selectedPatient?.phone) {
      toast.error('اختر مريضًا له رقم هاتف حتى يتم الحجز لأحد أفراد العائلة');
      return;
    }

    try {
      setSubmitting(true);
      setAlternatives([]);

      let targetPatientId = form.patientId;

      if (bookingForFamily) {
        const createdPatientResponse = await api.post('/patients', {
          name: form.familyName.trim(),
          phone: selectedPatient.phone,
          platform: selectedPatient.platform || 'WHATSAPP',
          notes: form.notes || undefined,
          profileType: 'BOOKED',
        });

        const familyPatient = createdPatientResponse.data.patient;
        targetPatientId = familyPatient.id;
        setPatients((current) => [familyPatient, ...current.filter((patient) => patient.id !== familyPatient.id)]);
      }

      // لو ده حجز متابعة بنضيف tag في أول الـ notes عشان نميّز المتابعة (مجاني/بمال)
      // في popup السن لاحقًا. الـ tag بيتشال أي tag قديم قبله.
      const baseNotes = stripFollowUpTag(form.notes || '');
      const followUpTag =
        bookingKind === BOOKING_KINDS.FOLLOW_UP ? `[follow-up:${followUpType}]` : '';
      const finalNotes = followUpTag
        ? `${followUpTag}${baseNotes ? ' ' + baseNotes : ''}`
        : baseNotes;

      const response = await api.post('/appointments', {
        patientId: targetPatientId,
        doctorId: effectiveDoctorId,
        serviceId: form.serviceId,
        appointmentType: form.appointmentType,
        scheduledTime: form.appointmentType === 'WALK_IN' ? form.date : `${form.date}T${form.time}:00`,
        notes: finalNotes || undefined,
        confirmImmediately: form.confirmImmediately,
        notifyPatient: form.notifyPatient,
      });

      const appointment = response.data.appointment;
      setLastBooking(appointment);
      setForm((current) => ({
        ...current,
        patientId: '',
        serviceId: '',
        appointmentType: 'WALK_IN',
        targetType: 'SELF',
        familyName: '',
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

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => switchBookingMode(BOOKING_MODES.NEW_PATIENT)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition ${
              bookingMode === BOOKING_MODES.NEW_PATIENT
                ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                : 'border-sky-500/20 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            مريض جديد
          </button>
          <button
            type="button"
            onClick={() => switchBookingMode(BOOKING_MODES.WHATSAPP_CONTACT)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition ${
              bookingMode === BOOKING_MODES.WHATSAPP_CONTACT
                ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                : 'border-sky-500/20 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20'
            }`}
          >
            <Phone className="w-4 h-4" />
            مريض تواصل من الواتساب
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-dark-border bg-dark-bg/40 p-4 text-sm text-slate-300">
        {bookingMode === BOOKING_MODES.NEW_PATIENT ? (
          <p>هذا الوضع لمريض جديد. اكتب رقم الهاتف مع كود الدولة مثل <span dir="ltr">9647xxxxxxxxx</span> ثم أنشئ الموعد وسيصل له التأكيد تلقائياً.</p>
        ) : (
          <p>هذا الوضع لمريض تواصل من الواتساب. ابحث بالرقم أو الاسم، ثم اختر المريض مباشرة لإكمال الحجز وإرسال التأكيد.</p>
        )}
      </div>

      {/* نوع الحجز: يدوي عادي أو متابعة لمريض سابق (الافتراضي: يدوي). */}
      <div className="rounded-2xl border border-dark-border bg-dark-bg/40 p-4">
        <p className="mb-2 text-xs font-bold text-slate-300">نوع الحجز</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setBookingKind(BOOKING_KINDS.MANUAL)}
            className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
              bookingKind === BOOKING_KINDS.MANUAL
                ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            📋 حجز يدوي
          </button>
          <button
            type="button"
            onClick={() => setBookingKind(BOOKING_KINDS.FOLLOW_UP)}
            className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
              bookingKind === BOOKING_KINDS.FOLLOW_UP
                ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            🔄 حجز متابعة
          </button>
        </div>

        {bookingKind === BOOKING_KINDS.FOLLOW_UP ? (
          <div className="mt-3 space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-50">
            <p className="font-bold">المتابعة من غير اختيار خدمة. اختر نوعها:</p>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="followUpType"
                  value={FOLLOW_UP_TYPES.FREE}
                  checked={followUpType === FOLLOW_UP_TYPES.FREE}
                  onChange={() => setFollowUpType(FOLLOW_UP_TYPES.FREE)}
                  className="accent-emerald-500"
                />
                🆓 مجاني
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="followUpType"
                  value={FOLLOW_UP_TYPES.PAID}
                  checked={followUpType === FOLLOW_UP_TYPES.PAID}
                  onChange={() => setFollowUpType(FOLLOW_UP_TYPES.PAID)}
                  className="accent-amber-500"
                />
                💰 بمال (الطبيب يحدد المبلغ من popup السن)
              </label>
            </div>
            {!services.some((service) =>
              /(^|\s)متابعة(\s|$)|follow[- ]?up/i.test(`${service.nameAr || ''} ${service.name || ''}`)
            ) ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-100">
                ⚠️ مفيش خدمة اسمها "متابعة" في القائمة. هنستخدم أول خدمة متاحة، يفضّل تعمل خدمة جديدة اسمها "متابعة" من شاشة إعدادات الخدمات عشان رسائل التأكيد للمريض ما تربكش (إرسال التأكيد متقفل افتراضيًا للمتابعات).
              </p>
            ) : null}
          </div>
        ) : null}
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
              placeholder="9647xxxxxxxxx"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-dark-muted">القناة الأساسية</label>
            <input value="واتساب" className="input-field" disabled />
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
            <label className="text-xs font-bold text-dark-muted">بحث باسم المريض أو الرقم</label>
            <input
              value={patientSearch}
              onChange={(event) => setPatientSearch(event.target.value)}
              className="input-field"
              placeholder={bookingMode === BOOKING_MODES.WHATSAPP_CONTACT ? 'ابحث برقم الواتساب أو الاسم' : 'ابحث بالاسم أو رقم الهاتف'}
            />
          </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-dark-muted">المريض</label>
          <select
            value={form.patientId}
            onChange={(event) => handleFormChange('patientId', event.target.value)}
            className="input-field"
            disabled={loading}
          >
            <option value="">اختر المريض</option>
            {filteredPatients.map((patient) => (
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

        {bookingKind === BOOKING_KINDS.FOLLOW_UP ? (
          <div className="space-y-2">
            <label className="text-xs font-bold text-dark-muted">الخدمة</label>
            <div className="input-field flex items-center text-slate-400">
              متابعة (من غير اختيار خدمة)
            </div>
          </div>
        ) : (
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
        )}

        <div className="space-y-2">
          <label className="text-xs font-bold text-dark-muted">نوع الحجز</label>
          <select
            value={form.appointmentType}
            onChange={(event) => handleFormChange('appointmentType', event.target.value)}
            className="input-field"
          >
            <option value="WALK_IN">حجز بدون موعد</option>
            <option value="SCHEDULED">حجز بموعد</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-dark-muted">الحجز باسم</label>
          <select
            value={form.targetType}
            onChange={(event) => handleFormChange('targetType', event.target.value)}
            className="input-field"
          >
            <option value="SELF">المريض نفسه</option>
            <option value="FAMILY">أحد أفراد العائلة</option>
          </select>
        </div>

        {form.targetType === 'FAMILY' ? (
          <div className="space-y-2">
            <label className="text-xs font-bold text-dark-muted">اسم فرد العائلة</label>
            <input
              value={form.familyName}
              onChange={(event) => handleFormChange('familyName', event.target.value)}
              className="input-field"
              placeholder="يُحجز على نفس رقم المريض المختار"
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-xs font-bold text-dark-muted">التاريخ</label>
          <input
            type="date"
            value={form.date}
            onChange={(event) => handleFormChange('date', event.target.value)}
            className="input-field"
          />
        </div>

        {form.appointmentType === 'SCHEDULED' ? (
          <div className="space-y-2">
            <label className="text-xs font-bold text-dark-muted">الوقت</label>
            <input
              type="time"
              value={form.time}
              onChange={(event) => handleFormChange('time', event.target.value)}
              className="input-field"
            />
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            <p className="font-bold">ملاحظة للمريض</p>
            <p className="mt-1">سيتم إرسال تأكيد بأن الدخول حسب أسبقية الحضور، والشخص الذي يصل أولاً يدخل أولاً.</p>
          </div>
        )}

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
