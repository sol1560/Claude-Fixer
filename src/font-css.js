// CSS generation for the font fix.
//
// What 2026-04-10 actually changed (verified by probing claude.ai with
// the extension disabled):
//   Anthropic introduced three in-house variable fonts:
//     - Anthropic Sans  (sans-serif)  — now drives html/body/UI/user input
//     - Anthropic Serif (serif)       — Claude responses, large headlines
//     - Anthropic Mono  (monospace)   — code
//   The relevant CSS variables are:
//     --font-ui              -> Anthropic Sans   (used by html, body)
//     --font-sans-serif      -> Anthropic Sans
//     --font-anthropic-sans  -> Anthropic Sans
//     --font-user-message    -> Anthropic Sans
//     --font-ui-serif        -> Anthropic Serif  (.font-display)
//     --font-serif           -> Anthropic Serif
//     --font-anthropic-serif -> Anthropic Serif
//     --font-claude-response -> Anthropic Serif
//     --font-mono            -> Anthropic Mono
//
// We re-point every variable above (except mono) at the user's Tiempos
// Text Local @font-face. The two layers of override are:
//   1. :root { --font-*: ... } — overrides Anthropic's :root declarations
//      so all the .font-ui / .font-claude-response / etc. classes follow
//      automatically without us touching them.
//   2. Direct selector !important rules — defence in depth in case
//      Anthropic ships another rename or hard-codes a font-family
//      somewhere.
//
// CJK note: macOS's default `serif` is STSong / Mincho. We always end
// the stack with explicit Noto / Source Han / Yu Mincho before generic
// `serif`, so CJK glyphs land on a real serif font instead.

(function () {
  // Primary font-family value used everywhere.
  // First entry depends on which mode is active. The CJK tail and
  // generic `serif` ensure Chinese / Japanese / Korean glyphs land on
  // a real serif rather than the macOS system Mincho/Songti.
  function buildFontStack(mode) {
    let head;
    if (mode === 'anthropic-serif') {
      // Reuse Anthropic's own serif (still loaded by claude.ai for the
      // response area). Perfect match for the pre-2026-04-10 look,
      // zero uploads required.
      head = ['"Anthropic Serif"'];
    } else if (mode === 'online') {
      head = ['"Source Serif 4"'];
    } else {
      // 'local'
      head = ['"Tiempos Text Local"', '"Tiempos Text"', '"Source Serif 4"'];
    }

    const cjk = [
      '"Noto Serif CJK SC"',
      '"Noto Serif CJK JP"',
      '"Source Han Serif SC"',
      '"Source Han Serif JP"',
      '"Songti SC"',
      '"STSong"',
      '"Yu Mincho"',
      '"YuMincho"'
    ];

    return [...head, ...cjk, 'serif'].join(', ');
  }

  // Track blob URLs we've created so callers can revoke them on the next
  // reload — otherwise every settings change leaks 8 ObjectURLs.
  const liveBlobUrls = [];

  function revokeBlobUrls() {
    while (liveBlobUrls.length) {
      try { URL.revokeObjectURL(liveBlobUrls.pop()); } catch (_) { /* ignore */ }
    }
  }

  // Build @font-face rules for whatever local font slots the user uploaded.
  // `fonts` is { slot: base64 }, `descriptors` is the slot -> {weight,style} map.
  function buildFontFaceCSS(fonts, descriptors) {
    revokeBlobUrls();
    const lines = [];
    for (const slot of Object.keys(fonts)) {
      const desc = descriptors[slot];
      if (!desc) continue;
      const blobUrl = base64ToBlobUrl(fonts[slot]);
      liveBlobUrls.push(blobUrl);
      lines.push(
        `@font-face {`,
        `  font-family: "Tiempos Text Local";`,
        `  src: url(${blobUrl}) format("opentype");`,
        `  font-weight: ${desc.weight};`,
        `  font-style: ${desc.style};`,
        `  font-display: swap;`,
        `}`
      );
    }
    return lines.join('\n');
  }

  // Build the override CSS that re-points Tailwind variables and forces
  // the fallback selectors.
  //   mode = 'anthropic-serif' | 'local' | 'online'  → full body override
  //   mode = 'greeting-only'                          → only the greeting
  //                                                     ".font-display" gets
  //                                                     restored to serif;
  //                                                     body keeps its default
  //                                                     Anthropic Sans.
  function buildOverrideCSS(mode) {
    if (mode === 'greeting-only') {
      // Don't override any --font-* variables. Only force the greeting
      // heading to use Anthropic Serif (already loaded by claude.ai).
      // CJK fallback chain still applies for non-Latin glyphs in headings.
      const greetingStack = [
        '"Anthropic Serif"',
        '"Noto Serif CJK SC"', '"Noto Serif CJK JP"',
        '"Source Han Serif SC"', '"Source Han Serif JP"',
        '"Songti SC"', '"STSong"', '"Yu Mincho"', '"YuMincho"',
        'serif'
      ].join(', ');
      return `
.font-display,
[class*="font-display"] {
  font-family: ${greetingStack} !important;
}
`;
    }

    const stack = buildFontStack(mode);
    return `
:root {
  /* Sans-side variables (currently Anthropic Sans). */
  --font-ui: ${stack};
  --font-sans-serif: ${stack};
  --font-anthropic-sans: ${stack};
  --font-user-message: ${stack};

  /* Serif-side variables (currently Anthropic Serif). */
  --font-serif: ${stack};
  --font-ui-serif: ${stack};
  --font-anthropic-serif: ${stack};
  --font-claude-response: ${stack};
}

/* Defence in depth: cover the actual class names Tailwind ships,
   plus any hard-coded font-family on common nodes. */
html, body, :host,
.font-ui, .font-base, .font-base-bold, .font-display,
.font-serif, .font-ui-serif,
.font-user-message, .\\!font-user-message,
.font-claude-response,
[class*="font-claude"], [class*="font-user"],
h1, h2, h3, h4, h5, h6,
p, li, blockquote, button, input, textarea, label, select {
  font-family: ${stack} !important;
}

/* Keep monospace where it belongs — never override --font-mono. */
code, pre, kbd, samp,
.font-mono,
[class*="language-"],
[class*="font-mono"] {
  font-family: var(--font-mono, "Anthropic Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace) !important;
}
`;
  }

  // <link> tags for the Source Serif 4 fallback.
  function buildOnlineFallbackHTML() {
    return `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500;1,8..60,600;1,8..60,700&display=swap">
`.trim();
  }

  function base64ToBlobUrl(b64) {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'font/otf' });
    return URL.createObjectURL(blob);
  }

  window.ClaudeFixerCSS = {
    buildFontStack,
    buildFontFaceCSS,
    buildOverrideCSS,
    buildOnlineFallbackHTML,
    base64ToBlobUrl,
    revokeBlobUrls
  };
})();
