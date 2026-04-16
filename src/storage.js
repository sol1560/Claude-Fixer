// Storage layer for Claude Fixer.
//
// Settings live in chrome.storage.sync so they roam across devices.
// Font binaries live in chrome.storage.local (with the unlimitedStorage
// permission) because .otf files can be several MB each and would blow
// past sync's 100KB-per-item / 8KB-per-key quota.
//
// All functions return Promises and assume the chrome.* APIs exist
// (i.e. they only run inside the extension context).

(function () {
  const FONT_SLOTS = [
    'regular',
    'regularItalic',
    'medium',
    'mediumItalic',
    'semibold',
    'semiboldItalic',
    'bold',
    'boldItalic'
  ];

  // Slot -> CSS @font-face descriptors.
  const SLOT_DESCRIPTORS = {
    regular:        { weight: 400, style: 'normal' },
    regularItalic:  { weight: 400, style: 'italic' },
    medium:         { weight: 500, style: 'normal' },
    mediumItalic:   { weight: 500, style: 'italic' },
    semibold:       { weight: 600, style: 'normal' },
    semiboldItalic: { weight: 600, style: 'italic' },
    bold:           { weight: 700, style: 'normal' },
    boldItalic:     { weight: 700, style: 'italic' }
  };

  const DEFAULT_SETTINGS = {
    fontFix: true,
    modelAutoFix: true,
    // 'anthropic-serif' — re-point body to Anthropic's own serif (the
    //   font claude.ai still loads for response text). No upload needed.
    // 'local'  — use the user's uploaded Tiempos Text .otf files.
    // 'online' — load Source Serif 4 from Google Fonts as a fallback.
    // 'greeting-only' — only the .font-display heading gets serif.
    fontMode: 'anthropic-serif',
    // Off by default — only people who want a Chinese UI should opt in.
    uiTranslate: false,
    // Set to true to log untranslated UI strings to the DevTools
    // console (useful for growing src/i18n-zh.js's dictionary).
    uiTranslateDebug: false,
    // Prevent the "last reply got swallowed" race: block send events
    // for a short cooldown after Claude finishes streaming a response.
    sendRaceProtection: true,
    // Cooldown length in milliseconds.
    sendRaceProtectionMs: 800,
    // Thinking effort override.
    // 'default' = don't touch; otherwise a number (budget_tokens).
    thinkingEffort: 'default'
  };

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => resolve(items));
    });
  }

  function setSettings(patch) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(patch, () => resolve());
    });
  }

  // Returns { regular: 'base64...', bold: 'base64...', ... } — only slots
  // that actually have data.
  function getFonts() {
    return new Promise((resolve) => {
      const keys = FONT_SLOTS.map((s) => 'font.' + s);
      chrome.storage.local.get(keys, (items) => {
        const out = {};
        for (const slot of FONT_SLOTS) {
          const v = items['font.' + slot];
          if (v) out[slot] = v;
        }
        resolve(out);
      });
    });
  }

  function saveFont(slot, base64) {
    if (!FONT_SLOTS.includes(slot)) {
      return Promise.reject(new Error('unknown font slot: ' + slot));
    }
    return new Promise((resolve) => {
      chrome.storage.local.set({ ['font.' + slot]: base64 }, () => resolve());
    });
  }

  function deleteFont(slot) {
    return new Promise((resolve) => {
      chrome.storage.local.remove('font.' + slot, () => resolve());
    });
  }

  function clearFonts() {
    return new Promise((resolve) => {
      const keys = FONT_SLOTS.map((s) => 'font.' + s);
      chrome.storage.local.remove(keys, () => resolve());
    });
  }

  // Convenient export onto a global both content scripts and popup can see.
  const api = {
    FONT_SLOTS,
    SLOT_DESCRIPTORS,
    DEFAULT_SETTINGS,
    getSettings,
    setSettings,
    getFonts,
    saveFont,
    deleteFont,
    clearFonts
  };

  if (typeof window !== 'undefined') window.ClaudeFixerStorage = api;
  if (typeof self !== 'undefined') self.ClaudeFixerStorage = api;
})();
