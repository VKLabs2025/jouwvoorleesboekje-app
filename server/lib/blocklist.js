// NL blocklist — overgenomen uit prototype (voorleesboekje-demo/data.js)
export const BLOCKLIST = {
  geweld: ['geweld', 'vechten', 'vecht', 'pistool', 'geweer', 'moord', 'moorden', 'bloed', 'mes', 'oorlog', 'dood', 'doden', 'slaan', 'schieten'],
  angst: ['monster', 'spook', 'spoken', 'nachtmerrie', 'eng', 'enge', 'horror', 'duivel', 'demon', 'zombie', 'heks'],
  religie_politiek: ['god', 'allah', 'jezus', 'boeddha', 'kerk', 'moskee', 'pvv', 'vvd', 'd66', 'cda', 'groenlinks'],
  merken: [
    'disney', 'pixar', 'marvel', 'paw patrol', 'pawpatrol', 'pokemon', 'pokémon',
    'bluey', 'peppa', 'peppa pig', 'nijntje', 'dikkie dik', 'woezel', 'pip',
    'frozen', 'elsa', 'anna', 'olaf', 'spiderman', 'spider-man', 'batman',
    'superman', 'harry potter', 'hermione', 'minecraft', 'fortnite', 'sonic',
    'mario', 'luigi', 'kermit', 'smurf', 'smurfen', 'buurman en buurman',
    'bob de bouwer', 'dora'
  ],
  medisch: ['adhd', 'autisme', 'depressie', 'angststoornis', 'ziekte', 'kanker', 'diabetes'],
};

export const CATEGORY_MESSAGES = {
  geweld: 'Deze invoer bevat een woord dat we bij kinderverhalen niet gebruiken. Kies iets vriendelijks.',
  angst: 'Voor een fijn voorleesboekje voor het slapengaan vermijden we enge thema\'s.',
  religie_politiek: 'We laten religieuze of politieke onderwerpen bewust buiten onze boekjes.',
  merken: 'Deze naam hoort bij een bestaande merk of personage. Kies liever een eigen naam of dier.',
  medisch: 'We geven in onze verhalen geen medische of opvoedkundige adviezen.',
};

export function checkBlocklist(text) {
  if (!text) return null;
  const lower = String(text).toLowerCase().trim();
  if (!lower) return null;
  for (const [cat, words] of Object.entries(BLOCKLIST)) {
    for (const w of words) {
      const re = new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)', 'i');
      if (re.test(lower)) return { category: cat, word: w, message: CATEGORY_MESSAGES[cat] };
    }
  }
  return null;
}

export function checkBlocklistFields(fields) {
  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    const hit = checkBlocklist(value);
    if (hit) return { field, ...hit };
  }
  return null;
}
