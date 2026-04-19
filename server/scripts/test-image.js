// Isolatie-test: ��n image met gesanitiseerde prompt
import '../lib/env.js';
import { buildImagePrompt, buildCoverPrompt, generateImage } from '../lib/image-generator.js';

const characterSheet = {
  name: 'Mila', age: 5,
  hairColor: 'lichtbruin',
  hairStyle: 'twee vlechten',
  outfit: 'roze jurk met witte stippen',
  animalDescription: 'a small fluffy white rabbit with long ears',
  animalWord: 'konijn',
};

const scenePrompt = buildImagePrompt({
  sceneDescription: 'A young storybook character and a fluffy white rabbit are in a sunny garden, surrounded by flowers. The protagonist is giggling while the rabbit hops nearby.',
  characterSheet,
  illustrationStyle: 'warme-waterverf',
});
console.log('PROMPT:\n', scenePrompt, '\n---');

const start = Date.now();
try {
  const out = '/tmp/image-test.png';
  await generateImage({ prompt: scenePrompt, outPath: out, retries: 1 });
  console.log(`\u2713 saved to ${out} in ${((Date.now()-start)/1000).toFixed(1)}s`);
} catch (err) {
  console.error(`\u2717 failed: ${err.message}`);
  process.exit(1);
}
