const DEFAULT_FAQS = [
  {
    question: 'هل الفحص مؤلم؟',
    answer: 'غالبا الفحص يكون بسيطا وسريعا، والطبيب يشرح لك الحالة قبل أي إجراء حتى تكون الصورة واضحة من البداية.',
  },
  {
    question: 'إذا عندي ألم، أقدر أأجل الزيارة؟',
    answer: 'إذا كان الألم خفيفا ومؤقتا قد يمكن تأجيله فترة قصيرة، لكن الألم الشديد أو المستمر أو المصحوب بتورم يحتاج مراجعة أسرع.',
  },
  {
    question: 'هل التبييض يسبب حساسية؟',
    answer: 'قد تظهر حساسية مؤقتة عند بعض المرضى بعد التبييض، وغالبا تتحسن خلال فترة قصيرة مع الالتزام بتعليمات الطبيب.',
  },
  {
    question: 'هل الغسول وحده يكفي لحل رائحة الفم؟',
    answer: 'الغسول قد يخفف الرائحة مؤقتا، لكن الحل الحقيقي يعتمد على معرفة السبب مثل الجير أو اللثة أو التسوس ثم علاجه.',
  },
  {
    question: 'هل نزيف اللثة طبيعي مع الخيط أو التفريش؟',
    answer: 'النزيف المتكرر ليس أمرا طبيعيا غالبا، وقد يدل على التهاب لثة أو تراكم جير ويحتاج تقييما إذا استمر.',
  },
  {
    question: 'هل علاج العصب أو الخلع يتم بنفس الزيارة؟',
    answer: 'هذا يعتمد على الحالة بعد الفحص والأشعة وتقييم الطبيب، فبعض الحالات تنجز مباشرة وبعضها يحتاج خطة علاج.',
  },
  {
    question: 'أسنان الأطفال إذا كانت لبنية، هل لازم تتعالج؟',
    answer: 'نعم، لأن إهمال الأسنان اللبنية قد يسبب ألما والتهابا ويؤثر على الأكل والنوم وحتى على الأسنان الدائمة لاحقا.',
  },
  {
    question: 'كيف أحجز موعد؟',
    answer: 'يمكنك طلب الحجز مباشرة، وسنوجهك إلى أقرب موعد مناسب بعد تحديد نوع الشكوى أو الخدمة المطلوبة.',
  },
];

const DEFAULT_KNOWLEDGE_CASES = [
  {
    title: 'ألم شديد بالسن',
    symptom: 'ألم شديد',
    specialty: 'عصب',
    urgency: 'high',
    keywords: ['ألم شديد', 'وجع قوي', 'وجع شديد', 'نابض', 'ما أگدر أنام', 'يعورني هواي', 'عصب'],
    patientExamples: ['عندي ألم شديد بالسن', 'السن يوجعني لدرجة ما أگدر أنام'],
    explanation: 'غالبا يدل على التهاب عميق أو وصول التسوس إلى العصب، وأحيانا يكون بداية خراج إذا ترافق مع تورم.',
    delayAdvice: 'لا يفضل التأجيل إذا كان الألم مستمرا أو يزداد أو يمنع النوم، والأفضل مراجعة سريعة.',
    homeAdvice: 'تجنب الجهة المؤلمة، وابتعد مؤقتا عن البارد والحار والسكريات إلى حين الفحص.',
    solution: 'عادة يبدأ الحل بالفحص وتحديد هل الحالة تحتاج حشوة أو علاج عصب أو إجراء آخر.',
    bookingCta: 'الأفضل حجز فحص قريب حتى نحدد العلاج المناسب قبل أن تزيد الحالة.',
    reassurance: 'كثير من هذه الحالات يمكن السيطرة عليها إذا انلحكت مبكرا.',
  },
  {
    title: 'ألم خفيف أو متقطع',
    symptom: 'ألم خفيف',
    specialty: 'تسوس وحشوات',
    urgency: 'medium',
    keywords: ['ألم خفيف', 'وجع خفيف', 'وجع بسيط', 'ألم متقطع', 'يجي ويروح', 'تسوس'],
    patientExamples: ['عندي ألم خفيف يجي ويروح', 'السن يوجعني مرات بس مو دائما'],
    explanation: 'قد يكون مرتبطا ببداية تسوس أو حشوة قديمة أو حساسية في السن، ويحتاج فحصا قبل أن يتطور.',
    delayAdvice: 'يمكن التأجيل لفترة قصيرة إذا كان الألم خفيفا، لكن لا يفضل تركه طويلا حتى لا تكبر المشكلة.',
    homeAdvice: 'خفف السكريات ونظف الأسنان بلطف، ولا تعتمد على المسكنات كحل دائم.',
    solution: 'في كثير من الأحيان يكون العلاج أبسط إذا تم التقييم بدري، مثل حشوة أو تعديل بسيط.',
    bookingCta: 'الفحص المبكر هنا غالبا يجعل العلاج أبسط وأسرع.',
    reassurance: 'كثير من حالات الألم الخفيف تكون سهلة العلاج إذا تم تقييمها بدري.',
  },
  {
    title: 'تورم باللثة أو الخد',
    symptom: 'تورم',
    specialty: 'طوارئ',
    urgency: 'urgent',
    keywords: ['تورم', 'ورم', 'انتفاخ', 'خدي منفخ', 'اللثة وارمة', 'ورمة', 'طوارئ'],
    patientExamples: ['عندي تورم بالخد', 'اللثة وارمة حول السن'],
    explanation: 'التورم قد يرتبط بالتهاب حول السن أو اللثة، وأحيانا يكون علامة على تجمع صديد يحتاج تقييما سريعا.',
    delayAdvice: 'يفضل عدم التأجيل، خصوصا إذا كان التورم يزيد أو معه حرارة أو صعوبة فتح الفم.',
    homeAdvice: 'لا تضع أدوية داخل السن بنفسك، واكتف بنظافة هادئة وتجنب الضغط على المكان.',
    solution: 'الحل يعتمد على سبب التورم، وقد يشمل تنظيفا أو علاجا للالتهاب أو إجراء علاجيا حسب الفحص.',
    bookingCta: 'هذه الحالة تحتاج فحصا قريبا لتحديد سبب التورم والعلاج المناسب.',
    reassurance: 'التعامل المبكر مع التورم يقلل احتمال تعقد الحالة.',
  },
  {
    title: 'نزيف لثة',
    symptom: 'نزيف',
    specialty: 'لثة',
    urgency: 'medium',
    keywords: ['نزيف', 'دم من اللثة', 'اللثة تنزف', 'دم يطلع', 'لثة', 'تنظيف'],
    patientExamples: ['اللثة تنزف لما أفرش', 'عندي دم يطلع من اللثة'],
    explanation: 'غالبا يرتبط بالتهاب لثة أو تراكم جير، وقد يزيد مع التفريش القاسي أو إهمال التنظيف.',
    delayAdvice: 'يمكن تأجيله فترة قصيرة إذا كان بسيطا، لكن النزيف المتكرر أو الشديد يحتاج تقييما.',
    homeAdvice: 'استمر بتنظيف لطيف بفرشاة ناعمة ولا توقف التنظيف تماما، لأن الإهمال يزيد الالتهاب.',
    solution: 'غالبا يبدأ الحل بتنظيف وفحص اللثة ومعرفة سبب النزيف ثم وضع خطة عناية مناسبة.',
    bookingCta: 'الفحص يساعد نحدد هل تحتاج تنظيف لثة فقط أو متابعة أعمق.',
    reassurance: 'كثير من مشاكل النزيف تتحسن بشكل واضح بعد تنظيف وعناية صحيحة.',
  },
  {
    title: 'حساسية مع البارد أو الحار',
    symptom: 'حساسية',
    specialty: 'حشوات وتجميل',
    urgency: 'medium',
    keywords: ['حساسية', 'بارد', 'حار', 'يوجعني البارد', 'يوجعني الحار', 'لسعة', 'معجون'],
    patientExamples: ['البارد يوجعني', 'عندي حساسية من الحار والبارد'],
    explanation: 'قد تنتج الحساسية من انكشاف جزء من السن أو تآكل بالمينا أو بداية تسوس أو بعد إجراءات مثل التبييض.',
    delayAdvice: 'إذا كانت خفيفة ومؤقتة قد تراقب لفترة قصيرة، لكن استمرارها يستدعي الفحص.',
    homeAdvice: 'خفف من المثلجات والمشروبات الساخنة جدا مؤقتا، ويمكن استخدام معجون مخصص للحساسية إذا كان مناسبا لك.',
    solution: 'العلاج يعتمد على السبب، وقد يكون معجونا خاصا أو حشوة أو حماية إضافية للسن.',
    bookingCta: 'الفحص يحدد إن كانت المشكلة بسيطة أو تحتاج علاجا مباشرا.',
    reassurance: 'حساسية الأسنان شائعة وغالبا لها حلول مباشرة بعد تقييم السبب.',
  },
  {
    title: 'كسر أو تشقق بالسن',
    symptom: 'كسر',
    specialty: 'ترميمات وطوارئ',
    urgency: 'high',
    keywords: ['كسر', 'انكسر', 'تشقق', 'طاح جزء من السن', 'قطعة من السن', 'سن مكسور'],
    patientExamples: ['انكسر السن', 'طاح جزء من السن الأمامي'],
    explanation: 'الكسور قد تكون سطحية وقد تمتد إلى طبقات أعمق من السن، ودرجة العلاج تعتمد على مكان الكسر وعمقه.',
    delayAdvice: 'إذا كان هناك ألم أو حافة حادة أو انكشاف واضح، فالأفضل عدم التأجيل.',
    homeAdvice: 'تجنب المضغ على السن المكسور، وإذا كانت الحافة مؤذية حاول حماية المنطقة إلى حين الفحص.',
    solution: 'قد يكون الحل ترميما بسيطا أو بناء للسن أو إجراءات أكبر حسب عمق الكسر ومكانه.',
    bookingCta: 'الفحص السريع يساعد في إنقاذ السن قبل أن يتوسع الكسر أو يزيد الألم.',
    reassurance: 'كثير من الكسور يمكن ترميمها إذا تم التعامل معها في الوقت المناسب.',
  },
  {
    title: 'حشوة وقعت أو طاحت',
    symptom: 'حشوة طاحت',
    specialty: 'حشوات',
    urgency: 'medium',
    keywords: ['حشوة طاحت', 'الحشوة وقعت', 'طاحت الحشوة', 'الحشوة انشالت'],
    patientExamples: ['الحشوة طاحت', 'وقعت الحشوة وبقى مكان مفتوح'],
    explanation: 'سقوط الحشوة قد يترك السن مكشوفا ومعرضا للألم أو تجمع الأكل أو زيادة التسوس.',
    delayAdvice: 'إذا لم يوجد ألم شديد قد يمكن التأجيل لفترة قصيرة، لكن يفضل عدم الإطالة.',
    homeAdvice: 'تجنب المضغ على الجهة المفتوحة واهتم بتنظيفها بلطف حتى لا تتجمع البقايا.',
    solution: 'الحل غالبا يكون بإعادة الحشوة أو تقييم السن إذا كان يحتاج علاجا أوسع.',
    bookingCta: 'الفحص يحدد هل تكفي إعادة الحشوة أو يحتاج السن تقييما أوسع.',
    reassurance: 'غالبا تكون من الحالات التي يمكن التعامل معها بشكل مباشر عند المراجعة.',
  },
  {
    title: 'رائحة فم مستمرة',
    symptom: 'رائحة',
    specialty: 'لثة وتنظيف',
    urgency: 'medium',
    keywords: ['رائحة', 'ريحة', 'رائحة الفم', 'ريحة بالفم', 'نفس مو زين', 'لثة', 'تنظيف'],
    patientExamples: ['عندي رائحة بالفم', 'ريحة الفم مستمرة'],
    explanation: 'غالبا ترتبط بتراكمات على الأسنان أو التهاب لثة أو مشاكل تنظيف، وأحيانا تحتاج فحصا أوسع.',
    delayAdvice: 'ليست عادة حالة طارئة، لكن استمرارها رغم العناية يستدعي مراجعة.',
    homeAdvice: 'حافظ على التفريش مرتين يوميا ونظف بين الأسنان واللسان بشكل منتظم.',
    solution: 'الحل الحقيقي يعتمد على معرفة السبب الرئيسي ثم علاجه، وليس على الغسول وحده.',
    bookingCta: 'الفحص يساعد نحدد هل السبب لثة أو تسوس أو تراكمات تحتاج تنظيف.',
    reassurance: 'غالبا تتحسن الرائحة عندما يتم علاج السبب الرئيسي بدل الاكتفاء بالغسول فقط.',
  },
  {
    title: 'تحرك السن',
    symptom: 'تحرك سن',
    specialty: 'لثة',
    urgency: 'high',
    keywords: ['تحرك', 'السن يتحرك', 'سن متخلخل', 'متحرك', 'يتخلخل', 'لثة'],
    patientExamples: ['أحس السن يتحرك', 'عندي سن متخلخل'],
    explanation: 'تحرك السن قد يدل على مشكلة في دعم اللثة أو العظم، ويحتاج تقييما قبل أن تتقدم الحالة.',
    delayAdvice: 'يفضل عدم التأجيل إذا كان التحرك واضحا أو جديدا.',
    homeAdvice: 'تجنب الضغط أو العض القوي على السن المتحرك إلى حين الفحص.',
    solution: 'الحل يعتمد على سبب الحركة ودرجة دعم السن، لذلك التقييم المبكر مهم.',
    bookingCta: 'الفحص المبكر مهم لمعرفة سبب الحركة وخيارات الحفاظ على السن.',
    reassurance: 'سرعة التقييم تعطي فرصة أفضل للحفاظ على الوضع قبل التدهور.',
  },
  {
    title: 'ألم أو تسوس عند الأطفال',
    symptom: 'ألم أطفال',
    specialty: 'أطفال',
    urgency: 'medium',
    keywords: ['أطفال', 'طفل', 'ابني', 'بنتي', 'سنون أطفال', 'وجع طفل', 'تسوس طفل'],
    patientExamples: ['ابني يشتكي من سنه', 'بنتي عندها وجع بأسنانها'],
    explanation: 'مشاكل أسنان الأطفال قد تتطور بسرعة، لذلك الفحص المبكر مهم حتى لو بدا الألم بسيطا.',
    delayAdvice: 'إذا كان الألم متكررا أو الطفل لا يستطيع الأكل أو النوم فالأفضل مراجعة سريعة.',
    homeAdvice: 'خفف السكريات ونظف الأسنان بلطف، وراقب إن كان هناك تورم أو حرارة.',
    solution: 'العلاج عند الأطفال يختلف حسب العمر والحالة، وغالبا يكون أبسط إذا تم مبكرا.',
    bookingCta: 'زيارة مبكرة لطبيب الأطفال تساعد بعلاج أبسط وأريح للطفل.',
    reassurance: 'التعامل المبكر مع أسنان الأطفال عادة يجعل العلاج أسهل بكثير.',
  },
  {
    title: 'تورم أو التهاب عند الطفل',
    symptom: 'تورم أطفال',
    specialty: 'أطفال',
    urgency: 'urgent',
    keywords: ['تورم طفل', 'خد الطفل وارم', 'ورم عند الطفل', 'أسنان أطفال', 'طفل متورم'],
    patientExamples: ['خد الطفل وارم', 'طفلي عنده تورم باللثة'],
    explanation: 'التورم عند الأطفال يحتاج اهتماما أسرع لأنه قد يرتبط بالتهاب سن أو لثة ويؤثر على راحة الطفل وأكله.',
    delayAdvice: 'يفضل عدم التأجيل إذا كان هناك تورم واضح أو ألم شديد أو حرارة.',
    homeAdvice: 'حافظ على نظافة لطيفة ولا تحاول فتح أو الضغط على مكان التورم.',
    solution: 'الحل يعتمد على سبب التورم ويحدده الطبيب بعد الفحص، وقد يشمل علاجا محافظا أو إجراء إضافيا.',
    bookingCta: 'الأفضل فحص قريب لطبيب أسنان الأطفال لتحديد العلاج المناسب بسرعة.',
    reassurance: 'الفحص المبكر يساعد في تخفيف الألم واختيار علاج مناسب لعمر الطفل.',
  },
  {
    title: 'ألم أو ضغط بعد شد التقويم',
    symptom: 'ألم تقويم',
    specialty: 'تقويم',
    urgency: 'medium',
    keywords: ['تقويم', 'سلك', 'براكت', 'شد التقويم', 'ألم بعد التقويم', 'ضغط التقويم'],
    patientExamples: ['عندي ألم بعد شد التقويم', 'أحس التقويم ضاغط علي'],
    explanation: 'بعض الألم أو الضغط بعد جلسات التقويم متوقع، لكن الألم الشديد أو المستمر يحتاج تقييما.',
    delayAdvice: 'إذا كان الألم ضمن المتوقع قد يراقب لفترة قصيرة، أما إذا كان شديدا أو غير محتمل فيفضل المراجعة.',
    homeAdvice: 'تجنب الأكل القاسي مؤقتا، وحافظ على التنظيف حول التقويم بعناية.',
    solution: 'في الغالب يحتاج متابعة أو تعديل بسيط حسب سبب الانزعاج.',
    bookingCta: 'إذا استمر الانزعاج أو زاد، فالأفضل مراجعة التقويم.',
    reassurance: 'كثير من مشاكل التقويم اليومية يمكن حلها بسرعة بعد الفحص.',
  },
  {
    title: 'سلك تقويم جارح أو براكت مكسور',
    symptom: 'مشكلة تقويم',
    specialty: 'تقويم',
    urgency: 'medium',
    keywords: ['سلك جارح', 'البراكت انكسر', 'التقويم جرحني', 'السلك يجرح', 'براكت طاح'],
    patientExamples: ['السلك جرحني', 'واحد من البراكت طاح'],
    explanation: 'هذه المشاكل شائعة مع التقويم وقد تسبب جروحا أو توقفا في سير العلاج إذا انتركت.',
    delayAdvice: 'يفضل عدم التأجيل طويلا إذا كان هناك جرح أو قطعة متحركة أو انزعاج واضح.',
    homeAdvice: 'تجنب العبث بالسلك أو القطعة المكسورة، وحافظ على تنظيف لطيف للمكان.',
    solution: 'غالبا يحتاج الأمر تعديلا أو تثبيتا بسيطا عند الطبيب.',
    bookingCta: 'مراجعة التقويم تساعد على تعديل السلك أو تثبيت القطعة قبل ما تزيد المشكلة.',
    reassurance: 'غالبا تكون من الحالات السريعة في المعالجة عند المراجعة.',
  },
  {
    title: 'حساسية أو ألم بعد التبييض',
    symptom: 'بعد التبييض',
    specialty: 'تبييض',
    urgency: 'low',
    keywords: ['تبييض', 'بعد التبييض', 'حساسية بعد التبييض', 'وجع بعد التبييض'],
    patientExamples: ['عندي حساسية بعد التبييض', 'بعد التبييض صار عندي ألم خفيف'],
    explanation: 'الحساسية بعد التبييض قد تحدث بشكل مؤقت عند بعض المرضى، لكنها تحتاج تقييما إذا كانت قوية أو مستمرة.',
    delayAdvice: 'إذا كانت خفيفة ومؤقتة يمكن مراقبتها، أما استمرارها أو شدتها فيحتاج مراجعة.',
    homeAdvice: 'ابتعد مؤقتا عن البارد جدا والحار جدا واذكر للطبيب أي أعراض غير معتادة.',
    solution: 'في الغالب يتم التعامل معها بتخفيف المسبب أو إعطاء تعليمات مناسبة للحالة.',
    bookingCta: 'إذا استمرت الحساسية فالفحص يحدد هل تحتاج تهدئة أو تعديل بالخطة.',
    reassurance: 'معظم الحالات تكون مؤقتة وتتحسن خلال فترة قصيرة.',
  },
  {
    title: 'ألم ضرس عقل أو التهاب حوله',
    symptom: 'ضرس عقل',
    specialty: 'جراحة',
    urgency: 'high',
    keywords: ['ضرس عقل', 'ضرس العقل', 'ملتهب', 'آخر ضرس', 'جراحة', 'ألم خلفي'],
    patientExamples: ['ضرس العقل يوجعني', 'آخر ضرس ملتهب ومورم'],
    explanation: 'ألم ضرس العقل قد يكون من التهاب اللثة حوله أو من وضعية الضرس نفسه، وأحيانا يحتاج جراحة أو خلعا.',
    delayAdvice: 'لا يفضل التأجيل إذا كان الألم شديدا أو مع تورم أو صعوبة فتح الفم.',
    homeAdvice: 'حافظ على نظافة المنطقة قدر الإمكان وتجنب الضغط عليها أثناء المضغ.',
    solution: 'العلاج يحدده الفحص، وقد يكون دوائيا أو جراحيا حسب وضع الضرس.',
    bookingCta: 'الفحص يساعد نعرف هل الحالة تحتاج دواء ومتابعة أو إجراء جراحي.',
    reassurance: 'تقييم ضرس العقل مبكرا يساعد في تقليل الألم والمضاعفات.',
  },
  {
    title: 'نزيف بعد خلع أو جراحة',
    symptom: 'نزيف بعد خلع',
    specialty: 'جراحة',
    urgency: 'urgent',
    keywords: ['نزيف بعد خلع', 'نزيف بعد الجراحة', 'الدم ما وقف', 'خلع', 'جراحة'],
    patientExamples: ['عندي نزيف بعد الخلع', 'الدم ما دا يوقف بعد الجراحة'],
    explanation: 'النزيف المستمر بعد الخلع أو الإجراء الجراحي يحتاج مراجعة، خصوصا إذا كان واضحا أو لا يخف.',
    delayAdvice: 'يفضل عدم التأجيل إذا كان النزيف مستمرا أو غزيرا.',
    homeAdvice: 'تجنب المضمضة القوية أو العبث بالمكان إلى حين التقييم.',
    solution: 'الحل يكون بتقييم سبب النزيف واتخاذ الإجراء المناسب لإيقافه بأمان.',
    bookingCta: 'الأفضل التواصل والمراجعة بسرعة حتى يتم تقييم النزيف بشكل صحيح.',
    reassurance: 'المراجعة المبكرة تساعد في السيطرة على الوضع بسرعة وأمان.',
  },
  {
    title: 'ألم أو تورم بعد الزراعة',
    symptom: 'زراعة',
    specialty: 'زراعة',
    urgency: 'high',
    keywords: ['زراعة', 'زرعة', 'implant', 'ألم بعد الزراعة', 'تورم بعد الزراعة'],
    patientExamples: ['عندي ألم بعد الزراعة', 'مكان الزرعة متورم'],
    explanation: 'بعض الانزعاج البسيط قد يكون طبيعيا في البداية، لكن الألم المتزايد أو التورم الواضح يحتاج مراجعة.',
    delayAdvice: 'يفضل عدم التأجيل إذا كانت الأعراض تزيد أو معها إفرازات أو حرارة.',
    homeAdvice: 'التزم بالتعليمات بعد الزراعة وحافظ على النظافة اللطيفة بدون ضغط على المنطقة.',
    solution: 'الحل يعتمد على سبب الأعراض ويحدده الفحص المباشر للمنطقة.',
    bookingCta: 'الفحص مهم للتأكد من سلامة المنطقة والتئامها بالشكل الصحيح.',
    reassurance: 'المراجعة المبكرة تساعد في طمأنة الحالة والتصرف بسرعة إذا كان هناك سبب يحتاج علاج.',
  },
  {
    title: 'رائحة أو التهاب حول الزرعة',
    symptom: 'مشكلة زراعة',
    specialty: 'زراعة',
    urgency: 'medium',
    keywords: ['ريحة حول الزرعة', 'التهاب الزرعة', 'الزرعة تلتهب', 'رائحة زرعة'],
    patientExamples: ['أحس ريحة أو التهاب حول الزرعة', 'مكان الزرعة مو مرتاح'],
    explanation: 'قد ترتبط المشكلة بالتهاب في الأنسجة حول الزرعة أو بصعوبة التنظيف حولها.',
    delayAdvice: 'يفضل عدم تركها لفترة طويلة حتى لا تتأثر المنطقة حول الزرعة.',
    homeAdvice: 'اهتم بالتنظيف اللطيف حول الزرعة واذكر للطبيب أي نزيف أو ألم أو رائحة غير طبيعية.',
    solution: 'الحل يعتمد على تقييم المنطقة المحيطة بالزرعة ومعالجة السبب مباشرة.',
    bookingCta: 'الفحص يساعد على تقييم الزرعة والأنسجة المحيطة بها قبل تطور المشكلة.',
    reassurance: 'التقييم المبكر مهم جدا في مشاكل الزراعة لأنه يحافظ على ثباتها على المدى البعيد.',
  },
  {
    title: 'تركيبة ثابتة تتحرك أو تؤلم',
    symptom: 'تركيبات ثابتة',
    specialty: 'تركيبات ثابتة',
    urgency: 'medium',
    keywords: ['تركيبة ثابتة', 'تاج', 'جسر', 'التاج يتحرك', 'التركيبة تؤلم', 'تلبيسة'],
    patientExamples: ['التاج يتحرك', 'التركيبة الثابتة ضاغطة علي'],
    explanation: 'مشاكل التركيبات الثابتة قد تكون من عدم الثبات أو ضغط زائد أو تجمعات حولها تحتاج تقييما.',
    delayAdvice: 'إذا كانت تضغط أو تؤلم أو تتحرك فالأفضل عدم التأجيل طويلا.',
    homeAdvice: 'تجنب الأكل القاسي على الجهة المتأثرة وحافظ على تنظيف المنطقة جيدا.',
    solution: 'قد يكون الحل تعديلا بسيطا أو إعادة تثبيت أو إعادة تقييم للتركيبة.',
    bookingCta: 'الفحص يوضح ما إذا كانت تحتاج تعديلا بسيطا أو خطوة علاجية أخرى.',
    reassurance: 'كثير من مشاكل التركيبات الثابتة يمكن ضبطها إذا تم فحصها مبكرا.',
  },
  {
    title: 'طقم أو تركيبة متحركة تجرح أو لا تثبت',
    symptom: 'تركيبات متحركة',
    specialty: 'تركيبات متحركة',
    urgency: 'medium',
    keywords: ['تركيبة متحركة', 'طقم', 'الطقم يجرح', 'الطقم يتحرك', 'ما يثبت'],
    patientExamples: ['الطقم يجرحني', 'التركيبة المتحركة ما تثبت'],
    explanation: 'التركيبات المتحركة قد تحتاج تعديلا إذا سببت جروحا أو عدم ثبات أو صعوبة في الأكل والكلام.',
    delayAdvice: 'يمكن تأجيلها فترة قصيرة إذا كان الانزعاج بسيطا، لكن الجروح أو الألم يحتاجان مراجعة.',
    homeAdvice: 'تجنب الضغط الزائد على المناطق المجروحة ونظف التركيبة بحسب التعليمات.',
    solution: 'غالبا يتم تعديلها لتحسين الراحة والثبات حسب سبب المشكلة.',
    bookingCta: 'الفحص يساعد على تعديلها بشكل يخفف الاحتكاك ويحسن الثبات.',
    reassurance: 'غالبا يمكن تحسين راحة الطقم بشكل واضح بعد التعديل المناسب.',
  },
  {
    title: 'ألم بعد علاج عصب أو بين الجلسات',
    symptom: 'ألم بعد علاج عصب',
    specialty: 'عصب',
    urgency: 'medium',
    keywords: ['بعد علاج عصب', 'بين جلسات العصب', 'ألم بعد سحب العصب', 'عصب'],
    patientExamples: ['عندي ألم بعد علاج العصب', 'بين جلسات العصب السن بعده يوجع'],
    explanation: 'قد يبقى بعض الألم أو الحساسية بعد علاج العصب أو بين الجلسات، لكن شدته ومدة استمراره تحتاج تقييما.',
    delayAdvice: 'إذا كان الألم بسيطا قد يراقب لفترة قصيرة، أما إذا كان شديدا أو مع تورم فالأفضل المراجعة.',
    homeAdvice: 'تجنب المضغ على السن المعالج إذا كان مزعجا إلى حين المتابعة.',
    solution: 'غالبا يحتاج الأمر متابعة للتأكد أن مسار العلاج طبيعي ولا توجد حاجة لتعديل الخطة.',
    bookingCta: 'المراجعة تساعد الطبيب يتأكد أن سير العلاج طبيعي.',
    reassurance: 'بعض الانزعاج بعد علاج العصب قد يكون متوقعا، لكن الفحص يحسم إذا كان ضمن الطبيعي أو لا.',
  },
  {
    title: 'تسوس واضح أو حفرة بالسن',
    symptom: 'تسوس',
    specialty: 'حشوات',
    urgency: 'medium',
    keywords: ['تسوس', 'حفرة', 'ثقب بالسن', 'سوسة', 'سن مسوس'],
    patientExamples: ['عندي حفرة بالسن', 'واضح عندي تسوس'],
    explanation: 'وجود حفرة أو تسوس ظاهر يعني أن السن يحتاج تقييما قبل أن يمتد العمق ويصل للعصب.',
    delayAdvice: 'يمكن تأجيله فترة قصيرة إذا لم يوجد ألم شديد، لكن لا يفضل تركه حتى يتوسع.',
    homeAdvice: 'قلل السكريات ونظف السن جيدا ولا تهمل المكان حتى موعد الفحص.',
    solution: 'الحل يختلف حسب عمق التسوس وغالبا يبدأ بحشوة إذا تم اكتشافه مبكرا.',
    bookingCta: 'الفحص المبكر هنا غالبا يوفر علاجا أبسط وأقل من حيث الوقت.',
    reassurance: 'كثير من حالات التسوس تعالج بسهولة إذا تم التعامل معها في الوقت المناسب.',
  },
  {
    title: 'سحب لثة أو انكشاف جذر',
    symptom: 'انحسار لثة',
    specialty: 'لثة',
    urgency: 'medium',
    keywords: ['اللثة نازلة', 'انحسار لثة', 'الجذر مكشوف', 'اللثة تراجعت'],
    patientExamples: ['أحس اللثة نازلة', 'جزء من الجذر صار يبين'],
    explanation: 'انحسار اللثة قد يسبب حساسية ويحتاج تقييما لمعرفة سببه مثل التفريش القاسي أو مشكلة لثة.',
    delayAdvice: 'ليس عادة طارئا، لكن استمراره أو زيادة الحساسية تستدعي المراجعة.',
    homeAdvice: 'استخدم فرشاة ناعمة وتجنب الضغط القوي أثناء التفريش.',
    solution: 'العلاج يعتمد على سبب الانحسار ودرجته وما إذا كان يحتاج خطة علاج لثوي.',
    bookingCta: 'الفحص يحدد السبب ويبين إذا كانت الحالة تحتاج توجيها وقائيا أو علاجا خاصا.',
    reassurance: 'معرفة السبب مبكرا تساعد في الحد من تطور الانحسار.',
  },
  {
    title: 'ألم أو انزعاج بعد تنظيف الجير',
    symptom: 'بعد التنظيف',
    specialty: 'تنظيف',
    urgency: 'low',
    keywords: ['بعد التنظيف', 'بعد إزالة الجير', 'بعد تنظيف الأسنان', 'تنظيف'],
    patientExamples: ['بعد التنظيف صار عندي حساسية', 'بعد إزالة الجير أحس انزعاج'],
    explanation: 'بعد التنظيف قد تظهر حساسية أو انزعاج خفيف مؤقت، خصوصا إذا كان هناك جير كثير أو التهاب سابق.',
    delayAdvice: 'إذا كان خفيفا ومؤقتا يمكن مراقبته، أما إذا كان شديدا أو مستمرا فيحتاج مراجعة.',
    homeAdvice: 'ابتعد مؤقتا عن البارد والحار الشديدين وحافظ على تنظيف لطيف ومنتظم.',
    solution: 'غالبا يكفي الالتزام بالتعليمات والمتابعة إذا استمر الانزعاج أكثر من المتوقع.',
    bookingCta: 'إذا استمرت الأعراض، الفحص يحدد إن كانت ضمن المتوقع أو تحتاج متابعة.',
    reassurance: 'غالبا يتحسن الانزعاج بعد التنظيف خلال فترة قصيرة.',
  },
];

const normalizeText = (value) => String(value || '').trim();

const normalizeSearchText = (value) =>
  normalizeText(value)
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/گ/g, 'ك')
    .replace(/چ/g, 'ج')
    .replace(/ڤ/g, 'ف')
    .replace(/پ/g, 'ب')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const normalizeList = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeText(item)).filter(Boolean);
};

const normalizeFaqEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;

  const question = normalizeText(entry.question);
  const answer = normalizeText(entry.answer);

  if (!question && !answer) return null;

  return { question, answer };
};

const KNOWN_URGENCY_VALUES = new Set(['low', 'medium', 'high', 'urgent']);
const URGENCY_RANK = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

const SYMPTOM_DICTIONARY = [
  { canonical: 'ألم شديد', aliases: ['ألم شديد', 'وجع شديد', 'وجع قوي', 'ألم قوي', 'ما أقدر أنام', 'ما اكدر انام', 'ألم نابض'] },
  { canonical: 'ألم خفيف', aliases: ['ألم خفيف', 'وجع خفيف', 'ألم بسيط', 'يجي ويروح', 'متقطع'] },
  { canonical: 'تورم', aliases: ['تورم', 'ورم', 'انتفاخ', 'الخد وارم', 'اللثة وارمة'] },
  { canonical: 'نزيف', aliases: ['نزيف', 'دم', 'اللثة تنزف', 'ينزل دم', 'دم من اللثة'] },
  { canonical: 'حساسية', aliases: ['حساسية', 'بارد', 'حار', 'لسعة', 'يوجعني البارد', 'يوجعني الحار'] },
  { canonical: 'كسر', aliases: ['كسر', 'انكسر', 'تشقق', 'طاح جزء', 'سن مكسور'] },
  { canonical: 'تحرك سن', aliases: ['تحرك سن', 'يتحرك', 'يهتز', 'السن يتحرك', 'السن يتهز'] },
  { canonical: 'رائحة', aliases: ['رائحة', 'ريحة', 'رائحة فم', 'ريحة فم'] },
  { canonical: 'حشوة طاحت', aliases: ['حشوة طاحت', 'الحشوة طاحت', 'وقعت الحشوة', 'طاحت الحشوة'] },
  { canonical: 'تسوس', aliases: ['تسوس', 'حفرة', 'سوسة', 'سن مسوس', 'ثقب بالسن'] },
];

const SPECIALTY_DICTIONARY = [
  { canonical: 'أطفال', aliases: ['أطفال', 'اطفال', 'أسنان أطفال', 'اسنان اطفال'] },
  { canonical: 'عصب', aliases: ['عصب', 'علاج عصب', 'سحب عصب', 'جذور'] },
  { canonical: 'لثة', aliases: ['لثة', 'لثه', 'لثوي'] },
  { canonical: 'تقويم', aliases: ['تقويم', 'أسلاك', 'اسلاك', 'تقويمي'] },
  { canonical: 'زراعة', aliases: ['زراعة', 'زرعة', 'زرعات'] },
  { canonical: 'جراحة', aliases: ['جراحة', 'خلع جراحي', 'جراحي'] },
  { canonical: 'تجميل', aliases: ['تجميل', 'عدسات', 'فينير', 'ابتسامة'] },
  { canonical: 'تبييض', aliases: ['تبييض', 'تبيض'] },
  { canonical: 'تنظيف', aliases: ['تنظيف', 'تنظيف جير', 'إزالة جير', 'ازالة جير'] },
  { canonical: 'تركيبات ثابتة', aliases: ['تركيبات ثابتة', 'تركيبة ثابتة', 'تاج', 'تلبيسة', 'جسر'] },
  { canonical: 'تركيبات متحركة', aliases: ['تركيبات متحركة', 'تركيبة متحركة', 'طقم', 'طقم أسنان', 'طقم اسنان'] },
  { canonical: 'طوارئ', aliases: ['طوارئ', 'طارئ', 'عاجل'] },
  { canonical: 'تسوس وحشوات', aliases: ['تسوس', 'حشوة', 'حشوات', 'ترميم'] },
  { canonical: 'عناية منزلية', aliases: ['غسول', 'معجون', 'خيط الأسنان', 'خيط الاسنان', 'تفريش', 'فرشاة'] },
];

const getDictionaryMatch = (value, dictionary) => {
  const normalizedValue = normalizeSearchText(value);
  if (!normalizedValue) return null;

  return (
    dictionary.find((entry) =>
      entry.aliases.some((alias) => {
        const normalizedAlias = normalizeSearchText(alias);
        return (
          normalizedValue === normalizedAlias ||
          normalizedValue.includes(normalizedAlias) ||
          normalizedAlias.includes(normalizedValue)
        );
      })
    ) || null
  );
};

const canonicalizeMappedValue = (value, dictionary) => {
  const cleaned = normalizeText(value);
  const match = getDictionaryMatch(cleaned, dictionary);
  return match ? match.canonical : cleaned;
};

const getAliasesForCanonicalValue = (value, dictionary) => {
  const match = getDictionaryMatch(value, dictionary);
  return match ? match.aliases : [];
};

const uniqueTextList = (...lists) => {
  const map = new Map();

  lists
    .flat()
    .filter(Boolean)
    .forEach((item) => {
      const cleaned = normalizeText(item);
      const key = normalizeSearchText(cleaned);
      if (!cleaned || !key || map.has(key)) return;
      map.set(key, cleaned);
    });

  return [...map.values()];
};

const normalizeKnowledgeTitle = ({ title, symptom, specialty }) => {
  const cleanedTitle = normalizeText(title);

  if (cleanedTitle && cleanedTitle.includes(' - ') && symptom && specialty) {
    return `${symptom} - ${specialty}`;
  }

  if (cleanedTitle && !/^حالة مستوردة \d+$/i.test(cleanedTitle)) {
    return cleanedTitle;
  }

  if (symptom && specialty) return `${symptom} - ${specialty}`;
  if (symptom) return symptom;
  if (specialty) return specialty;

  return cleanedTitle;
};

const normalizeUrgencyValue = (urgency, fallbackText = '') => {
  const cleanedUrgency = normalizeText(urgency).toLowerCase();
  if (KNOWN_URGENCY_VALUES.has(cleanedUrgency)) {
    return cleanedUrgency;
  }

  return urgencyFromText(fallbackText);
};

const normalizeKnowledgeEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;

  const originalSymptom = normalizeText(entry.symptom);
  const originalSpecialty = normalizeText(entry.specialty);
  const symptom = canonicalizeMappedValue(originalSymptom, SYMPTOM_DICTIONARY);
  const specialty = canonicalizeMappedValue(originalSpecialty, SPECIALTY_DICTIONARY);
  const title = normalizeKnowledgeTitle({
    title: entry.title,
    symptom,
    specialty,
  });

  const normalized = {
    title,
    symptom,
    specialty,
    urgency: normalizeUrgencyValue(
      entry.urgency,
      [
        entry.title,
        originalSymptom,
        originalSpecialty,
        entry.explanation,
        entry.delayAdvice,
        entry.solution,
      ].join(' ')
    ),
    keywords: uniqueTextList(
      normalizeList(entry.keywords),
      [title, symptom, specialty, originalSymptom, originalSpecialty],
      getAliasesForCanonicalValue(symptom, SYMPTOM_DICTIONARY),
      getAliasesForCanonicalValue(specialty, SPECIALTY_DICTIONARY)
    ),
    patientExamples: uniqueTextList(normalizeList(entry.patientExamples)),
    explanation: normalizeText(entry.explanation),
    delayAdvice: normalizeText(entry.delayAdvice),
    homeAdvice: normalizeText(entry.homeAdvice),
    solution: normalizeText(entry.solution),
    bookingCta: normalizeText(entry.bookingCta),
    reassurance: normalizeText(entry.reassurance),
  };

  if (!normalized.title && !normalized.symptom && !normalized.specialty && !normalized.explanation) {
    return null;
  }

  return normalized;
};

const normalizeListFromEntries = (entries, normalizer) => {
  if (!Array.isArray(entries)) return [];
  return entries.map(normalizer).filter(Boolean);
};

const normalizeAiConfig = (faqData) => {
  if (Array.isArray(faqData)) {
    return {
      faqs: faqData.map(normalizeFaqEntry).filter(Boolean),
      knowledgeCases: [],
    };
  }

  if (!faqData || typeof faqData !== 'object') {
    return { faqs: [], knowledgeCases: [] };
  }

  return {
    faqs: normalizeListFromEntries(faqData.faqs, normalizeFaqEntry),
    knowledgeCases: normalizeListFromEntries(faqData.knowledgeCases, normalizeKnowledgeEntry),
  };
};

const buildAiConfig = ({ faqs = [], knowledgeCases = [] } = {}) => ({
  faqs: normalizeListFromEntries(faqs, normalizeFaqEntry),
  knowledgeCases: normalizeListFromEntries(knowledgeCases, normalizeKnowledgeEntry),
});

const getAiConfigFromSettings = (settings) => {
  const rawFaqData = settings?.faqData;

  if (Array.isArray(rawFaqData)) {
    const normalized = normalizeAiConfig(rawFaqData);
    return {
      faqs: normalized.faqs.length ? normalized.faqs : DEFAULT_FAQS,
      knowledgeCases: DEFAULT_KNOWLEDGE_CASES,
    };
  }

  if (rawFaqData && typeof rawFaqData === 'object') {
    return normalizeAiConfig(rawFaqData);
  }

  return {
    faqs: DEFAULT_FAQS,
    knowledgeCases: DEFAULT_KNOWLEDGE_CASES,
  };
};

const urgencyFromText = (value) => {
  const text = normalizeSearchText(value);
  if (!text) return 'medium';
  if (
    text.includes('تورم') ||
    text.includes('نزيف') ||
    text.includes('الم شديد') ||
    text.includes('وجع شديد') ||
    text.includes('ما اكدر انام') ||
    text.includes('ما اقدر انام') ||
    text.includes('طوارئ') ||
    text.includes('عاجل') ||
    text.includes('كسر') ||
    text.includes('سن مكسور') ||
    text.includes('تحرك سن') ||
    text.includes('السن يتحرك') ||
    text.includes('صعوبه فتح الفم') ||
    text.includes('صعوبة فتح الفم') ||
    text.includes('صعوبه الاكل') ||
    text.includes('صعوبة الاكل')
  ) {
    return text.includes('طوارئ') || text.includes('عاجل') ? 'urgent' : 'high';
  }
  if (text.includes('الم خفيف') || text.includes('رائحه') || text.includes('حساسيه')) {
    return 'medium';
  }
  return 'medium';
};

const extractSection = (block, label, nextLabels) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedNext = nextLabels.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const pattern = nextLabels.length
    ? new RegExp(
        `${escapedLabel}\\s*(?:[؟?])?\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*(?:${escapedNext})\\s*(?:[؟?])?\\s*:?(?:\\s*\\n|\\s*$)|$)`,
        'i'
      )
    : new RegExp(`${escapedLabel}\\s*(?:[؟?])?\\s*:?\\s*([\\s\\S]*?)$`, 'i');
  const match = block.match(pattern);
  return normalizeText(match?.[1] || '');
};

const extractPatientInfo = (patientLine) => {
  const cleaned = normalizeText(patientLine).replace(/^(دكتور|دكتورة)\s+/i, '');
  const relationMatch = cleaned.match(/عندي\s+(.+?)(?:\s+بالاسنان|\s+بالأسنان)?\s+ومرتبط\s+ب[ـ]?\s+(.+?)(?:[،,.؟?]|$)/i);

  if (relationMatch) {
    return {
      symptom: normalizeText(relationMatch[1]),
      specialty: normalizeText(relationMatch[2]),
    };
  }

  const simpleMatch = cleaned.match(/عندي\s+(.+?)(?:[،,.؟?]|$)/i);
  if (simpleMatch) {
    return {
      symptom: normalizeText(simpleMatch[1]),
      specialty: '',
    };
  }

  return { symptom: '', specialty: '' };
};

const selectRicherText = (firstValue, secondValue) => {
  const first = normalizeText(firstValue);
  const second = normalizeText(secondValue);

  if (!first) return second;
  if (!second) return first;

  return second.length > first.length ? second : first;
};

const mergeKnowledgeEntries = (currentEntry, incomingEntry) => {
  const current = normalizeKnowledgeEntry(currentEntry);
  const incoming = normalizeKnowledgeEntry(incomingEntry);

  if (!current) return incoming;
  if (!incoming) return current;

  return normalizeKnowledgeEntry({
    title: selectRicherText(current.title, incoming.title),
    symptom: current.symptom || incoming.symptom,
    specialty: current.specialty || incoming.specialty,
    urgency:
      (URGENCY_RANK[incoming.urgency] || 0) > (URGENCY_RANK[current.urgency] || 0)
        ? incoming.urgency
        : current.urgency,
    keywords: uniqueTextList(current.keywords, incoming.keywords),
    patientExamples: uniqueTextList(current.patientExamples, incoming.patientExamples),
    explanation: selectRicherText(current.explanation, incoming.explanation),
    delayAdvice: selectRicherText(current.delayAdvice, incoming.delayAdvice),
    homeAdvice: selectRicherText(current.homeAdvice, incoming.homeAdvice),
    solution: selectRicherText(current.solution, incoming.solution),
    bookingCta: selectRicherText(current.bookingCta, incoming.bookingCta),
    reassurance: selectRicherText(current.reassurance, incoming.reassurance),
  });
};

const dedupeKnowledgeCases = (entries) => {
  const map = new Map();

  entries.forEach((entry) => {
    const normalized = normalizeKnowledgeEntry(entry);
    if (!normalized) return;

    const symptomKey = normalizeSearchText(normalized.symptom);
    const specialtyKey = normalizeSearchText(normalized.specialty);
    const key =
      symptomKey || specialtyKey
        ? ['symptom', symptomKey, 'specialty', specialtyKey].join('::')
        : [normalizeSearchText(normalized.title), normalizeSearchText(normalized.explanation)].filter(Boolean).join('::');

    if (!key) return;
    map.set(key, map.has(key) ? mergeKnowledgeEntries(map.get(key), normalized) : normalized);
  });

  return [...map.values()];
};

const parseKnowledgeCasesFromText = (rawText) => {
  const text = String(rawText || '').replace(/\r\n/g, '\n');
  const blocks = text
    .split(/(?:^|\n)\s*(?:\d+\.\s*)?الحالة\s*:?\s*\n?/g)
    .map((item) => item.trim())
    .filter(Boolean);

  const parsedCases = blocks
    .map((block, index) => {
      const patientLine = extractSection(block, 'المريض', [
        'التفسير الطبي',
        'هل أأجل',
        'الحل',
        'نصيحة منزلية',
        'تطمين',
      ]);
      const explanation = extractSection(block, 'التفسير الطبي', ['هل أأجل', 'الحل', 'نصيحة منزلية', 'تطمين']);
      const delayAdvice = extractSection(block, 'هل أأجل', ['الحل', 'نصيحة منزلية', 'تطمين']);
      const solution = extractSection(block, 'الحل', ['نصيحة منزلية', 'تطمين']);
      const homeAdvice = extractSection(block, 'نصيحة منزلية', ['تطمين']);
      const reassurance = extractSection(block, 'تطمين', []);

      const { symptom, specialty } = extractPatientInfo(patientLine);
      const title = [symptom, specialty].filter(Boolean).join(' - ') || `حالة مستوردة ${index + 1}`;

      return normalizeKnowledgeEntry({
        title,
        symptom,
        specialty,
        urgency: urgencyFromText(`${patientLine} ${explanation} ${delayAdvice}`),
        keywords: [symptom, specialty].filter(Boolean),
        patientExamples: patientLine ? [patientLine] : [],
        explanation,
        delayAdvice,
        homeAdvice,
        solution,
        bookingCta: solution
          ? `${solution} والأفضل يتم الفحص حتى تتحدد الخطة المناسبة بدقة.`
          : 'يفضل الفحص لتحديد السبب والخطة العلاجية المناسبة.',
        reassurance,
      });
    })
    .filter(Boolean);

  const dedupedCases = dedupeKnowledgeCases(parsedCases);

  return {
    cases: dedupedCases,
    stats: {
      rawBlocks: blocks.length,
      parsedCases: parsedCases.length,
      dedupedCases: dedupedCases.length,
      removedDuplicates: parsedCases.length - dedupedCases.length,
    },
  };
};

const scoreTermMatch = (haystack, term, fullScore, tokenScore = 0) => {
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) return 0;

  if (haystack.includes(normalizedTerm)) {
    return fullScore;
  }

  if (!tokenScore) return 0;

  const tokens = normalizedTerm.split(' ').filter((token) => token.length >= 3);
  if (!tokens.length) return 0;

  const matchedTokens = tokens.filter((token) => haystack.includes(token)).length;
  if (!matchedTokens) return 0;

  return matchedTokens === tokens.length ? tokenScore * matchedTokens : 0;
};

const matchKnowledgeCases = (userMessage, knowledgeCases, limit = 4) => {
  const haystack = normalizeSearchText(userMessage);
  if (!haystack) return [];

  return knowledgeCases
    .map((entry) => {
      let score = 0;

      score += scoreTermMatch(haystack, entry.title, 4, 0.75);
      score += scoreTermMatch(haystack, entry.symptom, 5, 1);
      score += scoreTermMatch(haystack, entry.specialty, 4, 0.75);

      entry.keywords.forEach((keyword) => {
        score += scoreTermMatch(haystack, keyword, 2, 0.5);
      });

      entry.patientExamples.forEach((example) => {
        score += scoreTermMatch(haystack, example, 1, 0.25);
      });

      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.entry);
};

const formatFaqsForPrompt = (faqs) => {
  if (!faqs.length) return '';

  return [
    'الأسئلة الشائعة المعتمدة:',
    ...faqs.map((faq, index) => `${index + 1}. سؤال: ${faq.question}\n   جواب: ${faq.answer}`),
  ].join('\n');
};

const formatKnowledgeForPrompt = (knowledgeCases) => {
  if (!knowledgeCases.length) return '';

  return [
    'قاعدة المعرفة المنظمة للحالات:',
    ...knowledgeCases.map((entry, index) => {
      const lines = [
        `${index + 1}. الحالة: ${entry.title || entry.symptom || 'حالة بدون عنوان'}`,
        entry.symptom ? `   الشكوى الأساسية: ${entry.symptom}` : null,
        entry.specialty ? `   التخصص المرجح: ${entry.specialty}` : null,
        entry.urgency ? `   درجة الاستعجال: ${entry.urgency}` : null,
        entry.explanation ? `   التفسير المبسط: ${entry.explanation}` : null,
        entry.delayAdvice ? `   هل تؤجل؟ ${entry.delayAdvice}` : null,
        entry.homeAdvice ? `   نصيحة منزلية: ${entry.homeAdvice}` : null,
        entry.solution ? `   الحل المتوقع: ${entry.solution}` : null,
        entry.bookingCta ? `   دعوة للحجز: ${entry.bookingCta}` : null,
        entry.reassurance ? `   تطمين: ${entry.reassurance}` : null,
      ].filter(Boolean);

      return lines.join('\n');
    }),
  ].join('\n');
};

module.exports = {
  DEFAULT_FAQS,
  DEFAULT_KNOWLEDGE_CASES,
  normalizeAiConfig,
  buildAiConfig,
  getAiConfigFromSettings,
  dedupeKnowledgeCases,
  parseKnowledgeCasesFromText,
  matchKnowledgeCases,
  formatFaqsForPrompt,
  formatKnowledgeForPrompt,
};
