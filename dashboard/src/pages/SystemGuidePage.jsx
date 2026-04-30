import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, HelpCircle, Search } from 'lucide-react';
import AppLayout from '../components/Layout';
import { DataCard, PageHeader, StatusBadge, inputClass } from '../components/ui';

const guideSections = [
  {
    id: 'daily',
    title: 'التشغيل اليومي',
    description: 'خطوات استقبال اليوم، الطلبات، والكشف.',
    items: [
      {
        question: 'أبدأ يوم العيادة منين؟',
        answer: [
          'افتح صفحة مرضى اليوم من القائمة الجانبية.',
          'راجع مواعيد اليوم حسب الحالة والطبيب والخدمة.',
          'لو فيه طلبات جديدة، افتح صفحة قبول الطلبات والكشف وتعامل معها.',
          'بعد دخول المريض للدكتور، غيّر حالة الموعد إلى تم الكشف عشان الإحصائيات والمدفوعات تبقى مظبوطة.',
        ],
      },
      {
        question: 'أقبل أو أرفض طلب حجز من البوت؟',
        answer: [
          'افتح صفحة قبول الطلبات والكشف.',
          'هتلاقي الطلبات قيد الانتظار في أول الصفحة.',
          'اضغط قبول لتأكيد الموعد أو رفض مع كتابة السبب.',
          'السيستم يرسل رسالة واتساب للمريض حسب الحالة.',
        ],
      },
      {
        question: 'أضيف مريض داخل العيادة ومعاه موعد؟',
        answer: [
          'افتح صفحة إضافة مريض / موعد.',
          'ابحث برقم الموبايل أولاً عشان تتأكد هل المريض موجود قبل كده.',
          'لو موجود اختاره، ولو جديد اكتب بياناته وأنشئ ملفه.',
          'اختار الخدمة والطبيب والتاريخ والوقت ثم احفظ الموعد.',
        ],
      },
    ],
  },
  {
    id: 'patients',
    title: 'المرضى والملفات',
    description: 'كل ما يخص ملف المريض الكامل.',
    items: [
      {
        question: 'أفتح ملف مريض كامل منين؟',
        answer: [
          'افتح صفحة المرضى.',
          'ابحث باسم المريض أو رقم الهاتف.',
          'اضغط على كارت المريض.',
          'هتفتح صفحة كاملة فيها البيانات، المواعيد، الروشتات، المدفوعات، الاستشارات، الرسائل، والملاحظات.',
        ],
      },
      {
        question: 'أضيف ملاحظة طبية أو حسابية للمريض؟',
        answer: [
          'افتح ملف المريض الكامل.',
          'استخدم قسم الملاحظات الطبية للمعلومات الخاصة بالحالة والعلاج.',
          'استخدم قسم الحسابات أو المدفوعات للملاحظات المالية، الخصومات، أو الديون.',
          'احفظ التعديلات بعد الكتابة.',
        ],
      },
      {
        question: 'الروشتات بتظهر فين؟',
        answer: [
          'الروشتة تتحفظ في جدول الروشتات وتكون مربوطة بالمريض.',
          'لو الروشتة اتعملت من Appointment ID هتكون مربوطة بالموعد كمان.',
          'افتح ملف المريض الكامل وستجد الروشتات ضمن بيانات المريض.',
        ],
      },
    ],
  },
  {
    id: 'prescriptions',
    title: 'الروشتات',
    description: 'إنشاء الروشتة وإرسالها للمريض.',
    items: [
      {
        question: 'أعمل روشتة من رقم الحجز؟',
        answer: [
          'افتح صفحة الروشتات.',
          'اكتب Appointment ID أو كود الحجز في خانة البحث.',
          'السيستم يعرض بيانات المريض والطبيب والخدمة والموعد.',
          'اكتب الأدوية: اسم الدواء، الجرعة، عدد المرات، المدة، قبل أو بعد الأكل، والملاحظات.',
          'راجع شكل الروشتة في المعاينة ثم اضغط حفظ وإرسال.',
        ],
      },
      {
        question: 'أعمل روشتة لمريض بدون حجز؟',
        answer: [
          'افتح صفحة الروشتات.',
          'ابحث عن المريض بالاسم أو رقم الهاتف بدل Appointment ID.',
          'اختار المريض واكتب بيانات الروشتة.',
          'احفظ الروشتة، ويمكن إرسالها واتساب لو للمريض رقم مسجل.',
        ],
      },
      {
        question: 'أعدل شكل الروشتة والبراند؟',
        answer: [
          'افتح الإعدادات.',
          'ادخل على بيانات العيادة.',
          'ضع رابط شعار الروشتة ولون البراند الأساسي.',
          'أي روشتة جديدة تستخدم بيانات البراند الجديدة.',
        ],
      },
    ],
  },
  {
    id: 'inbox',
    title: 'صندوق الوارد',
    description: 'التعامل مع رسائل المرضى والتدخل البشري.',
    items: [
      {
        question: 'أرد على مريض والبوت يسكت؟',
        answer: [
          'افتح صندوق الوارد واختر محادثة المريض.',
          'اكتب رد يدوي واضغط إرسال.',
          'المحادثة تتحول لتدخل بشري والبوت يتوقف لهذا المريض.',
          'بعد انتهاء المشكلة اضغط إنهاء المتابعة عشان البوت يرجع يرد.',
        ],
      },
      {
        question: 'أشوف الرسائل غير المقروءة أو اللي تحتاج متابعة؟',
        answer: [
          'افتح صندوق الوارد.',
          'استخدم فلاتر أعلى قائمة المحادثات: غير مقروء، متابعة بشرية، تمت المراجعة.',
          'اختار المحادثة وشوف الرسائل في الجانب الآخر.',
        ],
      },
      {
        question: 'أفتح ملف المريض من المحادثة؟',
        answer: [
          'افتح محادثة المريض في صندوق الوارد.',
          'اضغط زر ملف المريض في أعلى المحادثة.',
          'هتنتقل لصفحة الملف الكامل للمريض.',
        ],
      },
    ],
  },
  {
    id: 'payments',
    title: 'المدفوعات والخصومات',
    description: 'تسجيل الدفع وتطبيق الخصومات.',
    items: [
      {
        question: 'أسجل إن موعد اتدفع؟',
        answer: [
          'افتح صفحة المدفوعات.',
          'ابحث عن الموعد أو المريض.',
          'اضغط زر تم الدفع.',
          'السيستم يجعل المدفوع مساوي للإجمالي النهائي ويحوّل الحالة إلى مدفوع.',
        ],
      },
      {
        question: 'أعدل مبلغ الدفع أو الخصم؟',
        answer: [
          'افتح صفحة المدفوعات.',
          'افتح تعديل الدفع للموعد المطلوب.',
          'الخصم يقلل الإجمالي النهائي، أما المدفوع فهو المبلغ الذي دفعه المريض فعلاً.',
          'لو المدفوع أقل من الإجمالي النهائي تصبح الحالة جزئي، ولو يساويه تصبح مدفوع.',
        ],
      },
      {
        question: 'أضيف خصم لمجموعة أرقام؟',
        answer: [
          'افتح الإعدادات ثم تبويب الخصومات.',
          'اكتب اسم الخصم، نوعه، قيمته، والخدمة لو الخصم مرتبط بخدمة معينة.',
          'اكتب أرقام المرضى، رقم في كل سطر أو افصل بفاصلة.',
          'اضغط حفظ الخصم.',
          'للحذف افتح نفس التبويب واضغط حذف الخصم من قائمة الخصومات الحالية.',
        ],
      },
      {
        question: 'أعمل خصم 20% على كل الخدمات؟',
        answer: [
          'افتح الإعدادات ثم تبويب الخصومات.',
          'اكتب اسم الخصم، مثال: خصم 20% لكل الخدمات.',
          'اختار نوع الخصم: نسبة مئوية.',
          'اكتب القيمة: 20.',
          'اترك خانة الخدمة على كل الخدمات حتى يطبق الخصم على أي خدمة.',
          'اكتب أرقام المرضى المستهدفين، رقم في كل سطر أو افصل بفاصلة.',
          'اضغط حفظ الخصم. بعد ذلك لو مريض من هذه الأرقام سأل واتساب عن السعر، يظهر له السعر بعد الخصم تلقائياً.',
        ],
      },
      {
        question: 'هل الخصم يتبعت في الحملة تلقائياً؟',
        answer: [
          'الخصم نفسه يتم تطبيقه من الإعدادات على أرقام المرضى.',
          'الحملة وظيفتها إبلاغ المرضى بالعرض، لذلك لازم تختار قالب واتساب وتكتب قيم العرض في متغيرات القالب.',
          'مثال: لو القالب فيه {{1}} للاسم، {{2}} للخدمة، {{3}} للسعر قبل الخصم، {{4}} للسعر بعد الخصم.',
          'في صفحة الحملات اكتب {{name}} في متغير الاسم، واكتب الخدمة والسعر قبل الخصم والسعر بعد الخصم بالدينار العراقي.',
          'الحساب التلقائي للخصم يظهر في ردود واتساب عندما يسأل المريض عن السعر، أما الحملة فتأخذ القيم التي كتبتها في متغيرات القالب.',
        ],
      },
    ],
  },
  {
    id: 'campaigns',
    title: 'الحملات',
    description: 'إرسال رسائل تسويقية أو قوالب واتساب.',
    items: [
      {
        question: 'أرسل حملة واتساب؟',
        answer: [
          'افتح صفحة الحملات.',
          'الخطوة الأولى: اختر نوع الرسالة، نص أو قالب أو صورة.',
          'الخطوة الثانية: اختر القالب أو اكتب المحتوى.',
          'الخطوة الثالثة: اختر المرضى، كل المرضى أو مجموعة محددة أو فلترة.',
          'الخطوة الرابعة: راجع الملخص ثم اضغط إرسال.',
        ],
      },
      {
        question: 'لو القالب فيه صورة أعمل إيه؟',
        answer: [
          'في صفحة الحملات اختار Template أو Image حسب نوع الرسالة.',
          'لو القالب يحتاج صورة ستظهر خانة لإضافة الصورة.',
          'ارفع الصورة أو اختارها حسب المتاح في الصفحة.',
          'راجع المعاينة قبل الإرسال.',
        ],
      },
      {
        question: 'أكتب قالب عرض خصم في Meta إزاي؟',
        answer: [
          'افتح WhatsApp Manager ثم Edit Template.',
          'اكتب Body فيه متغيرات، مثال: مرحباً {{1}}، عندك خصم خاص على {{2}}، السعر قبل الخصم {{3}} د.ع، السعر بعد الخصم {{4}} د.ع.',
          'اعتمد القالب من Meta.',
          'افتح صفحة الحملات في النظام واختار القالب.',
          'املأ المتغيرات: {{1}} = {{name}}، {{2}} = اسم الخدمة، {{3}} = السعر قبل الخصم، {{4}} = السعر بعد الخصم.',
          'لو القالب في Meta لا يحتوي على متغيرات، سيصل للمريض بنفس النص المعتمد ولن تستطيع إضافة كلام جديد داخله من النظام.',
        ],
      },
    ],
  },
  {
    id: 'admin',
    title: 'الإدارة والإعدادات',
    description: 'الأطباء، الخدمات، الذكاء الاصطناعي، وإعادة الجدولة.',
    items: [
      {
        question: 'أضيف خدمة جديدة أو أغير سعر خدمة؟',
        answer: [
          'افتح صفحة الخدمات.',
          'اضغط إضافة خدمة أو عدّل خدمة موجودة.',
          'اكتب الاسم والسعر والمدة وحالة التفعيل.',
          'الخدمة تظهر في الحجز والمدفوعات وردود الأسعار.',
        ],
      },
      {
        question: 'أضيف طبيب جديد أو أعدل بياناته؟',
        answer: [
          'افتح صفحة الكادر الطبي.',
          'اضغط إضافة طبيب أو تعديل على طبيب موجود.',
          'اكتب بيانات الطبيب وتخصصه وحالة التفعيل.',
          'بعدها يمكن للطبيب ضبط جدول عمله من صفحة المواعيد إذا كان له حساب.',
        ],
      },
      {
        question: 'أعيد جدولة مواعيد طبيب لطبيب بديل؟',
        answer: [
          'افتح صفحة إعادة جدولة طبيب.',
          'اختار الطبيب القديم والطبيب البديل.',
          'اعمل Preview لمراجعة المواعيد والتعارضات.',
          'لو كل شيء صحيح اضغط تنفيذ، وسيتم إرسال إشعار واتساب للمرضى حسب نافذة واتساب أو Template.',
        ],
      },
      {
        question: 'أعلم الذكاء الاصطناعي يرد إزاي؟',
        answer: [
          'افتح صفحة الذكاء الاصطناعي.',
          'توجيهات المساعد الذكي: اكتب نبرة الرد والقواعد العامة وما لا يجب قوله.',
          'قاعدة المعرفة المنظمة: أضف حالة أو خدمة بكلمات مفتاحية وتفسير ونصيحة للبوت.',
          'الأسئلة الشائعة: أضف سؤال وجواب مباشر مثل الحجز والإلغاء وساعات العمل.',
        ],
      },
    ],
  },
];

export default function SystemGuidePage() {
  const [query, setQuery] = useState('');
  const [activeSection, setActiveSection] = useState('all');
  const [openItems, setOpenItems] = useState(() => new Set(['daily-0']));

  const sections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return guideSections
      .filter((section) => activeSection === 'all' || section.id === activeSection)
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (!normalizedQuery) return true;
          const haystack = [section.title, section.description, item.question, ...item.answer].join(' ').toLowerCase();
          return haystack.includes(normalizedQuery);
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [activeSection, query]);

  const toggleItem = (key) => {
    setOpenItems((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <AppLayout>
      <PageHeader
        title="شرح استخدام النظام"
        description="دليل سريع يوضح كل صفحة في السيستم، تدخل عليها منين، وتعمل إيه خطوة بخطوة."
        actions={<StatusBadge tone="blue">دليل تفاعلي</StatusBadge>}
      />

      <DataCard className="mb-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="relative">
            <Search className="absolute right-3 top-3 h-4 w-4 text-slate-500" />
            <input
              className={`${inputClass} pr-10`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث عن: روشتة، دفع، حجز، حملة، خصم..."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveSection('all')}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeSection === 'all' ? 'bg-sky-500 text-white' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              كل الأقسام
            </button>
            {guideSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  activeSection === section.id ? 'bg-sky-500 text-white' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {section.title}
              </button>
            ))}
          </div>
        </div>
      </DataCard>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <DataCard className="h-fit">
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-sky-300" />
            <h2 className="text-lg font-black text-white">الأقسام</h2>
          </div>
          <div className="space-y-3">
            {guideSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`w-full rounded-2xl border p-4 text-right transition ${
                  activeSection === section.id
                    ? 'border-sky-500/30 bg-sky-500/10'
                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <h3 className="font-black text-white">{section.title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">{section.description}</p>
              </button>
            ))}
          </div>
        </DataCard>

        <div className="space-y-6">
          {sections.length === 0 ? (
            <DataCard className="text-center">
              <HelpCircle className="mx-auto mb-3 h-12 w-12 text-slate-600" />
              <h2 className="text-lg font-black text-white">لا توجد نتيجة</h2>
              <p className="mt-2 text-sm text-slate-400">جرّب كلمة بحث مختلفة أو اختر كل الأقسام.</p>
            </DataCard>
          ) : (
            sections.map((section) => (
              <section key={section.id} className="space-y-3">
                <div>
                  <h2 className="text-xl font-black text-white">{section.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{section.description}</p>
                </div>

                <div className="space-y-3">
                  {section.items.map((item, index) => {
                    const key = `${section.id}-${index}`;
                    const isOpen = openItems.has(key);
                    return (
                      <DataCard key={key} className="p-0">
                        <button
                          type="button"
                          onClick={() => toggleItem(key)}
                          className="flex w-full items-center justify-between gap-4 p-5 text-right"
                        >
                          <span className="text-base font-black text-white">{item.question}</span>
                          <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isOpen ? (
                          <div className="border-t border-white/10 px-5 pb-5 pt-4">
                            <ol className="space-y-3">
                              {item.answer.map((step, stepIndex) => (
                                <li key={step} className="grid grid-cols-[auto_1fr] gap-3 text-sm leading-7 text-slate-300">
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/10 text-xs font-black text-sky-300">
                                    {stepIndex + 1}
                                  </span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        ) : null}
                      </DataCard>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
