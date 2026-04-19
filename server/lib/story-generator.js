// GPT-4o verhaalgeneratie — Nederlandse kinderverhalen
import { openai, TEXT_MODEL } from './openai-client.js';

// v2: verhoogde pagina- en woordaantallen voor 5+ min voorleestijd
const PAGES_PER_AGE = { '3-5': 7, '6-8': 8, '9-10': 9 };
const WORDS_PER_AGE = { '3-5': 95, '6-8': 130, '9-10': 160 };

// Harde ondergrens voor de totale woordtelling
const MIN_WORDS_TOTAL = 600;

const AGE_STYLE = {
  '3-5': 'Korte zinnen (max 12 woorden). Veel herhaling. Simpele, warme woorden. Affectief. Eindig bij slapengaan-scène.',
  '6-8': '10-18 woorden per zin. Dialoog mag. Speelse plot-twist. Humor mag. Actieve held met eigen initiatief.',
  '9-10': '12-25 woorden per zin. Rijker taalgebruik. Kleine reflectie. Slimme oplossing. Geen angst.',
};

const TONE_LABELS = {
  lief: 'lief en warm',
  grappig: 'grappig en speels',
  spannend_maar_veilig: 'spannend maar veilig',
  avontuurlijk: 'avontuurlijk',
  leerzaam: 'leerzaam',
};

const MORAL_LABELS = {
  vriendschap: 'vriendschap',
  moed: 'moed',
  eerlijkheid: 'eerlijkheid',
  doorzettingsvermogen: 'doorzettingsvermogen',
  samenwerken: 'samenwerken',
  zelfvertrouwen: 'zelfvertrouwen',
};

const THEME_LABELS = {
  dieren: 'dieren', ruimte: 'de ruimte', ridders: 'ridders', eenhoorns: 'eenhoorns',
  prinsessen: 'prinsessen', jungle: 'de jungle', piraten: 'piraten', dinos: "dino's",
  sport: 'sport', magie: 'magie', mysterie: 'een mysterie', zee: 'onder water',
};

function buildSystemPrompt() {
  return `Je bent een ervaren Nederlandse kinderboekenschrijver die persoonlijke voorleesverhalen schrijft voor kinderen van 3 tot 10 jaar. Je schrijft met de warmte van Annie M.G. Schmidt en de speelsheid van Oliver Jeffers.

EISEN:
- Schrijf ALTIJD in het Nederlands.
- Gebruik LETTERLIJK de naam van het hoofdpersonage (minimaal 5× in het hele verhaal).
- Gebruik de naam van het vriendje als aangeleverd (minimaal 3× in het hele verhaal).
- Het lievelingsdier speelt een BELANGRIJKE rol als companion/gids (minimaal 3× bij naam of soort genoemd).
- De hobby van het kind moet ACTIEF verweven zijn in de plot — niet alleen genoemd maar gebruikt in minstens 2-3 pagina's als centrale handeling.
- De moraal moet zichtbaar zijn in de laatste pagina's, niet preken.
- Toon en thema: zoals user aangeeft.
- Elk verhaal moet LANG genoeg zijn voor 5+ minuten voorleestijd (~130 woorden per minuut NL). Schrijf RIJKE, UITGEBREIDE verhaalpagina's — geen korte samenvattingen maar volledige scènes met dialoog, beschrijvingen en gevoel.

VEILIGHEID (strikt):
- GEEN geweld, dood, ziekte, enge beelden.
- GEEN seksueel, religieus, politiek.
- GEEN bestaande merken of personages (Disney, Pokémon, Paw Patrol, Nijntje, Elsa, Spiderman, enzovoort).
- GEEN opvoedkundige/medische/psychologische adviezen.
- GEEN pesten, uitsluiten, negatief zelfbeeld.
- WEL positief, veilig, warm, fantasierijk, geschikt voor voorlezen voor het slapengaan.

STRUCTUUR (altijd):
1. Sterke openingszin (niet "Er was eens...").
2. Introductie hoofdpersoon in vertrouwde setting + lievelingsdier.
3. Iets onverwachts/magisch gebeurt.
4. Op pad: thema-wereld verkennen.
5. Ontmoeting met vriendje/companion/gids.
6. Uitdaging waarbij hobby de sleutel blijkt.
7. Moment van succes/ontdekking → moraal landt.
8. Warm slot; bij 3-5 jaar ALTIJD een slaap-scène.

CHARACTER_SHEET:
- Geef ook een "signature_detail" op: een uniek herkenningsteken van het hoofdpersonage (bv. "een klein goudkleurig sterretje als haarspeldje" of "een rode rugzak met vlindertjes"). Dit wordt gebruikt voor visuele consistentie in de illustraties.
- Als er een vriendje/vriendinnetje in het verhaal is, beschrijf dit karakter in character_sheet.friend_description met DUIDELIJK VISUEEL CONTRAST ten opzichte van het hoofdpersonage: minstens 2 van { haarkleur, haarstijl, outfit-hoofdkleur, uniek detail } moeten expliciet anders zijn. Dit voorkomt dat de illustraties de twee kinderen als tweelingen neerzetten.
- Geef voor het dier altijd een expliciete grootte-indicator (animal_size) én een leeftijdsstadium (animal_age_stage). Deze blijven constant over alle illustraties.

SCENE DESCRIPTIONS (BELANGRIJK voor illustraties):
Elke sceneDescription MOET bevatten:
1. WAT doet het hoofdpersonage FYSIEK op die pagina (concrete actie-werkwoorden in het Engels)
2. WAAR speelt de scène zich af (precieze locatie/setting)
3. WIE is er nog meer in beeld (lievelingsdier/vriendje/companion — met hun uiterlijk)
4. STEMMING en licht (ochtend/avond/zonnig/maanlicht/magisch gloed)
5. De sceneDescription moet de KERN-ACTIE van die specifieke verhaalpagina weergeven
6. Als Fien (of het vriendje) aanwezig is in de scène, beschrijf dan EXPLICIET hoe Fien eruitziet (haarkleur, outfit) zodat illustrators haar kunnen onderscheiden van het hoofdpersonage.

Je geeft UITSLUITEND geldige JSON terug volgens het opgegeven schema. Geen uitleg eromheen.`;
}

function buildUserPrompt(order, retryFeedback = null) {
  const pages = PAGES_PER_AGE[order.ageSegment] || 7;
  const wordsPerPage = WORDS_PER_AGE[order.ageSegment] || 95;
  const total = pages * wordsPerPage;
  const toneLabel = TONE_LABELS[order.storyTone] || order.storyTone || 'warm';
  const themeLabel = THEME_LABELS[order.theme] || order.theme || 'avontuur';
  const moralLabel = MORAL_LABELS[order.moral] || order.moral || 'vriendschap';
  const styleGuide = AGE_STYLE[order.ageSegment] || AGE_STYLE['6-8'];

  const friendLine = order.friendName
    ? `Vriendje/vriendinnetje: ${order.friendName} (LETTERLIJK gebruiken, minimaal 3× in het verhaal, belangrijke rol). VISUEEL CONTRAST VERPLICHT: ${order.friendName} moet duidelijk anders uitzien dan ${order.childFirstName} — andere haarkleur, andere haarstijl, andere outfitkleur. Beschrijf dit in character_sheet.friend_description.`
    : 'Geen specifiek vriendje: bedenk een passend magisch/dier-companion in plaats daarvan.';
  const senderLine = order.senderNote
    ? `Opdrachtgever heeft een notitie meegegeven (verweef subtiel in slotpagina): "${order.senderNote}"`
    : '';

  const retryLine = retryFeedback
    ? `\nLET OP — VERBETERPUNTEN VAN VORIGE POGING:\n${retryFeedback}\nPas dit actief aan in je nieuwe versie!\n`
    : '';

  return `Schrijf een voorleesboekje met de volgende input:
${retryLine}
Hoofdpersoon: ${order.childFirstName} (${order.childAge} jaar) — gebruik deze naam LETTERLIJK minimaal 5× in het hele verhaal
Leeftijdsstijl: ${order.ageSegment} — ${styleGuide}
Thema: ${themeLabel}
Toon: ${toneLabel}
Lievelingsdier (centrale companion): ${order.favoriteAnimal} — geef dit dier een naam en laat het minimaal 3× actief voorkomen
Hobby (sleutel tot oplossing, actief gebruikt in minstens 2-3 pagina's): ${order.hobby}
${friendLine}
Moraal (subtiel, tegen het einde): ${moralLabel}
${senderLine}

Aantal pagina's: ${pages}
Woorden per pagina: ~${wordsPerPage} (schrijf VOLLEDIGE, RIJKE scènes — geen korte samenvattingen)
Totaal verhaal: minimaal ${MIN_WORDS_TOTAL} woorden (noodzakelijk voor 5+ min voorleestijd)
Titel: verzin een warme, speelse titel met de naam van ${order.childFirstName} erin.

Geef output als STRICT JSON:
{
  "title": "string",
  "character_sheet": {
    "hair_color": "string (natuurlijke kleur: donkerbruin / lichtbruin / blond / rood / zwart)",
    "hair_style": "string (korte beschrijving, bv 'krullen tot over de oren' of 'twee vlechten')",
    "outfit": "string (korte consistente beschrijving, bv 'gele trui en blauwe broek')",
    "animal_description": "string (kleurrijke beschrijving van het lievelingsdier als companion)",
    "animal_size": "string (expliciete grootte-indicator, bv 'small fawn, roughly knee-to-hip height of a small child' of 'medium dog, hip-high')",
    "animal_age_stage": "string (expliciet leeftijdsstadium, bv 'young fawn with white spots, no antlers, playful juvenile proportions' of 'fully grown adult dog')",
    "signature_detail": "string (uniek herkenningsteken, bv 'een klein goudkleurig sterretje als haarspeldje')",
    "friend_description": ${order.friendName ? `{
      "hair_color": "string (ANDERE kleur dan hoofdpersoon, bv 'strawberry blonde' als hoofdpersoon donkerbruin heeft)",
      "hair_style": "string (ANDERE stijl dan hoofdpersoon, bv 'straight short bob' als hoofdpersoon krullen heeft)",
      "outfit": "string (ANDERE hoofdkleur dan hoofdpersoon, bv 'roze jurk met witte stippen')",
      "distinguishing_feature": "string (uniek detail dat dit karakter altijd heeft, bv 'rode haarband' of 'blauwe laarzen')"
    }` : 'null (geen vriendje)'}
  },
  "pages": [
    {
      "pageNumber": 1,
      "text": "verhaaltekst (Nederlands, MINIMAAL ${wordsPerPage} woorden, volledig uitgewerkte scène)",
      "sceneDescription": "English scene description for illustration: WHAT the protagonist is physically doing (concrete action verbs) + WHERE the scene takes place (specific location) + WHO else is visible (animal/friend companion with appearance) + MOOD and light (morning/evening/sunny/moonlight/magical glow). Must reflect the CORE ACTION of this specific story page."
    }
  ]
}

Exact ${pages} pagina's. Elke sceneDescription is een concrete, visuele scène in HET ENGELS (geen tekst/letters, geen merken). ELKE pagina minimaal ${wordsPerPage} woorden tekst.`;
}

// Tel woorden in alle pagina's samen
function countWords(story) {
  return story.pages.reduce((total, page) => {
    const words = (page.text || '').trim().split(/\s+/).filter(w => w.length > 0);
    return total + words.length;
  }, 0);
}

export async function generateStory(order) {
  const systemPrompt = buildSystemPrompt();

  let story = null;
  let lastErr = null;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let retryFeedback = null;

    if (attempt > 0 && story) {
      // Bouw retryFeedback op basis van vorige poging
      const feedbacks = [];
      const wordCount = countWords(story);
      if (wordCount < MIN_WORDS_TOTAL) {
        feedbacks.push(`Het verhaal is te kort (${wordCount} woorden, minimum is ${MIN_WORDS_TOTAL}). Schrijf MUCH langere, rijkere scènes op elke pagina — minimaal ${WORDS_PER_AGE[order.ageSegment] || 95} woorden per pagina.`);
      }
      const completenessIssues = checkCompletenessIssues(story, order);
      feedbacks.push(...completenessIssues);
      retryFeedback = feedbacks.join('\n');
    } else if (attempt > 0) {
      retryFeedback = 'Vorige poging mislukte. Genereer een volledig, correct JSON-verhaal.';
    }

    const userPrompt = buildUserPrompt(order, retryFeedback);

    try {
      const pages = PAGES_PER_AGE[order.ageSegment] || 7;
      const wordsPerPage = WORDS_PER_AGE[order.ageSegment] || 95;
      // Ruime schatting: NL woorden ~ 1.4 tokens + sceneDescriptions (EN) ~50 tokens per pagina + overhead
      // Elke pagina: verhaaltekst + sceneDescription + JSON overhead
      const estimatedTokens = Math.ceil(pages * (wordsPerPage * 1.6 + 80)) + 1200;
      const maxTokens = Math.min(Math.max(estimatedTokens, 4500), 7000);

      console.log(`[story] generatie poging ${attempt + 1}/${maxRetries + 1}, max_tokens=${maxTokens}`);

      const resp = await openai.chat.completions.create({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.85,
        max_tokens: maxTokens,
      });

      const content = resp.choices?.[0]?.message?.content;
      if (!content) throw new Error('Geen verhaal-output van GPT-4o');

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        throw new Error('Ongeldig JSON-verhaal van model: ' + e.message);
      }

      if (!parsed.title || !Array.isArray(parsed.pages) || parsed.pages.length === 0) {
        throw new Error("Verhaal mist titel of pagina's");
      }

      const expected = PAGES_PER_AGE[order.ageSegment] || 7;
      if (parsed.pages.length < Math.max(3, expected - 2)) {
        throw new Error(`Te weinig pagina's: ${parsed.pages.length}, verwacht ${expected}`);
      }

      // Normalize pageNumber
      parsed.pages = parsed.pages.map((p, i) => ({
        pageNumber: i + 1,
        text: String(p.text || '').trim(),
        sceneDescription: String(p.sceneDescription || p.scene_description || '').trim(),
      }));
      parsed.characterSheet = parsed.character_sheet || parsed.characterSheet || {};
      delete parsed.character_sheet;

      const wordCount = countWords(parsed);
      console.log(`[story] woordtelling poging ${attempt + 1}: ${wordCount} woorden`);

      // Check woordtelling
      if (wordCount < MIN_WORDS_TOTAL) {
        console.warn(`[story] verhaal te kort (${wordCount} < ${MIN_WORDS_TOTAL}), retry indien mogelijk`);
        story = parsed; // sla op voor feedback
        if (attempt < maxRetries) {
          lastErr = new Error(`Verhaal te kort: ${wordCount} woorden`);
          continue;
        } else {
          console.warn(`[story] max retries bereikt, leveren met ${wordCount} woorden`);
        }
      }

      story = parsed;
      break;
    } catch (err) {
      lastErr = err;
      console.warn(`[story] fout poging ${attempt + 1}:`, err.message);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt)));
      }
    }
  }

  if (!story) {
    throw lastErr || new Error('Verhaalgeneratie mislukt na alle pogingen');
  }

  return story;
}

// Helper: geeft array van feedback-strings terug voor ontbrekende ingrediënten
function checkCompletenessIssues(story, order) {
  const issues = [];
  const allText = story.pages.map(p => p.text || '').join(' ');

  const nameCount = countOccurrences(allText, order.childFirstName);
  if (nameCount < 5) {
    issues.push(`De naam "${order.childFirstName}" komt slechts ${nameCount}× voor in het verhaal (minimum is 5×). Gebruik de naam vaker als protagonist.`);
  }

  if (order.favoriteAnimal) {
    const animalCount = countOccurrences(allText, order.favoriteAnimal);
    if (animalCount < 3) {
      issues.push(`Het lievelingsdier "${order.favoriteAnimal}" komt slechts ${animalCount}× voor (minimum is 3×). Laat het dier een actievere rol spelen.`);
    }
  }

  if (order.friendName) {
    const friendCount = countOccurrences(allText, order.friendName);
    if (friendCount < 3) {
      issues.push(`Het vriendje "${order.friendName}" komt slechts ${friendCount}× voor (minimum is 3×). Geef het vriendje een grotere rol.`);
    }
  }

  if (order.hobby) {
    const hobbyWords = order.hobby.trim().split(/\s+/).slice(0, 2);
    const hobbyCount = hobbyWords.reduce((max, word) => Math.max(max, countOccurrences(allText, word)), 0);
    if (hobbyCount < 2) {
      issues.push(`De hobby "${order.hobby}" komt niet genoeg voor in het verhaal (${hobbyCount}×, minimum is 2×). Weef de hobby actiever in pagina 3-5 — laat het kind de hobby UITVOEREN als sleutel tot de oplossing.`);
    }
  }

  return issues;
}

function countOccurrences(text, term) {
  if (!term || !text) return 0;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'gi');
  return (text.match(regex) || []).length;
}

// Verificeer dat verhaal alle ingrediënten bevat (voor externe aanroep)
export function verifyStoryCompleteness(story, order) {
  const allText = story.pages.map(p => p.text || '').join(' ');
  const issues = [];

  const nameCount = countOccurrences(allText, order.childFirstName);
  if (nameCount < 5) {
    issues.push(`Naam "${order.childFirstName}" komt ${nameCount}× voor (min 5×)`);
  }

  if (order.favoriteAnimal) {
    const animalCount = countOccurrences(allText, order.favoriteAnimal);
    if (animalCount < 3) {
      issues.push(`Dier "${order.favoriteAnimal}" komt ${animalCount}× voor (min 3×)`);
    }
  }

  if (order.friendName) {
    const friendCount = countOccurrences(allText, order.friendName);
    if (friendCount < 3) {
      issues.push(`Vriendje "${order.friendName}" komt ${friendCount}× voor (min 3×)`);
    }
  }

  if (order.hobby) {
    const hobbyWords = order.hobby.trim().split(/\s+/).slice(0, 2);
    const hobbyCount = hobbyWords.reduce((max, word) => Math.max(max, countOccurrences(allText, word)), 0);
    if (hobbyCount < 2) {
      issues.push(`Hobby "${order.hobby}" komt ${hobbyCount}× voor (min 2×)`);
    }
  }

  const wordCount = countWords(story);

  return {
    ok: issues.length === 0,
    issues,
    wordCount,
    nameCount: countOccurrences(allText, order.childFirstName),
    animalCount: order.favoriteAnimal ? countOccurrences(allText, order.favoriteAnimal) : null,
    friendCount: order.friendName ? countOccurrences(allText, order.friendName) : null,
  };
}

// NL taalcheck als finale pass
export async function polishDutch(story) {
  console.log('[polish] NL taalcheck gestart...');

  const systemPrompt = `Je bent een ervaren Nederlandse tekstredacteur voor kinderboeken. Controleer de onderstaande verhaalteksten op: correct Nederlands (geen anglicismen, juiste werkwoordstijden, d/t-fouten, interpunctie), natuurlijke zinsbouw voor voorlezen (vloeiend hardop lezen), leeftijdsgeschikt woordgebruik. Pas ALLEEN aan waar nodig; laat de plot en namen intact. Geef output in EXACT hetzelfde JSON-formaat terug.`;

  const inputData = {
    title: story.title,
    pages: story.pages.map(p => ({
      pageNumber: p.pageNumber,
      text: p.text,
      sceneDescription: p.sceneDescription,
    })),
  };

  try {
    const resp = await openai.chat.completions.create({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Controleer en verbeter het volgende kinderverhaal op correct Nederlands taalgebruik. Behoud de plot, namen en sceneDescriptions ongewijzigd. Verbeter alleen de tekst op taalfouten:\n\n${JSON.stringify(inputData, null, 2)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 6000,
    });

    const content = resp.choices?.[0]?.message?.content;
    if (!content) {
      console.warn('[polish] geen output van GPT-4o, origineel behouden');
      return story;
    }

    let polished;
    try {
      polished = JSON.parse(content);
    } catch (e) {
      console.warn('[polish] ongeldig JSON van taalcheck, origineel behouden:', e.message);
      return story;
    }

    if (!polished.title || !Array.isArray(polished.pages) || polished.pages.length === 0) {
      console.warn('[polish] ontbrekende velden in taalcheck output, origineel behouden');
      return story;
    }

    // Merge: behoud characterSheet en andere velden uit origineel
    const result = {
      ...story,
      title: polished.title || story.title,
      pages: polished.pages.map((p, i) => ({
        pageNumber: i + 1,
        text: String(p.text || story.pages[i]?.text || '').trim(),
        sceneDescription: String(p.sceneDescription || story.pages[i]?.sceneDescription || '').trim(),
      })),
    };

    console.log('[polish] NL taalcheck voltooid');
    return result;
  } catch (err) {
    console.warn('[polish] taalcheck mislukt, origineel behouden:', err.message);
    return story;
  }
}

// Check alle gegenereerde verhaalteksten via moderation
import { moderateWithOpenAI } from './moderation.js';
export async function moderateGeneratedStory(story) {
  const allText = [story.title, ...story.pages.map(p => p.text)].join('\n\n');
  const mod = await moderateWithOpenAI(allText);
  return mod;
}
