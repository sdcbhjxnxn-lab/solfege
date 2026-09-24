/* =============================================================================
 * ui.js  —  通用 DOM / UI 工具
 * 元素构造、提示条、对话框、随机工具、键盘绑定、彩带特效、迷你图表
 * ========================================================================== */
(function (global) {
  'use strict';
  var WB = (global.WB = global.WB || {});

  /* ---------------------------- DOM 构造 -------------------------------- */
  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class' || k === 'className') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
        else if (k === 'on' && typeof v === 'object') {
          Object.keys(v).forEach(function (ev) { node.addEventListener(ev, v[ev]); });
        } else if (k.indexOf('on') === 0 && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else node.setAttribute(k, v);
      });
    }
    appendChildren(node, children);
    return node;
  }
  function appendChildren(node, children) {
    if (children === null || children === undefined) return;
    if (Array.isArray(children)) { children.forEach(function (c) { appendChildren(node, c); }); return; }
    if (children instanceof global.Node) { node.appendChild(children); return; }
    node.appendChild(document.createTextNode(String(children)));
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function mount(container) { clear(container); return container; }

  /* ------------------------------ 随机 ---------------------------------- */
  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  // 从 arr 中随机取 n 个不重复项
  function sample(arr, n) { return shuffle(arr).slice(0, Math.min(n, arr.length)); }
  function pct(a, b) { return b > 0 ? Math.round((a / b) * 100) : 0; }
  function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }

  /* ------------------------------ 提示条 -------------------------------- */
  var toastHost = null;
  function ensureToastHost() {
    if (!toastHost) {
      toastHost = el('div', { class: 'toast-host' });
      document.body.appendChild(toastHost);
    }
    return toastHost;
  }
  function toast(msg, type, ms) {
    var host = ensureToastHost();
    var node = el('div', { class: 'toast toast-' + (type || 'info') }, msg);
    host.appendChild(node);
    setTimeout(function () { node.classList.add('toast-out'); }, (ms || 2200) - 180);
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, ms || 2200);
    return node;
  }

  /* ------------------------------ 对话框 -------------------------------- */
  var openModals = [];
  function modal(opts) {
    opts = opts || {};
    var overlay = el('div', { class: 'modal-overlay' });
    var actions = (opts.actions || []).map(function (a) {
      return el('button', {
        class: 'btn ' + (a.class || 'btn-ghost'),
        type: 'button',
        on: {
          click: function () {
            if (a.onClick) { if (a.onClick() === false) return; }
            if (a.keepOpen !== true) close();
          }
        }
      }, a.label);
    });
    var box = el('div', { class: 'modal-box', style: { maxWidth: (opts.width || 560) + 'px' } }, [
      el('div', { class: 'modal-head' }, [
        el('h3', { class: 'modal-title', text: opts.title || '' }),
        el('button', { class: 'modal-x', type: 'button', 'aria-label': '关闭', on: { click: function () { close(); } } }, '\u00d7')
      ]),
      el('div', { class: 'modal-body' }, opts.body),
      actions.length ? el('div', { class: 'modal-foot' }, actions) : null
    ]);
    overlay.appendChild(box);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    openModals.push(close);
    function close() {
      var i = openModals.indexOf(close);
      if (i >= 0) openModals.splice(i, 1);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (opts.onClose) opts.onClose();
    }
    return { close: close, box: box };
  }

  function confirmDialog(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      modal({
        title: opts.title || '请确认',
        body: el('div', { class: 'modal-text' }, opts.message || ''),
        actions: [
          { label: opts.cancelText || '取消', class: 'btn-ghost', onClick: function () { resolve(false); } },
          { label: opts.okText || '确定', class: opts.danger ? 'btn-danger' : 'btn-primary', onClick: function () { resolve(true); } }
        ],
        onClose: function () { resolve(false); }
      });
    });
  }

  /* --------------------------- 键盘快捷键管理 ---------------------------- */
  var keyBindings = [];
  function bindKeys(bindings) {
    unbindKeys();
    keyBindings = (bindings || []).filter(Boolean);
    if (!keyBindings.length) return;
    document.addEventListener('keydown', onKeyDown);
  }
  function unbindKeys() {
    if (keyBindings.length) document.removeEventListener('keydown', onKeyDown);
    keyBindings = [];
  }
  function onKeyDown(e) {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    for (var i = 0; i < keyBindings.length; i++) {
      var b = keyBindings[i];
      var key = b.key;
      var match = false;
      if (Array.isArray(key)) match = key.indexOf(e.key) >= 0;
      else if (key === e.key) match = true;
      if (!match) continue;
      if (b.ctrl && !(e.ctrlKey || e.metaKey)) continue;
      if (b.prevent !== false) e.preventDefault();
      b.handler(e);
      return;
    }
  }
  function closeTopModal() {
    if (openModals.length) { openModals[openModals.length - 1](); return true; }
    return false;
  }

  /* ---------------------------- 彩带特效 -------------------------------- */
  function confetti(count) {
    try {
      var canvas = el('canvas', { class: 'confetti-canvas' });
      canvas.width = global.innerWidth; canvas.height = global.innerHeight;
      document.body.appendChild(canvas);
      var ctx = canvas.getContext('2d');
      var colors = ['#6366f1', '#22d3ee', '#34d399', '#fbbf24', '#f472b6'];
      var parts = [];
      var n = count || 90;
      for (var i = 0; i < n; i++) {
        parts.push({
          x: canvas.width / 2 + (Math.random() - 0.5) * 260,
          y: canvas.height * 0.34 + (Math.random() - 0.5) * 80,
          vx: (Math.random() - 0.5) * 9,
          vy: -Math.random() * 11 - 3,
          w: 4 + Math.random() * 6,
          h: 6 + Math.random() * 8,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          color: colors[i % colors.length],
          life: 70 + Math.random() * 40
        });
      }
      var frames = 0;
      function tick() {
        frames++;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        var alive = 0;
        parts.forEach(function (p) {
          if (p.life <= 0) return;
          alive++;
          p.vy += 0.34; p.x += p.vx; p.y += p.vy; p.vx *= 0.995; p.rot += p.vr; p.life--;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 45));
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        });
        if (alive > 0 && frames < 220) requestAnimationFrame(tick);
        else if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
      tick();
    } catch (e) { /* noop */ }
  }

  /* ---------------------------- 迷你折线图 ------------------------------ */
  function sparkline(canvas, values, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var dpr = global.devicePixelRatio || 1;
    var w = canvas.clientWidth || opts.width || 240;
    var h = canvas.clientHeight || opts.height || 60;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!values || values.length === 0) return;
    var max = opts.max !== undefined ? opts.max : Math.max.apply(null, values);
    var min = opts.min !== undefined ? opts.min : Math.min.apply(null, values);
    if (max === min) { max = min + 1; }
    var pa = 6;
    var c = opts.color || '#6366f1';
    ctx.strokeStyle = 'rgba(127,127,127,0.18)';
    ctx.lineWidth = 1;
    for (var g = 0; g <= 2; g++) {
      var y = pa + ((h - pa * 2) * g) / 2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.beginPath();
    values.forEach(function (v, i) {
      var x = values.length === 1 ? w / 2 : (w * i) / (values.length - 1);
      var y = h - pa - ((v - min) / (max - min)) * (h - pa * 2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.globalAlpha = 0.12; ctx.fillStyle = c; ctx.fill(); ctx.globalAlpha = 1;
    values.forEach(function (v, i) {
      var x = values.length === 1 ? w / 2 : (w * i) / (values.length - 1);
      var y = h - pa - ((v - min) / (max - min)) * (h - pa * 2);
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
    });
  }

  /* ------------------------- 圆环进度（百分比） -------------------------- */
  function donut(canvas, value, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var dpr = global.devicePixelRatio || 1;
    var size = opts.size || 84;
    canvas.width = size * dpr; canvas.height = size * dpr;
    canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    var lw = opts.lineWidth || 8;
    var r = size / 2 - lw / 2 - 1;
    var cx = size / 2, cy = size / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = opts.track || 'rgba(127,127,127,0.16)';
    ctx.lineWidth = lw; ctx.stroke();
    var v = Math.max(0, Math.min(100, value));
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (v / 100) * Math.PI * 2);
    ctx.strokeStyle = opts.color || '#6366f1';
    ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
  }

  WB.UI = {
    el: el,
    clear: clear,
    qs: qs,
    qsa: qsa,
    mount: mount,
    randInt: randInt,
    pick: pick,
    shuffle: shuffle,
    sample: sample,
    pct: pct,
    uniq: uniq,
    toast: toast,
    modal: modal,
    confirm: confirmDialog,
    bindKeys: bindKeys,
    unbindKeys: unbindKeys,
    closeTopModal: closeTopModal,
    confetti: confetti,
    sparkline: sparkline,
    donut: donut
  };
})(typeof window !== 'undefined' ? window : globalThis);
