// Mollie iDEAL integratie (sandbox + productie)
// - Test-key (test_...) gebruikt Mollie's sandbox
// - Zonder geldige key draait er een \"mock\"-pad voor lokale testen
// - Alle Mollie-calls worden naar logs/mollie.log geschreven
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMollieClient } from '@mollie/api-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(__dirname, '../../logs');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function logMollie(type, data) {
  try {
    ensureLogDir();
    const line = JSON.stringify({ ts: new Date().toISOString(), type, ...data }) + '\n';
    fs.appendFileSync(path.join(LOG_DIR, 'mollie.log'), line);
  } catch (e) {
    console.warn('[mollie] log schrijven faalde:', e.message);
  }
}

function keyMode() {
  const k = process.env.MOLLIE_API_KEY || '';
  if (!k || k === 'test_placeholder' || k.length < 20) return 'mock';
  if (k.startsWith('test_')) return 'test';
  if (k.startsWith('live_')) return 'live';
  return 'mock';
}

let _client = null;
function getClient() {
  if (_client) return _client;
  if (keyMode() === 'mock') return null;
  _client = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });
  return _client;
}

export function getMollieMode() {
  return keyMode();
}

export async function createMolliePayment({ order, redirectUrl, webhookUrl, amount }) {
  const description = `Jouw Voorleesboekje — ${order.id.slice(0, 8)}`;
  const mode = keyMode();

  if (mode === 'mock') {
    logMollie('create_mock', { orderId: order.id, amount });
    return {
      mode: 'mock',
      id: `tr_mock_${order.id.slice(0, 10)}`,
      checkoutUrl: `/mock-ideal.html?orderId=${order.id}&amount=${amount}`,
      description,
    };
  }

  const client = getClient();
  try {
    const payload = {
      amount: { currency: 'EUR', value: amount.toFixed(2) },
      description,
      redirectUrl,
      // Mollie vereist publieke HTTPS webhookUrl. We geven 'm altijd mee; Mollie
      // accepteert/negeert 'm stil als niet bereikbaar. In dev/test gebruiken we
      // daarnaast /api/admin/simulate-paid.
      webhookUrl,
      method: 'ideal',
      metadata: { orderId: order.id },
      locale: 'nl_NL',
    };
    const payment = await client.payments.create(payload);
    logMollie('create_ok', {
      orderId: order.id,
      paymentId: payment.id,
      status: payment.status,
      mode,
      amount,
    });
    return {
      mode,
      id: payment.id,
      checkoutUrl: payment.getCheckoutUrl(),
      description,
      status: payment.status,
    };
  } catch (err) {
    const msg = err?.message || String(err);
    logMollie('create_error', { orderId: order.id, error: msg });
    throw err;
  }
}

export async function fetchMolliePayment(paymentId) {
  if (!paymentId) return null;
  if (paymentId.startsWith('tr_mock_')) {
    logMollie('fetch_mock', { paymentId });
    return { id: paymentId, status: 'paid', metadata: {} };
  }
  const client = getClient();
  if (!client) return null;
  try {
    const p = await client.payments.get(paymentId);
    logMollie('fetch_ok', { paymentId, status: p.status });
    return p;
  } catch (err) {
    const msg = err?.message || String(err);
    logMollie('fetch_error', { paymentId, error: msg });
    throw err;
  }
}
