/* =============================================================================
 * ref.js  —  乐理速查
 * 音名唱名 / 音程 / 和弦 / 音阶调式 / 常用和弦进行 / 五度圈 / 交互式键盘
 * ========================================================================== */
(function (global) {
  'use strict';
  var WB = (global.WB = global.WB || {});
  var T = WB.Theory;
  var A = WB.Audio;
  var U = WB.UI;
  var I = WB.Icons;

  var SHARP = '\u266f', FLAT = '\u266d';

  /* ------------------------- 交互式钢琴键盘 ------------------------------ */
  function Keyboard() {
    return {
      render: function (container, opts) {
        opts = opts || {};
        var lo = opts.lo !== undefined ? opts.lo : 48;   // C3
        var hi = opts.hi !== undefined ? opts.hi : 83;   // B5
        var whiteW = opts.whiteW || 26, whiteH = opts.whiteH || 108;
        var blackW = Math.round(whiteW * 0.62), blackH = Math.round(whiteH * 0.62);
        var whites = [], blacks = [];
        var whiteIdx = 0;
        var whiteIndexMap = {};
        for (var m = lo; m <= hi; m++) {
          var pc = T.pcOf(m);
          if ([1, 3, 6, 8, 10].indexOf(pc) >= 0) blacks.push(m);
          else { whiteIndexMap[m] = whiteIdx; whites.push(m); whiteIdx++; }
        }
        var totalW = whites.length * whiteW;
        var height = whiteH + 26;
        var svg = [];
        svg.push('<svg class="piano-svg" viewBox="0 0 ' + totalW + ' ' + height + '" width="100%" height="' + height + '" preserveAspectRatio="xMidYMin meet">');
        whites.forEach(function (m, i) {
          var x = i * whiteW;
          var isC = T.pcOf(m) === 0;
          svg.push('<g class="pkey pkey-white' + (isC ? ' is-c' : '') + '" data-midi="' + m + '">' +
            '<rect x="' + x + '" y="0" width="' + whiteW + '" height="' + whiteH + '" rx="3"/>' +
            '<text x="' + (x + whiteW / 2) + '" y="' + (whiteH + 17) + '" text-anchor="middle">' +
            T.SHARP_NAMES[T.pcOf(m)].replace('#', SHARP) + '</text>' +
            '</g>');
        });
        blacks.forEach(function (m) {
          // 找左侧白键
          var left = m - 1;
          while (whiteIndexMap[left] === undefined && left > lo) left--;
          var idx = whiteIndexMap[left];
          if (idx === undefined) return;
          var x = (idx + 1) * whiteW - blackW / 2;
          svg.push('<g class="pkey pkey-black" data-midi="' + m + '">' +
            '<rect x="' + x + '" y="0" width="' + blackW + '" height="' + blackH + '" rx="3"/>' +
            '</g>');
        });
        svg.push('</svg>');
        container.innerHTML = svg.join('');
        container.querySelectorAll('.pkey').forEach(function (g) {
          g.addEventListener('click', function () {
            var midi = parseInt(g.dataset.midi, 10);
            A.unlock();
            A.playNote(midi, { dur: 1.1, velocity: 0.9 });
            g.classList.add('pressed');
            setTimeout(function () { g.classList.remove('pressed'); }, 180);
            if (opts.onPick) opts.onPick(midi);
          });
        });
      }
    };
  }

  /* ------------------------------ 五度圈 --------------------------------- */
  function circleOfFifths() {
    var majors = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
    // 内圈小调为外圈大调的关系小调（6 个升号处为 d# 小调）
    var minors = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];
    var sigs = ['0', '1\u266f', '2\u266f', '3\u266f', '4\u266f', '5\u266f', '6\u266f/6\u266d', '5\u266d', '4\u266d', '3\u266d', '2\u266d', '1\u266d'];
    var cx = 200, cy = 200, rOut = 116, rMid = 88, rIn = 66, rLabel = 143;
    var parts = [];
    parts.push('<svg class="fifths-svg" viewBox="0 0 400 400" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">');
    parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + (rOut + 12) + '" class="cof-bg"/>');
    for (var i = 0; i < 12; i++) {
      var a0 = (i * 30 - 90 - 15) * Math.PI / 180;
      var a1 = (i * 30 - 90 + 15) * Math.PI / 180;
      var am = (i * 30 - 90) * Math.PI / 180;
      function pt(r, a) { return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
      function sector(r1, r2) {
        var p1 = pt(r2, a0), p2 = pt(r2, a1), p3 = pt(r1, a1), p4 = pt(r1, a0);
        return 'M' + p1[0] + ' ' + p1[1] + 'A' + r2 + ' ' + r2 + ' 0 0 1 ' + p2[0] + ' ' + p2[1] +
          'L' + p3[0] + ' ' + p3[1] + 'A' + r1 + ' ' + r1 + ' 0 0 0 ' + p4[0] + ' ' + p4[1] + 'Z';
      }
      parts.push('<path class="cof-sector" d="' + sector(rMid, rOut) + '"/>');
      parts.push('<path class="cof-sector inner" d="' + sector(rIn, rMid) + '"/>');
      var pm = pt((rMid + rOut) / 2, am);
      var pi = pt((rIn + rMid) / 2, am);
      parts.push('<text class="cof-major" x="' + pm[0] + '" y="' + (pm[1] + 6) + '" text-anchor="middle">' + majors[i].replace('#', SHARP) + '</text>');
      parts.push('<text class="cof-minor" x="' + pi[0] + '" y="' + (pi[1] + 5) + '" text-anchor="middle">' + minors[i].replace('#', SHARP) + '</text>');
      var pl = pt(rLabel + 6, am);
      parts.push('<text class="cof-sig" x="' + pl[0] + '" y="' + (pl[1] + 4) + '" text-anchor="middle">' + sigs[i] + '</text>');
    }
    parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + (rIn - 8) + '" class="cof-center"/>');
    parts.push('<text class="cof-center-title" x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle">\u4e94\u5ea6\u5708</text>');
    parts.push('<text class="cof-center-sub" x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle">\u5916\u5708\u5927\u8c03 \u00b7 \u5185\u5708\u5c0f\u8c03</text>');
    parts.push('</svg>');
    return parts.join('');
  }

  /* ------------------------------ 表格构造 ------------------------------- */
  function table(headers, rows) {
    var thead = U.el('thead', {}, [U.el('tr', {}, headers.map(function (h) { return U.el('th', { text: h }); }))]);
    var tbody = U.el('tbody', {}, rows.map(function (r) {
      return U.el('tr', {}, r.map(function (c, i) {
        return U.el('td', { class: i === 0 ? 'td-strong' : '' }, c);
      }));
    }));
    return U.el('table', { class: 'ref-table' }, [thead, tbody]);
  }

  /* =============================== 主视图 =============================== */
  function mount(container, opts) {
    opts = opts || {};
    container.innerHTML = '';
    var root = U.el('div', { class: 'page page-ref' });
    container.appendChild(root);
    var tabs = [
      { id: 'note', name: '\u97f3\u540d\u5531\u540d' },
      { id: 'interval', name: '\u97f3\u7a0b' },
      { id: 'chord', name: '\u548c\u5f26' },
      { id: 'scale', name: '\u97f3\u9636\u8c03\u5f0f' },
      { id: 'progression', name: '\u548c\u58f0\u8fdb\u884c' },
      { id: 'cof', name: '\u4e94\u5ea6\u5708' },
      { id: 'keyboard', name: '\u952e\u76d8' }
    ];
    var cur = opts.tab || 'note';
    var body = U.el('div', { class: 'page-body' });
    var tabBar = U.el('div', { class: 'seg-tabs wrap' }, tabs.map(function (t) {
      return U.el('button', {
        class: 'seg-tab' + (t.id === cur ? ' active' : ''), type: 'button', dataset: { view: t.id },
        on: {
          click: function () {
            cur = t.id;
            U.qsa('.seg-tab', tabBar).forEach(function (b) { b.classList.toggle('active', b.dataset.view === t.id); });
            render();
          }
        }
      }, t.name);
    }));
    root.appendChild(U.el('div', { class: 'page-head' }, [
      U.el('div', { class: 'page-head-left' }, [
        U.el('div', { class: 'page-head-icon', html: I.svg('book', 22) }),
        U.el('div', {}, [
          U.el('h2', { class: 'page-title', text: '\u4e50\u7406\u901f\u67e5' }),
          U.el('p', { class: 'page-sub', text: '\u97f3\u540d\u3001\u97f3\u7a0b\u3001\u548c\u5f26\u3001\u8c03\u5f0f\u4e0e\u548c\u58f0\u8fdb\u884c\u7684\u901f\u67e5\u8868\u683c\uff08\u542b\u542c\u611f\u4e0e\u53c2\u8003\u66f2\u76ee\uff09' })
        ])
      ]),
      tabBar
    ]));
    root.appendChild(body);

    function panel(title, subs) {
      return U.el('section', { class: 'panel' }, [
        U.el('div', { class: 'panel-title' }, [U.el('span', { html: I.svg('info', 16) }), U.el('span', { text: title })]),
        subs
      ]);
    }

    function render() {
      U.clear(body);
      if (cur === 'note') {
        var rows = T.SHARP_NAMES.map(function (n, pc) {
          var letter = n[0];
          return [
            n.replace('#', SHARP) + ' / ' + T.FLAT_NAMES[pc].replace('b', FLAT),
            T.SOLFEGE_FIXED[letter],
            String(pc),
            T.midiToName(60 + pc, false) + ' / ' + T.midiToName(60 + pc, true)
          ];
        });
        body.appendChild(panel('\u97f3\u540d\u4e0e\u5531\u540d\u5bf9\u7167\uff08\u5341\u4e8c\u5e73\u5747\u5f8b\uff09', [
          U.el('p', { class: 'ref-note', text: '\u56fa\u5b9a\u5531\u540d\u6cd5\uff1a\u4e0d\u8bba\u4ec0\u4e48\u8c03\uff0cC \u6c38\u8fdc\u5531 do\u3002\u9996\u8c03\u5531\u540d\u6cd5\uff1a\u8c03\u7684\u4e3b\u97f3\u5531 do\uff0c\u5176\u4f59\u6309\u97f3\u9636\u7ea7\u63a8\u79fb\u3002' }),
          table(['\u97f3\u540d', '\u56fa\u5b9a\u5531\u540d', '\u534a\u97f3\u6570\uff08\u4ece C\uff09', '\u4e2d\u97f3\u533a\u793a\u4f8b'], rows)
        ]));
        var kbHost = U.el('div', { class: 'piano-host' });
        body.appendChild(panel('\u4ea4\u4e92\u5f0f\u952e\u76d8\uff08\u70b9\u51fb\u8bd5\u542c\uff09', [kbHost]));
        Keyboard().render(kbHost, { lo: 48, hi: 83 });
      } else if (cur === 'interval') {
        body.appendChild(panel('\u97f3\u7a0b\u901f\u67e5\u8868', [
          U.el('p', { class: 'ref-note', text: '\u201c\u542c\u611f\u201d\u4e3a\u666e\u904d\u63cf\u8ff0\uff0c\u201c\u53c2\u8003\u201d\u4e3a\u97f3\u7a0b\u8bb0\u5fc6\u7684\u5e38\u7528\u66f2\u76ee\u951a\u70b9\uff08\u4e0a\u884c\uff09\uff0c\u6e90\u81ea Soundbrenner \u542c\u529b\u8bad\u7ec3\u4e13\u9898\u4e0e\u7ef4\u57fa\u6559\u79d1\u4e66\u300a\u97f3\u9636\u4e0e\u97f3\u7a0b\u300b\u3002' }),
          table(['\u97f3\u7a0b', '\u7f29\u5199', '\u534a\u97f3\u6570', '\u534f\u548c\u5ea6', '\u542c\u611f', '\u4e0a\u884c\u53c2\u8003\u66f2\u76ee', '\u4e0b\u884c\u53c2\u8003\u66f2\u76ee'],
            T.INTERVALS.map(function (iv) {
              return [iv.cn, iv.abbr, String(iv.semis), iv.consonant, iv.feel, iv.refUp, iv.refDown];
            }))
        ]));
      } else if (cur === 'chord') {
        var rows = T.CHORDS.map(function (c) {
          var names = c.intervals.map(function (iv) { return T.INTERVALS.filter(function (x) { return x.semis === iv; }).map(function (x) { return x.cn; })[0]; });
          return [
            c.cn + (c.sym ? '\uff08' + c.sym + '\uff09' : ''),
            c.intervals.join(' - '),
            names.join(' + '),
            c.group === 'triad' ? '\u4e09\u548c\u5f26\uff084 \u4e2a\u8f6c\u4f4d\uff09' : '\u4e03\u548c\u5f26\uff08\u542b\u7b2c\u4e8c\u3001\u7b2c\u4e09\u8f6c\u4f4d\uff09'
          ];
        });
        body.appendChild(panel('\u548c\u5f26\u6784\u6210\u901f\u67e5\u8868', [
          U.el('p', { class: 'ref-note', text: '\u4ee5 C \u4e3a\u6839\u97f3\u4e3e\u4f8b\u3002\u592e\u97f3\u89c6\u5531\u7ec3\u8033\u8003\u7eb2\u8981\u6c42\u638c\u63e1\u56db\u79cd\u4e09\u548c\u5f26\u4e0e\u56db\u79cd\u4e03\u548c\u5f26\u7684\u539f\u4f4d\u4e0e\u8f6c\u4f4d\u3002' }),
          table(['\u540d\u79f0', '\u97f3\u7a0b\u7ed3\u6784\uff08\u534a\u97f3\uff09', '\u6784\u6210\u97f3\u7a0b', '\u8bf4\u660e'], rows)
        ]));
        var demoRows = T.CHORDS.slice(0, 8).map(function (c) {
          var btn = U.el('button', {
            class: 'btn-mini', type: 'button',
            on: { click: function () { A.unlock(); A.playChord(T.chordNotes(60, c, 0), { dur: 1.6 }); } }
          }, '\u8bd5\u542c');
          return [c.cn, c.intervals.join(' - '), btn];
        });
        body.appendChild(panel('\u540c\u6839\u97f3\u8bd5\u542c\uff08C \u4e3a\u6839\u97f3\uff09', [
          table(['\u540d\u79f0', '\u6784\u6210', '\u64cd\u4f5c'], demoRows)
        ]));
      } else if (cur === 'scale') {
        var rows = T.SCALES.map(function (s) {
          var names = s.intervals.map(function (iv) {
            var x = T.INTERVALS.filter(function (y) { return y.semis === iv; })[0];
            return x ? x.abbr : String(iv);
          });
          var group = { basic: '\u5927\u5c0f\u8c03', minor: '\u5c0f\u8c03\u53d8\u4f53', mode: '\u4e2d\u53e4\u8c03\u5f0f', china: '\u4e94\u58f0\u8c03\u5f0f', other: '\u5176\u4ed6' }[s.group] || '\u5176\u4ed6';
          return [s.cn, group, String(s.intervals.length), names.join(' - ')];
        });
        body.appendChild(panel('\u97f3\u9636\u4e0e\u8c03\u5f0f\u901f\u67e5\u8868', [
          U.el('p', { class: 'ref-note', text: '\u9636\u6570\u4e3a\u8be5\u97f3\u9636\u5305\u542b\u7684\u97f3\u7ea7\u6570\u91cf\uff0c\u95f4\u9694\u5217\u4e3a\u76f8\u90bb\u97f3\u7ea7\u4e4b\u95f4\u7684\u97f3\u7a0b\u7f29\u5199\u3002' }),
          table(['\u540d\u79f0', '\u5206\u7c7b', '\u97f3\u7ea7\u6570', '\u76f8\u90bb\u97f3\u9636\u5173\u7cfb'], rows)
        ]));
      } else if (cur === 'progression') {
        var rows = T.PROGRESSIONS.map(function (p) {
          var key = T.buildKey(p.mode === 'minor' ? 'Am' : 'C');
          var chords = T.progressionChords(key, p.numerals, 4);
          var names = chords.map(function (c, i) {
            var chordName = T.SHARP_NAMES[T.pcOf(c[0])].replace('#', SHARP);
            var root = T.INTERVAL_BY_SEMIS[T.mod(c[1] - c[0], 12)];
            var quality = root && (root.abbr === 'm3' ? '\u5c0f\u4e09\u548c\u5f26' : (root.abbr === 'M3' ? '\u5927\u4e09\u548c\u5f26' : '\u5176\u4ed6')) || '';
            return chordName + quality;
          });
          var listen = U.el('button', {
            class: 'btn-mini', type: 'button',
            on: {
              click: function () {
                A.unlock();
                A.stopAll();
                var k = T.buildKey(p.mode === 'minor' ? 'Am' : 'C');
                var cs = T.progressionChords(k, p.numerals, 4);
                var t0 = A.currentTime() + 0.06;
                cs.forEach(function (c, i) { A.playChord(c, { when: t0 + i * 0.8, dur: 0.72 }); });
              }
            }
          }, '\u8bd5\u542c');
          return [p.numerals.join(' - '), p.cn, p.mode === 'minor' ? '\u5c0f\u8c03' : '\u5927\u8c03', names.join(' \u2192 '), listen];
        });
        body.appendChild(panel('\u5e38\u7528\u548c\u58f0\u8fdb\u884c\u901f\u67e5\u8868', [
          U.el('p', { class: 'ref-note', text: '\u4ee5 C \u5927\u8c03 / a \u5c0f\u8c03\u4e3a\u4f8b\uff1b\u201c\u8bd5\u542c\u201d\u4ee5\u56db\u548c\u5f26\u5f62\u5f0f\u64ad\u653e\u3002' }),
          table(['\u7f57\u9a6c\u6570\u5b57', '\u540d\u79f0', '\u8c03\u5f0f', 'C \u8c03\u5b9e\u4f8b', '\u64cd\u4f5c'], rows)
        ]));
      } else if (cur === 'cof') {
        var host = U.el('div', { class: 'cof-host', html: circleOfFifths() });
        body.appendChild(panel('\u4e94\u5ea6\u5708\uff08Circle of Fifths\uff09', [
          U.el('p', { class: 'ref-note', text: '\u987a\u65f6\u9488\u4e3a\u5347\u53f7\u65b9\u5411\uff08\u6bcf\u6b65\u5347\u4e94\u5ea6\uff09\uff0c\u9006\u65f6\u9488\u4e3a\u964d\u53f7\u65b9\u5411\u3002\u5916\u5708\u5927\u8c03\uff0c\u5185\u5708\u5bf9\u5e94\u5173\u7cfb\u5c0f\u8c03\uff0c\u6700\u5916\u4fa7\u4e3a\u8be5\u8c03\u7684\u8c03\u53f7\u3002' }),
          host
        ]));
      } else if (cur === 'keyboard') {
        var kbHost2 = U.el('div', { class: 'piano-host' });
        var info = U.el('div', { class: 'kb-info', text: '\u70b9\u51fb\u4efb\u610f\u952e\u8bd5\u542c' });
        body.appendChild(panel('\u4ea4\u4e92\u5f0f\u952e\u76d8', [
          U.el('p', { class: 'ref-note', text: '\u8303\u56f4\uff1aC3 \u2013 B5\u3002\u70b9\u51fb\u952e\u76d8\u53ef\u8bd5\u542c\u97f3\u9ad8\uff0c\u4fbf\u4e8e\u4e0e\u8c31\u9762\u97f3\u9ad8\u5bf9\u7167\u3002' }),
          kbHost2, info
        ]));
        Keyboard().render(kbHost2, {
          lo: 48, hi: 83,
          onPick: function (midi) {
            info.textContent = T.midiToName(midi, false).replace('#', SHARP) + ' \u00b7 ' +
              (T.SOLFEGE_FIXED[T.SHARP_NAMES[T.pcOf(midi)][0]] || '') + ' \u00b7 ' +
              T.midiToFreq(midi, WB.Store.getSettings().a4).toFixed(1) + ' Hz';
          }
        });
      }
    }
    render();
    return { destroy: function () { } };
  }

  WB.Ref = { mount: mount, Keyboard: Keyboard, circleOfFifths: circleOfFifths };
})(typeof window !== 'undefined' ? window : globalThis);
