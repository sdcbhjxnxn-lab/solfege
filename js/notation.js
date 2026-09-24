/* =============================================================================
 * notation.js  —  五线谱渲染（封装 VexFlow 4）
 * 单行谱表 renderStave / 多小节系统 renderSystem / 节奏谱 renderRhythm
 * 负责：拼写与临时升降号管理、符杠、小节线、跨小节复位
 * ========================================================================== */
(function (global) {
  'use strict';
  var WB = (global.WB = global.WB || {});
  var T = WB.Theory;

  function VF() {
    var V = global.Vex || global.VexFlow;
    if (!V) return null;
    return V.Flow || V;
  }
  function available() { return !!VF(); }

  var BEATS_MAP = {
    '4': { base: 'w', dots: 0 },
    '3': { base: 'h', dots: 1 },
    '2': { base: 'h', dots: 0 },
    '1.5': { base: 'q', dots: 1 },
    '1': { base: 'q', dots: 0 },
    '0.75': { base: '8', dots: 1 },
    '0.5': { base: '8', dots: 0 },
    '0.25': { base: '16', dots: 0 },
    '0.125': { base: '32', dots: 0 }
  };
  function beatsToDur(beats) { return BEATS_MAP[String(beats)] || { base: 'q', dots: 0 }; }

  // 调号中各字母的升降
  function keyAccidence(keySig) {
    var acc = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
    if (!keySig) return acc;
    var sharpOrder = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
    var flatOrder = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
    var sharpCount = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7 };
    var flatCount = { F: 1, Bb: 2, Eb: 3, Ab: 4, Db: 5, Gb: 6, Cb: 7 };
    var minorToMajor = { Am: 'C', Em: 'G', Bm: 'D', 'F#m': 'A', 'C#m': 'E', 'G#m': 'B', 'D#m': 'F#', 'A#m': 'C#', Dm: 'F', Gm: 'Bb', Cm: 'Eb', Fm: 'Ab', Bbm: 'Db', Ebm: 'Gb', Abm: 'Cb' };
    var name = minorToMajor[keySig] || keySig;
    var i, n;
    if (sharpCount[name] !== undefined) {
      n = sharpCount[name];
      for (i = 0; i < n; i++) acc[sharpOrder[i]] = 1;
    } else if (flatCount[name] !== undefined) {
      n = flatCount[name];
      for (i = 0; i < n; i++) acc[flatOrder[i]] = -1;
    }
    return acc;
  }

  /* --------------------- 单个音符构造（含临时记号） ---------------------- */
  function buildNote(F, ns, o) {
    var beats = ns.beats !== undefined ? ns.beats : 1;
    var d = beatsToDur(beats);
    var durStr = ns.rest ? d.base + 'r' : d.base;
    var key, sp = null;
    if (ns.rest) {
      key = o.clef === 'bass' ? 'd/3' : 'b/4';
    } else {
      sp = ns.spell || T.spellMidi(ns.midi, ns.key || o.key);
      key = T.spellToVexKey(Object.assign({}, sp, { octave: T.octaveOf(ns.midi) }));
    }
    var note = new F.StaveNote({ clef: o.clef, keys: [key], duration: durStr, auto_stem: o.stemUp === undefined });
    if (o.stemUp !== undefined && !ns.rest) note.setStemDirection(o.stemUp ? 1 : -1);
    if (d.dots > 0) { try { F.Dot.buildAndAttach([note], { all: true }); } catch (e) { /* noop */ } }
    if (!ns.rest && sp) {
      var stKey = sp.letter + T.octaveOf(ns.midi);
      var implied = o.state[stKey] !== undefined ? o.state[stKey] : (o.keyAcc[sp.letter] || 0);
      var want = sp.acc || 0;
      if (want !== implied) {
        var code = T.ACC_VEX[String(want)];
        note.addModifier(new F.Accidental(code === '' ? 'n' : code), 0);
        o.state[stKey] = want;
      }
    }
    return note;
  }

  function noteRange(notesList, clef) {
    var top = clef === 'bass' ? 57 : 77;
    var bottom = clef === 'bass' ? 43 : 64;
    var ms = [];
    notesList.forEach(function (ns) { if (!ns.rest && ns.midi != null) ms.push(ns.midi); });
    var maxMidi = ms.length ? Math.max.apply(null, ms) : top;
    var minMidi = ms.length ? Math.min.apply(null, ms) : bottom;
    return {
      top: top, bottom: bottom, maxMidi: maxMidi, minMidi: minMidi,
      above: Math.max(0, maxMidi - top),
      below: Math.max(0, bottom - minMidi)
    };
  }
  /* ---------------------------- 版面几何 ---------------------------------
   * VexFlow 的 Stave(x, y, w) 中 y 是「谱表框顶部」，第 0 条线并不在 y 上，
   * 而是位于 y + space_above_staff_ln × spacing（VexFlow 4 默认 4 × 10 = 40）。
   * 旧实现按「第 0 线 ≈ y」估算高度，于是谱表下半部、谱号下沿与音符全部落在
   * SVG 视口之外被裁掉（SVG 默认 overflow:hidden）。此处改为向 VexFlow 实测。
   * -------------------------------------------------------------------- */
  var GEO = null;
  var TOP_PAD = 12;      // 谱表上方留白（谱号上沿 / 高音加线）
  var BOTTOM_PAD = 30;   // 谱表下方留白（谱号下沿 / 低音加线 / 符干）

  function geo(F) {
    if (GEO) return GEO;
    var g = { top: 40, staff: 40, step: 5 };   // VexFlow 4 默认值兜底
    try {
      var probe = new F.Stave(0, 0, 200);
      var y0 = probe.getYForLine(0), y4 = probe.getYForLine(4);
      if (isFinite(y0) && isFinite(y4) && y4 > y0) {
        g.top = y0; g.staff = y4 - y0; g.step = (y4 - y0) / 8;   // 相邻音级 = 半个线间距
      }
    } catch (e) { /* 保留默认值 */ }
    GEO = g;
    return g;
  }
  function staveYOf(rng, F) {
    var g = geo(F);
    // 谱表框自身已在第 0 线上方预留 g.top，仅超出该余量的高音才需把谱表整体下移
    return TOP_PAD + Math.max(0, rng.above * g.step - (g.top - 8));
  }
  function layoutHeight(rng, spec, F) {
    var g = geo(F);
    var need = staveYOf(rng, F) + g.top + g.staff + rng.below * g.step + BOTTOM_PAD;
    // 显式 height 只作为下限参考，绝不小于实际所需高度，避免内容被裁
    return Math.ceil(Math.max((spec && spec.height) || 0, need));
  }

  /* ------------------------- 视口兜底校正 ---------------------------------
   * 渲染完成后按内容实际包围盒（getBBox）校正 SVG 视口，双保险确保不被裁切。
   * jsdom 未实现 getBBox，此处静默跳过，不影响离线测试。
   * -------------------------------------------------------------------- */
  function parseViewBox(svg) {
    var p = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    if (p.length === 4 && p.every(function (v) { return isFinite(v); })) {
      return { x: p[0], y: p[1], w: p[2], h: p[3] };
    }
    var w = parseFloat(svg.getAttribute('width')) || 0;
    var h = parseFloat(svg.getAttribute('height')) || 0;
    return (w > 0 && h > 0) ? { x: 0, y: 0, w: w, h: h } : null;
  }
  function fitSvgToContent(container) {
    var svg = container && container.querySelector ? container.querySelector('svg') : null;
    if (!svg || typeof svg.getBBox !== 'function') return;
    var bb;
    try { bb = svg.getBBox(); } catch (e) { return; }
    if (!bb || !isFinite(bb.width) || !isFinite(bb.height) || bb.height <= 0) return;
    var vb = parseViewBox(svg);
    if (!vb) return;
    var needW = Math.ceil(bb.x + bb.width + 6);
    var needH = Math.ceil(bb.y + bb.height + 6);
    if (needW <= vb.w && needH <= vb.h) return;
    var w = Math.max(vb.w, needW), h = Math.max(vb.h, needH);
    svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + w + ' ' + h);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
  }

  /* 多小节横向分配：保证每小节至少容得下自己的音符；若容器不够宽则整体加宽
     （由容器缩放 / 横向滚动承接），避免旧版「按容器宽度均分」把音符挤到谱表外。 */
  var MIN_NOTE_W = 26;   // 单个音符所需最小横向空间
  var MIN_BAR_W = 48;    // 每小节最小宽度（含小节线留白）
  function systemLayout(bars, firstExtra, availW) {
    var counts = bars.map(function (b) { return Math.max(1, b.length); });
    var totalNotes = counts.reduce(function (a, b) { return a + b; }, 0) || 1;
    var mins = counts.map(function (c) { return Math.max(MIN_BAR_W, c * MIN_NOTE_W + 12); });
    var minSum = mins.reduce(function (a, b) { return a + b; }, 0);
    var width = Math.ceil(Math.max(availW, minSum + firstExtra + 12));
    var contentW = width - firstExtra - 12;
    var surplus = Math.max(0, contentW - minSum);
    var widths = mins.map(function (m, i) { return m + surplus * counts[i] / totalNotes; });
    widths[0] += firstExtra;
    return { width: width, barWidths: widths };
  }

  /* ------------------------ 单谱表（单行音符） --------------------------- */
  function renderStave(container, spec) {
    if (!container) return null;
    container.innerHTML = '';
    var F = VF();
    if (!F) { container.innerHTML = '<div class="vex-missing">\u4e94\u7ebf\u8c31\u6e32\u67d3\u5e93\u672a\u52a0\u8f7d</div>'; return null; }
    spec = spec || {};
    var clef = spec.clef || 'treble';
    var notesSpec = spec.notes || [];
    var keySig = spec.keySig !== undefined ? spec.keySig : 'C';
    var timeSig = spec.timeSig !== undefined ? spec.timeSig : null;

    var rng = noteRange(notesSpec, clef);
    var staveY = staveYOf(rng, F);
    var height = layoutHeight(rng, spec, F);
    var width = spec.width || Math.max(container.clientWidth || 0, 260) - 4;

    var renderer = new F.Renderer(container, F.Renderer.Backends.SVG);
    renderer.resize(width, height);
    var ctx = renderer.getContext();
    if (spec.color) { ctx.setFillStyle(spec.color); ctx.setStrokeStyle(spec.color); }

    var stave = new F.Stave(0, staveY, width - 2);
    if (clef) stave.addClef(clef);
    if (keySig) stave.addKeySignature(keySig);
    if (timeSig) stave.addTimeSignature(timeSig);
    if (spec.endBar === 'end') stave.setEndBarType(F.Barline.type.END);
    stave.setContext(ctx).draw();

    if (!notesSpec.length) { fitSvgToContent(container); return { renderer: renderer, stave: stave, ctx: ctx, width: width, height: height }; }

    var keyAcc = keyAccidence(keySig);
    var state = {};
    var o = { clef: clef, key: spec.key, stemUp: spec.stemUp, state: state, keyAcc: keyAcc };
    var notes = [];
    notesSpec.forEach(function (ns) {
      try { notes.push(buildNote(F, ns, o)); } catch (e) { /* 单音失败忽略 */ }
      if (ns.barEnd) state = o.state = {};
    });

    var beams = [];
    try { beams = F.Beam.generateBeams(notes, { stem_direction: spec.stemUp ? 1 : undefined }); } catch (e) { beams = []; }

    var totalBeats = notesSpec.reduce(function (a, n) { return a + (n.beats || 1); }, 0);
    var voice = new F.Voice({ num_beats: Math.max(1, Math.round(totalBeats)), beat_value: 4 });
    voice.setStrict(false);
    voice.addTickables(notes);
    try {
      new F.Formatter().joinVoices([voice]).format([voice], Math.max(80, width - 120));
      voice.draw(ctx, stave);
      beams.forEach(function (b) { b.setContext(ctx).draw(); });
    } catch (e) {
      try { voice.draw(ctx, stave); } catch (e2) { /* noop */ }
    }
    fitSvgToContent(container);
    return { renderer: renderer, stave: stave, ctx: ctx, notes: notes, width: width, height: height };
  }

  /* ------------------------- 多小节系统（含小节线） ---------------------- */
  /**
   * spec.bars: [[noteSpec,...], ...]  每个元素为一个小节
   * 其余字段同 renderStave
   */
  function renderSystem(container, spec) {
    if (!container) return null;
    container.innerHTML = '';
    var F = VF();
    if (!F) { container.innerHTML = '<div class="vex-missing">\u4e94\u7ebf\u8c31\u6e32\u67d3\u5e93\u672a\u52a0\u8f7d</div>'; return null; }
    spec = spec || {};
    var clef = spec.clef || 'treble';
    var keySig = spec.keySig !== undefined ? spec.keySig : 'C';
    var timeSig = spec.timeSig || null;
    var bars = spec.bars || [];
    if (!bars.length) return renderStave(container, spec);
    if (bars.length === 1) {
      var single = Object.assign({}, spec);
      delete single.bars;
      single.notes = bars[0];
      return renderStave(container, single);
    }

    var flat = [];
    bars.forEach(function (b) { flat = flat.concat(b); });
    var rng = noteRange(flat, clef);
    var staveY = staveYOf(rng, F);
    var height = layoutHeight(rng, spec, F);

    // 首小节需预留谱号 / 调号 / 拍号空间
    var firstExtra = (clef ? 40 : 0) + (keySig ? 26 : 0) + (timeSig ? 34 : 0);
    var availW = spec.width || Math.max(container.clientWidth || 0, 320) - 4;
    var lay = systemLayout(bars, firstExtra, availW);
    var width = lay.width;
    var barWidths = lay.barWidths;
    var n = bars.length;

    var renderer = new F.Renderer(container, F.Renderer.Backends.SVG);
    renderer.resize(width, height);
    var ctx = renderer.getContext();
    if (spec.color) { ctx.setFillStyle(spec.color); ctx.setStrokeStyle(spec.color); }

    var keyAcc = keyAccidence(keySig);
    var x = 0;
    var allNotes = [];
    bars.forEach(function (barNotes, bi) {
      var w = barWidths[bi];
      var stave = new F.Stave(x, staveY, w);
      if (bi === 0) {
        if (clef) stave.addClef(clef);
        if (keySig) stave.addKeySignature(keySig);
        if (timeSig) stave.addTimeSignature(timeSig);
      }
      if (bi === n - 1 && spec.endBar !== false) stave.setEndBarType(F.Barline.type.END);
      stave.setContext(ctx).draw();

      var state = {};
      var o = { clef: clef, key: spec.key, stemUp: spec.stemUp, state: state, keyAcc: keyAcc };
      var notes = [];
      barNotes.forEach(function (ns) {
        try { notes.push(buildNote(F, ns, o)); } catch (e) { /* noop */ }
      });
      if (!notes.length) { x += w; return; }
      var beams = [];
      try { beams = F.Beam.generateBeams(notes, { stem_direction: spec.stemUp ? 1 : undefined }); } catch (e) { beams = []; }
      var totalBeats = barNotes.reduce(function (a, nn) { return a + (nn.beats || 1); }, 0);
      var voice = new F.Voice({ num_beats: Math.max(1, Math.round(totalBeats)), beat_value: 4 });
      voice.setStrict(false);
      voice.addTickables(notes);
      try {
        var fmtW = Math.max(50, w - firstExtra * (bi === 0 ? 1 : 0) - 14);
        new F.Formatter().joinVoices([voice]).format([voice], fmtW);
        voice.draw(ctx, stave);
        beams.forEach(function (b) { b.setContext(ctx).draw(); });
      } catch (e) {
        try { voice.draw(ctx, stave); } catch (e2) { /* noop */ }
      }
      allNotes = allNotes.concat(notes);
      x += w;
    });

    fitSvgToContent(container);
    return {
      renderer: renderer, ctx: ctx, width: width, height: height,
      staveY: staveY, barWidths: barWidths, notes: allNotes
    };
  }

  /* ------------------------------ 便捷函数 ------------------------------ */
  function renderMidiLine(container, midis, opts) {
    opts = opts || {};
    return renderStave(container, {
      clef: opts.clef || 'treble',
      keySig: opts.keySig !== undefined ? opts.keySig : null,
      timeSig: opts.timeSig,
      key: opts.key,
      notes: midis.map(function (m) { return { midi: m, beats: opts.beats || 1 }; }),
      width: opts.width, height: opts.height
    });
  }

  function renderRhythm(container, pattern, opts) {
    opts = opts || {};
    var clef = opts.clef || 'treble';
    // 节奏谱的音符统一落在谱表中间线上（高音谱表 B4 / 低音谱表 D3）。
    // 旧实现传 midi:null，spellMidi 会把音高算成 C-1，VexFlow 遂将音符头画到
    // 谱表下方约 200px 处并配 200px 长的符干 —— 全部落在 SVG 视口之外，
    // 用户看到的是「没有任何音符的空谱表」。
    var midi = opts.midi !== undefined ? opts.midi : (clef === 'bass' ? 50 : 71);
    var sp = T.spellMidi(midi, null);
    var notes = pattern.map(function (item, i) {
      var isRest = typeof item === 'object' && item !== null && item.r !== undefined;
      var beats = typeof item === 'number' ? item : (isRest ? item.r : item.d);
      return { midi: midi, spell: sp, beats: beats, rest: isRest, barEnd: i === pattern.length - 1 };
    });
    return renderStave(container, {
      clef: clef,
      keySig: null,
      timeSig: opts.timeSig || '4/4',
      notes: notes,
      width: opts.width,
      height: opts.height || 130,
      stemUp: opts.stemUp === undefined ? true : opts.stemUp
    });
  }

  WB.Notation = {
    available: available,
    VF: VF,
    renderStave: renderStave,
    renderSystem: renderSystem,
    renderMidiLine: renderMidiLine,
    renderRhythm: renderRhythm,
    beatsToDur: beatsToDur,
    keyAccidence: keyAccidence
  };
})(typeof window !== 'undefined' ? window : globalThis);
