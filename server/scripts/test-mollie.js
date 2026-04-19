// Test Mollie payment create met test-key
import '../lib/env.js';
import { createMolliePayment, fetchMolliePayment, getMollieMode } from '../lib/mollie.js';

console.log('Mollie mode:', getMollieMode());

const order = {
  id: 'testOrder01234567',
  parentEmail: 'test@example.nl',
};

try {
  const payment = await createMolliePayment({
    order,
    redirectUrl: 'https://example.com/bedankt',
    webhookUrl: 'https://example.com/api/webhooks/mollie',
    amount: 4.95,
  });
  console.log('\u2713 created:', JSON.stringify(payment, null, 2));
  const fetched = await fetchMolliePayment(payment.id);
  console.log('\u2713 fetched status:', fetched?.status);
} catch (err) {
  console.error('\u2717 failed:', err?.message || err);
  process.exit(1);
}
