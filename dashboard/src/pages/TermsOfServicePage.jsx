import { Link } from 'react-router-dom';

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
      <section className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl sm:p-10">
        <Link to="/" className="text-sm font-bold text-sky-300 hover:text-sky-200">
          العودة للرئيسية
        </Link>
        <h1 className="mt-6 text-3xl font-black">شروط الخدمة</h1>
        <p className="mt-4 leading-8 text-slate-300">
          باستخدامك لنظام عيادة د. إبراهيم التخصصي لطب وتجميل الأسنان، فأنت توافق على استخدام
          الخدمة لغرض الاستفسار، المتابعة، وحجز المواعيد فقط.
        </p>
        <div className="mt-8 space-y-5 leading-8 text-slate-300">
          <p>المعلومات الطبية داخل البوت إرشادية ولا تعتبر تشخيصاً نهائياً أو بديلاً عن فحص الطبيب.</p>
          <p>يحق للعيادة تعديل أو إلغاء المواعيد عند الحاجة مع محاولة إبلاغ المريض عبر قناة التواصل المتاحة.</p>
          <p>يجب عدم إرسال معلومات حساسة غير ضرورية عبر الرسائل العامة أو التعليقات.</p>
          <p>للتواصل بخصوص الشروط أو الخدمة، يمكن استخدام بيانات التواصل المنشورة على الموقع.</p>
        </div>
      </section>
    </main>
  );
}
