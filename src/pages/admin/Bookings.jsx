import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { JOURNEY_TYPES, gbp, shortDateTime } from '@/lib/format';
import { Empty, ErrorState, PageHeader, PageLoader, PaymentBadge, SelectInput, StatusBadge, TextInput } from '@/components/common';
import { cn } from '@/lib/utils';

const TABS = [
  { key: '', label: 'All' },
  { key: 'pending,under_review,clarification_needed,change_requested', label: 'Requests' },
  { key: 'quote_sent,quote_accepted', label: 'Quoted' },
  { key: 'confirmed', label: 'To assign' },
  { key: 'driver_assigned', label: 'Assigned' },
  { key: 'on_the_way,arrived,started', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'closed,rejected,cancelled_customer,cancelled_management,expired,no_show,quote_declined', label: 'Closed / ended' },
];

export default function Bookings() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [q, setQ] = useState(params.get('q') || '');
  const [sort, setSort] = useState('pickup');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [org, setOrg] = useState('');
  const [vehicle, setVehicle] = useState('');
  const qs = new URLSearchParams({ ...(status && { status }), ...(q && { q }), sort, ...(from && { from: new Date(from).toISOString() }), ...(to && { to: new Date(new Date(to).getTime() + 86400000).toISOString() }), ...(org && { organisation_id: org }), ...(vehicle && { vehicle_id: vehicle }) }).toString();
  const { data, isLoading, error } = useQuery({ queryKey: ['bookings', 'admin', qs], queryFn: () => api.get(`/bookings?${qs}`), refetchInterval: 30000 });
  const orgs = useQuery({ queryKey: ['organisations'], queryFn: () => api.get('/admin/organisations') });
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: () => api.get('/admin/vehicles') });
  const known = TABS.some((t) => t.key === status);

  return (
    <div>
      <PageHeader title="Bookings" subtitle="Search, filter and act on every request and journey." />
      <div className="mb-4 flex gap-1 overflow-x-auto no-scrollbar rounded-2xl bg-white p-1 shadow-sm ring-1 ring-border">
        {TABS.map((t) => (
          <button key={t.label} onClick={() => setParams(t.key ? { status: t.key } : {})} className={cn('shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold', status === t.key || (!known && !t.key && !status) ? 'bg-ink text-white' : 'text-muted-foreground hover:text-ink')}>{t.label}</button>
        ))}
      </div>
      <div className="mb-4 grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr]">
        <div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><TextInput className="pl-9" placeholder="Ref, passenger, customer, address" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="Pickup from" />
        <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} title="Pickup to" />
        <SelectInput value={org} onChange={(e) => setOrg(e.target.value)}><option value="">All organisations</option>{(orgs.data || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</SelectInput>
        <SelectInput value={vehicle} onChange={(e) => setVehicle(e.target.value)}><option value="">All vehicles</option>{(vehicles.data || []).map((v) => <option key={v.id} value={v.id}>{v.registration}</option>)}</SelectInput>
        <SelectInput value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="pickup">Pickup: soonest</option><option value="pickup_desc">Pickup: latest</option><option value="created">Newest requests</option><option value="status">Status</option><option value="customer">Customer</option>
        </SelectInput>
      </div>
      {!known && status && <p className="mb-3 text-sm text-muted-foreground">Filtered by status: {status.replace(/,/g, ', ').replace(/_/g, ' ')} · <button className="font-semibold text-primary" onClick={() => setParams({})}>clear</button></p>}

      {isLoading ? <PageLoader /> : error ? <ErrorState error={error} /> : data.length === 0 ? <Empty icon={ClipboardList} title="No bookings match" /> : (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3">Booking</th><th className="px-4 py-3">Pickup</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Route</th><th className="px-4 py-3">Allocation</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y">
                {data.map((b) => (
                  <tr key={b.id} className="cursor-pointer hover:bg-surface/60" onClick={() => nav(`/admin/bookings/${b.id}`)}>
                    <td className="px-4 py-3"><Link to={`/admin/bookings/${b.id}`} className="font-semibold text-ink" onClick={(e) => e.stopPropagation()}>{b.ref}</Link><div className="text-xs text-muted-foreground">{JOURNEY_TYPES[b.journey_type]}{b.is_return ? ' · return' : ''}</div></td>
                    <td className="whitespace-nowrap px-4 py-3">{shortDateTime(b.first_pickup)}</td>
                    <td className="px-4 py-3"><div className="font-medium">{b.customer_name}</div><div className="text-xs text-muted-foreground">{b.organisation_name || b.lead_passenger}</div></td>
                    <td className="max-w-[260px] px-4 py-3"><div className="truncate">{b.pickup}</div><div className="truncate text-xs text-muted-foreground">→ {b.destination}</div></td>
                    <td className="px-4 py-3 text-xs"><div>{b.drivers || '—'}</div><div className="font-mono text-muted-foreground">{b.vehicles || ''}</div></td>
                    <td className="whitespace-nowrap px-4 py-3"><div className="font-semibold">{b.total != null ? gbp(b.total) : '—'}</div>{b.total != null && <PaymentBadge status={b.payment_status} />}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} admin /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
