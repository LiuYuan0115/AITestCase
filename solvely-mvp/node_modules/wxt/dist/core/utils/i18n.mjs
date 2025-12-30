const predefinedMessages = {
  "@@extension_id": {
    message: "<browser.runtime.id>",
    description: "The extension or app ID; you might use this string to construct URLs for resources inside the extension. Even unlocalized extensions can use this message.\nNote: You can't use this message in a manifest file."
  },
  "@@ui_locale": {
    message: "<browser.i18n.getUiLocale()>",
    description: ""
  },
  "@@bidi_dir": {
    message: "<ltr|rtl>",
    description: 'The text direction for the current locale, either "ltr" for left-to-right languages such as English or "rtl" for right-to-left languages such as Japanese.'
  },
  "@@bidi_reversed_dir": {
    message: "<rtl|ltr>",
    description: `If the @@bidi_dir is "ltr", then this is "rtl"; otherwise, it's "ltr".`
  },
  "@@bidi_start_edge": {
    message: "<left|right>",
    description: `If the @@bidi_dir is "ltr", then this is "left"; otherwise, it's "right".`
  },
  "@@bidi_end_edge": {
    message: "<right|left>",
    description: `If the @@bidi_dir is "ltr", then this is "right"; otherwise, it's "left".`
  }
};
export function parseI18nMessages(messagesJson) {
  return Object.entries({
    ...predefinedMessages,
    ...messagesJson
  }).map(([name, details]) => ({
    name,
    ...details
  }));
}
