// Jouw Voorleesboekje — Express backend (poort 8000)
import './lib/env.js';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import { z } from 'zod';

import { createOrder, getOrder, updateOrder, listRecentOrders, deleteChildDataOlderThan } from './lib/db.js';
import { checkBlocklistFields } from './lib/blocklist.js';
import { fullModerationCheck } from './lib/moderation.js';
import { createMolliePayment, fetchMolliePayment, getMollieMode } from './lib/mollie.js';
import { runPipeline } from './lib/generation-pipeline.js';
import { sendTestEmail } from './lib/mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PDF_DIR = process.env.PDF_DIR || path.join(ROOT, 'tmp/pdfs');
const LEGAL_DIR = path.join(ROOT, 'legal');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ---- Statische file serving (frontend + voorbeeld-PDFs + public assets) ----
app.use('/', express.static(PUBLIC_DIR, { extensions: ['html'] }));

// ---- Validation schemas ----
const OrderCreateSchema = z.object({
  purchaseType: z.enum(['own_child', 'gift']).default('own_child'),
  childFirstName: z.string().min(1).max(40),
  childAge: z.number().int().min(2).max(12),
  ageSegment: z.enum(['3-5', '6-8', '9-10']),
  theme: z.string().min(1).max(40),
  storyTone: z.string().min(1).max(40),
  illustrationStyle: z.string().default('warme-waterverf'),
  favoriteAnimal: z.string().min(1).max(40),
  hobby: z.string().min(1).max(80),
  friendName: z.string().max(40).nullable().optional(),
  moral: z.string().max(40).nullable().optional(),
  senderNote: z.string().max(300).nullable().optional(),
  parentEmail: z.string().email().max(120),
  consentPrivacy: z.boolean(),
  consentDigitalDelivery: z.boolean(),
});

// ---- Health ----
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    ts: Date.now(),
    openaiKey: !!process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('placeholder'),
    mollieReal: !!process.env.MOLLIE_API_KEY && process.env.MOLLIE_API_KEY !== 'test_placeholder',
    resendReal: !!process.env.RESEND_API_KEY && !(process.env.RESEND_API_KEY || '').startsWith('placeholder'),
  });
});

// ---- Create order (met input-validatie, blocklist, moderation) ----
app.post('/api/orders', async (req, res) => {
  try {
    const parsed = OrderCreateSchema.parse(req.body);
    if (!parsed.consentPrivacy || !parsed.consentDigitalDelivery) {
      return res.status(400).json({ error: 'Toestemming is verplicht.' });
    }
    // Snelle blocklist-check
    const block = checkBlocklistFields({
      childFirstName: parsed.childFirstName,
      favoriteAnimal: parsed.favoriteAnimal,
      hobby: parsed.hobby,
      friendName: parsed.friendName,
      senderNote: parsed.senderNote,
    });
    if (block) {
      return res.status(422).json({
        error: 'blocklist',
        field: block.field,
        category: block.category,
        message: block.message,
      });
    }
    // OpenAI moderation op vrije velden
    const combined = [parsed.childFirstName, parsed.favoriteAnimal, parsed.hobby, parsed.friendName, parsed.senderNote]
      .filter(Boolean).join(' | ');
    const mod = await fullModerationCheck(combined, {
      childFirstName: parsed.childFirstName,
      favoriteAnimal: parsed.favoriteAnimal,
      hobby: parsed.hobby,
      friendName: parsed.friendName,
      senderNote: parsed.senderNote,
    });
    if (!mod.ok) {
      return res.status(422).json({ error: 'moderation', reason: mod.reason, message: mod.message });
    }

    const id = nanoid(16);
    const order = {
      id,
      createdAt: Date.now(),
      ...parsed,
    };
    createOrder(order);
    console.log(`[orders] created ${id} — segment=${parsed.ageSegment} thema=${parsed.theme}`);
    res.json({ orderId: id });
  } catch (err) {
    if (err?.issues) {
      return res.status(400).json({ error: 'validation', issues: err.issues });
    }
    console.error('[orders] create fout:', err);
    res.status(500).json({ error: 'server', message: err.message });
  }
});

// ---- Start payment (Mollie or mock) ----
app.post('/api/orders/:id/payment', async (req, res) => {
  try {
    const order = getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'not_found' });
    if (order.paymentStatus === 'paid') {
      return res.json({ alreadyPaid: true, orderId: order.id });
    }
    const price = Number(process.env.DEFAULT_PRODUCT_PRICE_EUR || 4.95);
    // Build redirect/webhook URLs uit request (zelfde host als proxy)
    const base = req.body?.publicBase || `${req.protocol}://${req.get('host')}`;
    const redirectUrl = `${base}/?page=betaling-status&orderId=${order.id}`;
    const webhookUrl = `${base}/api/webhooks/mollie`;
    const payment = await createMolliePayment({ order, redirectUrl, webhookUrl, amount: price });
    updateOrder(order.id, { molliePaymentId: payment.id });
    res.json({ checkoutUrl: payment.checkoutUrl, paymentId: payment.id, mode: payment.mode });
  } catch (err) {
    console.error('[payment] fout:', err);
    res.status(500).json({ error: 'payment_failed', message: err.message });
  }
});

// ---- Mollie webhook ----
app.post('/api/webhooks/mollie', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const paymentId = req.body?.id || req.query?.id;
    if (!paymentId) return res.status(400).send('no id');
    const payment = await fetchMolliePayment(paymentId);
    if (!payment) return res.status(404).send('not found');
    const orderId = payment.metadata?.orderId;
    if (!orderId) return res.status(400).send('no order');
    const order = getOrder(orderId);
    if (!order) return res.status(404).send('order gone');

    if (payment.status === 'paid' && order.paymentStatus !== 'paid') {
      updateOrder(orderId, { paymentStatus: 'paid' });
      // Trigger generatie async (niet in webhook-req wachten)
      triggerGeneration(orderId);
    } else if (['failed', 'canceled', 'expired'].includes(payment.status)) {
      updateOrder(orderId, { paymentStatus: payment.status });
    }
    res.status(200).send('ok');
  } catch (err) {
    console.error('[webhook] fout:', err);
    res.status(500).send('error');
  }
});

// ---- Mock payment confirm (voor mock checkout) ----
app.post('/api/orders/:id/mock-confirm', async (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  if (order.paymentStatus !== 'paid') {
    updateOrder(req.params.id, { paymentStatus: 'paid' });
    triggerGeneration(req.params.id);
  }
  res.json({ ok: true });
});

// ---- Status polling ----
app.get('/api/orders/:id/status', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  res.json({
    orderId: order.id,
    paymentStatus: order.paymentStatus,
    generationStatus: order.generationStatus,
    generationError: order.generationError,
    title: order.generatedStoryTitle,
    hasPdf: !!order.pdfPath && fs.existsSync(order.pdfPath),
    deliveredAt: order.deliveredAt,
  });
});

// ---- Download PDF ----
app.get('/api/orders/:id/pdf', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order || !order.pdfPath) return res.status(404).send('niet gevonden');
  if (!fs.existsSync(order.pdfPath)) return res.status(410).send('verlopen');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="voorleesboekje-${order.id.slice(0, 6)}.pdf"`);
  fs.createReadStream(order.pdfPath).pipe(res);
});

// ---- Email preview (voor preview-mode) ----
app.get('/api/orders/:id/email-preview', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order || !order.emailPreviewHtml) return res.status(404).send('no preview');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(order.emailPreviewHtml);
});

// ---- Legal (markdown) ----
app.get('/api/legal/:name', (req, res) => {
  const name = req.params.name.replace(/[^a-z0-9\-]/gi, '');
  const file = path.join(LEGAL_DIR, `${name}.md`);
  if (!fs.existsSync(file)) {
    return res.json({ markdown: `# ${name}\n\nDeze tekst wordt binnenkort toegevoegd.\n\nIn ontwikkeling.` });
  }
  res.json({ markdown: fs.readFileSync(file, 'utf8') });
});

// ---- Admin: simple password-guard via query/header ----
function adminAuth(req, res, next) {
  const pw = process.env.ADMIN_PASSWORD || 'testtest';
  const given = req.query?.pw || req.headers['x-admin-pw'] || req.body?.pw;
  if (given !== pw) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.get('/api/admin/orders', adminAuth, (_req, res) => {
  const orders = listRecentOrders(50);
  // Maskeer gevoelige velden
  const masked = orders.map(o => ({
    id: o.id,
    createdAt: o.createdAt,
    ageSegment: o.ageSegment,
    theme: o.theme,
    paymentStatus: o.paymentStatus,
    generationStatus: o.generationStatus,
    generationError: o.generationError,
    title: o.generatedStoryTitle,
    deliveredAt: o.deliveredAt,
    // email partially masked
    email: o.parentEmail ? o.parentEmail.replace(/(.).*(@.*)/, '$1***$2') : null,
  }));
  res.json({ orders: masked });
});

app.get('/api/admin/stats', adminAuth, (_req, res) => {
  const orders = listRecentOrders(1000);
  const total = orders.length;
  const paid = orders.filter(o => o.paymentStatus === 'paid').length;
  const completed = orders.filter(o => o.generationStatus === 'completed').length;
  const failed = orders.filter(o => o.generationStatus === 'failed').length;
  const delivered = orders.filter(o => o.deliveredAt);
  const avgMs = delivered.length
    ? Math.round(delivered.reduce((s, o) => s + (o.deliveredAt - o.createdAt), 0) / delivered.length)
    : null;
  res.json({
    total, paid, completed, failed,
    successRate: paid ? +(completed / paid * 100).toFixed(1) : 0,
    avgGenerationMs: avgMs,
  });
});

app.post('/api/admin/force-error/:id', adminAuth, (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  updateOrder(req.params.id, { generationStatus: 'failed', generationError: 'admin_forced_error' });
  res.json({ ok: true });
});

app.post('/api/admin/regenerate/:id', adminAuth, (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  updateOrder(req.params.id, {
    generationStatus: 'idle', generationError: null, pdfPath: null, deliveredAt: null,
  });
  triggerGeneration(req.params.id);
  res.json({ ok: true });
});

app.post('/api/admin/cleanup', adminAuth, (_req, res) => {
  // Verwijder kindgegevens >72u
  const cutoff72h = Date.now() - 72 * 3600 * 1000;
  const deleted = deleteChildDataOlderThan(cutoff72h);
  // Verwijder PDF's >30d
  const cutoff30d = Date.now() - 30 * 24 * 3600 * 1000;
  let pdfsDeleted = 0;
  const orders = listRecentOrders(10000);
  for (const o of orders) {
    if (o.pdfPath && o.createdAt < cutoff30d && fs.existsSync(o.pdfPath)) {
      try { fs.unlinkSync(o.pdfPath); pdfsDeleted++; updateOrder(o.id, { pdfPath: null }); } catch {}
    }
  }
  res.json({ ok: true, childDataCleaned: deleted, pdfsDeleted });
});

// Simuleer 'paid' zonder publieke webhook — nuttig voor lokale/sandbox-testen
app.post('/api/admin/simulate-paid/:id', adminAuth, async (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  if (order.paymentStatus !== 'paid') {
    updateOrder(req.params.id, { paymentStatus: 'paid' });
    triggerGeneration(req.params.id);
  }
  res.json({ ok: true, orderId: order.id, previousPaymentStatus: order.paymentStatus });
});

app.post('/api/admin/test-email', adminAuth, async (req, res) => {
  const to = req.body?.to || req.query?.to;
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  const result = await sendTestEmail(to);
  res.json(result);
});

app.post('/api/admin/run-pipeline/:id', adminAuth, async (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  updateOrder(req.params.id, { paymentStatus: 'paid' });
  triggerGeneration(req.params.id);
  res.json({ ok: true });
});

// ---- Serve PDF files direct vanaf /files/ (signed zou beter zijn; voor MVP: serve-only-if-order-id-matches) ----

// ---- Trigger async pipeline ----
async function triggerGeneration(orderId) {
  try {
    await runPipeline(orderId);
  } catch (err) {
    console.error(`[generation ${orderId}] pipeline error:`, err.message);
    updateOrder(orderId, { generationStatus: 'failed', generationError: err.message?.slice(0, 500) });
  }
}

// ---- Start ----
const PORT = Number(process.env.PORT || 8000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] Jouw Voorleesboekje luistert op :${PORT}`);
  console.log(`[server] OpenAI key: ${process.env.OPENAI_API_KEY ? '✓ aanwezig' : '✗ ontbreekt'}`);
  console.log(`[server] Mollie: ${getMollieMode().toUpperCase()}`);
  console.log(`[server] Resend: ${process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.startsWith('placeholder') ? 'REAL' : 'PREVIEW'}`);
});

export default app;
