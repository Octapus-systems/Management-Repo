import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Ban, Baby, Briefcase, CheckCircle2, ClipboardCheck, CreditCard, Eye, History, Link2, Lock, MessageSquare, Pencil,
  Plus, Receipt, Send, Trash2, UserCheck, Users, XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  ACTIVITY_LABEL, BOOKING_STATUS_OPTIONS, JOURNEY_TYPES, LEG_STATUS, PAYMENT_ARRANGEMENT, PAYMENT_METHOD, PAYMENT_STATUS, STATUS, dateTime, gbp,
  driveTime, miles, shortDateTime, toLocalInput,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  Banner, ErrorState, Field, KV, Modal, PageLoader, PaymentBadge, Panel, Pill, PrimaryButton, SelectInput, StatusBadge, TextArea, TextInput,
  useAction,
} from '@/components/common';
import { BookingProgress, LegRoute, LegTimes, MessageThread } from '@/components/booking';
import { Button } from '@/components/ui/button';

const PRE = ['pending', 'under_review', 'clarification_needed', 'quote_sent', 'change_requested', 'quote_accepted'];
const ASSIGNABLE = ['confirmed', 'driver_assigned', 'on_the_way', 'arrived', 'started'];

export default function BookingDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['booking', id, 'admin'], queryFn: () => api.get(`/bookings/${id}`), refetchInterval: 20000 });
  const [modal, setModal] = useState(null);
  const set = (b) => { qc.setQueryData(['booking', id, 'admin'], b); ['bookings', 'dashboard', 'calendar', 'payments'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); };
  const useAct = (path, opts = {}) => useAction((body) => api.post(`/bookings/${id}${path}`, body), { ...opts, onSuccess: (b, v) => { set(b.booking || b); setModal(null); opts.onSuccess?.(b, v); } });

  const review = useAct('/review', { success: 'Marked as under review.' });
  const message = useAct('/messages');
  const confirm = useAct('/confirm', { success: 'Booking confirmed — customer notified.', onError: (e) => { if (e.body.code === 'needs_override') { setModal('confirm'); return true; } } });
  const reject = useAct('/reject', { success: 'Request rejected.' });
  const cancel = useAct('/cancel', { success: 'Booking cancelled.' });
  const close = useAct('/close', { success: 'Booking closed.', onError: (e) => { if (e.body.code === 'unpaid') { setModal('close-unpaid'); return true; } } });
  const override = useAct('/status', { success: 'Status updated.' });

  if (q.isLoading) return <PageLoader />;
  if (q.error) return <ErrorState error={q.error} />;
  const b = q.data;
  const isPre = PRE.includes(b.status);
  const accepted = b.quotes.find((x) => x.status === 'accepted');

  return (
    <div className="space-y-5">
      <Link to="/admin/bookings" className="text-sm font-semibold text-muted-foreground hover:text-ink">← Bookings</Link>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-bold">{b.ref}</h1>
              <StatusBadge status={b.status} admin className="text-sm" />
              <PaymentBadge status={b.payment_status} />
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {JOURNEY_TYPES[b.journey_type]} · {b.customer.name}{b.organisation ? ` (${b.organisation.name})` : ''} · {b.customer.phone} · requested {shortDateTime(b.created_at)}
              {b.created_by !== b.customer_id && <Pill tone="grey" className="ml-2">Created by staff</Pill>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {['pending', 'clarification_needed', 'change_requested'].includes(b.status) && <Button variant="outline" className="rounded-full" onClick={() => review.mutate({})}><Eye />Start review</Button>}
            {isPre && <Button variant="outline" className="rounded-full" onClick={() => setModal('clarify')}><MessageSquare />Ask customer</Button>}
            {isPre && <Button className="rounded-full" onClick={() => setModal('confirm')}><CheckCircle2 />Confirm booking</Button>}
            {(isPre || b.status === 'quote_declined') && <Button variant="outline" className="rounded-full text-red-600" onClick={() => setModal('reject')}><XCircle />Reject</Button>}
            {!isPre && !['closed', 'cancelled_customer', 'cancelled_management', 'rejected', 'quote_declined'].includes(b.status) && <Button variant="outline" className="rounded-full text-red-600" onClick={() => setModal('cancel')}><Ban />Cancel</Button>}
            {['completed', 'no_show', 'cancelled_customer', 'cancelled_management'].includes(b.status) && <Button className="rounded-full" onClick={() => close.mutate({})}><ClipboardCheck />Close &amp; reconcile</Button>}
            <Button variant="ghost" className="rounded-full" onClick={() => setModal('override')}>Override status</Button>
          </div>
        </div>
        <div className="mt-4"><BookingProgress status={b.status} /></div>
        {b.status === 'quote_accepted' && <Banner tone="blue" className="mt-4" icon={CheckCircle2} title="Customer accepted the quotation">Accepting does not confirm the booking. Check availability, then confirm.</Banner>}
        {b.status === 'change_requested' && <Banner tone="amber" className="mt-4" icon={MessageSquare} title="Customer requested a change">See their message below and issue a revised quotation.</Banner>}
        {b.status === 'clarification_needed' && <Banner tone="amber" className="mt-4" title="Waiting for the customer to reply to your clarification request." />}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          <FitPanel b={b} onEdit={() => setModal('edit')} />
          {b.legs.map((leg) => <LegPanel key={leg.id} b={b} leg={leg} onChange={set} />)}
          <Panel title="Messages with customer">
            <MessageThread messages={b.messages} viewerRole="admin" sending={message.isPending}
              onSend={(body, done) => message.mutate({ body }, { onSuccess: done })} placeholder="Message the customer (sent in-app and WhatsApp)…" />
          </Panel>
        </div>
        <div className="space-y-5">
          <QuotePanel b={b} onChange={set} />
          <PaymentPanel b={b} onChange={set} accepted={accepted} />
          <NotificationsPanel items={b.notifications} />
          <ActivityPanel items={b.activity} />
        </div>
      </div>

      <ClarifyModal open={modal === 'clarify'} onClose={() => setModal(null)} m={message} />
      <ConfirmModal open={modal === 'confirm'} onClose={() => setModal(null)} b={b} accepted={accepted} m={confirm} />
      <ReasonModal open={modal === 'reject'} onClose={() => setModal(null)} title="Reject this request?" label="Message to customer" cta="Reject request" danger m={reject} />
      <ReasonModal open={modal === 'cancel'} onClose={() => setModal(null)} title="Cancel this booking?" label="Reason (shared with customer and recorded)" cta="Cancel booking" danger required m={cancel}
        description="Management may cancel at any stage. The assigned driver is notified." />
      <Modal open={modal === 'close-unpaid'} onOpenChange={() => setModal(null)} title="Close with payment outstanding?" description={`Payment status is "${PAYMENT_STATUS[b.payment_status]?.label}". Closing records that the account was closed unpaid.`}
        footer={<PrimaryButton loading={close.isPending} onClick={() => close.mutate({ allow_unpaid: true })}>Close anyway</PrimaryButton>} />
      <OverrideModal open={modal === 'override'} onClose={() => setModal(null)} b={b} m={override} />
      {modal === 'edit' && <EditModal b={b} onClose={() => setModal(null)} onSaved={(nb) => { set(nb); setModal(null); }} />}
    </div>
  );
}

// ---------------- Fit check ----------------
function FitPanel({ b, onEdit }) {
  const bags = b.luggage_large + Math.ceil(b.luggage_small / 2);
  const advice = [];
  if (bags >= 3 && (!b.preferred_category || /saloon/i.test(b.preferred_category))) advice.push(`~${bags} cases may not fit a saloon — consider an MPV.`);
  if (b.passenger_count > 3 && (!b.preferred_category || /saloon/i.test(b.preferred_category))) advice.push(`${b.passenger_count} passengers need more than a saloon.`);
  if (b.child_seats) advice.push(`${b.child_seats} child seat(s) to be fitted.`);
  if (b.accessibility_needs) advice.push(`Accessibility: ${b.accessibility_needs}`);
  return (
    <Panel title="Request & service fit" actions={<Button size="sm" variant="ghost" onClick={onEdit}><Pencil />Edit</Button>}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KV label="Lead passenger">{b.lead_passenger}</KV>
        <KV label="Contact on day">{b.contact_phone}</KV>
        <KV label={<span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />Passengers</span>}>{b.passenger_count}</KV>
        <KV label={<span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" />Luggage</span>}>{b.luggage_large} large · {b.luggage_small} small</KV>
        <KV label={<span className="inline-flex items-center gap-1"><Baby className="h-3 w-3" />Child seats</span>}>{b.child_seats}</KV>
        <KV label="Preferred vehicle">{b.preferred_category || 'No preference'}</KV>
        {b.flight_number && <KV label="Flight">{b.flight_number}</KV>}
        {b.duration_hours && <KV label="Hours requested">{b.duration_hours}</KV>}
        {b.passenger_names && <KV label="Other passengers" className="col-span-2">{b.passenger_names}</KV>}
        {b.special_instructions && <KV label="Special instructions" className="col-span-2 md:col-span-4">{b.special_instructions}</KV>}
        {b.sensitive_notes && <KV label={<span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" />Sensitive (driver sees)</span>} className="col-span-2 md:col-span-4">{b.sensitive_notes}</KV>}
        {b.internal_notes && <KV label="Internal notes (management only)" className="col-span-2 md:col-span-4">{b.internal_notes}</KV>}
      </div>
      {advice.length > 0 && (
        <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <div className="mb-1 flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4" />Suitability check</div>
          <ul className="list-disc pl-5">{advice.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}
    </Panel>
  );
}

// ---------------- Route distance (Google Routes) ----------------
function RouteInfo({ b, leg, onChange }) {
  const recalc = useAction(() => api.post(`/bookings/${b.id}/routes`), { success: 'Route recalculated.', onSuccess: onChange });
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(leg.pickup)}&destination=${encodeURIComponent(leg.destination)}${leg.stops?.length ? `&waypoints=${encodeURIComponent(leg.stops.join('|'))}` : ''}`;
  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-surface px-3 py-2"><div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Distance</div><div className="text-sm font-semibold">{miles(leg.distance_m) || '—'}</div></div>
        <div className="rounded-xl bg-surface px-3 py-2"><div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Drive time</div><div className="text-sm font-semibold">{driveTime(leg.duration_s) || '—'}</div></div>
        <div className="rounded-xl bg-surface px-3 py-2"><div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">From base</div><div className="text-sm font-semibold">{miles(leg.base_distance_m) || '—'}{leg.base_duration_s ? <span className="font-normal text-muted-foreground"> · {driveTime(leg.base_duration_s)}</span> : null}</div></div>
      </div>
      {leg.route_error && <div className="text-xs text-amber-700">Route lookup: {leg.route_error}</div>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>Planned for conflicts: {leg.est_minutes ? `${leg.est_minutes} min` : 'default'}</span>
        <a className="font-semibold text-primary" target="_blank" rel="noreferrer" href={mapsUrl}>Open in Maps</a>
        <button type="button" className="font-semibold text-primary disabled:opacity-50" disabled={recalc.isPending} onClick={() => recalc.mutate()}>{recalc.isPending ? 'Calculating…' : 'Recalculate'}</button>
      </div>
    </div>
  );
}

// ---------------- Legs & assignment ----------------
function LegPanel({ b, leg, onChange }) {
  const [assign, setAssign] = useState(false);
  const [statusTo, setStatusTo] = useState('');
  const [reason, setReason] = useState('');
  const conflicts = b.conflicts.find((c) => c.leg_id === leg.id)?.items || [];
  const unassign = useAction(() => api.post(`/bookings/${b.id}/legs/${leg.id}/unassign`), { success: 'Assignment removed.', onSuccess: onChange });
  const status = useAction((body) => api.post(`/bookings/${b.id}/legs/${leg.id}/status`, body), { success: 'Leg status overridden.', onSuccess: (r) => { onChange(r.booking); setStatusTo(''); setReason(''); } });
  const canAssign = ASSIGNABLE.includes(b.status) && leg.status !== 'completed';
  return (
    <Panel title={`${leg.label} · ${dateTime(leg.pickup_at)}`} actions={<Pill tone={leg.status === 'unassigned' ? 'amber' : leg.status === 'completed' ? 'green' : 'brand'}>{LEG_STATUS[leg.status]}</Pill>}>
      <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
        <div>
          <LegRoute leg={leg} />
          <RouteInfo b={b} leg={leg} onChange={onChange} />
          <div className="mt-2"><LegTimes leg={leg} /></div>
        </div>
        <div className="rounded-xl bg-surface p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Allocation</div>
          {leg.status === 'unassigned' ? (
            <p className="mt-1 text-sm text-muted-foreground">{ASSIGNABLE.includes(b.status) ? 'Not yet assigned.' : 'Confirm the booking before assigning.'}</p>
          ) : leg.external_operator_id ? (
            <div className="mt-1 text-sm"><div className="font-semibold">External: {leg.operator_name}</div><div className="text-muted-foreground">{leg.external_driver_name || 'Driver TBC'} · <span className="font-mono">{leg.external_vehicle_reg || 'Reg TBC'}</span></div><div className="text-xs text-muted-foreground">{leg.operator_phone}</div></div>
          ) : (
            <div className="mt-1 text-sm"><div className="font-semibold">{leg.driver_name}</div><div className="text-muted-foreground">{leg.vehicle_make} {leg.vehicle_model} · <span className="font-mono font-semibold text-ink">{leg.vehicle_registration}</span></div><div className="text-xs text-muted-foreground">{leg.driver_phone}</div></div>
          )}
          {leg.conflict_override_reason && <div className="mt-2 text-xs text-amber-700">Conflict overridden: {leg.conflict_override_reason}</div>}
          {conflicts.length > 0 && <div className="mt-2 space-y-0.5">{conflicts.map((c) => <div key={c.leg_id} className="text-xs font-medium text-red-600"><AlertTriangle className="mr-1 inline h-3 w-3" />{c.reason} — {c.ref} {shortDateTime(c.pickup_at)}</div>)}</div>}
          <div className="mt-3 flex flex-wrap gap-2">
            {canAssign && <Button size="sm" className="rounded-full" onClick={() => setAssign(true)}><UserCheck />{leg.status === 'unassigned' ? 'Assign' : 'Reassign'}</Button>}
            {leg.status === 'assigned' && <Button size="sm" variant="ghost" className="rounded-full" onClick={() => unassign.mutate()}>Unassign</Button>}
          </div>
        </div>
      </div>
      {leg.status !== 'unassigned' && (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4">
          <Field label="Correct journey status" className="w-44"><SelectInput value={statusTo} onChange={(e) => setStatusTo(e.target.value)}><option value="">Choose…</option>{['assigned', 'on_the_way', 'arrived', 'started', 'completed'].filter((s) => s !== leg.status).map((s) => <option key={s} value={s}>{LEG_STATUS[s]}</option>)}</SelectInput></Field>
          <Field label="Reason" className="min-w-[200px] flex-1"><TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Driver phone offline — confirmed by call" /></Field>
          <Button variant="outline" className="h-11 rounded-xl" disabled={!statusTo} onClick={() => status.mutate({ status: statusTo, reason })}>Apply override</Button>
        </div>
      )}
      {assign && <AssignModal b={b} leg={leg} onClose={() => setAssign(false)} onSaved={(nb) => { onChange(nb); setAssign(false); }} />}
    </Panel>
  );
}

function AssignModal({ b, leg, onClose, onSaved }) {
  const opts = useQuery({ queryKey: ['assign-options', leg.id], queryFn: () => api.get(`/bookings/${b.id}/legs/${leg.id}/options`) });
  const [mode, setMode] = useState(leg.external_operator_id ? 'external' : 'fleet');
  const [driverId, setDriverId] = useState(leg.driver_id || '');
  const [vehicleId, setVehicleId] = useState(leg.vehicle_id || '');
  const [ext, setExt] = useState({ external_operator_id: leg.external_operator_id || '', external_vehicle_reg: leg.external_vehicle_reg || '', external_driver_name: leg.external_driver_name || '' });
  const [conflicts, setConflicts] = useState(null);
  const [override, setOverride] = useState('');
  const save = useAction((body) => api.post(`/bookings/${b.id}/legs/${leg.id}/assign`, body), {
    success: 'Assignment saved — driver and customer notified.',
    onSuccess: onSaved,
    onError: (e) => { if (e.body.code === 'assignment_conflict') { setConflicts(e.body.conflicts); return true; } },
  });
  const o = opts.data;
  const vehicle = o?.vehicles.find((v) => String(v.id) === String(vehicleId));
  const driver = o?.drivers.find((d) => String(d.id) === String(driverId));
  const submit = () => save.mutate(mode === 'fleet' ? { driver_id: Number(driverId), vehicle_id: Number(vehicleId), override_reason: override } : ext);
  return (
    <Modal open onOpenChange={onClose} wide title={`Assign ${leg.label.toLowerCase()} · ${shortDateTime(leg.pickup_at)}`} description={`${b.passenger_count} passengers · ${b.luggage_large} large / ${b.luggage_small} small cases${b.child_seats ? ` · ${b.child_seats} child seats` : ''}${b.preferred_category ? ` · prefers ${b.preferred_category}` : ''}`}
      footer={<PrimaryButton loading={save.isPending} disabled={mode === 'fleet' ? !(driverId && vehicleId) || (conflicts && !override.trim()) : !ext.external_operator_id} onClick={submit}>{conflicts ? 'Override and assign' : 'Save assignment'}</PrimaryButton>}>
      {!o ? <PageLoader /> : (
        <div className="space-y-4">
          <div className="inline-flex rounded-full bg-surface p-1">
            {[['fleet', 'Company fleet'], ['external', 'Trusted external cover']].map(([k, l]) => <button key={k} type="button" onClick={() => { setMode(k); setConflicts(null); }} className={cn('rounded-full px-4 py-1.5 text-sm font-semibold', mode === k ? 'bg-ink text-white' : 'text-muted-foreground')}>{l}</button>)}
          </div>
          {mode === 'fleet' ? (
            <>
              <div>
                <div className="mb-2 text-sm font-semibold">Vehicle</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {o.vehicles.map((v) => (
                    <button type="button" key={v.id} disabled={!v.assignable} onClick={() => { setVehicleId(v.id); setConflicts(null); }}
                      className={cn('rounded-xl border p-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-45', String(vehicleId) === String(v.id) ? 'border-primary ring-2 ring-primary/20' : 'hover:border-neutral-300')}>
                      <div className="flex justify-between gap-2"><span className="font-semibold">{v.make} {v.model}</span><span className="font-mono text-xs font-bold">{v.registration}</span></div>
                      <div className="text-xs text-muted-foreground">{v.category} · {v.seats} seats · {v.luggage_capacity} cases{!v.assignable ? ` · ${v.status}` : ''}</div>
                      {v.suitability.map((s) => <div key={s} className="mt-1 text-xs text-amber-700">⚠ {s}</div>)}
                      {v.conflicts.length > 0 && <div className="mt-1 text-xs font-medium text-red-600">Busy: {v.conflicts.map((c) => `${c.ref} ${shortDateTime(c.pickup_at)}`).join(', ')}</div>}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Driver">
                <SelectInput value={driverId} onChange={(e) => { setDriverId(e.target.value); setConflicts(null); }}>
                  <option value="">Choose a driver…</option>
                  {o.drivers.map((d) => <option key={d.id} value={d.id} disabled={!d.assignable}>{d.name}{!d.assignable ? ' — unavailable' : d.conflicts.length ? ` — busy (${d.conflicts.map((c) => c.ref).join(', ')})` : ''}</option>)}
                </SelectInput>
              </Field>
              {(vehicle?.conflicts.length > 0 || driver?.conflicts.length > 0) && !conflicts && <Banner tone="amber" icon={AlertTriangle}>This selection overlaps another journey. You will be asked to confirm an override.</Banner>}
              {conflicts && (
                <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2 font-semibold text-red-800"><AlertTriangle className="h-4 w-4" />Assignment conflict</div>
                  {conflicts.map((c) => <div key={c.leg_id} className="text-sm text-red-700">{c.reason} on <Link className="underline" to={`/admin/bookings/${c.booking_id}`}>{c.ref}</Link> ({c.label}, {shortDateTime(c.pickup_at)})</div>)}
                  <Field label="Authorised override reason (recorded)" required><TextInput value={override} onChange={(e) => setOverride(e.target.value)} placeholder="e.g. Previous job ends early — confirmed with driver" /></Field>
                </div>
              )}
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Operator" required className="sm:col-span-2">
                <SelectInput value={ext.external_operator_id} onChange={(e) => setExt({ ...ext, external_operator_id: e.target.value })}>
                  <option value="">Choose…</option>{o.operators.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </SelectInput>
              </Field>
              <Field label="Their vehicle registration" hint="Shown to the customer"><TextInput value={ext.external_vehicle_reg} onChange={(e) => setExt({ ...ext, external_vehicle_reg: e.target.value.toUpperCase() })} /></Field>
              <Field label="Their chauffeur's name"><TextInput value={ext.external_driver_name} onChange={(e) => setExt({ ...ext, external_driver_name: e.target.value })} /></Field>
              {!o.operators.length && <p className="text-sm text-muted-foreground sm:col-span-2">No operators recorded. Add one under External cover.</p>}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------------- Quotation ----------------
function QuotePanel({ b, onChange }) {
  const latest = b.quotes.find((x) => x.status !== 'superseded');
  const canQuote = PRE.includes(b.status);
  const [open, setOpen] = useState(false);
  const send = useAction((qid) => api.post(`/bookings/${b.id}/quotes/${qid}/send`), { success: 'Quotation sent to customer.', onSuccess: onChange });
  const tone = { draft: 'grey', sent: 'blue', change_requested: 'amber', accepted: 'green', declined: 'red', superseded: 'grey' };
  return (
    <Panel title="Quotation" actions={canQuote && <Button size="sm" className="rounded-full" onClick={() => setOpen(true)}><Plus />{b.quotes.length ? 'Revise' : 'Prepare quote'}</Button>}>
      {!b.quotes.length ? <p className="text-sm text-muted-foreground">No quotation yet. Review the request, then prepare a tailored price.</p> : (
        <div className="space-y-3">
          {b.quotes.map((x) => (
            <div key={x.id} className={cn('rounded-xl border p-3', x.status === 'superseded' && 'opacity-55')}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">v{x.version} · {gbp(x.total)}</div>
                <Pill tone={tone[x.status]}>{x.status.replace('_', ' ')}</Pill>
              </div>
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {x.reference_price != null && <div>Reference price {gbp(x.reference_price)}</div>}
                {x.extras.map((e, i) => <div key={i}>+ {e.label} {gbp(e.amount)}</div>)}
                <div>Customer sees: {x.customer_lines.map((l) => `${l.label} ${gbp(l.amount)}`).join(' · ')}</div>
                {x.internal_notes && <div className="text-amber-700">Internal: {x.internal_notes}</div>}
                {x.sent_at && <div>Sent {shortDateTime(x.sent_at)}{x.valid_until ? ` · valid until ${shortDateTime(x.valid_until)}` : ''}{x.valid_until && new Date(x.valid_until) < new Date() && x.status === 'sent' ? ' · PAST VALIDITY' : ''}</div>}
                {x.customer_response_note && <div className="text-ink">Customer: “{x.customer_response_note}”</div>}
              </div>
              {x.status === 'draft' && canQuote && <Button size="sm" className="mt-2 rounded-full" onClick={() => send.mutate(x.id)}><Send />Send to customer</Button>}
            </div>
          ))}
        </div>
      )}
      {open && <QuoteModal b={b} base={latest} onClose={() => setOpen(false)} onSaved={(nb) => { onChange(nb); setOpen(false); }} />}
    </Panel>
  );
}

function QuoteModal({ b, base, onClose, onSaved }) {
  const [ref, setRef] = useState(base?.reference_price ?? '');
  const [extras, setExtras] = useState(base?.extras?.length ? base.extras : []);
  const [total, setTotal] = useState(base?.total ?? '');
  const [lines, setLines] = useState(base?.customer_lines?.length ? base.customer_lines : [{ label: 'Chauffeur journey', amount: '' }]);
  const [msg, setMsg] = useState(base?.message_to_customer || '');
  const [notes, setNotes] = useState(base?.internal_notes || '');
  const computed = (Number(ref) || 0) + extras.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const finalTotal = total === '' ? computed : Number(total);
  const linesTotal = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const save = useAction((body) => api.post(`/bookings/${b.id}/quotes`, body), { success: (_d, v) => (v.send ? 'Quotation sent to customer.' : 'Draft saved.'), onSuccess: (r) => onSaved(r.booking) });
  const submit = (send) => save.mutate({ reference_price: ref, extras, total: finalTotal, customer_lines: lines.filter((l) => l.label), message_to_customer: msg, internal_notes: notes, send });
  const PRESETS = ['Extra pickup', 'Distance from base', 'Waiting time', 'Larger vehicle', 'Luggage / seating', 'Special requirement', 'Return leg'];
  return (
    <Modal open onOpenChange={onClose} wide title="Prepare quotation" description="Internal figures are never shown to the customer — they see only the lines and total you set below."
      footer={<><Button variant="outline" className="h-11 rounded-xl" disabled={save.isPending} onClick={() => submit(false)}>Save draft</Button><PrimaryButton loading={save.isPending} onClick={() => submit(true)}><Send className="h-4 w-4" />Send {gbp(finalTotal)}</PrimaryButton></>}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3 rounded-xl bg-surface p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Internal pricing</div>
          {b.legs.some((l) => l.distance_m || l.base_distance_m) && (
            <div className="space-y-1 rounded-lg bg-white px-3 py-2 text-xs">
              {b.legs.map((l) => (
                <div key={l.id} className="flex justify-between gap-2"><span className="text-muted-foreground">{l.label}</span><span className="font-semibold">{miles(l.distance_m) || '—'} · {driveTime(l.duration_s) || '—'}{l.base_distance_m ? ` · ${miles(l.base_distance_m)} from base` : ''}</span></div>
              ))}
              <div className="text-[10px] text-muted-foreground">Guide only — distance from Encore's base is a pricing factor, not a per-mile fare.</div>
            </div>
          )}
          <Field label="Reference price (optional)"><TextInput type="number" step="0.01" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Standard price for this route" /></Field>
          {extras.map((e, i) => (
            <div key={i} className="flex gap-2">
              <TextInput value={e.label} onChange={(ev) => setExtras(extras.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))} placeholder="Extra" />
              <TextInput className="w-28" type="number" step="0.01" value={e.amount} onChange={(ev) => setExtras(extras.map((x, j) => (j === i ? { ...x, amount: ev.target.value } : x)))} />
              <button type="button" onClick={() => setExtras(extras.filter((_, j) => j !== i))} className="px-1 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5">{PRESETS.map((p) => <button key={p} type="button" onClick={() => setExtras([...extras, { label: p, amount: '' }])} className="rounded-full border bg-white px-2.5 py-1 text-xs font-medium hover:border-primary">+ {p}</button>)}</div>
          <div className="flex justify-between border-t pt-2 text-sm"><span>Calculated</span><b>{gbp(computed)}</b></div>
          <Field label="Final price (manual override)" error={save.fields.total} hint="Leave blank to use the calculated figure"><TextInput type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} placeholder={computed.toFixed(2)} /></Field>
          <Field label="Internal notes"><TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What the customer sees</div>
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2">
              <TextInput value={l.label} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <TextInput className="w-28" type="number" step="0.01" value={l.amount} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
              {lines.length > 1 && <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="px-1 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>}
            </div>
          ))}
          <div className="flex gap-3">
            <button type="button" className="text-xs font-semibold text-primary" onClick={() => setLines([...lines, { label: '', amount: '' }])}>+ Add line</button>
            <button type="button" className="text-xs font-semibold text-primary" onClick={() => setLines([{ label: 'Chauffeur journey', amount: finalTotal }])}>Single line = total</button>
          </div>
          {Math.abs(linesTotal - finalTotal) > 0.009 && <Banner tone="amber">Customer lines add up to {gbp(linesTotal)} but the total is {gbp(finalTotal)}.</Banner>}
          <div className="flex justify-between rounded-xl bg-ink px-4 py-3 text-white"><span>Total quoted</span><b className="font-heading text-lg">{gbp(finalTotal)}</b></div>
          <Field label="Message to customer (optional)"><TextArea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="e.g. Includes meet-and-greet and 45 minutes' waiting." /></Field>
        </div>
      </div>
    </Modal>
  );
}

// ---------------- Payment ----------------
function PaymentPanel({ b, onChange, accepted }) {
  const [modal, setModal] = useState(null);
  const [link, setLink] = useState(b.payment_link || '');
  const [pay, setPay] = useState({ amount: accepted?.total ?? '', kind: 'payment', method: 'card_link', outcome: 'succeeded', reference: '', note: '' });
  const [ovr, setOvr] = useState({ payment_status: b.payment_status, reason: '' });
  const done = (nb) => { onChange(nb); setModal(null); };
  const linkM = useAction((body) => api.post(`/bookings/${b.id}/payment-link`, body), { success: 'Payment link saved and sent.', onSuccess: done });
  const payM = useAction((body) => api.post(`/bookings/${b.id}/payments`, body), { success: (_d, v) => (v.outcome === 'failed' ? 'Failed payment recorded — status unchanged.' : 'Payment recorded.'), onSuccess: done });
  const ovrM = useAction((body) => api.post(`/bookings/${b.id}/payment-status`, body), { success: 'Payment status updated.', onSuccess: done });
  const arrM = useAction((body) => api.patch(`/bookings/${b.id}`, body), { success: 'Arrangement updated.', onSuccess: onChange });
  const received = b.payments.filter((p) => p.outcome === 'succeeded').reduce((s, p) => s + (p.kind === 'refund' ? -p.amount : p.amount), 0);
  return (
    <Panel title="Payment" actions={<PaymentBadge status={b.payment_status} />}>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Agreed price</span><b>{b.agreed_total != null ? gbp(b.agreed_total) : '—'}</b></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Received</span><b>{gbp(received)}</b></div>
        <Field label="Arrangement"><SelectInput value={b.payment_arrangement} onChange={(e) => arrM.mutate({ payment_arrangement: e.target.value })}>{Object.entries(PAYMENT_ARRANGEMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectInput></Field>
        {b.invoice && <div className="flex justify-between"><span className="text-muted-foreground">Invoice</span><Link className="font-semibold text-primary" to={`/admin/invoices/${b.invoice.id}`}>{b.invoice.number} ({b.invoice.status})</Link></div>}
        {b.payment_link && <div className="truncate text-xs text-muted-foreground">Link: <a className="text-primary" href={b.payment_link} target="_blank" rel="noreferrer">{b.payment_link}</a></div>}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" className="rounded-full" onClick={() => setModal('pay')}><Receipt />Record payment</Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setModal('link')}><Link2 />Payment link</Button>
          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setModal('override')}>Override</Button>
        </div>
        {b.payments.length > 0 && (
          <div className="divide-y rounded-xl border">
            {b.payments.map((p) => (
              <div key={p.id} className="flex justify-between gap-2 px-3 py-2 text-xs">
                <div><div className="font-semibold">{p.kind} · {PAYMENT_METHOD[p.method]}{p.outcome === 'failed' && <span className="ml-1 text-red-600">FAILED</span>}</div><div className="text-muted-foreground">{shortDateTime(p.created_at)} · {p.recorded_by_name}{p.reference ? ` · ${p.reference}` : ''}</div></div>
                <b className={cn(p.outcome === 'failed' && 'text-red-600 line-through')}>{gbp(p.amount)}</b>
              </div>
            ))}
          </div>
        )}
      </div>
      <Modal open={modal === 'link'} onOpenChange={() => setModal(null)} title="Send payment link" description="Paste the secure link from your payment provider (e.g. SumUp or Revolut). Card details are handled only by the provider."
        footer={<PrimaryButton loading={linkM.isPending} onClick={() => linkM.mutate({ url: link })}><CreditCard className="h-4 w-4" />Save & notify customer</PrimaryButton>}>
        <TextInput value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://pay.sumup.com/…" />
      </Modal>
      <Modal open={modal === 'pay'} onOpenChange={() => setModal(null)} title="Record a payment" description="Use for card-link results, cash, bank transfer or any external payment."
        footer={<PrimaryButton loading={payM.isPending} onClick={() => payM.mutate(pay)}>Record</PrimaryButton>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount (£)" error={payM.fields.amount}><TextInput type="number" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
          <Field label="Type"><SelectInput value={pay.kind} onChange={(e) => setPay({ ...pay, kind: e.target.value })}><option value="payment">Payment</option><option value="deposit">Deposit</option><option value="refund">Refund</option></SelectInput></Field>
          <Field label="Method"><SelectInput value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{Object.entries(PAYMENT_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectInput></Field>
          <Field label="Outcome"><SelectInput value={pay.outcome} onChange={(e) => setPay({ ...pay, outcome: e.target.value })}><option value="succeeded">Succeeded</option><option value="failed">Failed (stays unpaid)</option></SelectInput></Field>
          <Field label="Reference"><TextInput value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field>
          <Field label="Note"><TextInput value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></Field>
        </div>
      </Modal>
      <Modal open={modal === 'override'} onOpenChange={() => setModal(null)} title="Override payment status"
        footer={<PrimaryButton loading={ovrM.isPending} onClick={() => ovrM.mutate(ovr)}>Apply</PrimaryButton>}>
        <div className="space-y-3">
          <SelectInput value={ovr.payment_status} onChange={(e) => setOvr({ ...ovr, payment_status: e.target.value })}>{Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</SelectInput>
          <Field label="Reason (recorded)"><TextInput value={ovr.reason} onChange={(e) => setOvr({ ...ovr, reason: e.target.value })} /></Field>
        </div>
      </Modal>
    </Panel>
  );
}

// ---------------- Notifications & activity ----------------
const DELIVERY_TONE = { delivered: 'green', sent: 'blue', failed: 'red', not_configured: 'amber', skipped: 'grey' };
export function DeliveryChips({ deliveries }) {
  return <div className="flex flex-wrap gap-1">{deliveries.map((d, i) => <Pill key={i} tone={DELIVERY_TONE[d.status]} className="text-[10px]" >{d.channel.replace('_', '-')}: {d.status.replace('_', ' ')}</Pill>)}</div>;
}

function NotificationsPanel({ items }) {
  return (
    <Panel title="Messages sent" bodyClassName="p-0">
      {!items.length ? <p className="p-5 text-sm text-muted-foreground">None yet.</p> : (
        <div className="max-h-80 divide-y overflow-y-auto">
          {items.map((n) => (
            <div key={n.id} className="px-5 py-2.5">
              <div className="flex justify-between gap-2 text-sm"><span className="truncate font-medium">{n.title}</span><span className="shrink-0 text-xs text-muted-foreground">{shortDateTime(n.created_at)}</span></div>
              <div className="mb-1 text-xs text-muted-foreground">To {n.recipient}</div>
              <DeliveryChips deliveries={n.deliveries} />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ActivityPanel({ items }) {
  return (
    <Panel title={<span className="inline-flex items-center gap-2"><History className="h-4 w-4" />Activity history</span>} bodyClassName="p-0">
      <div className="max-h-96 divide-y overflow-y-auto">
        {items.map((a) => (
          <div key={a.id} className="px-5 py-2.5 text-sm">
            <div className="flex justify-between gap-2"><span className="font-medium capitalize">{ACTIVITY_LABEL(a.action)}</span><span className="shrink-0 text-xs text-muted-foreground">{shortDateTime(a.created_at)}</span></div>
            <div className="text-xs text-muted-foreground">{a.actor_name ? `${a.actor_name} (${a.actor_role})` : 'System'}</div>
            {a.detail && <ActivityDetail detail={a.detail} />}
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function ActivityDetail({ detail }) {
  let d;
  try { d = JSON.parse(detail); } catch { return <div className="text-xs text-muted-foreground">{detail}</div>; }
  if (!d || typeof d !== 'object') return null;
  const fmt = (v) => (v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v).replace(/_/g, ' '));
  return (
    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
      {Object.entries(d).filter(([, v]) => v !== null && v !== undefined).slice(0, 8).map(([k, v]) => (
        <div key={k} className="truncate"><span className="font-medium text-ink/70">{k.replace(/_/g, ' ')}:</span> {v && typeof v === 'object' && 'from' in v ? `${fmt(v.from)} → ${fmt(v.to)}` : fmt(v)}</div>
      ))}
    </div>
  );
}

// ---------------- Modals ----------------
function ClarifyModal({ open, onClose, m }) {
  const [text, setText] = useState('');
  return (
    <Modal open={open} onOpenChange={onClose} title="Ask the customer for clarification" description="The request moves to 'Awaiting clarification' and stays unconfirmed until they reply."
      footer={<PrimaryButton loading={m.isPending} disabled={!text.trim()} onClick={() => m.mutate({ body: text, request_clarification: true }, { onSuccess: () => setText('') })}>Send</PrimaryButton>}>
      <TextArea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Could you confirm the number of large suitcases and whether you need a child seat?" />
    </Modal>
  );
}

function ConfirmModal({ open, onClose, b, accepted, m }) {
  const [reason, setReason] = useState('');
  const [arr, setArr] = useState(b.payment_arrangement);
  return (
    <Modal open={open} onOpenChange={onClose} title="Confirm this booking" description="Only management confirmation makes this a booking. The customer is notified immediately."
      footer={<PrimaryButton loading={m.isPending} disabled={!accepted && !reason.trim()} onClick={() => m.mutate({ override_reason: reason, payment_arrangement: arr })}><CheckCircle2 className="h-4 w-4" />Confirm booking</PrimaryButton>}>
      <div className="space-y-4">
        {accepted ? <Banner tone="green" icon={CheckCircle2}>Customer accepted quotation v{accepted.version} at <b>{gbp(accepted.total)}</b>.</Banner> : (
          <>
            <Banner tone="amber" icon={AlertTriangle} title="No accepted quotation">The customer has not accepted a quotation in the app. Record how terms were agreed.</Banner>
            <Field label="Reason (recorded)" required><TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Price agreed by phone with customer" /></Field>
          </>
        )}
        <Field label="Payment arrangement"><SelectInput value={arr} onChange={(e) => setArr(e.target.value)}>{Object.entries(PAYMENT_ARRANGEMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectInput></Field>
        <p className="text-xs text-muted-foreground">Short-notice requests: confirm only if Encore can deliver.</p>
      </div>
    </Modal>
  );
}

function ReasonModal({ open, onClose, title, description, label, cta, danger, required, m }) {
  const [text, setText] = useState('');
  return (
    <Modal open={open} onOpenChange={onClose} title={title} description={description}
      footer={<PrimaryButton className={danger ? 'bg-red-600 hover:bg-red-700' : ''} loading={m.isPending} disabled={required && !text.trim()} onClick={() => m.mutate({ reason: text })}>{cta}</PrimaryButton>}>
      <Field label={label}><TextArea rows={3} value={text} onChange={(e) => setText(e.target.value)} /></Field>
    </Modal>
  );
}

function OverrideModal({ open, onClose, b, m }) {
  const [status, setStatus] = useState(b.status);
  const [reason, setReason] = useState('');
  return (
    <Modal open={open} onOpenChange={onClose} title="Override booking status" description="Use for corrections such as marking a no-show or expiry. The change and reason are recorded."
      footer={<PrimaryButton loading={m.isPending} disabled={!reason.trim() || status === b.status} onClick={() => m.mutate({ status, reason })}>Apply override</PrimaryButton>}>
      <div className="space-y-3">
        <SelectInput value={status} onChange={(e) => setStatus(e.target.value)}>{BOOKING_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS[s].admin}</option>)}</SelectInput>
        <Field label="Reason" required><TextInput value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function EditModal({ b, onClose, onSaved }) {
  const [f, setF] = useState({
    lead_passenger: b.lead_passenger, contact_phone: b.contact_phone, passenger_count: b.passenger_count, passenger_names: b.passenger_names || '',
    luggage_large: b.luggage_large, luggage_small: b.luggage_small, child_seats: b.child_seats, accessibility_needs: b.accessibility_needs || '',
    special_instructions: b.special_instructions || '', sensitive_notes: b.sensitive_notes || '', preferred_category: b.preferred_category || '',
    flight_number: b.flight_number || '', duration_hours: b.duration_hours || '', internal_notes: b.internal_notes || '',
  });
  const [legs, setLegs] = useState(b.legs.map((l) => ({ id: l.id, label: l.label, pickup: l.pickup, destination: l.destination, pickup_at: toLocalInput(l.pickup_at), est_minutes: l.est_minutes || '', stops: l.stops.join('\n') })));
  const save = useAction((body) => api.patch(`/bookings/${b.id}`, body), { success: 'Changes saved and recorded.', onSuccess: onSaved });
  const bind = (k, type = 'text') => ({ value: f[k], type, onChange: (e) => setF({ ...f, [k]: type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value }) });
  const submit = () => save.mutate({
    ...f, duration_hours: f.duration_hours === '' ? null : Number(f.duration_hours),
    legs: legs.map((l) => ({ id: l.id, pickup: l.pickup, destination: l.destination, pickup_at: new Date(l.pickup_at).toISOString(), est_minutes: l.est_minutes === '' ? null : Number(l.est_minutes), stops: l.stops.split('\n').map((s) => s.trim()).filter(Boolean) })),
  });
  return (
    <Modal open onOpenChange={onClose} wide title={`Edit ${b.ref}`} description="Every change is recorded with your name and the time." footer={<PrimaryButton loading={save.isPending} onClick={submit}>Save changes</PrimaryButton>}>
      <div className="space-y-5">
        {legs.map((l, i) => (
          <div key={l.id} className="grid gap-3 rounded-xl bg-surface p-4 sm:grid-cols-2">
            <div className="text-sm font-semibold sm:col-span-2">{l.label}</div>
            <Field label="Pickup"><TextInput value={l.pickup} onChange={(e) => setLegs(legs.map((x, j) => (j === i ? { ...x, pickup: e.target.value } : x)))} /></Field>
            <Field label="Destination"><TextInput value={l.destination} onChange={(e) => setLegs(legs.map((x, j) => (j === i ? { ...x, destination: e.target.value } : x)))} /></Field>
            <Field label="Pickup time"><TextInput type="datetime-local" value={l.pickup_at} onChange={(e) => setLegs(legs.map((x, j) => (j === i ? { ...x, pickup_at: e.target.value } : x)))} /></Field>
            <Field label="Planned minutes (conflict check)" hint="Blank = default from settings"><TextInput type="number" value={l.est_minutes} onChange={(e) => setLegs(legs.map((x, j) => (j === i ? { ...x, est_minutes: e.target.value } : x)))} /></Field>
            <Field label="Stops (one per line)" className="sm:col-span-2"><TextArea rows={2} value={l.stops} onChange={(e) => setLegs(legs.map((x, j) => (j === i ? { ...x, stops: e.target.value } : x)))} /></Field>
          </div>
        ))}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Lead passenger"><TextInput {...bind('lead_passenger')} /></Field>
          <Field label="Contact phone"><TextInput {...bind('contact_phone')} /></Field>
          <Field label="Passengers"><TextInput {...bind('passenger_count', 'number')} /></Field>
          <Field label="Large cases"><TextInput {...bind('luggage_large', 'number')} /></Field>
          <Field label="Small bags"><TextInput {...bind('luggage_small', 'number')} /></Field>
          <Field label="Child seats"><TextInput {...bind('child_seats', 'number')} /></Field>
          <Field label="Flight"><TextInput {...bind('flight_number')} /></Field>
          <Field label="Hours (hourly)"><TextInput {...bind('duration_hours', 'number')} /></Field>
          <Field label="Preferred vehicle"><TextInput {...bind('preferred_category')} /></Field>
          <Field label="Other passengers" className="sm:col-span-3"><TextInput {...bind('passenger_names')} /></Field>
          <Field label="Accessibility" className="sm:col-span-3"><TextInput {...bind('accessibility_needs')} /></Field>
          <Field label="Special instructions" className="sm:col-span-3"><TextArea {...bind('special_instructions')} /></Field>
          <Field label="Sensitive notes (driver sees)" className="sm:col-span-3"><TextArea rows={2} {...bind('sensitive_notes')} /></Field>
          <Field label="Internal notes (management only)" className="sm:col-span-3"><TextArea rows={2} {...bind('internal_notes')} /></Field>
        </div>
      </div>
    </Modal>
  );
}

