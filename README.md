# Claude Fixer

A Manifest V3 Chrome extension for `claude.ai`. Three independent things:

1. **Font fix** — restores a serif body font after the 2026-04-10 redesign
   swapped the default to Anthropic Sans. Defaults to Anthropic's own
   serif (no upload needed); also supports local Tiempos Text `.otf`
   uploads, an Online (Source Serif 4) fallback, and a "Greeting only"
   mode that touches just the homepage greeting heading. CJK glyphs
   fall back to Noto Serif CJK / Source Han Serif / Yu Mincho instead
   of the macOS system Mincho/Songti.
2. **Auto-fix Extended Thinking** — claude.ai silently flips the model
   selector from "Opus 4.6 Extended" back to plain "Opus 4.6" after you
   send a message, so the *next* message goes without thinking. The
   fix watches the dropdown's text via a MutationObserver and re-clicks
   the "Extended thinking" menu item whenever it detects a silent
   on→off flip. SPA navigation between chats resets the baseline; user
   menu clicks within an 800 ms window are treated as intent.
3. **Translate UI to 中文** — claude.ai's official language picker has
   no Simplified Chinese option (as of 2026-04). This toggles a
   dictionary-based translator (~550 entries) that walks the DOM and
   replaces UI text nodes plus key attributes (`aria-label`,
   `placeholder`, `title`, `alt`). Conversation content is *never*
   touched: the skip zone hard-excludes
   `[data-testid="user-message"]`, `.font-claude-response`,
   `.font-user-message`, any `<textarea> / <input> /
   [contenteditable]`, and `<code> / <pre> / <kbd> / <samp>`.

## Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and pick the cloned repo folder
4. Pin **Claude Fixer** to the toolbar

## Font fix

Open the popup and toggle **Font fix**. Four modes:

- **Anthropic Serif (recommended)** — default. Re-points
  `--font-ui` (and friends) to `"Anthropic Serif"`, the font claude.ai
  is already loading for the response area. Zero uploads, perfect
  match for the pre-2026-04-10 look.
- **Greeting only (subtle)** — leaves the body in claude.ai's current
  Anthropic Sans and only restores `.font-display` (the homepage
  greeting heading) to serif.
- **Local files (Tiempos Text)** — upload your own Tiempos Text `.otf`
  files. Eight slots: Regular / Italic / Medium / Medium Italic /
  Semibold / Semibold Italic / Bold / Bold Italic. Minimum useful
  upload is Regular + Bold; the browser synthesises the rest. There's
  also a one-click `.zip` import that walks a zip with files named
  `TiemposText-Regular.otf`, `TiemposText-BoldItalic.otf`, etc., and
  populates all eight slots in one go. The bundled extractor is
  pure JS (uses the native `DecompressionStream` API).
- **Online (Source Serif 4)** — no upload needed; loads Source Serif 4
  from Google Fonts as a free Tiempos lookalike.

Files are stored in `chrome.storage.local` (the extension requests
`unlimitedStorage` so 8 .otf files won't hit the 10 MB cap).

## Auto-fix Extended Thinking

Toggle **Auto-fix Extended Thinking** in the popup. The algorithm:

```
on every DOM mutation:
  1. if location.pathname changed, drop the baseline (SPA navigation)
  2. read [data-testid="model-selector-dropdown"] textContent
  3. if it changed since lastObservedThinking:
       - off → on  : always benign, just update baseline
       - on → off  : if no user menuitem click in last 800 ms,
                     this is the bug. Click the dropdown,
                     wait for [role="menu"][data-open], find the
                     menuitem starting with "Extended thinking",
                     click it.
```

Asymmetric on purpose — the bug is one-directional (always on→off),
so off→on transitions are never treated as bugs. This avoids the
"page-load loading saved preferences" trap where the extension was
fighting claude.ai's own initialisation.

## Translate UI to 中文

Toggle **界面翻译为中文** in the popup. The translator runs immediately
and re-runs on every relevant DOM mutation. Dictionary lives at
`src/i18n-zh.js`.

To grow the dictionary:

1. Enable the debug sub-toggle ("Log untranslated strings to console")
2. Navigate around claude.ai with DevTools open
3. Look for `[Claude Fixer/zh] untranslated: "..."` lines
4. Add the English keys to `DICT` in `src/i18n-zh.js`
5. Reload the extension

For batch dictionary updates there's also a one-shot probe script (see
the in-file comment near `DICT`) that dumps every candidate UI string
on the current page to `~/Downloads/i18n-strings-*.json`. Run it on
each route, then translate the merged set.

To handle text that's split across DOM nodes (e.g.
`What [link]personal preferences[/link] should Claude consider in
responses?`), the translator allows mapping a fragment to an empty
string, which makes that fragment vanish so the surrounding
already-translated fragments form a coherent sentence.

## Reverse-engineering helpers

On every page load the content script runs a probe that prints to the
DevTools console:

```
[Claude Fixer] font probe
  cssVars:    { --font-ui: ..., --font-anthropic-sans: ..., ... }
  computed:   { body: ..., .font-claude-response: ..., ... }
  rules:      [ "@font-face { font-family: 'Anthropic Sans' ... }" ]
```

Use this output when Anthropic renames variables — drop the new names
into `buildOverrideCSS()` in `src/font-css.js` and reload.

## Project layout

```
manifest.json
src/
  storage.js      chrome.storage wrappers (settings + font binaries)
  font-probe.js   reverse-engineering probe (logs CSS state)
  font-css.js     builds @font-face + override CSS (incl. CJK fallback)
  i18n-zh.js     dictionary + translator + MutationObserver
  content.js     orchestrator: injects CSS, model guard, translator
popup/
  popup.html
  popup.css
  popup.js
_locales/
  en/messages.json    English popup strings
  zh_CN/messages.json Simplified Chinese popup strings
icons/
  icon16.png  icon48.png  icon128.png   (Claude AI symbol)
```

## Permissions

- `storage` — settings + font binaries
- `unlimitedStorage` — lifts the 10 MB local-storage cap for .otf files
- `activeTab`, `tabs` — popup needs `chrome.tabs.sendMessage` to
  broadcast reload across all open claude.ai tabs
- Host: `*://claude.ai/*` only — nothing else

No `scripting`, no `webRequest`, no `webNavigation`, no MAIN-world
script injection. Everything runs in the content script's ISOLATED
world.

## Known limitations

- The Chinese translator can't handle dynamic strings like
  "X minutes ago", "$200.00", "11 days ago" — those would need a
  pattern-based translator (regex with capture groups). Currently they
  stay in their original form.
- Doesn't touch `claude.com` or any other Anthropic property.
- Doesn't ship Tiempos Text itself; it's a commercial font and you
  must supply the files (or use one of the other modes).
