import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit3, RefreshCw, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../api/client';
import { DataCard, Field, PageLoader, PrimaryButton, SecondaryButton, StatCard, inputClass } from '../ui';
import EmptyState from '../EmptyState';
import { confirmDialog } from '../dialogs';
import { money, todayInputValue } from '../../utils/appointmentUi';

const pad = (value) => String(value).padStart(2, '0');
const localDateValue = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const dateChips = [
  { value: 'today', label: 'اليوم' },
  { value: 'week', label: 'آخر أسبوع' },
  { value: 'month', label: 'آخر شهر' },
  { value: 'day', label: 'يوم محدد' },
];

const caseStatusOptions = [
  { value: 'ALL', label: 'كل الحالات' },
  { value: 'WASEL', label: 'واصل' },
  { value: 'MUNTAHI', label: 'منتهي' },
  { value: 'MOSTAMERA', label: 'مستمرة' },
];

const defaultFilters = () => ({
  from: todayInputValue(),
  to: todayInputValue(),
  status: 'ALL',
  method: 'ALL',
  caseStatus: 'ALL',
  search: '',
  cashierExpenses: '',
});

export default function RevenueReport({ patientId = '', compact = false }) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(defaultFilters);
  const [dateRange, setDateRange] = useState('today');
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ paidAmount: 0, discountAmount: 0, method: 'cash', notes: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ serviceId: '', description: '', doctorId: '', amount: '', paidAmount: '', method: 'cash', notes: '' });
  const [savingAdd, setSavingAdd] = useState(false);

  const params = useMemo(
    () => ({
      ...filters,
      patientId: patientId || undefined,
      status: filters.status === 'ALL' ? undefined : filters.status,
      method: filters.method === 'ALL' ? undefined : filters.method,
      caseStatus: filters.caseStatus === 'ALL' ? undefined : filters.caseStatus,
      cashierExpenses: includeExpenses ? filters.cashierExpenses || 0 : 0,
    }),
    [filters, patientId, includeExpenses]
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
        setServices((servicesRes.data.services || []).filter((s) => s.active !== false));
        setDoctors((doctorsRes.data.doctors || []).filter((d) => d.active !== false));
      })
      .catch(() => {});
  }, [patientId]);

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
        method: addForm.method,
        notes: addForm.notes,
      });
      toast.success('تمت إضافة الخدمة');
      setAddOpen(false);
      setAddForm({ serviceId: '', description: '', doctorId: '', amount: '', paidAmount: '', method: 'cash', notes: '' });
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
    }
  };

  const openEdit = (payment) => {
    setEditing(payment);
    setEditForm({
      paidAmount: payment.paidAmount || 0,
      discountAmount: payment.discountAmount || 0,
      method: payment.method || 'cash',
      notes: payment.notes || '',
      caseStatus: payment.caseStatus || '',
    });
  };

  const markFullyPaid = () =>
    setEditForm((current) => ({ ...current, paidAmount: editing?.amount || current.paidAmount }));

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      if (editing.source === 'extra') {
        await api.patch(`/payments/extra-charges/${editing.id}`, {
          paidAmount: Number(editForm.paidAmount) || 0,
          method: editForm.method,
          notes: editForm.notes,
        });
      } else {
        await api.put(`/payments/${editing.id}`, {
          paidAmount: Number(editForm.paidAmount) || 0,
          discountAmount: Number(editForm.discountAmount) || 0,
          method: editForm.method,
          notes: editForm.notes,
        });
        // Case status change → update the linked appointment via its
        // existing endpoints so side effects stay consistent.
        if (
          editing.appointmentId &&
          editForm.caseStatus &&
          editForm.caseStatus !== editing.caseStatus
        ) {
          if (editForm.caseStatus === 'WASEL') {
            await api.post(`/appointments/${editing.appointmentId}/complete`);
          } else if (editForm.caseStatus === 'MOSTAMERA') {
            await api.post(`/appointments/${editing.appointmentId}/confirm`);
          } else if (editForm.caseStatus === 'MUNTAHI') {
            await api.post(`/appointments/${editing.appointmentId}/cancel`, {
              reason: 'إنهاء الحالة من شاشة المدفوعات',
            });
          }
        }
      }
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
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <PrimaryButton type="button" onClick={loadReport} disabled={loading} className="w-full">
              <RefreshCw className="h-4 w-4" />
              تقرير الإيرادات
            </PrimaryButton>
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

        {/* Profit mode toggle + explanation */}
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
              ? 'الربح = إجمالي الإيراد − مصاريف الكاشير.'
              : 'الربح = إجمالي الإيراد الكلي (بدون خصم مصاريف).'}
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

          <DataCard>
            <h3 className="mb-4 text-lg font-black text-white">ملخص الخدمات / الحالات</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-slate-400">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2 text-right">الخدمة / الحالة</th>
                    <th className="px-3 py-2 text-right">الصافي</th>
                    <th className="px-3 py-2 text-right">الديون</th>
                    <th className="px-3 py-2 text-right">المدفوع</th>
                    <th className="px-3 py-2 text-right">عدد الحالات</th>
                    <th className="px-3 py-2 text-right">النوع</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.rows || []).map((row) => (
                    <tr key={row.serviceId} className="border-b border-white/5 text-slate-200">
                      <td className="px-3 py-2 font-bold">{row.serviceName}</td>
                      <td className="px-3 py-2">{money(row.netAmount)}</td>
                      <td className="px-3 py-2">{money(row.debtAmount)}</td>
                      <td className="px-3 py-2">{money(row.receivedAmount)}</td>
                      <td className="px-3 py-2">{row.caseCount}</td>
                      <td className="px-3 py-2">{row.caseType}</td>
                    </tr>
                  ))}
                  {(report.rows || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
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
                  إضافة خدمة + مبلغ
                </PrimaryButton>
              ) : null}
            </div>
            <div className="grid gap-3">
              {(report.payments || []).length === 0 ? (
                <EmptyState title="لا توجد مدفوعات" description="لا توجد مدفوعات مطابقة للفلاتر." />
              ) : null}
              {(report.payments || []).map((payment) => (
                <div
                  key={payment.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => payment.patientId && navigate(`/patients/${payment.patientId}`)}
                  onKeyDown={(event) =>
                    event.key === 'Enter' && payment.patientId && navigate(`/patients/${payment.patientId}`)
                  }
                  className="grid cursor-pointer gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:border-sky-500/30 hover:bg-white/10 md:grid-cols-[1fr_auto_auto_auto] md:items-center"
                >
                  <div>
                    <p className="font-bold text-white">
                      {payment.patientName || 'مريض غير محدد'}
                      {payment.source === 'extra' ? (
                        <span className="ms-2 rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-200">
                          خدمة إضافية
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-400">
                      {payment.treatmentType || '-'} · د. {payment.doctorName || '-'} · {payment.patientPhone || ''}
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
              {editing.patientName} · {editing.treatmentType || '-'} · الإجمالي {money(editing.amount || 0)}
            </p>
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-6 text-amber-100">
              الخصم يقلّل الإجمالي، والمبلغ المدفوع يحدّد الحالة: غير مدفوع / جزئي / مدفوع بالكامل.
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="المبلغ المدفوع">
                <input
                  className={inputClass}
                  type="number"
                  value={editForm.paidAmount}
                  onChange={(event) => setEditForm((current) => ({ ...current, paidAmount: event.target.value }))}
                />
              </Field>
              <Field label="الخصم">
                <input
                  className={inputClass}
                  type="number"
                  value={editForm.discountAmount}
                  onChange={(event) => setEditForm((current) => ({ ...current, discountAmount: event.target.value }))}
                />
              </Field>
              <Field label="طريقة الدفع">
                <select
                  className={inputClass}
                  value={editForm.method}
                  onChange={(event) => setEditForm((current) => ({ ...current, method: event.target.value }))}
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
                  value={editForm.notes}
                  onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </Field>
              {editing.source !== 'extra' && editing.appointmentId ? (
                <Field label="حالة الحالة">
                  <select
                    className={inputClass}
                    value={editForm.caseStatus || ''}
                    onChange={(event) => setEditForm((current) => ({ ...current, caseStatus: event.target.value }))}
                  >
                    <option value="">— بدون تغيير —</option>
                    <option value="WASEL">واصل (تم الكشف)</option>
                    <option value="MOSTAMERA">مستمرة (تأكيد)</option>
                    <option value="MUNTAHI">منتهي (إلغاء)</option>
                  </select>
                </Field>
              ) : null}
            </div>
            {editing.source !== 'extra' && editing.appointmentId ? (
              <p className="mt-3 text-xs leading-6 text-slate-400">
                تغيير حالة الحالة يحدّث حالة الموعد المرتبط فعلياً (مع آثاره الجانبية). البنود الإضافية لا ترتبط بموعد.
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <SecondaryButton type="button" onClick={markFullyPaid}>
                تحصيل كامل ({money(editing.amount || 0)})
              </SecondaryButton>
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
            <h3 className="text-xl font-black text-white">إضافة خدمة + مبلغ</h3>
            <p className="mt-1 text-sm text-slate-400">بند مالي إضافي لهذا المريض (مستقل عن المواعيد).</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="الخدمة">
                <select
                  className={inputClass}
                  value={addForm.serviceId}
                  onChange={(event) => setAddForm((current) => ({ ...current, serviceId: event.target.value }))}
                >
                  <option value="">— أو اكتب وصفاً —</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>{service.nameAr || service.name}</option>
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
                    <option key={doctor.id} value={doctor.id}>د. {doctor.name}</option>
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
            <div className="mt-6 flex justify-end gap-3">
              <SecondaryButton type="button" onClick={() => setAddOpen(false)}>إلغاء</SecondaryButton>
              <PrimaryButton type="button" onClick={saveExtraCharge} disabled={savingAdd}>حفظ</PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
