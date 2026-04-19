// Genereer 3 voorbeeld-boekjes + plaats in public/examples/
import '../lib/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import { createOrder, updateOrder } from '../lib/db.js';
import { runPipeline } from '../lib/generation-pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = path.resolve(__dirname, '../../public/examples');
fs.mkdirSync(EXAMPLES_DIR, { recursive: true });

const CASES = [
  {
    key: 'caseA',
    purchaseType: 'own_child',
    childFirstName: 'Mila', childAge: 5, ageSegment: '3-5',
    theme: 'eenhoorns', storyTone: 'lief', illustrationStyle: 'warme-waterverf',
    favoriteAnimal: 'konijn', hobby: 'dansen', friendName: 'Lotte',
    moral: 'vriendschap', senderNote: null,
    parentEmail: 'voorbeeld@jouwvoorleesboekje.nl',
  },
  {
    key: 'caseB',
    purchaseType: 'own_child',
    childFirstName: 'Daan', childAge: 8, ageSegment: '6-8',
    theme: 'jungle', storyTone: 'avontuurlijk', illustrationStyle: 'warme-waterverf',
    favoriteAnimal: 'tijger', hobby: 'voetbal', friendName: 'Tim',
    moral: 'moed', senderNote: null,
    parentEmail: 'voorbeeld@jouwvoorleesboekje.nl',
  },
  {
    key: 'caseC',
    purchaseType: 'own_child',
    childFirstName: 'Zoë', childAge: 10, ageSegment: '9-10',
    theme: 'mysterie', storyTone: 'spannend_maar_veilig', illustrationStyle: 'warme-waterverf',
    favoriteAnimal: 'vos', hobby: 'tekenen', friendName: null,
    moral: 'doorzettingsvermogen', senderNote: null,
    parentEmail: 'voorbeeld@jouwvoorleesboekje.nl',
  },
];

for (const c of CASES) {
  // Skip als voorbeeld al bestaat
  const destPdf = path.join(EXAMPLES_DIR, `${c.key}.pdf`);
  const destCover = path.join(EXAMPLES_DIR, `${c.key}-cover.png`);
  if (fs.existsSync(destPdf) && fs.existsSync(destCover)) {
    console.log(`[seed] ${c.key} bestaat al, overslaan`);
    continue;
  }
  const id = nanoid(16);
  const order = { id, createdAt: Date.now(), ...c, consentPrivacy: true, consentDigitalDelivery: true };
  createOrder(order);
  updateOrder(id, { paymentStatus: 'paid' });

  console.log(`[seed] ${c.key} -> order ${id}, pipeline start…`);
  const t0 = Date.now();
  try {
    const { pdfPath } = await runPipeline(id, { skipEmail: true });
    const imagesDir = path.resolve(__dirname, '../../tmp/orders', id);
    const coverSrc = path.join(imagesDir, 'cover.png');
    fs.copyFileSync(pdfPath, destPdf);
    if (fs.existsSync(coverSrc)) fs.copyFileSync(coverSrc, destCover);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[seed] ✓ ${c.key} klaar in ${elapsed}s → ${destPdf}`);
  } catch (err) {
    console.error(`[seed] ✗ ${c.key} faalde:`, err.message);
  }
}
console.log('[seed] klaar');
