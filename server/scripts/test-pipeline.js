// Test pipeline end-to-end zonder payment
import '../lib/env.js';
import { nanoid } from 'nanoid';
import { createOrder, updateOrder } from '../lib/db.js';
import { runPipeline } from '../lib/generation-pipeline.js';

const testOrder = {
  id: nanoid(16),
  createdAt: Date.now(),
  purchaseType: 'own_child',
  childFirstName: 'Mila',
  childAge: 5,
  ageSegment: '3-5',
  theme: 'eenhoorns',
  storyTone: 'lief',
  illustrationStyle: 'warme-waterverf',
  favoriteAnimal: 'konijn',
  hobby: 'dansen',
  friendName: 'Lotte',
  moral: 'vriendschap',
  senderNote: null,
  parentEmail: 'test@voorbeeld.nl',
  consentPrivacy: true,
  consentDigitalDelivery: true,
};

createOrder(testOrder);
updateOrder(testOrder.id, { paymentStatus: 'paid' });
console.log(`[test] running pipeline for ${testOrder.id}`);

const start = Date.now();
try {
  const result = await runPipeline(testOrder.id);
  const elapsed = (Date.now() - start) / 1000;
  console.log(`[test] ✓ klaar in ${elapsed.toFixed(1)}s`);
  console.log(`[test] PDF: ${result.pdfPath}`);
  console.log(`[test] mail: ${result.mailResult.mode}`);
} catch (err) {
  const elapsed = (Date.now() - start) / 1000;
  console.error(`[test] ✗ faalde na ${elapsed.toFixed(1)}s:`, err.message);
  process.exit(1);
}
