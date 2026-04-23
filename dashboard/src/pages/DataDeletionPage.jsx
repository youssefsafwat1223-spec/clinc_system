import { Link } from 'react-router-dom';

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
      <section className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl sm:p-10">
        <Link to="/" className="text-sm font-bold text-sky-300 hover:text-sky-200">
          العودة للرئيسية
        </Link>
        <h1 className="mt-6 text-3xl font-black">طلب حذف بيانات المستخدم</h1>
        <p className="mt-4 leading-8 text-slate-300">
          يمكنك طلب حذف بياناتك المرتبطة بالرسائل أو الحجوزات أو الاستفسارات من نظام العيادة.
        </p>
        <div className="mt-8 space-y-5 leading-8 text-slate-300">
          <p>أرسل لنا اسمك ورقم الهاتف أو حساب التواصل المستخدم، وسنراجع الطلب ونتعامل معه خلال مدة مناسبة.</p>
          <p>قد نحتاج للاحتفاظ ببعض البيانات لفترة محدودة إذا كانت مرتبطة بسجل موعد أو التزام قانوني أو تشغيلي.</p>
          <p>يمكنك إرسال طلب الحذف عبر واتساب العيادة أو من خلال قنوات التواصل المنشورة على الموقع.</p>
        </div>
      </section>
    </main>
  );
}
