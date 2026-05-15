import { useEffect, useMemo, useState } from 'react';
import { Star, MessageCircle, Users, TrendingUp, Filter, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'react-toastify';
import api from '../api/client';
import AppLayout from '../components/Layout';
import EmptyState from '../components/EmptyState';
import { DataCard, PageHeader, StatCard, inputClass } from '../components/ui';

const ratingLabels = { 5: 'ممتاز', 3: 'جيد', 1: 'ضعيف' };
const ratingColors = {
  5: 'text-emerald-400',
  3: 'text-amber-400',
  1: 'text-red-400',
};
const ratingBgColors = {
  5: 'bg-emerald-500/10 border-emerald-500/20',
  3: 'bg-amber-500/10 border-amber-500/20',
  1: 'bg-rose-500/10 border-rose-500/20',
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

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [doctorFilter, setDoctorFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

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

  const filteredReviews = useMemo(
    () =>
      reviews.filter((review) => {
        const term = searchTerm.trim().toLowerCase();
        const statusMatches =
          statusFilter === 'ALL' ||
          (statusFilter === 'EXCELLENT' && review.rating === 5) ||
          (statusFilter === 'GOOD' && review.rating === 3) ||
          (statusFilter === 'WEAK' && review.rating === 1) ||
          (statusFilter === 'WITH_COMMENT' && Boolean(review.comment));

        if (!statusMatches) return false;
        if (!term) return true;

        return [
          review.patient?.name,
          review.patient?.email,
          review.patient?.phone,
          review.doctor?.name,
          ratingLabels[review.rating],
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      }),
    [reviews, searchTerm, statusFilter]
  );

  const avgDisplay = stats?.avgRating ? stats.avgRating.toFixed(1) : '—';

  return (
    <AppLayout>
      <PageHeader
        title="تقييمات المرضى"
        description="متابعة آراء المرضى وتقييماتهم لتحسين جودة الخدمة باستمرار."
        actions={
          stats?.doctorStats?.length > 0 ? (
            <div className="relative">
              <Filter className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className={`${inputClass} h-10 pr-10`}
              >
                <option value="">جميع الأطباء</option>
                {stats.doctorStats.map((d) => (
                  <option key={d.doctorId} value={d.doctorId}>
                    {d.doctorName} ({d.avg} ⭐)
                  </option>
                ))}
              </select>
            </div>
          ) : null
        }
      />

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="متوسط التقييم"
          value={`${avgDisplay} ⭐`}
          hint={`من ${stats?.totalReviews || 0} تقييم`}
          icon={Star}
          tone="amber"
        />
        <StatCard
          title="إجمالي التقييمات"
          value={stats?.totalReviews || 0}
          hint="تقييمات مكتملة"
          icon={MessageCircle}
          tone="green"
        />
        <StatCard
          title="في انتظار الرد"
          value={stats?.pendingCount || 0}
          hint="أُرسلت ولم يُردّ عليها"
          icon={Users}
          tone="blue"
        />
        <StatCard
          title="أفضل طبيب"
          value={stats?.doctorStats?.[0]?.doctorName?.replace(/^د\.\s*/, '') || '—'}
          hint={
            stats?.doctorStats?.[0]
              ? `${stats.doctorStats[0].avg} ⭐ (${stats.doctorStats[0].count} تقييم)`
              : ''
          }
          icon={TrendingUp}
          tone="blue"
        />
      </section>

      <DataCard className="mb-6 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_120px]">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="بحث بالاسم أو البريد أو الهاتف..."
              className={`${inputClass} h-11 pr-10`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={`${inputClass} h-11`}
          >
            <option value="ALL">كل الحالات</option>
            <option value="EXCELLENT">ممتاز</option>
            <option value="GOOD">جيد</option>
            <option value="WEAK">ضعيف</option>
            <option value="WITH_COMMENT">به تعليق</option>
          </select>
          <div className="flex h-11 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sm font-bold text-sky-300">
            {filteredReviews.length} نتيجة
          </div>
        </div>
      </DataCard>

      {stats?.doctorStats?.length > 1 ? (
        <DataCard className="mb-6">
          <h2 className="mb-4 text-sm font-bold text-white">تقييم الأطباء</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {stats.doctorStats.map((d) => (
              <div
                key={d.doctorId}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
              >
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
        </DataCard>
      ) : null}

      {loading ? (
        <DataCard className="flex h-64 items-center justify-center">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
        </DataCard>
      ) : filteredReviews.length === 0 ? (
        <DataCard>
          <EmptyState
            icon={Star}
            title="لا توجد تقييمات بعد"
            description="ستظهر التقييمات هنا بعد ردود المرضى على رسائل التقييم."
          />
        </DataCard>
      ) : (
        <div className="space-y-3">
          {filteredReviews.map((review) => (
            <div
              key={review.id}
              className={`rounded-2xl border p-4 transition-colors hover:border-sky-500/20 ${
                ratingBgColors[review.rating] || 'border-white/10 bg-white/5'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0d1225]">
                    <Star className={`h-5 w-5 ${ratingColors[review.rating] || 'text-slate-400'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{review.patient?.name || 'مريض'}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ratingColors[review.rating]}`}
                      >
                        {ratingLabels[review.rating] || review.rating}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      د. {review.doctor?.name || 'غير محدد'}
                      {review.appointment?.service?.nameAr
                        ? ` • ${review.appointment.service.nameAr}`
                        : ''}
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

              {review.comment ? (
                <div className="mt-3 rounded-xl bg-[#0d1225] p-3">
                  <p className="text-xs leading-6 text-slate-300">
                    <MessageCircle className="ml-1.5 inline-block h-3.5 w-3.5 text-sky-400" />
                    {review.comment}
                  </p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
