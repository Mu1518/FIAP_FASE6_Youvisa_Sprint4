const FLAG_BY_KEY: Record<string, string> = {
  'estados unidos': '🇺🇸', 'eua': '🇺🇸', 'usa': '🇺🇸', 'united states': '🇺🇸',
  'canada': '🇨🇦',
  'reino unido': '🇬🇧', 'inglaterra': '🇬🇧', 'uk': '🇬🇧', 'united kingdom': '🇬🇧',
  'portugal': '🇵🇹',
  'espanha': '🇪🇸', 'spain': '🇪🇸',
  'franca': '🇫🇷', 'france': '🇫🇷',
  'alemanha': '🇩🇪', 'germany': '🇩🇪',
  'italia': '🇮🇹', 'italy': '🇮🇹',
  'japao': '🇯🇵', 'japan': '🇯🇵',
  'china': '🇨🇳',
  'coreia do sul': '🇰🇷', 'south korea': '🇰🇷',
  'australia': '🇦🇺',
  'nova zelandia': '🇳🇿', 'new zealand': '🇳🇿',
  'irlanda': '🇮🇪', 'ireland': '🇮🇪',
  'holanda': '🇳🇱', 'paises baixos': '🇳🇱', 'netherlands': '🇳🇱',
  'suica': '🇨🇭', 'switzerland': '🇨🇭',
  'suecia': '🇸🇪', 'sweden': '🇸🇪',
  'noruega': '🇳🇴', 'norway': '🇳🇴',
  'mexico': '🇲🇽',
  'argentina': '🇦🇷',
  'brasil': '🇧🇷', 'brazil': '🇧🇷',
};

export function getCountryFlag(country: string | null | undefined): string | null {
  if (!country) return null;
  const key = country
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
  return FLAG_BY_KEY[key] ?? null;
}
