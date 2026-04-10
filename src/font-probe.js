// Font reverse-engineering probe.
//
// Runs once on every page load and dumps to console:
//   1. Every CSS custom property on :root whose name contains "font"
//   2. The computed font-family of a handful of structural selectors
//   3. Any CSS rule (in same-origin stylesheets) that mentions
//      font-family or --font*
//
// We keep this in production because claude.ai is a moving target — when
// they rename a variable next time, the user can open DevTools and see
// the current state without rebuilding the extension.

(function () {
  function probeCssVars() {
    const out = {};
    const root = getComputedStyle(document.documentElement);
    for (let i = 0; i < root.length; i++) {
      const name = root[i];
      if (name.startsWith('--') && /font/i.test(name)) {
        out[name] = root.getPropertyValue(name).trim();
      }
    }
    return out;
  }

  function probeComputed() {
    const probes = [
      'html',
      'body',
      'main',
      'p',
      'h1', 'h2', 'h3',
      'button',
      'code',
      'pre',
      '.font-user-message',
      '.font-claude-message',
      '.prose',
      '[class*="font-"]'
    ];
    const out = {};
    for (const sel of probes) {
      let el = null;
      try { el = document.querySelector(sel); } catch (e) { /* invalid */ }
      if (el) {
        const cs = getComputedStyle(el);
        out[sel] = {
          fontFamily: cs.fontFamily,
          fontWeight: cs.fontWeight,
          fontStyle: cs.fontStyle
        };
      }
    }
    return out;
  }

  function probeRules() {
    const out = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; /* CORS */ }
      if (!rules) continue;
      for (const rule of rules) {
        const text = rule.cssText || '';
        if (/font-family|--font/i.test(text)) {
          // truncate noisy rules
          out.push(text.length > 240 ? text.slice(0, 240) + '…' : text);
          if (out.length >= 80) return out;
        }
      }
    }
    return out;
  }

  function probeFonts() {
    const result = {
      url: location.href,
      cssVars: probeCssVars(),
      computed: probeComputed(),
      rules: probeRules()
    };
    // Group output so it's easy to spot in DevTools.
    console.groupCollapsed('[Claude Fixer] font probe');
    console.log('CSS custom properties:', result.cssVars);
    console.log('Computed font-family per selector:', result.computed);
    console.log('Same-origin font rules:', result.rules);
    console.groupEnd();
    return result;
  }

  window.ClaudeFixerProbe = { probeFonts };
})();
