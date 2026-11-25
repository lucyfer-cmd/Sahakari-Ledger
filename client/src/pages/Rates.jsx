import { useState } from 'react';
import { api } from '../api/http.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useToast } from '../components/Toast.jsx';
import { Badge, DateText, ErrorBox, Field, LoadError, Loading, PageHead, Stat } from '../components/ui.jsx';

export default function Rates() {
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/rates');
  const [f, setF] = useState({ product: 'loan', ratePct: '', effectiveFrom: '' });
  const [err, setErr] = useState(null);
  if (loading && !data) return <Loading />;
  if (error) return <LoadError error={error} retry={reload} />;

  const submit = async (e) => {
    e.preventDefault(); setErr(null);
    try { await api('/rates', { method: 'POST', body: { product: f.product, ratePct: Number(f.ratePct), ...(f.effectiveFrom ? { effectiveFrom: f.effectiveFrom } : {}) } }); toast.success('Rate saved'); setF({ ...f, ratePct: '', effectiveFrom: '' }); reload(); }
    catch (e2) { setErr(e2); }
  };
  const { savings, loan } = data.current;
  return (
    <>
      <PageHead title="Interest rates" subtitle="Rates are per year. A new rate applies from its start date; existing loans keep the rate they were approved at." />
      <div className="grid cols-2">
        <Stat label="Savings interest" value={savings ? `${savings.ratePct}%` : 'Not set'} sub="paid monthly on balances" />
        <Stat label="Loan interest" value={loan ? `${loan.ratePct}%` : 'Not set'} sub="reducing balance" />
      </div>
      {can('rate:manage') && (
        <form className="card grid" style={{ marginTop: '1rem' }} onSubmit={submit}>
          <div className="card-head" style={{ margin: 0 }}><h2>Set a new rate</h2></div>
          <ErrorBox error={err} />
          <div className="form-grid">
            <Field label="Product"><select value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })}><option value="loan">Loan</option><option value="savings">Savings</option></select></Field>
            <Field label="Rate (% per year)"><input type="number" min="0" max="100" step="0.01" required value={f.ratePct} onChange={(e) => setF({ ...f, ratePct: e.target.value })} /></Field>
            <Field label="Effective from" hint="Leave empty to start now"><input type="date" value={f.effectiveFrom} onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} /></Field>
          </div>
          <div><button className="btn">Save rate</button></div>
        </form>
      )}
      <div className="card"><div className="card-head"><h2>History</h2></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Product</th><th className="num">Rate</th><th>Effective from</th></tr></thead>
          <tbody>{data.history.map((h) => <tr key={h.id}><td><Badge value={h.product === 'loan' ? 'blue' : 'active'} /> {h.product}</td><td className="num">{h.ratePct}%</td><td><DateText value={h.effectiveFrom} /></td></tr>)}</tbody></table></div>
      </div>
    </>
  );
}
