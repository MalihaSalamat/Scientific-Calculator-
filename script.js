/**
 * SciCalc — Scientific Calculator
 * Developed by Maliha Salamat
 *
 * Architecture:
 *  - Pure Vanilla JS, no frameworks
 *  - Single IIFE module (no global pollution)
 *  - Event delegation on the keypad (one listener, not per-button)
 *  - State: expression string + memory + angle mode
 */

(() => {
  'use strict';

  /* ════════════════════════════════════════════════
     STATE
  ════════════════════════════════════════════════ */
  let expr       = '';      // current expression string
  let memory     = 0;       // stored memory value
  let memActive  = false;   // is memory holding a value?
  let justEvaled = false;   // did we just press = ?
  let angleMode  = 'DEG';   // 'DEG' | 'RAD'

  /* ════════════════════════════════════════════════
     DOM REFERENCES
  ════════════════════════════════════════════════ */
  const exprEl      = document.getElementById('js-expr');
  const resultEl    = document.getElementById('js-result');
  const memFlag     = document.getElementById('js-mem-flag');
  const angleBadge  = document.getElementById('js-angle-badge');
  const toastEl     = document.getElementById('js-toast');
  const modeOptBtns = document.querySelectorAll('.mode-bar__opt');

  /* ════════════════════════════════════════════════
     SAFE EVALUATOR
     Converts display expression → JS → numeric result.
     Returns: string result | 'Error' | null (incomplete)
  ════════════════════════════════════════════════ */
  function safeEval(raw) {
    let e = raw
      .replace(/×/g,  '*')
      .replace(/÷/g,  '/')
      .replace(/−/g,  '-')
      .replace(/\^/g, '**')
      .replace(/²/g,  '**2')
      .replace(/π/g,  String(Math.PI))
      .replace(/(?<!\w)e(?!\w)/g, String(Math.E));

    // Trig substitution — wrap angle conversion for DEG mode
    if (angleMode === 'DEG') {
      ['sin', 'cos', 'tan'].forEach(fn => {
        // Each call opens an extra paren for the degree→radian wrap
        e = e.replace(new RegExp(fn + '\\(', 'g'),
          `Math.${fn}((Math.PI/180)*(`);
      });
    } else {
      ['sin', 'cos', 'tan'].forEach(fn => {
        e = e.replace(new RegExp(fn + '\\(', 'g'), `Math.${fn}(`);
      });
    }

    // Other scientific functions
    e = e.replace(/log\(/g, 'Math.log10(');
    e = e.replace(/ln\(/g,  'Math.log(');
    e = e.replace(/√\(/g,   'Math.sqrt(');

    // Auto-close unbalanced parentheses
    const open  = (e.match(/\(/g) || []).length;
    const close = (e.match(/\)/g) || []).length;
    e += ')'.repeat(Math.max(0, open - close));

    try {
      const value = Function('"use strict"; return (' + e + ')')();
      if (!isFinite(value)) return 'Error';
      // Trim floating-point noise while preserving integers
      return String(parseFloat(value.toPrecision(12)));
    } catch {
      return null; // Syntax error = incomplete expression
    }
  }

  /* ════════════════════════════════════════════════
     RENDER
     Syncs DOM display to current state.
  ════════════════════════════════════════════════ */
  function render() {
    exprEl.textContent = expr;

    if (!expr) {
      resultEl.textContent = '0';
      resultEl.classList.remove('is-error');
      return;
    }

    const result = safeEval(expr);

    // null = expression is incomplete — keep showing last valid result
    if (result === null) return;

    resultEl.classList.toggle('is-error', result === 'Error');
    resultEl.textContent = result;
  }

  /* ════════════════════════════════════════════════
     FLASH ANIMATION
     Triggers the result bounce on = press.
  ════════════════════════════════════════════════ */
  function flashResult() {
    resultEl.classList.remove('is-flashing');
    void resultEl.offsetWidth; // force reflow to restart animation
    resultEl.classList.add('is-flashing');
    resultEl.addEventListener(
      'animationend',
      () => resultEl.classList.remove('is-flashing'),
      { once: true }
    );
  }

  /* ════════════════════════════════════════════════
     TOAST NOTIFICATION
  ════════════════════════════════════════════════ */
  let toastTimer;
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 1800);
  }

  /* ════════════════════════════════════════════════
     MEMORY HELPERS
  ════════════════════════════════════════════════ */
  function setMemActive(active) {
    memActive = active;
    memFlag.classList.toggle('is-active', active);
  }

  /* ════════════════════════════════════════════════
     RIPPLE EFFECT
     Injects a ripple <span> on button click.
  ════════════════════════════════════════════════ */
  function spawnRipple(btn, event) {
    const rect = btn.getBoundingClientRect();
    const x = (event.clientX ?? rect.left + rect.width  / 2) - rect.left;
    const y = (event.clientY ?? rect.top  + rect.height / 2) - rect.top;
    const size = Math.max(rect.width, rect.height);

    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple';
    ripple.style.cssText = `
      width:  ${size}px;
      height: ${size}px;
      left:   ${x - size / 2}px;
      top:    ${y - size / 2}px;
    `;
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  /* ════════════════════════════════════════════════
     SMART PARENTHESIS
     Inserts ( or ) intelligently based on balance.
  ════════════════════════════════════════════════ */
  function smartParen() {
    const openCount  = (expr.match(/\(/g) || []).length;
    const closeCount = (expr.match(/\)/g) || []).length;
    const lastChar   = expr.slice(-1);
    const needsOpen  = openCount === closeCount || lastChar === '(' || expr === '';

    expr += needsOpen ? '(' : ')';
  }

  /* ════════════════════════════════════════════════
     PERCENT
     Converts the last number in the expression to %.
  ════════════════════════════════════════════════ */
  function applyPercent() {
    const match = expr.match(/([\d.]+)$/);
    if (match) {
      expr = expr.slice(0, -match[1].length) + String(parseFloat(match[1]) / 100);
    }
  }

  /* ════════════════════════════════════════════════
     ANGLE MODE SYNC
     Keeps badge + mode-bar toggle in sync.
  ════════════════════════════════════════════════ */
  function syncAngleUI() {
    angleBadge.textContent = angleMode;
    modeOptBtns.forEach(btn => {
      const isActive = btn.dataset.mode === angleMode;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive);
    });
  }

  /* ════════════════════════════════════════════════
     CORE ACTION DISPATCHER
     All button logic lives here.
  ════════════════════════════════════════════════ */
  function dispatch(action) {
    const lastChar = expr.slice(-1);
    const operators = ['+', '−', '×', '÷', '^'];

    // After = press: typing a digit or function starts fresh;
    // typing an operator continues from the result.
    if (justEvaled) {
      const startsNewExpr =
        /^[\d.]$/.test(action) ||
        ['sin','cos','tan','log','ln','sqrt','sq','pow','paren'].includes(action);
      if (startsNewExpr) expr = '';
      justEvaled = false;
    }

    switch (action) {

      /* ── Digits ─────────────────────────── */
      case '0': case '1': case '2': case '3': case '4':
      case '5': case '6': case '7': case '8': case '9':
        expr += action;
        break;

      case '.':
        // Only add decimal if the current number doesn't already have one
        if (!/\d*\.\d*$/.test(expr) && lastChar !== ')') {
          expr += '.';
        }
        break;

      /* ── Arithmetic Operators ───────────── */
      case '+':
      case '−':
      case '×':
      case '÷':
        // Allow leading minus for negative numbers
        if (expr === '' && action === '−') { expr = '−'; break; }
        // Replace last operator if typing a new one
        if (operators.includes(lastChar)) {
          expr = expr.slice(0, -1) + action;
        } else if (expr !== '') {
          expr += action;
        }
        break;

      case 'pow':
        if (expr) expr += '^';
        break;

      /* ── Clear & Backspace ──────────────── */
      case 'clear':
        expr = '';
        resultEl.textContent = '0';
        resultEl.classList.remove('is-error');
        return; // skip render() call below — already handled

      case 'back':
        // If expression ends with a function token like sin( — remove whole token
        expr = expr.replace(/(sin|cos|tan|log|ln|√)\($/, '') || expr.slice(0, -1);
        break;

      /* ── Utility ────────────────────────── */
      case 'paren':
        smartParen();
        break;

      case 'percent':
        applyPercent();
        break;

      case 'negate':
        if (!expr || expr === '0') break;
        expr = expr.startsWith('−') ? expr.slice(1) : '−' + expr;
        break;

      /* ── Scientific Functions ───────────── */
      case 'sin':  expr += 'sin(';  break;
      case 'cos':  expr += 'cos(';  break;
      case 'tan':  expr += 'tan(';  break;
      case 'log':  expr += 'log(';  break;
      case 'ln':   expr += 'ln(';   break;
      case 'sqrt': expr += '√(';    break;
      case 'sq':
        // Append ² to whatever is currently in the expression
        expr += (expr ? '' : '0') + '²';
        break;

      /* ── Equals ─────────────────────────── */
      case '=': {
        if (!expr) break;
        const result = safeEval(expr);
        if (result !== null) {
          // Show what was evaluated in the small expression row
          exprEl.textContent = expr;
          // Set state to result
          expr = result === 'Error' ? '' : result;
          resultEl.textContent = result;
          resultEl.classList.toggle('is-error', result === 'Error');
          flashResult();
          justEvaled = true;
        }
        return; // skip generic render()
      }

      /* ── Memory ─────────────────────────── */
      case 'mc':
        memory = 0;
        setMemActive(false);
        showToast('Memory cleared');
        return;

      case 'mr':
        if (memActive) {
          if (justEvaled) expr = '';
          expr += String(memory);
          justEvaled = false;
          showToast('Recalled: ' + memory);
        } else {
          showToast('Memory is empty');
          return;
        }
        break;

      case 'mplus': {
        const current = parseFloat(safeEval(expr) ?? NaN);
        if (!isNaN(current)) {
          memory += current;
          setMemActive(true);
          showToast('M+ = ' + memory);
        }
        return;
      }

      case 'mminus': {
        const current = parseFloat(safeEval(expr) ?? NaN);
        if (!isNaN(current)) {
          memory -= current;
          setMemActive(true);
          showToast('M− = ' + memory);
        }
        return;
      }
    }

    render();
  }

  /* ════════════════════════════════════════════════
     EVENT DELEGATION — Keypad clicks
     One listener on the parent, not per button.
  ════════════════════════════════════════════════ */
  document.getElementById('js-keypad').addEventListener('click', event => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    spawnRipple(btn, event);
    dispatch(btn.dataset.action);
  });

  /* ════════════════════════════════════════════════
     ANGLE BADGE CLICK (inside display)
  ════════════════════════════════════════════════ */
  angleBadge.addEventListener('click', () => {
    angleMode = angleMode === 'DEG' ? 'RAD' : 'DEG';
    syncAngleUI();
    showToast('Angle mode: ' + angleMode);
    render();
  });

  /* ════════════════════════════════════════════════
     MODE BAR BUTTONS
  ════════════════════════════════════════════════ */
  modeOptBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      angleMode = btn.dataset.mode;
      syncAngleUI();
      render();
    });
  });

  /* ════════════════════════════════════════════════
     KEYBOARD INPUT
  ════════════════════════════════════════════════ */
  const KEY_MAP = {
    '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
    '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
    '.': '.', '+': '+', '-': '−', '*': '×', '/': '÷',
    'Enter': '=', '=': '=',
    'Backspace': 'back',
    'Escape': 'clear',
    '%': 'percent',
    '(': 'paren',
    ')': 'paren',
  };

  document.addEventListener('keydown', event => {
    // Ignore keyboard shortcuts (Ctrl+C, Alt+Tab, etc.)
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const action = KEY_MAP[event.key];
    if (!action) return;

    event.preventDefault();

    // Visual feedback: briefly highlight the matching button
    const matchingBtn = document.querySelector(`[data-action="${action}"]`);
    if (matchingBtn) {
      matchingBtn.style.filter = 'brightness(1.6)';
      setTimeout(() => (matchingBtn.style.filter = ''), 130);
      spawnRipple(matchingBtn, {});
    }

    dispatch(action);
  });

  /* ════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════ */
  render();

})();
