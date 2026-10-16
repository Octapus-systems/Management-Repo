import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CalendarClock, Inbox, MessageSquareWarning, Receipt, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { LEG_STATUS, gbp, shortDateTime, timeOnly } from '@/lib/format';
import { Empty, ErrorState, PageHeader, PageLoader, Panel, StatusBadge } from '@/components/common';
import { cn } from '@/lib/utils';

function Tile({ label, value, to, icon: Icon, alert }) {
  return (
    <Link to={to} className={cn('rounded-2xl border bg-white p-4 shadow-sm transition hover:border-primary/40 hover:shadow', alert && value > 0 && 'border-primary/40 bg-orange-50/60')}>
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}<Icon className="h-4 w-4" /></div>
      <div className={cn('mt-2 font-heading text-3xl font-bold', alert && value > 0 ? 'text-primary' : 'text-ink')}>{value}</div>
    </Link>
  );
}

export default function Dashboard() {
  const { data: d, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/admin/dashboard'), refetchInterval: 30000 });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} />;
  const c = d.counts;
  const awaitingReview = (c.pending || 0) + (c.under_review || 0) + (c.change_requested || 0);
  return (
    <div className="space-y-6">
      <PageHeader title="Command Center" subtitle={new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label="To review" value={awaitingReview} to="/admin/bookings?status=pending,under_review,change_requested" icon={Inbox} alert />
        <Tile label="To confirm" value={c.quote_accepted || 0} to="/admin/bookings?status=quote_accepted" icon={CalendarClock} alert />
        <Tile label="To assign" value={d.unassigned.length} to="/admin/bookings?status=confirmed" icon={AlertTriangle} alert />
        <Tile label="Conflicts" value={d.conflicts.length} to="/admin/calendar" icon={AlertTriangle} alert />
        <Tile label="Unpaid jobs" value={d.unpaid} to="/admin/payments" icon={Receipt} alert />
        <Tile label="Access requests" value={d.pendingCustomers} to="/admin/customers" icon={UserPlus} alert />
      </div>

      {d.failedMessages > 0 && (
        <Link to="/admin/messages?failed=1" className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <MessageSquareWarning className="h-5 w-5" />
          <span><b>{d.failedMessages}</b> customer message deliveries in the last 48 hours were not delivered by WhatsApp/email. In-app copies were saved — follow up if needed.</span>
          <ArrowRight className="ml-auto h-4 w-4" />
        </Link>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Today's journeys" bodyClassName="p-0" actions={<Link to="/admin/calendar" className="text-sm font-semibold text-primary">Calendar</Link>}>
          {d.today.length === 0 ? <div className="p-5"><Empty icon={CalendarClock} title="No journeys today" /></div> : (
            <div className="divide-y">
              {d.today.map((l) => (
                <Link key={l.id} to={`/admin/bookings/${l.booking_id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-surface">
                  <div className="w-14 font-heading text-lg font-bold">{timeOnly(l.pickup_at)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{l.lead_passenger} <span className="font-normal text-muted-foreground">· {l.ref} · {l.label}</span></div>
                    <div className="truncate text-xs text-muted-foreground">{l.pickup} → {l.destination}</div>
                  </div>
                  <div className="hidden text-right text-xs sm:block">
                    <div className="font-semibold">{l.driver_name || l.operator_name || <span className="text-primary">Unassigned</span>}</div>
                    <div className="font-mono text-muted-foreground">{l.registration || ''}</div>
                  </div>
                  <span className="w-24 text-right text-xs font-semibold text-muted-foreground">{LEG_STATUS[l.status]}</span>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Needs a decision" bodyClassName="p-0">
          {d.attention.length === 0 ? <div className="p-5"><Empty icon={Inbox} title="All caught up" /></div> : (
            <div className="divide-y">
              {d.attention.map((b) => (
                <Link key={b.id} to={`/admin/bookings/${b.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{b.ref} · {b.customer_name}</div>
                    <div className="text-xs text-muted-foreground">Pickup {shortDateTime(b.first_pickup)}</div>
                  </div>
                  <StatusBadge status={b.status} admin />
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Confirmed, awaiting assignment" bodyClassName="p-0">
          {d.unassigned.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Every confirmed journey has a driver and vehicle.</p> : (
            <div className="divide-y">{d.unassigned.map((l) => (
              <Link key={l.id} to={`/admin/bookings/${l.booking_id}`} className="flex justify-between gap-3 px-5 py-3 text-sm hover:bg-surface">
                <span className="truncate"><b>{l.ref}</b> · {l.label} · {l.lead_passenger}</span><span className="shrink-0 text-muted-foreground">{shortDateTime(l.pickup_at)}</span>
              </Link>
            ))}</div>
          )}
        </Panel>
        <Panel title="Allocation conflicts" bodyClassName="p-0">
          {d.conflicts.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No overlapping driver or vehicle allocations.</p> : (
            <div className="divide-y">{d.conflicts.map((l) => (
              <Link key={l.id} to={`/admin/bookings/${l.booking_id}`} className="block px-5 py-3 text-sm hover:bg-surface">
                <div><b>{l.ref}</b> {l.label} · {shortDateTime(l.pickup_at)}</div>
                {l.conflicts.map((x) => <div key={x.leg_id} className="text-xs text-red-600">{x.reason} on {x.ref} ({shortDateTime(x.pickup_at)}){l.conflict_override_reason ? ' — overridden' : ''}</div>)}
              </Link>
            ))}</div>
          )}
        </Panel>
      </div>
      {d.overdueInvoices.n > 0 && <Link to="/admin/invoices" className="block rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><b>{d.overdueInvoices.n}</b> overdue invoice(s) totalling <b>{gbp(d.overdueInvoices.total)}</b>.</Link>}
    </div>
  );
}
