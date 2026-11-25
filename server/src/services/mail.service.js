const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;
function getTransporter() {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

async function sendPasswordResetEmail(to, link) {
  const t = getTransporter();
  if (!t) {
    // Development fallback: no SMTP configured, so show the link in the server console.
    console.log(`[mail:dev] Password reset link for ${to}: ${link}`);
    return;
  }
  await t.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: 'Reset your Sahakari Ledger password',
    text: `Use this link to choose a new password. It expires in ${env.RESET_TOKEN_TTL_MINUTES} minutes.\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
  });
}

module.exports = { sendPasswordResetEmail };
