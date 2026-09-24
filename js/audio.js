/* =============================================================================
 * audio.js  —  基于 Web Audio API 的合成音源引擎
 * 无需任何音频采样文件，全部实时合成，保证离线可运行
 * 提供：单音/和弦/音序/节奏点击播放、节拍器、多音色
 * ========================================================================== */
(function (global) {
  'use strict';
  var WB = (global.WB = global.WB || {});
  var T = WB.Theory;

  var ctx = null, inputGain = null, master = null, lp = null;
  var active = [];
  var settings = { instrument: 'piano', volume: 0.8, a4: 440 };

  /* 各音色的谐波结构（ratio, amplitude）与 ADSR 包络 */
  var VOICES = {
    sine: {
      label: '\u7eaf\u97f3（\u6b63\u5f26\u6ce2）',
      type: 'sine', detune: 0, lp: null,
      partials: [[1, 1]],
      a: 0.012, d: 0.02, s: 1.0, r: 0.10
    },
    piano: {
      label: '\u94a2\u7434\uff08\u5408\u6210\uff09',
      type: 'sine', detune: 0, lp: 4200,
      partials: [[1, 1], [2, 0.50], [3, 0.26], [4, 0.14], [5, 0.07], [6, 0.04]],
      a: 0.004, d: 1.7, s: 0.0, r: 0.14
    },
    epiano: {
      label: '\u7535\u94a2\u7434',
      type: 'sine', detune: 0, lp: 5200,
      partials: [[1, 1], [2, 0.42], [3, 0.20], [4, 0.12], [5, 0.06]],
      a: 0.005, d: 1.2, s: 0.10, r: 0.25
    },
    organ: {
      label: '\u7ba1\u98ce\u7434',
      type: 'sine', detune: 0, lp: 2600,
      partials: [[1, 1], [2, 0.55], [3, 0.32], [4, 0.18], [6, 0.08]],
      a: 0.020, d: 0.05, s: 0.85, r: 0.12
    },
    pluck: {
      label: '\u62e8\u5f26',
      type: 'sawtooth', detune: 0, lp: 3200,
      partials: [[1, 1], [2, 0.60], [3, 0.35], [4, 0.20], [5, 0.12]],
      a: 0.002, d: 0.50, s: 0.0, r: 0.10
    },
    bell: {
      label: '\u949f\u7434',
      type: 'sine', detune: 0, lp: 9000,
      partials: [[1, 1], [2.76, 0.45], [5.40, 0.18], [8.93, 0.06]],
      a: 0.001, d: 1.4, s: 0.0, r: 0.35
    },
    pad: {
      label: '\u5408\u6210\u57ab\uff08\u957f\u97f3\uff09',
      type: 'sawtooth', detune: 9, lp: 1600,
      partials: [[1, 1], [2, 0.35], [3, 0.20]],
      a: 0.30, d: 0.20, s: 0.80, r: 0.60
    }
  };

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    var AC = global.AudioContext || global.webkitAudioContext;
    ctx = new AC();
    inputGain = ctx.createGain();
    inputGain.gain.value = 1.0;
    lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 16000;
    master = ctx.createGain();
    master.gain.value = settings.volume;
    inputGain.connect(lp);
    lp.connect(master);
    // 轻度动态压缩，避免和弦叠加时削波
    if (ctx.createDynamicsCompressor) {
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 24;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.18;
      master.connect(comp);
      comp.connect(ctx.destination);
    } else {
      master.connect(ctx.destination);
    }
    return ctx;
  }

  function unlock() { ensure(); }
  function setVolume(v) {
    settings.volume = T.clamp(v, 0, 1);
    if (master) master.gain.setTargetAtTime(settings.volume, ctx.currentTime, 0.02);
  }
  function setA4(v) { settings.a4 = v > 0 ? v : 440; }
  function setInstrument(id) { if (VOICES[id]) settings.instrument = id; }
  function getSettings() { return settings; }
  function voiceList() { return Object.keys(VOICES).map(function (k) { return { id: k, label: VOICES[k].label }; }); }

  /* 单个音符：在 when 时刻发声，持续 dur 秒 */
  function playNote(midi, opts) {
    opts = opts || {};
    ensure();
    var when = opts.when !== undefined ? opts.when : ctx.currentTime + 0.05;
    var dur = opts.dur !== undefined ? opts.dur : 0.9;
    var vel = opts.velocity !== undefined ? opts.velocity : 0.85;
    var inst = VOICES[opts.instrument || settings.instrument] || VOICES.piano;
    var freq = T.midiToFreq(midi + (opts.octaveShift || 0) * 12, settings.a4);

    var filter = null;
    if (inst.lp) {
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = Math.min(inst.lp + freq * 1.2, 16000);
      filter.Q.value = 0.4;
      filter.connect(inputGain);
    }
    var sink = filter || inputGain;
    var ampScale = vel / Math.sqrt(inst.partials.length);

    inst.partials.forEach(function (p, idx) {
      var ratio = p[0], amp = p[1];
      var osc = ctx.createOscillator();
      osc.type = inst.type;
      osc.frequency.value = freq * ratio;
      if (inst.detune) osc.detune.value = (idx % 2 ? inst.detune : -inst.detune);
      var g = ctx.createGain();
      g.gain.value = 0.0001;
      var peak = amp * ampScale;
      var t0 = when;
      var tA = t0 + inst.a;
      var tD = tA + inst.d;
      var tRel = Math.max(t0 + dur, tA + 0.02);
      // ADSR
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), tA);
      var sustainLevel = Math.max(inst.s * peak, 0.0002);
      if (inst.d > 0.005) g.gain.exponentialRampToValueAtTime(sustainLevel, tD);
      if (tRel > tD) g.gain.setValueAtTime(sustainLevel, Math.max(tD, t0));
      g.gain.exponentialRampToValueAtTime(0.0001, tRel + inst.r);
      osc.connect(g);
      g.connect(sink);
      osc.start(t0);
      osc.stop(tRel + inst.r + 0.03);
      active.push({ osc: osc, g: g, end: tRel + inst.r + 0.03 });
    });
    return when;
  }

  function playChord(midis, opts) {
    opts = opts || {};
    var when = opts.when !== undefined ? opts.when : null;
    ensure();
    if (when === null) when = ctx.currentTime + 0.05;
    midis.forEach(function (m) { playNote(m, Object.assign({}, opts, { when: when })); });
    return when;
  }

  /* 音序：events = [{ midis:[..] | midi, at: 相对秒, dur, velocity }] */
  function playSequence(events, opts) {
    opts = opts || {};
    ensure();
    var base = ctx.currentTime + (opts.delay !== undefined ? opts.delay : 0.08);
    var end = 0;
    events.forEach(function (ev) {
      var midis = ev.midis || [ev.midi];
      var at = base + (ev.at || 0);
      var dur = ev.dur !== undefined ? ev.dur : 0.7;
      playChord(midis.filter(function (m) { return m !== null && m !== undefined; }), {
        when: at, dur: dur, velocity: ev.velocity !== undefined ? ev.velocity : (opts.velocity || 0.85),
        instrument: opts.instrument
      });
      end = Math.max(end, (ev.at || 0) + dur);
    });
    return { base: base, total: end };
  }

  /* 等间隔音符序列（用于音阶、音级模唱） */
  function playNoteList(midis, opts) {
    opts = opts || {};
    var noteDur = opts.noteDur !== undefined ? opts.noteDur : 0.55;
    var gap = opts.gap !== undefined ? opts.gap : 0.12;
    var events = midis.map(function (m, i) {
      return { midis: [m], at: i * (noteDur + gap), dur: noteDur };
    });
    return playSequence(events, opts);
  }

  /* 节拍器点击音 */
  function playClick(when, accent) {
    ensure();
    var t0 = when !== undefined ? when : ctx.currentTime + 0.05;
    var osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = accent ? 1800 : 1200;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.13, t0 + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
    osc.connect(g); g.connect(inputGain);
    osc.start(t0); osc.stop(t0 + 0.08);
    active.push({ osc: osc, g: g, end: t0 + 0.08 });
    return t0;
  }

  function stopAll() {
    if (!ctx) return;
    var now = ctx.currentTime;
    active.forEach(function (item) {
      try {
        item.g.gain.cancelScheduledValues(now);
        item.g.gain.setTargetAtTime(0.0001, now, 0.015);
        item.osc.stop(now + 0.08);
      } catch (e) { /* 已结束的节点忽略 */ }
    });
    active = [];
  }

  function currentTime() { ensure(); return ctx.currentTime; }
  function getContext() { return ensure(); }

  WB.Audio = {
    ensure: ensure,
    unlock: unlock,
    setVolume: setVolume,
    setA4: setA4,
    setInstrument: setInstrument,
    getSettings: getSettings,
    voiceList: voiceList,
    playNote: playNote,
    playChord: playChord,
    playSequence: playSequence,
    playNoteList: playNoteList,
    playClick: playClick,
    stopAll: stopAll,
    currentTime: currentTime,
    getContext: getContext
  };
})(typeof window !== 'undefined' ? window : globalThis);
