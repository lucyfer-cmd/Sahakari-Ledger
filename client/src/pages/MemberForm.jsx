import { useState } from 'react';
import { api } from '../api/http.js';
import Modal from '../components/Modal.jsx';
import { ErrorBox, Field } from '../components/ui.jsx';

const blank = { fullName: '', phone: '', email: '', dob: '', gender: '', address: { ward: '', municipality: '', district: '' }, nominee: { name: '', relation: '', phone: '' } };

/** Used both to register a new member and to edit an existing one. */
export default function MemberForm({ member, onClose, onSaved }) {
  const [f, setF] = useState(member ? {
    ...blank, ...member, dob: member.dob ? member.dob.slice(0, 10) : '', gender: member.gender || '',
    address: { ...blank.address, ...member.address }, nominee: { ...blank.nominee, ...member.nominee },
  } : blank);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const top = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const nest = (g, k) => (e) => setF({ ...f, [g]: { ...f[g], [k]: e.target.value } });

  const submit = async (e) => {
    e.preventDefault(); setError(null); setBusy(true);
    const body = { fullName: f.fullName, phone: f.phone, email: f.email, dob: f.dob || undefined, gender: f.gender || undefined, address: f.address, nominee: f.nominee };
    try {
      const res = member ? await api(`/members/${member.id}`, { method: 'PATCH', body }) : await api('/members', { method: 'POST', body });
      onSaved(res.member);
    } catch (err) { setError(err); } finally { setBusy(false); }
  };
  return (
    <Modal title={member ? 'Edit member' : 'Register a member'} onClose={onClose}
      footer={<><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button form="member-form" className="btn" disabled={busy}>{busy ? 'Saving...' : 'Save member'}</button></>}>
      <form id="member-form" onSubmit={submit} className="grid">
        <ErrorBox error={error} />
        <div className="form-grid">
          <Field label="Full name" className="full"><input required value={f.fullName} onChange={top('fullName')} /></Field>
          <Field label="Phone"><input required inputMode="tel" value={f.phone} onChange={top('phone')} /></Field>
          <Field label="Email (optional)"><input type="email" value={f.email} onChange={top('email')} /></Field>
          <Field label="Date of birth"><input type="date" value={f.dob} onChange={top('dob')} /></Field>
          <Field label="Gender"><select value={f.gender} onChange={top('gender')}><option value="">Not stated</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></Field>
        </div>
        <h3 style={{ marginTop: '.4rem' }}>Address</h3>
        <div className="form-grid">
          <Field label="Ward"><input value={f.address.ward} onChange={nest('address', 'ward')} /></Field>
          <Field label="Municipality"><input value={f.address.municipality} onChange={nest('address', 'municipality')} /></Field>
          <Field label="District" className="full"><input value={f.address.district} onChange={nest('address', 'district')} /></Field>
        </div>
        <h3 style={{ marginTop: '.4rem' }}>Nominee</h3>
        <div className="form-grid">
          <Field label="Name"><input value={f.nominee.name} onChange={nest('nominee', 'name')} /></Field>
          <Field label="Relation"><input value={f.nominee.relation} onChange={nest('nominee', 'relation')} /></Field>
          <Field label="Phone"><input value={f.nominee.phone} onChange={nest('nominee', 'phone')} /></Field>
        </div>
      </form>
    </Modal>
  );
}
