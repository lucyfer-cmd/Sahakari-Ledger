// Mirrors the server's password rules so the user gets instant feedback. The server always re-checks.
export const passwordChecks = (pw) => [
  { ok: pw.length >= 10, text: 'At least 10 characters' },
  { ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw), text: 'Upper-case and lower-case letters' },
  { ok: /\d/.test(pw), text: 'At least one digit' },
  { ok: /[^A-Za-z0-9]/.test(pw), text: 'At least one symbol' },
];
