import { useLiveUpdates } from '@/lib/live';
import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Bell, Briefcase, Building2, CalendarDays, Car, ClipboardList, FileText, LayoutDashboard, LogOut, Menu, MessageSquare,
  Plus, Receipt, Settings, Users, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Logo, PageLoader } from '@/components/common';

/** Only signed-in management (admin) accounts get past this. */
export function RequireManagement() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!user || user.role !== 'admin') return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}

function useUnread() {
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => api.get('/account/notifications'), refetchInterval: 10000 });
  return (data || []).filter((n) => !n.read_at).length;
}

function Dot({ n }) {
  if (!n) return null;
  return <span className="absolute -right-1.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">{n > 9 ? '9+' : n}</span>;
}

const NAV = [
  { group: 'Operations', items: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/bookings', label: 'Bookings', icon: ClipboardList },
    { to: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
  ] },
  { group: 'Resources', items: [
    { to: '/admin/fleet', label: 'Fleet', icon: Car },
    { to: '/admin/drivers', label: 'Drivers', icon: Users },
    { to: '/admin/operators', label: 'External cover', icon: Briefcase },
  ] },
  { group: 'Customers & money', items: [
    { to: '/admin/customers', label: 'Customers', icon: Building2 },
    { to: '/admin/payments', label: 'Payments', icon: Receipt },
    { to: '/admin/invoices', label: 'Invoices', icon: FileText },
  ] },
  { group: 'Control', items: [
    { to: '/admin/messages', label: 'Notifications', icon: MessageSquare },
    { to: '/admin/activity', label: 'Activity history', icon: Activity },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ] },
];

const adminLink = (n) => `/admin/bookings/${n.booking_id}`;

export function ManagementLayout() {
  useLiveUpdates(adminLink);
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const unread = useUnread();
  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo dark />
        <button className="text-white/60 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      <div className="px-5 pb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Command Center</div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((g) => (
          <div key={g.group} className="mb-4">
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">{g.group}</div>
            {g.items.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)}
                className={({ isActive }) => cn('mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-white/65 transition hover:bg-white/5 hover:text-white', isActive && 'bg-primary text-white hover:bg-primary')}>
                <n.icon className="h-4 w-4" />{n.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="truncate text-sm font-semibold text-white">{user.name}</div>
        <div className="truncate text-xs text-white/50">{user.email}</div>
        <button onClick={signOut} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-white/60 hover:text-white"><LogOut className="h-3.5 w-3.5" />Sign out</button>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-ink lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-ink">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-white/90 px-4 backdrop-blur lg:px-8">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <div className="hidden text-sm text-muted-foreground lg:block">{loc.pathname.startsWith('/admin/bookings/') ? 'Booking' : ''}</div>
          <div className="flex items-center gap-2">
            <Link to="/admin/bookings/new" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"><Plus className="h-4 w-4" />New booking</Link>
            <Link to="/admin/inbox" className="relative rounded-full p-2 hover:bg-surface" title="Alerts"><Bell className="h-5 w-5" /><Dot n={unread} /></Link>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8"><div key={loc.pathname} className="page-enter"><Outlet /></div></main>
      </div>
    </div>
  );
}
