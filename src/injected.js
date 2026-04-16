// MAIN world fetch interceptor for thinking effort override.
//
// Injects <reasoning_effort>N</reasoning_effort> into the system/style
// prompt. This XML tag may be parsed by Claude's inference system to
// control how much thinking budget the model allocates.

(function () {
  if (window.__claudeFixerInstalled) return;
  window.__claudeFixerInstalled = true;

  window.__claudeFixerThinkingBudget = 0;

  const TAG = '[Claude Fixer/page]';

  // Maps our budget levels to reasoning_effort values.
  // Default (85) is what claude.ai reportedly uses.
  const EFFORT_VALUES = {
    0:       0,     // don't inject
    2048:    30,    // Low
    10000:   85,    // Medium (same as default, explicit)
    40000:   150,   // High
    128000:  200,   // Max
    1000000: 255    // Ultra
  };

  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const data = ev.data;
    if (!data || data.source !== 'claude-fixer-cs') return;
    if (data.type === 'setThinkingBudget') {
      window.__claudeFixerThinkingBudget = Number(data.budget) || 0;
      console.log(TAG, 'thinkingBudget =', window.__claudeFixerThinkingBudget);
    }
  });

  const origFetch = window.fetch.bind(window);
  window.__claudeFixerOrigFetch = origFetch;
  const MARKER = '[[CF_RE]]';

  window.fetch = async function (input, init) {
    try {
      const url = typeof input === 'string'
        ? input
        : (input && input.url) || '';

      const isApi = /claude\.ai\/api\//.test(url) || /^\/api\//.test(url);

      if (isApi && init && init.body && typeof init.body === 'string') {
        let json = null;
        try { json = JSON.parse(init.body); } catch (_) {}

        if (json && typeof json === 'object') {
          const budget = window.__claudeFixerThinkingBudget;

          const looksLikeSend = json.prompt !== undefined &&
            /completion/i.test(url);

          if (looksLikeSend && budget > 0) {
            const effortValue = EFFORT_VALUES[budget];
            if (!effortValue) return origFetch(input, init);

            const tag = '<reasoning_effort>' + effortValue + '</reasoning_effort>';
            let mutated = false;

            // Inject into personalized_styles[0].prompt (system-level)
            if (Array.isArray(json.personalized_styles) &&
                json.personalized_styles.length > 0) {
              const style = json.personalized_styles[0];
              const current = style.prompt || '';
              if (!current.includes(MARKER)) {
                // Prepend the tag at the very beginning of the style prompt
                style.prompt = MARKER + tag + '\n' + current;
                mutated = true;
              }
            }

            if (mutated) {
              console.log(TAG, 'injected reasoning_effort =', effortValue);
              init = { ...init, body: JSON.stringify(json) };
            }
          }
        }
      }
    } catch (e) {
      console.warn(TAG, 'hook error', e);
    }
    return origFetch(input, init);
  };

  console.log(TAG, 'fetch hook installed');
})();
