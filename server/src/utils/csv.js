// Minimal CSV writer. Cells that start with = + - @ are prefixed with a quote so Excel cannot run them as formulas.
function cell(v) {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(columns, rows) {
  const head = columns.map((c) => cell(c.label)).join(',');
  const lines = rows.map((r) => columns.map((c) => cell(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(','));
  return [head, ...lines].join('\r\n') + '\r\n';
}
module.exports = { toCsv };
