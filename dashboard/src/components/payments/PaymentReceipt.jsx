import { money } from '../../utils/appointmentUi';

const fallbackClinic = {
  nameAr: 'عيادة د. إبراهيم التخصصي لطب وتجميل الأسنان',
  name: 'Clinic',
  phone: '',
  address: '',
  logoUrl: null,
};

const formatReceiptDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('ar-IQ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export default function PaymentReceipt({ payment, clinic = fallbackClinic }) {
  const clinicName = clinic?.nameAr || clinic?.clinicNameAr || clinic?.name || clinic?.clinicName || fallbackClinic.nameAr;
  const clinicPhone = clinic?.phone || clinic?.clinicPhone || '';
  const clinicAddress = clinic?.address || clinic?.clinicAddress || '';
  const paidAmount = Number(payment?.paidAmount || 0);
  const totalAmount = Number(payment?.amount || payment?.finalAmount || paidAmount || 0);
  const remainingAmount = Math.max(0, Number(payment?.remainingAmount ?? totalAmount - paidAmount));

  if (!payment) return null;

  return (
    <section id="payment-receipt-print" className="payment-receipt-paper" dir="rtl">
      <header className="payment-receipt-header">
        <div className="payment-receipt-logo">
          {clinic?.logoUrl ? <img src={clinic.logoUrl} alt={clinicName} /> : <span>{clinicName.slice(0, 1)}</span>}
        </div>
        <div>
          <h1>{clinicName}</h1>
          <p>إيصال دفع</p>
          {clinicPhone ? <p dir="ltr">{clinicPhone}</p> : null}
          {clinicAddress ? <p>{clinicAddress}</p> : null}
        </div>
      </header>

      <div className="payment-receipt-meta">
        <div>
          <span>رقم الإيصال</span>
          <strong dir="ltr">{payment.id}</strong>
        </div>
        <div>
          <span>التاريخ</span>
          <strong>{formatReceiptDate(payment.paymentDate || payment.createdAt)}</strong>
        </div>
      </div>

      <div className="payment-receipt-grid">
        <div>
          <span>اسم المريض</span>
          <strong>{payment.patientName || '—'}</strong>
        </div>
        <div>
          <span>رقم الهاتف</span>
          <strong dir="ltr">{payment.patientPhone || '—'}</strong>
        </div>
        <div>
          <span>الخدمة / الحالة</span>
          <strong>{payment.treatmentType || payment.serviceName || '—'}</strong>
        </div>
        <div>
          <span>الطبيب</span>
          <strong>{payment.doctorName ? `د. ${payment.doctorName}` : '—'}</strong>
        </div>
        <div>
          <span>طريقة الدفع</span>
          <strong>{payment.method || '—'}</strong>
        </div>
        <div>
          <span>عدد الأسنان</span>
          <strong>{payment.teethCount || 1}</strong>
        </div>
      </div>

      <table className="payment-receipt-table">
        <thead>
          <tr>
            <th>الوصف</th>
            <th>الإجمالي</th>
            <th>المدفوع</th>
            <th>المتبقي</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{payment.treatmentType || payment.serviceName || 'خدمة علاجية'}</td>
            <td>{money(totalAmount)}</td>
            <td>{money(paidAmount)}</td>
            <td>{money(remainingAmount)}</td>
          </tr>
        </tbody>
      </table>

      {payment.notes ? (
        <div className="payment-receipt-notes">
          <span>ملاحظات</span>
          <p>{payment.notes}</p>
        </div>
      ) : null}

      <footer className="payment-receipt-footer">
        <div>
          <span>توقيع المستلم</span>
        </div>
        <p>هذا الإيصال صادر إلكترونياً من نظام {clinicName}.</p>
      </footer>
    </section>
  );
}
