export default function AuthShell({ children }) {
  return (
    <div className="auth">
      <aside className="auth-hero">
        <div className="brand" style={{ padding: 0 }}><span className="brand-mark">S</span> Sahakari Ledger</div>
        <div>
          <h2>Savings and loans you can trust.</h2>
          <ul>
            <li>Every transaction is sealed in a tamper-evident ledger.</li>
            <li>Members see their own balance, statements and loans.</li>
            <li>Staff work with clear roles and a full audit trail.</li>
          </ul>
        </div>
        <div className="small">Second Year Project, BSc (Hons) Computing</div>
      </aside>
      <main className="auth-panel">{children}</main>
    </div>
  );
}
