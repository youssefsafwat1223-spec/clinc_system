import { useEffect, useMemo, useState } from 'react';
import { Calendar, FileText, MessageSquare, Phone, Save, Search, Users, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { useNavigate } from 'react-router-dom';

const formatMedicationLine = (medication, index) => {
  if (typeof medication === 'string') {
    return `${index + 1}. ${medication}`;
  }

  if (!medication || typeof medication !== 'object') {
    return null;
  }

  const parts = [
    medication.name,
    medication.dosage,
    medication.frequency,
    medication.interval,
    medication.duration,
    medication.timing,
  ].filter(Boolean);

  return `${index + 1}. ${parts.join(' - ')}${medication.notes ? ` (${medication.notes})` : ''}`;
};

const getPrescriptionMedications = (prescription) => {
  const medications = Array.isArray(prescription?.medications) ? prescription.medications : [];
  return medications.map(formatMedicationLine).filter(Boolean);
};

export default function PatientsPage() {
  const navigate = useNavigate();
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
    setAccountNotesDraft(patient?.accountingNotes || patient?.accountNotes || '');
    setAccountBalanceDraft(String(patient?.creditBalance ?? patient?.accountBalance ?? 0));
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

  const openPatientModal = (patient) => {
    navigate(`/patients/${patient.id}`);
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
        accountingNotes: accountNotesDraft,
        creditBalance: accountBalanceDraft,
      });

      const updatedPatient = response.data.patient || {};
      toast.success('تم حفظ بيانات المريض');
      setPatientDetails((current) => (current ? { ...current, ...updatedPatient } : current));
      setPatients((current) =>
        current.map((patient) => (patient.id === activePatient.id ? { ...patient, ...updatedPatient } : patient))
      );
    } catch (error) {
      toast.error('فشل في حفظ بيانات المريض');
    } finally {
      setSavingNotes(false);
    }
  };

  const activePatient = patientDetails || selectedPatient;
  const displayPatientName = activePatient?.displayName || activePatient?.name || 'مريض بدون اسم';

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">👥 المرضى</h1>
            <p className="text-sm text-gray-500 mt-1">إدارة ملفات المرضى والملاحظات</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="ابحث بالاسم أو الرقم..."
              value={searchTerm}
              onChange={(event) => {
                setPage(1);
                setSearchTerm(event.target.value);
              }}
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-600">إجمالي</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalPatients}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-600">الصفحة</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{page} من {totalPages}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-600">مواعيد</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {patients.reduce((sum, p) => sum + (p._count?.appointments || 0), 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-600">رسائل</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {patients.reduce((sum, p) => sum + (p._count?.messages || 0), 0)}
            </p>
          </div>
        </div>

        {/* Patients Grid */}
        {loading && patients.length === 0 ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent"></div>
          </div>
        ) : patients.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">لا يوجد مرضى</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => openPatientModal(patient)}
                className="bg-white rounded-lg border border-gray-200 hover:border-green-500 hover:shadow-md transition p-4 text-right"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{patient.displayName || patient.name || 'مريض'}</p>
                    <p className="text-xs text-gray-500 mt-0.5" dir="ltr">📱 {patient.phone || 'لا يوجد'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-blue-50 rounded p-2">
                    <p className="text-xs text-blue-600 font-medium">مواعيد</p>
                    <p className="text-lg font-bold text-blue-700 mt-0.5">{patient._count?.appointments || 0}</p>
                  </div>
                  <div className="bg-purple-50 rounded p-2">
                    <p className="text-xs text-purple-600 font-medium">رسائل</p>
                    <p className="text-lg font-bold text-purple-700 mt-0.5">{patient._count?.messages || 0}</p>
                  </div>
                </div>

                {patient.notes && (
                  <p className="text-xs text-gray-600 line-clamp-2 mb-2">{patient.notes}</p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <span className="text-xs text-gray-500">فتح الملف</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    patient.accountBalance && patient.accountBalance > 0
                      ? 'bg-green-100 text-green-700'
                      : patient.accountBalance && patient.accountBalance < 0
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}>
                    {patient.accountBalance ? `${Number(patient.accountBalance).toLocaleString()}` : 'بدون رصيد'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              السابق
            </button>
            <div className="px-4 py-2 flex items-center">
              <span className="text-sm text-gray-600">{page} من {totalPages}</span>
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              التالي
            </button>
          </div>
        )}

        {/* Patient Modal */}
        {selectedPatient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-auto">
            <div className="bg-white rounded-lg border border-gray-200 shadow-2xl w-full max-w-2xl my-4">
              {/* Modal Header */}
              <div className="flex items-center justify-between gap-4 border-b border-gray-200 p-6 bg-gray-50">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{displayPatientName}</h2>
                  <p className="text-xs text-gray-500 mt-1" dir="ltr">{activePatient?.phone}</p>
                </div>
                <button
                  onClick={closePatientModal}
                  className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="flex border-b border-gray-200">
                {[
                  { id: 'OVERVIEW', label: 'الملف' },
                  { id: 'PRESCRIPTIONS', label: `الروشتات (${patientDetails?.prescriptions?.length || 0})` },
                  { id: 'ACTIVITY', label: 'النشاط' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setModalTab(tab.id)}
                    className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition ${
                      modalTab === tab.id
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(100vh-300px)]">
                {patientDetailsLoading && !patientDetails ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent"></div>
                  </div>
                ) : modalTab === 'OVERVIEW' ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-600 font-medium">مواعيد</p>
                        <p className="text-2xl font-bold text-blue-700 mt-1">
                          {patientDetails?._count?.appointments || selectedPatient._count?.appointments || 0}
                        </p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3">
                        <p className="text-xs text-purple-600 font-medium">رسائل</p>
                        <p className="text-2xl font-bold text-purple-700 mt-1">
                          {patientDetails?._count?.messages || selectedPatient._count?.messages || 0}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">اسم العرض</label>
                        <input
                          value={displayNameDraft}
                          onChange={(e) => setDisplayNameDraft(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="اسم مختصر للعرض"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">الرصيد / المتبقي</label>
                        <input
                          type="number"
                          value={accountBalanceDraft}
                          onChange={(e) => setAccountBalanceDraft(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">ملاحظات الحسابات</label>
                        <input
                          value={accountNotesDraft}
                          onChange={(e) => setAccountNotesDraft(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="خصم، تقسيط، إلخ"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-900">ملاحظات طبية</label>
                          <button
                            onClick={handleSaveNotes}
                            disabled={savingNotes}
                            className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition disabled:opacity-50"
                          >
                            {savingNotes ? 'جاري...' : 'حفظ'}
                          </button>
                        </div>
                        <textarea
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          rows="4"
                          placeholder="ملاحظات طبية وإدارية"
                        />
                      </div>
                    </div>
                  </div>
                ) : modalTab === 'PRESCRIPTIONS' ? (
                  <div className="space-y-4">
                    {!patientDetails?.prescriptions?.length ? (
                      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
                        <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                        <p className="text-sm font-medium">لا توجد روشتات محفوظة لهذا المريض</p>
                      </div>
                    ) : (
                      patientDetails.prescriptions.map((prescription) => {
                        const medications = getPrescriptionMedications(prescription);
                        return (
                          <div key={prescription.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h3 className="font-bold text-gray-900">
                                  {prescription.diagnosis || 'تشخيص غير مسجل'}
                                </h3>
                                <p className="mt-1 text-xs text-gray-500">
                                  {prescription.doctor?.name || 'طبيب غير محدد'}
                                  {prescription.doctor?.specialization ? ` - ${prescription.doctor.specialization}` : ''}
                                </p>
                              </div>
                              <div className="text-left text-xs text-gray-500">
                                <p>{format(parseISO(prescription.createdAt), 'dd MMM yyyy - hh:mm a', { locale: ar })}</p>
                                {prescription.appointmentId && (
                                  <p className="mt-1 font-mono" dir="ltr">{prescription.appointmentId}</p>
                                )}
                              </div>
                            </div>

                            <div className="rounded-lg bg-gray-50 p-3">
                              <p className="mb-2 text-xs font-bold text-gray-700">الأدوية</p>
                              {medications.length > 0 ? (
                                <ul className="space-y-1 text-sm leading-6 text-gray-700">
                                  {medications.map((line) => (
                                    <li key={line}>{line}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-gray-500">لا توجد أدوية مسجلة.</p>
                              )}
                            </div>

                            {prescription.notes && (
                              <div className="mt-3 rounded-lg bg-amber-50 p-3">
                                <p className="mb-1 text-xs font-bold text-amber-800">ملاحظات</p>
                                <p className="text-sm leading-6 text-amber-900">{prescription.notes}</p>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">سجل النشاط</p>
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
