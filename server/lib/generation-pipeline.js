// Orchestrator: moderation → GPT-4o tekst → output moderation → ingrediëntencheck → NL polish → beelden → PDF → email
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateStory, moderateGeneratedStory, verifyStoryCompleteness, polishDutch } from './story-generator.js';
import {
  buildCharacterSheet,
  buildImagePrompt,
  buildCoverPrompt,
  generateImage,
  buildSceneMemo,
  generateReferenceSheet,
  generateFriendReferenceSheet,
  extractVisualContract,
} from './image-generator.js';
import { buildPdf } from './pdf-builder.js';
import { fullModerationCheck } from './moderation.js';
import { getOrder, updateOrder, createInvoice } from './db.js';
import { sendDeliveryEmail } from './mailer.js';
import { openai, TEXT_MODEL } from './openai-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_ROOT = process.env.TMP_DIR
  ? path.join(process.env.TMP_DIR, 'orders')
  : path.resolve(__dirname, '../../tmp/orders');
const PDF_ROOT = process.env.PDF_DIR
  ? process.env.PDF_DIR
  : path.resolve(__dirname, '../../tmp/pdfs');

export async function runPipeline(orderId, { skipEmail = false } = {}) {
  const order = getOrder(orderId);
  if (!order) throw new Error('Order niet gevonden');

  console.log(`[pipeline ${orderId}] start`);

  // 1) Moderation van input (dubbel: blocklist al gedaan bij order-create, hier moderation-API)
  updateOrder(orderId, { generationStatus: 'moderating', generationError: null });
  const combinedInput = [
    order.childFirstName, order.theme, order.storyTone, order.favoriteAnimal,
    order.hobby, order.friendName, order.moral, order.senderNote,
  ].filter(Boolean).join(' | ');
  const inputMod = await fullModerationCheck(combinedInput, {
    childFirstName: order.childFirstName,
    favoriteAnimal: order.favoriteAnimal,
    hobby: order.hobby,
    friendName: order.friendName,
    senderNote: order.senderNote,
  });
  if (!inputMod.ok) {
    updateOrder(orderId, { generationStatus: 'failed', generationError: `input_moderation:${inputMod.reason}` });
    throw new Error(`Input niet veilig (${inputMod.reason}): ${inputMod.message || ''}`);
  }

  // 2) GPT-4o verhaal (met retry-logica voor moderation + ingrediëntencheck)
  updateOrder(orderId, { generationStatus: 'generating_text' });
  let story = null;
  let lastErr = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // generateStory heeft ingebouwde retry-logica voor woordtelling
      const s = await generateStory(order);

      // Output moderation — mag niet verzwakt worden
      const mod = await moderateGeneratedStory(s);
      if (mod.flagged) {
        console.warn(`[pipeline] output flagged, regenereer (poging ${attempt + 1})`);
        lastErr = new Error('Output moderation flagged: ' + (mod.categories || []).join(','));
        continue;
      }

      // Ingrediëntencheck
      const completeness = verifyStoryCompleteness(s, order);
      console.log(`[story] completeness check: ok=${completeness.ok}, woorden=${completeness.wordCount}, issues=${completeness.issues.join('; ') || 'geen'}`);

      if (!completeness.ok && attempt < 2) {
        console.warn(`[pipeline] ingrediëntencheck faalt (poging ${attempt + 1}):`, completeness.issues.join(', '));
        // Sla op als story zodat generateStory de feedback kan gebruiken
        // (maar we roepen generateStory opnieuw aan via de loop — order staat al klaar)
        lastErr = new Error('Ingrediëntencheck faalde: ' + completeness.issues.join('; '));
        // Wacht even voor retry
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      story = s;
      break;
    } catch (err) {
      lastErr = err;
      console.warn(`[pipeline] tekst-gen fout (poging ${attempt + 1}):`, err.message);
      await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt)));
    }
  }

  if (!story) {
    updateOrder(orderId, { generationStatus: 'failed', generationError: 'text_generation:' + (lastErr?.message || 'unknown') });
    throw lastErr || new Error('Tekst-generatie mislukt');
  }

  // 3) NL taalcheck als finale pass
  console.log(`[pipeline ${orderId}] NL polish stap...`);
  story = await polishDutch(story);

  // Verifieer woordtelling na polish
  const finalWordCount = story.pages.reduce((total, page) => {
    return total + (page.text || '').trim().split(/\s+/).filter(w => w.length > 0).length;
  }, 0);
  console.log(`[story] finale woordtelling na polish: ${finalWordCount}`);

  const characterSheet = buildCharacterSheet(order, story.characterSheet);
  updateOrder(orderId, {
    generatedStoryTitle: story.title,
    generatedPages: story.pages,
    characterSheet,
  });

  // 4) Beelden — v4 volgorde: reference-sheet(s) → pagina's 1..N → cover
  updateOrder(orderId, { generationStatus: 'generating_images' });
  const imagesDir = path.join(TMP_ROOT, orderId);
  fs.mkdirSync(imagesDir, { recursive: true });

  // v3/v4: Stap 4a — Genereer character reference sheet (hoofdpersoon + dier) als visueel anker
  let mainContract = null;
  let friendContract = null;

  try {
    const refPath = await generateReferenceSheet({
      characterSheet,
      illustrationStyle: order.illustrationStyle,
      imagesDir,
    });
    // Strikte rate-limit: wacht na reference sheet
    await new Promise(r => setTimeout(r, 13000));

    // Stap 4b — Analyseer reference sheet → locked visual contract voor hoofdpersoon + dier
    try {
      mainContract = await extractVisualContract(refPath, { isFriendSheet: false });
      console.log(`[visual-contract] Luna+Bries contract gelocked: "${mainContract.slice(0, 120)}..."`);
    } catch (vcErr) {
      console.warn('[visual-contract] extractVisualContract faalde, gebruik characterBlock als fallback:', vcErr.message);
      const hair = `${characterSheet.hairStyle} ${characterSheet.hairColor}`.trim();
      const outfit = characterSheet.outfit || 'a cozy warm-colored outfit';
      const animal = characterSheet.animalDescription || `a friendly ${order.favoriteAnimal}`;
      const animalSize = characterSheet.animalSize || 'small, reaching roughly knee-to-hip height';
      const animalAge = characterSheet.animalAgeStage || 'young fawn with white spots, no antlers';
      mainContract = `The main character is a small storybook figure with ${hair} hair, wearing ${outfit}. The animal companion is ${animal}, ${animalAge}, ${animalSize} relative to the main character. Both characters appear consistently throughout all illustrations in the same warm watercolor style.`;
      console.log('[visual-contract] Fallback mainContract:', mainContract);
    }
  } catch (refErr) {
    console.warn('[ref-sheet] generateReferenceSheet faalde, ga door zonder visual contract:', refErr.message);
    mainContract = null;
  }

  // v4: Stap 4c — ALS friendName aanwezig: genereer reference sheet voor vriendje ook
  if (order.friendName && characterSheet.friendDescription) {
    try {
      // Rate-limit wacht voor tweede API call
      await new Promise(r => setTimeout(r, 13000));
      const friendRefPath = await generateFriendReferenceSheet({
        order,
        storyCharacterSheet: characterSheet,
        illustrationStyle: order.illustrationStyle,
        imagesDir,
      });
      await new Promise(r => setTimeout(r, 13000));

      try {
        friendContract = await extractVisualContract(friendRefPath, { isFriendSheet: true });
        console.log(`[visual-contract-friend] ${order.friendName} contract gelocked: "${friendContract.slice(0, 120)}..."`);
      } catch (vcErr) {
        console.warn('[visual-contract-friend] extractVisualContract faalde, gebruik tekstuele fallback:', vcErr.message);
        const fd = characterSheet.friendDescription;
        const fHair = `${fd.hairStyle} ${fd.hairColor}`.trim();
        const fOutfit = fd.outfit || 'a different colored outfit';
        const fDetail = fd.distinguishingFeature ? `, with ${fd.distinguishingFeature}` : '';
        friendContract = `The friend character (${order.friendName}) has ${fHair} hair, wearing ${fOutfit}${fDetail}. They look clearly different from the main character with distinct hair color and outfit.`;
        console.log('[visual-contract-friend] Fallback friendContract:', friendContract);
      }
    } catch (friendRefErr) {
      console.warn('[ref-sheet-friend] generateFriendReferenceSheet faalde, gebruik tekstuele fallback:', friendRefErr.message);
      // Niet-fatale fout: bouw tekstuele fallback voor vriendje
      if (characterSheet.friendDescription) {
        const fd = characterSheet.friendDescription;
        const fHair = `${fd.hairStyle} ${fd.hairColor}`.trim();
        const fOutfit = fd.outfit || 'a different colored outfit';
        friendContract = `The friend character (${order.friendName}) has ${fHair} hair, wearing ${fOutfit}. They look clearly different from the main character.`;
        console.log('[visual-contract-friend] Nood-fallback friendContract:', friendContract);
      }
    }
  }

  // v4: Stap 4d — Bouw combined locked contracts blok
  // DALL-E 3 max prompt = 4000 chars. Budget: style(~160) + charBlock(~200) + negativeConstraints(~200) + scene(~200) + continuity(~100) = ~860.
  // Contract budget: ~3000 chars totaal minus de rest = ~1200 chars.
  // We bouwen een COMPACT versie door de contracts te inkorten tot ~400 chars per personage.
  const CONTRACT_PER_CHAR_MAX = 400;

  function compactContract(fullContract) {
    if (!fullContract) return null;
    // Neem eerste 2 zinnen (meest specifieke info staan vooraan)
    const sentences = fullContract.split('. ').filter(Boolean);
    let compact = '';
    for (const s of sentences) {
      if ((compact + s + '. ').length > CONTRACT_PER_CHAR_MAX) break;
      compact += s + '. ';
    }
    return compact.trim() || fullContract.slice(0, CONTRACT_PER_CHAR_MAX);
  }

  let lockedContracts = null;
  if (mainContract || friendContract) {
    const mainName = characterSheet.name || order.childFirstName;
    const friendName = order.friendName;
    const animalName = characterSheet.animalWord || 'animal companion';
    const animalAge = characterSheet.animalAgeStage || 'young fawn with white spots, no antlers';
    const animalSize = characterSheet.animalSize || 'small, reaching roughly knee-to-hip height of the main character';

    const lines = ['VISUAL CONTRACT — identical across all illustrations:'];
    if (mainContract) {
      const compact = compactContract(mainContract);
      lines.push(`${mainName}: ${compact}`);
    }
    if (friendContract && friendName) {
      const compact = compactContract(friendContract);
      lines.push(`${friendName}: ${compact}`);
    }
    lines.push(`Animal (${animalName}): ${animalAge}, ${animalSize}.`);
    if (friendName) {
      lines.push(`${mainName} and ${friendName} look CLEARLY DIFFERENT — never twins, never matching. Include each only when scene explicitly mentions them.`);
    }

    lockedContracts = lines.join('\n');
    console.log(`[pipeline] Combined locked contracts gebouwd (${lockedContracts.length} chars)`);
  }

  // Backwards compat: sla mainContract ook op als visualContract voor logging/fallback
  const visualContract = mainContract;

  // Strikte rate-limit voor gpt-image-1: 5 req/min. Serieel met 13s vertraging tussen calls.
  const IMAGE_DELAY_MS = 13000;

  // v3 volgorde: pagina's 1..N eerst, cover als LAATSTE
  // Pagina-taken met visual memory (previousScenesMemo) + visualContract
  const pageTasks = story.pages.map((p, idx) => {
    // Bouw memo van de 1-2 vorige scènes
    let previousScenesMemo = null;
    if (idx >= 1) {
      const memos = [];
      if (idx >= 2) {
        const prev2 = buildSceneMemo(story.pages[idx - 2].sceneDescription);
        if (prev2) memos.push(`Two pages ago: ${prev2}`);
      }
      const prev1 = buildSceneMemo(story.pages[idx - 1].sceneDescription);
      if (prev1) memos.push(`In the previous page: ${prev1}`);
      previousScenesMemo = memos.join(' ');
    }

    return {
      kind: `page-${p.pageNumber}`,
      path: path.join(imagesDir, `page-${p.pageNumber}.png`),
      prompt: buildImagePrompt({
        sceneDescription: p.sceneDescription,
        characterSheet,
        illustrationStyle: order.illustrationStyle,
        previousScenesMemo,
        visualContract, // v3: backwards compat
        lockedContracts, // v4: combined multi-character contract (heeft prioriteit boven visualContract)
      }),
      size: '1024x1024',
    };
  });

  // Cover task als LAATSTE (v4: na pagina's, met lockedContracts)
  const coverTask = {
    kind: 'cover',
    path: path.join(imagesDir, 'cover.png'),
    prompt: buildCoverPrompt({
      title: story.title,
      theme: order.theme,
      characterSheet,
      illustrationStyle: order.illustrationStyle,
      visualContract, // v3: backwards compat
      lockedContracts, // v4: combined multi-character contract
    }),
    size: '1024x1024',
  };

  // v3 volgorde: pagina's eerst, dan cover
  const tasks = [...pageTasks, coverTask];

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    try {
      console.log(`[pipeline ${orderId}] image ${t.kind} (${i + 1}/${tasks.length})...`);
      await generateImage({ prompt: t.prompt, size: t.size, outPath: t.path });
    } catch (err) {
      console.error(`[pipeline] image ${t.kind} FAILED: ${err.message}`);
      // Geen throw — PDF-bouwer gebruikt placeholder-kleurvlak waar image ontbreekt
    }
    if (i < tasks.length - 1) await new Promise(r => setTimeout(r, IMAGE_DELAY_MS));
  }

  // 5) PDF bouwen
  updateOrder(orderId, { generationStatus: 'building_pdf' });
  fs.mkdirSync(PDF_ROOT, { recursive: true });
  const pdfPath = path.join(PDF_ROOT, `${orderId}.pdf`);
  await buildPdf({ order, story, characterSheet, imagesDir, outPath: pdfPath });
  updateOrder(orderId, { pdfPath });

  // 6) E-mail — mag falen (domein nog niet geverifieerd etc). PDF blijft via download-link bereikbaar.
  updateOrder(orderId, { generationStatus: 'sending_email' });
  let mailResult;
  try {
    mailResult = await sendDeliveryEmail({ order, story, pdfPath, skip: skipEmail });
  } catch (err) {
    console.error('[pipeline] mail uitzondering:', err.message);
    mailResult = { mode: 'failed', error: err.message };
  }
  // Leg mail-status vast in generationError als informatief veld (niet als hard failure)
  const mailStatusNote = mailResult.mode === 'sent'
    ? null
    : mailResult.mode === 'failed'
      ? `mail_failed:${(mailResult.error || '').slice(0, 200)}`
      : `mail_${mailResult.mode}`;
  updateOrder(orderId, {
    emailPreviewHtml: mailResult.previewHtml || null,
    deliveredAt: Date.now(),
    generationStatus: 'completed',
    generationError: mailStatusNote,
  });

  // 7) Invoice vastleggen (7j bewaar-data, zonder kindgegevens)
  try {
    const amount = Number(process.env.DEFAULT_PRODUCT_PRICE_EUR || 4.95);
    // Hoog BTW-tarief voor digitale dienst in NL = 21%
    const btw = +(amount - (amount / 1.21)).toFixed(2);
    createInvoice({
      orderId,
      email: order.parentEmail,
      amount,
      btw,
      paidAt: Date.now(),
    });
  } catch (e) {
    console.warn('[pipeline] invoice-insert faalde (mogelijk al aanwezig):', e.message);
  }

  console.log(`[pipeline ${orderId}] completed — ${finalWordCount} woorden`);
  return { pdfPath, mailResult, wordCount: finalWordCount };
}
