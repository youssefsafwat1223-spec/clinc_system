import { useEffect, useMemo, useRef, useState } from 'react';
import { PlusCircle, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../api/client';
import { DataCard, Field, PrimaryButton, SecondaryButton, inputClass } from '../ui';
import { money } from '../../utils/appointmentUi';
import { TOOTH_2D_CLASS, TOOTH_LEGEND, toothState } from './toothState';

const normalizeEntry = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {
      note: value.note || '',
      treatmentNote: value.treatmentNote || '',
      serviceId: value.serviceId || '',
      doctorId: value.doctorId || '',
      status: ['PLANNED', 'IN_PROGRESS', 'DONE'].includes(value.status) ? value.status : value.done ? 'DONE' : 'PLANNED',
      priceBefore: value.priceBefore ?? null,
      discountType: value.discountType === 'PERCENT' ? 'PERCENT' : 'AMOUNT',
      discountValue: value.discountValue ?? null,
      priceAfter: value.priceAfter ?? null,
      requiredAmount: value.requiredAmount ?? null,
      paidAmount: value.paidAmount ?? null,
      remaining: value.remaining ?? null,
      paymentNote: value.paymentNote || '',
      extraChargeId: value.extraChargeId || '',
      linkedPaymentId: value.linkedPaymentId || '',
      groupId: value.groupId || '',
      groupTeeth: Array.isArray(value.groupTeeth) ? value.groupTeeth.map(String) : [],
      groupTotalAmount: value.groupTotalAmount ?? null,
      createdAt: value.createdAt || null,
      createdById: value.createdById || '',
      updatedAt: value.updatedAt || null,
      updatedById: value.updatedById || '',
      done: Boolean(value.done || value.status === 'DONE'),
    };
  }
  return {
    note: String(value || ''),
    treatmentNote: '',
    serviceId: '',
    doctorId: '',
    status: 'PLANNED',
    priceBefore: null,
    discountType: 'AMOUNT',
    discountValue: null,
    priceAfter: null,
    requiredAmount: null,
    paidAmount: null,
    remaining: null,
    paymentNote: '',
    extraChargeId: '',
    linkedPaymentId: '',
    groupId: '',
    groupTeeth: [],
    groupTotalAmount: null,
    createdAt: null,
    createdById: '',
    updatedAt: null,
    updatedById: '',
    done: false,
  };
};

const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const moneyFieldValue = (value) => (value === null || value === undefined ? '' : String(value));

const serviceBasePrice = (service) => toNumberOrNull(service?.price ?? service?.priceFrom ?? service?.priceTo) ?? 0;

const recalcEntry = (entry) => {
  const priceBefore = Math.max(0, toNumberOrNull(entry.priceBefore) ?? 0);
  const discountValue = Math.max(0, toNumberOrNull(entry.discountValue) ?? 0);
  const paidAmount = Math.max(0, toNumberOrNull(entry.paidAmount) ?? 0);
  const priceAfter =
    entry.discountType === 'PERCENT'
      ? Math.max(0, priceBefore - (priceBefore * discountValue) / 100)
      : Math.max(0, priceBefore - discountValue);
  const requiredAmount = toNumberOrNull(entry.requiredAmount) ?? priceAfter;
  const remaining = Math.max(0, requiredAmount - paidAmount);
  return {
    ...entry,
    priceBefore,
    discountValue,
    priceAfter,
    requiredAmount,
    paidAmount,
    remaining,
    done: entry.done || entry.status === 'DONE',
  };
};

const paymentNetAmount = (payment) => {
  const amount = Math.max(0, toNumberOrNull(payment?.amount) ?? 0);
  const finalAmount = toNumberOrNull(payment?.finalAmount);
  if (finalAmount !== null) return Math.max(0, finalAmount);
  return Math.max(0, amount - Math.max(0, toNumberOrNull(payment?.discountAmount) ?? 0));
};

const paymentBaseAmount = (payment) =>
  Math.max(0, toNumberOrNull(payment?.amount) ?? paymentNetAmount(payment));

const defaultServiceForm = {
  nameAr: '',
  name: '',
  description: '',
  price: '',
  priceFrom: '',
  priceTo: '',
  duration: 30,
};

const defaultGroupForm = {
  serviceId: '',
  doctorId: '',
  teeth: [],
  rangeFrom: '1',
  rangeTo: '32',
  priceMode: 'TOTAL',
  price: '',
  paidAmount: '',
  note: '',
  treatmentNote: '',
};

const allToothNumbers = Array.from({ length: 32 }, (_, index) => String(index + 1));
const upperToothNumbers = Array.from({ length: 16 }, (_, index) => String(index + 1));
const lowerToothNumbers = Array.from({ length: 16 }, (_, index) => String(index + 17));

const uniqueSortedTeeth = (items = []) =>
  Array.from(new Set(items.map((item) => String(item)).filter((item) => Number(item) >= 1 && Number(item) <= 32))).sort(
    (a, b) => Number(a) - Number(b)
  );

const rangeTeeth = (from, to) => {
  const start = Math.max(1, Math.min(32, Number(from) || 1));
  const end = Math.max(1, Math.min(32, Number(to) || 32));
  const min = Math.min(start, end);
  const max = Math.max(start, end);
  return allToothNumbers.filter((number) => Number(number) >= min && Number(number) <= max);
};

const treatmentStatusLabels = {
  PLANNED: 'مخطط',
  IN_PROGRESS: 'قيد العلاج',
  DONE: 'مكتمل',
};

const treatmentStatusBadge = {
  PLANNED: 'border-slate-500/30 bg-slate-500/10 text-slate-200',
  IN_PROGRESS: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  DONE: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
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
  patient,
  value = {},
  teethNotes,
  services: providedServices,
  doctors: providedDoctors,
  currentDoctorId = '',
  payments = [],
  extraCharges = [],
  onSaved,
  onSaveTooth,
  onAddService,
  onAddToPrescription,
  readonly = false,
  saveSignal = 0,
  showSaveButton = true,
  bookedServices = [],
}) {
  const sourceValue = teethNotes || value;
  const [selectedTooth, setSelectedTooth] = useState('1');
  const [teeth, setTeeth] = useState({});
  const [services, setServices] = useState(providedServices || []);
  const [doctors, setDoctors] = useState(providedDoctors || []);
  const [saving, setSaving] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState(defaultServiceForm);
  const [editorOpen, setEditorOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupForm, setGroupForm] = useState(defaultGroupForm);

  const selectTooth = (toothNumber) => {
    setSelectedTooth(String(toothNumber));
    setEditorOpen(true);
  };
  const previousSaveSignal = useRef(saveSignal);
  const discountCacheRef = useRef(new Map());

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

  const entry = useMemo(
    () => recalcEntry(teeth[selectedTooth] || normalizeEntry({ doctorId: currentDoctorId })),
    [selectedTooth, teeth, currentDoctorId]
  );

  const selectedService = useMemo(
    () => services.find((service) => service.id === entry.serviceId) || null,
    [services, entry.serviceId]
  );

  // Services the patient already booked (appointments / payments / extra
  // charges) — surfaced as a quick "خدمات حجزها المريض" group in the picker.
  const effectiveBookedServices = useMemo(() => {
    if (bookedServices && bookedServices.length) return bookedServices;
    const map = new Map();
    const add = (svc) => {
      if (svc && svc.id && !map.has(svc.id)) map.set(svc.id, svc);
    };
    (patient?.appointments || []).forEach((item) => add(item.service));
    (payments || []).forEach((item) => add(item.service));
    (extraCharges || []).forEach((item) => add(item.service));
    return Array.from(map.values());
  }, [bookedServices, patient, payments, extraCharges]);

  const matchingPayment = useMemo(() => {
    if (!entry.serviceId) return null;
    return payments.find((payment) => {
      const sameService = payment.serviceId === entry.serviceId || payment.service?.id === entry.serviceId;
      const finalAmount = Number(payment.finalAmount || payment.amount || 0);
      return sameService && finalAmount > 0;
    }) || null;
  }, [payments, entry.serviceId]);

  const groupSelectedService = useMemo(
    () => services.find((service) => service.id === groupForm.serviceId) || null,
    [services, groupForm.serviceId]
  );

  const groupMatchingPayment = useMemo(() => {
    if (!groupForm.serviceId) return null;
    return (
      payments.find((payment) => {
        const sameService = payment.serviceId === groupForm.serviceId || payment.service?.id === groupForm.serviceId;
        const finalAmount = Number(payment.finalAmount || payment.amount || 0);
        return sameService && finalAmount > 0;
      }) || null
    );
  }, [payments, groupForm.serviceId]);

  const groupTeeth = useMemo(() => uniqueSortedTeeth(groupForm.teeth), [groupForm.teeth]);
  const groupUnitPrice = Number(groupForm.price || 0);
  const groupTotalAmount =
    groupForm.priceMode === 'PER_TOOTH' ? groupUnitPrice * Math.max(1, groupTeeth.length) : groupUnitPrice;
  const groupPaidAmount = Math.max(0, Number(groupForm.paidAmount || 0));

  const updateGroupForm = (field, value) => {
    setGroupForm((current) => ({ ...current, [field]: value }));
  };

  const fallbackServicePricing = (serviceId) => {
    const service = services.find((item) => item.id === serviceId);
    const price = serviceBasePrice(service);
    return {
      priceBefore: price,
      discountType: 'AMOUNT',
      discountValue: 0,
      priceAfter: price,
      requiredAmount: price,
    };
  };

  const getServicePricing = async (serviceId) => {
    if (!serviceId) {
      return {
        priceBefore: null,
        discountType: 'AMOUNT',
        discountValue: null,
        priceAfter: null,
        requiredAmount: null,
      };
    }

    const fallback = fallbackServicePricing(serviceId);
    const cacheKey = `${patientId || 'global'}:${serviceId}`;
    if (discountCacheRef.current.has(cacheKey)) return discountCacheRef.current.get(cacheKey);

    try {
      const res = await api.get(`/services/${serviceId}/discount`, {
        params: patientId ? { patientId } : {},
      });
      const discount = res.data.discount || {};
      const rule = discount.rule || null;
      const nextPricing = {
        priceBefore: toNumberOrNull(discount.amount) ?? fallback.priceBefore,
        discountType: rule?.type === 'PERCENT' ? 'PERCENT' : 'AMOUNT',
        discountValue:
          rule?.type === 'PERCENT'
            ? toNumberOrNull(rule.value) ?? 0
            : toNumberOrNull(discount.discountAmount) ?? 0,
        priceAfter: toNumberOrNull(discount.finalAmount) ?? fallback.priceAfter,
        requiredAmount: toNumberOrNull(discount.finalAmount) ?? fallback.requiredAmount,
      };
      discountCacheRef.current.set(cacheKey, nextPricing);
      return nextPricing;
    } catch {
      discountCacheRef.current.set(cacheKey, fallback);
      return fallback;
    }
  };

  const toggleGroupTooth = (toothNumber) => {
    setGroupForm((current) => {
      const tooth = String(toothNumber);
      const exists = current.teeth.includes(tooth);
      return {
        ...current,
        teeth: uniqueSortedTeeth(exists ? current.teeth.filter((item) => item !== tooth) : [...current.teeth, tooth]),
      };
    });
  };

  const setGroupTeethPreset = (preset) => {
    if (preset === 'UPPER') updateGroupForm('teeth', upperToothNumbers);
    if (preset === 'LOWER') updateGroupForm('teeth', lowerToothNumbers);
    if (preset === 'ALL') updateGroupForm('teeth', allToothNumbers);
    if (preset === 'RANGE') updateGroupForm('teeth', rangeTeeth(groupForm.rangeFrom, groupForm.rangeTo));
  };

  const updateEntry = (field, nextValue) => {
    if (readonly) return;
    setTeeth((current) => ({
      ...current,
      [selectedTooth]: {
        ...recalcEntry({
          ...normalizeEntry(current[selectedTooth] || { doctorId: currentDoctorId }),
          [field]: nextValue,
          done:
            field === 'status'
              ? nextValue === 'DONE'
              : field === 'done'
                ? Boolean(nextValue)
                : normalizeEntry(current[selectedTooth] || { doctorId: currentDoctorId }).done,
        }),
      },
    }));
  };

  const linkExistingPayment = () => {
    if (!matchingPayment) return;
    const linkedBaseAmount = paymentBaseAmount(matchingPayment);
    const linkedNetAmount = paymentNetAmount(matchingPayment);
    setTeeth((current) => {
      const base = normalizeEntry(current[selectedTooth] || { doctorId: currentDoctorId });
      const currentRequired = toNumberOrNull(base.requiredAmount) ?? toNumberOrNull(base.priceAfter) ?? linkedNetAmount;
      const paidAmount = Math.min(currentRequired, Math.max(0, Number(matchingPayment.paidAmount || 0)));
      return {
        ...current,
        [selectedTooth]: {
          ...base,
          linkedPaymentId: matchingPayment.id,
          extraChargeId: '',
          priceBefore: toNumberOrNull(base.priceBefore) ?? linkedBaseAmount,
          discountType: base.discountType || 'AMOUNT',
          discountValue: toNumberOrNull(base.discountValue) ?? Math.max(0, linkedBaseAmount - linkedNetAmount),
          priceAfter: toNumberOrNull(base.priceAfter) ?? linkedNetAmount,
          requiredAmount: currentRequired,
          paidAmount,
          remaining: Math.max(0, currentRequired - paidAmount),
          updatedAt: new Date().toISOString(),
        },
      };
    });
    toast.success('تم ربط السن بنفس الدفعة الحالية');
  };

  const applyServiceDefaults = async (serviceId) => {
    const pricing = await getServicePricing(serviceId);
    setTeeth((current) => ({
      ...current,
      [selectedTooth]: recalcEntry({
        ...normalizeEntry(current[selectedTooth] || { doctorId: currentDoctorId }),
        serviceId,
        ...pricing,
        ...(current[selectedTooth]?.doctorId ? {} : { doctorId: currentDoctorId }),
      }),
    }));
  };

  const applyGroupServiceDefaults = async (serviceId) => {
    const pricing = await getServicePricing(serviceId);
    setGroupForm((current) => ({
      ...current,
      serviceId,
      price: pricing.priceAfter ?? pricing.priceBefore ?? '',
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

  const updateSelectedToothEntry = (producer) => {
    let computed = null;
    setTeeth((current) => {
      const base = normalizeEntry(current[selectedTooth] || { doctorId: currentDoctorId });
      computed = recalcEntry(
        producer({
          ...base,
          updatedAt: new Date().toISOString(),
        })
      );
      return {
        ...current,
        [selectedTooth]: computed,
      };
    });
    return computed;
  };

  const saveCurrentTooth = async () => {
    if (readonly) return;
    const nextEntry = recalcEntry({
      ...normalizeEntry(teeth[selectedTooth] || { doctorId: currentDoctorId }),
      updatedAt: new Date().toISOString(),
      createdAt: teeth[selectedTooth]?.createdAt || new Date().toISOString(),
    });
    const nextTeeth = {
      ...teeth,
      [selectedTooth]: nextEntry,
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

  const syncExtraCharge = async (entryToPersist, { createIfMissing = false } = {}) => {
    const payload = {
      patientId,
      serviceId: entryToPersist.serviceId || null,
      doctorId: entryToPersist.doctorId || currentDoctorId || null,
      description: entryToPersist.treatmentNote || entryToPersist.note || `علاج سن ${selectedTooth}`,
      amount: entryToPersist.requiredAmount ?? entryToPersist.priceAfter ?? entryToPersist.priceBefore ?? 0,
      paidAmount: entryToPersist.paidAmount ?? 0,
      teethCount: 1,
      toothNumber: Number(selectedTooth),
      method: null,
      notes: entryToPersist.paymentNote || entryToPersist.note || null,
    };

    if (entryToPersist.linkedPaymentId) {
      return entryToPersist;
    }

    if (entryToPersist.extraChargeId) {
      const res = await api.patch(`/payments/extra-charges/${entryToPersist.extraChargeId}`, payload);
      return {
        ...entryToPersist,
        extraChargeId: res.data.extraCharge?.id || entryToPersist.extraChargeId,
      };
    }

    if (!createIfMissing) return entryToPersist;

    const res = await api.post('/payments/extra-charges', payload);
    return {
      ...entryToPersist,
      extraChargeId: res.data.extraCharge?.id || '',
      status: 'IN_PROGRESS',
      createdAt: entryToPersist.createdAt || new Date().toISOString(),
    };
  };

  const syncLinkedPayment = async (entryToPersist) => {
    if (!entryToPersist.linkedPaymentId) return entryToPersist;
    const priceBefore = Number(entryToPersist.priceBefore || entryToPersist.requiredAmount || 0);
    const priceAfter = Number(entryToPersist.priceAfter || entryToPersist.requiredAmount || priceBefore || 0);
    await api.put(`/payments/${entryToPersist.linkedPaymentId}`, {
      amount: priceBefore,
      discountAmount: Math.max(0, priceBefore - priceAfter),
      paidAmount: Number(entryToPersist.paidAmount || 0),
      teethCount: 1,
      notes: entryToPersist.paymentNote || entryToPersist.note || undefined,
    });
    return entryToPersist;
  };

  const handleStartGroupTreatment = async ({ forceExtra = false } = {}) => {
    const selectedTeeth = uniqueSortedTeeth(groupForm.teeth);
    if (!groupForm.serviceId) {
      toast.warn('اختر الخدمة أولاً');
      return;
    }
    if (selectedTeeth.length === 0) {
      toast.warn('اختر سن واحد على الأقل');
      return;
    }

    const servicePrice = serviceBasePrice(groupSelectedService);
    const amount = groupForm.price === '' ? servicePrice : groupTotalAmount;
    const paidAmount = Math.min(amount, groupPaidAmount);
    const shouldLinkBookedPayment = groupMatchingPayment && !forceExtra;
    const groupId = `group-${Date.now()}`;

    setSaving(true);
    try {
      let financialId = '';
      if (shouldLinkBookedPayment) {
        financialId = groupMatchingPayment.id;
      } else {
        const res = await api.post('/payments/extra-charges', {
          patientId,
          serviceId: groupForm.serviceId,
          doctorId: groupForm.doctorId || currentDoctorId || undefined,
          description:
            groupForm.treatmentNote ||
            groupForm.note ||
            `${groupSelectedService?.nameAr || groupSelectedService?.name || 'خدمة'} - ${selectedTeeth.length} أسنان`,
          amount,
          paidAmount,
          teethCount: selectedTeeth.length,
          method: null,
          notes: groupForm.note || undefined,
        });
        financialId = res.data.extraCharge?.id || '';
      }

      const perToothAmount = selectedTeeth.length ? amount / selectedTeeth.length : amount;
      const nextTeeth = { ...teeth };
      selectedTeeth.forEach((toothNumber) => {
        nextTeeth[toothNumber] = recalcEntry({
          ...normalizeEntry(nextTeeth[toothNumber] || { doctorId: currentDoctorId }),
          note: groupForm.note || normalizeEntry(nextTeeth[toothNumber] || {}).note,
          treatmentNote: groupForm.treatmentNote || normalizeEntry(nextTeeth[toothNumber] || {}).treatmentNote,
          serviceId: groupForm.serviceId,
          doctorId: groupForm.doctorId || currentDoctorId || '',
          status: 'IN_PROGRESS',
          done: false,
          linkedPaymentId: shouldLinkBookedPayment ? financialId : '',
          extraChargeId: shouldLinkBookedPayment ? '' : financialId,
          groupId,
          groupTeeth: selectedTeeth,
          groupTotalAmount: amount,
          priceBefore: perToothAmount,
          priceAfter: perToothAmount,
          requiredAmount: perToothAmount,
          paidAmount: selectedTeeth.length ? paidAmount / selectedTeeth.length : paidAmount,
          paymentNote: groupForm.note || '',
          createdAt: nextTeeth[toothNumber]?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });

      const saved = await persistTeeth(nextTeeth);
      setTeeth(saved);
      onSaved?.(saved);
      setGroupForm(defaultGroupForm);
      setGroupOpen(false);
      toast.success(
        shouldLinkBookedPayment
          ? 'تم ربط مجموعة الأسنان بحجز الخدمة بدون إضافة مبلغ جديد'
          : 'تمت إضافة خدمة أثناء الكشف لمجموعة الأسنان'
      );
    } catch (error) {
      toast.error(error.message || 'فشل حفظ خدمة مجموعة الأسنان');
    } finally {
      setSaving(false);
    }
  };

  const handleStartTreatment = async ({ forceSeparate = false } = {}) => {
    if (!entry.serviceId) {
      toast.warn('اختر الخدمة أولاً');
      return;
    }

    setSaving(true);
    try {
      const shouldLinkBookedPayment = matchingPayment && !forceSeparate && !entry.linkedPaymentId && !entry.extraChargeId;
      const linkedBaseAmount = paymentBaseAmount(matchingPayment);
      const linkedNetAmount = paymentNetAmount(matchingPayment);
      const currentRequired = toNumberOrNull(entry.requiredAmount) ?? toNumberOrNull(entry.priceAfter) ?? linkedNetAmount;
      const linkedPaid = Math.min(currentRequired, Math.max(0, Number(matchingPayment?.paidAmount || 0)));
      let nextEntry = recalcEntry({
        ...entry,
        ...(shouldLinkBookedPayment
          ? {
              linkedPaymentId: matchingPayment.id,
              extraChargeId: '',
              priceBefore: toNumberOrNull(entry.priceBefore) ?? linkedBaseAmount,
              priceAfter: toNumberOrNull(entry.priceAfter) ?? linkedNetAmount,
              requiredAmount: currentRequired,
              paidAmount: linkedPaid,
              remaining: Math.max(0, currentRequired - linkedPaid),
            }
          : {}),
        status: 'IN_PROGRESS',
        done: false,
        linkedPaymentId: forceSeparate ? '' : shouldLinkBookedPayment ? matchingPayment.id : entry.linkedPaymentId,
        createdAt: entry.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (shouldLinkBookedPayment) {
        nextEntry.linkedPaymentId = matchingPayment.id;
        nextEntry.extraChargeId = '';
      }
      nextEntry = await syncExtraCharge(nextEntry, { createIfMissing: !nextEntry.linkedPaymentId });
      const nextTeeth = {
        ...teeth,
        [selectedTooth]: nextEntry,
      };
      const saved = await persistTeeth(nextTeeth);
      setTeeth(saved);
      onSaved?.(saved);
      toast.success('تم بدء العلاج وربطه بالمدفوعات');
    } catch (error) {
      toast.error(error.message || 'فشل بدء العلاج');
    } finally {
      setSaving(false);
    }
  };

  const handlePlanOnly = async () => {
    if (readonly) return;
    setSaving(true);
    try {
      const nextEntry = recalcEntry({
        ...entry,
        status: 'PLANNED',
        done: false,
        updatedAt: new Date().toISOString(),
      });
      const nextTeeth = {
        ...teeth,
        [selectedTooth]: nextEntry,
      };
      const saved = await persistTeeth(nextTeeth);
      setTeeth(saved);
      onSaved?.(saved);
      toast.success('تم حفظ الخطة بدون إنشاء بند مالي');
    } catch (error) {
      toast.error(error.message || 'فشل حفظ خطة السن');
    } finally {
      setSaving(false);
    }
  };

  const handlePayFullAmount = async () => {
    setSaving(true);
    try {
      let nextEntry = recalcEntry({
        ...entry,
        paidAmount: entry.requiredAmount ?? entry.priceAfter ?? entry.priceBefore ?? 0,
        remaining: 0,
        status: 'DONE',
        done: true,
        updatedAt: new Date().toISOString(),
      });
      nextEntry = await syncLinkedPayment(nextEntry);
      nextEntry = await syncExtraCharge(nextEntry);
      const nextTeeth = {
        ...teeth,
        [selectedTooth]: nextEntry,
      };
      const saved = await persistTeeth(nextTeeth);
      setTeeth(saved);
      onSaved?.(saved);
      toast.success('تم تسجيل الدفع الكامل لهذا السن');
    } catch (error) {
      toast.error(error.message || 'فشل تسجيل الدفع الكامل');
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

  const selectedDoctorName = doctors.find((doctor) => doctor.id === (entry.doctorId || currentDoctorId))?.name || '';
  const selectedServiceName = selectedService?.nameAr || selectedService?.name || '';

  return (
    <DataCard>
      <div>
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black text-white">خريطة الأسنان</h3>
          </div>

          <DentalArch2D teeth={teeth} services={services} selectedTooth={selectedTooth} onSelectTooth={selectTooth} />

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
          {!readonly ? (
            <div className="mt-4 flex justify-center">
              <PrimaryButton type="button" onClick={() => setGroupOpen(true)}>
                <PlusCircle className="h-4 w-4" />
                إضافة خدمة لمجموعة أسنان
              </PrimaryButton>
            </div>
          ) : null}
        </div>

      {groupOpen ? (
        <div
          className="fixed inset-0 z-[94] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setGroupOpen(false)}
          dir="rtl"
        >
          <div
            className="my-6 w-full max-w-4xl space-y-4 rounded-3xl border border-white/10 bg-[#0b1020] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-lg font-black text-white">إضافة خدمة لمجموعة أسنان</h3>
                <p className="mt-1 text-xs text-slate-400">مناسب لابتسامة هوليود، التركيبات المتعددة، التقويم، التبييض أو أي خدمة تشمل أكثر من سن.</p>
              </div>
              <button type="button" onClick={() => setGroupOpen(false)} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white" aria-label="إغلاق">
                ×
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="الخدمة">
                    <select className={inputClass} value={groupForm.serviceId} onChange={(event) => applyGroupServiceDefaults(event.target.value)}>
                      <option value="">اختر الخدمة</option>
                      {effectiveBookedServices.length ? (
                        <optgroup label="خدمات حجزها المريض">
                          {effectiveBookedServices.map((service) => (
                            <option key={`group-booked-${service.id}`} value={service.id}>{service.nameAr || service.name}</option>
                          ))}
                        </optgroup>
                      ) : null}
                      <optgroup label="كل الخدمات">
                        {services.map((service) => (
                          <option key={`group-service-${service.id}`} value={service.id}>{service.nameAr || service.name}</option>
                        ))}
                      </optgroup>
                    </select>
                  </Field>
                  <Field label="الطبيب">
                    <select className={inputClass} value={groupForm.doctorId || currentDoctorId} onChange={(event) => updateGroupForm('doctorId', event.target.value)}>
                      <option value="">اختر الطبيب</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>د. {doctor.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="طريقة السعر">
                    <select className={inputClass} value={groupForm.priceMode} onChange={(event) => updateGroupForm('priceMode', event.target.value)}>
                      <option value="TOTAL">سعر إجمالي للخدمة</option>
                      <option value="PER_TOOTH">سعر لكل سن</option>
                    </select>
                  </Field>
                  <Field label={groupForm.priceMode === 'PER_TOOTH' ? 'السعر لكل سن' : 'السعر الإجمالي'}>
                    <input className={inputClass} type="number" value={groupForm.price} placeholder={String(serviceBasePrice(groupSelectedService) || '')} onChange={(event) => updateGroupForm('price', event.target.value)} />
                  </Field>
                  <Field label="المدفوع">
                    <input className={inputClass} type="number" value={groupForm.paidAmount} onChange={(event) => updateGroupForm('paidAmount', event.target.value)} />
                  </Field>
                  <Field label="الإجمالي المتوقع">
                    <input className={inputClass} value={money(groupForm.price === '' ? serviceBasePrice(groupSelectedService) : groupTotalAmount)} disabled />
                  </Field>
                </div>
                <Field label="ملاحظة عامة">
                  <textarea className={inputClass} rows={3} value={groupForm.note} onChange={(event) => updateGroupForm('note', event.target.value)} />
                </Field>
                <Field label="ملاحظة العلاج">
                  <textarea className={inputClass} rows={3} value={groupForm.treatmentNote} onChange={(event) => updateGroupForm('treatmentNote', event.target.value)} />
                </Field>
              </div>

              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <SecondaryButton type="button" onClick={() => setGroupTeethPreset('UPPER')}>فك علوي</SecondaryButton>
                  <SecondaryButton type="button" onClick={() => setGroupTeethPreset('LOWER')}>فك سفلي</SecondaryButton>
                  <SecondaryButton type="button" onClick={() => setGroupTeethPreset('ALL')}>كل الأسنان</SecondaryButton>
                  <SecondaryButton type="button" onClick={() => updateGroupForm('teeth', [])}>مسح</SecondaryButton>
                </div>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input className={inputClass} type="number" min="1" max="32" value={groupForm.rangeFrom} onChange={(event) => updateGroupForm('rangeFrom', event.target.value)} />
                  <input className={inputClass} type="number" min="1" max="32" value={groupForm.rangeTo} onChange={(event) => updateGroupForm('rangeTo', event.target.value)} />
                  <SecondaryButton type="button" onClick={() => setGroupTeethPreset('RANGE')}>نطاق</SecondaryButton>
                </div>
                <div className="grid grid-cols-8 gap-2">
                  {allToothNumbers.map((number) => {
                    const active = groupForm.teeth.includes(number);
                    return (
                      <button
                        key={`group-tooth-${number}`}
                        type="button"
                        onClick={() => toggleGroupTooth(number)}
                        className={`rounded-xl border px-2 py-2 text-sm font-black transition ${active ? 'border-sky-400 bg-sky-500 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                      >
                        {number}
                      </button>
                    );
                  })}
                </div>
                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3 text-sm font-bold text-sky-100">
                  الأسنان المختارة: {groupTeeth.length ? groupTeeth.join(', ') : 'لم يتم اختيار أسنان'}
                </div>
                {groupMatchingPayment ? (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs font-bold leading-6 text-amber-50">
                    يوجد حجز سابق لنفس الخدمة. زر الحفظ الأساسي سيربط الأسنان بحجز الخدمة بدون إضافة مبلغ جديد.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
              <SecondaryButton type="button" onClick={() => setGroupOpen(false)}>إلغاء</SecondaryButton>
              {groupMatchingPayment ? (
                <SecondaryButton type="button" onClick={() => handleStartGroupTreatment({ forceExtra: true })} disabled={saving}>إنشاء خدمة إضافية منفصلة</SecondaryButton>
              ) : null}
              <PrimaryButton type="button" onClick={() => handleStartGroupTreatment()} disabled={saving}>
                {groupMatchingPayment ? 'ربط بحجز الخدمة' : 'إضافة أثناء الكشف'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}

      {editorOpen ? (
        <div
          className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setEditorOpen(false)}
          dir="rtl"
        >
          <div
            className="my-6 w-full max-w-2xl space-y-4 rounded-3xl border border-white/10 bg-[#0b1020] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-black text-white">تفاصيل سن رقم {selectedTooth}</h3>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="إغلاق"
              >
                ✕
              </button>
            </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-base font-black text-white">سن رقم {selectedTooth}</h4>
                <p className="mt-1 text-xs text-slate-400">
                  {selectedServiceName || 'بدون خدمة'}{selectedDoctorName ? ` · د. ${selectedDoctorName}` : ''}
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${treatmentStatusBadge[entry.status] || treatmentStatusBadge.PLANNED}`}>
                {treatmentStatusLabels[entry.status] || 'مخطط'}
              </span>
            </div>

            <Field label="ملاحظة السن">
              <textarea
                className={inputClass}
                rows={3}
                value={entry.note}
                disabled={readonly}
                onChange={(event) => updateEntry('note', event.target.value)}
              />
            </Field>
            <div className="mt-3 grid gap-3">
              <Field label="ملاحظة العلاج">
                <textarea
                  className={inputClass}
                  rows={3}
                  value={entry.treatmentNote}
                  disabled={readonly}
                  onChange={(event) => updateEntry('treatmentNote', event.target.value)}
                />
              </Field>
              <Field label="الخدمة">
                <select className={inputClass} value={entry.serviceId} disabled={readonly} onChange={(event) => applyServiceDefaults(event.target.value)}>
                  <option value="">اختر الخدمة</option>
                  {effectiveBookedServices.length ? (
                    <optgroup label="خدمات حجزها المريض">
                      {effectiveBookedServices.map((service) => (
                        <option key={`booked-${service.id}`} value={service.id}>
                          {service.nameAr || service.name} ★
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  <optgroup label="كل الخدمات">
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>{service.nameAr || service.name}</option>
                    ))}
                  </optgroup>
                </select>
              </Field>
              {matchingPayment && !entry.linkedPaymentId && !readonly ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <h4 className="text-sm font-black text-amber-100">يوجد دفع سابق لنفس الخدمة</h4>
                  <p className="mt-2 text-xs leading-6 text-amber-50/90">
                    الإجمالي: {money(paymentNetAmount(matchingPayment))} · المدفوع: {money(Number(matchingPayment.paidAmount || 0))} · المتبقي: {money(Math.max(0, paymentNetAmount(matchingPayment) - Number(matchingPayment.paidAmount || 0)))}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SecondaryButton type="button" onClick={linkExistingPayment}>ربط بنفس الدفعة</SecondaryButton>
                    <SecondaryButton type="button" onClick={() => handleStartTreatment({ forceSeparate: true })}>إنشاء بند سن منفصل</SecondaryButton>
                  </div>
                </div>
              ) : null}
              <Field label="الطبيب">
                <select className={inputClass} value={entry.doctorId || currentDoctorId} disabled={readonly} onChange={(event) => updateEntry('doctorId', event.target.value)}>
                  <option value="">اختر الطبيب</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>د. {doctor.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="حالة العلاج">
                <select className={inputClass} value={entry.status} disabled={readonly} onChange={(event) => updateEntry('status', event.target.value)}>
                  {Object.entries(treatmentStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
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

          {selectedService ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h4 className="mb-3 text-sm font-black text-white">تفاصيل العلاج والدفع</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="السعر قبل الخصم">
                  <input className={inputClass} type="number" value={moneyFieldValue(entry.priceBefore)} disabled={readonly} onChange={(event) => updateEntry('priceBefore', event.target.value)} />
                </Field>
                <Field label="نوع الخصم">
                  <select className={inputClass} value={entry.discountType} disabled={readonly} onChange={(event) => updateEntry('discountType', event.target.value)}>
                    <option value="AMOUNT">مبلغ</option>
                    <option value="PERCENT">نسبة مئوية</option>
                  </select>
                </Field>
                <Field label="قيمة الخصم">
                  <input className={inputClass} type="number" value={moneyFieldValue(entry.discountValue)} disabled={readonly} onChange={(event) => updateEntry('discountValue', event.target.value)} />
                </Field>
                <Field label="السعر بعد الخصم">
                  <input className={inputClass} type="number" value={moneyFieldValue(entry.priceAfter)} disabled />
                </Field>
                <Field label="المطلوب">
                  <input className={inputClass} type="number" value={moneyFieldValue(entry.requiredAmount)} disabled={readonly} onChange={(event) => updateEntry('requiredAmount', event.target.value)} />
                </Field>
                <Field label="المدفوع">
                  <input className={inputClass} type="number" value={moneyFieldValue(entry.paidAmount)} disabled={readonly} onChange={(event) => updateEntry('paidAmount', event.target.value)} />
                </Field>
                <Field label="المتبقي">
                  <input className={inputClass} type="number" value={moneyFieldValue(entry.remaining)} disabled />
                </Field>
                <Field label="رقم البند المالي">
                  <input className={inputClass} value={entry.extraChargeId || entry.linkedPaymentId || 'غير مرتبط بعد'} disabled />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="ملاحظة الدفع">
                  <textarea className={inputClass} rows={3} value={entry.paymentNote} disabled={readonly} onChange={(event) => updateEntry('paymentNote', event.target.value)} />
                </Field>
              </div>
            </div>
          ) : null}

          {!readonly ? (
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <PrimaryButton
                type="button"
                onClick={() => handleStartTreatment()}
                disabled={saving || !entry.serviceId}
                className="w-full py-3 text-base"
              >
                بدء العلاج
              </PrimaryButton>

              <div className="grid grid-cols-2 gap-2">
                <SecondaryButton type="button" onClick={handlePlanOnly} disabled={saving} className="w-full">عدم البدء الآن</SecondaryButton>
                <SecondaryButton type="button" onClick={handlePayFullAmount} disabled={saving || !entry.serviceId} className="w-full">دفع كامل</SecondaryButton>
                {onAddToPrescription ? (
                  <SecondaryButton type="button" onClick={() => onAddToPrescription(selectedTooth, entry)} className="w-full">إضافة للروشتة</SecondaryButton>
                ) : null}
                {!showServiceForm ? (
                  <SecondaryButton type="button" onClick={() => setShowServiceForm(true)} className="w-full">
                    <PlusCircle className="h-4 w-4" />
                    إضافة خدمة أخرى
                  </SecondaryButton>
                ) : null}
              </div>

              <div className="space-y-2 border-t border-white/10 pt-3">
                <PrimaryButton type="button" onClick={saveCurrentTooth} disabled={saving} className="w-full">
                  <Save className="h-4 w-4" />
                  حفظ السن المحدد
                </PrimaryButton>
                {showSaveButton ? (
                  <SecondaryButton type="button" onClick={saveTeeth} disabled={saving} className="w-full">حفظ خريطة الأسنان</SecondaryButton>
                ) : null}
              </div>
            </div>
          ) : null}

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
          </div>
        </div>
      ) : null}
      </div>
    </DataCard>
  );
}
