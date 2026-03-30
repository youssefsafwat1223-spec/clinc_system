import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, Lock, Mail, ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);

      const res = await api.post('/auth/login', { email, password });
      
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      
      toast.success('تم تسجيل الدخول بنجاح');
      navigate('/');
    } catch (error) {
      toast.error(error.message || 'خطأ في تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary-900/20 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-900/10 blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 fade-in">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20 mb-4 animate-bounce-slow">
            <Stethoscope className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">عيادتي</h1>
          <p className="text-dark-muted font-medium">نظام الإدارة الذكي للعيادات</p>
        </div>

        <div className="glass-panel p-8 sm:p-10 rounded-2xl shadow-2xl border border-dark-border/50 relative overflow-hidden backdrop-blur-2xl">
          {/* Subtle gradient inside card */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary-500 to-transparent opacity-50"></div>
          
          <h2 className="text-2xl font-bold text-white mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">
            تسجيل الدخول للنظام
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 relative group">
              <label className="text-sm font-medium text-dark-muted group-focus-within:text-primary-400 transition-colors">البريد الإلكتروني</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-dark-muted group-focus-within:text-primary-400 transition-colors" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pr-10 bg-dark-bg/60 border-dark-border/60 focus:bg-dark-bg transition-all h-12"
                  placeholder="admin@clinic.com"
                  required
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2 relative group">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-dark-muted group-focus-within:text-primary-400 transition-colors">كلمة المرور</label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-dark-muted group-focus-within:text-primary-400 transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-10 bg-dark-bg/60 border-dark-border/60 focus:bg-dark-bg transition-all h-12"
                  placeholder="••••••••"
                  required
                  dir="ltr"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary h-12 text-lg mt-8 relative overflow-hidden group shadow-lg shadow-primary-500/25"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? 'جاري التحقق...' : 'دخول'}
                {!loading && <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />}
              </span>
              {/* Button shine effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg]"></div>
            </button>
          </form>
          
          <div className="mt-8 text-center border-t border-dark-border/40 pt-6">
            <p className="text-sm text-dark-muted mb-2">بيانات تجريبية</p>
            <div className="inline-flex gap-4 text-xs font-mono bg-dark-bg px-4 py-2 rounded-lg border border-dark-border/50 text-slate-300">
               <span>admin@clinic.com</span>
               <span className="opacity-50">/</span>
               <span>admin123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
