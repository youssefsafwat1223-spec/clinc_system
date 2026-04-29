# دليل تنفيذ تحسين الواجهة - أمثلة محددة لكل صفحة

## تم إنشاؤه: المكونات المشتركة ✅
- `./dashboard/src/components/Stepper.jsx` - للخطوات
- `./dashboard/src/components/EmptyState.jsx` - الحالات الفارغة
- `./dashboard/src/components/SkeletonLoader.jsx` - loading
- `./dashboard/src/components/Tabs.jsx` - التبويبات

---

## 1️⃣ CampaignsPage.jsx - Stepper Wizard

### الخطوات المطلوبة:

#### أ. إضافة State للـ Stepper
```jsx
const [currentStep, setCurrentStep] = useState(0); // 0, 1, 2, 3

const steps = ['نوع الحملة', 'اختيار الجمهور', 'الرسالة', 'المراجعة والإرسال'];
```

#### ب. استبدال الـ Form بـ Step-based UI
```jsx
// بدل form كبير، أضف:
{currentStep === 0 && (
  <div className="space-y-4">
    <h3 className="text-lg font-bold text-white">اختر نوع الحملة</h3>
    <div className="grid gap-3">
      <button
        onClick={() => { setBroadcastType('TEXT'); setCurrentStep(1); }}
        className={`glass-card p-6 text-center ${broadcastType === 'TEXT' ? 'ring-2 ring-primary-500' : ''}`}
      >
        <div className="text-2xl mb-2">📝</div>
        <div className="font-bold">رسالة نصية</div>
      </button>
      <button
        onClick={() => { setBroadcastType('TEMPLATE'); setCurrentStep(1); }}
        className={`glass-card p-6 text-center ${broadcastType === 'TEMPLATE' ? 'ring-2 ring-primary-500' : ''}`}
      >
        <div className="text-2xl mb-2">📋</div>
        <div className="font-bold">قالب محفوظ</div>
      </button>
    </div>
  </div>
)}

{currentStep === 1 && (
  <div className="space-y-4">
    <h3 className="text-lg font-bold text-white">اختر الجمهور</h3>
    {/* audience selector موجود بالفعل - انسخه هنا */}
  </div>
)}

{currentStep === 2 && (
  <div className="grid gap-6 lg:grid-cols-2">
    {/* message input على اليسار */}
    {/* preview على اليمين */}
  </div>
)}

{currentStep === 3 && (
  <div className="space-y-4">
    <h3 className="text-lg font-bold text-white">تأكيد الحملة</h3>
    {/* ملخص الحملة */}
  </div>
)}
```

#### ج. إضافة Stepper في الأعلى
```jsx
import Stepper from '../components/Stepper';

// في الـ return:
<Stepper activeStep={currentStep} steps={steps} />
```

#### د. Navigation Buttons
```jsx
<div className="flex justify-between border-t border-dark-border pt-6">
  <button
    onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
    disabled={currentStep === 0}
    className="px-6 py-2 rounded-lg border border-dark-border hover:bg-dark-bg/50"
  >
    ← الخلف
  </button>
  <button
    onClick={() => {
      if (currentStep === 3) {
        handleSend(new Event('submit'));
      } else {
        setCurrentStep(currentStep + 1);
      }
    }}
    className="btn-primary"
  >
    {currentStep === 3 ? '✓ إرسال الحملة' : 'التالي →'}
  </button>
</div>
```

#### هـ. Results Page (بعد الإرسال بنجاح)
```jsx
if (stats) {
  return (
    <div className="glass-card p-8 text-center">
      <div className="text-4xl mb-4">✅</div>
      <h2 className="text-2xl font-bold text-emerald-400 mb-6">تم الإرسال بنجاح!</h2>
      
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
          <div className="text-2xl font-bold text-emerald-400">{stats.successCount}</div>
          <div className="text-sm text-slate-400">تم إرسالها</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-400">{stats.failCount}</div>
          <div className="text-sm text-slate-400">فشلت</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400">{stats.successCount + stats.failCount}</div>
          <div className="text-sm text-slate-400">المجموع</div>
        </div>
      </div>

      <button
        onClick={() => {
          setCurrentStep(0);
          setStats(null);
          setBroadcastType('TEXT');
          setMessageText('');
        }}
        className="btn-primary"
      >
        ➕ حملة جديدة
      </button>
    </div>
  );
}
```

---

## 2️⃣ InboxPage.jsx - Patient Cards محسّنة

### قائمة المرضى الحالية (تحديث صغير):

```jsx
// بدل الـ div البسيط، استخدم Card Component:
<div className="bg-gradient-to-r from-slate-700/20 to-transparent hover:from-slate-600/30 p-4 rounded-xl border border-dark-border cursor-pointer transition-all"
  onClick={() => setSelectedPatientId(patient.id)}>
  
  <div className="flex items-start gap-3">
    {/* Avatar */}
    <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center shrink-0">
      👤
    </div>
    
    <div className="flex-1 min-w-0">
      {/* اسم + رقم */}
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-white truncate">{patient.name}</p>
        <span className="text-xs text-slate-400">{formatTime(patient.lastMessageTime)}</span>
      </div>
      
      {/* رقم الهاتف */}
      <p className="text-xs text-slate-400 mb-2">📱 {patient.phone}</p>
      
      {/* آخر رسالة */}
      <p className="text-sm text-slate-300 truncate">{patient.lastMessage}</p>
      
      {/* Status + Unread */}
      <div className="flex items-center gap-2 mt-2">
        <StatusPill chatState={patient.chatState} />
        {patient.unreadCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
            {patient.unreadCount}
          </span>
        )}
      </div>
    </div>
  </div>
</div>
```

---

## 3️⃣ AppointmentsPage.jsx - Calendar View

### أضف Toggle في الأعلى:
```jsx
const [viewMode, setViewMode] = useState('list'); // 'list' أو 'calendar'

// في JSX:
<div className="flex gap-2 mb-6">
  <button
    onClick={() => setViewMode('list')}
    className={`px-4 py-2 rounded-lg ${viewMode === 'list' ? 'bg-primary-500' : 'bg-dark-bg'}`}
  >
    📋 قائمة
  </button>
  <button
    onClick={() => setViewMode('calendar')}
    className={`px-4 py-2 rounded-lg ${viewMode === 'calendar' ? 'bg-primary-500' : 'bg-dark-bg'}`}
  >
    📅 تقويم
  </button>
</div>

{viewMode === 'list' && (
  // الـ existing list view
)}

{viewMode === 'calendar' && (
  // Calendar view جديد - أنظر أدناه
)}
```

### Calendar Component (CSS Grid محلي):
```jsx
function CalendarView({ appointments, selectedDate, onDateSelect }) {
  const [currentDate, setCurrentDate] = useState(new Date(selectedDate || Date.now()));
  
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  
  const getAppointmentsForDate = (day) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.date);
      return aptDate.getDate() === day &&
             aptDate.getMonth() === currentDate.getMonth() &&
             aptDate.getFullYear() === currentDate.getFullYear();
    });
  };
  
  const statusColors = {
    PENDING: 'bg-amber-500',
    CONFIRMED: 'bg-emerald-500',
    REJECTED: 'bg-red-500',
    COMPLETED: 'bg-blue-500'
  };

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}>
          ←
        </button>
        <h3 className="font-bold text-white">
          {currentDate.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}
        </h3>
        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}>
          →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {['ح', 'ن', 'ث', 'أ', 'خ', 'ج', 'س'].map(d => (
          <div key={d} className="text-center text-xs font-bold text-slate-400 py-2">{d}</div>
        ))}
        
        {/* Empty cells for days before month starts */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        
        {/* Days */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayAppointments = getAppointmentsForDate(day);
          
          return (
            <div
              key={day}
              onClick={() => onDateSelect(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
              className="border border-dark-border rounded-lg p-2 cursor-pointer hover:bg-dark-border/50 aspect-square flex flex-col items-center justify-center"
            >
              <div className="text-xs font-bold text-white">{day}</div>
              {dayAppointments.length > 0 && (
                <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                  {dayAppointments.slice(0, 3).map((apt, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${statusColors[apt.status]}`} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 justify-center mt-6 text-xs">
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-slate-400">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 4️⃣ DashboardPage.jsx - KPI Enhancement

### تحديث الـ KPI Card:
```jsx
function KPICard({ title, value, change, icon: Icon, color }) {
  const isPositive = change > 0;
  
  return (
    <div className="glass-card border p-5 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-dark-muted">{title}</p>
          <p className="text-3xl font-bold text-white mt-2">{value}</p>
          
          {/* Change indicator */}
          <div className={`mt-2 flex items-center gap-1 text-sm font-medium ${
            isPositive ? 'text-emerald-400' : 'text-red-400'
          }`}>
            <span>{isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(change)}% من أمس</span>
          </div>
        </div>
        
        <div className="rounded-2xl bg-dark-bg/70 p-3">
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

// الاستخدام:
<KPICard
  title="مواعيد اليوم"
  value={stats.todayAppointments}
  change={(stats.todayAppointments - stats.yesterdayAppointments) / stats.yesterdayAppointments * 100}
  icon={CalendarCheck}
/>
```

---

## 5️⃣ PatientsPage.jsx - Card Enhancement

### تحديث الـ Patient Card:
```jsx
<div className="glass-card hover:border-primary-500/30 p-6 cursor-pointer transition-all" onClick={() => openPatientModal(patient)}>
  <div className="flex items-start justify-between gap-4 mb-4">
    <div>
      <h3 className="text-lg font-bold text-white">{patient.name}</h3>
      <p className="text-sm text-slate-400">📱 {patient.phone}</p>
    </div>
    <div className={`px-2 py-1 rounded text-xs font-bold ${
      patient.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
    }`}>
      {patient.active ? 'نشط' : 'معطل'}
    </div>
  </div>

  <div className="space-y-2 text-sm text-slate-400">
    <p>🎂 العمر: {patient.age} سنة</p>
    <p>🏥 عدد الزيارات: {patient.visitCount}</p>
    <p>⭐ التقييم: {patient.rating} / 5</p>
    <p>💵 الرصيد: {patient.balance} ر.س</p>
    <p>⏰ آخر زيارة: {formatDate(patient.lastVisit)}</p>
  </div>
</div>
```

---

## 6️⃣ StaffPage.jsx - Doctor Card Enhancement

### تحديث الـ Doctor Card:
```jsx
<div className="glass-card overflow-hidden group hover:border-primary-500/30 transition-all">
  {/* صورة الطبيب */}
  <div className="aspect-video bg-gradient-to-br from-primary-900 to-dark-bg flex items-center justify-center text-4xl overflow-hidden relative">
    {doctor.image ? <img src={doctor.image} alt={doctor.name} className="w-full h-full object-cover" /> : '👨‍⚕️'}
    {doctor.active && <div className="absolute top-3 right-3 w-3 h-3 bg-emerald-500 rounded-full" />}
  </div>

  {/* معلومات */}
  <div className="p-5 space-y-3">
    <div>
      <h3 className="font-bold text-white text-lg">د. {doctor.name}</h3>
      <p className="text-sm text-slate-400">{doctor.specialization}</p>
    </div>

    {/* إحصائيات اليوم */}
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="bg-dark-bg/50 rounded p-2">
        <div className="font-bold text-white">5</div>
        <div className="text-slate-400">مواعيد</div>
      </div>
      <div className="bg-dark-bg/50 rounded p-2">
        <div className="font-bold text-emerald-400">3</div>
        <div className="text-slate-400">مكتملة</div>
      </div>
    </div>

    {/* Rating */}
    <div className="flex items-center gap-1">
      ⭐ {doctor.rating} ({doctor.reviewCount})
    </div>

    {/* الأيام */}
    <div className="text-xs text-slate-400">
      ⏰ {doctor.workingDays?.join(', ') || 'لم يتم تعيين'}
    </div>
  </div>
</div>
```

---

## 7️⃣ SettingsPage.jsx - Tab Organization

### استبدل الـ sections بـ Tabs:
```jsx
import Tabs from '../components/Tabs';

const settingsTabs = [
  {
    label: '⚙️ عام',
    content: <GeneralSettings />
  },
  {
    label: '🏥 العيادة',
    content: <ClinicSettings />
  },
  {
    label: '👥 المستخدمين',
    content: <UsersSettings />
  },
  {
    label: '📞 جهات الاتصال',
    content: <ContactsSettings />
  },
  {
    label: '💬 الرسائل',
    content: <MessagesSettings />
  }
];

return (
  <AppLayout>
    <div className="max-w-4xl space-y-6 fade-in">
      <Tabs tabs={settingsTabs} />
    </div>
  </AppLayout>
);
```

---

## 8️⃣ ReviewsPage.jsx

### إضافة توزيع التقييمات:
```jsx
<div className="glass-card p-6">
  <h3 className="font-bold text-white mb-4">توزيع التقييمات</h3>
  
  <div className="space-y-3">
    {[5, 4, 3, 2, 1].map(rating => {
      const count = stats.ratingDistribution[rating] || 0;
      const percentage = (count / stats.totalReviews) * 100;
      
      return (
        <div key={rating} className="flex items-center gap-3">
          <span className="text-xs font-bold text-white w-12">{'⭐'.repeat(rating)}</span>
          <div className="flex-1 bg-dark-bg/50 rounded-full h-2 overflow-hidden">
            <div
              className="bg-amber-500 h-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 w-12 text-right">{count}</span>
        </div>
      );
    })}
  </div>
</div>
```

---

## 9️⃣ ConsultationsPage.jsx

### Consultation Card:
```jsx
<div className="glass-card p-5 hover:border-primary-500/30 transition-all">
  <div className="flex items-start justify-between mb-3">
    <div>
      <p className="font-bold text-white">{consultation.patientName}</p>
      <p className="text-sm text-slate-400">{consultation.serviceName}</p>
    </div>
    <span className={`px-2 py-1 rounded text-xs font-bold ${
      consultation.status === 'PENDING'
        ? 'bg-amber-500/10 text-amber-400'
        : 'bg-emerald-500/10 text-emerald-400'
    }`}>
      {consultation.status === 'PENDING' ? 'قيد الانتظار' : 'تم الرد'}
    </span>
  </div>

  <p className="text-sm text-slate-300 mb-3">{consultation.symptoms}</p>

  <div className="text-xs text-slate-500">
    📅 {formatDate(consultation.date)} | 👨‍⚕️ {consultation.doctorName}
  </div>
</div>
```

---

## 🔟 ServicesPage.jsx

### Service Card:
```jsx
<div className="glass-card p-5 hover:border-primary-500/30 transition-all">
  <h3 className="font-bold text-white mb-2">{service.name}</h3>
  <p className="text-sm text-slate-400 mb-3">{service.description}</p>

  <div className="grid grid-cols-2 gap-3 text-sm">
    <div>
      <span className="text-slate-400">💰 السعر:</span>
      <p className="font-bold text-white">{service.price} ر.س</p>
    </div>
    <div>
      <span className="text-slate-400">⏱️ المدة:</span>
      <p className="font-bold text-white">{service.duration} دقيقة</p>
    </div>
  </div>

  <div className="mt-3 pt-3 border-t border-dark-border flex gap-2">
    <button className="flex-1 btn-primary text-sm py-2">✏️ تعديل</button>
    <button className="flex-1 text-red-400 hover:text-red-500">🗑️ حذف</button>
  </div>
</div>
```

---

## 1️⃣1️⃣ AnalyticsPage.jsx

### Date Range Shortcuts:
```jsx
const [dateRange, setDateRange] = useState({ from: new Date(Date.now() - 30*24*60*60*1000), to: new Date() });

const shortcuts = [
  { label: 'اليوم', get dates() { const d = new Date(); return { from: d, to: d }; } },
  { label: 'هذا الأسبوع', get dates() { const d = new Date(); return { from: new Date(d.setDate(d.getDate() - 7)), to: new Date() }; } },
  { label: 'هذا الشهر', get dates() { const d = new Date(); return { from: new Date(d.setMonth(d.getMonth() - 1)), to: new Date() }; } },
  { label: 'هذا العام', get dates() { const d = new Date(); return { from: new Date(d.setFullYear(d.getFullYear() - 1)), to: new Date() }; } }
];

return (
  <div className="flex gap-2 mb-6 flex-wrap">
    {shortcuts.map(shortcut => (
      <button
        key={shortcut.label}
        onClick={() => setDateRange(shortcut.dates)}
        className="px-4 py-2 rounded-lg border border-dark-border hover:bg-dark-bg/50 text-sm font-medium"
      >
        {shortcut.label}
      </button>
    ))}
  </div>
);
```

---

## 📝 الخطوات النهائية:

1. **استيراد المكونات الجديدة** في كل صفحة:
   ```jsx
   import Stepper from '../components/Stepper';
   import EmptyState from '../components/EmptyState';
   import SkeletonLoader from '../components/SkeletonLoader';
   import Tabs from '../components/Tabs';
   ```

2. **اختبر كل صفحة** في المتصفح بعد التحديث

3. **تأكد من الـ API calls** أنها لا تزال تعمل

4. **اختبر على Responsive** على موبايل وتابلت

5. **استقبل تقييمات المستخدمين** وحسّن بناءً عليها

---

هذا الدليل يوفر أمثلة محددة لكل صفحة. الآن يمكنك نسخ هذه الأمثلة وتطبيقها على الملفات الفعلية! 🚀
