// Probeer verschillende prompt-varianten om te zien welke niet wordt geblokkeerd
import '../lib/env.js';
import { openai, IMAGE_MODEL, IMAGE_FALLBACK_MODEL } from '../lib/openai-client.js';
import fs from 'node:fs';

async function tryPrompt(label, prompt, model = IMAGE_MODEL) {
  console.log(`\n=== ${label} (${model}) ===\nPROMPT: ${prompt.slice(0, 180)}...`);
  try {
    const resp = await openai.images.generate({ model, prompt, size: '1024x1024', n: 1 });
    const d = resp.data?.[0];
    if (d?.b64_json) {
      fs.writeFileSync(`/tmp/img-${label}.png`, Buffer.from(d.b64_json, 'base64'));
      console.log(`✓ succes, /tmp/img-${label}.png`);
      return true;
    }
    if (d?.url) {
      console.log(`✓ succes via URL`);
      return true;
    }
  } catch (err) {
    console.log(`✗ ${err.message.slice(0, 140)}`);
    return false;
  }
}

await tryPrompt('A-minimal', 'A whimsical watercolor illustration of a bunny hopping in a garden of flowers, soft pastel colors, picture book style.');
await tryPrompt('B-with-figure', 'Watercolor picture-book illustration. A small whimsical cartoon figure with brown braids in a pink dress laughs in a sunny flower garden. A fluffy white rabbit hops beside. Soft pastel colors, Oliver Jeffers style, no text, no logos.');
await tryPrompt('C-family', 'Whimsical storybook watercolor scene: a small character in a pink dress and a fluffy white rabbit share a moment in a flower garden. Soft pastel palette, hand-painted texture, warm bedtime mood. No text, no logos.');
await tryPrompt('D-dalle-minimal', 'A whimsical watercolor illustration of a small cartoon person with brown braids in a pink dress, laughing in a sunny garden of flowers with a fluffy white rabbit beside them. Soft pastel colors, Oliver Jeffers picture-book style, hand-painted texture. No text.', IMAGE_FALLBACK_MODEL);
