import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';

export default function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', role: 'STAFF' });
  const [saving, setSaving] = useState(false);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await api.get('/staff');
      setStaff(res.data.staff || res.data || []);
    } catch (error) {
      toast.error('فشل في تحميل الموظفين');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('الاسم والبريد مطلوبان');
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await api.put(`/staff/${editingId}`, formData);
        toast.success('تم تحديث الموظف');
      } else {
        await api.post('/staff', formData);
        toast.success('تم إضافة موظف');
      }
      setFormData({ name: '', email: '', phone: '', role: 'STAFF' });
      setEditingId(null);
      setShowForm(false);
      fetchStaff();
    } catch (error) {
      toast.error('فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('حذف هذا الموظف؟')) return;
    try {
      await api.delete(`/staff/${id}`);
      toast.success('تم حذف الموظف');
      fetchStaff();
    } catch (error) {
      toast.error('فشل الحذف');
    }
  };

  const roleLabels = { ADMIN: 'إدارة', DOCTOR: 'طبيب', STAFF: 'موظف' };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">👨‍⚕️ الموظفين</h1>
            <p className="text-sm text-gray-500 mt-1">إدارة فريق العمل</p>
          </div>
          <button
            onClick={() => {
              setFormData({ name: '', email: '', phone: '', role: 'STAFF' });
              setEditingId(null);
              setShowForm(true);
            }}
            className="px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            موظف جديد
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-600">الإجمالي</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{staff.length}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-600">أطباء</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{staff.filter((s) => s.role === 'DOCTOR').length}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-600">موظفين</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{staff.filter((s) => s.role === 'STAFF').length}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-600">إدارة</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{staff.filter((s) => s.role === 'ADMIN').length}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent"></div>
          </div>
        ) : staff.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
            <p className="text-gray-500">لا يوجد موظفين</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {staff.map((member) => (
              <div key={member.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{member.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{roleLabels[member.role]}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setFormData(member);
                        setEditingId(member.id);
                        setShowForm(true);
                      }}
                      className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(member.id)}
                      className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-sm text-gray-600">
                  {member.email && <p>✉️ {member.email}</p>}
                  {member.phone && <p dir="ltr">📱 {member.phone}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg border border-gray-200 shadow-2xl w-full max-w-md my-4">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? 'تعديل الموظف' : 'موظف جديد'}
                </h2>
                <button onClick={() => setShowForm(false)} className="text-gray-600 hover:text-gray-900">
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">الاسم</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">الهاتف</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">الدور</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="STAFF">موظف</option>
                    <option value="DOCTOR">طبيب</option>
                    <option value="ADMIN">إدارة</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition disabled:opacity-50"
                  >
                    حفظ
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    className="flex-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
