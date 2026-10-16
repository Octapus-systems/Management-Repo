import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Plus, Receipt } from 'lucide-react';
import { api } from '@/lib/api';
import { PAYMENT_ARRANGEMENT, PAYMENT_STATUS, dateOnly, gbp, shortDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Empty, Field, Modal, PageHeader, PageLoader, PaymentBadge, PrimaryButton, SelectInput, StatusBadge, TextInput, useAction } from '@/components/common';
import { InvoiceStatus } from '@/pages/shared';
import { Button } from '@/components/ui/button';

export function Payments() {
  const { data, isLoading } = useQuery({ queryKey: ['payments'], queryFn: () => api.get('/admin/payments') });
  const [filter, setFilter] = useState('outstanding');
  const nav = useNavigate();
  if (isLoading) return <PageLoader />;
  const rows = data.filter((r) => filter === 'all' || (filter === 'outstanding' ? !['paid'].includes(r.payment_status) : r.payment_status === filter));
  const sum = (s) => data.filter((r) => r.payment_status === s).reduce((t, r) => t + (r.total || 0) - (r.received || 0), 0);
  return (
    <div>
      <PageHeader title="Payments" subtitle="Payment status is tracked separately from the journey. A failed payment is never shown as paid." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {['unpaid', 'link_sent', 'invoiced', 'overdue'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={cn('rounded-2xl border bg-white p-4 text-left shadow-sm', filter === s && 'ring-2 ring-primary')}>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{PAYMENT_STATUS[s].label}</div>
            <div className="mt-1 font-heading text-2xl font-bold">{data.filter((r) => r.payment_status === s).length}</div>
            <div className="text-xs text-muted-foreground">{gbp(sum(s))} outstanding</div>
          </button>
        ))}
      </div>
      <div className="mb-3 flex gap-2">{[['outstanding', 'Outstanding'], ['all', 'All'], ['paid', 'Paid']].map(([k, l]) => <Button key={k} size="sm" variant={filter === k ? 'default' : 'outline'} className="rounded-full" onClick={() => setFilter(k)}>{l}</Button>)}</div>
      {!rows.length ? <Empty icon={Receipt} title="Nothing here" /> : (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3">Booking</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Arrangement</th><th className="px-4 py-3">Journey</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3 text-right">Received</th><th className="px-4 py-3">Payment</th></tr></thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer hover:bg-surface/60" onClick={() => nav(`/admin/bookings/${r.id}`)}>
                    <td className="px-4 py-3 font-semibold">{r.ref}<div className="text-xs font-normal text-muted-foreground">{shortDateTime(r.first_pickup)}</div></td>
                    <td className="px-4 py-3">{r.customer_name}<div className="text-xs text-muted-foreground">{r.organisation_name}</div></td>
                    <td className="px-4 py-3 text-xs">{PAYMENT_ARRANGEMENT[r.payment_arrangement]}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} admin /></td>
                    <td className="px-4 py-3 text-right font-semibold">{r.total != null ? gbp(r.total) : '—'}</td>
                    <td className="px-4 py-3 text-right">{gbp(r.received)}</td>
                    <td className="px-4 py-3"><PaymentBadge status={r.payment_status} /></td>
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

export function Invoices() {
  const { data, isLoading } = useQuery({ queryKey: ['invoices'], queryFn: () => api.get('/account/invoices') });
  const [open, setOpen] = useState(false);
  const upd = useAction(({ id, ...b }) => api.patch(`/admin/invoices/${id}`, b), { success: 'Invoice updated.', invalidate: ['invoices', 'payments'] });
  return (
    <div>
      <PageHeader title="Corporate invoices" subtitle="Consolidate completed corporate journeys into one invoice under the account's agreed terms."
        actions={<Button className="rounded-full" onClick={() => setOpen(true)}><Plus />New consolidated invoice</Button>} />
      {isLoading ? <PageLoader /> : !data.length ? <Empty icon={FileText} title="No invoices yet" /> : (
        <div className="divide-y rounded-2xl border bg-white shadow-sm">
          {data.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <Link to={`/admin/invoices/${i.id}`} className="min-w-0">
                <div className="font-semibold">{i.number} · {i.organisation_name}</div>
                <div className="text-xs text-muted-foreground">Period {dateOnly(i.period_start)} – {dateOnly(new Date(new Date(i.period_end).getTime() - 1))} · due {dateOnly(i.due_date)}</div>
              </Link>
              <div className="flex items-center gap-3">
                <span className="font-heading font-bold">{gbp(i.total)}</span>
                <InvoiceStatus status={i.status} />
                <SelectInput className="h-9 w-32 text-sm" value={i.status} onChange={(e) => upd.mutate({ id: i.id, status: e.target.value })}>
                  <option value="issued">Issued</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="void">Void</option>
                </SelectInput>
              </div>
            </div>
          ))}
        </div>
      )}
      {open && <InvoiceModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function InvoiceModal({ onClose }) {
  const nav = useNavigate();
  const orgs = useQuery({ queryKey: ['organisations'], queryFn: () => api.get('/admin/organisations') });
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [f, setF] = useState({ organisation_id: '', from: iso(first), to: iso(now > last ? now : last), notes: '' });
  const [excluded, setExcluded] = useState([]);
  const ready = f.organisation_id && f.from && f.to;
  const eligible = useQuery({ queryKey: ['eligible', f.organisation_id, f.from, f.to], enabled: !!ready, queryFn: () => api.get(`/admin/invoices/eligible?organisation_id=${f.organisation_id}&from=${f.from}&to=${f.to}`) });
  const items = (eligible.data || []).filter((i) => !excluded.includes(i.id));
  const create = useAction((b) => api.post('/admin/invoices', b), { success: 'Invoice issued — corporate users notified.', invalidate: ['invoices', 'payments'], onSuccess: (inv) => nav(`/admin/invoices/${inv.id}`) });
  return (
    <Modal open onOpenChange={onClose} wide title="New consolidated invoice" description="Includes completed journeys in the period that are not already invoiced or paid."
      footer={<PrimaryButton loading={create.isPending} disabled={!items.length} onClick={() => create.mutate({ ...f, organisation_id: Number(f.organisation_id), booking_ids: items.map((i) => i.id) })}>Issue invoice · {gbp(items.reduce((s, i) => s + (i.total || 0), 0))}</PrimaryButton>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Corporate account"><SelectInput value={f.organisation_id} onChange={(e) => setF({ ...f, organisation_id: e.target.value })}><option value="">Choose…</option>{(orgs.data || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</SelectInput></Field>
        <Field label="From"><TextInput type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><TextInput type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
      </div>
      {ready && (eligible.isLoading ? <PageLoader /> : !eligible.data.length ? <p className="text-sm text-muted-foreground">No eligible journeys in this period.</p> : (
        <div className="divide-y rounded-xl border">
          {eligible.data.map((i) => (
            <label key={i.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[#FF5A1F]" checked={!excluded.includes(i.id)} onChange={(e) => setExcluded(e.target.checked ? excluded.filter((x) => x !== i.id) : [...excluded, i.id])} />
              <span className="flex-1"><b>{i.ref}</b> · {i.lead_passenger} · {shortDateTime(i.pickup_at)}</span>
              <span className={cn('font-semibold', i.total == null && 'text-red-600')}>{i.total != null ? gbp(i.total) : 'No price'}</span>
            </label>
          ))}
        </div>
      ))}
      <Field label="Notes on invoice (optional)"><TextInput value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    </Modal>
  );
}
