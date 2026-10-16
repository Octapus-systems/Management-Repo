import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { STATUS, timeOnly } from '@/lib/format';
import { PageHeader, PageLoader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const toneBg = {
  amber: 'border-l-amber-400 bg-amber-50', blue: 'border-l-sky-400 bg-sky-50', green: 'border-l-emerald-500 bg-emerald-50',
  brand: 'border-l-primary bg-orange-50', dark: 'border-l-neutral-800 bg-neutral-100', grey: 'border-l-neutral-300 bg-neutral-50 opacity-60', red: 'border-l-red-400 bg-red-50 opacity-60',
};

function startOfWeek(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export default function Calendar() {
  const [start, setStart] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState('week');
  const end = new Date(start.getTime() + 7 * 86400000);
  const { data, isLoading } = useQuery({ queryKey: ['calendar', start.toISOString()], queryFn: () => api.get(`/admin/calendar?from=${start.toISOString()}&to=${end.toISOString()}`), refetchInterval: 30000 });
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86400000));
  const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  const byDriver = {};
  (data || []).forEach((l) => { const k = l.driver_name || (l.registration ? `External · ${l.registration}` : 'Unassigned'); (byDriver[k] ||= []).push(l); });

  const Item = ({ l }) => (
    <Link to={`/admin/bookings/${l.booking_id}`} className={cn('block rounded-lg border-l-4 px-2 py-1.5 text-xs shadow-sm transition hover:shadow', toneBg[STATUS[l.status]?.tone || 'grey'])}>
      <div className="font-bold">{timeOnly(l.pickup_at)} · {l.ref}</div>
      <div className="truncate">{l.lead_passenger}</div>
      <div className="truncate text-muted-foreground">{l.pickup}</div>
      <div className="mt-0.5 flex justify-between gap-1"><span className="truncate">{l.driver_name || <b className="text-primary">Unassigned</b>}</span><span className="font-mono">{l.registration}</span></div>
    </Link>
  );

  return (
    <div>
      <PageHeader title="Booking calendar" subtitle="All requests and confirmed journeys, by day or by driver."
        actions={(
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-border">{['week', 'driver'].map((v) => <button key={v} onClick={() => setView(v)} className={cn('rounded-full px-3 py-1 text-sm font-semibold capitalize', view === v ? 'bg-ink text-white' : 'text-muted-foreground')}>{v === 'week' ? 'By day' : 'By driver'}</button>)}</div>
            <Button variant="outline" size="icon" className="rounded-full" onClick={() => setStart(new Date(start.getTime() - 7 * 86400000))}><ChevronLeft /></Button>
            <Button variant="outline" className="rounded-full" onClick={() => setStart(startOfWeek(new Date()))}>This week</Button>
            <Button variant="outline" size="icon" className="rounded-full" onClick={() => setStart(new Date(start.getTime() + 7 * 86400000))}><ChevronRight /></Button>
          </div>
        )} />
      <div className="mb-3 text-sm font-semibold">{fmt.format(start)} – {fmt.format(new Date(end.getTime() - 1))}</div>
      {isLoading ? <PageLoader /> : view === 'week' ? (
        <div className="grid gap-2 md:grid-cols-7">
          {days.map((d) => {
            const items = data.filter((l) => new Date(l.pickup_at).toDateString() === d.toDateString());
            const today = d.toDateString() === new Date().toDateString();
            return (
              <div key={d.toISOString()} className={cn('min-h-[140px] rounded-2xl border bg-white p-2', today && 'ring-2 ring-primary')}>
                <div className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(d)} <span className="text-ink">{d.getDate()}</span></div>
                <div className="space-y-1.5">{items.map((l) => <Item key={l.id} l={l} />)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {Object.keys(byDriver).length === 0 && <p className="text-sm text-muted-foreground">No journeys this week.</p>}
          {Object.entries(byDriver).map(([name, items]) => (
            <div key={name} className="rounded-2xl border bg-white p-3">
              <div className="mb-2 text-sm font-semibold">{name} <span className="font-normal text-muted-foreground">· {items.length} journeys</span></div>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">{items.map((l) => <Item key={l.id} l={l} />)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
