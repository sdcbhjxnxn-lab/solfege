/* =============================================================================
 * sight.js  —  视唱模块
 * 1) 谱例视唱：生成调内旋律 → 五线谱显示 → 参考播放 / 节拍器 / 逐音模唱音准检测
 * 2) 音准仪：实时音高显示
 * 3) 节奏模仿：击拍节奏，按时间偏差评分
 * ========================================================================== */
(function (global) {
  'use strict';
  var WB = (global.WB = global.WB || {});
  var T = WB.Theory;
  var A = WB.Audio;
  var N = WB.Notation;
  var U = WB.UI;
  var I = WB.Icons;
  var P = WB.Pitch;
  var S = WB.Store;

  var SHARP = '\u266f';
  var MIC_TOLERANCE = 50;   // 音分容差
  var HOLD_MS = 320;        // 需保持时长

  // 2/4 拍节奏型
  var RHY_24 = {
    easy: [[1, 1], [2]],
    medium: [[0.5, 0.5, 1], [1, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
    hard: [[0.25, 0.25, 0.5, 1], [1, 0.5, 0.25, 0.25], [1, 0.25, 0.25, 0.5], [0.5, 1, 0.5], [0.25, 0.25, 0.25, 0.25, 1]]
  };

  function isRest(p) { return typeof p === 'object' && p !== null && p.r !== undefined; }
  // 视唱旋律不使用休止符，但**不能把休止符直接过滤掉**——那会缩短小节总时值
  // （如 4/4 的 [{r:1},1,1,1] 过滤后只剩 3 拍），导致小节线位置与拍号不符、节拍器与谱面对不齐。
  // 正确做法：把休止符按自身时值替换为等值音符，保持小节总时值不变。
  function rhythmChoices(timeSig, level) {
    var list = timeSig === '2/4' ? RHY_24[level]
      : (timeSig === '3/4' ? T.RHYTHM_PATTERNS_34[level] : T.RHYTHM_PATTERNS[level]);
    return list.map(function (p) {
      return p.map(function (x) { return isRest(x) ? x.r : x; });
    });
  }
  function noteName(midi) { return T.SHARP_NAMES[T.pcOf(midi)].replace('#', SHARP) + T.octaveOf(midi); }

  /* --------------------------- 旋律生成 --------------------------------- */
  function degreeToMidi(key, d) {
    var base = 60 + key.tonicPc;
    var oct = Math.floor(d / 7);
    return base + oct * 12 + key.intervals[T.mod(d, 7)];
  }
  function genDegrees(count, level, key) {
    var maxStep = level === 'easy' ? 1 : (level === 'medium' ? 2 : 3);
    var degs = [U.pick([0, 2, 4])];
    while (degs.length < count) {
      var last = degs[degs.length - 1];
      var step = U.randInt(1, maxStep) * (Math.random() < 0.5 ? -1 : 1);
      var nd = last + step;
      if (nd < -2) nd = last + Math.abs(step);
      if (nd > 8) nd = last - Math.abs(step);
      degs.push(nd);
    }
    degs[degs.length - 1] = Math.random() < 0.5 ? 0 : 7;
    var midis = degs.map(function (d) { return degreeToMidi(key, d); });
    // 约束音域到谱表可读范围
    while (Math.min.apply(null, midis) < 55) { midis = midis.map(function (m) { return m + 12; }); }
    while (Math.max.apply(null, midis) > 79) { midis = midis.map(function (m) { return m - 12; }); }
    return midis;
  }
  function genMelody(cfg) {
    var key = T.buildKey(cfg.keyName);
    var beatsPerBar = parseInt(cfg.timeSig.split('/')[0], 10);
    var choices = rhythmChoices(cfg.timeSig, cfg.level);
    var bars = [];
    var events = [];
    for (var b = 0; b < cfg.bars; b++) {
      var rhy = U.pick(choices);
      // 兜底校验：每小节总时值必须等于拍号的每小节拍数，否则退回等时值基本型
      if (T.patternTotal(rhy) !== beatsPerBar) {
        rhy = beatsPerBar === 4 ? [1, 1, 1, 1] : (beatsPerBar === 3 ? [1, 1, 1] : [1, 1]);
      }
      var bar = [];
      rhy.forEach(function (beats) {
        bar.push({ beats: beats });
      });
      bars.push(bar);
    }
    var flat = [];
    bars.forEach(function (bar) { bar.forEach(function (n) { flat.push(n); }); });
    var midis = genDegrees(flat.length, cfg.level, key);
    flat.forEach(function (n, i) { n.midi = midis[i]; n.spell = T.spellMidi(midis[i], key); });
    // 时间轴
    var t = 0;
    flat.forEach(function (n) { n.at = t; t += n.beats; });
    return {
      key: key, timeSig: cfg.timeSig, bars: bars, flat: flat,
      totalBeats: t, bpm: cfg.bpm || 80
    };
  }

  /* --------------------------- 播放工具 --------------------------------- */
  function playMelody(mel, opts) {
    opts = opts || {};
    var spb = 60 / mel.bpm;
    var ev = [];
    mel.flat.forEach(function (n) {
      ev.push({ midis: [n.midi], at: n.at * spb, dur: Math.max(0.22, n.beats * spb * 0.92) });
    });
    A.playSequence(ev);
    return mel.totalBeats * spb;
  }
  function playReference(mel, kind) {
    A.stopAll();
    var key = mel.key;
    var base = 60 + key.tonicPc;
    if (kind === 'scale') {
      var up = key.intervals.map(function (iv) { return base + iv; });
      var notes = up.concat([base + 12]).concat(up.slice(0, -1).reverse().map(function (x) { return x; }));
      A.playNoteList(notes, { noteDur: 0.34, gap: 0.03 });
      return notes.length * 0.37;
    }
    if (kind === 'triad') {
      var third = key.mode === 'minor' ? key.intervals[2] : key.intervals[2];
      A.playChord([base, base + third, base + key.intervals[4]], { dur: 1.2 });
      return 1.2;
    }
    if (kind === 'tonic') {
      A.playNote(base, { dur: 1.0 });
      return 1.0;
    }
    return 0;
  }

  /* =========================================================================
   *                                视图挂载
   * ====================================================================== */
  function mount(container, opts) {
    opts = opts || {};
    var state = {
      view: opts.view || 'score',
      mel: null,
      tuner: null,
      tapTuner: null,
      engine: null,
      micOn: false,
      settings: S.getSettings()
    };
    var dom = {};
    container.innerHTML = '';
    var root = U.el('div', { class: 'page page-sight' });
    container.appendChild(root);

    /* ------------------------------ 头部 -------------------------------- */
    var tabs = [
      { id: 'score', name: '\u8c31\u4f8b\u89c6\u5531', icon: 'notes' },
      { id: 'tuner', name: '\u97f3\u51c6\u4eea', icon: 'target' },
      { id: 'rhythm', name: '\u8282\u594f\u6a21\u4eff', icon: 'rhythm' }
    ];
    dom.tabBar = U.el('div', { class: 'seg-tabs' }, tabs.map(function (t) {
      return U.el('button', {
        class: 'seg-tab' + (t.id === state.view ? ' active' : ''), type: 'button', dataset: { view: t.id },
        on: {
          click: function () {
            if (state.view === t.id) return;
            cleanup();
            state.view = t.id;
            U.qsa('.seg-tab', dom.tabBar).forEach(function (b) { b.classList.toggle('active', b.dataset.view === t.id); });
            renderView();
          }
        }
      }, [U.el('span', { class: 'seg-icon', html: I.svg(t.icon, 16) }), U.el('span', { text: t.name })]);
    }));
    dom.head = U.el('div', { class: 'page-head' }, [
      U.el('div', { class: 'page-head-left' }, [
        U.el('div', { class: 'page-head-icon', html: I.svg('mic', 22) }),
        U.el('div', {}, [
          U.el('h2', { class: 'page-title', text: '\u89c6\u5531\u8bad\u7ec3' }),
          U.el('p', { class: 'page-sub', text: '\u8c31\u4f8b\u89c6\u5531\u3001\u97f3\u51c6\u68c0\u6d4b\u4e0e\u8282\u594f\u6a21\u4eff\uff08\u9700\u5141\u8bb8\u9ea5\u514b\u98ce\u6743\u9650\uff09' })
        ])
      ]),
      dom.tabBar
    ]);
    root.appendChild(dom.head);
    dom.body = U.el('div', { class: 'page-body' });
    root.appendChild(dom.body);

    function cleanup() {
      A.stopAll();
      if (state.tuner) { state.tuner.stop(); state.tuner = null; }
      if (state.tapTuner) { state.tapTuner.stop(); state.tapTuner = null; }
      U.unbindKeys();
      state.micOn = false;
      if (dom.micStatus) dom.micStatus.textContent = '';
    }

    function renderView() {
      if (dom._sub && dom._sub.destroy) { try { dom._sub.destroy(); } catch (e) { /* noop */ } dom._sub = null; }
      dom.body.innerHTML = '';
      if (state.view === 'score') dom._sub = renderScore();
      else if (state.view === 'tuner') dom._sub = renderTuner();
      else dom._sub = renderRhythmTap();
    }

    /* --------------------------- 麦克风不可用提示 ------------------------ */
    function micUnavailable(node, code) {
      var msg = code === 'DENIED' ? '\u9ea5\u514b\u98ce\u6743\u9650\u88ab\u62d2\u7edd\u3002\u8bf7\u5728\u6d4f\u89c8\u5668\u5730\u5740\u680f\u4fa7\u7684\u6743\u9650\u8bbe\u7f6e\u4e2d\u5141\u8bb8\u9ea5\u514b\u98ce\u540e\u91cd\u8bd5\u3002'
        : code === 'NO_DEVICE' ? '\u672a\u68c0\u6d4b\u5230\u53ef\u7528\u7684\u9ea5\u514b\u98ce\u8bbe\u5907\u3002'
          : '\u5f53\u524d\u6d4f\u89c8\u5668\u73af\u5883\u4e0d\u652f\u6301\u9ea5\u514b\u98ce\u91c7\u96c6\u3002\u8bf7\u4f7f\u7528 http://localhost \u65b9\u5f0f\u6253\u5f00\u672c\u9875\uff08file:// \u4e0b\u6d4f\u89c8\u5668\u4f1a\u7981\u7528\u9ea5\u514b\u98ce\uff09\u3002';
      if (!node) return;
      U.clear(node);
      node.appendChild(U.el('div', { class: 'notice notice-warn' }, [
        U.el('span', { class: 'notice-icon', html: I.svg('info', 16) }),
        U.el('span', { text: msg })
      ]));
    }

    /* ============================ 1. 谱例视唱 ============================ */
    function renderScore() {
      var cfg = {
        keyName: U.pick(['C', 'G', 'F', 'D', 'Bb']),
        timeSig: U.pick(['2/4', '3/4', '4/4']),
        bars: U.randInt(2, 4),
        level: state.settings.level || 'easy',
        bpm: 80
      };
      function regenerate() {
        state.mel = genMelody(cfg);
        drawScore();
      }

      dom.scoreCtrl = U.el('div', { class: 'panel panel-ctrl' });
      dom.scoreStaff = U.el('div', { class: 'panel staff-panel' });
      dom.scoreInfo = U.el('div', { class: 'panel' });
      dom.scoreMic = U.el('div', { class: 'panel' });

      dom.body.appendChild(U.el('div', { class: 'sight-grid' }, [
        dom.scoreStaff, U.el('div', { class: 'sight-side' }, [dom.scoreInfo, dom.scoreMic])
      ]));
      dom.body.appendChild(dom.scoreCtrl);

      function drawScore() {
        var mel = state.mel;
        var barNotes = mel.bars.map(function (bar) {
          return bar.map(function (n) { return { midi: n.midi, beats: n.beats, spell: n.spell, key: mel.key }; });
        });
        N.renderSystem(dom.scoreStaff, {
          clef: 'treble', keySig: mel.key.vexKeySig, timeSig: mel.timeSig, key: mel.key,
          bars: barNotes, width: Math.max(420, dom.scoreStaff.clientWidth || 0)
        });
      }

      /* ---- 节拍器：循环运行，可「开始 / 暂停」，实时跟随速度与拍号 ----
         旧实现是一次性把整首的点击音排完（无状态、无法停止、也不随速度变化），
         这里改为带状态的循环调度：用 350ms 预排窗口 + setInterval 补排，
         既抗定时器抖动，又保证「停止」时最多只多响一拍。 */
      var metro = { on: false, timer: null, next: 0, beat: 0, btn: null, dots: null };

      function metroSpb() { return 60 / (cfg.bpm || 80); }
      function metroPer() { return parseInt(String(cfg.timeSig).split('/')[0], 10) || 4; }

      function metroPump() {
        if (!metro.on) return;
        var spb = metroSpb(), per = metroPer();
        var horizon = A.currentTime() + 0.35;
        while (metro.next < horizon) {
          A.playClick(metro.next, metro.beat % per === 0);
          (function (beat, at) {
            setTimeout(function () { if (metro.on) paintBeat(beat); }, Math.max(0, (at - A.currentTime()) * 1000));
          })(metro.beat, metro.next);
          metro.next += spb;
          metro.beat += 1;
        }
      }
      function paintBeat(beat) {
        if (!metro.dots) return;
        var cur = beat % metroPer();
        for (var i = 0; i < metro.dots.children.length; i++) {
          metro.dots.children[i].className = 'beat-dot' + (i === 0 ? ' accent' : '') + (i === cur ? ' on' : '');
        }
      }
      function clearBeat() {
        if (!metro.dots) return;
        for (var i = 0; i < metro.dots.children.length; i++) {
          metro.dots.children[i].className = 'beat-dot' + (i === 0 ? ' accent' : '');
        }
      }
      function buildBeatDots() {
        if (!metro.dots) return;
        U.clear(metro.dots);
        for (var i = 0; i < metroPer(); i++) {
          metro.dots.appendChild(U.el('i', { class: 'beat-dot' + (i === 0 ? ' accent' : '') }));
        }
      }
      function syncMetroBtn() {
        if (!metro.btn) return;
        metro.btn.className = 'btn ' + (metro.on ? 'btn-primary' : 'btn-ghost');
        metro.btn.setAttribute('aria-pressed', metro.on ? 'true' : 'false');
        U.clear(metro.btn);
        metro.btn.appendChild(U.el('span', { class: 'btn-icon', html: metro.on ? I.svgFilled('pause', 13) : I.svg('metronome', 16) }));
        metro.btn.appendChild(U.el('span', { text: metro.on ? '\u6682\u505c\u8282\u62cd\u5668' : '\u8282\u62cd\u5668' }));
      }
      function metroStart() {
        if (metro.on) return;
        A.unlock();
        metro.on = true;
        metro.beat = 0;
        metro.next = A.currentTime() + 0.12;
        metroPump();
        metro.timer = setInterval(metroPump, 60);
        buildBeatDots();
        syncMetroBtn();
      }
      /* silent=true 时不额外调用 stopAll（外层已统一静音时用） */
      function metroStop(silent) {
        var was = metro.on;
        metro.on = false;
        if (metro.timer) { clearInterval(metro.timer); metro.timer = null; }
        if (!silent) A.stopAll();
        if (was) { clearBeat(); syncMetroBtn(); }
      }
      function toggleMetro() { if (metro.on) metroStop(); else metroStart(); }
      /* 速度属于「播放属性」而非「作曲属性」：改速度不重新生成音符，
         但播放与节拍器都读 mel.bpm，必须同步；节拍器运行中则立即按新速度重排。 */
      function setTempo(v) {
        cfg.bpm = v;
        if (state.mel) state.mel.bpm = v;
        if (metro.on) { A.stopAll(); metro.next = A.currentTime() + 0.06; metro.beat = 0; }
      }

      function rebuildControls() {
        U.clear(dom.scoreCtrl);
        function sel(label, values, current, onPick, fmt) {
          return U.el('div', { class: 'ctrl-group' }, [
            U.el('span', { class: 'ctrl-label', text: label }),
            U.el('div', { class: 'pill-row' }, values.map(function (v) {
              return U.el('button', {
                class: 'pill' + (String(v) === String(current) ? ' active' : ''), type: 'button',
                on: { click: function () { onPick(v); rebuildControls(); } }
              }, fmt ? fmt(v) : String(v));
            }))
          ]);
        }
        dom.scoreCtrl.appendChild(U.el('div', { class: 'ctrl-bar' }, [
          sel('\u8c03\u6027', ['C', 'G', 'F', 'D', 'Bb', 'A'], cfg.keyName, function (v) { cfg.keyName = v; regenerate(); }),
          sel('\u62cd\u53f7', ['2/4', '3/4', '4/4'], cfg.timeSig, function (v) { cfg.timeSig = v; regenerate(); }),
          sel('\u5c0f\u8282\u6570', [2, 3, 4], cfg.bars, function (v) { cfg.bars = v; regenerate(); }),
          sel('\u96be\u5ea6', ['easy', 'medium', 'hard'], cfg.level, function (v) { cfg.level = v; regenerate(); }, function (v) {
            return { easy: '\u521d\u7ea7', medium: '\u4e2d\u7ea7', hard: '\u9ad8\u7ea7' }[v];
          }),
          sel('\u901f\u5ea6', [60, 80, 100], cfg.bpm, function (v) { setTempo(v); }, function (v) { return v + ' BPM'; })
        ]));
        dom.scoreCtrl.appendChild(U.el('div', { class: 'ctrl-bar' }, [
          U.el('button', { class: 'btn btn-ghost', type: 'button', on: { click: function () { regenerate(); } } }, '\u6362\u4e00\u6761'),
          U.el('button', {
            class: 'btn btn-ghost', type: 'button',
            on: { click: function () { metroStop(); playReference(state.mel, 'triad'); } }
          }, '\u4e3b\u4e09\u548c\u5f26'),
          U.el('button', {
            class: 'btn btn-ghost', type: 'button',
            on: { click: function () { metroStop(); playReference(state.mel, 'scale'); } }
          }, '\u8c03\u5185\u97f3\u9636'),
          (metro.btn = U.el('button', {
            class: 'btn btn-ghost', type: 'button', title: '\u5f00\u59cb / \u6682\u505c\u8282\u62cd\u5668',
            on: { click: function () { toggleMetro(); } }
          }, '\u8282\u62cd\u5668')),
          (metro.dots = U.el('span', { class: 'metro-beats' })),
          U.el('button', {
            class: 'btn btn-primary', type: 'button',
            on: { click: function () { metroStop(); playMelody(state.mel); } }
          }, [U.el('span', { class: 'btn-icon', html: I.svgFilled('play', 14) }), U.el('span', { text: '\u64ad\u653e\u5168\u66f2' })])
        ]));
        buildBeatDots();
        syncMetroBtn();
      }

      /* ---- 逐音模唱 ---- */
      var sing = { idx: 0, results: [], holding: false, holdStart: 0, trace: [], active: false, waiting: false };

      function renderInfo() {
        var mel = state.mel;
        var n = mel.flat[sing.idx];
        U.clear(dom.scoreInfo);
        dom.scoreInfo.appendChild(U.el('div', { class: 'panel-title' }, [
          U.el('span', { html: I.svg('target', 16) }),
          U.el('span', { text: '\u9010\u97f3\u6a21\u5531' })
        ]));
        if (!n) {
          dom.scoreInfo.appendChild(U.el('div', { class: 'empty-tip', text: '\u8bf7\u5148\u70b9\u51fb\u300c\u5f00\u59cb\u6a21\u5531\u300d' }));
          return;
        }
        var sol = T.solfegeOf(n.midi, mel.key);
        dom.scoreInfo.appendChild(U.el('div', { class: 'sing-now' }, [
          U.el('div', { class: 'sing-note', text: n ? noteName(n.midi) : '\u2014' }),
          U.el('div', { class: 'sing-sol', text: sol.text + (sol.accText || '') }),
          U.el('div', { class: 'sing-pos', text: '\u7b2c ' + (sing.idx + 1) + ' / ' + mel.flat.length + ' \u4e2a\u97f3\u7b26' })
        ]));
        dom.singNeedle = U.el('div', { class: 'tuner-needle' });
        dom.singCents = U.el('div', { class: 'tuner-cents', text: '\u2014' });
        dom.singCanvas = U.el('canvas', { class: 'cents-trace' });
        dom.scoreInfo.appendChild(U.el('div', { class: 'tuner-compact' }, [
          dom.singCents,
          U.el('div', { class: 'tuner-scale' }, [
            U.el('div', { class: 'tuner-track' }),
            U.el('div', { class: 'tuner-center' }), dom.singNeedle
          ]),
          U.el('div', { class: 'tuner-legend' }, [
            U.el('span', { text: '-50\u00a2' }), U.el('span', { class: 'legend-mid', text: '\u51c6' }), U.el('span', { text: '+50\u00a2' })
          ]),
          dom.singCanvas
        ]));
        var list = U.el('div', { class: 'sing-badges' });
        mel.flat.forEach(function (_, i) {
          var r = sing.results[i];
          list.appendChild(U.el('span', {
            class: 'sing-badge' + (i === sing.idx ? ' current' : '') + (r === undefined ? '' : (r.ok ? ' ok' : ' bad')),
            text: String(i + 1)
          }));
        });
        dom.scoreInfo.appendChild(list);
      }

      function renderMicPanel() {
        U.clear(dom.scoreMic);
        dom.scoreMic.appendChild(U.el('div', { class: 'panel-title' }, [
          U.el('span', { html: I.svg('mic', 16) }),
          U.el('span', { text: '\u9ea5\u514b\u98ce\u6a21\u5531' })
        ]));
        dom.micStatus = U.el('div', { class: 'mic-status', text: P.isSupported() ? '\u672a\u5f00\u542f' : '\u5f53\u524d\u73af\u5883\u4e0d\u652f\u6301' });
        var btnStart = U.el('button', {
          class: 'btn btn-primary', type: 'button',
          on: {
            click: function () {
              if (sing.active) stopMic();
              else startMic();
            }
          }
        }, '\u5f00\u59cb\u6a21\u5531');
        dom.micBtn = btnStart;
        dom.scoreMic.appendChild(U.el('div', { class: 'mic-actions' }, [
          btnStart,
          U.el('button', {
            class: 'btn btn-ghost', type: 'button',
            on: {
              click: function () {
                var n = state.mel.flat[sing.idx];
                if (!n) return;
                A.stopAll();
                A.playNote(n.midi, { dur: 1.0 });
              }
            }
          }, '\u64ad\u653e\u8be5\u97f3'),
          U.el('button', {
            class: 'btn btn-ghost', type: 'button',
            on: { click: function () { sing.idx = 0; sing.results = []; sing.trace = []; renderInfo(); } }
          }, '\u91cd\u7f6e\u8fdb\u5ea6'),
          U.el('button', {
            class: 'btn btn-ghost', type: 'button',
            on: { click: function () { sing.idx = Math.min(sing.idx + 1, state.mel.flat.length); renderInfo(); } }
          }, '\u8df3\u8fc7')
        ]));
        dom.scoreMic.appendChild(dom.micStatus);
        dom.micNotice = U.el('div', {});
        dom.scoreMic.appendChild(dom.micNotice);
        if (!P.isSupported()) micUnavailable(dom.micNotice, 'NOT_SUPPORTED');
      }

      function pushTrace(cents) {
        sing.trace.push(cents);
        if (sing.trace.length > 180) sing.trace.shift();
        if (dom.singCanvas) {
          var c = dom.singCanvas;
          if (c.clientWidth) {
            var ctx = c.getContext('2d');
            var dpr = global.devicePixelRatio || 1;
            var w = c.clientWidth, h = c.clientHeight || 54;
            c.width = w * dpr; c.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);
            var mid = h / 2;
            ctx.strokeStyle = 'rgba(127,127,127,0.22)';
            ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
            ctx.strokeStyle = 'rgba(52,211,153,0.5)';
            ctx.beginPath();
            ctx.moveTo(0, mid - (mid * (MIC_TOLERANCE / 50)) * 0.5);
            ctx.lineTo(w, mid - (mid * (MIC_TOLERANCE / 50)) * 0.5);
            ctx.moveTo(0, mid + (mid * (MIC_TOLERANCE / 50)) * 0.5);
            ctx.lineTo(w, mid + (mid * (MIC_TOLERANCE / 50)) * 0.5);
            ctx.stroke();
            ctx.beginPath();
            sing.trace.forEach(function (v, i) {
              var x = (w * i) / Math.max(1, sing.trace.length - 1);
              var y = mid - (Math.max(-50, Math.min(50, v)) / 50) * mid * 0.75;
              if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 2; ctx.stroke();
          }
        }
      }

      function onPitch(info) {
        var mel = state.mel;
        var target = mel.flat[sing.idx];
        if (!dom.singNeedle || !target) return;
        if (!info) {
          dom.singCents.textContent = '\u7b49\u5f85\u58f0\u97f3\u2026';
          dom.singNeedle.style.left = '50%';
          dom.singNeedle.className = 'tuner-needle';
          return;
        }
        var cents = (info.midiFloatSmooth !== undefined ? info.midiFloatSmooth : info.midiFloat) - target.midi;
        cents *= 100;
        var clamped = Math.max(-55, Math.min(55, cents));
        dom.singNeedle.style.left = (50 + clamped) + '%';
        dom.singCents.textContent = (cents >= 0 ? '+' : '') + cents.toFixed(0) + ' \u97f3\u5206';
        pushTrace(cents);
        var ok = Math.abs(cents) <= MIC_TOLERANCE;
        dom.singNeedle.className = 'tuner-needle' + (ok ? ' hit' : '');
        if (ok) {
          if (!sing.holding) { sing.holding = true; sing.holdStart = performance.now(); }
          else if (performance.now() - sing.holdStart >= HOLD_MS) {
            sing.results[sing.idx] = { ok: true, cents: cents };
            sing.holding = false;
            sing.trace = [];
            A.playClick(A.currentTime() + 0.02, false); // 轻微提示音
            var nextIdx = sing.idx + 1;
            U.toast('\u7b2c ' + (sing.idx + 1) + ' \u4e2a\u97f3\u6b63\u786e', 'ok', 900);
            sing.idx = nextIdx;
            if (sing.idx >= mel.flat.length) {
              sing.idx = mel.flat.length;
              finishSinging();
              return;
            }
            renderInfo();
          }
        } else { sing.holding = false; }
      }

      function finishSinging() {
        stopMic();
        var total = state.mel.flat.length;
        var ok = sing.results.filter(function (r) { return r && r.ok; }).length;
        var acc = U.pct(ok, total);
        U.toast('\u672c\u6761\u6a21\u5531\u5b8c\u6210\uff1a' + ok + ' / ' + total + ' \u4e2a\u97f3\u51c6\u786e', acc >= 80 ? 'ok' : 'warn', 3200);
        S.unlockAchievement('sight_first', '\u5b8c\u6210\u9996\u6b21\u89c6\u5531\u6a21\u5531');
        if (acc >= 90) S.unlockAchievement('sight_90', '\u89c6\u5531\u6a21\u5531\u51c6\u786e\u7387\u8fbe 90%');
        if (acc >= 85 && S.getSettings().confetti) U.confetti(90);
        var box = U.el('div', { class: 'notice notice-ok' }, [
          U.el('span', { class: 'notice-icon', html: I.svg('check', 16) }),
          U.el('span', { text: '\u672c\u6761\u6a21\u5531\u7ed3\u675f\uff1a\u51c6\u786e ' + ok + ' / ' + total + '\uff08' + acc + '%\uff09\u3002\u53ef\u70b9\u300c\u6362\u4e00\u6761\u300d\u7ee7\u7eed\u7ec3\u4e60\u3002' })
        ]);
        U.clear(dom.micNotice);
        dom.micNotice.appendChild(box);
      }

      function startMic() {
        if (sing.active) return;
        if (!P.isSupported()) { micUnavailable(dom.micNotice, 'NOT_SUPPORTED'); return; }
        A.unlock();
        sing.active = true;
        sing.results = [];
        sing.idx = 0;
        sing.trace = [];
        dom.micBtn.textContent = '\u505c\u6b62\u6a21\u5531';
        dom.micStatus.textContent = '\u6b63\u5728\u76d1\u542c\u2026\u8bf7\u7528\u201c\u55d3\u55c3\u201d\u5531\u51fa\u5f53\u524d\u97f3\u9ad8';
        renderInfo();
        state.tuner = new P.Tuner();
        state.tuner.start(function (info) { onPitch(info); }, function (code) {
          micUnavailable(dom.micNotice, code);
          stopMic();
        }).catch(function () { /* 已在 onError 中处理 */ });
      }
      function stopMic() {
        sing.active = false;
        sing.holding = false;
        if (state.tuner) { state.tuner.stop(); state.tuner = null; }
        if (dom.micBtn) dom.micBtn.textContent = '\u5f00\u59cb\u6a21\u5531';
        if (dom.micStatus) dom.micStatus.textContent = '\u5df2\u505c\u6b62';
      }

      regenerate();
      rebuildControls();
      renderInfo();
      renderMicPanel();
      return {
        destroy: function () { stopMic(); metroStop(); }
      };
    }

    /* ============================= 2. 音准仪 ============================= */
    function renderTuner() {
      var cleared = false;
      dom.tunerNote = U.el('div', { class: 'tuner-big-note', text: '\u2014\u2014' });
      dom.tunerSol = U.el('div', { class: 'tuner-big-sol', text: '' });
      dom.tunerCents = U.el('div', { class: 'tuner-big-cents', text: '0 \u97f3\u5206' });
      dom.tunerFreq = U.el('div', { class: 'tuner-freq', text: '0.0 Hz' });
      dom.tunerNeedle = U.el('div', { class: 'tuner-needle' });
      dom.tunerCanvas = U.el('canvas', { class: 'cents-trace big' });
      var trace = [];

      var panel = U.el('div', { class: 'panel tuner-panel' }, [
        U.el('div', { class: 'panel-title' }, [U.el('span', { html: I.svg('target', 16) }), U.el('span', { text: '\u5b9e\u65f6\u97f3\u51c6\u4eea' })]),
        U.el('div', { class: 'tuner-display' }, [dom.tunerNote, dom.tunerSol, dom.tunerCents, dom.tunerFreq]),
        U.el('div', { class: 'tuner-scale big' }, [
          U.el('div', { class: 'tuner-track' }),
          U.el('div', { class: 'tuner-center' }), dom.tunerNeedle
        ]),
        U.el('div', { class: 'tuner-legend' }, [
          U.el('span', { text: '\u964d -50\u00a2' }), U.el('span', { class: 'legend-mid', text: '\u51c6\u786e' }), U.el('span', { text: '\u5347 +50\u00a2' })
        ]),
        dom.tunerCanvas,
        U.el('div', { class: 'mic-actions' }, [
          U.el('button', {
            class: 'btn btn-primary', type: 'button',
            on: {
              click: function (e) {
                var btn = e.currentTarget;
                if (state.tuner) {
                  state.tuner.stop(); state.tuner = null;
                  btn.textContent = '\u5f00\u59cb\u76d1\u542c';
                } else {
                  A.unlock();
                  btn.textContent = '\u505c\u6b62\u76d1\u542c';
                  state.tuner = new P.Tuner();
                  state.tuner.start(onUpdate, function (code) { micUnavailable(noticeBox, code); state.tuner = null; btn.textContent = '\u5f00\u59cb\u76d1\u542c'; }).catch(function () { });
                }
              }
            }
          }, '\u5f00\u59cb\u76d1\u542c'),
          U.el('button', {
            class: 'btn btn-ghost', type: 'button',
            on: { click: function () { trace = []; cleared = true; drawTrace(); } }
          }, '\u6e05\u7a7a\u8f68\u8ff9')
        ]),
        U.el('div', { class: 'tuner-note-hint', text: '\u63d0\u793a\uff1a\u4f7f\u7528\u201c\u55d3\u55c3\u201d\u6bcd\u97f3\u5531\u51fa\u7a33\u5b9a\u957f\u97f3\uff0c\u6307\u9488\u5c45\u4e2d\u5373\u4e3a\u51c6\u786e\u3002A4 \u57fa\u51c6\uff1a' + state.settings.a4 + ' Hz' })
      ]);
      var noticeBox = U.el('div', {});
      dom.body.appendChild(U.el('div', { class: 'sight-grid single' }, [panel, noticeBox]));
      if (!P.isSupported()) micUnavailable(noticeBox, 'NOT_SUPPORTED');

      function drawTrace() {
        var c = dom.tunerCanvas;
        if (!c.clientWidth) return;
        var ctx = c.getContext('2d');
        var dpr = global.devicePixelRatio || 1;
        var w = c.clientWidth, h = c.clientHeight || 90;
        c.width = w * dpr; c.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        var mid = h / 2;
        ctx.strokeStyle = 'rgba(127,127,127,0.22)';
        ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
        ctx.strokeStyle = 'rgba(52,211,153,0.45)';
        [mid - h * 0.3, mid + h * 0.3].forEach(function (y) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        });
        ctx.beginPath();
        trace.forEach(function (v, i) {
          var x = (w * i) / Math.max(1, trace.length - 1);
          var y = mid - (Math.max(-50, Math.min(50, v)) / 50) * mid * 0.85;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 2; ctx.stroke();
      }
      function onUpdate(info, res) {
        if (!info) {
          dom.tunerNote.textContent = '\u2014\u2014';
          dom.tunerSol.textContent = '';
          dom.tunerNeedle.style.left = '50%';
          dom.tunerNeedle.className = 'tuner-needle';
          return;
        }
        var sol = T.SOLFEGE_FIXED[T.SHARP_NAMES[T.pcOf(info.midi)][0]] || '';
        dom.tunerNote.textContent = T.midiToName(info.midi, false).replace('#', SHARP);
        dom.tunerSol.textContent = '\u56fa\u5b9a\u5531\u540d\uff1a' + sol;
        var c = info.centsSmooth !== undefined ? info.centsSmooth : info.cents;
        dom.tunerCents.textContent = (c >= 0 ? '+' : '') + c.toFixed(0) + ' \u97f3\u5206';
        dom.tunerCents.className = 'tuner-big-cents' + (Math.abs(c) <= 5 ? ' ok' : (Math.abs(c) <= 25 ? ' near' : ' off'));
        var f = (res && res.freq) ? res.freq : T.midiToFreq(info.midiFloat, state.settings.a4);
        dom.tunerFreq.textContent = f.toFixed(1) + ' Hz';
        var clamped = Math.max(-55, Math.min(55, c));
        dom.tunerNeedle.style.left = (50 + clamped) + '%';
        dom.tunerNeedle.className = 'tuner-needle' + (Math.abs(c) <= 5 ? ' hit' : '');
        trace.push(c);
        if (trace.length > 240) trace.shift();
        drawTrace();
      }
      return {
        destroy: function () { if (state.tuner) { state.tuner.stop(); state.tuner = null; } }
      };
    }

    /* ============================ 3. 节奏模仿 =========================== */
    function renderRhythmTap() {
      var cfg = { level: state.settings.level || 'easy', timeSig: '4/4', bpm: 80 };
      var tap = { running: false, t0: 0, taps: [], onsets: [], pattern: null, timer: null, countIn: 0 };
      var pad = U.el('div', { class: 'tap-pad', tabindex: '0' }, [
        U.el('div', { class: 'tap-pad-inner' }, [
          U.el('div', { class: 'tap-pad-title', text: '\u70b9\u51fb\u6b64\u5904\u6216\u6309\u7a7a\u683c\u952e' }),
          U.el('div', { class: 'tap-pad-sub', text: '\u6309\u8282\u594f\u51fb\u62cd' })
        ])
      ]);
      var timeline = U.el('canvas', { class: 'tap-timeline' });
      var resultBox = U.el('div', { class: 'tap-result' });
      var status = U.el('div', { class: 'mic-status', text: '\u5c31\u7eea' });

      function pickPattern() {
        var perBar = parseInt(cfg.timeSig.split('/')[0], 10);
        var list = cfg.timeSig === '4/4' ? T.RHYTHM_PATTERNS[cfg.level] : (cfg.timeSig === '3/4' ? T.RHYTHM_PATTERNS_34[cfg.level] : RHY_24[cfg.level]);
        var p = U.pick(list);
        // 保证总时值与拍号一致
        var sum = T.patternTotal(p);
        if (sum !== perBar) p = cfg.timeSig === '4/4' ? [1, 1, 1, 1] : (cfg.timeSig === '3/4' ? [1, 1, 1] : [1, 1]);
        return p;
      }

      function buildControls() {
        return U.el('div', { class: 'ctrl-bar' }, [
          U.el('div', { class: 'ctrl-group' }, [
            U.el('span', { class: 'ctrl-label', text: '\u96be\u5ea6' }),
            U.el('div', { class: 'pill-row' }, ['easy', 'medium', 'hard'].map(function (v) {
              return U.el('button', {
                class: 'pill' + (cfg.level === v ? ' active' : ''), type: 'button',
                on: { click: function () { cfg.level = v; S.saveSettings({ level: v }); refreshCtrl(); } }
              }, { easy: '\u521d\u7ea7', medium: '\u4e2d\u7ea7', hard: '\u9ad8\u7ea7' }[v]);
            }))
          ]),
          U.el('div', { class: 'ctrl-group' }, [
            U.el('span', { class: 'ctrl-label', text: '\u62cd\u53f7' }),
            U.el('div', { class: 'pill-row' }, ['2/4', '3/4', '4/4'].map(function (v) {
              return U.el('button', {
                class: 'pill' + (cfg.timeSig === v ? ' active' : ''), type: 'button',
                on: { click: function () { cfg.timeSig = v; refreshCtrl(); } }
              }, v);
            }))
          ]),
          U.el('div', { class: 'ctrl-group' }, [
            U.el('span', { class: 'ctrl-label', text: '\u901f\u5ea6' }),
            U.el('div', { class: 'pill-row' }, [60, 80, 100, 120].map(function (v) {
              return U.el('button', {
                class: 'pill' + (cfg.bpm === v ? ' active' : ''), type: 'button',
                on: { click: function () { cfg.bpm = v; refreshCtrl(); } }
              }, v + '');
            }))
          ])
        ]);
      }
      function refreshCtrl() {
        U.clear(ctrlWrap);
        ctrlWrap.appendChild(buildControls());
        ctrlWrap.appendChild(buildActions());
        drawPreview();
      }
      function buildActions() {
        return U.el('div', { class: 'ctrl-bar' }, [
          U.el('button', {
            class: 'btn btn-primary', type: 'button',
            on: { click: function () { startTap(); } }
          }, [U.el('span', { class: 'btn-icon', html: I.svgFilled('play', 14) }), U.el('span', { text: '\u5f00\u59cb' })]),
          U.el('button', {
            class: 'btn btn-ghost', type: 'button',
            on: { click: function () { drawPreview(); status.textContent = '\u5c31\u7eea'; resultBox.innerHTML = ''; } }
          }, '\u6362\u4e00\u6761')
        ]);
      }

      function drawPreview() {
        tap.pattern = pickPattern();
        N.renderRhythm(previewHost, tap.pattern, { timeSig: cfg.timeSig, width: Math.max(380, previewHost.clientWidth || 0) });
      }
      function drawTimeline(onsets, taps) {
        var c = timeline;
        if (!c.clientWidth) return;
        var ctx = c.getContext('2d');
        var dpr = global.devicePixelRatio || 1;
        var w = c.clientWidth, h = 90;
        c.width = w * dpr; c.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        var span = Math.max(1, (onsets.length ? onsets[onsets.length - 1] : 1000) + 400);
        function X(ms) { return (ms / span) * (w - 20) + 10; }
        ctx.strokeStyle = 'rgba(127,127,127,0.28)';
        ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
        onsets.forEach(function (o) {
          ctx.strokeStyle = 'rgba(99,102,241,0.55)';
          ctx.beginPath(); ctx.moveTo(X(o), h / 2 - 18); ctx.lineTo(X(o), h / 2 + 18); ctx.stroke();
        });
        taps.forEach(function (t) {
          var near = onsets.reduce(function (a, o) { return Math.abs(o - t) < Math.abs(a - t) ? o : a; }, onsets[0] || t);
          var ok = Math.abs(near - t) <= 150;
          ctx.fillStyle = ok ? '#34d399' : '#f87171';
          ctx.beginPath(); ctx.arc(X(t), h / 2 + 30, 4, 0, Math.PI * 2); ctx.fill();
        });
        ctx.fillStyle = 'rgba(127,127,127,0.85)';
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillText('\u4e0a\u65b9\u7ad6\u7ebf\uff1a\u9884\u671f\u8d77\u70b9\u3000\u4e0b\u65b9\u5706\u70b9\uff1a\u60a8\u7684\u51fb\u62cd\uff08\u7eff\u8272\u4e3a\u51c6\u786e\uff09', 10, 14);
      }

      var previewHost = U.el('div', { class: 'panel staff-panel' });
      var ctrlWrap = U.el('div', { class: 'panel panel-ctrl' });
      dom.body.appendChild(U.el('div', { class: 'panel tap-panel' }, [
        U.el('div', { class: 'panel-title' }, [U.el('span', { html: I.svg('rhythm', 16) }), U.el('span', { text: '\u8282\u594f\u6a21\u4eff\uff08\u51fb\u62cd\uff09' })]),
        previewHost,
        pad,
        timeline,
        status,
        resultBox
      ]));
      dom.body.appendChild(ctrlWrap);
      ctrlWrap.appendChild(buildControls());
      ctrlWrap.appendChild(buildActions());
      drawPreview();

      function startTap() {
        A.unlock();
        A.stopAll();
        var spb = 60000 / cfg.bpm;
        var beatsPerBar = parseInt(cfg.timeSig.split('/')[0], 10);
        var events = T.patternToEvents(tap.pattern);
        var countInBeats = beatsPerBar;
        var onsetMs = [];
        events.forEach(function (e) { if (!e.rest) onsetMs.push((countInBeats + e.start) * spb); });
        tap.onsets = onsetMs;
        tap.taps = [];
        tap.running = true;
        tap.countIn = countInBeats;
        var totalMs = (countInBeats + T.patternTotal(tap.pattern)) * spb + 400;
        var t = A.currentTime() + 0.12;
        for (var i = 0; i < countInBeats; i++) A.playClick(t + (i * spb) / 1000, i % beatsPerBar === 0);
        events.forEach(function (e) {
          if (e.rest) return;
          A.playClick(t + (countInBeats + e.start) * spb / 1000, false);
        });
        tap.t0 = performance.now() + 120;
        status.textContent = '\u9884\u5907\u4e2d\u2026\u8bf7\u5728\u9884\u5907\u62cd\u7ed3\u675f\u540e\u5f00\u59cb\u51fb\u62cd';
        resultBox.innerHTML = '';
        pad.classList.add('armed');
        drawTimeline(tap.onsets, []);
        if (tap.timer) clearTimeout(tap.timer);
        tap.timer = setTimeout(function () {
          tap.running = false;
          pad.classList.remove('armed');
          evaluate();
        }, totalMs);
      }
      function recordTap() {
        if (!tap.running) return;
        var now = performance.now() - tap.t0;
        if (now < tap.countIn * (60000 / cfg.bpm) - 60) return; // 预备拍期间不计
        tap.taps.push(now);
        pad.classList.add('flash');
        setTimeout(function () { pad.classList.remove('flash'); }, 90);
        drawTimeline(tap.onsets, tap.taps);
      }
      function evaluate() {
        if (!tap.taps.length) {
          status.textContent = '\u672a\u68c0\u6d4b\u5230\u51fb\u62cd\uff0c\u8bf7\u91cd\u8bd5';
          return;
        }
        var errs = [];
        var onsetsUsed = tap.onsets.slice();
        tap.taps.forEach(function (t) {
          if (!onsetsUsed.length) { errs.push(250); return; }
          var best = 0, bd = Infinity;
          onsetsUsed.forEach(function (o, i) { var d = Math.abs(o - t); if (d < bd) { bd = d; best = i; } });
          errs.push(bd);
          if (bd <= 200) onsetsUsed.splice(best, 1);
        });
        onsetsUsed.forEach(function () { errs.push(250); });
        var mean = errs.reduce(function (a, b) { return a + b; }, 0) / errs.length;
        var score = Math.max(0, Math.round(100 - mean / 2.5));
        var grade = mean <= 60 ? '\u4f18\u79c0' : mean <= 110 ? '\u826f\u597d' : mean <= 180 ? '\u5408\u683c' : '\u9700\u52a0\u5f3a';
        status.textContent = '\u5e73\u5747\u504f\u5dee ' + mean.toFixed(0) + ' ms';
        U.clear(resultBox);
        resultBox.appendChild(U.el('div', { class: 'tap-score' }, [
          U.el('div', { class: 'tap-score-num', text: String(score) }),
          U.el('div', { class: 'tap-score-info' }, [
            U.el('strong', { text: grade }),
            U.el('span', { text: '\u5e73\u5747\u504f\u5dee ' + mean.toFixed(0) + ' ms \u00b7 \u9884\u671f ' + tap.onsets.length + ' \u6b21 \u00b7 \u51fb\u62cd ' + tap.taps.length + ' \u6b21' })
          ])
        ]));
        if (score >= 85) U.confetti(60);
      }

      pad.addEventListener('click', function () { recordTap(); });
      pad.addEventListener('keydown', function (e) { if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); recordTap(); } });
      U.bindKeys([{ key: ' ', handler: function () { recordTap(); } }]);
      return { destroy: function () { if (tap.timer) clearTimeout(tap.timer); } };
    }

    renderView();

    return {
      destroy: function () { cleanup(); if (dom._sub && dom._sub.destroy) dom._sub.destroy(); }
    };
  }

  WB.Sight = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
