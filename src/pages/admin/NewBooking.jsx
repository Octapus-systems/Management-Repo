import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Banner, Field, PageHeader, PageLoader, SelectInput, useAction } from '@/components/common';
import { RequestForm, emptyRequest } from '@/components/booking';

/** Staff booking on behalf of a customer (BRD open question 15) — recorded as "created by staff". */
export default function NewBooking() {
  const nav = useNavigate();
  const customers = useQuery({ queryKey: ['customer-options'], queryFn: () => api.get('/admin/customer-options') });
  const [customerId, setCustomerId] = useState('');
  const [formKey, setFormKey] = useState(0);
  const create = useAction((body) => api.post('/bookings', { ...body, customer_id: Number(customerId) }), {
    success: 'Request created. Review and quote it next.',
    invalidate: ['bookings', 'dashboard'],
    onSuccess: (b) => nav(`/admin/bookings/${b.id}`),
  });
  if (customers.isLoading) return <PageLoader />;
  const c = customers.data.find((x) => String(x.id) === String(customerId));
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New booking for a customer" subtitle="For requests taken by phone or message. It enters the normal review → quote → confirm flow." />
      <RequestForm key={formKey} initial={{ ...emptyRequest(null), lead_passenger: c?.name || '', contact_phone: c?.phone || '' }}
        onSubmit={(b) => create.mutate(b)} submitting={create.isPending} fields={create.fields} submitLabel="Create request"
        beforeSections={(
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <Field label="Customer" error={create.fields.customer_id} required>
              <SelectInput value={customerId} onChange={(e) => { setCustomerId(e.target.value); setFormKey((k) => k + 1); }}>
                <option value="">Choose an approved customer…</option>
                {customers.data.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.organisation_name || x.email}</option>)}
              </SelectInput>
            </Field>
            {!customers.data.length && <Banner className="mt-3">No approved customers yet. Invite or approve a customer first.</Banner>}
          </div>
        )} />
    </div>
  );
}
