export const defaultLanguage = "eng";
export const languageIds = ["eng", "chs", "jpn", "kor"];

export function detectLanguage(languages = []) {
  for (const value of Array.isArray(languages) ? languages : [languages]) {
    if (typeof value !== "string") continue;
    const tag = value.trim().replaceAll("_", "-").toLowerCase();
    if (/^en(?:-|$)/.test(tag)) return "eng";
    if (/^ja(?:-|$)/.test(tag)) return "jpn";
    if (/^ko(?:-|$)/.test(tag)) return "kor";
    // Only Simplified Chinese is bundled; do not label it as Traditional Chinese.
    if (/^zh(?:$|-hans(?:-|$))/.test(tag) || /^zh-(?:cn|sg)$/.test(tag))
      return "chs";
  }
  return defaultLanguage;
}

export function resolveLanguagePreferences(stored, languages) {
  try {
    const saved = JSON.parse(stored);
    if (saved && languageIds.includes(saved.id)) {
      const values = saved.values;
      return {
        id: saved.id,
        values:
          values && typeof values === "object" && !Array.isArray(values)
            ? values
            : null,
      };
    }
  } catch {
    /* Ignore malformed preferences and use the system language. */
  }
  return { id: detectLanguage(languages), values: null };
}

export async function initialLanguagePreferences({
  storage,
  navigator,
  desktop,
} = {}) {
  let stored = null;
  try {
    stored = storage?.getItem("ibmsc-language");
  } catch {
    /* Storage may be blocked. */
  }
  let languages = navigator?.languages?.length
    ? navigator.languages
    : [navigator?.language];
  try {
    const system = await desktop?.systemLanguages?.();
    if (Array.isArray(system) && system.length) languages = system;
  } catch {
    /* Browser language is still available if the desktop bridge fails. */
  }
  return resolveLanguagePreferences(stored, languages);
}
