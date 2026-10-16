import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Briefcase, Car, Pencil, Plus, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { usePublicSettings } from '@/lib/auth';
import { Empty, Field, Modal, PageHeader, PageLoader, Pill, PrimaryButton, SelectInput, TextArea, TextInput, useAction } from '@/components/common';
import { Button } from '@/components/ui/button';

const VSTATUS = { available: 'green', unavailable: 'amber', retired: 'grey' };

// ---------------- Fleet ----------------
export function Fleet() {
  const { data, isLoading } = useQuery({ queryKey: ['vehicles'], queryFn: () => api.get('/admin/vehicles') });
  const [edit, setEdit] = useState(null);
  return (
    <div>
      <PageHeader title="Fleet" subtitle="Company vehicles. Unavailable or retired vehicles cannot be assigned. No fleet limit."
        actions={<Button className="rounded-full" onClick={() => setEdit({})}><Plus />Add vehicle</Button>} />
      {isLoading ? <PageLoader /> : !data.length ? <Empty icon={Car} title="No vehicles yet" /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((v) => (
            <div key={v.id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div><div className="font-heading font-semibold">{v.make} {v.model}</div><div className="text-sm text-muted-foreground">{v.colour} · {v.category}</div></div>
                <span className="rounded-md border-2 border-ink bg-yellow-300 px-2 py-0.5 font-mono text-sm font-black">{v.registration}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <Pill tone={VSTATUS[v.status]}>{v.status}</Pill>
                <Pill>{v.seats} seats</Pill><Pill>{v.luggage_capacity} cases</Pill>
                {v.child_seat_capable ? <Pill>Child seats</Pill> : null}{v.accessible ? <Pill tone="blue">Accessible</Pill> : null}
                {v.upcoming_jobs > 0 && <Pill tone="brand">{v.upcoming_jobs} active job(s)</Pill>}
              </div>
              {v.notes && <p className="mt-2 text-xs text-muted-foreground">{v.notes}</p>}
              <Button size="sm" variant="ghost" className="mt-2 -ml-2" onClick={() => setEdit(v)}><Pencil />Edit</Button>
            </div>
          ))}
        </div>
      )}
      {edit && <VehicleModal v={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function VehicleModal({ v, onClose }) {
  const { data: s } = usePublicSettings();
  const [f, setF] = useState({ registration: '', make: '', model: '', colour: '', category: s?.vehicle_categories?.[0] || '', seats: 3, luggage_capacity: 2, child_seat_capable: 1, accessible: 0, status: 'available', notes: '', ...v });
  const save = useAction((body) => (v.id ? api.patch(`/admin/vehicles/${v.id}`, body) : api.post('/admin/vehicles', body)), {
    success: v.id ? 'Vehicle updated.' : 'Vehicle added.', invalidate: ['vehicles'],
    onSuccess: (r) => { if (r.warning) toast.warning(r.warning, { duration: 8000 }); onClose(); },
  });
  const bind = (k) => ({ value: f[k] ?? '', onChange: (e) => setF({ ...f, [k]: e.target.value }), invalid: !!save.fields[k] });
  return (
    <Modal open onOpenChange={onClose} title={v.id ? `Edit ${v.registration}` : 'Add vehicle'} footer={<PrimaryButton loading={save.isPending} onClick={() => save.mutate({ ...f, seats: Number(f.seats), luggage_capacity: Number(f.luggage_capacity) })}>Save</PrimaryButton>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Registration" error={save.fields.registration}><TextInput {...bind('registration')} onChange={(e) => setF({ ...f, registration: e.target.value.toUpperCase() })} /></Field>
        <Field label="Status"><SelectInput {...bind('status')}><option value="available">Available</option><option value="unavailable">Unavailable</option><option value="retired">Retired</option></SelectInput></Field>
        <Field label="Make" error={save.fields.make}><TextInput {...bind('make')} /></Field>
        <Field label="Model" error={save.fields.model}><TextInput {...bind('model')} /></Field>
        <Field label="Colour"><TextInput {...bind('colour')} /></Field>
        <Field label="Category" error={save.fields.category}><SelectInput {...bind('category')}>{(s?.vehicle_categories || []).concat(f.category && !(s?.vehicle_categories || []).includes(f.category) ? [f.category] : []).map((c) => <option key={c}>{c}</option>)}</SelectInput></Field>
        <Field label="Passenger seats" error={save.fields.seats}><TextInput type="number" min="1" {...bind('seats')} /></Field>
        <Field label="Luggage capacity (large cases)"><TextInput type="number" min="0" {...bind('luggage_capacity')} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#FF5A1F]" checked={!!Number(f.child_seat_capable)} onChange={(e) => setF({ ...f, child_seat_capable: e.target.checked ? 1 : 0 })} />Child seats can be fitted</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#FF5A1F]" checked={!!Number(f.accessible)} onChange={(e) => setF({ ...f, accessible: e.target.checked ? 1 : 0 })} />Accessible vehicle</label>
        <Field label="Notes" className="sm:col-span-2"><TextArea rows={2} {...bind('notes')} /></Field>
      </div>
    </Modal>
  );
}

// ---------------- Drivers ----------------
export function Drivers() {
  const { data, isLoading } = useQuery({ queryKey: ['drivers'], queryFn: () => api.get('/admin/drivers') });
  const [edit, setEdit] = useState(null);
  const toggle = useAction(({ id, ...body }) => api.patch(`/admin/drivers/${id}`, body), { success: 'Driver updated.', invalidate: ['drivers'] });
  return (
    <div>
      <PageHeader title="Drivers" subtitle="Chauffeurs see only the journeys you assign to them. Drivers are added by management — there is no open registration."
        actions={<Button className="rounded-full" onClick={() => setEdit({})}><Plus />Add driver</Button>} />
      {isLoading ? <PageLoader /> : !data.length ? <Empty icon={Users} title="No drivers yet" /> : (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3">Driver</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Availability</th><th className="px-4 py-3">Active jobs</th><th className="px-4 py-3">Account</th><th /></tr></thead>
              <tbody className="divide-y">
                {data.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3"><div className="font-semibold">{d.name}</div><div className="text-xs text-muted-foreground">{d.licence_number || 'Licence not recorded'}</div></td>
                    <td className="px-4 py-3"><div>{d.phone}</div><div className="text-xs text-muted-foreground">{d.email}</div></td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggle.mutate({ id: d.id, driver_availability: d.driver_availability === 'available' ? 'unavailable' : 'available' })}>
                        <Pill tone={d.driver_availability === 'available' ? 'green' : 'amber'}>{d.driver_availability}</Pill>
                      </button>
                    </td>
                    <td className="px-4 py-3">{d.upcoming_jobs}</td>
                    <td className="px-4 py-3"><Pill tone={d.status === 'active' ? 'green' : 'red'}>{d.status}</Pill></td>
                    <td className="px-4 py-3 text-right"><Button size="sm" variant="ghost" onClick={() => setEdit(d)}><Pencil />Edit</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {edit && <DriverModal d={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function DriverModal({ d, onClose }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', licence_number: '', notes: '', password: '', status: 'active', driver_availability: 'available', ...d, ...(d.id ? { password: '' } : {}) });
  const save = useAction((body) => (d.id ? api.patch(`/admin/drivers/${d.id}`, body) : api.post('/admin/drivers', body)), { success: 'Saved.', invalidate: ['drivers'], onSuccess: onClose });
  const bind = (k) => ({ value: f[k] ?? '', onChange: (e) => setF({ ...f, [k]: e.target.value }), invalid: !!save.fields[k] });
  const body = d.id ? { name: f.name, phone: f.phone, licence_number: f.licence_number, notes: f.notes, status: f.status, driver_availability: f.driver_availability, ...(f.password ? { password: f.password } : {}) } : f;
  return (
    <Modal open onOpenChange={onClose} title={d.id ? `Edit ${d.name}` : 'Add driver'} description={d.id ? undefined : 'Share the email and temporary password with the driver so they can sign in.'}
      footer={<PrimaryButton loading={save.isPending} onClick={() => save.mutate(body)}>Save</PrimaryButton>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name" error={save.fields.name}><TextInput {...bind('name')} /></Field>
        <Field label="Mobile" error={save.fields.phone}><TextInput type="tel" {...bind('phone')} /></Field>
        {!d.id && <Field label="Email (sign-in)" error={save.fields.email}><TextInput type="email" {...bind('email')} /></Field>}
        <Field label={d.id ? 'Reset password (optional)' : 'Temporary password'} error={save.fields.password}><TextInput type="text" autoComplete="new-password" {...bind('password')} /></Field>
        <Field label="Driving licence no."><TextInput {...bind('licence_number')} /></Field>
        {d.id && <Field label="Availability"><SelectInput {...bind('driver_availability')}><option value="available">Available</option><option value="unavailable">Unavailable</option></SelectInput></Field>}
        {d.id && <Field label="Account"><SelectInput {...bind('status')}><option value="active">Active</option><option value="suspended">Suspended</option></SelectInput></Field>}
        <Field label="Notes" className="sm:col-span-2"><TextArea rows={2} {...bind('notes')} /></Field>
      </div>
    </Modal>
  );
}

// ---------------- External operators ----------------
export function Operators() {
  const { data, isLoading } = useQuery({ queryKey: ['operators'], queryFn: () => api.get('/admin/operators') });
  const [edit, setEdit] = useState(null);
  return (
    <div>
      <PageHeader title="External cover" subtitle="Trusted partner operators for exceptional demand. Recorded and assigned internally — they have no login."
        actions={<Button className="rounded-full" onClick={() => setEdit({})}><Plus />Add operator</Button>} />
      {isLoading ? <PageLoader /> : !data.length ? <Empty icon={Briefcase} title="No operators recorded" /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((o) => (
            <div key={o.id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex justify-between"><div className="font-heading font-semibold">{o.name}</div><Pill tone={o.active ? 'green' : 'grey'}>{o.active ? 'Active' : 'Inactive'}</Pill></div>
              <div className="mt-1 text-sm text-muted-foreground">{o.contact_name} · {o.phone} · {o.email}</div>
              {o.notes && <p className="mt-2 text-xs text-muted-foreground">{o.notes}</p>}
              <Button size="sm" variant="ghost" className="mt-2 -ml-2" onClick={() => setEdit(o)}><Pencil />Edit</Button>
            </div>
          ))}
        </div>
      )}
      {edit && <OperatorModal o={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function OperatorModal({ o, onClose }) {
  const [f, setF] = useState({ name: '', contact_name: '', phone: '', email: '', notes: '', active: 1, ...o });
  const save = useAction((body) => (o.id ? api.patch(`/admin/operators/${o.id}`, body) : api.post('/admin/operators', body)), { success: 'Saved.', invalidate: ['operators'], onSuccess: onClose });
  const bind = (k) => ({ value: f[k] ?? '', onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  return (
    <Modal open onOpenChange={onClose} title={o.id ? `Edit ${o.name}` : 'Add operator'} footer={<PrimaryButton loading={save.isPending} onClick={() => save.mutate({ ...f, active: Number(f.active) })}>Save</PrimaryButton>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Business name" error={save.fields.name}><TextInput {...bind('name')} /></Field>
        <Field label="Contact name"><TextInput {...bind('contact_name')} /></Field>
        <Field label="Phone"><TextInput {...bind('phone')} /></Field>
        <Field label="Email"><TextInput {...bind('email')} /></Field>
        {o.id && <Field label="Status"><SelectInput {...bind('active')}><option value={1}>Active</option><option value={0}>Inactive</option></SelectInput></Field>}
        <Field label="Notes" className="sm:col-span-2"><TextArea rows={2} {...bind('notes')} /></Field>
      </div>
    </Modal>
  );
}
