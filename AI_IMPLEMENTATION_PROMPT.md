# نظام تطبيق الميزات الجديدة - نص تعليمات شامل

## ملخص المشروع
تطبيق إدارة عيادات طبية مع تكامل واتس آب. يتكون من:
- **Backend**: Node.js + Express + Prisma ORM + PostgreSQL
- **Dashboard**: React + Vite + Tailwind CSS
- **التكامل**: Meta Cloud API للواتس آب

---

## المهام المطلوب تنفيذها

### 1️⃣ تخصيص اسم العيادة في الرسائل الآلية
**الهدف**: استبدال كلمة "بوت" أو "نحن" برسالة بإسم العيادة الفعلي

**التنفيذ**:
- أضف حقل `botName` في جدول `Clinic` (schema.prisma)
- في `whatsappService.js`: استخدم `clinic.botName` بدلاً من النص الثابت
- في `webhookController.js`: استخدم الاسم عند الرد على الرسائل
- في `campaignController.js`: استخدم الاسم في الرسائل الجماعية
- واجهة العيادة: أضف حقل تحرير لاسم البوت في صفحة الإعدادات

---

### 2️⃣ عزل الرسائل المراجعة من قبل البشر
**الهدف**: إظهار الرسائل المراجعة من قبل الموظفين بشكل منفصل في الإنبوكس

**التنفيذ**:
- أضف حقل `reviewedBy` (userId) و`reviewedAt` (timestamp) في جدول `Message`
- عند رد موظف يدوياً: سجل `reviewedBy` و`reviewedAt`
- في InboxPage.jsx: أضف تاب منفصل "Reviewed Messages" أو فلتر checkbox
- عرض معلومات من قام بالمراجعة والوقت
- في قائمة الرسائل: بطاقة تمييزية مثل "✓ تم المراجعة من {name} في {time}"

---

### 3️⃣ تخصيص اسم المرسل في رسائل الموظفين
**الهدف**: تغيير اسم الموظف الذي تظهره الرسالة للمريض

**التنفيذ**:
- أضف حقل `displayName` في جدول `User`
- عند إرسال رسالة يدوية من موظف: استخدم `user.displayName` في الرسالة
- في `messageController.js`: الدالة `sendMessage()` تتحقق من `displayName`
- واجهة الموظفين: إضافة حقل "Display Name" في ملف المستخدم

---

### 4️⃣ إدارة قائمة جهات الاتصال المباشرة
**الهدف**: إمكانية إضافة/حذف أرقام الاتصال المباشرة للعيادة

**التنفيذ**:
- أضف جدول جديد `DirectContact`:
  ```prisma
  model DirectContact {
    id String @id @default(cuid())
    clinicId String
    clinic Clinic @relation(fields: [clinicId], references: [id])
    name String
    phone String @unique
    description String?
    priority Int @default(0)
    active Boolean @default(true)
    createdAt DateTime @default(now())
  }
  ```
- أضف API endpoints:
  - `GET /contacts` - عرض قائمة الاتصالات
  - `POST /contacts` - إضافة اتصال
  - `PUT /contacts/:id` - تعديل اتصال
  - `DELETE /contacts/:id` - حذف اتصال
- في `webhookController.js`: عند رسالة تحتوي على كلمات مثل "اتصل" أو "رقم"، أرسل قائمة الاتصالات
- واجهة: صفحة جديدة "Direct Contacts" في الإعدادات

---

### 5️⃣ تحسين عرض الاستشارات
**الهدف**: عرض تاريخ الاستشارات بشكل منظم وسهل القراءة

**التنفيذ**:
- في صفحة "Patient Profile": أضف قسم منفصل "Consultations History"
- عرض جدول بـ:
  - التاريخ والوقت
  - الطبيب
  - نوع الاستشارة
  - الملاحظات
  - أيقونة PDF للتقرير (إن وجد)
- ترتيب زمني معكوس (الأحدث أولاً)
- فلترة حسب الطبيب أو التاريخ

---

### 6️⃣ تحسين ملفات المرضى مع ملاحظات المحاسبة
**الهدف**: تتبع ملاحظات مالية وحسابات لكل مريض

**التنفيذ**:
- أضف حقول في جدول `Patient`:
  ```prisma
  accountingNotes String?
  totalSpent Float @default(0)
  lastPaymentDate DateTime?
  creditBalance Float @default(0)
  ```
- في صفحة Patient Profile: أضف قسم "Accounting"
- عرض:
  - إجمالي المدفوع
  - الرصيد الحالي (رصيد أو ديون)
  - آخر دفعة
  - ملاحظات محاسبية (نص قابل للتحرير)
- عند استشارة: تحديث `totalSpent` و `lastPaymentDate`

---

### 7️⃣ تخصيص الشعار والعلامات التجارية
**الهدف**: السماح بتحميل شعار العيادة واستخدامه في الرسائل

**التنفيذ**:
- أضف حقل `logoUrl` في جدول `Clinic`
- في `whatsappService.js`: إرسال شعار مع الرسائل (إن كانت المنصة تدعمها)
- في InboxPage و CampaignsPage: عرض الشعار في الرأس
- واجهة الإعدادات: حقل تحميل الشعار

---

### 8️⃣ سير العمل لاستبدال الطبيب مع إعادة جدولة المواعيد
**الهدف**: استبدال طبيب بآخر وإعادة جدولة جميع مواعيده تلقائياً

**التنفيذ**:
- أضف دالة جديدة في `appointmentController.js`:
  ```javascript
  rescheduleByDoctor = async (req, res, next) => {
    const { fromDoctorId, toDoctorId } = req.body;
    // 1. ابحث عن جميع المواعيد غير المكتملة للطبيب الأول
    // 2. تحقق من توفر الطبيب الثاني في نفس الأوقات
    // 3. نقل المواعيد وإرسال إشعارات للمرضى
    // 4. سجل التغيير في السجل
  }
  ```
- أضف route:
  - `POST /appointments/reschedule-doctor` - نقل مواعيد طبيب
- في الواجهة: 
  - صفحة "Replace Doctor" في الإدارة
  - اختيار الطبيب القديم والجديد
  - عرض عدد المواعيد التي ستتأثر
  - تأكيد العملية
- إرسال إشعارات للمرضى: "تم تعيين د. {name} بدلاً من د. {old_name}"

---

### 9️⃣ إدارة الخصومات الجماعية
**الهدف**: تطبيق خصومات على خدمات محددة لمجموعات من المرضى

**التنفيذ**:
- أضف جدول جديد `Discount`:
  ```prisma
  model Discount {
    id String @id @default(cuid())
    clinicId String
    clinic Clinic @relation(fields: [clinicId], references: [id])
    name String
    description String?
    discountPercent Float
    maxUses Int?
    usedCount Int @default(0)
    applicableServices String[] // service IDs
    applicablePatientGroups String[] // group IDs
    startDate DateTime
    endDate DateTime
    active Boolean @default(true)
    createdAt DateTime @default(now())
  }
  ```
- API endpoints:
  - `GET /discounts` - عرض الخصومات
  - `POST /discounts` - إضافة خصم
  - `PUT /discounts/:id` - تعديل خصم
  - `DELETE /discounts/:id` - حذف خصم
- في `appointmentController.js`: حساب الخصم التلقائي عند حجز استشارة
- واجهة: صفحة "Discounts Management" في الإعدادات

---

## 🔧 مشكلة الحجز (حرجة)

### الوضع الحالي
المريض يختار الطبيب أولاً، ثم يرى الأوقات المتاحة. هذا يجبره على اختيار وقت قبل رؤية الخيارات.

### الحل المطلوب
1. **الخطوة 1**: المريض يختار **الموعد/الوقت المطلوب**
2. **الخطوة 2**: النظام يعرض **الأطباء المتاحين** في هذا الوقت
3. **الخطوة 3**: المريض يختار الطبيب من الخيارات المتاحة

### التنفيذ التقني

#### Backend (`appointmentController.js`):
```javascript
// دالة جديدة: ابحث عن الأطباء المتاحين في وقت محدد
getAvailableDoctors = async (req, res, next) => {
  const { date, timeSlotId, serviceId } = req.query;
  
  try {
    // 1. ابحث عن جميع الأطباء الذين يقدمون الخدمة
    const doctors = await prisma.doctor.findMany({
      where: { serviceIds: { has: serviceId } }
    });
    
    // 2. تحقق من توفرهم في الوقت المحدد
    const available = [];
    for (const doctor of doctors) {
      const hasConflict = await prisma.appointment.findFirst({
        where: {
          doctorId: doctor.id,
          dateSelected: date,
          timeSlotId: timeSlotId,
          status: { notIn: ['CANCELLED', 'REJECTED'] }
        }
      });
      
      if (!hasConflict) {
        available.push(doctor);
      }
    }
    
    res.json({ doctors: available });
  } catch (error) {
    next(error);
  }
};
```

#### Frontend (صفحة الحجز الجديدة):
```jsx
// BookingFlow.jsx - إعادة هيكلة كاملة

Step 1: Select Service
Step 2: Select Date & Time
  - عرض تقويم
  - اختيار التاريخ
  - اختيار الوقت (TimeSlot)
  - عند الاختيار: استدعاء API getAvailableDoctors
  
Step 3: Select Doctor
  - عرض قائمة الأطباء المتاحين فقط
  - عرض صورة وتخصص كل طبيب
  - اختيار الطبيب
  
Step 4: Confirm
  - عرض ملخص الحجز
  - التأكيد والإرسال
```

#### API Endpoint:
```javascript
// routes/appointments.js
router.get('/availability/doctors', getAvailableDoctors);
```

---

## 📋 متطلبات التنفيذ العام

### قبل البدء:
1. إنشاء migration جديدة للحقول المضافة:
   ```bash
   npx prisma migrate dev --name add_new_features
   ```
2. تحديث `schema.prisma` بجميع الحقول الجديدة
3. تشغيل `npx prisma generate`

### أثناء التطوير:
- اتبع نفط معايير المشروع الموجودة
- استخدم أسماء متغيرات واضحة
- تجنب التعليقات الزائدة
- اختبر كل ميزة قبل الانتقال للتالية

### بعد الانتهاء:
1. اختبر جميع الميزات في بيئة التطوير
2. تأكد من عدم وجود أخطاء في console
3. اختبر التكامل مع واتس آب
4. تحقق من عمل dashboard بدون أخطاء

---

## 📁 الملفات الرئيسية للتعديل

### Backend:
- `server/src/schema.prisma` - إضافة الحقول والجداول الجديدة
- `server/src/controllers/appointmentController.js` - منطق الحجز الجديد
- `server/src/controllers/messageController.js` - دعم المراجعة والأسماء المخصصة
- `server/src/services/whatsappService.js` - استخدام اسم العيادة والشعار
- `server/src/routes/` - إضافة routes جديدة
- Migration files - إنشاء migrations للتغييرات

### Frontend:
- `dashboard/src/pages/InboxPage.jsx` - إضافة تاب الرسائل المراجعة
- `dashboard/src/pages/PatientProfilePage.jsx` - إضافة الاستشارات والمحاسبة
- `dashboard/src/pages/SettingsPage.jsx` - إضافة الاتصالات والخصومات
- `dashboard/src/components/BookingFlow.jsx` - إعادة بناء عملية الحجز
- صفحات جديدة: `DirectContactsPage.jsx`, `DiscountsPage.jsx`

---

## ⚠️ ملاحظات مهمة

1. **الأمان**: تحقق دائماً من صلاحيات المستخدم قبل تنفيذ أي عملية
2. **قاعدة البيانات**: استخدم transactions للعمليات المعقدة (مثل إعادة جدولة المواعيد)
3. **التنبيهات**: أرسل إشعارات واتس آب مناسبة لكل تغيير
4. **السجل**: سجل جميع التغييرات المهمة (audit log)
5. **الاختبار**: اختبر مع بيانات حقيقية قبل الإطلاق

---

## 🎯 ترتيب التنفيذ الموصى به

1. حل مشكلة الحجز أولاً (الأكثر حرجية)
2. تخصيص اسم العيادة (أساسي)
3. الحقول البسيطة (sender name، bot name)
4. الجداول الجديدة (contacts، discounts)
5. الميزات المعقدة (استبدال الطبيب، الاستشارات)

---

## 📞 التكامل مع واتس آب

- استخدم `whatsappService.sendTextMessage()` و `whatsappService.sendTemplateMessage()`
- أرسل إشعارات عند:
  - تغيير مواعيد
  - تعديل البيانات
  - تطبيق خصومات
  - استبدال الطبيب

---

هذا النص الشامل يغطي جميع المتطلبات. استخدمه كمرجع كامل لتنفيذ جميع الميزات.
