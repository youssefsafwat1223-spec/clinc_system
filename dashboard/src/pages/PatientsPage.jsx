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
  return format(parseISO(value), 'dd MMM yyyy - hh:mm a', { locale: ar });
}

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

  const fetchPatientDetails = async (patientId) => {
    try {
      setPatientDetailsLoading(true);
      const res = await api.get(`/patients/${patientId}`);
      setPatientDetails(res.data.patient || null);
      setNotesDraft(res.data.patient?.notes || '');
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
    setNotesDraft('');
  };

  const handleSaveNotes = async () => {
    const activePatient = patientDetails || selectedPatient;
    if (!activePatient) {
      return;
    }

    try {
      setSavingNotes(true);
      await api.put(`/patients/${activePatient.id}`, { notes: notesDraft });
      toast.success('تم حفظ الملاحظات');
      setPatientDetails((current) => (current ? { ...current, notes: notesDraft } : current));
      setPatients((current) => current.map((patient) => (patient.id === activePatient.id ? { ...patient, notes: notesDraft } : patient)));
    } catch (error) {
      toast.error('فشل في حفظ الملاحظات');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleCreatePrescription = async (event) => {
    event.preventDefault();

    if (!rxDiagnosis.trim() || !rxMedicines.trim()) {
      toast.error('التشخيص والأدوية مطلوبان');
      return;
    }

    const activePatient = patientDetails || selectedPatient;
    if (!activePatient) {
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

      toast.success('تم حفظ الروشتة وإرسالها للمريض بنجاح');

      // Add to local history so it appears instantly
      if (res.data.prescription) {
        setPatientDetails((prev) => prev ? {
          ...prev,
          prescriptions: [res.data.prescription, ...(prev.prescriptions || [])],
        } : prev);
      }

      setRxDiagnosis('');
      setRxMedicines('');
      setRxNotes('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'فشل في إنشاء أو إرسال الروشتة');
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

  return (
    <AppLayout>
      <div className="flex h-full flex-col space-y-6 fade-in">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {isDoctor ? 'سجل المرضى والمتابعة' : 'سجل المرضى'}
            </h1>
            <p className="mt-1 text-sm text-dark-muted">
              {isDoctor
                ? 'واجهة أسرع لمراجعة المرضى، الملاحظات الطبية، وآخر المواعيد والرسائل لكل حالة.'
                : 'إدارة بيانات المرضى ومراجعة نشاطهم داخل النظام من مكان واحد.'}
            </p>
          </div>

          <div className="relative w-full md:w-96">
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <Search className="h-5 w-5 text-dark-muted" />
            </div>
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
          <SummaryCard
            title={isDoctor ? 'المرضى الظاهرون حاليًا' : 'إجمالي المرضى'}
            value={totalPatients}
            hint="حسب الفلتر الحالي ونتائج البحث"
            icon={Users}
            accentClass="border-primary-500/20"
          />
          <SummaryCard
            title="إجمالي المواعيد"
            value={visiblePatientsAppointments}
            hint="في الصفحة الحالية فقط"
            icon={Calendar}
            accentClass="border-emerald-500/20"
          />
          <SummaryCard
            title="إجمالي الرسائل"
            value={visiblePatientsMessages}
            hint="في الصفحة الحالية فقط"
            icon={MessageSquare}
            accentClass="border-sky-500/20"
          />
          <SummaryCard
            title="مرضى واتساب"
            value={whatsappPatients}
            hint={`صفحة ${page} من ${totalPages}`}
            icon={Phone}
            accentClass="border-amber-500/20"
          />
        </section>

        <div className="flex-1">
          {loading && patients.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></span>
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
                  className="glass-card group flex flex-col overflow-hidden text-right transition-colors hover:border-primary-500/40"
                >
                  <div className="flex items-start gap-4 border-b border-dark-border/50 bg-gradient-to-b from-dark-card to-dark-bg/30 p-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-600/50 bg-slate-700/50 shadow-inner transition-all group-hover:border-primary-500/30 group-hover:bg-primary-500/15">
                      <UserRound className="h-6 w-6 text-slate-300 transition-colors group-hover:text-primary-300" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <h3 className="truncate text-base font-bold leading-tight text-white">
                          {patient.name || 'مريض بدون اسم واضح'}
                        </h3>
                        <PlatformBadge platform={patient.platform} />
                      </div>

                      <p className="flex items-center justify-end gap-1.5 text-xs font-medium tracking-wide text-dark-muted" dir="ltr">
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

                    {patient.notes ? (
                      <div className="min-h-[78px] rounded-xl border border-primary-500/15 bg-primary-500/5 p-3 text-xs leading-6 text-slate-300">
                        {patient.notes}
                      </div>
                    ) : (
                      <div className="flex min-h-[78px] items-center justify-center rounded-xl border border-dark-border/40 bg-dark-bg/30 px-3 text-xs italic text-dark-muted">
                        لا توجد ملاحظات مسجلة
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-dark-border/50 bg-dark-bg/30 px-5 py-3 text-[11px] font-bold text-slate-400">
                    <span>فتح الملف</span>
                    <span>{patient._count?.appointments ? 'له نشاط سابق' : 'بدون مواعيد'}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <div className="flex items-center gap-2 rounded-xl border border-dark-border bg-dark-card p-1.5 shadow-lg">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-dark-bg disabled:opacity-30"
              >
                السابق
              </button>

              <div className="flex items-center gap-1 px-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary-500/30 bg-primary-500/20 font-bold text-primary-400">
                  {page}
                </span>
                <span className="mx-1 text-sm text-dark-muted">من</span>
                <span className="text-sm font-medium text-slate-300">{totalPages}</span>
              </div>

              <button
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-dark-bg disabled:opacity-30"
              >
                التالي
              </button>
            </div>
          </div>
        )}

        {selectedPatient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-bg/80 p-4 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-dark-border bg-dark-card shadow-2xl">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-dark-border bg-dark-bg/30 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500 shadow-lg shadow-primary-500/20">
                    <Users className="h-6 w-6 text-white" />
                  </div>

                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-white">{activePatient?.name || selectedPatient.name}</h2>
                      <PlatformBadge platform={activePatient?.platform || selectedPatient.platform} />
                    </div>
                    <p className="text-xs text-primary-300" dir="ltr">
                      {activePatient?.phone || selectedPatient.phone}
                    </p>
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
                  {[
                    { id: 'OVERVIEW', label: 'الملف والملاحظات' },
                    { id: 'ACTIVITY', label: 'النشاط الأخير' },
                    { id: 'PRESCRIPTION', label: 'صرف روشتة' },
                  ].map((tab) => (
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
                    <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></span>
                  </div>
                ) : modalTab === 'OVERVIEW' ? (
                  <div className="space-y-6 fade-in">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-xl border border-dark-border bg-dark-bg/50 p-4">
                        <span className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-dark-muted">
                          <Calendar className="h-3.5 w-3.5" />
                          المواعيد
                        </span>
                        <span className="text-2xl font-bold text-white">{patientAppointments.length || selectedPatient._count?.appointments || 0}</span>
                      </div>

                      <div className="rounded-xl border border-dark-border bg-dark-bg/50 p-4">
                        <span className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-dark-muted">
                          <MessageSquare className="h-3.5 w-3.5" />
                          الرسائل
                        </span>
                        <span className="text-2xl font-bold text-white">{patientMessages.length || selectedPatient._count?.messages || 0}</span>
                      </div>

                      <div className="rounded-xl border border-dark-border bg-dark-bg/50 p-4">
                        <span className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-dark-muted">
                          <Phone className="h-3.5 w-3.5" />
                          التواصل
                        </span>
                        <span className="text-sm font-bold text-white" dir="ltr">
                          {activePatient?.phone || selectedPatient.phone}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-300">
                          <FileText className="h-4 w-4 text-primary-400" />
                          ملاحظات طبية وإدارية
                        </label>
                        <button
                          onClick={handleSaveNotes}
                          disabled={savingNotes}
                          className="btn-secondary h-10 px-4 text-sm"
                        >
                          {savingNotes ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          حفظ
                        </button>
                      </div>

                      <textarea
                        value={notesDraft}
                        onChange={(event) => setNotesDraft(event.target.value)}
                        className="h-40 w-full resize-none rounded-xl border border-dark-border bg-dark-bg/80 p-4 text-sm leading-7 text-white shadow-inner transition-all focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                        placeholder="أضف ملاحظات حول الحالة، التاريخ الطبي، أو أي تعليمات داخلية مهمة."
                      />
                    </div>
                  </div>
                ) : modalTab === 'ACTIVITY' ? (
                  <div className="grid gap-6 lg:grid-cols-2 fade-in">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-emerald-400" />
                        <h3 className="font-bold text-white">آخر المواعيد</h3>
                      </div>

                      {patientAppointments.length > 0 ? (
                        <div className="space-y-3">
                          {patientAppointments.slice(0, 8).map((appointment) => (
                            <div key={appointment.id} className="rounded-xl border border-dark-border bg-dark-bg/50 p-4">
                              <div className="mb-2 flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-bold text-white">{appointment.service?.nameAr || 'خدمة غير معروفة'}</p>
                                  <p className="mt-1 text-xs text-slate-400">
                                    {appointment.doctor?.name ? `د. ${appointment.doctor.name}` : 'بدون طبيب'}
                                  </p>
                                </div>
                                <span className="rounded-full bg-dark-bg px-2.5 py-1 text-[10px] font-bold text-slate-300">
                                  {appointment.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300" dir="ltr">
                                {formatDateTime(appointment.scheduledTime)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dark-border bg-dark-bg/40 p-6 text-center text-sm text-dark-muted">
                          لا توجد مواعيد مسجلة لهذا المريض.
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-sky-400" />
                        <h3 className="font-bold text-white">آخر الرسائل</h3>
                      </div>

                      {patientMessages.length > 0 ? (
                        <div className="space-y-3">
                          {patientMessages.slice(0, 8).map((message) => (
                            <div key={message.id} className="rounded-xl border border-dark-border bg-dark-bg/50 p-4">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                    message.type === 'OUTBOUND'
                                      ? 'bg-primary-500/10 text-primary-300'
                                      : 'bg-slate-700/70 text-slate-300'
                                  }`}
                                >
                                  {message.type === 'OUTBOUND' ? 'صادر' : 'وارد'}
                                </span>
                                <span className="text-[10px] text-slate-500" dir="ltr">
                                  {formatDateTime(message.createdAt)}
                                </span>
                              </div>
                              <p className="text-sm leading-6 text-slate-300">{message.content}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dark-border bg-dark-bg/40 p-6 text-center text-sm text-dark-muted">
                          لا توجد رسائل محفوظة لهذا المريض.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 fade-in">
                    {/* ── New prescription form ── */}
                    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/20 to-dark-card p-5">
                      <div className="mb-5 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
                          <Pill className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">إصدار روشتة جديدة</h3>
                          <p className="text-xs text-slate-400">
                            سيتم إرسالها فوراً لرقم{' '}
                            <span dir="ltr" className="font-medium text-emerald-300">{activePatient?.phone || selectedPatient.phone}</span>
                          </p>
                        </div>
                      </div>

                      <form onSubmit={handleCreatePrescription} className="space-y-4">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">التشخيص الطبي *</label>
                          <input
                            type="text"
                            value={rxDiagnosis}
                            onChange={(event) => setRxDiagnosis(event.target.value)}
                            className="w-full rounded-xl border border-dark-border bg-dark-bg/80 px-4 py-3 text-sm text-white shadow-inner transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            placeholder="مثال: التهاب لثة حاد"
                            required
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">الأدوية والجرعات *</label>
                          <textarea
                            value={rxMedicines}
                            onChange={(event) => setRxMedicines(event.target.value)}
                            className="h-32 w-full resize-none rounded-xl border border-dark-border bg-dark-bg/80 px-4 py-3 text-sm leading-relaxed text-white shadow-inner transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            dir="auto"
                            placeholder={`Panadol Advance 500mg - 1 tablet every 8 hours\nAmoxil 500mg - 1 capsule every 12 hours`}
                            required
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">ملاحظات إضافية</label>
                          <textarea
                            value={rxNotes}
                            onChange={(event) => setRxNotes(event.target.value)}
                            className="h-20 w-full resize-none rounded-xl border border-dark-border bg-dark-bg/80 px-4 py-3 text-sm text-white shadow-inner transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            placeholder="تعليمات ما بعد الكشف أو تنبيهات للمريض"
                          />
                        </div>

                        <div className="flex justify-end border-t border-dark-border/50 pt-4">
                          <button
                            type="submit"
                            disabled={rxSending}
                            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-500 hover:shadow-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {rxSending ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                              <Send className="h-4 w-4 rtl:-scale-x-100" />
                            )}
                            {rxSending ? 'جاري الإرسال...' : 'حفظ وإرسال للمريض'}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* ── Prescription history ── */}
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-emerald-400" />
                        <h3 className="font-bold text-white">سجل الروشتات السابقة</h3>
                        <span className="rounded-full bg-dark-bg px-2 py-0.5 text-[10px] font-bold text-slate-400">{patientPrescriptions.length}</span>
                      </div>

                      {patientPrescriptions.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-dark-border bg-dark-bg/30 p-8 text-center">
                          <Pill className="mx-auto mb-3 h-8 w-8 text-dark-muted opacity-30" />
                          <p className="text-sm text-dark-muted">لم يتم صرف روشتات لهذا المريض بعد.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {patientPrescriptions.map((rx) => {
                            const meds = Array.isArray(rx.medications)
                              ? rx.medications.filter(Boolean).join(' • ')
                              : typeof rx.medications === 'string'
                                ? rx.medications
                                : '';

                            return (
                              <div key={rx.id} className="rounded-xl border border-dark-border bg-dark-bg/40 p-4 transition-colors hover:border-emerald-500/20">
                                <div className="mb-2 flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
                                      <FileText className="h-3.5 w-3.5 text-emerald-400" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-white">{rx.diagnosis || 'بدون تشخيص'}</p>
                                      <p className="text-[10px] text-slate-500">
                                        {rx.doctor?.name ? `د. ${rx.doctor.name}` : ''}
                                        {rx.doctor?.name && rx.createdAt ? ' • ' : ''}
                                        {rx.createdAt ? format(parseISO(rx.createdAt), 'dd MMM yyyy - hh:mm a', { locale: ar }) : ''}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {meds ? (
                                  <p className="mt-2 line-clamp-2 rounded-lg bg-dark-bg/60 px-3 py-2 text-xs leading-6 text-slate-300">{meds}</p>
                                ) : null}

                                {rx.notes ? (
                                  <p className="mt-2 text-xs italic text-slate-500">ملاحظات: {rx.notes}</p>
                                ) : null}
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
        )}
      </div>
    </AppLayout>
  );
}
