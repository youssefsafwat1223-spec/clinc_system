import { useEffect, useState } from 'react';
import { CheckCircle, Clock, MessageSquare, Search, Send } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';

const statusLabels = {
  PENDING: 'قيد الانتظار',
  REPLIED: 'تم الرد',
  CLOSED: 'مغلقة',
};

const getPatientName = (consultation) =>
  consultation?.patientName || consultation?.patient?.displayName || consultation?.patient?.name || 'مريض غير معروف';

const getQuestionText = (consultation) =>
  consultation?.message || consultation?.question || consultation?.symptoms || consultation?.content || '';

export default function ConsultationsPage() {
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [replying, setReplying] = useState(false);

  const fetchConsultations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/consultations');
      const data = res.data || [];
      setConsultations(data);
      setSelectedInquiry((current) => {
        if (current && data.some((c) => c.id === current.id)) {
          return data.find((c) => c.id === current.id);
        }
        return data[0] || null;
      });
    } catch (error) {
      toast.error('فشل في تحميل الاستشارات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultations();
  }, []);

  const handleReply = async (e) => {
    e.preventDefault();
    if (!selectedInquiry || !replyText.trim()) return;

    try {
      setReplying(true);
      await api.post(`/consultations/${selectedInquiry.id}/reply`, {
        reply: replyText,
      });
      toast.success('تم إرسال الرد');
      setReplyText('');
      fetchConsultations();
    } catch (error) {
      toast.error('فشل إرسال الرد');
    } finally {
      setReplying(false);
    }
  };

  const filteredConsultations = consultations.filter((c) => {
    if (activeFilter !== 'ALL' && c.status !== activeFilter) return false;
    const haystack = `${getPatientName(c)} ${c.patient?.phone || ''} ${getQuestionText(c)}`.toLowerCase();
    if (searchTerm && !haystack.includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: consultations.length,
    pending: consultations.filter((c) => c.status === 'PENDING').length,
    replied: consultations.filter((c) => c.status === 'REPLIED').length,
    closed: consultations.filter((c) => c.status === 'CLOSED').length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 الاستشارات</h1>
          <p className="text-sm text-gray-500 mt-1">الرد على استشارات المرضى</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-600">الإجمالي</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-600">قيد الانتظار</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-600">مردود</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.replied}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-600">مغلقة</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.closed}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Consultations List */}
          <div className="lg:col-span-1 bg-white rounded-lg border border-gray-200 shadow-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <input
                type="text"
                placeholder="ابحث..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div className="flex gap-1 p-2 border-b border-gray-200 overflow-x-auto">
              {['ALL', 'PENDING', 'REPLIED', 'CLOSED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setActiveFilter(status)}
                  className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition ${
                    activeFilter === status
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status === 'ALL' ? 'الكل' : statusLabels[status]}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-200">
              {loading ? (
                <div className="flex justify-center items-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent"></div>
                </div>
              ) : filteredConsultations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                  <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">لا توجد استشارات</p>
                </div>
              ) : (
                filteredConsultations.map((consultation) => (
                  <button
                    key={consultation.id}
                    onClick={() => setSelectedInquiry(consultation)}
                    className={`w-full p-3 text-right transition hover:bg-gray-50 ${
                      selectedInquiry?.id === consultation.id ? 'bg-green-50 border-l-4 border-green-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-gray-900 text-sm">{getPatientName(consultation)}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        consultation.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-700'
                          : consultation.status === 'REPLIED'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}>
                        {statusLabels[consultation.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">{getQuestionText(consultation)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(parseISO(consultation.createdAt), 'dd MMM', { locale: ar })}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Consultation Details */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-md overflow-hidden flex flex-col">
            {selectedInquiry ? (
              <>
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold text-gray-900">{getPatientName(selectedInquiry)}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      selectedInquiry.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-700'
                        : selectedInquiry.status === 'REPLIED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                    }`}>
                      {statusLabels[selectedInquiry.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {format(parseISO(selectedInquiry.createdAt), 'dd MMM yyyy - hh:mm a', { locale: ar })}
                  </p>
                </div>

                <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                  <div className="space-y-4">
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <p className="text-sm font-medium text-gray-900 mb-2">السؤال:</p>
                      <p className="text-sm text-gray-700">{getQuestionText(selectedInquiry)}</p>
                    </div>

                    {selectedInquiry.reply && (
                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <p className="text-sm font-medium text-green-900 mb-2">الرد:</p>
                        <p className="text-sm text-green-800">{selectedInquiry.reply}</p>
                      </div>
                    )}
                  </div>
                </div>

                {selectedInquiry.status !== 'CLOSED' && (
                  <div className="p-4 border-t border-gray-200">
                    <form onSubmit={handleReply} className="space-y-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="أكتب الرد..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        rows="3"
                      />
                      <button
                        type="submit"
                        disabled={replying || !replyText.trim()}
                        className="w-full px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {replying ? 'جاري...' : <><Send className="h-4 w-4" /> إرسال</>}
                      </button>
                    </form>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">اختر استشارة من القائمة</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
