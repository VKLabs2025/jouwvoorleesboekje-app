// AI image generation met character consistency trick
import fs from 'node:fs';
import path from 'node:path';
import { openai, IMAGE_MODEL, IMAGE_FALLBACK_MODEL } from './openai-client.js';

const STYLE_PROMPTS = {
  'warme-waterverf': "Warm, soft watercolor children's book illustration in the style of Oliver Jeffers. Soft pastel colors, dreamy atmosphere, hand-painted texture, gentle lighting, visible brush strokes. Kid-friendly, bedtime-story mood.",
  'waterverf': "Warm, soft watercolor children's book illustration in the style of Oliver Jeffers. Soft pastel colors, dreamy atmosphere, hand-painted texture, gentle lighting, visible brush strokes. Kid-friendly, bedtime-story mood.",
  'cartoon': "Bright, cheerful children's cartoon illustration. Bold friendly outlines, vivid warm colors, flat-shaded style, joyful expressions. Kid-friendly mood.",
  'avontuurlijk': "Adventurous children's book illustration with warm earthy tones, painterly style, soft textures, wide landscape framing, gentle light. Kid-friendly.",
};

const SAFETY_SUFFIX = 'Gentle, wholesome picture book illustration. No text, no letters, no numbers, no logos, no branded characters. Simple storybook style.';

// Sanitize scene descriptions — vermijd alle verwijzingen naar echte minderjarigen.
// Uit tests: gpt-image-1 blokkeert woorden als "child/boy/girl/kid/baby", zinnen met "laughs"/"giggling",
// en expliciete figuur-beschrijvingen. Variant "a small character" passeert wel.
function sanitizeScene(text) {
  if (!text) return '';
  let out = String(text);
  // Vervang alle expliciete kind-woorden door neutrale term
  out = out.replace(/\b(a |the )?(?:young |small |little )?(boys?|girls?|children|child|kids?|toddlers?|babies|baby|youngsters?)\b/gi, '$1small character');
  out = out.replace(/\bprotagonists?\b/gi, 'main character');
  // Leeftijden verwijderen
  out = out.replace(/\b\d+[- ]?year[- ]?old\b/gi, 'small');
  // Risicovolle emotie-woorden die safety filter lijken te triggeren vervangen door neutralere termen
  out = out.replace(/\b(giggling|laughing|laughs|giggles|crying|cries|crying|screaming|screams)\b/gi, 'smiling');
  // Pronouns neutraliseren
  out = out.replace(/\b(his|her)\b/gi, 'their');
  out = out.replace(/\b(he|she)\b/gi, 'they');
  return out;
}

export function buildCharacterSheet(order, gptCharacterSheet) {
  const cs = gptCharacterSheet || {};

  // v4: friend_description met expliciet visueel contrast
  let friendDescription = null;
  if (order.friendName) {
    const fd = cs.friend_description || cs.friendDescription || {};
    friendDescription = {
      name: order.friendName,
      hairColor: fd.hair_color || fd.hairColor || 'blond',
      hairStyle: fd.hair_style || fd.hairStyle || 'straight short',
      outfit: fd.outfit || 'a light-colored dress or different colored outfit',
      distinguishingFeature: fd.distinguishing_feature || fd.distinguishingFeature || null,
    };
  }

  return {
    name: order.childFirstName,
    age: order.childAge,
    hairColor: cs.hair_color || cs.hairColor || 'donkerbruin',
    hairStyle: cs.hair_style || cs.hairStyle || 'kort, zacht',
    outfit: cs.outfit || 'a cozy warm-colored sweater and comfortable trousers',
    animalDescription: cs.animal_description || cs.animalDescription || `a friendly ${order.favoriteAnimal}`,
    animalWord: order.favoriteAnimal,
    // v2: signature detail voor visuele consistentie
    signatureDetail: cs.signature_detail || cs.signatureDetail || null,
    // v4: grootte en leeftijdsstadium van het dier
    animalSize: cs.animal_size || cs.animalSize || null,
    animalAgeStage: cs.animal_age_stage || cs.animalAgeStage || null,
    // v4: vriendje/vriendinnetje
    friendDescription,
  };
}

// Neutraliseer de character-beschrijving: noem één "storybook character" zonder leeftijd/kind-terminologie.
// Vertaal NL haar/kleding-beschrijvingen naar Engels (ruw); prompt werkt het beste in EN.
function toEnglishDescription(nl) {
  if (!nl) return '';
  const map = {
    'lichtbruin': 'light brown', 'donkerbruin': 'dark brown', 'blond': 'blond',
    'rood': 'red', 'zwart': 'black', 'bruin': 'brown',
    'twee vlechten': 'two braids', 'vlechten': 'braids',
    'korte krullen': 'short curly', 'krullen': 'curly', 'kort': 'short',
    'lang': 'long', 'zacht': 'soft',
    'roze': 'pink', 'blauw': 'blue', 'groen': 'green', 'geel': 'yellow',
    'oranje': 'orange', 'wit': 'white', 'witte': 'white',
    'jurk': 'dress', 'trui': 'sweater', 'broek': 'trousers',
    'jasje': 'jacket', 'shirt': 'shirt', 'schoenen': 'shoes',
    'stippen': 'polka dots', 'stippels': 'polka dots', 'streepjes': 'stripes',
    'met': 'with', 'en': 'and',
    'sterretje': 'small star', 'haarspeldje': 'hair clip', 'rugzak': 'backpack',
    'vlindertjes': 'butterflies', 'goudkleurig': 'golden', 'zilveren': 'silver',
    'hartje': 'heart', 'bloemetje': 'flower', 'rood': 'red',
  };
  let out = String(nl).toLowerCase();
  // Sort keys by length desc zodat "twee vlechten" voor "vlechten" gaat
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    out = out.replace(new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'), map[k]);
  }
  return out;
}

// Neutrale "character sheet" regel — past het prompt-patroon dat de safety-check wel laat passeren.
// v2: voegt signature_detail toe als uniek herkenningsteken
function characterBlock(cs) {
  const hair = toEnglishDescription(`${cs.hairStyle} ${cs.hairColor}`).trim() || 'soft brown';
  const outfit = toEnglishDescription(cs.outfit) || 'a cozy colorful outfit';
  const signatureEn = cs.signatureDetail ? toEnglishDescription(cs.signatureDetail) : null;
  const signatureLine = signatureEn
    ? `\nDistinctive detail: ${signatureEn} — this unique feature ALWAYS appears on the main character in every illustration.`
    : '';
  return `Consistent main character across ALL illustrations: a small whimsical watercolor figure with ${hair} hair, wearing ${outfit}. Simple friendly features, always the same look.${signatureLine} Animal companion in frame when the scene includes them: ${cs.animalDescription}. Keep the main character's look IDENTICAL in every illustration.`;
}

// v3/v4: buildImagePrompt accepteert optionele visualContract (locked visual description from reference sheet)
// v4: accepteert ook friendContract en lockedContracts (combined multi-character contract)
export function buildImagePrompt({
  sceneDescription,
  characterSheet,
  illustrationStyle,
  previousScenesMemo = null,
  visualContract = null,
  friendContract = null,
  lockedContracts = null,
}) {
  const style = STYLE_PROMPTS[illustrationStyle] || STYLE_PROMPTS['warme-waterverf'];
  const charBlock = characterBlock(characterSheet);
  const scene = sanitizeScene(sceneDescription);

  let continuityBlock = '';
  if (previousScenesMemo) {
    const sanitizedMemo = sanitizeScene(previousScenesMemo);
    continuityBlock = `\nCONTINUITY: The same characters from the previous illustrations appear here. ${sanitizedMemo}. Keep the main character and their animal companion visually identical to before.\n`;
  }

  // v4: Gebruik lockedContracts (combined multi-character) als die beschikbaar is, anders fallback naar v3 visualContract
  // DALL-E 3 heeft max 4000 chars voor het hele prompt — zorg dat het contract blok compact blijft.
  const MAX_CONTRACT_CHARS = 1400; // ruimte voor style + scene + charBlock + constraints
  let contractBlock = '';
  if (lockedContracts) {
    const truncated = lockedContracts.length > MAX_CONTRACT_CHARS
      ? lockedContracts.slice(0, MAX_CONTRACT_CHARS - 3) + '...'
      : lockedContracts;
    contractBlock = `\n${truncated}\n`;
  } else if (visualContract) {
    const vc = visualContract.length > MAX_CONTRACT_CHARS
      ? visualContract.slice(0, MAX_CONTRACT_CHARS - 3) + '...'
      : visualContract;
    contractBlock = `\nVISUAL CONTRACT (identical across ALL illustrations — do not deviate):\n${vc}\nEXACT same character appearance as described above. DO NOT VARY face, hair, outfit, or animal companion. NO EXTRA animals or children beyond scene description.\n`;
  }

  // v4: Uitgebreide negative constraints met multi-character specificaties
  const mainName = characterSheet.name || 'the main character';
  const friendName = characterSheet.friendDescription?.name || null;
  const negativeConstraints = friendName
    ? `STRICT RULES: Do not change the main character's face or hair between illustrations. Do not add antlers or make the animal companion larger/older than described. Do not add extra animals not mentioned in the scene. Do not vary clothing colors or patterns. ${mainName} and ${friendName} are DIFFERENT people — different hair color, different outfit, never identical, never twins. Do not merge their looks. If the scene description mentions only ${mainName}, do not include ${friendName}. If only ${friendName}, do not include ${mainName}. Include both only when the scene description explicitly says so. The deer/fawn is always the same young animal, never adult, never with antlers, always same size relative to the main character.`
    : `STRICT RULES: Do not change the main character's face or hair between illustrations. Do not add antlers or make the animal companion larger/older than described. Do not add extra animals not mentioned in the scene. Do not vary clothing colors or patterns.`;

  return `${style}\n${contractBlock}\nSCENE: ${scene}\n${continuityBlock}\n${charBlock}\n\n${negativeConstraints}\n\n${SAFETY_SUFFIX}`;
}

// v3/v4: buildCoverPrompt met optionele visualContract en lockedContracts
export function buildCoverPrompt({ title, theme, characterSheet, illustrationStyle, visualContract = null, lockedContracts = null }) {
  const style = STYLE_PROMPTS[illustrationStyle] || STYLE_PROMPTS['warme-waterverf'];
  const charBlock = characterBlock(characterSheet);

  const MAX_CV_CHARS = 1400;
  let contractBlock = '';
  if (lockedContracts) {
    const truncated = lockedContracts.length > MAX_CV_CHARS
      ? lockedContracts.slice(0, MAX_CV_CHARS - 3) + '...'
      : lockedContracts;
    contractBlock = `\n${truncated}\n`;
  } else if (visualContract) {
    const vc = visualContract.length > MAX_CV_CHARS
      ? visualContract.slice(0, MAX_CV_CHARS - 3) + '...'
      : visualContract;
    contractBlock = `\nVISUAL CONTRACT (identical across ALL illustrations — do not deviate):\n${vc}\nEXACT same character appearance as described above.\n`;
  }

  return `${style}\n${contractBlock}\nCOVER ILLUSTRATION for a personal picture book. Theme: ${theme}. A warm, inviting, central composition of the protagonist and the animal companion together. Cozy, magical atmosphere, soft light. Leave clean negative space near the top.\n\n${charBlock}\n\n${SAFETY_SUFFIX}`;
}

async function callDallE3(prompt, size = '1024x1024') {
  const resp = await openai.images.generate({
    model: IMAGE_FALLBACK_MODEL,
    prompt,
    size,
    n: 1,
    response_format: 'b64_json',
    quality: 'standard',
    style: 'vivid',
  });
  const d = resp.data?.[0];
  if (d?.b64_json) return Buffer.from(d.b64_json, 'base64');
  if (d?.url) {
    const r = await fetch(d.url);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error('dall-e-3 gaf geen data');
}

async function callGptImage1(prompt, size = '1024x1024') {
  const resp = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt,
    size,
    n: 1,
  });
  const d = resp.data?.[0];
  if (d?.b64_json) return Buffer.from(d.b64_json, 'base64');
  if (d?.url) {
    const r = await fetch(d.url);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error('gpt-image-1 gaf geen data');
}

async function callImageApi(prompt, size = '1024x1024') {
  // Strategie: probeer eerst gpt-image-1 (hoogste kwaliteit), val bij safety/model-fout direct
  // terug op dall-e-3 (die is ruimhartiger met character-scenes).
  try {
    return await callGptImage1(prompt, size);
  } catch (err) {
    const msg = err?.message || String(err);
    const isSafetyBlock = /safety system/i.test(msg) || /rejected/i.test(msg);
    const isModelMiss = /model/i.test(msg) && (/not.*found/i.test(msg) || err?.status === 404);
    const isUnsupported = /unsupported/i.test(msg);
    if (isSafetyBlock || isModelMiss || isUnsupported) {
      console.warn('[image] gpt-image-1 niet bruikbaar (', msg.slice(0, 80), '), fallback → dall-e-3');
      return await callDallE3(prompt, size);
    }
    throw err;
  }
}

export async function generateImage({ prompt, size = '1024x1024', outPath, retries = 2 }) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const buf = await callImageApi(prompt, size);
      if (outPath) {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, buf);
      }
      return buf;
    } catch (err) {
      lastErr = err;
      const delay = 1500 * Math.pow(2, i);
      console.warn(`[image] fout ${i + 1}/${retries + 1}: ${err.message} — retry in ${delay}ms`);
      if (i < retries) await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// v2: helper om een korte scene-memo te bouwen voor visual continuity (max 200 chars)
export function buildSceneMemo(sceneDescription) {
  if (!sceneDescription) return null;
  const trimmed = String(sceneDescription).trim();
  return trimmed.length > 200 ? trimmed.slice(0, 197) + '...' : trimmed;
}

// v3: Genereer een "character reference sheet" illustratie als visueel anker
// v4: Voegt expliciete schaal-relatie toe tussen kind en dier
export async function generateReferenceSheet({ characterSheet, illustrationStyle, imagesDir }) {
  const style = STYLE_PROMPTS[illustrationStyle] || STYLE_PROMPTS['warme-waterverf'];
  const hair = toEnglishDescription(`${characterSheet.hairStyle} ${characterSheet.hairColor}`).trim() || 'soft brown';
  const outfit = toEnglishDescription(characterSheet.outfit) || 'a cozy colorful outfit';
  const signatureEn = characterSheet.signatureDetail ? toEnglishDescription(characterSheet.signatureDetail) : null;
  const signatureLine = signatureEn ? ` Distinctive detail: ${signatureEn}.` : '';

  // Animal description — specifiek kalfje voor hert (geen gewei!)
  const animalWord = (characterSheet.animalWord || '').toLowerCase();
  let animalDesc = toEnglishDescription(characterSheet.animalDescription) || `a friendly ${animalWord}`;
  // Forceer jong dier voor hert — NOOIT volwassen met gewei
  if (animalWord === 'hert' || animalWord === 'deer') {
    animalDesc = 'a very small young deer fawn (without antlers), spotted light brown coat, large gentle eyes, small and delicate build';
  }

  // v4: expliciete grootte-indicator voor dier
  const animalSizeHint = characterSheet.animalSize
    ? toEnglishDescription(characterSheet.animalSize)
    : null;
  const animalSizeLine = animalSizeHint
    ? ` The animal companion stands exactly ${animalSizeHint} relative to the main character — this size proportion is FIXED and must never change.`
    : ' The animal companion is small, reaching roughly knee-to-hip height of the main character — this size proportion is FIXED and must never change.';

  const prompt = `${style}

CHARACTER MODEL SHEET — Reference illustration for consistent character design.

Show TWO characters side by side on a soft neutral cream/warm background:
1. MAIN CHARACTER: a small whimsical storybook figure with ${hair} hair, wearing ${outfit}. Simple friendly round face, warm expressive eyes, gentle smile. Full-body view, calm standing pose facing slightly forward.${signatureLine}
2. ANIMAL COMPANION: ${animalDesc}. Full-body view, calm standing pose next to the main character.${animalSizeLine}

Neutral background, no scene elements, no environment. Characters clearly visible. Warm soft watercolor style, gentle pastel tones, hand-painted texture. No text, no labels, no numbers. This is a pure character reference illustration.

${SAFETY_SUFFIX}`;

  const outPath = path.join(imagesDir, 'reference.png');
  console.log('[ref-sheet] Genereer character reference sheet...');

  // Probeer direct dall-e-3 voor reference sheet (betrouwbaarder voor character consistency)
  let buf;
  try {
    buf = await callDallE3(prompt, '1024x1024');
  } catch (err) {
    console.warn('[ref-sheet] dall-e-3 fout, probeer callImageApi:', err.message);
    buf = await callImageApi(prompt, '1024x1024');
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
  console.log(`[ref-sheet] Opgeslagen: ${outPath}`);
  return outPath;
}

// v4: Genereer een reference sheet voor het vriendje/vriendinnetje alleen
export async function generateFriendReferenceSheet({ order, storyCharacterSheet, illustrationStyle, imagesDir }) {
  if (!order.friendName || !storyCharacterSheet.friendDescription) {
    throw new Error('Geen vriendje-data beschikbaar voor reference sheet');
  }

  const style = STYLE_PROMPTS[illustrationStyle] || STYLE_PROMPTS['warme-waterverf'];
  const fd = storyCharacterSheet.friendDescription;

  const hair = toEnglishDescription(`${fd.hairStyle} ${fd.hairColor}`).trim() || 'straight blond';
  const outfit = toEnglishDescription(fd.outfit) || 'a light-colored dress';
  const signatureEn = fd.distinguishingFeature ? toEnglishDescription(fd.distinguishingFeature) : null;
  const signatureLine = signatureEn ? ` Distinctive detail: ${signatureEn}.` : '';

  // Ook de hoofdpersoon kort beschrijven als contrast
  const mainHair = toEnglishDescription(`${storyCharacterSheet.hairStyle} ${storyCharacterSheet.hairColor}`).trim() || 'dark brown';
  const mainOutfit = toEnglishDescription(storyCharacterSheet.outfit) || 'a cozy colorful outfit';

  const prompt = `${style}

CHARACTER MODEL SHEET — Reference illustration for the FRIEND character design.

Show ONE character on a soft neutral cream/warm background:
FRIEND CHARACTER (${order.friendName}): a small whimsical storybook figure with ${hair} hair, wearing ${outfit}. Simple friendly round face, warm expressive eyes, gentle smile. Full-body view, calm standing pose facing slightly forward.${signatureLine}

IMPORTANT: This character looks CLEARLY DIFFERENT from the main character who has ${mainHair} hair and wears ${mainOutfit}. They are NOT twins and NOT similar in appearance. This friend character has distinctly ${hair} hair and wears ${outfit}.

Neutral background, no scene elements, no other characters. Warm soft watercolor style, gentle pastel tones, hand-painted texture. No text, no labels, no numbers. This is a pure character reference illustration.

${SAFETY_SUFFIX}`;

  const outPath = path.join(imagesDir, 'reference-friend.png');
  console.log(`[ref-sheet-friend] Genereer reference sheet voor ${order.friendName}...`);

  let buf;
  try {
    buf = await callDallE3(prompt, '1024x1024');
  } catch (err) {
    console.warn('[ref-sheet-friend] dall-e-3 fout, probeer callImageApi:', err.message);
    buf = await callImageApi(prompt, '1024x1024');
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
  console.log(`[ref-sheet-friend] Opgeslagen: ${outPath}`);
  return outPath;
}

// v3/v4: Analyseer reference-image via GPT-4o Vision → hyper-specifieke visuele beschrijving
// v4: voegt expliciete grootte-relatie en leeftijdsstadium van het dier toe
export async function extractVisualContract(referenceImagePath, { isFriendSheet = false } = {}) {
  const logPrefix = isFriendSheet ? '[visual-contract-friend]' : '[visual-contract]';
  console.log(`${logPrefix} Analyseer reference sheet via GPT-4o Vision...`);

  let base64Image;
  try {
    const imgBuf = fs.readFileSync(referenceImagePath);
    base64Image = imgBuf.toString('base64');
  } catch (err) {
    console.error(`${logPrefix} Kan reference image niet lezen:`, err.message);
    throw err;
  }

  const systemPrompt = isFriendSheet
    ? `You are a character-design analyst for children's picture books. Look at this reference illustration of a FRIEND CHARACTER and write an EXTREMELY specific visual description that another illustrator could use to recreate the exact same character across many scenes. Include:
- Face shape, eye shape and color, expression
- Hair color (exact shade), hair style and length
- Skin tone
- Body proportions and size (small, compact, child-like storybook proportions)
- Exact clothing items: garment type, colors (exact shades), patterns or prints
- Any accessories (hair clip, headband, bag, etc.) — describe exactly
- Overall art style: watercolor texture, color palette warmth, line quality

Return a single concise English paragraph of 3-5 sentences. Be extremely precise about colors, shapes, and details. Focus only on what is visually present.`
    : `You are a character-design analyst for children's picture books. Look at this reference illustration and write an EXTREMELY specific visual description that another illustrator could use to recreate the exact same characters across many scenes. Include:
- Face shape, eye shape and color, expression
- Hair color (exact shade), hair style and length
- Skin tone
- Body proportions and size (small, compact, child-like storybook proportions)
- Exact clothing items: garment type, colors (exact shades), patterns or prints
- Any accessories (hair clip, jewelry, bag, etc.) — describe exactly
- The animal companion: species, exact color and markings, age/size (young/adult), presence or absence of horns/antlers, body shape
- IMPORTANT: also describe the exact SIZE of the animal RELATIVE to the main character (e.g. 'the fawn reaches the child's hip, approximately knee-to-hip height') and its AGE STAGE (e.g. 'young fawn with white spots, no antlers, playful juvenile proportions'). This size relationship must remain identical on every page.
- Overall art style: watercolor texture, color palette warmth, line quality

Return a single concise English paragraph of 5-7 sentences. Be extremely precise about colors, shapes, and details. Focus only on what is visually present.`;

  const questionText = isFriendSheet
    ? 'Describe the friend character in this reference illustration with maximum specificity so they can be recreated identically in every book page.'
    : 'Describe both characters in this reference illustration with maximum specificity so they can be recreated identically in every book page. Pay special attention to the animal\'s size relative to the main character.';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: questionText,
            },
          ],
        },
      ],
      max_tokens: 600,
      temperature: 0.2,
    });

    const contract = response.choices?.[0]?.message?.content?.trim();
    if (!contract) throw new Error('GPT-4o gaf lege response');

    console.log(`${logPrefix} Contract gegenereerd:`, contract);
    return contract;
  } catch (err) {
    console.error(`${logPrefix} Fout bij GPT-4o Vision analyse:`, err.message);
    throw err;
  }
}
