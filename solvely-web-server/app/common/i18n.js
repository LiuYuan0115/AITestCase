/**
 * cSpell:disable
 */

/**
 * 语言映射，兼容老的 language 字段
 */
const languageMap = {
  ar: 'Arabic',
  bg: 'Bulgarian',
  cs: 'Czech',
  de: 'German',
  el: 'Greek',
  en: 'English (US)',
  'en-us': 'English (US)',
  es: 'Spanish (Latin America)',
  'es-419': 'Spanish (Latin America)',
  'es-es': 'Spanish (Spain)',
  fi: 'Finnish',
  fr: 'French (France)',
  'fr-ca': 'French (Canada)',
  'fr-fr': 'French (France)',
  he: 'Hebrew',
  hr: 'Croatian',
  hu: 'Hungarian',
  id: 'Indonesian',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  nb: 'Norwegian  (Bokmål)',
  nl: 'Dutch',
  pl: 'Polish',
  pt: 'Portuguese (Brazil)',
  'pt-br': 'Portuguese (Brazil)',
  'pt-pt': 'Portuguese (Portugal)',
  ro: 'Romanian',
  ru: 'Russian',
  sv: 'Swedish',
  th: 'Thai',
  tr: 'Turkish',
  uk: 'Ukrainian',
  ur: 'Urdu',
  vi: 'Vietnamese',
  'zh-cn': 'Simplified Chinese',
  'zh-hans': 'Simplified Chinese',
  'zh-hk': 'Traditional Chinese (Hong Kong)',
  'zh-tw': 'Traditional Chinese (Taiwan)',
};
const languageMapKeys = Object.keys(languageMap);

/**
 * 获取语言名称
 * @param {string} language 语言代码
 * @param {string} fallback 默认语言代码
 * @return {string} 语言名称
 */
const getLanguageName = (language, fallback = 'en-us') => {
  return languageMap[language] || languageMap[fallback];
};

module.exports = {
  languageMapKeys,
  getLanguageName,
};
