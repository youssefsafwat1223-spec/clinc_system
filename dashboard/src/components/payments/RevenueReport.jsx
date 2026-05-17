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
  { value: 'today', label: 'ط§ظ„ظٹظˆظ…' },
  { value: 'week', label: 'ط¢ط®ط± ط£ط³ط¨ظˆط¹' },
  { value: 'month', label: 'ط¢ط®ط± ط´ظ‡ط±' },
  { value: 'day', label: 'ظٹظˆظ… ظ…ط­ط¯ط¯' },
];

const caseStatusOptions = [
  { value: 'ALL', label: 'ظƒظ„ ط§ظ„ط­ط§ظ„ط§طھ' },
  { value: 'WASEL', label: 'ظˆط§طµظ„' },
  { value: 'MUNTAHI', label: 'ظ…ظ†طھظ‡ظٹ' },
  { value: 'MOSTAMERA', label: 'ظ…ط³طھظ…ط±ط©' },
];

function InlinePaymentEditor({ payment, onSaved, onDelete }) {
  const [form, setForm] = useState({
    paidAmount: payment.paidAmount || 0,
    discountAmount: payment.discountAmount || 0,
    method: payment.method || 'cash',
    notes: payment.notes || '',
    caseStatus: payment.caseStatus || '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      paidAmount: payment.paidAmount || 0,
      discountAmount: payment.discountAmount || 0,
      method: payment.method || 'cash',
      notes: payment.notes || '',
      caseStatus: payment.caseStatus || '',
    });
  }, [payment]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const markFullyPaid = () => update('paidAmount', payment.amount || 0);

  const save = async () => {
    setSaving(true);
    try {
      if (payment.source === 'extra') {
        await api.patch(`/payments/extra-charges/${payment.id}`, {
          paidAmount: Number(form.paidAmount) || 0,
          method: form.method,
          notes: form.notes,
        });
      } else {
        await api.put(`/payments/${payment.id}`, {
          paidAmount: Number(form.paidAmount) || 0,
          discountAmount: Number(form.discountAmount) || 0,
          method: form.method,
          notes: form.notes,
        });

        if (payment.appointmentId && form.caseStatus && form.caseStatus !== payment.caseStatus) {
          if (form.caseStatus === 'WASEL') {
            await api.post(`/appointments/${payment.appointmentId}/complete`);
          } else if (form.caseStatus === 'MOSTAMERA') {
            await api.post(`/appointments/${payment.appointmentId}/confirm`);
          } else if (form.caseStatus === 'MUNTAHI') {
            await api.post(`/appointments/${payment.appointmentId}/cancel`, {
              reason: 'ط¥ظ†ظ‡ط§ط، ط§ظ„ط­ط§ظ„ط© ظ…ظ† ط´ط§ط´ط© ط§ظ„ظ…ط¯ظپظˆط¹ط§طھ',
            });
          }
        }
      }
      toast.success('طھظ… طھط­ط¯ظٹط« ط§ظ„ط¯ظپط¹');
      onSaved?.();
    } catch (error) {
      toast.error(error.message || 'ظپط´ظ„ طھط­ط¯ظٹط« ط§ظ„ط¯ظپط¹');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-sky-500/15 bg-slate-950/40 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Field label="ط§ظ„ظ…ط¨ظ„ط؛ ط§ظ„ظ…ط¯ظپظˆط¹">
          <input
            className={inputClass}
            type="number"
            value={form.paidAmount}
            onChange={(event) => update('paidAmount', event.target.value)}
          />
        </Field>
        {payment.source !== 'extra' ? (
          <Field label="ط§ظ„ط®طµظ…">
            <input
              className={inputClass}
              type="number"
              value={form.discountAmount}
              onChange={(event) => update('discountAmount', event.target.value)}
            />
          </Field>
        ) : null}
        <Field label="ط·ط±ظٹظ‚ط© ط§ظ„ط¯ظپط¹">
          <select className={inputClass} value={form.method} onChange={(event) => update('method', event.target.value)}>
            <option value="cash">ظƒط§ط´</option>
            <option value="card">ط¨ط·ط§ظ‚ط©</option>
            <option value="transfer">طھط­ظˆظٹظ„</option>
            <option value="other">ط£ط®ط±ظ‰</option>
          </select>
        </Field>
        {payment.source !== 'extra' && payment.appointmentId ? (
          <Field label="ط­ط§ظ„ط© ط§ظ„ط­ط§ظ„ط©">
            <select className={inputClass} value={form.caseStatus || ''} onChange={(event) => update('caseStatus', event.target.value)}>
              <option value="">â€” ط¨ط¯ظˆظ† طھط؛ظٹظٹط± â€”</option>
              <option value="WASEL">ظˆط§طµظ„ (طھظ… ط§ظ„ظƒط´ظپ)</option>
              <option value="MOSTAMERA">ظ…ط³طھظ…ط±ط© (طھط£ظƒظٹط¯)</option>
              <option value="MUNTAHI">ظ…ظ†طھظ‡ظٹ (ط¥ظ„ط؛ط§ط،)</option>
            </select>
          </Field>
        ) : null}
        <Field label="ظ…ظ„ط§ط­ط¸ط§طھ">
          <input className={inputClass} value={form.notes} onChange={(event) => update('notes', event.target.value)} />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <SecondaryButton type="button" onClick={markFullyPaid}>
          طھط­طµظٹظ„ ظƒط§ظ…ظ„ ({money(payment.amount || 0)})
        </SecondaryButton>
        {payment.source === 'extra' ? (
          <SecondaryButton type="button" onClick={() => onDelete?.(payment.id)} className="hover:bg-rose-500/15 hover:text-rose-200">
            ط­ط°ظپ
          </SecondaryButton>
        ) : null}
        <PrimaryButton type="button" onClick={save} disabled={saving}>
          ط­ظپط¸ ط§ظ„ط¯ظپط¹
        </PrimaryButton>
      </div>
    </div>
  );
}

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
      toast.error(error.message || 'ظپط´ظ„ طھط­ظ…ظٹظ„ طھظ‚ط±ظٹط± ط§ظ„ط¥ظٹط±ط§ط¯ط§طھ');
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
      toast.warn('ط§ط®طھط± ط®ط¯ظ…ط© ط£ظˆ ط§ظƒطھط¨ ظˆطµظپط§ظ‹');
      return;
    }
    if (!(Number(addForm.amount) > 0)) {
      toast.warn('ط§ظƒطھط¨ ظ…ط¨ظ„ط؛ط§ظ‹ طµط­ظٹط­ط§ظ‹');
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
      toast.success('طھظ…طھ ط¥ط¶ط§ظپط© ط§ظ„ط®ط¯ظ…ط©');
      setAddOpen(false);
      setAddForm({ serviceId: '', description: '', doctorId: '', amount: '', paidAmount: '', method: 'cash', notes: '' });
      loadReport();
    } catch (error) {
      toast.error(error.message || 'ظپط´ظ„ ط¥ط¶ط§ظپط© ط§ظ„ط®ط¯ظ…ط©');
    } finally {
      setSavingAdd(false);
    }
  };

  const deleteExtra = async (id) => {
    const ok = await confirmDialog({
      title: 'ط­ط°ظپ ط§ظ„ط¨ظ†ط¯',
      message: 'ط³ظٹطھظ… ط­ط°ظپ ظ‡ط°ط§ ط§ظ„ط¨ظ†ط¯ ط§ظ„ط¥ط¶ط§ظپظٹ ظ†ظ‡ط§ط¦ظٹط§ظ‹.',
      confirmLabel: 'ط­ط°ظپ',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/payments/extra-charges/${id}`);
      toast.success('طھظ… ط§ظ„ط­ط°ظپ');
      loadReport();
    } catch (error) {
      toast.error(error.message || 'ظپط´ظ„ ط§ظ„ط­ط°ظپ');
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
        // Case status change â†’ update the linked appointment via its
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
              reason: 'ط¥ظ†ظ‡ط§ط، ط§ظ„ط­ط§ظ„ط© ظ…ظ† ط´ط§ط´ط© ط§ظ„ظ…ط¯ظپظˆط¹ط§طھ',
            });
          }
        }
      }
      toast.success('طھظ… طھط­ط¯ظٹط« ط§ظ„ط¯ظپط¹');
      setEditing(null);
      loadReport();
    } catch (error) {
      toast.error(error.message || 'ظپط´ظ„ طھط­ط¯ظٹط« ط§ظ„ط¯ظپط¹');
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
          <Field label="ظ…ظ† طھط§ط±ظٹط®">
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
          <Field label="ط¥ظ„ظ‰ طھط§ط±ظٹط®">
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
          <Field label="ط­ط§ظ„ط© ط§ظ„ط¯ظپط¹">
            <select className={inputClass} value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="ALL">ظƒظ„ ط­ط§ظ„ط§طھ ط§ظ„ط¯ظپط¹</option>
              <option value="PAID">ظ…ط¯ظپظˆط¹</option>
              <option value="PARTIAL">ط¬ط²ط¦ظٹ</option>
              <option value="UNPAID">ط؛ظٹط± ظ…ط¯ظپظˆط¹</option>
            </select>
          </Field>
          <Field label="ط·ط±ظٹظ‚ط© ط§ظ„ط¯ظپط¹">
            <select className={inputClass} value={filters.method} onChange={(event) => updateFilter('method', event.target.value)}>
              <option value="ALL">ظƒظ„ ط§ظ„ط·ط±ظ‚</option>
              <option value="cash">ظƒط§ط´</option>
              <option value="card">ط¨ط·ط§ظ‚ط©</option>
              <option value="transfer">طھط­ظˆظٹظ„</option>
            </select>
          </Field>
          <Field label="ط­ط§ظ„ط© ط§ظ„ط­ط§ظ„ط©">
            <select className={inputClass} value={filters.caseStatus} onChange={(event) => updateFilter('caseStatus', event.target.value)}>
              {caseStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <PrimaryButton type="button" onClick={loadReport} disabled={loading} className="w-full">
              <RefreshCw className="h-4 w-4" />
              طھظ‚ط±ظٹط± ط§ظ„ط¥ظٹط±ط§ط¯ط§طھ
            </PrimaryButton>
          </div>
        </div>

        {!patientId ? (
          <Field label="ط¨ط­ط« ط¨ط§ط³ظ… ط§ظ„ظ…ط±ظٹط¶ ط£ظˆ ط§ظ„ط®ط¯ظ…ط©">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className={`${inputClass} pr-10`}
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && loadReport()}
                placeholder="ط¨ط­ط« ط«ظ… ط§ط¶ط؛ط· Enter..."
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
            ط§ط­ط³ط¨ ط§ظ„ط±ط¨ط­ ط¨ط¹ط¯ ط®طµظ… ظ…طµط§ط±ظٹظپ ط§ظ„ظƒط§ط´ظٹط±
          </label>
          <p className="mt-2 text-xs leading-6 text-sky-200">
            {includeExpenses
              ? 'ط§ظ„ط±ط¨ط­ = ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ط¥ظٹط±ط§ط¯ âˆ’ ظ…طµط§ط±ظٹظپ ط§ظ„ظƒط§ط´ظٹط±.'
              : 'ط§ظ„ط±ط¨ط­ = ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ط¥ظٹط±ط§ط¯ ط§ظ„ظƒظ„ظٹ (ط¨ط¯ظˆظ† ط®طµظ… ظ…طµط§ط±ظٹظپ).'}
          </p>
          {includeExpenses ? (
            <div className="mt-3 max-w-xs">
              <Field label="ظ…طµط§ط±ظٹظپ ط§ظ„ظƒط§ط´ظٹط± ظ„ظ„ظپطھط±ط©">
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
          <EmptyState title="ظ„ط§ ظٹظˆط¬ط¯ طھظ‚ط±ظٹط±" description="طھط¹ط°ط± طھط­ظ…ظٹظ„ ط¨ظٹط§ظ†ط§طھ ط§ظ„طھظ‚ط±ظٹط±." />
        </DataCard>
      ) : (
        <>
          <div className={`grid gap-4 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
            <StatCard title="ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ط¥ظٹط±ط§ط¯" value={money(summary.totalRevenue || 0)} tone="blue" />
            <StatCard title="ط§ظ„ظ…ط¯ظپظˆط¹" value={money(summary.totalReceived || 0)} tone="green" />
            <StatCard title="ط§ظ„ط¯ظٹظˆظ†" value={money(summary.totalDebt || 0)} tone="amber" />
            <StatCard
              title="ط§ظ„ط±ط¨ط­"
              value={money(summary.totalProfit || 0)}
              hint={includeExpenses ? `ط¨ط¹ط¯ ظ…طµط§ط±ظٹظپ ${money(summary.cashierExpenses || 0)}` : 'ط¨ط¯ظˆظ† ط®طµظ… ظ…طµط§ط±ظٹظپ'}
              tone="slate"
            />
          </div>

          <DataCard>
            <h3 className="mb-4 text-lg font-black text-white">ظ…ظ„ط®طµ ط§ظ„ط®ط¯ظ…ط§طھ / ط§ظ„ط­ط§ظ„ط§طھ</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-slate-400">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2 text-right">ط§ظ„ط®ط¯ظ…ط© / ط§ظ„ط­ط§ظ„ط©</th>
                    <th className="px-3 py-2 text-right">ط§ظ„طµط§ظپظٹ</th>
                    <th className="px-3 py-2 text-right">ط§ظ„ط¯ظٹظˆظ†</th>
                    <th className="px-3 py-2 text-right">ط§ظ„ظ…ط¯ظپظˆط¹</th>
                    <th className="px-3 py-2 text-right">ط¹ط¯ط¯ ط§ظ„ط­ط§ظ„ط§طھ</th>
                    <th className="px-3 py-2 text-right">ط§ظ„ظ†ظˆط¹</th>
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
                        ظ„ط§ طھظˆط¬ط¯ ط¨ظٹط§ظ†ط§طھ ظپظٹ ظ‡ط°ظ‡ ط§ظ„ظپطھط±ط©.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </DataCard>

          <DataCard>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-black text-white">طھظپط§طµظٹظ„ ط§ظ„ظ…ط¯ظپظˆط¹ط§طھ ط§ظ„ظ…ط³طھظ„ظ…ط©</h3>
              {patientId ? (
                <PrimaryButton type="button" onClick={() => setAddOpen(true)}>
                  ط¥ط¶ط§ظپط© ط®ط¯ظ…ط© + ظ…ط¨ظ„ط؛
                </PrimaryButton>
              ) : null}
            </div>
            <div className="grid gap-3">
              {(report.payments || []).length === 0 ? (
                <EmptyState title="ظ„ط§ طھظˆط¬ط¯ ظ…ط¯ظپظˆط¹ط§طھ" description="ظ„ط§ طھظˆط¬ط¯ ظ…ط¯ظپظˆط¹ط§طھ ظ…ط·ط§ط¨ظ‚ط© ظ„ظ„ظپظ„ط§طھط±." />
              ) : null}
              {(report.payments || []).map((payment) => (
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
                        {payment.patientName || 'ظ…ط±ظٹط¶ ط؛ظٹط± ظ…ط­ط¯ط¯'}
                        {payment.source === 'extra' ? (
                          <span className="ms-2 rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-200">
                            ط®ط¯ظ…ط© ط¥ط¶ط§ظپظٹط©
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-400">
                        {payment.treatmentType || '-'} آ· ط¯. {payment.doctorName || '-'} آ· {payment.patientPhone || ''}
                      </p>
                    </div>
                    <div className="text-sm text-slate-300">
                      {new Date(payment.paymentDate).toLocaleString('ar-EG')}
                    </div>
                    <div className="text-sm">
                      <span className="font-black text-emerald-300">{money(payment.paidAmount || 0)}</span>
                      {payment.remainingAmount > 0 ? (
                        <span className="ms-2 text-xs font-bold text-amber-300">ظ…طھط¨ظ‚ظٹ {money(payment.remainingAmount)}</span>
                      ) : null}
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
                          طھط¹ط¯ظٹظ„ ط§ظ„ط¯ظپط¹
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
                            ط­ط°ظپ
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
            <h3 className="text-xl font-black text-white">طھط¹ط¯ظٹظ„ ط§ظ„ط¯ظپط¹</h3>
            <p className="mt-1 text-sm text-slate-400">
              {editing.patientName} آ· {editing.treatmentType || '-'} آ· ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ {money(editing.amount || 0)}
            </p>
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-6 text-amber-100">
              ط§ظ„ط®طµظ… ظٹظ‚ظ„ظ‘ظ„ ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹطŒ ظˆط§ظ„ظ…ط¨ظ„ط؛ ط§ظ„ظ…ط¯ظپظˆط¹ ظٹط­ط¯ظ‘ط¯ ط§ظ„ط­ط§ظ„ط©: ط؛ظٹط± ظ…ط¯ظپظˆط¹ / ط¬ط²ط¦ظٹ / ظ…ط¯ظپظˆط¹ ط¨ط§ظ„ظƒط§ظ…ظ„.
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="ط§ظ„ظ…ط¨ظ„ط؛ ط§ظ„ظ…ط¯ظپظˆط¹">
                <input
                  className={inputClass}
                  type="number"
                  value={editForm.paidAmount}
                  onChange={(event) => setEditForm((current) => ({ ...current, paidAmount: event.target.value }))}
                />
              </Field>
              <Field label="ط§ظ„ط®طµظ…">
                <input
                  className={inputClass}
                  type="number"
                  value={editForm.discountAmount}
                  onChange={(event) => setEditForm((current) => ({ ...current, discountAmount: event.target.value }))}
                />
              </Field>
              <Field label="ط·ط±ظٹظ‚ط© ط§ظ„ط¯ظپط¹">
                <select
                  className={inputClass}
                  value={editForm.method}
                  onChange={(event) => setEditForm((current) => ({ ...current, method: event.target.value }))}
                >
                  <option value="cash">ظƒط§ط´</option>
                  <option value="card">ط¨ط·ط§ظ‚ط©</option>
                  <option value="transfer">طھط­ظˆظٹظ„</option>
                  <option value="other">ط£ط®ط±ظ‰</option>
                </select>
              </Field>
              <Field label="ظ…ظ„ط§ط­ط¸ط§طھ">
                <input
                  className={inputClass}
                  value={editForm.notes}
                  onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </Field>
              {editing.source !== 'extra' && editing.appointmentId ? (
                <Field label="ط­ط§ظ„ط© ط§ظ„ط­ط§ظ„ط©">
                  <select
                    className={inputClass}
                    value={editForm.caseStatus || ''}
                    onChange={(event) => setEditForm((current) => ({ ...current, caseStatus: event.target.value }))}
                  >
                    <option value="">â€” ط¨ط¯ظˆظ† طھط؛ظٹظٹط± â€”</option>
                    <option value="WASEL">ظˆط§طµظ„ (طھظ… ط§ظ„ظƒط´ظپ)</option>
                    <option value="MOSTAMERA">ظ…ط³طھظ…ط±ط© (طھط£ظƒظٹط¯)</option>
                    <option value="MUNTAHI">ظ…ظ†طھظ‡ظٹ (ط¥ظ„ط؛ط§ط،)</option>
                  </select>
                </Field>
              ) : null}
            </div>
            {editing.source !== 'extra' && editing.appointmentId ? (
              <p className="mt-3 text-xs leading-6 text-slate-400">
                طھط؛ظٹظٹط± ط­ط§ظ„ط© ط§ظ„ط­ط§ظ„ط© ظٹط­ط¯ظ‘ط« ط­ط§ظ„ط© ط§ظ„ظ…ظˆط¹ط¯ ط§ظ„ظ…ط±طھط¨ط· ظپط¹ظ„ظٹط§ظ‹ (ظ…ط¹ ط¢ط«ط§ط±ظ‡ ط§ظ„ط¬ط§ظ†ط¨ظٹط©). ط§ظ„ط¨ظ†ظˆط¯ ط§ظ„ط¥ط¶ط§ظپظٹط© ظ„ط§ طھط±طھط¨ط· ط¨ظ…ظˆط¹ط¯.
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <SecondaryButton type="button" onClick={markFullyPaid}>
                طھط­طµظٹظ„ ظƒط§ظ…ظ„ ({money(editing.amount || 0)})
              </SecondaryButton>
              <SecondaryButton type="button" onClick={() => setEditing(null)}>
                ط¥ظ„ط؛ط§ط،
              </SecondaryButton>
              <PrimaryButton type="button" onClick={saveEdit} disabled={savingEdit}>
                ط­ظپط¸
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
            <h3 className="text-xl font-black text-white">ط¥ط¶ط§ظپط© ط®ط¯ظ…ط© + ظ…ط¨ظ„ط؛</h3>
            <p className="mt-1 text-sm text-slate-400">ط¨ظ†ط¯ ظ…ط§ظ„ظٹ ط¥ط¶ط§ظپظٹ ظ„ظ‡ط°ط§ ط§ظ„ظ…ط±ظٹط¶ (ظ…ط³طھظ‚ظ„ ط¹ظ† ط§ظ„ظ…ظˆط§ط¹ظٹط¯).</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="ط§ظ„ط®ط¯ظ…ط©">
                <select
                  className={inputClass}
                  value={addForm.serviceId}
                  onChange={(event) => setAddForm((current) => ({ ...current, serviceId: event.target.value }))}
                >
                  <option value="">â€” ط£ظˆ ط§ظƒطھط¨ ظˆطµظپط§ظ‹ â€”</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>{service.nameAr || service.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="ظˆطµظپ (ط¥ظ† ظ„ظ… طھط®طھط± ط®ط¯ظ…ط©)">
                <input
                  className={inputClass}
                  value={addForm.description}
                  onChange={(event) => setAddForm((current) => ({ ...current, description: event.target.value }))}
                />
              </Field>
              <Field label="ط§ظ„ط·ط¨ظٹط¨ (ط§ط®طھظٹط§ط±ظٹ)">
                <select
                  className={inputClass}
                  value={addForm.doctorId}
                  onChange={(event) => setAddForm((current) => ({ ...current, doctorId: event.target.value }))}
                >
                  <option value="">ط¨ط¯ظˆظ†</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>ط¯. {doctor.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="ط§ظ„ظ…ط¨ظ„ط؛">
                <input
                  className={inputClass}
                  type="number"
                  value={addForm.amount}
                  onChange={(event) => setAddForm((current) => ({ ...current, amount: event.target.value }))}
                />
              </Field>
              <Field label="ط§ظ„ظ…ط¯ظپظˆط¹ ط§ظ„ط¢ظ†">
                <input
                  className={inputClass}
                  type="number"
                  value={addForm.paidAmount}
                  onChange={(event) => setAddForm((current) => ({ ...current, paidAmount: event.target.value }))}
                />
              </Field>
              <Field label="ط·ط±ظٹظ‚ط© ط§ظ„ط¯ظپط¹">
                <select
                  className={inputClass}
                  value={addForm.method}
                  onChange={(event) => setAddForm((current) => ({ ...current, method: event.target.value }))}
                >
                  <option value="cash">ظƒط§ط´</option>
                  <option value="card">ط¨ط·ط§ظ‚ط©</option>
                  <option value="transfer">طھط­ظˆظٹظ„</option>
                  <option value="other">ط£ط®ط±ظ‰</option>
                </select>
              </Field>
              <Field label="ظ…ظ„ط§ط­ط¸ط§طھ">
                <input
                  className={inputClass}
                  value={addForm.notes}
                  onChange={(event) => setAddForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <SecondaryButton type="button" onClick={() => setAddOpen(false)}>ط¥ظ„ط؛ط§ط،</SecondaryButton>
              <PrimaryButton type="button" onClick={saveExtraCharge} disabled={savingAdd}>ط­ظپط¸</PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
