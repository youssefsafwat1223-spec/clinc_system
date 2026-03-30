import { useState } from 'react';
import api from '../api/client';
import AppLayout from '../components/Layout';
import { toast } from 'react-toastify';
import { Megaphone, Send, Users, Activity } from 'lucide-react';

export default function CampaignsPage() {
  const [broadcastType, setBroadcastType] = useState('TEXT');
  const [messageText, setMessageText] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [audience, setAudience] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  const handleSend = async (e) => {
    e.preventDefault();
    if (broadcastType === 'TEXT' && !messageText.trim()) return;
    if (broadcastType === 'TEMPLATE' && !templateName.trim()) return;

    if (!window.confirm('هل أنت متأكد من رغبتك في إرسال هذه الحملة الإعلانية؟ سيتم إرسالها فوراً لجميع المرضى المستهدفين.')) return;

    try {
      setLoading(true);
      setStats(null);
      const res = await api.post('/campaigns/broadcast', {
        platform: 'WHATSAPP', // currently WhatsApp only
        audience,
        broadcastType,
        messageText: broadcastType === 'TEXT' ? messageText : undefined,
        templateName: broadcastType === 'TEMPLATE' ? templateName : undefined,
        imageUrl: broadcastType === 'TEMPLATE' && imageUrl.trim() ? imageUrl : undefined
      });
      
      toast.success('تم الانتهاء من إرسال الحملة');
      setStats(res.data.summary);
      setMessageText('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'حدث خطأ أثناء الإرسال');
    } finally {
      setLoading(false);
    }
  };

  const insertVariable = (variable) => {
    setMessageText(prev => prev + variable);
  };

  return (
    <AppLayout>
      <div className="space-y-6 fade-in max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-primary-500" />
              الحملات الإعلانية
            </h1>
            <p className="text-dark-muted text-sm mt-1">إرسال العروض والتنبيهات للمرضى عبر الواتساب</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="md:col-span-2 space-y-6">
            <div className="glass-card p-6">
              <form onSubmit={handleSend} className="space-y-6">
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الجمهور المستهدف</label>
                  <select 
                    value={audience} 
                    onChange={e => setAudience(e.target.value)}
                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors appearance-none"
                  >
                    <option value="ALL">جميع المرضى (الواتس آب فقط)</option>
                    {/* Future expansion: <option value="RECENT">المرضى آخر 30 يوم</option> */}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">نوع الحملة</label>
                  <select 
                    value={broadcastType} 
                    onChange={e => setBroadcastType(e.target.value)}
                    className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors appearance-none mb-6"
                  >
                    <option value="TEXT">رسالة نصية عادية (فقط للمرضى النشطين في آخر 24 ساعة)</option>
                    <option value="TEMPLATE">رسالة قالب معتمد Template (تتضمن أزرار/صور وتصل للجميع)</option>
                  </select>
                </div>

                {broadcastType === 'TEXT' && (
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <label className="block text-sm font-medium text-slate-300">نص الرسالة الإعلانية</label>
                      <div className="flex gap-2">
                        <button 
                          type="button" 
                          onClick={() => insertVariable(' {{name}} ')}
                          className="text-[10px] font-bold bg-dark-bg border border-dark-border px-2 py-1 rounded text-primary-400 hover:bg-primary-900/30 transition-colors"
                        >
                          + اسم المريض
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={messageText}
                      onChange={e => setMessageText(e.target.value)}
                      placeholder="اكتب رسالتك هنا... مثال: بمناسبة شهر رمضان، خصم 20% لك يا {{name}} على الكشف!"
                      className="w-full h-48 bg-dark-bg border border-dark-border rounded-xl p-4 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors resize-none leading-relaxed"
                    ></textarea>
                  </div>
                )}

                {broadcastType === 'TEMPLATE' && (
                  <div className="space-y-4 fade-in">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">اسم قالب ميتا المعتمد (Template Name)</label>
                      <input
                        type="text"
                        value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                        placeholder="مثال: ramadan_offer_2024"
                        className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500"
                      />
                      <p className="text-xs text-dark-muted mt-2">يجب أن يكون الاسم مطابقاً تماماً للاسم المعتمد في منصة WhatsApp Manager.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">رابط صورة الإعلان (Header Image URL) - اختياري</label>
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={e => setImageUrl(e.target.value)}
                        placeholder="https://example.com/image.png"
                        className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500"
                      />
                      <p className="text-xs text-dark-muted mt-2">إذا كان القالب الخاص بك يحتوي على صورة (Header Image)، ضع رابط الصورة هنا.</p>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-dark-border flex justify-end">
                  <button 
                    type="submit" 
                    disabled={loading || (broadcastType === 'TEXT' ? !messageText.trim() : !templateName.trim())}
                    className="btn-primary px-8 py-3 rounded-xl flex items-center gap-2 font-bold text-lg disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>
                    ) : (
                      <Send className="w-5 h-5 rtl:-scale-x-100" />
                    )}
                    بدء الإرسال
                  </button>
                </div>
              </form>
            </div>

            {stats && (
              <div className="glass-card p-6 bg-emerald-900/10 border-emerald-500/20 flex items-start gap-4 fade-in">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Activity className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-emerald-400 mb-1">تقرير الإرسال</h3>
                  <p className="text-sm text-slate-300">{stats}</p>
                </div>
              </div>
            )}
          </div>

          {/* Guidelines Sidebar */}
          <div className="space-y-6">
            <div className="glass-card p-6 bg-gradient-to-b from-dark-bg/50 to-dark-card border-none ring-1 ring-dark-border">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-primary-400" />
                نصائح للإعلانات
              </h3>
              <ul className="space-y-4 text-sm text-slate-300">
                <li className="flex gap-2">
                  <span className="text-primary-500 font-bold">•</span>
                  <span>لإرسال صورة وزرار (رابط موقع)، يجب استخدام **رسالة القالب (Template)**.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary-500 font-bold">•</span>
                  <span>الرسائل النصية العادية تصل فقط للأشخاص الذين تواصلوا مع البوت خلال آخر 24 ساعة.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary-500 font-bold">•</span>
                  <span>قوالب ميتا تضمن وصول إعلانك لـ 100% من مرضاك بشكل رسمي وبدون حظر.</span>
                </li>
              </ul>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
