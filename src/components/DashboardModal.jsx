import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, Users, Eye, X } from 'lucide-react';

export default function DashboardModal({ onClose, locale }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/stats`)
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load stats', err);
        setLoading(false);
      });
  }, []);

  const isAr = locale === 'ar';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-md"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
        <motion.section
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#070b12] shadow-2xl"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 bg-white/[0.02] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-red-500/10 text-red-500">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {isAr ? 'لوحة تحكم الزوار' : 'Visitor Analytics'}
                </h2>
                <p className="text-xs text-slate-400">
                  {isAr ? 'إحصائيات مباشرة لزوار الموقع' : 'Real-time site traffic statistics'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="absolute sm:relative top-4 right-4 sm:top-0 sm:right-0 p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-red-500" />
              </div>
            ) : !stats ? (
              <div className="flex h-40 items-center justify-center text-sm text-slate-500">
                {isAr ? 'فشل تحميل البيانات' : 'Failed to load data'}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
                        <Users className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-medium text-slate-400">
                        {isAr ? 'زوار اليوم (فريد)' : 'Unique Visitors Today'}
                      </span>
                    </div>
                    <p className="mt-3 text-3xl font-bold text-white">
                      {stats.todayVisitors}
                    </p>
                  </div>
                  
                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
                        <Eye className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-medium text-slate-400">
                        {isAr ? 'مشاهدات اليوم' : 'Views Today'}
                      </span>
                    </div>
                    <p className="mt-3 text-3xl font-bold text-white">
                      {stats.todayViews}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                  <h3 className="mb-4 text-sm font-medium text-slate-400">
                    {isAr ? 'إجمالي منذ التحديث الأخير' : 'Total Since Last Backend Restart'}
                  </h3>
                  <div className="flex items-center gap-12">
                    <div>
                      <p className="text-xs text-slate-500">{isAr ? 'الزوار الفريدين' : 'Total Unique'}</p>
                      <p className="text-xl font-bold text-white">{stats.totalVisitors}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{isAr ? 'إجمالي المشاهدات' : 'Total Views'}</p>
                      <p className="text-xl font-bold text-white">{stats.totalViews}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
