const sections = [
  {
    title: 'البيانات التي نجمعها',
    items: [
      'الاسم، رقم الهاتف، ومعرفات التواصل المرتبطة بقنوات مثل WhatsApp وFacebook وInstagram.',
      'رسائل الاستفسار، طلبات الحجز، والملاحظات المرتبطة بالخدمة الطبية.',
      'بيانات تشغيلية مثل أوقات الإرسال والاستقبال وسجل التفاعل مع النظام.',
    ],
  },
  {
    title: 'كيف نستخدم البيانات',
    items: [
      'الرد على الاستفسارات وتنظيم الحجوزات وتأكيد المواعيد وإرسال التذكيرات.',
      'تحسين جودة خدمة المراسلة الآلية والمساعدة في تحويل الحالات للموظفين أو الأطباء عند الحاجة.',
      'الامتثال للمتطلبات التشغيلية والتنظيمية الخاصة بإدارة العيادة وخدمة المرضى.',
    ],
  },
  {
    title: 'مشاركة البيانات',
    items: [
      'لا يتم بيع بيانات المستخدمين لأي طرف ثالث.',
      'قد تتم مشاركة البيانات مع مزودي الخدمات التقنية اللازمة لتشغيل النظام مثل مزودي الاستضافة أو مزودي الرسائل، وذلك في حدود تشغيل الخدمة فقط.',
      'قد يتم الإفصاح عن البيانات إذا كان ذلك مطلوبًا قانونيًا أو لحماية حقوق العيادة أو المستخدمين.',
    ],
  },
  {
    title: 'حماية البيانات',
    items: [
      'نستخدم إجراءات تقنية وتنظيمية مناسبة لحماية البيانات من الوصول غير المصرح به أو التعديل أو الفقد.',
      'الوصول إلى البيانات يقتصر على الأشخاص المخولين الذين يحتاجونها لتقديم الخدمة.',
    ],
  },
  {
    title: 'حقوق المستخدم',
    items: [
      'يمكن للمستخدم طلب تحديث بياناته أو تصحيحها أو حذفها وفقًا للأنظمة المطبقة.',
      'يمكن للمستخدم التواصل مع العيادة لطلب إيقاف استخدام بياناته في حدود ما تسمح به المتطلبات القانونية والتشغيلية.',
    ],
  },
];

function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-dark-bg text-dark-text">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="glass-panel rounded-2xl p-8 sm:p-10">
          <div className="mb-8 border-b border-dark-border pb-6">
            <p className="mb-2 text-sm text-dark-muted">Privacy Policy</p>
            <h1 className="mb-4 text-3xl font-bold text-white">سياسة الخصوصية</h1>
            <p className="text-base leading-8 text-dark-muted">
              توضح هذه الصفحة كيفية جمع البيانات واستخدامها وحمايتها عند استخدام نظام إدارة العيادة
              وخدمات المراسلة المرتبطة به عبر الموقع أو تطبيقات التواصل مثل WhatsApp وFacebook
              وInstagram.
            </p>
          </div>

          <div className="space-y-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="mb-3 text-xl font-semibold text-white">{section.title}</h2>
                <ul className="space-y-3 text-base leading-8 text-dark-muted">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-3 h-2 w-2 rounded-full bg-primary-500"></span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-dark-border bg-dark-card/60 p-5">
            <h2 className="mb-3 text-lg font-semibold text-white">التواصل بخصوص الخصوصية</h2>
            <p className="mb-2 text-base leading-8 text-dark-muted">
              إذا كان لديك أي طلب متعلق بالخصوصية أو حذف البيانات أو تحديثها، يمكنك التواصل مع
              إدارة العيادة عبر بيانات الاتصال الرسمية المنشورة في صفحة الإعدادات أو قنوات التواصل
              المعتمدة.
            </p>
            <p className="text-sm text-dark-muted">
              آخر تحديث: 26 مارس 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPolicyPage;
