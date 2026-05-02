import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, BarChart3, Eye, LockKeyhole, LogOut, Shield, User, Users, X } from 'lucide-react';

function StatsPanel({ locale, stats, loading, onLogout }) {
  const isAr = locale === 'ar';

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.97, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#070b12] shadow-2xl"
    >
      <div className="flex flex-col gap-4 border-b border-white/5 bg-white/[0.02] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-red-500/10 text-red-500">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">
              {isAr ? 'لوحة تحكم الزوار' : 'Visitor Analytics'}
            </h1>
            <p className="text-xs text-slate-400">
              {isAr ? 'إحصائيات محمية للمدير' : 'Protected administrator analytics'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{isAr ? 'العودة للموقع' : 'Back to site'}</span>
          </a>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/15 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span>{isAr ? 'تسجيل الخروج' : 'Logout'}</span>
          </button>
        </div>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-slate-400">
                    {isAr ? 'زوار اليوم (فريد)' : 'Unique Visitors Today'}
                  </span>
                </div>
                <p className="mt-3 text-3xl font-bold text-white">{stats.todayVisitors}</p>
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
                <p className="mt-3 text-3xl font-bold text-white">{stats.todayViews}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
              <h3 className="mb-4 text-sm font-medium text-slate-400">
                {isAr ? 'إجمالي متراكم' : 'Persistent Totals'}
              </h3>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-12">
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

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
              <h3 className="mb-4 text-sm font-medium text-slate-400">
                {isAr ? 'الزوار الجدد المباشرين' : 'Recent Live Visitors'}
              </h3>
              <div className="max-h-72 overflow-y-auto pr-2">
                {stats.recentVisitors?.length ? (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-500">
                        <th className="pb-2 font-medium">IP</th>
                        <th className="pb-2 font-medium">Location</th>
                        <th className="pb-2 font-medium text-right">Device</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {stats.recentVisitors.map((visitor, index) => (
                        <tr key={`${visitor.ip}-${index}`} className="text-slate-300">
                          <td className="py-2.5 pr-4 font-mono text-[11px] text-slate-400">{visitor.ip}</td>
                          <td className="py-2.5 pr-4 max-w-[160px] truncate">
                            {visitor.location || 'Resolving...'}
                          </td>
                          <td className="py-2.5 text-right font-medium text-slate-100">{visitor.device}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs text-slate-500">
                    {isAr ? 'لا يوجد زوار مؤخراً' : 'No recent visitors.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}

function LoginPanel({ locale, username, password, error, submitting, onUsernameChange, onPasswordChange, onSubmit }) {
  const isAr = locale === 'ar';

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.97, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#070b12] shadow-2xl"
    >
      <div className="border-b border-white/5 bg-white/[0.02] px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-red-500/10 text-red-500">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">
              {isAr ? 'دخول المدير' : 'Admin Login'}
            </h1>
            <p className="text-xs text-slate-400">
              {isAr ? 'سجّل الدخول للوصول إلى لوحة التحليلات' : 'Sign in to access the analytics dashboard'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 px-6 py-6">
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
            {isAr ? 'اسم المستخدم' : 'Username'}
          </label>
          <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
            <User className="h-4 w-4 text-slate-500" />
            <input
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
              placeholder={isAr ? 'أدخل اسم المستخدم' : 'Enter username'}
              autoComplete="username"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
            {isAr ? 'كلمة المرور' : 'Password'}
          </label>
          <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
            <LockKeyhole className="h-4 w-4 text-slate-500" />
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
              placeholder={isAr ? 'أدخل كلمة المرور' : 'Enter password'}
              autoComplete="current-password"
            />
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{isAr ? 'العودة للموقع' : 'Back to site'}</span>
          </a>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Shield className="h-4 w-4" />
            <span>{submitting ? (isAr ? 'جارٍ الدخول...' : 'Signing in...') : (isAr ? 'دخول' : 'Login')}</span>
          </button>
        </div>
      </form>
    </motion.section>
  );
}

export default function AdminPage({ locale }) {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isAr = locale === 'ar';

  async function loadStats() {
    setLoadingStats(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/stats`);
      if (response.status === 401) {
        setAuthenticated(false);
        setStats(null);
        return;
      }

      if (!response.ok) {
        throw new Error(`Stats returned ${response.status}`);
      }

      const payload = await response.json();
      setStats(payload);
    } catch (loadError) {
      console.error('Failed to load admin stats', loadError);
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/admin/session`);
        const payload = await response.json();
        if (!active) {
          return;
        }

        const isAuthenticated = Boolean(payload.authenticated);
        setAuthenticated(isAuthenticated);
        setSessionChecked(true);

        if (isAuthenticated) {
          loadStats();
        }
      } catch (sessionError) {
        console.error('Failed to verify admin session', sessionError);
        if (!active) {
          return;
        }
        setAuthenticated(false);
        setSessionChecked(true);
      }
    }

    checkSession();
    return () => {
      active = false;
    };
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Login failed.');
      }

      setAuthenticated(true);
      setPassword('');
      await loadStats();
    } catch (loginError) {
      setAuthenticated(false);
      setError(loginError.message || (isAr ? 'فشل تسجيل الدخول' : 'Login failed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/admin/logout`, {
        method: 'POST',
      });
    } catch (logoutError) {
      console.error('Failed to logout', logoutError);
    }

    setAuthenticated(false);
    setStats(null);
    setUsername('');
    setPassword('');
    setError('');
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={authenticated ? 'admin-stats' : 'admin-login'}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-[#03060b] px-4 py-8 text-slate-100"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(circle at 14% 18%, rgba(239, 68, 68, 0.16), transparent 0 22%),
              radial-gradient(circle at 82% 12%, rgba(56, 189, 248, 0.08), transparent 0 18%),
              radial-gradient(circle at 50% 100%, rgba(255, 255, 255, 0.04), transparent 0 26%),
              #03060b
            `,
          }}
        />

        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
          {!sessionChecked ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-red-500" />
            </div>
          ) : authenticated ? (
            <StatsPanel locale={locale} stats={stats} loading={loadingStats} onLogout={handleLogout} />
          ) : (
            <LoginPanel
              locale={locale}
              username={username}
              password={password}
              error={error}
              submitting={submitting}
              onUsernameChange={setUsername}
              onPasswordChange={setPassword}
              onSubmit={handleLogin}
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
