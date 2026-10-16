import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Copy, Mail, Pencil, Plus, ShieldCheck, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { dateOnly } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Empty, Field, Modal, PageHeader, PageLoader, Pill, PrimaryButton, SelectInput, TextArea, TextInput, useAction } from '@/components/common';
import { Button } from '@/components/ui/button';

const TABS = [['customers', 'Customers'], ['organisations', 'Corporate accounts'], ['invitations', 'Invitations'], ['staff', 'Management users']];

export default function Customers() {
  const [tab, setTab] = useState('customers');
  return (
    <div>
      <PageHeader title="Customers & access" subtitle="Only admitted customers can book. Corporate users see only their organisation's bookings and invoices." />
      <div className="mb-4 flex gap-1 overflow-x-auto no-scrollbar rounded-2xl bg-white p-1 shadow-sm ring-1 ring-border">
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cn('shrink-0 rounded-xl px-4 py-2 text-sm font-semibold', tab === k ? 'bg-ink text-white' : 'text-muted-foreground')}>{l}</button>)}
      </div>
      {tab === 'customers' && <CustomerList />}
      {tab === 'organisations' && <Organisations />}
      {tab === 'invitations' && <Invitations />}
      {tab === 'staff' && <Staff />}
    </div>
  );
}


function CustomerList() {
  const { data, isLoading } = useQuery({ queryKey: ['customers'], queryFn: () => api.get('/admin/customers') });
  const orgs = useQuery({ queryKey: ['organisations'], queryFn: () => api.get('/admin/organisations') });
  const upd = useAction(({ id, ...b }) => api.patch(`/admin/customers/${id}`, b), { success: 'Customer updated.', invalidate: ['customers', 'dashboard', 'customer-options'] });
  if (isLoading) return <PageLoader />;
  const pending = data.filter((c) => c.status === 'pending');
  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <div className="rounded-2xl border border-primary/30 bg-orange-50 p-4">
          <div className="mb-3 flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Access requests awaiting approval</div>
          <div className="space-y-2">
            {pending.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3">
                <div><div className="font-semibold">{c.name}</div><div className="text-sm text-muted-foreground">{c.email} · {c.phone}{c.notes ? ` · ${c.notes}` : ''}</div></div>
                <div className="flex gap-2">
                  <Button size="sm" className="rounded-full" onClick={() => upd.mutate({ id: c.id, status: 'active' })}>Approve</Button>
                  <Button size="sm" variant="outline" className="rounded-full text-red-600" onClick={() => upd.mutate({ id: c.id, status: 'rejected' })}>Reject</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Corporate account</th><th className="px-4 py-3">Bookings</th><th className="px-4 py-3">Access</th></tr></thead>
            <tbody className="divide-y">
              {data.filter((c) => c.status !== 'pending').map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-semibold">{c.name}<div className="text-xs font-normal text-muted-foreground">since {dateOnly(c.created_at)}</div></td>
                  <td className="px-4 py-3">{c.email}<div className="text-xs text-muted-foreground">{c.phone}</div></td>
                  <td className="px-4 py-3">
                    <SelectInput className="h-9 text-sm" value={c.organisation_id || ''} onChange={(e) => upd.mutate({ id: c.id, organisation_id: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">Private customer</option>{(orgs.data || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </SelectInput>
                  </td>
                  <td className="px-4 py-3">{c.bookings}</td>
                  <td className="px-4 py-3">
                    <SelectInput className="h-9 w-36 text-sm" value={c.status} onChange={(e) => upd.mutate({ id: c.id, status: e.target.value })}>
                      <option value="active">Active</option><option value="suspended">Suspended</option><option value="rejected">Rejected</option>
                    </SelectInput>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Organisations() {
  const { data, isLoading } = useQuery({ queryKey: ['organisations'], queryFn: () => api.get('/admin/organisations') });
  const [edit, setEdit] = useState(null);
  return (
    <div>
      <div className="mb-3 flex justify-end"><Button className="rounded-full" onClick={() => setEdit({})}><Plus />Add corporate account</Button></div>
      {isLoading ? <PageLoader /> : !data.length ? <Empty icon={Building2} title="No corporate accounts" /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((o) => (
            <div key={o.id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex justify-between"><div className="font-heading font-semibold">{o.name}</div><Pill tone={o.status === 'active' ? 'green' : 'grey'}>{o.status}</Pill></div>
              <div className="mt-1 text-sm text-muted-foreground">{o.payment_terms}</div>
              <div className="mt-1 text-xs text-muted-foreground">{o.billing_email} · {o.users} users · {o.bookings} bookings</div>
              <Button size="sm" variant="ghost" className="mt-2 -ml-2" onClick={() => setEdit(o)}><Pencil />Edit</Button>
            </div>
          ))}
        </div>
      )}
      {edit && <OrgModal o={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function OrgModal({ o, onClose }) {
  const [f, setF] = useState({ name: '', billing_email: '', billing_address: '', payment_terms: 'Monthly consolidated invoice, 30 days', status: 'active', ...o });
  const save = useAction((b) => (o.id ? api.patch(`/admin/organisations/${o.id}`, b) : api.post('/admin/organisations', b)), { success: 'Saved.', invalidate: ['organisations'], onSuccess: onClose });
  const bind = (k) => ({ value: f[k] ?? '', onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  return (
    <Modal open onOpenChange={onClose} title={o.id ? `Edit ${o.name}` : 'New corporate account'} footer={<PrimaryButton loading={save.isPending} onClick={() => save.mutate(f)}>Save</PrimaryButton>}>
      <div className="grid gap-3">
        <Field label="Organisation name" error={save.fields.name}><TextInput {...bind('name')} /></Field>
        <Field label="Billing email"><TextInput type="email" {...bind('billing_email')} /></Field>
        <Field label="Billing address"><TextArea rows={2} {...bind('billing_address')} /></Field>
        <Field label="Agreed account terms" hint="Shown to corporate users and on invoices"><TextInput {...bind('payment_terms')} /></Field>
        {o.id && <Field label="Status"><SelectInput {...bind('status')}><option value="active">Active</option><option value="inactive">Inactive</option></SelectInput></Field>}
      </div>
    </Modal>
  );
}

function Invitations() {
  const { data, isLoading } = useQuery({ queryKey: ['invitations'], queryFn: () => api.get('/admin/invitations') });
  const orgs = useQuery({ queryKey: ['organisations'], queryFn: () => api.get('/admin/organisations') });
  const [f, setF] = useState({ email: '', name: '', organisation_id: '' });
  const copy = (path) => { navigator.clipboard?.writeText(`${window.location.origin}${path}`); toast.success('Invitation link copied.'); };
  const create = useAction((b) => api.post('/admin/invitations', b), { invalidate: ['invitations'], onSuccess: (r) => { copy(r.link); setF({ email: '', name: '', organisation_id: '' }); } });
  const revoke = useAction((id) => api.del(`/admin/invitations/${id}`), { success: 'Invitation revoked.', invalidate: ['invitations'] });
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 font-semibold"><UserPlus className="h-4 w-4 text-primary" />Invite a customer</div>
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
          <Field label="Email" error={create.fields.email}><TextInput type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Name"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Corporate account"><SelectInput value={f.organisation_id} onChange={(e) => setF({ ...f, organisation_id: e.target.value })}><option value="">Private customer</option>{(orgs.data || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</SelectInput></Field>
          <PrimaryButton loading={create.isPending} onClick={() => create.mutate({ ...f, organisation_id: f.organisation_id ? Number(f.organisation_id) : null })}>Create link</PrimaryButton>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">The invitation link is copied to your clipboard — send it by email or WhatsApp. Links expire after 14 days.</p>
      </div>
      {isLoading ? <PageLoader /> : !data.length ? <Empty icon={Mail} title="No invitations yet" /> : (
        <div className="divide-y rounded-2xl border bg-white shadow-sm">
          {data.map((i) => {
            const expired = i.expires_at && new Date(i.expires_at) < new Date();
            return (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div><div className="font-semibold">{i.email}</div><div className="text-xs text-muted-foreground">{i.organisation_name || 'Private'} · created {dateOnly(i.created_at)}</div></div>
                <div className="flex items-center gap-2">
                  <Pill tone={i.used_at ? 'green' : expired ? 'grey' : 'amber'}>{i.used_at ? 'Accepted' : expired ? 'Expired' : 'Open'}</Pill>
                  {!i.used_at && !expired && <><Button size="sm" variant="ghost" onClick={() => copy(`/invite/${i.token}`)}><Copy />Copy link</Button><Button size="sm" variant="ghost" className="text-red-600" onClick={() => revoke.mutate(i.id)}>Revoke</Button></>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Staff() {
  const { data, isLoading } = useQuery({ queryKey: ['staff'], queryFn: () => api.get('/admin/staff') });
  const [f, setF] = useState(null);
  const create = useAction((b) => api.post('/admin/staff', b), { success: 'Management user added.', invalidate: ['staff'], onSuccess: () => setF(null) });
  const upd = useAction(({ id, ...b }) => api.patch(`/admin/staff/${id}`, b), { success: 'Updated.', invalidate: ['staff'] });
  return (
    <div>
      <div className="mb-3 flex justify-end"><Button className="rounded-full" onClick={() => setF({ name: '', email: '', phone: '', password: '' })}><Plus />Add management user</Button></div>
      {isLoading ? <PageLoader /> : (
        <div className="divide-y rounded-2xl border bg-white shadow-sm">
          {data.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div><div className="font-semibold">{s.name}</div><div className="text-xs text-muted-foreground">{s.email}</div></div>
              <SelectInput className="h-9 w-36 text-sm" value={s.status} onChange={(e) => upd.mutate({ id: s.id, status: e.target.value })}><option value="active">Active</option><option value="suspended">Suspended</option></SelectInput>
            </div>
          ))}
        </div>
      )}
      {f && (
        <Modal open onOpenChange={() => setF(null)} title="Add management user" description="Management users have full Command Center access." footer={<PrimaryButton loading={create.isPending} onClick={() => create.mutate(f)}>Add</PrimaryButton>}>
          <div className="grid gap-3 sm:grid-cols-2">
            {['name', 'email', 'phone', 'password'].map((k) => <Field key={k} label={k === 'password' ? 'Temporary password' : k[0].toUpperCase() + k.slice(1)}><TextInput value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
          </div>
        </Modal>
      )}
    </div>
  );
}
