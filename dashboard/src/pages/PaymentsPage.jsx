import AppLayout from '../components/Layout';
import { PageHeader } from '../components/ui';
import RevenueReport from '../components/payments/RevenueReport';

export default function PaymentsPage() {
  return (
    <AppLayout>
      <PageHeader
        title="تقرير الإيرادات والمدفوعات"
        description="تقرير مالي مجمع حسب الخدمة والحالة مع المدفوعات، الديون، والإيراد الصافي."
      />
      <RevenueReport />
    </AppLayout>
  );
}
