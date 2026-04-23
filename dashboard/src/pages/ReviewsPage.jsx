import { useEffect, useState } from 'react';
import { Star, MessageCircle, Users, TrendingUp, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';

const ratingLabels = { 5: 'ممتاز', 3: 'جيد', 1: 'ضعيف' };
const ratingColors = {
  5: 'text-emerald-400',
  3: 'text-amber-400',
  1: 'text-red-400',
};
const ratingBgColors = {
  5: 'bg-emerald-500/10 border-emerald-500/20',
  3: 'bg-amber-500/10 border-amber-500/20',
  1: 'bg-red-500/10 border-red-500/20',
};

function StarsDisplay({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`}
        />
      ))}
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, accent }) {
  return (
    <div className={`glass-card border p-5 ${accent}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-dark-muted">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-white">{value}</p>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className="rounded-2xl bg-dark-bg/70 p-3">
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [doctorFilter, setDoctorFilter] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (doctorFilter) params.doctorId = doctorFilter;

      const [reviewsRes, statsRes] = await Promise.all([
        api.get('/reviews', { params }),
        api.get('/reviews/stats'),
      ]);

      setReviews(reviewsRes.data.reviews || []);
      setStats(statsRes.data || null);
    } catch (error) {
      toast.error('فشل في تحميل التقييمات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [doctorFilter]);

  const avgDisplay = stats?.avgRating
    ? stats.avgRating.toFixed(1)
    : '—';

  return (
    <AppLayout>
      <div className="flex h-full flex-col space-y-6 fade-in">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">تقييمات المرضى</h1>
            <p className="mt-1 text-sm text-dark-muted">
              متابعة آراء المرضى وتقييماتهم لتحسين جودة الخدمة باستمرار.
            </p>
          </div>

          {stats?.doctorStats?.length > 0 && (
            <div className="relative">
              <Filter className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className="h-10 rounded-xl border border-dark-border bg-dark-card/80 pl-4 pr-10 text-sm text-white shadow-inner backdrop-blur-md focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">جميع الأطباء</option>
                {stats.doctorStats.map((d) => (
                  <option key={d.doctorId} value={d.doctorId}>
                    {d.doctorName} ({d.avg} ⭐)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="متوسط التقييم"
            value={`${avgDisplay} ⭐`}
            subtitle={`من ${stats?.totalReviews || 0} تقييم`}
            icon={Star}
            accent="border-amber-500/20"
          />
          <StatCard
            title="إجمالي التقييمات"
            value={stats?.totalReviews || 0}
            subtitle="تقييمات مكتملة"
            icon={MessageCircle}
            accent="border-emerald-500/20"
          />
          <StatCard
            title="في انتظار الرد"
            value={stats?.pendingCount || 0}
            subtitle="أُرسلت ولم يُردّ عليها"
            icon={Users}
            accent="border-sky-500/20"
          />
          <StatCard
            title="أفضل طبيب"
            value={stats?.doctorStats?.[0]?.doctorName?.replace(/^د\.\s*/, '') || '—'}
            subtitle={stats?.doctorStats?.[0] ? `${stats.doctorStats[0].avg} ⭐ (${stats.doctorStats[0].count} تقييم)` : ''}
            icon={TrendingUp}
            accent="border-primary-500/20"
          />
        </section>

        {/* Doctor Rating Breakdown */}
        {stats?.doctorStats?.length > 1 && (
          <div className="glass-card border border-dark-border p-5">
            <h2 className="mb-4 text-sm font-bold text-white">تقييم الأطباء</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {stats.doctorStats.map((d) => (
                <div key={d.doctorId} className="flex items-center justify-between rounded-xl border border-dark-border bg-dark-bg/40 p-4">
                  <div>
                    <p className="text-sm font-bold text-white">{d.doctorName}</p>
                    <p className="text-xs text-slate-400">{d.count} تقييم</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="text-lg font-bold text-white">{d.avg}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews List */}
        <div className="flex-1">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="glass-card flex flex-col items-center justify-center p-16 text-dark-muted">
              <Star className="mb-4 h-16 w-16 opacity-20" />
              <p className="text-lg">لا توجد تقييمات بعد</p>
              <p className="mt-2 text-sm">ستظهر التقييمات هنا بعد ردود المرضى على رسائل التقييم.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className={`rounded-xl border p-4 transition-colors hover:border-primary-500/20 ${ratingBgColors[review.rating] || 'bg-dark-bg/40 border-dark-border'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dark-bg/60">
                        <Star className={`h-5 w-5 ${ratingColors[review.rating] || 'text-slate-400'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white">{review.patient?.name || 'مريض'}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ratingColors[review.rating]}`}>
                            {ratingLabels[review.rating] || review.rating}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          د. {review.doctor?.name || 'غير محدد'}
                          {review.appointment?.service?.nameAr ? ` • ${review.appointment.service.nameAr}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <StarsDisplay rating={review.rating} />
                      <span className="text-[10px] text-slate-500">
                        {review.repliedAt
                          ? format(parseISO(review.repliedAt), 'dd MMM yyyy - hh:mm a', { locale: ar })
                          : ''}
                      </span>
                    </div>
                  </div>

                  {review.comment && (
                    <div className="mt-3 rounded-lg bg-dark-bg/40 p-3">
                      <p className="text-xs leading-6 text-slate-300">
                        <MessageCircle className="ml-1.5 inline-block h-3.5 w-3.5 text-primary-400" />
                        {review.comment}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
