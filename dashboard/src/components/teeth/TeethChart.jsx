import { useEffect, useMemo, useRef, useState } from 'react';
import { PlusCircle, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../api/client';
import { DataCard, Field, PrimaryButton, SecondaryButton, inputClass } from '../ui';

const normalizeEntry = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {
      note: value.note || '',
      serviceId: value.serviceId || '',
      doctorId: value.doctorId || '',
      done: Boolean(value.done),
    };
  }
  return { note: String(value || ''), serviceId: '', doctorId: '', done: false };
};

const defaultServiceForm = {
  nameAr: '',
  name: '',
  description: '',
  price: '',
  priceFrom: '',
  priceTo: '',
  duration: 30,
};

export default function TeethChart({ patientId, value = {}, onSaved, saveSignal = 0, showSaveButton = true }) {
  const [selectedTooth, setSelectedTooth] = useState('1');
  const [teeth, setTeeth] = useState({});
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState(defaultServiceForm);
  const previousSaveSignal = useRef(saveSignal);

  useEffect(() => {
    const normalized = {};
    Object.entries(value || {}).forEach(([key, entry]) => {
      normalized[key] = normalizeEntry(entry);
    });
    setTeeth(normalized);
  }, [value]);

  useEffect(() => {
    const loadSupport = async () => {
      try {
        const [servicesRes, doctorsRes] = await Promise.all([api.get('/services'), api.get('/doctors')]);
        setServices((servicesRes.data.services || []).filter((service) => service.active !== false));
        setDoctors((doctorsRes.data.doctors || []).filter((doctor) => doctor.active !== false));
      } catch {
        setServices([]);
        setDoctors([]);
      }
    };
    loadSupport();
  }, []);

  const entry = useMemo(() => teeth[selectedTooth] || normalizeEntry(''), [selectedTooth, teeth]);
  const toothNumbers = Array.from({ length: 32 }, (_, index) => String(index + 1));
  const positionedTeeth = useMemo(() => {
    const cx = 50;
    const cy = 50;
    const rx = 35;
    const ry = 43;
    return toothNumbers.map((number, index) => {
      const angle = -155 + index * (310 / 31);
      const radians = (angle * Math.PI) / 180;
      return {
        number,
        left: cx + rx * Math.cos(radians),
        top: cy + ry * Math.sin(radians),
      };
    });
  }, [toothNumbers]);

  const updateEntry = (field, nextValue) => {
    setTeeth((current) => ({
      ...current,
      [selectedTooth]: {
        ...normalizeEntry(current[selectedTooth]),
        [field]: nextValue,
      },
    }));
  };

  const saveTeeth = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/patients/${patientId}/teeth-notes`, { teeth });
      const saved = res.data.teeth || res.data.patient?.teethNotes || {};
      setTeeth(saved);
      onSaved?.(saved);
      toast.success('تم حفظ ملاحظات الأسنان');
    } catch (error) {
      toast.error(error.message || 'فشل حفظ ملاحظات الأسنان');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (saveSignal === previousSaveSignal.current) return;
    previousSaveSignal.current = saveSignal;
    if (saveSignal > 0) saveTeeth();
  }, [saveSignal]);

  const createService = async () => {
    if (!serviceForm.nameAr.trim() && !serviceForm.name.trim()) {
      toast.warn('اكتب اسم الخدمة أولاً');
      return;
    }

    try {
      const res = await api.post('/services', {
        ...serviceForm,
        nameAr: serviceForm.nameAr || serviceForm.name,
        name: serviceForm.name || serviceForm.nameAr,
        price: serviceForm.price === '' ? null : Number(serviceForm.price),
        priceFrom: serviceForm.priceFrom === '' ? null : Number(serviceForm.priceFrom),
        priceTo: serviceForm.priceTo === '' ? null : Number(serviceForm.priceTo),
        duration: Number(serviceForm.duration) || 30,
      });
      const created = res.data.service;
      setServices((current) => [created, ...current]);
      updateEntry('serviceId', created.id);
      setServiceForm(defaultServiceForm);
      setShowServiceForm(false);
      toast.success('تم إضافة الخدمة');
    } catch (error) {
      toast.error(error.message || 'فشل إضافة الخدمة');
    }
  };

  return (
    <DataCard>
      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        <div>
          <h3 className="mb-4 text-lg font-black text-white">خريطة الأسنان</h3>
          <div className="relative mx-auto aspect-[0.78] min-h-[430px] w-full max-w-[480px] overflow-hidden rounded-3xl border border-white/10 bg-white p-4 shadow-inner">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
              <ellipse cx="50" cy="50" rx="24" ry="36" fill="none" stroke="#111827" strokeWidth="1.5" />
              <ellipse cx="50" cy="50" rx="36" ry="45" fill="none" stroke="#d1d5db" strokeWidth="1" />
            </svg>
            {positionedTeeth.map(({ number, left, top }) => {
              const hasData = teeth[number]?.note || teeth[number]?.serviceId;
              return (
                <button
                  key={number}
                  type="button"
                  onClick={() => setSelectedTooth(number)}
                  style={{ left: `${left}%`, top: `${top}%` }}
                  className={`absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[42%] border text-sm font-black shadow-sm transition md:h-14 md:w-14 ${
                    selectedTooth === number
                      ? 'border-sky-500 bg-sky-500 text-white'
                      : hasData
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-400 bg-white text-slate-900 hover:border-sky-500 hover:bg-sky-50'
                  }`}
                >
                  {number}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h4 className="mb-3 text-base font-black text-white">سن رقم {selectedTooth}</h4>
            <Field label="ملاحظة السن">
              <textarea className={inputClass} rows={4} value={entry.note} onChange={(event) => updateEntry('note', event.target.value)} />
            </Field>
            <div className="mt-3 grid gap-3">
              <Field label="الخدمة">
                <select className={inputClass} value={entry.serviceId} onChange={(event) => updateEntry('serviceId', event.target.value)}>
                  <option value="">اختر الخدمة</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>{service.nameAr || service.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="الطبيب">
                <select className={inputClass} value={entry.doctorId} onChange={(event) => updateEntry('doctorId', event.target.value)}>
                  <option value="">اختر الطبيب</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>د. {doctor.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="تم عمل الخدمة؟">
                <select className={inputClass} value={entry.done ? 'YES' : 'NO'} onChange={(event) => updateEntry('done', event.target.value === 'YES')}>
                  <option value="NO">لا</option>
                  <option value="YES">نعم</option>
                </select>
              </Field>
            </div>
          </div>

          {showServiceForm ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h4 className="mb-3 text-sm font-black text-white">إضافة خدمة جديدة</h4>
              <div className="grid gap-3">
                {['nameAr', 'name', 'description', 'price', 'priceFrom', 'priceTo', 'duration'].map((field) => (
                  <input
                    key={field}
                    className={inputClass}
                    value={serviceForm[field]}
                    onChange={(event) => setServiceForm((current) => ({ ...current, [field]: event.target.value }))}
                    placeholder={field}
                    type={['price', 'priceFrom', 'priceTo', 'duration'].includes(field) ? 'number' : 'text'}
                  />
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <PrimaryButton type="button" onClick={createService}>حفظ الخدمة</PrimaryButton>
                <SecondaryButton type="button" onClick={() => setShowServiceForm(false)}>إلغاء</SecondaryButton>
              </div>
            </div>
          ) : (
            <SecondaryButton type="button" onClick={() => setShowServiceForm(true)} className="w-full">
              <PlusCircle className="h-4 w-4" />
              إضافة خدمة أخرى
            </SecondaryButton>
          )}

          {showSaveButton ? (
          <PrimaryButton type="button" onClick={saveTeeth} disabled={saving} className="w-full">
            <Save className="h-4 w-4" />
            حفظ ملاحظات الأسنان
          </PrimaryButton>
          ) : null}
        </div>
      </div>
    </DataCard>
  );
}
