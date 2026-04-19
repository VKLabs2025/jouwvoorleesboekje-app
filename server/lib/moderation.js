// Moderation laag: OpenAI moderation + custom NL blocklist
import { openai, MODERATION_MODEL } from './openai-client.js';
import { checkBlocklist } from './blocklist.js';

export async function moderateWithOpenAI(text) {
  try {
    const resp = await openai.moderations.create({
      model: MODERATION_MODEL,
      input: text,
    });
    const result = resp.results?.[0];
    if (!result) return { flagged: false };
    if (result.flagged) {
      const cats = Object.entries(result.categories || {})
        .filter(([, v]) => v)
        .map(([k]) => k);
      return {
        flagged: true,
        categories: cats,
        message: 'Deze invoer kwam niet door onze automatische veiligheidscontrole.',
      };
    }
    return { flagged: false };
  } catch (err) {
    console.warn('[moderation] OpenAI moderation faalde, vertrouw op blocklist:', err.message);
    // Gracefully door — we hebben nog blocklist + output-check
    return { flagged: false, error: err.message };
  }
}

export async function fullModerationCheck(combinedText, fields = null) {
  // 1) custom blocklist (snel, geen API-kosten)
  if (fields) {
    for (const [field, value] of Object.entries(fields)) {
      if (!value) continue;
      const hit = checkBlocklist(value);
      if (hit) {
        return { ok: false, reason: 'blocklist', field, category: hit.category, word: hit.word, message: hit.message };
      }
    }
  } else {
    const hit = checkBlocklist(combinedText);
    if (hit) {
      return { ok: false, reason: 'blocklist', category: hit.category, word: hit.word, message: hit.message };
    }
  }
  // 2) OpenAI moderation
  const mod = await moderateWithOpenAI(combinedText);
  if (mod.flagged) {
    return { ok: false, reason: 'openai_moderation', categories: mod.categories, message: mod.message };
  }
  return { ok: true };
}
