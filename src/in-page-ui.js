// Injects a minimal thinking-effort selector into claude.ai's UI.
// Uses claude.ai's Tailwind classes for native look. Menu is portaled
// to document.body with fixed positioning to avoid overflow clipping.

(function () {
  const TAG = '[Claude Fixer/ui]';
  const Storage = window.ClaudeFixerStorage;
  const BTN_ID = 'claude-fixer-effort-btn';
  const MENU_ID = 'claude-fixer-effort-menu';

  const LEVELS = [
    { value: 'default', label: 'Default' },
    { value: 'low',     label: 'Low' },
    { value: 'medium',  label: 'Medium' },
    { value: 'high',    label: 'High' },
    { value: 'max',     label: 'Max' },
    { value: 'ultra',   label: 'Ultra' }
  ];

  let currentLevel = 'default';
  let observer = null;
  let injecting = false;

  function getModelSelector() {
    return document.querySelector('[data-testid="model-selector-dropdown"]');
  }

  function removeMenu() {
    const m = document.getElementById(MENU_ID);
    if (m) m.remove();
  }

  function showMenu() {
    removeMenu();
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;

    const rect = btn.getBoundingClientRect();

    const menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.setAttribute('role', 'menu');
    menu.className = [
      'rounded-xl border-0.5 border-border-200 p-1.5',
      'min-w-[120px] bg-bg-000 backdrop-blur-xl shadow-lg'
    ].join(' ');
    Object.assign(menu.style, {
      position: 'fixed',
      zIndex: '99999',
      left: rect.left + 'px',
      bottom: (window.innerHeight - rect.top + 6) + 'px'
    });

    for (const level of LEVELS) {
      const item = document.createElement('button');
      item.type = 'button';
      item.setAttribute('role', 'menuitem');
      item.dataset.value = level.value;
      item.className = [
        'font-base min-h-8 w-full px-2 py-1.5 rounded-lg',
        'cursor-pointer text-left text-sm',
        'hover:bg-bg-200 transition duration-75',
        'border-0 bg-transparent'
      ].join(' ');
      if (level.value === currentLevel) {
        item.classList.add('bg-bg-200');
        item.style.fontWeight = '600';
      }
      item.textContent = level.label;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        selectLevel(level.value);
        removeMenu();
      });
      menu.appendChild(item);
    }

    document.body.appendChild(menu);
  }

  function updateBtn() {
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    const label = btn.querySelector('.cf-label');
    if (!label) return;
    if (currentLevel === 'default') {
      label.textContent = 'Effort';
    } else {
      const level = LEVELS.find(l => l.value === currentLevel);
      label.textContent = level ? level.label : currentLevel;
    }
  }

  async function selectLevel(value) {
    currentLevel = value;
    await Storage.setSettings({ thinkingEffort: value });
    updateBtn();
    console.log(TAG, 'thinking effort ->', value);
  }

  function createBtn() {
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.title = 'Thinking effort (Claude Fixer)';
    btn.className = [
      'inline-flex items-center gap-1 h-8 px-2 rounded-lg',
      'font-base text-xs cursor-pointer select-none',
      'text-text-500 hover:text-text-200 hover:bg-bg-300',
      'transition duration-150 border-0 bg-transparent'
    ].join(' ');

    const label = document.createElement('span');
    label.className = 'cf-label';
    label.textContent = 'Effort';

    const chevron = document.createElement('span');
    chevron.textContent = '\u25BE';
    chevron.className = 'text-text-500';

    btn.appendChild(label);
    btn.appendChild(chevron);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const existing = document.getElementById(MENU_ID);
      if (existing) {
        removeMenu();
      } else {
        showMenu();
      }
    });

    return btn;
  }

  function tryInject() {
    if (injecting) return;
    if (document.getElementById(BTN_ID)) return;

    const modelSelector = getModelSelector();
    if (!modelSelector) return;
    const parent = modelSelector.parentElement;
    if (!parent) return;

    injecting = true;
    try {
      const btn = createBtn();
      if (modelSelector.nextSibling) {
        parent.insertBefore(btn, modelSelector.nextSibling);
      } else {
        parent.appendChild(btn);
      }
      updateBtn();
      console.log(TAG, 'effort button injected');
    } finally {
      setTimeout(() => { injecting = false; }, 200);
    }
  }

  // Close menu on any click outside
  document.addEventListener('click', (e) => {
    const menu = document.getElementById(MENU_ID);
    if (!menu) return;
    const btn = document.getElementById(BTN_ID);
    if (btn && btn.contains(e.target)) return;
    if (menu.contains(e.target)) return;
    removeMenu();
  });

  function start() {
    Storage.getSettings().then((s) => {
      currentLevel = s.thinkingEffort || 'default';
      tryInject();

      observer = new MutationObserver(() => {
        if (!injecting && !document.getElementById(BTN_ID)) {
          tryInject();
        }
      });
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.thinkingEffort) {
        currentLevel = changes.thinkingEffort.newValue || 'default';
        updateBtn();
      }
    });
  }

  function stop() {
    if (observer) { observer.disconnect(); observer = null; }
    const btn = document.getElementById(BTN_ID);
    if (btn) btn.remove();
    removeMenu();
  }

  window.ClaudeFixerInPageUI = { start, stop };
})();
