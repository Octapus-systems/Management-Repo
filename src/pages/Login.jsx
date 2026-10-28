import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, ArrowRight, LayoutDashboard, CalendarClock, Receipt } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth, usePublicSettings } from '@/lib/auth';

/** Management-only sign-in. Customers and chauffeurs are turned away by the API. */
export default function Login() {
  const { user, signIn } = useAuth();
  const { data: s } = usePublicSettings();
  const nav = useNavigate();
  const loc = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user?.role === 'admin') return <Navigate to={loc.state?.from || '/admin'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api.post('/auth/login', { ...form, portal: 'management' });
      signIn(data);
      nav(loc.state?.from || '/admin', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = 'flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 shadow-sm transition focus-within:border-[#FF710F] focus-within:ring-4 focus-within:ring-[#FF710F]/15';

  return (
    <div className="grid min-h-screen bg-[#0b0b0c] lg:grid-cols-[1.15fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden lg:block">
        <img src="/images/welcome-1.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/60 to-black/30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_10%_100%,rgba(255,113,15,0.35),transparent_55%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <img src="/images/logo.svg" alt="Encore" className="h-11 w-11 object-contain" />
            <div className="leading-tight">
              <div className="font-heading text-lg font-bold tracking-[0.18em]">ENCORE</div>
              <div className="text-[10px] font-semibold tracking-[0.35em] text-orange-300">EXECUTIVE</div>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[#FF710F]">Management Command Center</div>
            <h1 className="mt-4 max-w-lg font-heading text-5xl font-bold leading-[1.05]">Every journey,<br />under your control.</h1>
            <p className="mt-5 max-w-md text-white/65">Review requests, send tailored quotations, confirm bookings, dispatch your fleet and reconcile payments — all in one place.</p>
            <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
              {[[LayoutDashboard, 'Live dashboard'], [CalendarClock, 'Dispatch & calendar'], [Receipt, 'Payments & invoices']].map(([I, t]) => (
                <div key={t} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                  <I className="h-5 w-5 text-[#FF710F]" />
                  <div className="mt-2 text-sm font-semibold">{t}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/40"><ShieldCheck className="h-4 w-4" />Authorised Encore staff only · All actions are recorded</div>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-col bg-[#F6F6F8]">
        <div className="flex items-center gap-3 bg-[#0b0b0c] px-6 py-5 lg:hidden">
          <img src="/images/logo.svg" alt="Encore" className="h-9 w-9 object-contain" />
          <div className="font-heading text-sm font-bold tracking-[0.18em] text-white">ENCORE · COMMAND CENTER</div>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800"><ShieldCheck className="h-3.5 w-3.5" />Management access</div>
            <h2 className="mt-4 font-heading text-3xl font-bold text-neutral-900">Sign in to the Command Center</h2>
            <p className="mt-2 text-sm text-neutral-500">Use your Encore management account.</p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-neutral-800">Work email</span>
                <div className={field}>
                  <Mail className="h-4 w-4 text-neutral-400" />
                  <input type="email" required autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@encoreexecutive.co.uk" className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-neutral-400" />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-neutral-800">Password</span>
                <div className={field}>
                  <Lock className="h-4 w-4 text-neutral-400" />
                  <input type={show ? 'text' : 'password'} required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-neutral-400" />
                  <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="text-neutral-400 hover:text-neutral-700">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
              </label>

              {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <button type="submit" disabled={busy} className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF710F] to-[#FF8F3A] font-semibold text-white shadow-[0_10px_24px_rgba(255,113,15,0.35)] transition hover:brightness-105 active:scale-[0.99] disabled:opacity-70">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Sign in<ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-neutral-500">
              Forgotten your password? Ask another Encore administrator to reset it{s?.dispatcher_phone ? ` or call ${s.dispatcher_phone}` : ''}.
            </p>
            <p className="mt-2 text-center text-xs text-neutral-400">Customers and chauffeurs: please use the Encore app.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
