import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Edit3, Printer, RefreshCw, Search, Send } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../api/client';
import { DataCard, Field, PageLoader, PrimaryButton, SecondaryButton, StatCard, inputClass } from '../ui';
import EmptyState from '../EmptyState';
import { confirmDialog } from '../dialogs';
import { money, todayInputValue } from '../../utils/appointmentUi';
import { downloadExcelWorkbook, formatExcelDate } from '../../utils/excelExport';
import PaymentReceipt from './PaymentReceipt';

const pad = (value) => String(value).padStart(2, '0');
const localDateValue = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const dateChips = [
  { value: 'today', label: 'اليوم' },
  { value: 'week', label: 'آخر أسبوع' },
  { value: 'month', label: 'آخر شهر' },
  { value: 'day', label: 'يوم محدد' },
  { value: 'all', label: 'كل المدفوعات' },
];

const caseStatusOptions = [
  { value: 'ALL', label: 'كل الحالات' },
  { value: 'WASEL', label: 'واصل' },
  { value: 'MUNTAHI', label: 'منتهي' },
  { value: 'MOSTAMERA', label: 'مستمرة' },
];

// مراحل العلاج المفصّلة (chip stepper). الـ value بيتسجّل في notes كـ tag منظّم،
// ولو فيه appointmentAction هينفّذه على الموعد المرتبط.
const caseStageOptions = [
  {
    value: 'STARTED',
    label: 'بدء العلاج',
    activeClass: 'border-sky-400 bg-sky-500 text-white',
    appointmentAction: 'confirm',
  },
  {
    value: 'EXAMINED',
    label: 'تم الكشف',
    activeClass: 'border-emerald-400 bg-emerald-500 text-white',
    appointmentAction: 'complete',
  },
  {
    value: 'ONGOING',
    label: 'قيد العلاج',
    activeClass: 'border-amber-400 bg-amber-500 text-white',
    appointmentAction: null,
  },
  {
    value: 'FINISHED',
    label: 'منتهي',
    activeClass: 'border-slate-300 bg-slate-200 text-slate-900',
    appointmentAction: null,
  },
];

const stageLabelOf = (value) => caseStageOptions.find((option) => option.value === value)?.label || value;
const stageTagRegex = /^\[المرحلة:[^\]]*\][^\n]*\n?/;
const stripStageTag = (notes = '') => String(notes || '').replace(stageTagRegex, '').trim();
const buildStageTag = (stage, details = '') => {
  if (!stage) return '';
  const today = new Date().toISOString().slice(0, 10);
  const detailsPart = details ? ` ${String(details).trim()}` : '';
  return `[المرحلة: ${stageLabelOf(stage)} · ${today}]${detailsPart}`;
};

const itemTypeOptions = [
  { value: 'ALL', label: 'كل البنود' },
  { value: 'TOOTH', label: 'علاجات الأسنان فقط' },
  { value: 'APPOINTMENT', label: 'دفعات المواعيد فقط' },
  { value: 'EXTRA', label: 'الخدمات الإضافية فقط' },
];

const defaultFilters = () => ({
  from: '',
  to: '',
  status: 'ALL',
  method: 'ALL',
  caseStatus: 'ALL',
  itemType: 'ALL',
  search: '',
  cashierExpenses: '',
});

const isAutoFullPaymentNote = (value = '') => /^تحصيل كامل\s*\(/.test(String(value).trim());

const toAmount = (value) => Number(value) || 0;
const clampAmount = (value, max = Infinity) => Math.max(0, Math.min(toAmount(value), max));
const paymentBaseAmount = (payment = {}) =>
  toAmount(payment.baseAmount ?? (payment.source === 'extra' ? payment.amount : toAmount(payment.amount) + toAmount(payment.discountAmount)));
const netPaymentAmount = (payment = {}, discountAmount = payment.discountAmount) => {
  const baseAmount = paymentBaseAmount(payment);
  return payment.source === 'extra' ? toAmount(payment.amount) : Math.max(0, baseAmount - toAmount(discountAmount));
};
const paymentSourceLabel = (payment = {}) => {
  if (payment.toothNumber) return `علاج سن ${payment.toothNumber}`;
  return payment.source === 'extra' ? 'خدمة إضافية' : 'دفعة موعد';
};
const paymentTitleLine = (payment = {}) => {
  const parts = [payment.treatmentType || '-'];
  if (payment.toothNumber) parts.push(`السن ${payment.toothNumber}`);
  parts.push(`د. ${payment.doctorName || '-'}`);
  if (payment.patientPhone) parts.push(payment.patientPhone);
  return parts.join(' · ');
};

const matchesItemType = (payment = {}, itemType = 'ALL') => {
  if (itemType === 'TOOTH') return Boolean(payment.toothNumber);
  if (itemType === 'APPOINTMENT') return payment.source !== 'extra';
  if (itemType === 'EXTRA') return payment.source === 'extra' && !payment.toothNumber;
  return true;
};

const defaultEditForm = (payment = {}) => ({
  paidAmount: payment.paidAmount || 0,
  discountAmount: payment.discountAmount || 0,
  remainingAmount: payment.remainingAmount ?? Math.max(0, netPaymentAmount(payment) - toAmount(payment.paidAmount)),
  teethCount: payment.teethCount || 1,
  method: payment.method || 'cash',
  notes: isAutoFullPaymentNote(payment.notes) ? '' : stripStageTag(payment.notes || ''),
  caseStatus: '',
  caseStage: '',
  caseStageDetails: '',
});

const paymentStatusLabel = (payment = {}, discountAmount = payment.discountAmount, paidAmount = payment.paidAmount) => {
  const netAmount = netPaymentAmount(payment, discountAmount);
  const paid = clampAmount(paidAmount, netAmount);
  if (paid <= 0) return { label: 'غير مدفوع', className: 'border-rose-500/20 bg-rose-500/10 text-rose-200' };
  if (paid < netAmount) return { label: 'مدفوع جزئياً', className: 'border-amber-500/20 bg-amber-500/10 text-amber-200' };
  return { label: 'مدفوع بالكامل', className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' };
};

const caseStatusLabel = (value) => caseStatusOptions.find((option) => option.value === value)?.label || 'غير محددة';

async function savePaymentChanges(payment, form) {
  const paidAmount = clampAmount(form.paidAmount, netPaymentAmount(payment, form.discountAmount));
  // ندمج مرحلة العلاج كـ tag في أول سطر من الملاحظات عشان تتخزن مع الدفعة.
  const stageTag = buildStageTag(form.caseStage, form.caseStageDetails);
  const userNotes = stripStageTag(form.notes || '');
  const composedNotes = stageTag
    ? userNotes
      ? `${stageTag}\n${userNotes}`
      : stageTag
    : userNotes;

  if (payment.source === 'extra') {
    await api.patch(`/payments/extra-charges/${payment.id}`, {
      paidAmount,
      teethCount: Math.max(1, Math.floor(Number(form.teethCount) || 1)),
      method: form.method,
      notes: composedNotes,
    });
    return;
  }

  await api.put(`/payments/${payment.id}`, {
    paidAmount,
    discountAmount: Number(form.discountAmount) || 0,
    teethCount: Math.max(1, Math.floor(Number(form.teethCount) || 1)),
    method: form.method,
    notes: composedNotes,
  });

  if (payment.appointmentId && form.caseStatus && form.caseStatus !== payment.caseStatus) {
    if (form.caseStatus === 'WASEL') {
      await api.post(`/appointments/${payment.appointmentId}/complete`);
    } else if (form.caseStatus === 'MOSTAMERA') {
      await api.post(`/appointments/${payment.appointmentId}/confirm`);
    } else if (form.caseStatus === 'MUNTAHI') {
      await api.post(`/appointments/${payment.appointmentId}/cancel`, {
        reason: 'إنهاء الحالة من شاشة المدفوعات',
      });
    }
  }

  // المرحلة الجديدة ممكن تنفّذ action على الموعد المرتبط (بدء العلاج / تم الكشف).
  if (payment.appointmentId && form.caseStage) {
    const action = caseStageOptions.find((option) => option.value === form.caseStage)?.appointmentAction;
    if (action) {
      try {
        await api.post(`/appointments/${payment.appointmentId}/${action}`);
      } catch {
        // لو الموعد في حالة لا تسمح بالـ action ده، نتجاهل الخطأ علشان ما نوقفش حفظ الدفع.
      }
    }
  }
}

function PaymentFields({ payment, form, setForm }) {
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const baseAmount = paymentBaseAmount(payment);
  const discountAmount = payment.source === 'extra' ? 0 : toAmount(form.discountAmount);
  const netAmount = netPaymentAmount(payment, discountAmount);
  const paidAmount = clampAmount(form.paidAmount, netAmount);
  const remainingAmount = Math.max(0, netAmount - paidAmount);
  const currentPaymentStatus = paymentStatusLabel(payment, discountAmount, paidAmount);

  const updatePaidAmount = (value) => {
    const nextPaid = clampAmount(value, netAmount);
    setForm((current) => ({
      ...current,
      paidAmount: nextPaid,
      remainingAmount: Math.max(0, netAmount - nextPaid),
    }));
  };

  const updateDiscountAmount = (value) => {
    const nextDiscount = clampAmount(value, baseAmount);
    const nextNet = netPaymentAmount(payment, nextDiscount);
    setForm((current) => {
      const nextPaid = clampAmount(current.paidAmount, nextNet);
      return {
        ...current,
        discountAmount: nextDiscount,
        paidAmount: nextPaid,
        remainingAmount: Math.max(0, nextNet - nextPaid),
      };
    });
  };

  const updateRemainingAmount = (value) => {
    const nextRemaining = clampAmount(value, netAmount);
    setForm((current) => ({
      ...current,
      remainingAmount: nextRemaining,
      paidAmount: Math.max(0, netAmount - nextRemaining),
    }));
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 rounded-2xl border border-sky-500/15 bg-sky-500/5 p-3 text-xs font-bold text-slate-200 md:grid-cols-3">
        <div>
          <span className="block text-slate-400">الإجمالي قبل الخصم</span>
          <span className="text-white">{money(baseAmount)}</span>
        </div>
        <div>
          <span className="block text-slate-400">الصافي بعد الخصم</span>
          <span className="text-sky-200">{money(netAmount)}</span>
        </div>
        <div>
          <span className="block text-slate-400">المتبقي على المريض</span>
          <span className={remainingAmount > 0 ? 'text-amber-300' : 'text-emerald-300'}>{money(remainingAmount)}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-bold">
        <span className={`rounded-full border px-3 py-1 ${currentPaymentStatus.className}`}>
          حالة الدفع: {currentPaymentStatus.label}
        </span>
        {payment.appointmentId ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
            حالة الموعد الحالية: {caseStatusLabel(payment.caseStatus)}
          </span>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <Field label="المبلغ المدفوع">
        <input
          className={inputClass}
          type="number"
          value={form.paidAmount}
          min="0"
          max={netAmount}
          onChange={(event) => updatePaidAmount(event.target.value)}
        />
      </Field>
      {payment.source !== 'extra' ? (
        <Field label="الخصم من السعر">
          <input
            className={inputClass}
            type="number"
            value={form.discountAmount}
            min="0"
            max={baseAmount}
            onChange={(event) => updateDiscountAmount(event.target.value)}
          />
        </Field>
      ) : null}
      <Field label="المتبقي على المريض">
        <input
          className={inputClass}
          type="number"
          value={form.remainingAmount}
          min="0"
          max={netAmount}
          onChange={(event) => updateRemainingAmount(event.target.value)}
        />
      </Field>
      <Field label="عدد الأسنان">
        <input
          className={inputClass}
          type="number"
          min="1"
          step="1"
          value={form.teethCount}
          onChange={(event) => update('teethCount', event.target.value)}
        />
      </Field>
      <Field label="طريقة الدفع">
        <select className={inputClass} value={form.method} onChange={(event) => update('method', event.target.value)}>
          <option value="cash">كاش</option>
          <option value="card">بطاقة</option>
          <option value="transfer">تحويل</option>
          <option value="other">أخرى</option>
        </select>
      </Field>
      <Field label="ملاحظات">
        <textarea
          className={`${inputClass} min-h-[64px]`}
          rows={2}
          value={form.notes}
          onChange={(event) => update('notes', event.target.value)}
          placeholder="ملاحظات اختيارية للدفعة"
        />
      </Field>
      </div>

      {payment.source !== 'extra' && payment.appointmentId ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="mb-2 text-xs font-bold text-slate-300">مرحلة العلاج (مخطط متابعة الحالة)</p>
          <div className="flex flex-wrap gap-2">
            {caseStageOptions.map((option) => {
              const active = form.caseStage === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update('caseStage', active ? '' : option.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    active
                      ? option.activeClass
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {form.caseStage ? (
            <div className="mt-3">
              <Field label="تفاصيل المرحلة">
                <textarea
                  className={`${inputClass} min-h-[72px]`}
                  rows={2}
                  value={form.caseStageDetails}
                  onChange={(event) => update('caseStageDetails', event.target.value)}
                  placeholder="مثال: تم تحضير الأسنان للتلبيس وأخذ المقاسات..."
                />
              </Field>
              <p className="mt-2 text-[11px] leading-5 text-slate-400">
                المرحلة + التفاصيل بتتسجّل في ملاحظات الدفع، و
                {caseStageOptions.find((option) => option.value === form.caseStage)?.appointmentAction
                  ? ' هتعمل تحديث تلقائي لحالة الموعد المرتبط.'
                  : ' من غير تغيير لحالة الموعد.'}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function InlinePaymentEditor({ payment, onSaved, onDelete }) {
  const [form, setForm] = useState(defaultEditForm(payment));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(defaultEditForm(payment));
  }, [payment]);

  const markFullyPaid = () =>
    setForm((current) => ({ ...current, paidAmount: netPaymentAmount(payment, current.discountAmount), remainingAmount: 0 }));
  const isFullyPaid =
    Math.max(0, netPaymentAmount(payment, form.discountAmount) - clampAmount(form.paidAmount, netPaymentAmount(payment, form.discountAmount))) <= 0;

  const save = async () => {
    setSaving(true);
    try {
      await savePaymentChanges(payment, form);
      toast.success('تم تحديث الدفع');
      onSaved?.();
    } catch (error) {
      toast.error(error.message || 'فشل تحديث الدفع');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-sky-500/15 bg-slate-950/40 p-4">
      <PaymentFields payment={payment} form={form} setForm={setForm} />
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {!isFullyPaid ? (
          <SecondaryButton type="button" onClick={markFullyPaid}>
            تحصيل كامل ({money(netPaymentAmount(payment, form.discountAmount))})
          </SecondaryButton>
        ) : null}
        {payment.source === 'extra' ? (
          <SecondaryButton type="button" onClick={() => onDelete?.(payment.id)} className="hover:bg-rose-500/15 hover:text-rose-200">
            حذف
          </SecondaryButton>
        ) : null}
        <PrimaryButton type="button" onClick={save} disabled={saving}>
          حفظ الدفع
        </PrimaryButton>
      </div>
    </div>
  );
}

export default function RevenueReport({ patientId = '', patientName = '', patientPhone = '', compact = false }) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(() => defaultFilters());
  const [dateRange, setDateRange] = useState('all');
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(defaultEditForm());
  const [savingEdit, setSavingEdit] = useState(false);
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    serviceId: '',
    description: '',
    doctorId: '',
    amount: '',
    paidAmount: '',
    toothNumber: '',
    teethCount: '1',
    method: 'cash',
    notes: '',
  });
  const [savingAdd, setSavingAdd] = useState(false);
  const [clinic, setClinic] = useState(null);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [sendingReceiptId, setSendingReceiptId] = useState('');

  const params = useMemo(
    () => ({
      ...filters,
      patientId: patientId || undefined,
      itemType: undefined,
      status: filters.status === 'ALL' ? undefined : filters.status,
      method: filters.method === 'ALL' ? undefined : filters.method,
      caseStatus: filters.caseStatus === 'ALL' ? undefined : filters.caseStatus,
      cashierExpenses: includeExpenses ? filters.cashierExpenses || 0 : 0,
    }),
    [filters, patientId, includeExpenses]
  );

  const visiblePayments = useMemo(
    () => (report?.payments || []).filter((payment) => matchesItemType(payment, filters.itemType)),
    [report?.payments, filters.itemType]
  );

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await api.get('/payments/revenue-report', { params });
      setReport(res.data);
    } catch (error) {
      toast.error(error.message || 'فشل تحميل تقرير الإيرادات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, dateRange, filters.status, filters.method, filters.caseStatus, includeExpenses]);

  useEffect(() => {
    if (!patientId) return;
    Promise.all([api.get('/services'), api.get('/doctors')])
      .then(([servicesRes, doctorsRes]) => {
        setServices((servicesRes.data.services || []).filter((service) => service.active !== false));
        setDoctors((doctorsRes.data.doctors || []).filter((doctor) => doctor.active !== false));
      })
      .catch(() => {});
  }, [patientId]);

  useEffect(() => {
    api.get('/settings/public')
      .then((res) => setClinic(res.data.clinic || null))
      .catch(() => {});
  }, []);

  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));

  const applyDateChip = (value) => {
    setDateRange(value);
    const today = new Date();
    const end = localDateValue(today);
    if (value === 'today') {
      setFilters((current) => ({ ...current, from: end, to: end }));
    } else if (value === 'week') {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      setFilters((current) => ({ ...current, from: localDateValue(start), to: end }));
    } else if (value === 'month') {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      setFilters((current) => ({ ...current, from: localDateValue(start), to: end }));
    } else if (value === 'all') {
      setFilters((current) => ({ ...current, from: '', to: '' }));
    }
  };

  const saveExtraCharge = async () => {
    if (!addForm.serviceId && !addForm.description.trim()) {
      toast.warn('اختر خدمة أو اكتب وصفاً');
      return;
    }
    if (!(Number(addForm.amount) > 0)) {
      toast.warn('اكتب مبلغاً صحيحاً');
      return;
    }
    setSavingAdd(true);
    try {
      await api.post('/payments/extra-charges', {
        patientId,
        serviceId: addForm.serviceId || undefined,
        description: addForm.description || undefined,
        doctorId: addForm.doctorId || undefined,
        amount: Number(addForm.amount),
        paidAmount: Number(addForm.paidAmount) || 0,
        toothNumber: addForm.toothNumber ? Number(addForm.toothNumber) : undefined,
        teethCount: Math.max(1, Math.floor(Number(addForm.teethCount) || 1)),
        method: addForm.method,
        notes: addForm.notes,
      });
      toast.success('تمت إضافة الخدمة');
      setAddOpen(false);
      setAddForm({
        serviceId: '',
        description: '',
        doctorId: '',
        amount: '',
        paidAmount: '',
        toothNumber: '',
        teethCount: '1',
        method: 'cash',
        notes: '',
      });
      loadReport();
    } catch (error) {
      toast.error(error.message || 'فشل إضافة الخدمة');
    } finally {
      setSavingAdd(false);
    }
  };

  const deleteExtra = async (id) => {
    const ok = await confirmDialog({
      title: 'حذف البند',
      message: 'سيتم حذف هذا البند الإضافي نهائياً.',
      confirmLabel: 'حذف',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/payments/extra-charges/${id}`);
      toast.success('تم الحذف');
      loadReport();
    } catch (error) {
      toast.error(error.message || 'فشل الحذف');
    }
  };

  const openEdit = (payment) => {
    setEditing(payment);
    setEditForm(defaultEditForm(payment));
  };

  const printReceipt = (payment) => {
    setReceiptPayment(payment);
    document.body.classList.remove('print-prescription', 'print-patient-full-file');
    document.body.classList.add('print-payment-receipt');

    const cleanup = () => {
      document.body.classList.remove('print-payment-receipt');
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);
    window.setTimeout(() => window.print(), 50);
  };

  const sendReceiptToWhatsApp = async (payment) => {
    if (!payment?.id) return;
    setSendingReceiptId(payment.id);
    try {
      await api.post('/payments/send-receipt', {
        id: payment.id,
        source: payment.source || 'payment',
      });
      toast.success('تم إرسال الإيصال على واتساب');
    } catch (error) {
      toast.error(error.message || 'فشل إرسال الإيصال على واتساب');
    } finally {
      setSendingReceiptId('');
    }
  };

  const markFullyPaid = () =>
    setEditForm((current) => ({ ...current, paidAmount: netPaymentAmount(editing, current.discountAmount), remainingAmount: 0 }));
  const editingFullyPaid =
    editing &&
    Math.max(0, netPaymentAmount(editing, editForm.discountAmount) - clampAmount(editForm.paidAmount, netPaymentAmount(editing, editForm.discountAmount))) <= 0;

  const showAllPayments = () => {
    applyDateChip('all');
  };

  const exportExcel = () => {
    if (!report) return toast.warn('حمّل التقرير أولاً');
    const summaryRows = [
      ['البند', 'القيمة'],
      ['إجمالي الإيرادات', summary.totalRevenue || 0],
      ['حجز الخدمة (إيراد محجوز)', summary.totalBookedRevenue || 0],
      ['خدمات إضافية أثناء الكشف', summary.totalDoctorAddedRevenue || 0],
      ['إجمالي المدفوع', summary.totalReceived || 0],
      ['إجمالي الديون / المتبقي', summary.totalDebt || 0],
      ['إجمالي الربح', summary.totalProfit || 0],
      ['مصاريف الكاشير', summary.cashierExpenses || 0],
      ['عدد الحالات', summary.caseCount || 0],
      ['حالات بها مدفوعات', summary.casesWithPayments || 0],
      ['حالات بدون مدفوعات', summary.casesWithoutPayments || 0],
      ['مرضى لديهم مدفوعات', summary.patientsWithPayments || 0],
      ['مرضى عليهم ديون', summary.patientsWithDebts || 0],
      ['من تاريخ', filters.from || 'كل الفترات'],
      ['إلى تاريخ', filters.to || 'كل الفترات'],
      ['حالة الدفع', filters.status],
      ['طريقة الدفع', filters.method],
      ['حالة الحالة', filters.caseStatus],
      ['نوع البند', itemTypeOptions.find((option) => option.value === filters.itemType)?.label || 'كل البنود'],
      ['بحث', filters.search],
    ];

    const serviceRows = [
      ['الخدمة / الحالة', 'الصافي', 'حجز الخدمة', 'خدمات إضافية أثناء الكشف', 'الديون / المتبقي', 'المدفوع', 'عدد الحالات', 'عدد الأسنان', 'النوع'],
      ...(report.rows || []).map((row) => [
        row.serviceName || '',
        row.netAmount || 0,
        row.bookedAmount || 0,
        row.doctorAddedAmount || 0,
        row.debtAmount || 0,
        row.receivedAmount || 0,
        row.caseCount || 0,
        row.teethCount || 0,
        row.caseType || '',
      ]),
    ];

    const paymentRows = [
      [
        'المصدر',
        'اسم المريض',
        'رقم الهاتف',
        'رقم السن',
        'الخدمة / الحالة',
        'نوع البند',
        'الطبيب',
        'تاريخ الدفع',
        'الإجمالي قبل الخصم',
        'الخصم من السعر',
        'الصافي بعد الخصم',
        'المدفوع',
        'المتبقي على المريض',
        'عدد الأسنان',
        'طريقة الدفع',
        'حالة الدفع',
        'حالة الموعد / الحالة',
        'رقم الحجز',
        'ملاحظات',
      ],
      ...visiblePayments.map((payment) => [
        payment.source === 'extra' ? 'خدمة إضافية' : 'دفعة موعد',
        payment.patientName || '',
        payment.patientPhone || '',
        payment.toothNumber || '',
        payment.treatmentType || '',
        paymentSourceLabel(payment),
        payment.doctorName || '',
        formatExcelDate(payment.paymentDate),
        paymentBaseAmount(payment),
        payment.discountAmount || 0,
        payment.amount || 0,
        payment.paidAmount || 0,
        payment.remainingAmount || 0,
        payment.teethCount || 1,
        payment.method || '',
        payment.status || '',
        payment.caseStatus || payment.appointmentStatus || '',
        payment.bookingRef || payment.appointmentId || '',
        payment.notes || '',
      ]),
    ];

    downloadExcelWorkbook(`payments-report-${new Date().toISOString().slice(0, 10)}.xls`, [
      { name: 'ملخص التقرير', rows: summaryRows },
      { name: 'ملخص الخدمات', rows: serviceRows },
      { name: 'كل المدفوعات', rows: paymentRows },
    ]);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await savePaymentChanges(editing, editForm);
      toast.success('تم تحديث الدفع');
      setEditing(null);
      loadReport();
    } catch (error) {
      toast.error(error.message || 'فشل تحديث الدفع');
    } finally {
      setSavingEdit(false);
    }
  };

  const summary = report?.summary || {};

  return (
    <div className="space-y-5">
      {patientId && (patientName || patientPhone) ? (
        <DataCard className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-400">المريض</p>
            <h3 className="text-xl font-black text-white">{patientName || 'مريض غير محدد'}</h3>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-400">رقم الهاتف</p>
            <p className="text-sm font-bold text-sky-200" dir="ltr">
              {patientPhone || '—'}
            </p>
          </div>
        </DataCard>
      ) : null}

      <DataCard className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {dateChips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => applyDateChip(chip.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                dateRange === chip.value
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                  : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Field label="من تاريخ">
            <input
              className={inputClass}
              type="date"
              value={filters.from}
              onChange={(event) => {
                setDateRange('day');
                updateFilter('from', event.target.value);
              }}
            />
          </Field>
          <Field label="إلى تاريخ">
            <input
              className={inputClass}
              type="date"
              value={filters.to}
              onChange={(event) => {
                setDateRange('day');
                updateFilter('to', event.target.value);
              }}
            />
          </Field>
          <Field label="حالة الدفع">
            <select className={inputClass} value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="ALL">كل حالات الدفع</option>
              <option value="PAID">مدفوع</option>
              <option value="PARTIAL">جزئي</option>
              <option value="UNPAID">غير مدفوع</option>
            </select>
          </Field>
          <Field label="طريقة الدفع">
            <select className={inputClass} value={filters.method} onChange={(event) => updateFilter('method', event.target.value)}>
              <option value="ALL">كل الطرق</option>
              <option value="cash">كاش</option>
              <option value="card">بطاقة</option>
              <option value="transfer">تحويل</option>
            </select>
          </Field>
          <Field label="حالة الحالة">
            <select className={inputClass} value={filters.caseStatus} onChange={(event) => updateFilter('caseStatus', event.target.value)}>
              {caseStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="نوع البند">
            <select className={inputClass} value={filters.itemType} onChange={(event) => updateFilter('itemType', event.target.value)}>
              {itemTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-wrap items-end gap-2 xl:col-span-2">
            <PrimaryButton type="button" onClick={loadReport} disabled={loading} className="w-full">
              <RefreshCw className="h-4 w-4" />
              تقرير الإيرادات
            </PrimaryButton>
            <SecondaryButton type="button" onClick={showAllPayments} className="w-full">
              كل المدفوعات
            </SecondaryButton>
            <SecondaryButton type="button" onClick={exportExcel} disabled={!report} className="w-full">
              <Download className="h-4 w-4" />
              تصدير Excel
            </SecondaryButton>
          </div>
        </div>

        {!patientId ? (
          <Field label="بحث باسم المريض أو الخدمة">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className={`${inputClass} pr-10`}
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && loadReport()}
                placeholder="بحث ثم اضغط Enter..."
              />
            </div>
          </Field>
        ) : null}

        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
          <label className="flex items-center gap-3 text-sm font-bold text-white">
            <input
              type="checkbox"
              checked={includeExpenses}
              onChange={(event) => setIncludeExpenses(event.target.checked)}
            />
            احسب الربح بعد خصم مصاريف الكاشير
          </label>
          <p className="mt-2 text-xs leading-6 text-sky-200">
            {includeExpenses
              ? 'الربح = إجمالي الإيراد - مصاريف الكاشير.'
              : 'الربح = إجمالي الإيراد الكلي بدون خصم مصاريف.'}
          </p>
          {includeExpenses ? (
            <div className="mt-3 max-w-xs">
              <Field label="مصاريف الكاشير للفترة">
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  value={filters.cashierExpenses}
                  onChange={(event) => updateFilter('cashierExpenses', event.target.value)}
                  onBlur={loadReport}
                />
              </Field>
            </div>
          ) : null}
        </div>
      </DataCard>

      {loading ? (
        <DataCard>
          <PageLoader />
        </DataCard>
      ) : !report ? (
        <DataCard>
          <EmptyState title="لا يوجد تقرير" description="تعذر تحميل بيانات التقرير." />
        </DataCard>
      ) : (
        <>
          <div className={`grid gap-4 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
            <StatCard title="إجمالي الإيراد" value={money(summary.totalRevenue || 0)} tone="blue" />
            <StatCard title="المدفوع" value={money(summary.totalReceived || 0)} tone="green" />
            <StatCard title="الديون" value={money(summary.totalDebt || 0)} tone="amber" />
            <StatCard
              title="الربح"
              value={money(summary.totalProfit || 0)}
              hint={includeExpenses ? `بعد مصاريف ${money(summary.cashierExpenses || 0)}` : 'بدون خصم مصاريف'}
              tone="slate"
            />
          </div>

          <div className={`grid gap-4 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2'}`}>
            <StatCard
              title="حجز الخدمة"
              value={money(summary.totalBookedRevenue || 0)}
              hint="إيرادات من دفعات المواعيد المحجوزة"
              tone="blue"
            />
            <StatCard
              title="خدمات إضافية أثناء الكشف"
              value={money(summary.totalDoctorAddedRevenue || 0)}
              hint="أي خدمة إضافية لم تكن ضمن حجز الريسبشن"
              tone="violet"
            />
          </div>

          <DataCard>
            <h3 className="mb-4 text-lg font-black text-white">ملخص الخدمات / الحالات</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-slate-400">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2 text-right">الخدمة / الحالة</th>
                    <th className="px-3 py-2 text-right">الصافي</th>
                    <th className="px-3 py-2 text-right">حجز الخدمة</th>
                    <th className="px-3 py-2 text-right">خدمات إضافية أثناء الكشف</th>
                    <th className="px-3 py-2 text-right">الديون</th>
                    <th className="px-3 py-2 text-right">المدفوع</th>
                    <th className="px-3 py-2 text-right">عدد الحالات</th>
                    <th className="px-3 py-2 text-right">عدد الأسنان</th>
                    <th className="px-3 py-2 text-right">النوع</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.rows || []).map((row) => (
                    <tr key={row.serviceId} className="border-b border-white/5 text-slate-200">
                      <td className="px-3 py-2 font-bold">{row.serviceName}</td>
                      <td className="px-3 py-2">{money(row.netAmount)}</td>
                      <td className="px-3 py-2 text-sky-200">{money(row.bookedAmount || 0)}</td>
                      <td className="px-3 py-2 text-violet-200">{money(row.doctorAddedAmount || 0)}</td>
                      <td className="px-3 py-2">{money(row.debtAmount)}</td>
                      <td className="px-3 py-2">{money(row.receivedAmount)}</td>
                      <td className="px-3 py-2">{row.caseCount}</td>
                      <td className="px-3 py-2">{row.teethCount || row.caseCount || 0}</td>
                      <td className="px-3 py-2">{row.caseType}</td>
                    </tr>
                  ))}
                  {(report.rows || []).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                        لا توجد بيانات في هذه الفترة.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </DataCard>

          <DataCard>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-black text-white">تفاصيل المدفوعات المستلمة</h3>
              {patientId ? (
                <PrimaryButton type="button" onClick={() => setAddOpen(true)}>
                  إضافة خدمة أثناء الكشف
                </PrimaryButton>
              ) : null}
            </div>
            {filters.itemType !== 'ALL' ? (
              <p className="mb-3 text-xs font-bold text-sky-200">
                يتم الآن عرض: {itemTypeOptions.find((option) => option.value === filters.itemType)?.label}
              </p>
            ) : null}
            <div className="grid gap-3">
              {visiblePayments.length === 0 ? (
                <EmptyState title="لا توجد مدفوعات" description="لا توجد مدفوعات مطابقة للفلاتر." />
              ) : null}
              {visiblePayments.map((payment) => (
                <div
                  key={payment.id}
                  role={patientId ? undefined : 'button'}
                  tabIndex={patientId ? undefined : 0}
                  onClick={() => !patientId && payment.patientId && navigate(`/patients/${payment.patientId}`)}
                  onKeyDown={(event) =>
                    !patientId && event.key === 'Enter' && payment.patientId && navigate(`/patients/${payment.patientId}`)
                  }
                  className={`rounded-2xl border border-white/10 bg-white/5 p-3 transition ${
                    patientId ? '' : 'cursor-pointer hover:border-sky-500/30 hover:bg-white/10'
                  }`}
                >
                  <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                    <div>
                      <p className="font-bold text-white">
                        {payment.patientName || 'مريض غير محدد'}
                        <span
                          className={`ms-2 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            payment.toothNumber
                              ? 'border-sky-500/30 bg-sky-500/15 text-sky-200'
                              : payment.source === 'extra'
                                ? 'border-violet-500/30 bg-violet-500/15 text-violet-200'
                                : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
                          }`}
                        >
                          {paymentSourceLabel(payment)}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {paymentTitleLine(payment)}
                      </p>
                      {payment.toothNumber ? (
                        <p className="mt-1 text-xs font-bold text-sky-200">رقم السن: {payment.toothNumber}</p>
                      ) : null}
                      <p className="mt-1 text-xs font-bold text-sky-200">عدد الأسنان: {payment.teethCount || 1}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        الإجمالي قبل الخصم: {money(paymentBaseAmount(payment))}
                        {payment.source !== 'extra' ? ` · الخصم من السعر: ${money(payment.discountAmount || 0)}` : ''}
                        {' · '}الصافي: {money(payment.amount || 0)}
                      </p>
                    </div>
                    <div className="text-sm text-slate-300">
                      {new Date(payment.paymentDate).toLocaleString('ar-EG')}
                    </div>
                    <div className="text-sm">
                      <span className="font-black text-emerald-300">{money(payment.paidAmount || 0)}</span>
                      {payment.remainingAmount > 0 ? (
                        <span className="ms-2 text-xs font-bold text-amber-300">متبقي {money(payment.remainingAmount)}</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <SecondaryButton
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          printReceipt(payment);
                        }}
                      >
                        <Printer className="h-4 w-4" />
                        طباعة إيصال
                      </SecondaryButton>
                      <SecondaryButton
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          sendReceiptToWhatsApp(payment);
                        }}
                        disabled={sendingReceiptId === payment.id}
                      >
                        <Send className="h-4 w-4" />
                        إرسال واتساب
                      </SecondaryButton>
                    </div>
                    {!patientId ? (
                      <div className="flex gap-2">
                        <SecondaryButton
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(payment);
                          }}
                        >
                          <Edit3 className="h-4 w-4" />
                          تعديل الدفع
                        </SecondaryButton>
                        {payment.source === 'extra' ? (
                          <SecondaryButton
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteExtra(payment.id);
                            }}
                            className="hover:bg-rose-500/15 hover:text-rose-200"
                          >
                            حذف
                          </SecondaryButton>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {patientId ? (
                    <InlinePaymentEditor payment={payment} onSaved={loadReport} onDelete={deleteExtra} />
                  ) : null}
                </div>
              ))}
            </div>
          </DataCard>
        </>
      )}

      {editing ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setEditing(null)}
          dir="rtl"
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1020] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-black text-white">تعديل الدفع</h3>
            <p className="mt-1 text-sm text-slate-400">
              {editing.patientName} · {paymentTitleLine(editing)} · الإجمالي {money(editing.amount || 0)}
            </p>
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-6 text-amber-100">
              الخصم يقلل الإجمالي، والمبلغ المدفوع يحدد الحالة: غير مدفوع / جزئي / مدفوع بالكامل.
            </div>
            <div className="mt-4">
              <PaymentFields payment={editing} form={editForm} setForm={setEditForm} />
            </div>
            {editing.source !== 'extra' && editing.appointmentId ? (
              <p className="mt-3 text-xs leading-6 text-slate-400">
                تغيير حالة الحالة يحدّث حالة الموعد المرتبط فعلياً. البنود الإضافية لا ترتبط بموعد.
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              {!editingFullyPaid ? (
                <SecondaryButton type="button" onClick={markFullyPaid}>
                  تحصيل كامل ({money(netPaymentAmount(editing, editForm.discountAmount))})
                </SecondaryButton>
              ) : null}
              <SecondaryButton type="button" onClick={() => setEditing(null)}>
                إلغاء
              </SecondaryButton>
              <PrimaryButton type="button" onClick={saveEdit} disabled={savingEdit}>
                حفظ
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}

      {addOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setAddOpen(false)}
          dir="rtl"
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1020] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-black text-white">إضافة خدمة أثناء الكشف</h3>
            <p className="mt-1 text-sm text-slate-400">بند مالي إضافي لهذا المريض مستقل عن المواعيد.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="الخدمة">
                <select
                  className={inputClass}
                  value={addForm.serviceId}
                  onChange={(event) => setAddForm((current) => ({ ...current, serviceId: event.target.value }))}
                >
                  <option value="">أو اكتب وصفاً</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.nameAr || service.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="وصف (إن لم تختر خدمة)">
                <input
                  className={inputClass}
                  value={addForm.description}
                  onChange={(event) => setAddForm((current) => ({ ...current, description: event.target.value }))}
                />
              </Field>
              <Field label="الطبيب (اختياري)">
                <select
                  className={inputClass}
                  value={addForm.doctorId}
                  onChange={(event) => setAddForm((current) => ({ ...current, doctorId: event.target.value }))}
                >
                  <option value="">بدون</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      د. {doctor.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="المبلغ">
                <input
                  className={inputClass}
                  type="number"
                  value={addForm.amount}
                  onChange={(event) => setAddForm((current) => ({ ...current, amount: event.target.value }))}
                />
              </Field>
              <Field label="المدفوع الآن">
                <input
                  className={inputClass}
                  type="number"
                  value={addForm.paidAmount}
                  onChange={(event) => setAddForm((current) => ({ ...current, paidAmount: event.target.value }))}
                />
              </Field>
              <Field label="رقم السن (اختياري)">
                <input
                  className={inputClass}
                  type="number"
                  min="1"
                  max="32"
                  value={addForm.toothNumber}
                  onChange={(event) => setAddForm((current) => ({ ...current, toothNumber: event.target.value }))}
                />
              </Field>
              <Field label="عدد الأسنان">
                <input
                  className={inputClass}
                  type="number"
                  min="1"
                  step="1"
                  value={addForm.teethCount}
                  onChange={(event) => setAddForm((current) => ({ ...current, teethCount: event.target.value }))}
                />
              </Field>
              <Field label="طريقة الدفع">
                <select
                  className={inputClass}
                  value={addForm.method}
                  onChange={(event) => setAddForm((current) => ({ ...current, method: event.target.value }))}
                >
                  <option value="cash">كاش</option>
                  <option value="card">بطاقة</option>
                  <option value="transfer">تحويل</option>
                  <option value="other">أخرى</option>
                </select>
              </Field>
              <Field label="ملاحظات">
                <input
                  className={inputClass}
                  value={addForm.notes}
                  onChange={(event) => setAddForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </Field>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <SecondaryButton type="button" onClick={() => setAddOpen(false)}>
                إلغاء
              </SecondaryButton>
              <PrimaryButton type="button" onClick={saveExtraCharge} disabled={savingAdd}>
                حفظ
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}

      <PaymentReceipt payment={receiptPayment} clinic={clinic} />
    </div>
  );
}
