import { useEffect, useMemo, useState } from 'react';
import { Calendar, ClipboardList, FileText, MessageSquare, Phone, Pill, Save, Search, Send, UserRound, Users, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';

const platformLabels = {
  WHATSAPP: 'واتساب',
  FACEBOOK: 'فيسبوك',
  INSTAGRAM: 'انستجرام',
};

const platformClasses = {
  WHATSAPP: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20',
  FACEBOOK: 'bg-blue-500/10 text-blue-300 ring-blue-500/20',
  INSTAGRAM: 'bg-pink-500/10 text-pink-300 ring-pink-500/20',
};

function SummaryCard({ title, value, hint, icon: Icon, accentClass }) {
  return (
    <div className={`glass-card border p-5 ${accentClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-dark-muted">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-white">{value}</p>
          <p className="text-xs font-medium text-slate-400">{hint}</p>
        </div>
        <div className="rounded-2xl bg-dark-bg/70 p-3">
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function PlatformBadge({ platform }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${platformClasses[platform] || 'bg-slate-500/10 text-slate-300 ring-slate-500/20'}`}>
      {platformLabels[platform] || platform || 'غير محدد'}
    </span>
  );
}

function formatDateTime(value) {
  if (!value) return '';
  return format(parseISO(value), 'dd MMM yyyy - hh:mm a', { locale: ar });
}

const tabItems = [
  { id: 'OVERVIEW', label: 'الملف والحسابات' },
  { id: 'ACTIVITY', label: 'النشاط الأخير' },
  { id: 'PRESCRIPTION', label: 'صرف روشتة' },
];

export default function PatientsPage() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isDoctor = user.role === 'DOCTOR';

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPatients, setTotalPatients] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientDetails, setPatientDetails] = useState(null);
  const [patientDetailsLoading, setPatientDetailsLoading] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [modalTab, setModalTab] = useState('OVERVIEW');

  const [notesDraft, setNotesDraft] = useState('');
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [accountNotesDraft, setAccountNotesDraft] = useState('');
  const [accountBalanceDraft, setAccountBalanceDraft] = useState('0');
  const [groupNamesDraft, setGroupNamesDraft] = useState('');

  const [rxDiagnosis, setRxDiagnosis] = useState('');
  const [rxMedicines, setRxMedicines] = useState('');
  const [rxNotes, setRxNotes] = useState('');
  const [rxSending, setRxSending] = useState(false);

  const fetchPatients = async (currentPage = page, currentSearch = searchTerm) => {
    try {
      setLoading(true);
      const res = await api.get('/patients', {
        params: { page: currentPage, limit: 12, search: currentSearch || undefined },
      });
      setPatients(res.data.patients || []);
      setTotalPages(res.data.pagination?.pages || 1);
      setTotalPatients(res.data.pagination?.total || 0);
    } catch (error) {
      toast.error('فشل في تحميل المرضى');
    } finally {
      setLoading(false);
    }
  };

  const hydrateDrafts = (patient) => {
    setNotesDraft(patient?.notes || '');
    setDisplayNameDraft(patient?.displayName || '');
    setAccountNotesDraft(patient?.accountNotes || '');
    setAccountBalanceDraft(String(patient?.accountBalance || 0));
    setGroupNamesDraft((patient?.groups || []).map((item) => item.group?.name).filter(Boolean).join(', '));
  };

  const fetchPatientDetails = async (patientId) => {
    try {
      setPatientDetailsLoading(true);
      const res = await api.get(`/patients/${patientId}`);
      const patient = res.data.patient || null;
      setPatientDetails(patient);
      hydrateDrafts(patient);
    } catch (error) {
      toast.error('فشل في تحميل تفاصيل المريض');
    } finally {
      setPatientDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients(page, searchTerm);
  }, [page, searchTerm]);

  const openPatientModal = async (patient) => {
    setSelectedPatient(patient);
    setPatientDetails(null);
    setModalTab('OVERVIEW');
    setRxDiagnosis('');
    setRxMedicines('');
    setRxNotes('');
    await fetchPatientDetails(patient.id);
  };

  const closePatientModal = () => {
    setSelectedPatient(null);
    setPatientDetails(null);
    setModalTab('OVERVIEW');
    hydrateDrafts(null);
  };

  const handleSaveNotes = async () => {
    const activePatient = patientDetails || selectedPatient;
    if (!activePatient) return;

    try {
      setSavingNotes(true);
      const response = await api.put(`/patients/${activePatient.id}`, {
        displayName: displayNameDraft,
        notes: notesDraft,
        accountNotes: accountNotesDraft,
        accountBalance: accountBalanceDraft,
        groupNames: groupNamesDraft,
      });

      const updatedPatient = response.data.patient || {};
      toast.success('تم حفظ بيانات المريض');
      setPatientDetails((current) => (current ? { ...current, ...updatedPatient } : current));
      setPatients((current) =>
        current.map((patient) => (patient.id === activePatient.id ? { ...patient, ...updatedPatient } : patient))
      );
    } catch (error) {
      toast.error(error.message || 'فشل في حفظ بيانات المريض');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleCreatePrescription = async (event) => {
    event.preventDefault();
    const activePatient = patientDetails || selectedPatient;
    if (!activePatient) return;

    if (!rxDiagnosis.trim() || !rxMedicines.trim()) {
      toast.error('التشخيص والأدوية مطلوبان');
      return;
    }

    try {
      setRxSending(true);
      const res = await api.post('/prescriptions', {
        patientId: activePatient.id,
        diagnosis: rxDiagnosis,
        medicines: rxMedicines,
        notes: rxNotes,
      });

      const prescriptionId = res.data.prescription.id;
      await api.post(`/prescriptions/${prescriptionId}/send`);
      toast.success('تم حفظ الروشتة وإرسالها للمريض');

      setPatientDetails((current) =>
        current
          ? { ...current, prescriptions: [res.data.prescription, ...(current.prescriptions || [])] }
          : current
      );
      setRxDiagnosis('');
      setRxMedicines('');
      setRxNotes('');
    } catch (error) {
      toast.error(error.message || 'فشل في إنشاء أو إرسال الروشتة');
    } finally {
      setRxSending(false);
    }
  };

  const visiblePatientsAppointments = useMemo(
    () => patients.reduce((sum, patient) => sum + (patient._count?.appointments || 0), 0),
    [patients]
  );

  const visiblePatientsMessages = useMemo(
    () => patients.reduce((sum, patient) => sum + (patient._count?.messages || 0), 0),
    [patients]
  );

  const whatsappPatients = useMemo(
    () => patients.filter((patient) => patient.platform === 'WHATSAPP').length,
    [patients]
  );

  const activePatient = patientDetails || selectedPatient;
  const patientAppointments = patientDetails?.appointments || [];
  const patientMessages = patientDetails?.messages || [];
  const patientPrescriptions = patientDetails?.prescriptions || [];
  const displayPatientName = activePatient?.displayName || activePatient?.name || 'مريض بدون اسم';

  return (
    <AppLayout>
      <div className="flex h-full flex-col space-y-6 fade-in">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {isDoctor ? 'سجل المرضى والمتابعة' : 'سجل المرضى'}
            </h1>
            <p className="mt-1 text-sm text-dark-muted">
              عرض ملفات المرضى، الملاحظات الطبية، الحسابات، المجموعات، والروشتات من مكان واحد.
            </p>
          </div>

          <div className="relative w-full md:w-96">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-dark-muted" />
            <input
              type="text"
              placeholder="ابحث بالاسم أو رقم الهاتف..."
              value={searchTerm}
              onChange={(event) => {
                setPage(1);
                setSearchTerm(event.target.value);
              }}
              className="input-field border-dark-border bg-dark-card/80 pr-10 shadow-inner backdrop-blur-md"
            />
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="إجمالي المرضى" value={totalPatients} hint="حسب البحث الحالي" icon={Users} accentClass="border-primary-500/20" />
          <SummaryCard title="مواعيد الصفحة" value={visiblePatientsAppointments} hint="إجمالي النشاط المعروض" icon={Calendar} accentClass="border-emerald-500/20" />
          <SummaryCard title="رسائل الصفحة" value={visiblePatientsMessages} hint="إجمالي الرسائل المعروضة" icon={MessageSquare} accentClass="border-sky-500/20" />
          <SummaryCard title="مرضى واتساب" value={whatsappPatients} hint={`صفحة ${page} من ${totalPages}`} icon={Phone} accentClass="border-amber-500/20" />
        </section>

        <div className="flex-1">
          {loading && patients.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
            </div>
          ) : patients.length === 0 ? (
            <div className="glass-card flex flex-col items-center justify-center p-16 text-dark-muted">
              <Users className="mb-4 h-16 w-16 opacity-20" />
              <p className="text-lg">لا يوجد مرضى مطابقون للبحث</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {patients.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => openPatientModal(patient)}
                  className="glass-card group flex min-h-[260px] flex-col overflow-hidden text-right transition-colors hover:border-primary-500/40"
                >
                  <div className="flex items-start gap-4 border-b border-dark-border/50 bg-gradient-to-b from-dark-card to-dark-bg/30 p-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-600/50 bg-slate-700/50">
                      <UserRound className="h-6 w-6 text-slate-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <h3 className="truncate text-base font-bold leading-tight text-white">
                          {patient.displayName || patient.name || 'مريض بدون اسم'}
                        </h3>
                        <PlatformBadge platform={patient.platform} />
                      </div>
                      {patient.displayName && patient.name ? (
                        <p className="truncate text-xs text-slate-500">{patient.name}</p>
                      ) : null}
                      <p className="mt-1 flex items-center justify-end gap-1.5 text-xs font-medium tracking-wide text-dark-muted" dir="ltr">
                        {patient.phone || 'No phone'}
                        <Phone className="h-3 w-3" />
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 p-5">
                    <div className="mb-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-dark-border/40 bg-dark-bg/60 p-3">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-dark-muted">المواعيد</span>
                        <div className="flex items-center gap-1.5 text-lg font-bold text-white">
                          <Calendar className="h-4 w-4 text-emerald-400" />
                          {patient._count?.appointments || 0}
                        </div>
                      </div>
                      <div className="rounded-xl border border-dark-border/40 bg-dark-bg/60 p-3">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-dark-muted">الرسائل</span>
                        <div className="flex items-center gap-1.5 text-lg font-bold text-white">
                          <MessageSquare className="h-4 w-4 text-sky-400" />
                          {patient._count?.messages || 0}
                        </div>
                      </div>
                    </div>

                    {patient.groups?.length ? (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {patient.groups.slice(0, 3).map((item) => (
                          <span key={item.id} className="rounded-full bg-primary-500/10 px-2 py-1 text-[10px] font-bold text-primary-300">
                            {item.group?.name}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {patient.notes ? (
                      <p className="line-clamp-3 rounded-xl border border-primary-500/15 bg-primary-500/5 p-3 text-xs leading-6 text-slate-300">
                        {patient.notes}
                      </p>
                    ) : (
                      <div className="flex min-h-[72px] items-center justify-center rounded-xl border border-dark-border/40 bg-dark-bg/30 px-3 text-xs italic text-dark-muted">
                        لا توجد ملاحظات مسجلة
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-dark-border/50 bg-dark-bg/30 px-5 py-3 text-[11px] font-bold text-slate-400">
                    <span>فتح الملف</span>
                    <span>{patient.accountBalance ? `${Number(patient.accountBalance).toLocaleString('ar-IQ')} متبقي` : 'بدون رصيد'}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 ? (
          <div className="mt-8 flex justify-center">
            <div className="flex items-center gap-2 rounded-xl border border-dark-border bg-dark-card p-1.5 shadow-lg">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-dark-bg disabled:opacity-30"
              >
                السابق
              </button>
              <span className="px-4 text-sm text-slate-300">
                {page} من {totalPages}
              </span>
              <button
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-dark-bg disabled:opacity-30"
              >
                التالي
              </button>
            </div>
          </div>
        ) : null}

        {selectedPatient ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-bg/80 p-4 backdrop-blur-sm">
            <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-dark-border bg-dark-card shadow-2xl">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-dark-border bg-dark-bg/30 p-6">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-500 shadow-lg shadow-primary-500/20">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-xl font-bold text-white">{displayPatientName}</h2>
                      <PlatformBadge platform={activePatient?.platform || selectedPatient.platform} />
                    </div>
                    <p className="text-xs text-primary-300" dir="ltr">{activePatient?.phone || selectedPatient.phone}</p>
                  </div>
                </div>
                <button
                  onClick={closePatientModal}
                  className="rounded-lg border border-dark-border bg-dark-bg/50 p-2 text-dark-muted transition-colors hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="shrink-0 border-b border-dark-border bg-dark-bg/10 px-6">
                <div className="flex flex-wrap gap-1">
                  {tabItems.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setModalTab(tab.id)}
                      className={`border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
                        modalTab === tab.id
                          ? 'border-primary-500 text-primary-400'
                          : 'border-transparent text-dark-muted hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {patientDetailsLoading && !patientDetails ? (
                  <div className="flex h-64 items-center justify-center">
                    <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
                  </div>
                ) : modalTab === 'OVERVIEW' ? (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-4">
                      <SummaryCard title="المواعيد" value={patientAppointments.length || selectedPatient._count?.appointments || 0} hint="كل الحجوزات" icon={Calendar} accentClass="border-emerald-500/20" />
                      <SummaryCard title="الرسائل" value={patientMessages.length || selectedPatient._count?.messages || 0} hint="آخر 50 رسالة" icon={MessageSquare} accentClass="border-sky-500/20" />
                      <SummaryCard title="الروشتات" value={patientPrescriptions.length} hint="سجل العلاج" icon={Pill} accentClass="border-primary-500/20" />
                      <SummaryCard title="الرصيد" value={Number(accountBalanceDraft || 0).toLocaleString('ar-IQ')} hint="متبقي أو ملاحظة حسابية" icon={FileText} accentClass="border-amber-500/20" />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-300">اسم العرض داخل النظام</label>
                        <input value={displayNameDraft} onChange={(event) => setDisplayNameDraft(event.target.value)} className="input-field" placeholder={activePatient?.name || 'اسم مختصر'} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-300">مجموعات التسويق</label>
                        <input value={groupNamesDraft} onChange={(event) => setGroupNamesDraft(event.target.value)} className="input-field" placeholder="VIP, تقويم, تنظيف" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-300">الرصيد / المتبقي</label>
                        <input type="number" value={accountBalanceDraft} onChange={(event) => setAccountBalanceDraft(event.target.value)} className="input-field" placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-300">ملاحظات الحسابات</label>
                        <input value={accountNotesDraft} onChange={(event) => setAccountNotesDraft(event.target.value)} className="input-field" placeholder="خصم خاص، تقسيط، دفعة مقدمة..." />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-300">
                          <FileText className="h-4 w-4 text-primary-400" />
                          ملاحظات طبية وإدارية
                        </label>
                        <button onClick={handleSaveNotes} disabled={savingNotes} className="btn-secondary h-10 px-4 text-sm">
                          {savingNotes ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
                          حفظ
                        </button>
                      </div>
                      <textarea
                        value={notesDraft}
                        onChange={(event) => setNotesDraft(event.target.value)}
                        className="h-44 w-full resize-none rounded-xl border border-dark-border bg-dark-bg/80 p-4 text-sm leading-7 text-white shadow-inner focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                        placeholder="أضف ملاحظات الحالة أو تعليمات داخلية مهمة."
                      />
                    </div>
                  </div>
                ) : modalTab === 'ACTIVITY' ? (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-4">
                      <h3 className="flex items-center gap-2 font-bold text-white"><Calendar className="h-4 w-4 text-emerald-400" /> آخر المواعيد</h3>
                      {patientAppointments.length > 0 ? (
                        <div className="space-y-3">
                          {patientAppointments.slice(0, 10).map((appointment) => (
                            <div key={appointment.id} className="rounded-xl border border-dark-border bg-dark-bg/50 p-4">
                              <div className="mb-2 flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-bold text-white">{appointment.service?.nameAr || 'خدمة غير معروفة'}</p>
                                  <p className="mt-1 text-xs text-slate-400">{appointment.doctor?.name ? `د. ${appointment.doctor.name}` : 'بدون طبيب'}</p>
                                </div>
                                <span className="rounded-full bg-dark-bg px-2.5 py-1 text-[10px] font-bold text-slate-300">{appointment.status}</span>
                              </div>
                              <p className="text-xs text-slate-300" dir="ltr">{formatDateTime(appointment.scheduledTime)}</p>
                            </div>
                          ))}
                        </div>
                      ) : <EmptyState text="لا توجد مواعيد مسجلة لهذا المريض." />}
                    </div>

                    <div className="space-y-4">
                      <h3 className="flex items-center gap-2 font-bold text-white"><MessageSquare className="h-4 w-4 text-sky-400" /> آخر الرسائل</h3>
                      {patientMessages.length > 0 ? (
                        <div className="space-y-3">
                          {patientMessages.slice(0, 10).map((message) => (
                            <div key={message.id} className="rounded-xl border border-dark-border bg-dark-bg/50 p-4">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${message.type === 'OUTBOUND' ? 'bg-primary-500/10 text-primary-300' : 'bg-slate-700/70 text-slate-300'}`}>
                                  {message.type === 'OUTBOUND' ? 'صادر' : 'وارد'}
                                </span>
                                <span className="text-[10px] text-slate-500" dir="ltr">{formatDateTime(message.createdAt)}</span>
                              </div>
                              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{message.content}</p>
                            </div>
                          ))}
                        </div>
                      ) : <EmptyState text="لا توجد رسائل محفوظة لهذا المريض." />}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <form onSubmit={handleCreatePrescription} className="rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/20 to-dark-card p-5">
                      <div className="mb-5 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
                          <Pill className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">إصدار روشتة جديدة</h3>
                          <p className="text-xs text-slate-400">سيتم إرسالها لرقم <span dir="ltr" className="font-medium text-emerald-300">{activePatient?.phone || selectedPatient.phone}</span></p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Field label="التشخيص الطبي *">
                          <input value={rxDiagnosis} onChange={(event) => setRxDiagnosis(event.target.value)} className="input-field" placeholder="مثال: التهاب لثة حاد" required />
                        </Field>
                        <Field label="الأدوية والجرعات *">
                          <textarea value={rxMedicines} onChange={(event) => setRxMedicines(event.target.value)} className="h-32 w-full resize-none rounded-xl border border-dark-border bg-dark-bg/80 px-4 py-3 text-sm leading-relaxed text-white" dir="auto" placeholder={'Panadol 500mg - كل 8 ساعات\nAmoxil 500mg - كل 12 ساعة'} required />
                        </Field>
                        <Field label="ملاحظات إضافية">
                          <textarea value={rxNotes} onChange={(event) => setRxNotes(event.target.value)} className="h-20 w-full resize-none rounded-xl border border-dark-border bg-dark-bg/80 px-4 py-3 text-sm text-white" placeholder="تعليمات ما بعد الكشف أو تنبيهات للمريض" />
                        </Field>
                      </div>

                      <div className="mt-5 flex justify-end border-t border-dark-border/50 pt-4">
                        <button type="submit" disabled={rxSending} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                          {rxSending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Send className="h-4 w-4 rtl:-scale-x-100" />}
                          {rxSending ? 'جاري الإرسال...' : 'حفظ وإرسال للمريض'}
                        </button>
                      </div>
                    </form>

                    <div>
                      <h3 className="mb-3 flex items-center gap-2 font-bold text-white">
                        <ClipboardList className="h-4 w-4 text-emerald-400" />
                        سجل الروشتات السابقة
                        <span className="rounded-full bg-dark-bg px-2 py-0.5 text-[10px] font-bold text-slate-400">{patientPrescriptions.length}</span>
                      </h3>
                      {patientPrescriptions.length === 0 ? (
                        <EmptyState text="لم يتم صرف روشتات لهذا المريض بعد." />
                      ) : (
                        <div className="space-y-3">
                          {patientPrescriptions.map((rx) => {
                            const meds = Array.isArray(rx.medications) ? rx.medications.filter(Boolean).join(' - ') : '';
                            return (
                              <div key={rx.id} className="rounded-xl border border-dark-border bg-dark-bg/40 p-4">
                                <p className="text-sm font-bold text-white">{rx.diagnosis || 'بدون تشخيص'}</p>
                                <p className="mt-1 text-[10px] text-slate-500">{rx.createdAt ? formatDateTime(rx.createdAt) : ''}</p>
                                {meds ? <p className="mt-2 line-clamp-2 rounded-lg bg-dark-bg/60 px-3 py-2 text-xs leading-6 text-slate-300">{meds}</p> : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-xl border border-dark-border bg-dark-bg/40 p-6 text-center text-sm text-dark-muted">
      {text}
    </div>
  );
}
