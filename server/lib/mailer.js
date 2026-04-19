// Resend mailer met domein-fallback + error-logging
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resend } from 'resend';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(__dirname, '../../logs');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function logMailEvent(type, data) {
  try {
    ensureLogDir();
    const line = JSON.stringify({ ts: new Date().toISOString(), type, ...data }) + '\n';
    fs.appendFileSync(path.join(LOG_DIR, 'mail.log'), line);
  } catch (e) {
    console.warn('[mail] log schrijven faalde:', e.message);
  }
}

function isRealKey() {
  const k = process.env.RESEND_API_KEY || '';
  return k && !k.toLowerCase().startsWith('placeholder') && k.length > 10;
}

function getFromAddress() {
  // Als het eigen domein nog NIET geverifieerd is in Resend, gebruik onboarding@resend.dev.
  // Dat is Resend's universele sandbox-afzender die werkt zonder DNS-setup.
  const verified = (process.env.RESEND_DOMAIN_VERIFIED || '').toLowerCase() === 'true';
  if (verified) {
    return process.env.RESEND_FROM_EMAIL || 'hallo@jouwvoorleesboekje.nl';
  }
  return 'Jouw Voorleesboekje <onboarding@resend.dev>';
}

function buildHtml({ order, story }) {
  const name = order.childFirstName || 'het kindje';
  const title = story?.title || 'Jouw voorleesboekje is klaar';
  return `<!DOCTYPE html>
<html lang="nl"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: -apple-system, system-ui, sans-serif; background:#FFF8F0; padding:32px;">
  <div style="max-width:540px; margin:0 auto; background:#fff; border-radius:16px; padding:32px; box-shadow:0 4px 20px rgba(30,42,74,.08);">
    <h1 style="color:#1E2A4A; font-size:24px; margin:0 0 8px 0;">Jouw voorleesboekje is klaar! 📖</h1>
    <p style="color:#7A8BB0; margin-top:0;">Een persoonlijk verhaal speciaal voor ${name}.</p>
    <div style="margin:24px 0; padding:20px; background:#FFE8D6; border-radius:12px;">
      <p style="margin:0 0 8px 0; font-weight:600; color:#1E2A4A;">${title}</p>
      <p style="margin:0; color:#1E2A4A;">De PDF zit als bijlage bij deze e-mail. Veel voorleesplezier!</p>
    </div>
    <p style="color:#1E2A4A; line-height:1.6;">
      Tip: bekijk het boekje eerst zelf, zodat je op de juiste toon kunt voorlezen. Welterusten-verhalen werken het best als jullie samen rustig zitten.
    </p>
    <hr style="border:none; border-top:1px solid #F1E3D2; margin:24px 0;">
    <p style="color:#7A8BB0; font-size:13px; line-height:1.5;">
      Verhaal en illustraties zijn met AI gegenereerd en automatisch gecontroleerd op kindveiligheid.<br>
      Je PDF blijft 30 dagen beschikbaar. Kindgegevens verwijderen we automatisch binnen 72 uur.<br>
      Vragen? Reageer op deze mail of stuur een berichtje naar hallo@jouwvoorleesboekje.nl.
    </p>
    <p style="color:#7A8BB0; font-size:12px; margin-top:16px;">
      Order: ${order.id}
    </p>
  </div>
</body></html>`;
}

function buildTestHtml(to) {
  return `<!DOCTYPE html>
<html lang="nl"><body style="font-family: system-ui, sans-serif; padding:24px; background:#FFF8F0;">
  <div style="max-width:480px; margin:0 auto; background:#fff; padding:24px; border-radius:12px;">
    <h2 style="color:#1E2A4A;">Testmail — Jouw Voorleesboekje</h2>
    <p>Als je deze mail ontvangt op <strong>${to}</strong>, werkt de Resend-integratie 🎉</p>
    <p style="color:#7A8BB0; font-size:13px;">Verzonden via Resend${
      (process.env.RESEND_DOMAIN_VERIFIED || '').toLowerCase() === 'true'
        ? ' vanaf geverifieerd domein'
        : ' via onboarding@resend.dev (eigen domein nog niet geverifieerd)'
    }.</p>
  </div>
</body></html>`;
}

/**
 * Stuur de aflever-mail met PDF als bijlage.
 * Return: { mode, id?, previewHtml, error? }
 *   mode = 'sent' | 'preview' | 'skipped' | 'failed'
 * Bij fouten: log naar logs/mail.log, val terug op preview (PDF blijft beschikbaar via download-link).
 */
export async function sendDeliveryEmail({ order, story, pdfPath, skip = false }) {
  const html = buildHtml({ order, story });
  if (skip) return { mode: 'skipped', previewHtml: html };
  if (!isRealKey()) {
    console.log(`[mail DRY-RUN] Order ${order.id} — zou verzonden zijn naar ${order.parentEmail}`);
    logMailEvent('dry_run', { orderId: order.id, to: order.parentEmail });
    return { mode: 'preview', previewHtml: html };
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const attachments = fs.existsSync(pdfPath)
      ? [{ filename: 'voorleesboekje.pdf', content: fs.readFileSync(pdfPath).toString('base64') }]
      : [];
    const from = getFromAddress();
    const result = await resend.emails.send({
      from,
      to: [order.parentEmail],
      subject: `Jouw voorleesboekje is klaar — ${story?.title || ''}`.trim(),
      html,
      attachments,
    });
    if (result?.error) {
      const errMsg = result.error.message || JSON.stringify(result.error);
      console.error('[mail] Resend API error:', errMsg);
      logMailEvent('error', { orderId: order.id, to: order.parentEmail, from, error: errMsg });
      return { mode: 'failed', previewHtml: html, error: errMsg };
    }
    console.log(`[mail] verzonden naar ${order.parentEmail} (id=${result?.data?.id})`);
    logMailEvent('sent', { orderId: order.id, to: order.parentEmail, from, id: result?.data?.id });
    return { mode: 'sent', id: result?.data?.id, previewHtml: html };
  } catch (err) {
    const msg = err?.message || String(err);
    console.error('[mail] uitzondering bij verzenden:', msg);
    logMailEvent('exception', { orderId: order.id, to: order.parentEmail, error: msg });
    return { mode: 'failed', previewHtml: html, error: msg };
  }
}

/**
 * Test-endpoint helper: stuur een simpele testmail.
 */
export async function sendTestEmail(toAddress) {
  if (!isRealKey()) {
    return { mode: 'preview', reason: 'no_api_key', previewHtml: buildTestHtml(toAddress) };
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = getFromAddress();
    const result = await resend.emails.send({
      from,
      to: [toAddress],
      subject: 'Testmail van Jouw Voorleesboekje',
      html: buildTestHtml(toAddress),
    });
    if (result?.error) {
      const errMsg = result.error.message || JSON.stringify(result.error);
      logMailEvent('test_error', { to: toAddress, from, error: errMsg });
      return { mode: 'failed', from, error: errMsg };
    }
    logMailEvent('test_sent', { to: toAddress, from, id: result?.data?.id });
    return { mode: 'sent', from, id: result?.data?.id };
  } catch (err) {
    const msg = err?.message || String(err);
    logMailEvent('test_exception', { to: toAddress, error: msg });
    return { mode: 'failed', error: msg };
  }
}
