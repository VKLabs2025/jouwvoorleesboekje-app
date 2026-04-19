// Central OpenAI client — gebruikt user's OPENAI_API_KEY uit .env.local
import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('placeholder')) {
  console.warn('[openai] OPENAI_API_KEY ontbreekt of placeholder — generatie zal falen');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Tekst-modellen: spec zegt gpt-4o / gpt-4o-2024-... — pak gewoon gpt-4o
export const TEXT_MODEL = 'gpt-4o';
// Image: spec zegt gpt-image-1 — check bij runtime, fallback naar dall-e-3
export const IMAGE_MODEL = 'gpt-image-1';
export const IMAGE_FALLBACK_MODEL = 'dall-e-3';
export const MODERATION_MODEL = 'omni-moderation-latest';
