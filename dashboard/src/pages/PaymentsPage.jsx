import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, CreditCard, DollarSign, Edit3, Percent, RefreshCw, Search, Wallet } from 'lucide-react';
import { toast } from 'react-toastify';
import AppLayout from '../components/Layout';
import api from '../api/client';
import { DataCard, Field, PageHeader, PrimaryButton, SecondaryButton, StatCard, StatusBadge, inputClass } from '../components/ui';
import { formatDateTime, money } from '../utils/appointmentUi';

const statusLabels = {
  UNPAID: 'غير مدفوع',
  PARTIAL: 'جزئي',
  PAID: 'مدفوع',
};

const statusTone = {
  UNPAID: 'red',
  PARTIAL: 'amber',
  PAID: 'green',
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ paidAmount: 0, discountAmount: 0, method: 'cash', notes: '' });
  const [saving, setSaving] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState(null);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/payments', { params: { status, search, month: month || undefined, limit: 200 } });
      setPayments(res.data.payments || []);
      setSummary(res.data.summary || {});
    } catch (error) {
      toast.error(error.message || 'فشل تحميل المدفوعات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [status, month]);

  const filteredPayments = useMemo(() => payments, [payments]);

  const openEdit = (payment) => {
    setEditing(payment);
    setForm({
      paidAmount: payment.paidAmount || 0,
      discountAmount: payment.discountAmount || 0,
      method: payment.method || 'cash',
      notes: payment.notes || '',
    });
  };

  const savePayment = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        appointmentId: editing.appointmentId,
        paidAmount: Number(form.paidAmount) || 0,
        discountAmount: Number(form.discountAmount) || 0,
        method: form.method,
        notes: form.notes,
      };

      if (editing.id) await api.put(`/payments/${editing.id}`, payload);
      else await api.post('/payments', payload);

      toast.success('تم تحديث الدفع');
      setEditing(null);
      loadPayments();
    } catch (error) {
      toast.error(error.message || 'فشل تحديث الدفع');
    } finally {
      setSaving(false);
    }
  };

  const markAsPaid = async (payment) => {
    setMarkingPaidId(payment.id || payment.appointmentId);
    try {
      const payload = {
        appointmentId: payment.appointmentId,
        paidAmount: Number(payment.finalAmount) || 0,
        discountAmount: Number(payment.discountAmount) || 0,
        method: payment.method || 'cash',
        notes: payment.notes || 'تم الدفع بالكامل',
      };

      if (payment.id) await api.put(`/payments/${payment.id}`, payload);
      else await api.post('/payments', payload);

      toast.success('تم تسجيل الدفع بالكامل');
      loadPayments();
    } catch (error) {
      toast.error(error.message || 'فشل تسجيل الدفع');
    } finally {
      setMarkingPaidId(null);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="المدفوعات"
        description="متابعة كل الحجوزات مع حالة الدفع والخصومات والملاحظات الحسابية لكل مريض."
        actions={
          <PrimaryButton type="button" onClick={loadPayments} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            تحديث
          </PrimaryButton>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="إجمالي المدفوع" value={money(summary.totalPaid)} icon={DollarSign} tone="green" />
        <StatCard title="المتبقي" value={money(summary.totalRemaining)} icon={Wallet} tone="amber" />
        <StatCard title="الخصومات" value={money(summary.totalDiscount)} icon={Percent} tone="blue" />
        <StatCard title="حجوزات مدفوعة" value={summary.paidCount || 0} hint={`غير مدفوع: ${summary.unpaidCount || 0} - جزئي: ${summary.partialCount || 0}`} icon={CreditCard} tone="slate" />
      </div>

      <DataCard className="mb-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_180px_220px_auto]">
          <Field label="بحث">
            <input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="رقم الكشف أو اسم أو رقم المريض" />
          </Field>
          <Field label="الشهر">
            <input className={inputClass} type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </Field>
          <Field label="حالة الدفع">
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="ALL">كل الحالات</option>
              <option value="UNPAID">غير مدفوع</option>
              <option value="PARTIAL">جزئي</option>
              <option value="PAID">مدفوع</option>
            </select>
          </Field>
          <PrimaryButton type="button" onClick={loadPayments} className="self-end">
            <Search className="h-4 w-4" />
            بحث
          </PrimaryButton>
        </div>
      </DataCard>

      {loading ? (
        <DataCard>جاري تحميل المدفوعات...</DataCard>
      ) : filteredPayments.length === 0 ? (
        <DataCard>لا توجد مدفوعات مطابقة للفلاتر الحالية.</DataCard>
      ) : (
        <div className="grid gap-4">
          {filteredPayments.map((payment) => {
            const appointment = payment.appointment || {};
            const remaining = Math.max(0, Number(payment.finalAmount || 0) - Number(payment.paidAmount || 0));
            const paymentKey = payment.id || payment.appointmentId;
            const examNumber = appointment.bookingRef || payment.appointmentId || appointment.id || '-';

            return (
              <DataCard key={paymentKey}>
                <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_auto] xl:items-center">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge tone={statusTone[payment.status]}>{statusLabels[payment.status] || payment.status}</StatusBadge>
                      <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-200">
                        رقم الكشف: <span className="font-mono" dir="ltr">{examNumber}</span>
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white">{appointment.patient?.displayName || appointment.patient?.name || '-'}</h2>
                    <p className="text-sm text-slate-400">{appointment.patient?.phone || '-'} - {formatDateTime(appointment.scheduledTime)}</p>
                    <p className="mt-1 text-sm text-slate-300">{appointment.doctor?.name || '-'} - {appointment.service?.nameAr || appointment.service?.name || '-'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4 xl:grid-cols-2">
                    <Info label="السعر" value={money(payment.amount)} />
                    <Info label="الخصم" value={money(payment.discountAmount)} />
                    <Info label="الإجمالي" value={money(payment.finalAmount)} />
                    <Info label="المتبقي" value={money(remaining)} />
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    {payment.status !== 'PAID' ? (
                      <PrimaryButton type="button" onClick={() => markAsPaid(payment)} disabled={markingPaidId === paymentKey}>
                        <CheckCircle className="h-4 w-4" />
                        تم الدفع
                      </PrimaryButton>
                    ) : null}
                    <SecondaryButton type="button" onClick={() => openEdit(payment)}>
                      <Edit3 className="h-4 w-4" />
                      تعديل الدفع
                    </SecondaryButton>
                  </div>
                </div>
              </DataCard>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0b1020] p-6 shadow-2xl">
            <h2 className="text-xl font-black text-white">تعديل الدفع</h2>
            <p className="mt-1 text-sm text-slate-400">
              {editing.appointment?.patient?.name} - رقم الكشف: <span dir="ltr">{editing.appointment?.bookingRef || editing.appointmentId}</span>
            </p>
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100">
              الخصم يقلل إجمالي الفاتورة، أما المبلغ المدفوع فهو الذي يحدد حالة الدفع: غير مدفوع، جزئي، أو مدفوع بالكامل.
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="المبلغ المدفوع">
                <input className={inputClass} type="number" value={form.paidAmount} onChange={(event) => setForm((current) => ({ ...current, paidAmount: event.target.value }))} />
              </Field>
              <Field label="الخصم">
                <input className={inputClass} type="number" value={form.discountAmount} onChange={(event) => setForm((current) => ({ ...current, discountAmount: event.target.value }))} />
              </Field>
              <Field label="طريقة الدفع">
                <select className={inputClass} value={form.method} onChange={(event) => setForm((current) => ({ ...current, method: event.target.value }))}>
                  <option value="cash">كاش</option>
                  <option value="card">كارت</option>
                  <option value="transfer">تحويل</option>
                  <option value="other">أخرى</option>
                </select>
              </Field>
              <Field label="ملاحظات">
                <input className={inputClass} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <SecondaryButton type="button" onClick={() => setEditing(null)}>إلغاء</SecondaryButton>
              <PrimaryButton type="button" onClick={savePayment} disabled={saving}>حفظ</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  );
}
