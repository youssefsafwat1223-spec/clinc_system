import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Send, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../api/client';
import { DataCard, Field, PrimaryButton, SecondaryButton, inputClass } from '../ui';
import TeethChart from '../teeth/TeethChart';

const emptyMedication = () => ({
  name: '',
  dosage: '',
  frequency: '',
  duration: '',
  timing: '',
  notes: '',
});

export default function PrescriptionForm({ initialPatientId = '', initialAppointmentId = '', onCreated }) {
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patientId, setPatientId] = useState(initialPatientId);
  const [appointmentId, setAppointmentId] = useState(initialAppointmentId);
  const [doctorId, setDoctorId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [medications, setMedications] = useState([emptyMedication()]);
  const [saving, setSaving] = useState(false);
  const [teethNotes, setTeethNotes] = useState({});

  useEffect(() => {
    setPatientId(initialPatientId || '');
    setAppointmentId(initialAppointmentId || '');
  }, [initialPatientId, initialAppointmentId]);

  useEffect(() => {
    if (!patientId) {
      setTeethNotes({});
      return;
    }
    api
      .get(`/patients/${patientId}`)
      .then((res) => setTeethNotes(res.data.patient?.teethNotes || {}))
      .catch(() => setTeethNotes({}));
  }, [patientId]);

  useEffect(() => {
    const loadBasics = async () => {
      try {
        const [patientsRes, doctorsRes] = await Promise.all([
          api.get('/patients', { params: { limit: 100 } }),
          api.get('/doctors'),
        ]);
        setPatients(patientsRes.data.patients || []);
        setDoctors(doctorsRes.data.doctors || []);
      } catch {
        toast.error('فشل تحميل بيانات الروشتة');
      }
    };
    loadBasics();
  }, []);

  const cleanMedications = useMemo(
    () => medications.filter((medication) => String(medication.name || '').trim()),
    [medications]
  );

  const updateMedication = (index, field, value) => {
    setMedications((current) =>
      current.map((medication, medicationIndex) =>
        medicationIndex === index ? { ...medication, [field]: value } : medication
      )
    );
  };

  const savePrescription = async (sendAfterSave = false) => {
    if ((!appointmentId && !patientId) || !diagnosis.trim() || cleanMedications.length === 0) {
      toast.warn('اختر المريض واكتب التشخيص ودواء واحد على الأقل');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/prescriptions', {
        appointmentId: appointmentId || undefined,
        patientId: appointmentId ? undefined : patientId,
        doctorId: doctorId || undefined,
        diagnosis,
        medications: cleanMedications,
        notes,
      });

      if (sendAfterSave) {
        await api.post(`/prescriptions/${res.data.prescription.id}/send`);
      }

      toast.success(sendAfterSave ? 'تم حفظ وإرسال الروشتة' : 'تم حفظ الروشتة');
      onCreated?.(res.data.prescription);
    } catch (error) {
      toast.error(error.message || 'فشل حفظ الروشتة');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DataCard className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="رقم الحجز">
          <input className={inputClass} value={appointmentId} onChange={(event) => setAppointmentId(event.target.value)} placeholder="اختياري" dir="ltr" />
        </Field>
        <Field label="المريض">
          <select className={inputClass} value={patientId} onChange={(event) => setPatientId(event.target.value)} disabled={Boolean(appointmentId || initialPatientId)}>
            <option value="">اختر المريض</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>{patient.displayName || patient.name} - {patient.phone}</option>
            ))}
          </select>
        </Field>
        <Field label="الطبيب">
          <select className={inputClass} value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
            <option value="">تلقائي / حسب الحجز</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>د. {doctor.name}</option>
            ))}
          </select>
        </Field>
        <Field label="التشخيص">
          <input className={inputClass} value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} />
        </Field>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-black text-white">الأدوية</h4>
          <SecondaryButton type="button" onClick={() => setMedications((current) => [...current, emptyMedication()])}>
            <Plus className="h-4 w-4" />
            إضافة دواء
          </SecondaryButton>
        </div>
        {medications.map((medication, index) => (
          <div key={index} className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 md:grid-cols-3">
            {['name', 'dosage', 'frequency', 'duration', 'timing', 'notes'].map((field) => (
              <input
                key={field}
                className={inputClass}
                value={medication[field]}
                onChange={(event) => updateMedication(index, field, event.target.value)}
                placeholder={field}
              />
            ))}
            <SecondaryButton type="button" onClick={() => setMedications((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
              <Trash2 className="h-4 w-4" />
              حذف
            </SecondaryButton>
          </div>
        ))}
      </div>

      <Field label="ملاحظات">
        <textarea className={inputClass} rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>

      <div className="flex flex-wrap gap-2">
        <PrimaryButton type="button" onClick={() => savePrescription(false)} disabled={saving}>
          <Save className="h-4 w-4" />
          حفظ الروشتة
        </PrimaryButton>
        <SecondaryButton type="button" onClick={() => savePrescription(true)} disabled={saving}>
          <Send className="h-4 w-4" />
          حفظ وإرسال
        </SecondaryButton>
      </div>

      {patientId ? (
        <div className="border-t border-white/10 pt-5">
          <h4 className="mb-3 text-base font-black text-white">ملاحظات الأسنان</h4>
          <TeethChart patientId={patientId} value={teethNotes} onSaved={setTeethNotes} />
        </div>
      ) : null}
    </DataCard>
  );
}
