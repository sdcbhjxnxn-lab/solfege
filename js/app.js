/* =============================================================================
 * app.js  —  应用入口：路由、导航、主题、练耳视图
 * ========================================================================== */
(function (global) {
  'use strict';
  var WB = (global.WB = global.WB || {});
  var U = WB.UI;
  var S = WB.Store;
  var A = WB.Audio;
  var I = WB.Icons;

  var NAV = [
    { id: 'home', name: '\u9996\u9875', icon: 'home' },
    { id: 'ear', name: '\u7ec3\u8033', icon: 'notes' },
    { id: 'sight', name: '\u89c6\u5531', icon: 'mic' },
    { id: 'ref', name: '\u4e50\u7406', icon: 'book' },
    { id: 'stats', name: '\u7edf\u8ba1', icon: 'chart' },
    { id: 'settings', name: '\u8bbe\u7f6e', icon: 'gear' }
  ];

  var dom = {};
  var current = { view: null, handle: null };

  /* ------------------------------ 路由 ---------------------------------- */
  function serialize(view, params) {
    params = params || {};
    var parts = [view];
    if (params.type) parts.push(params.type);
    if (params.tab) parts.push(params.tab);
    return '#' + parts.join('/');
  }
  function parseHash() {
    var h = (global.location.hash || '').replace(/^#/, '');
    var parts = h.split('/').filter(Boolean);
    var view = parts[0] || 'home';
    if (!NAV.some(function (n) { return n.id === view; })) view = 'home';
    return { view: view, type: parts[1], tab: parts[2] };
  }
  function navigate(view, params) {
    var target = serialize(view, params);
    if (global.location.hash === target) { mountFromHash(); return; }
    global.location.hash = target;
  }

  /* ------------------------------ 视图挂载 ------------------------------ */
  function mountFromHash() {
    var r = parseHash();
    mountView(r.view, { type: r.type, tab: r.tab });
  }
  function mountView(view, params) {
    if (current.handle && current.handle.destroy) { try { current.handle.destroy(); } catch (e) { } }
    A.stopAll();
    U.unbindKeys();
    current = { view: view, handle: null };

    U.qsa('.nav-item', dom.nav).forEach(function (b) {
      b.classList.toggle('active', b.dataset.view === view);
    });

    var host = dom.view;
    host.innerHTML = '';
    host.className = 'view view-' + view;
    global.scrollTo(0, 0);
    try {
      // 兼容两种 hash 形式：#ref/cof 与 #stats/wrong（单段参数即标签页）
      var seg = params.tab || params.type;
      if (view === 'home') current.handle = WB.Home.mount(host, params);
      else if (view === 'ear') current.handle = mountEar(host, params);
      else if (view === 'sight') current.handle = WB.Sight.mount(host, params);
      else if (view === 'ref') current.handle = WB.Ref.mount(host, { tab: seg });
      else if (view === 'stats') current.handle = WB.StatsPage.mount(host, { tab: seg });
      else if (view === 'settings') current.handle = WB.SettingsPage.mount(host, params);
    } catch (err) {
      host.innerHTML = '<div class="panel"><div class="panel-title">\u9875\u9762\u52a0\u8f7d\u51fa\u9519</div><pre class="err">' +
        String(err && err.stack || err) + '</pre></div>';
    }
  }

  /* ------------------------------ 练耳视图 ------------------------------ */
  function mountEar(container, params) {
    params = params || {};
    if (!params.type) {
      var st = S.getStats();
      var root = U.el('div', { class: 'page page-ear' });
      root.appendChild(U.el('div', { class: 'page-head' }, [
        U.el('div', { class: 'page-head-left' }, [
          U.el('div', { class: 'page-head-icon', html: I.svg('notes', 22) }),
          U.el('div', {}, [
            U.el('h2', { class: 'page-title', text: '\u542c\u8fa8\u8bad\u7ec3' }),
            U.el('p', { class: 'page-sub', text: '\u9009\u62e9\u9898\u578b\u5f00\u59cb\u7ec3\u4e60\uff1b\u6bcf\u4e2a\u9898\u578b\u5747\u652f\u6301\u521d\u7ea7 / \u4e2d\u7ea7 / \u9ad8\u7ea7\u4e09\u6863\u96be\u5ea6\u4e0e\u7ec3\u4e60 / \u6d4b\u9a8c\u4e24\u79cd\u6a21\u5f0f\u3002' })
          ])
        ]),
        U.el('button', {
          class: 'btn btn-ghost', type: 'button',
          on: { click: function () { WB.Home.showHelp(); } }
        }, '\u4f7f\u7528\u8bf4\u660e')
      ]));
      var grid = U.el('div', { class: 'mode-grid' }, WB.Trainers.META.map(function (m) {
        var t = st.byType[m.id] || { attempts: 0, correct: 0 };
        return U.el('button', {
          class: 'mode-card', type: 'button',
          on: { click: function () { navigate('ear', { type: m.id }); } }
        }, [
          U.el('div', { class: 'mode-card-head' }, [
            U.el('span', { class: 'mode-card-icon', html: I.svg(m.icon, 20) }),
            U.el('span', { class: 'mode-card-name', text: m.name })
          ]),
          U.el('p', { class: 'mode-card-desc', text: m.full || m.brief }),
          U.el('div', { class: 'mode-card-foot' }, [
            U.el('span', { class: 'chip', text: t.attempts ? '\u7b54\u9898 ' + t.attempts : '\u672a\u7ec3\u4e60' }),
            t.attempts ? U.el('span', { class: 'chip chip-acc', text: '\u6b63\u786e\u7387 ' + U.pct(t.correct, t.attempts) + '%' }) : null
          ])
        ]);
      }));
      root.appendChild(grid);
      container.appendChild(root);
      return { destroy: function () { } };
    }

    var root2 = U.el('div', { class: 'page page-ear-single' });
    var backWrap = U.el('div', { class: 'crumb' }, [
      U.el('button', {
        class: 'crumb-btn', type: 'button',
        on: { click: function () { navigate('ear'); } }
      }, [U.el('span', { class: 'crumb-arrow', text: '\u2190' }), U.el('span', { text: '\u9898\u578b\u5217\u8868' })]),
      U.el('span', { class: 'crumb-sep', text: '/' }),
      U.el('span', { class: 'crumb-cur', text: (WB.Trainers.META_BY_ID[params.type] || {}).name || '' })
    ]);
    root2.appendChild(backWrap);
    var engineHost = U.el('div', { class: 'engine-host' });
    root2.appendChild(engineHost);
    container.appendChild(root2);
    var engine = WB.Trainers.Engine(engineHost, params.type, {
      level: S.getSettings().level,
      onExit: function () { navigate('ear'); }
    });
    return { destroy: function () { engine.destroy(); } };
  }

  /* ------------------------------ 主题 ---------------------------------- */
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
    if (dom.themeBtn) {
      dom.themeBtn.innerHTML = I.svg(theme === 'light' ? 'target' : 'spark', 18);
      dom.themeBtn.title = theme === 'light' ? '\u5207\u6362\u5230\u6df1\u8272\u4e3b\u9898' : '\u5207\u6362\u5230\u6d45\u8272\u4e3b\u9898';
    }
  }
  function refreshSettings() {
    var s = S.getSettings();
    A.setVolume(s.volume);
    A.setInstrument(s.instrument);
    A.setA4(s.a4);
    setTheme(s.theme);
  }
  function toggleTheme() {
    var s = S.getSettings();
    var nv = s.theme === 'light' ? 'dark' : 'light';
    S.saveSettings({ theme: nv });
    setTheme(nv);
    // 谱面按新主题色重绘
    if (current.view) mountView(current.view, parseHash());
  }

  /* ------------------------------ 初始化 -------------------------------- */
  function init() {
    dom.nav = document.getElementById('nav');
    dom.view = document.getElementById('view');
    dom.themeBtn = document.getElementById('theme-btn');
    var mark = document.getElementById('brand-mark');
    if (mark) mark.innerHTML = I.svg('notes', 20);

    dom.nav.innerHTML = '';
    NAV.forEach(function (n) {
      dom.nav.appendChild(U.el('button', {
        class: 'nav-item', type: 'button', dataset: { view: n.id },
        on: { click: function () { navigate(n.id); } }
      }, [
        U.el('span', { class: 'nav-icon', html: I.svg(n.icon, 18) }),
        U.el('span', { class: 'nav-label', text: n.name })
      ]));
    });

    if (dom.themeBtn) dom.themeBtn.addEventListener('click', toggleTheme);

    refreshSettings();

    // 首次交互解锁音频
    var unlockOnce = function () {
      A.unlock();
      document.removeEventListener('pointerdown', unlockOnce);
      document.removeEventListener('keydown', unlockOnce);
    };
    document.addEventListener('pointerdown', unlockOnce);
    document.addEventListener('keydown', unlockOnce);

    // Esc 关闭弹窗
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') U.closeTopModal();
    });

    global.addEventListener('hashchange', mountFromHash);
    if (!global.location.hash) global.location.hash = '#home';
    mountFromHash();

    if (!S.usable) {
      U.toast('\u6d4f\u89c8\u5668\u7981\u7528\u4e86\u672c\u5730\u5b58\u50a8\uff0c\u7ec3\u4e60\u8bb0\u5f55\u65e0\u6cd5\u4fdd\u5b58', 'warn', 4200);
    }
    if (!WB.Notation.available()) {
      U.toast('\u4e94\u7ebf\u8c31\u6e32\u67d3\u5e93\u672a\u52a0\u8f7d\uff0c\u8bf7\u786e\u8ba4 vendor/vexflow.js \u5b58\u5728', 'bad', 5000);
    }
  }

  WB.App = {
    init: init,
    navigate: navigate,
    setTheme: setTheme,
    toggleTheme: toggleTheme,
    refreshSettings: refreshSettings,
    reload: function () { mountView(current.view || 'home', parseHash()); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else init();
})(typeof window !== 'undefined' ? window : globalThis);
