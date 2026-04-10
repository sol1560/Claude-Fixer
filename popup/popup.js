// Popup logic.
//
// Reads / writes the same chrome.storage namespaces the content script
// uses, then broadcasts a 'reload' message to all claude.ai tabs so the
// fix re-applies without a refresh.

(function () {
  const Storage = window.ClaudeFixerStorage;

  // ---- i18n ----
  // chrome.i18n.getMessage auto-picks _locales/<browser-language>/messages.json,
  // falling back to default_locale (en).
  function t(key, substitutions) {
    if (typeof chrome !== 'undefined' && chrome.i18n) {
      const m = chrome.i18n.getMessage(key, substitutions);
      if (m) return m;
    }
    return key;
  }

  // Slot labels are localised — the keys live in messages.json under
  // slotRegular, slotRegularItalic, etc.
  function slotLabel(slot) {
    return t('slot' + slot.charAt(0).toUpperCase() + slot.slice(1));
  }

  // Walk the DOM and apply data-i18n / data-i18n-attr-* attributes.
  function applyStaticI18n(root) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const msg = t(key);
      if (msg) el.textContent = msg;
    });
    // <html lang="...">
    if (chrome?.i18n) {
      const lang = chrome.i18n.getUILanguage();
      if (lang) document.documentElement.setAttribute('lang', lang);
    }
  }

  const $ = (id) => document.getElementById(id);

  async function init() {
    applyStaticI18n(document);
    const settings = await Storage.getSettings();
    const fonts = await Storage.getFonts();

    $('fontFix').checked = settings.fontFix;
    $('modelAutoFix').checked = settings.modelAutoFix;
    $('uiTranslate').checked = settings.uiTranslate;
    $('uiTranslateDebug').checked = settings.uiTranslateDebug;
    $('modeAnthropic').checked = settings.fontMode === 'anthropic-serif';
    $('modeGreetingOnly').checked = settings.fontMode === 'greeting-only';
    $('modeLocal').checked = settings.fontMode === 'local';
    $('modeOnline').checked = settings.fontMode === 'online';

    renderSlots(fonts);
    updateStatus(settings, fonts);

    $('fontFix').addEventListener('change', async (e) => {
      await Storage.setSettings({ fontFix: e.target.checked });
      await broadcastReload();
      refresh();
    });

    $('modelAutoFix').addEventListener('change', async (e) => {
      await Storage.setSettings({ modelAutoFix: e.target.checked });
      await broadcastReload();
      refresh();
    });

    $('uiTranslate').addEventListener('change', async (e) => {
      await Storage.setSettings({ uiTranslate: e.target.checked });
      await broadcastReload();
      refresh();
    });

    $('uiTranslateDebug').addEventListener('change', async (e) => {
      await Storage.setSettings({ uiTranslateDebug: e.target.checked });
      await broadcastReload();
      refresh();
    });

    document.querySelectorAll('input[name="fontMode"]').forEach((r) => {
      r.addEventListener('change', async (e) => {
        if (!e.target.checked) return;
        await Storage.setSettings({ fontMode: e.target.value });
        await broadcastReload();
        refresh();
      });
    });

    $('clearFonts').addEventListener('click', async () => {
      await Storage.clearFonts();
      await broadcastReload();
      refresh();
    });

    $('zipImport').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const hint = $('zipHint');
      const original = hint.textContent;
      hint.textContent = t('extracting');
      try {
        const buf = await file.arrayBuffer();
        const entries = await extractZip(buf);
        let imported = 0;
        for (const entry of entries) {
          const slot = slotFromFilename(entry.filename);
          if (!slot) continue;
          const b64 = uint8ToBase64(entry.data);
          await Storage.saveFont(slot, b64);
          imported++;
        }
        hint.textContent = t('imported', [String(imported)]);
        await Storage.setSettings({ fontFix: true, fontMode: 'local' });
        await broadcastReload();
        refresh();
        setTimeout(() => { hint.textContent = original; }, 2500);
      } catch (err) {
        console.error('zip import failed', err);
        hint.textContent = t('importFailed', [err.message || String(err)]);
      } finally {
        // allow re-picking the same file
        e.target.value = '';
      }
    });
  }

  function renderSlots(fonts) {
    const container = $('slots');
    container.innerHTML = '';
    for (const slot of Storage.FONT_SLOTS) {
      const row = document.createElement('div');
      row.className = 'slot-row';

      const labelCell = document.createElement('div');
      labelCell.className = 'label-cell';

      const lbl = document.createElement('label');
      lbl.textContent = slotLabel(slot);
      lbl.htmlFor = 'file-' + slot;
      labelCell.appendChild(lbl);

      const input = document.createElement('input');
      input.type = 'file';
      input.id = 'file-' + slot;
      input.accept = '.otf,.ttf,.woff,.woff2,font/otf,font/ttf';
      input.addEventListener('change', (e) => onFile(slot, e.target.files[0]));
      labelCell.appendChild(input);

      const status = document.createElement('span');
      status.className = 'slot-status' + (fonts[slot] ? ' has' : '');
      status.textContent = fonts[slot] ? t('slotUploaded') : t('slotNotSet');

      row.appendChild(labelCell);
      row.appendChild(status);
      container.appendChild(row);
    }
  }

  async function onFile(slot, file) {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      await Storage.saveFont(slot, b64);
      await broadcastReload();
      refresh();
    } catch (e) {
      console.error('font upload failed', e);
      alert(t('fontReadFailed', [e.message || String(e)]));
    }
  }

  function arrayBufferToBase64(buf) {
    return uint8ToBase64(new Uint8Array(buf));
  }

  function uint8ToBase64(bytes) {
    const CHUNK = 0x8000;
    let bin = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  // ---------- Minimal ZIP extractor ----------
  // Parses central directory + local file headers. Supports STORE (0)
  // and DEFLATE (8) via the native DecompressionStream API. No external
  // library needed.

  async function extractZip(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const len = arrayBuffer.byteLength;

    // Find End of Central Directory record (signature 0x06054b50).
    let eocd = -1;
    const minOffset = Math.max(0, len - 65557);
    for (let i = len - 22; i >= minOffset; i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('not a zip file (no EOCD)');

    const totalEntries = view.getUint16(eocd + 10, true);
    const cdOffset = view.getUint32(eocd + 16, true);

    const entries = [];
    let p = cdOffset;
    const utf8 = new TextDecoder('utf-8');

    for (let i = 0; i < totalEntries; i++) {
      if (view.getUint32(p, true) !== 0x02014b50) {
        throw new Error('bad central directory at offset ' + p);
      }
      const compression = view.getUint16(p + 10, true);
      const compSize    = view.getUint32(p + 20, true);
      const fnLen       = view.getUint16(p + 28, true);
      const extraLen    = view.getUint16(p + 30, true);
      const commentLen  = view.getUint16(p + 32, true);
      const localOffset = view.getUint32(p + 42, true);
      const filename    = utf8.decode(new Uint8Array(arrayBuffer, p + 46, fnLen));

      // Jump to the local file header to find the actual data offset
      // (extra field length can differ between CD entry and local entry).
      if (view.getUint32(localOffset, true) !== 0x04034b50) {
        throw new Error('bad local header for ' + filename);
      }
      const lfnLen    = view.getUint16(localOffset + 26, true);
      const lextraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + lfnLen + lextraLen;
      const raw = new Uint8Array(arrayBuffer, dataStart, compSize);

      let data;
      if (compression === 0) {
        data = raw;
      } else if (compression === 8) {
        const ds = new DecompressionStream('deflate-raw');
        const stream = new Blob([raw]).stream().pipeThrough(ds);
        data = new Uint8Array(await new Response(stream).arrayBuffer());
      } else {
        // Skip unsupported entries silently — we only care about the .otf files.
        p += 46 + fnLen + extraLen + commentLen;
        continue;
      }

      entries.push({ filename, data });
      p += 46 + fnLen + extraLen + commentLen;
    }
    return entries;
  }

  // Map a filename like "TiemposText-BoldItalic.otf" (or with leading
  // path components) to one of the storage slot keys. Returns null if
  // the file isn't a recognised Tiempos style.
  function slotFromFilename(name) {
    const base = name.split('/').pop().split('\\').pop().toLowerCase();
    if (!/\.(otf|ttf|woff2?)$/.test(base)) return null;
    const m = base.match(/(regular|medium|semibold|bold)(italic)?\.(otf|ttf|woff2?)$/);
    if (!m) return null;
    return m[2] ? (m[1] + 'Italic') : m[1];
  }

  async function refresh() {
    const settings = await Storage.getSettings();
    const fonts = await Storage.getFonts();
    renderSlots(fonts);
    updateStatus(settings, fonts);
  }

  function updateStatus(settings, fonts) {
    const count = Object.keys(fonts).length;
    const total = Storage.FONT_SLOTS.length;
    const modeLabel = {
      'anthropic-serif': 'anthropic-serif',
      'greeting-only': 'greeting-only',
      'local': `local ${count}/${total}`,
      'online': 'online'
    }[settings.fontMode] || settings.fontMode;
    const fontFix = settings.fontFix ? 'on' : 'off';
    const modelFix = settings.modelAutoFix ? 'on' : 'off';
    $('status').textContent =
      `font: ${fontFix} (${modeLabel}) · model fix: ${modelFix}`;
  }

  async function broadcastReload() {
    return new Promise((resolve) => {
      chrome.tabs.query({ url: '*://claude.ai/*' }, (tabs) => {
        let pending = tabs.length;
        if (!pending) return resolve();
        for (const tab of tabs) {
          chrome.tabs.sendMessage(
            tab.id,
            { source: 'claude-fixer-popup', type: 'reload' },
            () => {
              // ignore lastError — tab may not have content script injected
              void chrome.runtime.lastError;
              if (--pending === 0) resolve();
            }
          );
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
