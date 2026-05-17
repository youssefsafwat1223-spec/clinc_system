import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { PlusCircle, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../api/client';
import { DataCard, Field, PrimaryButton, SecondaryButton, inputClass } from '../ui';
import { TOOTH_2D_CLASS, TOOTH_LEGEND, toothState } from './toothState';

const Teeth3DChart = lazy(() => import('./Teeth3DChart'));

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

const toothType = (number) => {
  const n = Number(number);
  const molars = [1, 2, 3, 14, 15, 16, 17, 18, 19, 30, 31, 32];
  const premolars = [4, 5, 12, 13, 20, 21, 28, 29];
  const canines = [6, 11, 22, 27];
  if (molars.includes(n)) return 'molar';
  if (premolars.includes(n)) return 'premolar';
  if (canines.includes(n)) return 'canine';
  return 'incisor';
};

const shapePath = {
  molar:
    'M-23,-18 C-32,-8 -30,12 -18,21 C-8,29 8,29 18,21 C30,12 32,-8 23,-18 C14,-28 -14,-28 -23,-18Z',
  premolar:
    'M-18,-18 C-27,-7 -24,12 -12,20 C-4,25 4,25 12,20 C24,12 27,-7 18,-18 C9,-27 -9,-27 -18,-18Z',
  canine: 'M0,-30 C-17,-22 -23,-7 -17,12 C-10,30 10,30 17,12 C23,-7 17,-22 0,-30Z',
  incisor: 'M-17,-12 C-15,-25 15,-25 17,-12 L15,17 C7,25 -7,25 -15,17Z',
};

const grooves = {
  molar: (
    <>
      <path d="M-12,-8 C-4,-2 4,-2 12,-8" />
      <path d="M-12,9 C-4,2 4,2 12,9" />
      <path d="M0,-15 L0,16" />
      <path d="M-15,0 L15,0" />
    </>
  ),
  premolar: (
    <>
      <path d="M-9,-8 C-2,-3 2,-3 9,-8" />
      <path d="M-10,8 C-2,3 2,3 10,8" />
      <path d="M0,-12 L0,14" />
    </>
  ),
  canine: <path d="M-7,8 C-2,1 2,1 7,8" />,
  incisor: <path d="M-9,2 C-3,5 3,5 9,2" />,
};

const buildArch = (start, yBase, invert = false) => {
  const teeth = [];
  for (let index = 0; index < 16; index += 1) {
    const number = start + index;
    const progress = index / 15;
    const x = 95 + progress * 710;
    const curve = Math.sin(progress * Math.PI);
    const y = invert ? yBase + curve * 118 : yBase - curve * 118;
    const rotation = (progress - 0.5) * (invert ? -70 : 70);
    const type = toothType(number);
    const scale = type === 'molar' ? 1.05 : type === 'premolar' ? 0.92 : type === 'canine' ? 0.86 : 0.78;
    teeth.push({ number: String(number), x, y, rotation, type, scale });
  }
  return teeth;
};

const upperTeeth = buildArch(1, 248, false);
const lowerTeeth = buildArch(17, 512, true);

function DentalArch2D({ teeth, services, selectedTooth, onSelectTooth }) {
  const renderTooth = (tooth) => {
    const entry = teeth[tooth.number] || {};
    const state = toothState(entry);
    const isSelected = selectedTooth === tooth.number;
    const serviceName =
      services.find((service) => service.id === entry.serviceId)?.nameAr ||
      services.find((service) => service.id === entry.serviceId)?.name;
    const tooltip = [
      `سن ${tooth.number}`,
      entry.note ? `ملاحظة: ${entry.note}` : null,
      serviceName ? `خدمة: ${serviceName}` : null,
      entry.done ? 'تمت الخدمة' : null,
    ]
      .filter(Boolean)
      .join(' - ');
    const classes = isSelected ? TOOTH_2D_CLASS.selected : TOOTH_2D_CLASS[state];

    return (
      <button
        key={tooth.number}
        type="button"
        title={tooltip}
        aria-label={tooltip}
        aria-pressed={isSelected}
        onClick={() => onSelectTooth(tooth.number)}
        className="absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
        style={{ left: `${(tooth.x / 900) * 100}%`, top: `${(tooth.y / 760) * 100}%` }}
      >
        <svg
          viewBox="-42 -42 84 84"
          className="h-14 w-14 overflow-visible drop-shadow-sm md:h-16 md:w-16"
          style={{ transform: `rotate(${tooth.rotation}deg) scale(${tooth.scale})` }}
          aria-hidden="true"
        >
          {isSelected ? (
            <path d={shapePath[tooth.type]} className="fill-none stroke-sky-400" strokeWidth="7" />
          ) : null}
          <path d={shapePath[tooth.type]} className={`${classes} transition`} strokeWidth="2.5" />
          <g className={isSelected ? 'stroke-white/75' : 'stroke-slate-400'} fill="none" strokeWidth="1.8" strokeLinecap="round">
            {grooves[tooth.type]}
          </g>
          <text
            x="0"
            y="5"
            textAnchor="middle"
            className={isSelected ? 'fill-white' : 'fill-slate-800'}
            style={{ fontSize: 13, fontWeight: 900 }}
          >
            {tooth.number}
          </text>
        </svg>
      </button>
    );
  };

  return (
    <div className="relative min-h-[520px] overflow-hidden rounded-3xl border border-white/10 bg-[#fffaf0] p-3 shadow-inner md:min-h-[640px]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 900 760" aria-hidden="true" preserveAspectRatio="none">
        <defs>
          <linearGradient id="palateGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f6dfbd" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#f9ead3" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id="mandibleGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f9ead3" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#f0d4a8" stopOpacity="0.75" />
          </linearGradient>
        </defs>
        <path
          d="M450 58 C235 58 105 150 82 300 C190 236 308 210 450 210 C592 210 710 236 818 300 C795 150 665 58 450 58Z"
          fill="url(#palateGradient)"
          stroke="#e8c999"
          strokeWidth="2"
        />
        <path
          d="M450 702 C235 702 105 610 82 460 C190 524 308 550 450 550 C592 550 710 524 818 460 C795 610 665 702 450 702Z"
          fill="url(#mandibleGradient)"
          stroke="#e8c999"
          strokeWidth="2"
        />
        <path d="M160 282 C280 176 620 176 740 282" fill="none" stroke="#c9a877" strokeWidth="4" opacity="0.5" />
        <path d="M160 478 C280 584 620 584 740 478" fill="none" stroke="#c9a877" strokeWidth="4" opacity="0.5" />
        <text x="450" y="42" textAnchor="middle" fill="#6b5b45" fontSize="24" fontWeight="800">
          Upper jaw
        </text>
        <text x="450" y="735" textAnchor="middle" fill="#6b5b45" fontSize="24" fontWeight="800">
          Lower jaw
        </text>
      </svg>
      {[...upperTeeth, ...lowerTeeth].map(renderTooth)}
    </div>
  );
}

export default function TeethChart({
  patientId,
  value = {},
  teethNotes,
  services: providedServices,
  doctors: providedDoctors,
  currentDoctorId = '',
  onSaved,
  onSaveTooth,
  onAddService,
  readonly = false,
  saveSignal = 0,
  showSaveButton = true,
}) {
  const sourceValue = teethNotes || value;
  const [selectedTooth, setSelectedTooth] = useState('1');
  const [teeth, setTeeth] = useState({});
  const [services, setServices] = useState(providedServices || []);
  const [doctors, setDoctors] = useState(providedDoctors || []);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('2D');
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState(defaultServiceForm);
  const previousSaveSignal = useRef(saveSignal);

  useEffect(() => {
    const normalized = {};
    Object.entries(sourceValue || {}).forEach(([key, entry]) => {
      normalized[key] = normalizeEntry(entry);
    });
    setTeeth(normalized);
  }, [sourceValue]);

  useEffect(() => {
    if (providedServices) setServices(providedServices);
  }, [providedServices]);

  useEffect(() => {
    if (providedDoctors) setDoctors(providedDoctors);
  }, [providedDoctors]);

  useEffect(() => {
    if (providedServices && providedDoctors) return;
    const loadSupport = async () => {
      try {
        const [servicesRes, doctorsRes] = await Promise.all([api.get('/services'), api.get('/doctors')]);
        if (!providedServices) setServices((servicesRes.data.services || []).filter((service) => service.active !== false));
        if (!providedDoctors) setDoctors((doctorsRes.data.doctors || []).filter((doctor) => doctor.active !== false));
      } catch {
        if (!providedServices) setServices([]);
        if (!providedDoctors) setDoctors([]);
      }
    };
    loadSupport();
  }, [providedServices, providedDoctors]);

  const entry = useMemo(() => teeth[selectedTooth] || normalizeEntry({ doctorId: currentDoctorId }), [selectedTooth, teeth, currentDoctorId]);

  const updateEntry = (field, nextValue) => {
    if (readonly) return;
    setTeeth((current) => ({
      ...current,
      [selectedTooth]: {
        ...normalizeEntry(current[selectedTooth] || { doctorId: currentDoctorId }),
        [field]: nextValue,
      },
    }));
  };

  const persistTeeth = async (nextTeeth) => {
    if (onSaveTooth) {
      await onSaveTooth(selectedTooth, nextTeeth[selectedTooth]);
      onSaved?.(nextTeeth);
      return nextTeeth;
    }
    const res = await api.put(`/patients/${patientId}/teeth-notes`, { teeth: nextTeeth });
    return res.data.teeth || res.data.patient?.teethNotes || {};
  };

  const saveCurrentTooth = async () => {
    if (readonly) return;
    const nextTeeth = {
      ...teeth,
      [selectedTooth]: normalizeEntry(teeth[selectedTooth] || { doctorId: currentDoctorId }),
    };
    setSaving(true);
    try {
      const saved = await persistTeeth(nextTeeth);
      setTeeth(saved);
      onSaved?.(saved);
      toast.success('تم حفظ السن');
    } catch (error) {
      toast.error(error.message || 'فشل حفظ السن');
    } finally {
      setSaving(false);
    }
  };

  const saveTeeth = async () => {
    if (readonly) return;
    setSaving(true);
    try {
      const saved = await persistTeeth(teeth);
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
      const payload = {
        ...serviceForm,
        nameAr: serviceForm.nameAr || serviceForm.name,
        name: serviceForm.name || serviceForm.nameAr,
        price: serviceForm.price === '' ? null : Number(serviceForm.price),
        priceFrom: serviceForm.priceFrom === '' ? null : Number(serviceForm.priceFrom),
        priceTo: serviceForm.priceTo === '' ? null : Number(serviceForm.priceTo),
        duration: Number(serviceForm.duration) || 30,
      };
      const created = onAddService ? await onAddService(payload) : (await api.post('/services', payload)).data.service;
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
      <div className="grid gap-6 2xl:grid-cols-[minmax(620px,1fr)_360px]">
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black text-white">خريطة الأسنان</h3>
            <div className="flex rounded-2xl border border-white/10 bg-white/5 p-1">
              {['2D', '3D'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                    viewMode === mode ? 'bg-sky-500 text-white' : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {viewMode === '3D' ? (
            <Suspense
              fallback={
                <div className="flex h-[520px] items-center justify-center rounded-3xl border border-white/10 bg-slate-950 text-sm font-bold text-slate-300">
                  Loading 3D dental chart...
                </div>
              }
            >
              <Teeth3DChart
                teethNotes={teeth}
                selectedTooth={selectedTooth}
                onSelectTooth={(toothNumber) => setSelectedTooth(String(toothNumber))}
              />
            </Suspense>
          ) : (
            <DentalArch2D teeth={teeth} services={services} selectedTooth={selectedTooth} onSelectTooth={setSelectedTooth} />
          )}

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-bold text-slate-300">
            {TOOTH_LEGEND.map((item) => (
              <span key={item.state} className="inline-flex items-center gap-1.5">
                <span className={`h-3 w-3 rounded-full ${item.dot}`} />
                {item.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-sky-500 ring-2 ring-sky-300" />
              محدد
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h4 className="mb-3 text-base font-black text-white">سن رقم {selectedTooth}</h4>
            <Field label="ملاحظة السن">
              <textarea
                className={inputClass}
                rows={4}
                value={entry.note}
                disabled={readonly}
                onChange={(event) => updateEntry('note', event.target.value)}
              />
            </Field>
            <div className="mt-3 grid gap-3">
              <Field label="الخدمة">
                <select className={inputClass} value={entry.serviceId} disabled={readonly} onChange={(event) => updateEntry('serviceId', event.target.value)}>
                  <option value="">اختر الخدمة</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>{service.nameAr || service.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="الطبيب">
                <select className={inputClass} value={entry.doctorId || currentDoctorId} disabled={readonly} onChange={(event) => updateEntry('doctorId', event.target.value)}>
                  <option value="">اختر الطبيب</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>د. {doctor.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="تم عمل الخدمة؟">
                <select className={inputClass} value={entry.done ? 'YES' : 'NO'} disabled={readonly} onChange={(event) => updateEntry('done', event.target.value === 'YES')}>
                  <option value="NO">لا</option>
                  <option value="YES">نعم</option>
                </select>
              </Field>
            </div>
          </div>

          {!readonly && showServiceForm ? (
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
          ) : null}

          {!readonly && !showServiceForm ? (
            <SecondaryButton type="button" onClick={() => setShowServiceForm(true)} className="w-full">
              <PlusCircle className="h-4 w-4" />
              إضافة خدمة أخرى
            </SecondaryButton>
          ) : null}

          {!readonly ? (
            <PrimaryButton type="button" onClick={saveCurrentTooth} disabled={saving} className="w-full">
              <Save className="h-4 w-4" />
              حفظ السن المحدد
            </PrimaryButton>
          ) : null}

          {!readonly && showSaveButton ? (
            <SecondaryButton type="button" onClick={saveTeeth} disabled={saving} className="w-full">
              حفظ كل خريطة الأسنان
            </SecondaryButton>
          ) : null}
        </div>
      </div>
    </DataCard>
  );
}
