import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ACTIVITY_LABEL, shortDateTime } from '@/lib/format';
import { Banner, Field, PageHeader, PageLoader, Panel, PrimaryButton, SelectInput, TextArea, TextInput, useAction } from '@/components/common';
import { ActivityDetail, DeliveryChips } from '@/pages/admin/BookingDetail';
import { Button } from '@/components/ui/button';

export function MessagesLog() {
  const [params, setParams] = useSearchParams();
  const failed = params.get('failed');
  const { data, isLoading } = useQuery({ queryKey: ['notification-log', failed], queryFn: () => api.get(`/admin/notifications${failed ? '?failed=1' : ''}`) });
  return (
    <div>
      <PageHeader title="Notifications" subtitle="Every message the platform generated and what happened on each channel. A saved message is not proof of delivery."
        actions={<Button variant={failed ? 'default' : 'outline'} className="rounded-full" onClick={() => setParams(failed ? {} : { failed: 1 })}>{failed ? 'Showing undelivered' : 'Show undelivered only'}</Button>} />
      <Banner tone="blue" className="mb-4">WhatsApp sends from Encore's business account once WhatsApp Business API credentials are configured on the server. Until then, external deliveries show as “not configured” and customers still receive the in-app update.</Banner>
      {isLoading ? <PageLoader /> : (
        <div className="divide-y rounded-2xl border bg-white shadow-sm">
          {data.map((n) => (
            <div key={n.id} className="grid gap-2 px-5 py-3 text-sm md:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="font-semibold">{n.title} {n.ref && <Link className="ml-1 text-xs text-primary" to={`/admin/bookings/${n.booking_id}`}>{n.ref}</Link>}</div>
                <div className="truncate text-muted-foreground">{n.body}</div>
                <div className="text-xs text-muted-foreground">To {n.recipient} ({n.recipient_role}) · {shortDateTime(n.created_at)}{n.read_at ? ' · read in app' : ''}</div>
              </div>
              <DeliveryChips deliveries={n.deliveries} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ActivityLog() {
  const { data, isLoading } = useQuery({ queryKey: ['activity'], queryFn: () => api.get('/admin/activity') });
  const [q, setQ] = useState('');
  const rows = (data || []).filter((a) => !q || JSON.stringify(a).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader title="Activity history" subtitle="Who changed bookings, quotations, assignments, payments, cancellations and statuses — and when." />
      <TextInput className="mb-4 max-w-sm" placeholder="Filter (ref, person, action)…" value={q} onChange={(e) => setQ(e.target.value)} />
      {isLoading ? <PageLoader /> : (
        <div className="divide-y rounded-2xl border bg-white shadow-sm">
          {rows.map((a) => (
            <div key={a.id} className="grid gap-1 px-5 py-3 text-sm md:grid-cols-[180px_1fr_200px]">
              <div className="text-xs text-muted-foreground">{shortDateTime(a.created_at)}</div>
              <div className="min-w-0">
                <span className="font-semibold capitalize">{ACTIVITY_LABEL(a.action)}</span>
                {a.ref && <Link className="ml-2 text-xs font-semibold text-primary" to={`/admin/bookings/${a.booking_id}`}>{a.ref}</Link>}
                {!a.ref && <span className="ml-2 text-xs text-muted-foreground">{a.entity} #{a.entity_id}</span>}
                {a.detail && <ActivityDetail detail={a.detail} />}
              </div>
              <div className="text-xs md:text-right">{a.actor_name ? `${a.actor_name} · ${a.actor_role}` : 'System'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const NUMERIC = [
  ['default_job_minutes', 'Default journey duration (minutes)', 'Used for conflict detection when a leg has no planned duration.'],
  ['turnaround_minutes', 'Turnaround buffer (minutes)', 'Added after each journey before the driver/vehicle is free.'],
  ['reminder_minutes_before', 'Pickup reminder (minutes before)', 'BRD: one hour.'],
  ['quote_validity_hours', 'Quotation validity (hours)', ''],
  ['invoice_due_days', 'Invoice due (days)', ''],
  ['max_drivers', 'Active driver limit', 'Per your plan.'],
  ['max_admins', 'Management user limit', 'Per your plan.'],
];

const BOOKING_FIELDS = [
  ['stops', 'Extra pickups / stops'], ['passenger_names', 'Other passenger names'], ['luggage', 'Luggage counts'],
  ['child_seats', 'Child seats'], ['accessibility_needs', 'Accessibility needs'], ['preferred_category', 'Preferred vehicle'],
  ['flight_number', 'Flight number (airport)'], ['special_instructions', 'Special instructions'], ['sensitive_notes', 'Private notes for chauffeur'],
];
const OnOff = (props) => <SelectInput {...props}><option value="on">On</option><option value="off">Off</option></SelectInput>;

export function Settings() {
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/admin/settings') });
  const [f, setF] = useState(null);
  useEffect(() => { if (data) setF({ ...data, vehicle_categories: JSON.parse(data.vehicle_categories || '[]').join('\n'), booking_fields: JSON.parse(data.booking_fields || '{}') }); }, [data]);
  const save = useAction((b) => api.put('/admin/settings', b), { success: 'Settings saved.', invalidate: ['settings', 'public-settings'] });
  if (isLoading || !f) return <PageLoader />;
  const bind = (k) => ({ value: f[k] ?? '', onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  const submit = () => save.mutate({ ...f, vehicle_categories: JSON.stringify(f.vehicle_categories.split('\n').map((s) => s.trim()).filter(Boolean)), booking_fields: JSON.stringify(f.booking_fields) });
  const toggleField = (k) => setF({ ...f, booking_fields: { ...f.booking_fields, [k]: f.booking_fields[k] === false } });
  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader title="Settings" subtitle="Operational rules. Items still open in the BRD are configurable here rather than hard-coded." actions={<PrimaryButton loading={save.isPending} onClick={submit}>Save settings</PrimaryButton>} />
      <Panel title="Company & dispatch">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name"><TextInput {...bind('company_name')} /></Field>
          <Field label="Operating base"><TextInput {...bind('base_location')} /></Field>
          <Field label="Dispatcher name"><TextInput {...bind('dispatcher_name')} /></Field>
          <Field label="Dispatcher phone (drivers & customers call this)"><TextInput {...bind('dispatcher_phone')} /></Field>
          <Field label="Dispatcher WhatsApp"><TextInput {...bind('dispatcher_whatsapp')} /></Field>
          <Field label="Invoice number prefix"><TextInput {...bind('invoice_prefix')} /></Field>
        </div>
      </Panel>
      <Panel title="Customer admission (BRD open question 3)">
        <Field label="How customers join">
          <SelectInput {...bind('admission_mode')}>
            <option value="invitation">Invitation only</option>
            <option value="approval">Registration approved by management</option>
            <option value="both">Both — invitations and approved registrations</option>
          </SelectInput>
        </Field>
      </Panel>
      <Panel title="Booking rules">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Minimum notice (hours before pickup)" hint="Customers can't request journeys sooner than this. Staff bookings may override. 0 = off."><TextInput type="number" min="0" step="0.5" {...bind('min_notice_hours')} /></Field>
          <Field label="Minimum hourly hire (hours)" hint="Applies to 'as directed' hourly bookings. Staff may override."><TextInput type="number" min="0" step="0.5" {...bind('hourly_min_hours')} /></Field>
          <Field label="Flight number required for airport transfers"><OnOff {...bind('flight_number_required')} /></Field>
          <Field label="Start Journey available (minutes before pickup)" hint="Chauffeurs can't press 'On the way' earlier than this. Dispatch can always update. 0 = any time."><TextInput type="number" min="0" {...bind('start_window_minutes')} /></Field>
        </div>
        <div className="mt-5">
          <div className="mb-2 text-sm font-semibold">Fields shown on the customer booking form</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {BOOKING_FIELDS.map(([k, l]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[#FF5A1F]" checked={f.booking_fields[k] !== false} onChange={() => toggleField(k)} />{l}
              </label>
            ))}
          </div>
        </div>
      </Panel>
      <Panel title="Payment rules">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New bookings default to" hint="Corporate account bookings always use monthly invoicing.">
            <SelectInput {...bind('default_payment_arrangement')}><option value="pay_before">Pay before the journey (preferred)</option><option value="pay_after">Pay after the journey</option></SelectInput>
          </Field>
          <Field label="When payment is outstanding on a pay-before booking" hint="Exception: change that booking's arrangement to 'pay after' — the change is recorded in its history.">
            <SelectInput {...bind('payment_rule')}><option value="before_start">Block the journey from starting</option><option value="before_assignment">Block driver assignment</option><option value="off">Don't block</option></SelectInput>
          </Field>
        </div>
      </Panel>
      <Panel title="Customer sign-in">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Book without signing in first" hint="Customers verify their mobile at the end."><OnOff {...bind('guest_booking')} /></Field>
          <Field label="Mobile number + code sign-in"><OnOff {...bind('otp_login')} /></Field>
          <Field label="Send codes by" hint="Demo mode until an SMS/WhatsApp provider is connected."><SelectInput {...bind('otp_channel')}><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></SelectInput></Field>
        </div>
      </Panel>
      <Panel title="Timings & limits">
        <div className="grid gap-4 sm:grid-cols-2">
          {NUMERIC.map(([k, l, h]) => <Field key={k} label={l} hint={h}><TextInput type="number" min="0" {...bind(k)} /></Field>)}
        </div>
      </Panel>
      <Panel title="Policies & vehicles">
        <div className="grid gap-4">
          <Field label="Cancellation policy shown to customers" hint="Fees, refunds and no-show rules are not yet defined (BRD §19) — describe what is agreed."><TextArea rows={3} {...bind('cancellation_policy')} /></Field>
          <Field label="Vehicle categories (one per line)"><TextArea rows={4} {...bind('vehicle_categories')} /></Field>
        </div>
      </Panel>
      <Panel title="Notification channels">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="WhatsApp" hint="Requires WHATSAPP_TOKEN and WHATSAPP_PHONE_ID on the server"><SelectInput {...bind('channel_whatsapp')}><option value="on">On</option><option value="off">Off</option></SelectInput></Field>
          <Field label="Email" hint="Provider to be agreed"><SelectInput {...bind('channel_email')}><option value="on">On</option><option value="off">Off</option></SelectInput></Field>
        </div>
      </Panel>
    </div>
  );
}
