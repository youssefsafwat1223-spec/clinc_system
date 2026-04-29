import { useEffect, useMemo, useState } from 'react';
import { CreditCard, DollarSign, Edit3, Percent, RefreshCw, Search, Wallet } from 'lucide-react';
import { toast } from 'react-toastify';
import AppLayout from '../components/Layout';
import api from '../api/client';
import { DataCard, Field, PageHeader, PrimaryButton, SecondaryButton, StatCard, StatusBadge, inputClass } from '../components/ui';

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

const money = (value) => `${Number(value || 0).toLocaleString('ar-EG')} ج.م`;

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ paidAmount: 0, discountAmount: 0, method: 'cash', notes: '' });
  const [saving, setSaving] = useState(false);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/payments', { params: { status, search, limit: 200 } });
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
  }, [status]);

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

      if (editing.id) {
        await api.put(`/payments/${editing.id}`, payload);
      } else {
        await api.post('/payments', payload);
      }

      toast.success('تم تحديث الدفع');
      setEditing(null);
      loadPayments();
    } catch (error) {
      toast.error(error.message || 'فشل تحديث الدفع');
    } finally {
      setSaving(false);
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
        <div className="grid gap-4 lg:grid-cols-[1fr_220px_auto]">
          <Field label="بحث">
            <input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Appointment ID أو اسم أو رقم المريض" />
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
            return (
              <DataCard key={payment.id || payment.appointmentId}>
                <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_auto] xl:items-center">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge tone={statusTone[payment.status]}>{statusLabels[payment.status] || payment.status}</StatusBadge>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-mono text-gray-600">{payment.appointmentId}</span>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">{appointment.patient?.name || '-'}</h2>
                    <p className="text-sm text-gray-500">{appointment.patient?.phone || '-'} - {formatDate(appointment.scheduledTime)}</p>
                    <p className="mt-1 text-sm text-gray-600">{appointment.doctor?.name || '-'} - {appointment.service?.nameAr || appointment.service?.name || '-'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4 xl:grid-cols-2">
                    <Info label="السعر" value={money(payment.amount)} />
                    <Info label="الخصم" value={money(payment.discountAmount)} />
                    <Info label="الإجمالي" value={money(payment.finalAmount)} />
                    <Info label="المتبقي" value={money(remaining)} />
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-900">تعديل الدفع</h2>
            <p className="mt-1 text-sm text-gray-500">{editing.appointment?.patient?.name} - {editing.appointmentId}</p>
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
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 font-bold text-gray-900">{value}</p>
    </div>
  );
}
