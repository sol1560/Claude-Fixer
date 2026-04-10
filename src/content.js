// Content script. Runs at document_start in the ISOLATED world.
//
// Two jobs:
//   1. Font fix — inject @font-face + override CSS, watch <head> for SPA
//      re-renders, run a probe so DevTools always has the current state.
//   2. Model guard — detect when claude.ai silently flips Opus 4.6
//      Extended Thinking back to plain Opus 4.6 after sending a message,
//      and re-click the menu item to put it back.
//
// The model guard is purely DOM-side. The first message after the user
// turns on Extended Thinking *is* sent with thinking enabled (verified
// by the user); only the local UI state for the model selector resets.
// So watching the dropdown's textContent and re-clicking the menu item
// is enough — no need to touch fetch/payloads.

(function () {
  const TAG = '[Claude Fixer]';
  const STYLE_ID = 'claude-fixer-style';
  const FONTFACE_STYLE_ID = 'claude-fixer-fontface';
  const ONLINE_LINK_ID = 'claude-fixer-online';

  const Storage = window.ClaudeFixerStorage;
  const CSS = window.ClaudeFixerCSS;
  const Probe = window.ClaudeFixerProbe;
  const Translator = window.ClaudeFixerTranslator;

  let cachedSettings = null;
  let cachedFonts = null;

  // ============================================================
  // FONT FIX
  // ============================================================

  function ensureStyle(id) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      (document.head || document.documentElement).appendChild(el);
    }
    return el;
  }

  function removeStyle(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function applyFontCSS(settings, fonts) {
    if (!settings.fontFix) {
      removeStyle(STYLE_ID);
      removeStyle(FONTFACE_STYLE_ID);
      removeStyle(ONLINE_LINK_ID);
      return;
    }
    const hasLocal = fonts && Object.keys(fonts).length > 0;
    let effectiveMode;
    if (settings.fontMode === 'local' && hasLocal) {
      effectiveMode = 'local';
    } else if (settings.fontMode === 'online') {
      effectiveMode = 'online';
    } else if (settings.fontMode === 'greeting-only') {
      effectiveMode = 'greeting-only';
    } else {
      // Default — and the fall-through when 'local' was selected but
      // no files were uploaded. Anthropic Serif is the perfect match
      // for the pre-2026-04-10 look and needs no additional resources.
      effectiveMode = 'anthropic-serif';
    }

    ensureStyle(STYLE_ID).textContent = CSS.buildOverrideCSS(effectiveMode);

    if (effectiveMode === 'local') {
      ensureStyle(FONTFACE_STYLE_ID).textContent =
        CSS.buildFontFaceCSS(fonts, Storage.SLOT_DESCRIPTORS);
      removeStyle(ONLINE_LINK_ID);
    } else if (effectiveMode === 'online') {
      removeStyle(FONTFACE_STYLE_ID);
      let holder = document.getElementById(ONLINE_LINK_ID);
      if (!holder) {
        holder = document.createElement('div');
        holder.id = ONLINE_LINK_ID;
        holder.style.display = 'none';
        (document.head || document.documentElement).appendChild(holder);
      }
      holder.innerHTML = CSS.buildOnlineFallbackHTML();
    } else {
      // anthropic-serif and greeting-only — nothing extra to inject,
      // both rely on the Anthropic Serif font that claude.ai is already
      // loading itself.
      removeStyle(FONTFACE_STYLE_ID);
      removeStyle(ONLINE_LINK_ID);
    }
  }

  // claude.ai is a SPA that occasionally rewrites <head>. Re-apply if
  // our <style> elements get nuked.
  function watchHead() {
    const obs = new MutationObserver(() => {
      if (!cachedSettings || !cachedSettings.fontFix) return;
      if (!document.getElementById(STYLE_ID)) {
        applyFontCSS(cachedSettings, cachedFonts);
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ============================================================
  // MODEL GUARD (Extended Thinking auto-restore)
  // ============================================================
  //
  // The bug we are fixing is *unidirectional*: after sending a message,
  // claude.ai silently flips the model selector from
  // "Opus 4.6 Extended" to "Opus 4.6" (no Extended). The next message
  // is then sent without thinking. We never see the opposite flip
  // happen as a bug.
  //
  // So the algorithm is:
  //   1. Track lastObservedThinking — the most recent state we've seen.
  //   2. On every state change:
  //        on → off  : if a user menuitem click did NOT happen recently,
  //                    that's the bug. Restore to ON.
  //        off → on  : always benign — could be claude.ai loading the
  //                    saved preference, our own restore, or a deliberate
  //                    user click. Never act on this direction. (This is
  //                    also why an early page-load flip from off to on no
  //                    longer causes us to "fix" the user's preference
  //                    away.)
  //   3. On SPA navigation (pathname change), drop the baseline so we
  //      don't carry one chat's state into another.

  const DROPDOWN_SEL = '[data-testid="model-selector-dropdown"]';
  const MENU_SEL = '[role="menu"][data-open]';
  const MENUITEM_SEL = '[role="menuitem"]';
  const RESTORE_DEBOUNCE_MS = 800;

  let modelGuardStarted = false;
  let lastObservedThinking = null;   // null until we've seen the dropdown
  let lastPathname = location.pathname;
  let lastUserMenuClickTs = 0;
  let isAutoRestoring = false;
  let modelObs = null;

  function getDropdown() {
    return document.querySelector(DROPDOWN_SEL);
  }

  function readThinkingState() {
    const el = getDropdown();
    if (!el) return null;
    const text = (el.textContent || '').replace(/\s+/g, '');
    return /Extended/i.test(text);
  }

  function isExtendedThinkingMenuitem(el) {
    return /^extended\s*thinking/i.test((el.textContent || '').trim());
  }

  // Wait until predicate() returns truthy (or timeout).
  function waitFor(predicate, timeoutMs) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        let v;
        try { v = predicate(); } catch (e) { v = null; }
        if (v) return resolve(v);
        if (Date.now() - start > timeoutMs) return resolve(null);
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  async function clickRestore() {
    if (isAutoRestoring) return;
    const dropdown = getDropdown();
    if (!dropdown) return;
    isAutoRestoring = true;
    try {
      const wasOpen = dropdown.getAttribute('aria-expanded') === 'true';
      if (!wasOpen) {
        dropdown.click();
        const opened = await waitFor(
          () => dropdown.getAttribute('aria-expanded') === 'true',
          800
        );
        if (!opened) return;
      }
      const menu = await waitFor(() => document.querySelector(MENU_SEL), 800);
      if (!menu) return;
      const items = menu.querySelectorAll(MENUITEM_SEL);
      let target = null;
      for (const it of items) {
        if (isExtendedThinkingMenuitem(it)) { target = it; break; }
      }
      if (target) {
        target.click();
        console.log(TAG, 'restored Extended Thinking via menu click');
      } else {
        // Couldn't find — close menu so the user isn't left with it open.
        dropdown.click();
      }
    } finally {
      // Give React a moment to update before we resume reacting to mutations.
      setTimeout(() => { isAutoRestoring = false; }, 400);
    }
  }

  function onMutation() {
    if (!cachedSettings || !cachedSettings.modelAutoFix) return;
    if (isAutoRestoring) return;

    // SPA navigation between chats — drop the baseline so the new
    // chat's initial state isn't compared against the old one.
    if (location.pathname !== lastPathname) {
      lastPathname = location.pathname;
      lastObservedThinking = null;
    }

    const cur = readThinkingState();
    if (cur === null) return;

    if (lastObservedThinking === null) {
      lastObservedThinking = cur;
      return;
    }
    if (cur === lastObservedThinking) return;

    const wasOn = lastObservedThinking;
    lastObservedThinking = cur;

    // off → on is always benign (page-load preference, our own restore,
    // or a deliberate user choice). Never act on it.
    if (!wasOn || cur) return;

    // wasOn && !cur — the bug direction.
    if (Date.now() - lastUserMenuClickTs < RESTORE_DEBOUNCE_MS) {
      // User clicked Extended thinking themselves to turn it off.
      return;
    }

    console.log(TAG, 'detected silent Extended Thinking reset, restoring');
    clickRestore();
  }

  function startModelGuard() {
    if (modelGuardStarted) return;
    modelGuardStarted = true;

    // Document-level click delegation to detect user-initiated toggles.
    // We listen in capture phase so we observe the click before React's
    // own handlers run and unmount the menu.
    document.addEventListener('click', (e) => {
      if (isAutoRestoring) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      const item = target.closest(MENUITEM_SEL);
      if (!item) return;
      // Only treat clicks inside the model dropdown menu as model intent.
      if (!item.closest(MENU_SEL)) return;
      lastUserMenuClickTs = Date.now();
    }, true);

    // Watch the whole body for any structural / textual change so we
    // catch the dropdown being remounted between SPA navigations and
    // for the textContent flip itself.
    modelObs = new MutationObserver(onMutation);
    modelObs.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-testid', 'aria-expanded']
    });

    console.log(TAG, 'model guard started');
  }

  function stopModelGuard() {
    if (!modelGuardStarted) return;
    modelGuardStarted = false;
    if (modelObs) { modelObs.disconnect(); modelObs = null; }
    lastObservedThinking = null;
    console.log(TAG, 'model guard stopped');
  }

  // ============================================================
  // BOOTSTRAP
  // ============================================================

  async function reload() {
    cachedSettings = await Storage.getSettings();
    cachedFonts = await Storage.getFonts();
    applyFontCSS(cachedSettings, cachedFonts);
    if (cachedSettings.modelAutoFix) startModelGuard();
    else stopModelGuard();
    if (Translator) {
      if (cachedSettings.uiTranslate) {
        Translator.start({ logUntranslated: !!cachedSettings.uiTranslateDebug });
      } else {
        Translator.stop();
      }
    }
  }

  reload().then(() => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => Probe.probeFonts(), { once: true });
    } else {
      setTimeout(() => Probe.probeFonts(), 500);
    }
  });

  if (document.documentElement) {
    watchHead();
  } else {
    document.addEventListener('readystatechange', watchHead, { once: true });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.source !== 'claude-fixer-popup') return;
    if (msg.type === 'reload') {
      reload().then(() => sendResponse({ ok: true }));
      return true;
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' || area === 'local') reload();
  });
})();
