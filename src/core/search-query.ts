// Localized search vocabulary is data; visible labels and supplier identifiers stay unchanged.
const switchTerms = new Map<string, string>([
  ['buttons', 'button'],
  ['pushbuttons', 'pushbutton'],
  ['toggles', 'toggle'],
  ['rockers', 'rocker'],
  ['selectors', 'selector'],
  ['switches', 'switch'],
  ['\u0437\u0430\u0445\u0438\u0441\u0442\u043d\u0438\u043c\u0438', 'guard'],
  ['\u0442\u0443\u043c\u0431\u043b\u0435\u0440', 'toggle'],
  ['\u0442\u0443\u043c\u0431\u043b\u0435\u0440\u0438', 'toggle'],
  ['\u0442\u0443\u043c\u0431\u043b\u0435\u0440\u0430', 'toggle'],
  ['\u0442\u0443\u043c\u0431\u043b\u0435\u0440\u0456\u0432', 'toggle'],
  ['\u0442\u0443\u043c\u0431\u043b\u0435\u0440\u043e\u043c', 'toggle'],
  ['\u0442\u0443\u043c\u0431\u043b\u0435\u0440\u0430\u043c\u0438', 'toggle'],
  ['\u043f\u0435\u0440\u0435\u043c\u0438\u043a\u0430\u0447', 'switch'],
  ['\u043f\u0435\u0440\u0435\u043c\u0438\u043a\u0430\u0447\u0456', 'switch'],
  ['\u043f\u0435\u0440\u0435\u043c\u0438\u043a\u0430\u0447\u0430', 'switch'],
  ['\u043f\u0435\u0440\u0435\u043c\u0438\u043a\u0430\u0447\u0456\u0432', 'switch'],
  ['\u0432\u0438\u043c\u0438\u043a\u0430\u0447', 'switch'],
  ['\u0432\u0438\u043c\u0438\u043a\u0430\u0447\u0456', 'switch'],
  ['\u0432\u0438\u043c\u0438\u043a\u0430\u0447\u0430', 'switch'],
  ['\u0432\u0438\u043c\u0438\u043a\u0430\u0447\u0456\u0432', 'switch'],
  ['\u043a\u043d\u043e\u043f\u043a\u0430', 'button'],
  ['\u043a\u043d\u043e\u043f\u043a\u0438', 'button'],
  ['\u043a\u043d\u043e\u043f\u043e\u043a', 'button'],
  ['\u043a\u043d\u043e\u043f\u043a\u0443', 'button'],
  ['\u043a\u043d\u043e\u043f\u043a\u043e\u044e', 'button'],
  ['\u043a\u043e\u0432\u043f\u0430\u0447\u043e\u043a', 'guard'],
  ['\u043a\u043e\u0432\u043f\u0430\u0447\u043a\u0430', 'guard'],
  ['\u043a\u043e\u0432\u043f\u0430\u0447\u043a\u0438', 'guard'],
  ['\u043a\u043e\u0432\u043f\u0430\u0447\u043a\u043e\u043c', 'guard'],
  ['\u043a\u043e\u0432\u043f\u0430\u0447\u043a\u0430\u043c\u0438', 'guard'],
  ['\u043a\u043e\u0432\u043f\u0430\u0447\u043a\u0456\u0432', 'guard'],
  ['\u0437\u0430\u0445\u0438\u0441\u043d\u0438\u0439', 'guard'],
  ['\u0437\u0430\u0445\u0438\u0441\u043d\u0438\u043c', 'guard'],
  ['\u0437\u0430\u0445\u0438\u0441\u043d\u0456', 'guard'],
  ['\u0437\u0430\u0445\u0438\u0441\u043d\u0438\u043c\u0438', 'guard'],
  ['\u043f\u043e\u0432\u043e\u0440\u043e\u0442\u043d\u0438\u0439', 'rotary'],
  ['\u043f\u043e\u0432\u043e\u0440\u043e\u0442\u043d\u0456', 'rotary'],
  ['\u043f\u043e\u0432\u043e\u0440\u043e\u0442\u043d\u0438\u043c', 'rotary'],
  ['\u043a\u043b\u0430\u0432\u0456\u0448\u043d\u0438\u0439', 'rocker'],
  ['\u043a\u043b\u0430\u0432\u0456\u0448\u043d\u0456', 'rocker'],
  ['\u043a\u043b\u0430\u0432\u0456\u0448\u043d\u0438\u043c', 'rocker'],
]);
const linkingWords = new Set(['\u0437', '\u0456\u0437', '\u0437\u0456', '\u0442\u0430']);
const words = /[\p{L}\p{N}_]+(?:[-.][\p{L}\p{N}_]+)*/gu;

/** Translate only recognized whole query words; preserve arbitrary SKUs and unknown queries. */
export function translateSearchQuery(query: string): string {
  const tokens = query.match(words) ?? [];
  if (!tokens.some((token) => switchTerms.has(token.toLowerCase()))) return query;
  const translated = new Set<string>();
  return query
    .replace(words, (token) => {
      const key = token.toLowerCase();
      const term = switchTerms.get(key);
      if (term) {
        if (translated.has(term)) return '';
        translated.add(term);
        return term;
      }
      return linkingWords.has(key) ? '' : token;
    })
    .replace(/\s+/g, ' ')
    .trim();
}
