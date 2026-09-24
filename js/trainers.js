/* =============================================================================
 * trainers.js  —  练耳题型生成器 + 通用答题引擎
 * 题型：单音 / 音高比较 / 音程 / 和弦 / 音阶调式 / 和声进行 / 音级 / 节奏 / 旋律
 * 内容分层依据：中央音乐学院视唱练耳分级（一级~五级）与艺考大纲
 * ========================================================================== */
(function (global) {
  'use strict';
  var WB = (global.WB = global.WB || {});
  var T = WB.Theory;
  var A = WB.Audio;
  var N = WB.Notation;
  var S = WB.Store;
  var U = WB.UI;
  var I = WB.Icons;

  var SHARP = '\u266f', FLAT = '\u266d';
  var LEVELS = ['easy', 'medium', 'hard'];
  var LEVEL_CN = { easy: '\u521d\u7ea7', medium: '\u4e2d\u7ea7', hard: '\u9ad8\u7ea7' };

  function noteName(midi) {
    return T.SHARP_NAMES[T.pcOf(midi)].replace('#', SHARP) + T.octaveOf(midi);
  }
  function chromLabel(pc) {
    var s = T.SHARP_NAMES[pc].replace('#', SHARP);
    var f = T.FLAT_NAMES[pc].replace('b', FLAT);
    return s === f ? s : (s + ' / ' + f);
  }
  function midisWithPc(pc, lo, hi) {
    var out = [];
    for (var m = lo; m <= hi; m++) if (T.pcOf(m) === pc) out.push(m);
    return out.length ? out : [lo + T.mod(pc - lo, 12)];
  }

  /* --------------------------- 题型元数据 ------------------------------- */
  var META = [
    {
      id: 'single', name: '\u5355\u97f3\u542c\u8fa8', icon: 'notes', levels: LEVELS,
      brief: '\u64ad\u653e\u4e00\u4e2a\u5355\u97f3\uff0c\u5224\u65ad\u5176\u97f3\u540d\uff08\u542b\u53c2\u8003\u97f3 a1\uff09',
      full: '\u4ee5\u6807\u51c6\u97f3 a1\uff08A4=440Hz\uff09\u4e3a\u53c2\u8003\uff0c\u64ad\u653e\u4e00\u4e2a\u5355\u97f3\u540e\u5224\u65ad\u97f3\u540d\u3002\u521d\u7ea7\u9650\u81ea\u7136\u97f3\u7ea7\uff0c\u4e2d\u9ad8\u7ea7\u52a0\u5165\u5347\u964d\u97f3\u5e76\u6269\u5927\u97f3\u57df\u3002'
    },
    {
      id: 'compare', name: '\u97f3\u9ad8\u6bd4\u8f83', icon: 'updown', levels: LEVELS,
      brief: '\u5148\u540e\u64ad\u653e\u4e24\u4e2a\u97f3\uff0c\u5224\u65ad\u54ea\u4e2a\u66f4\u9ad8',
      full: '\u5148\u540e\u64ad\u653e\u4e24\u4e2a\u97f3\uff0c\u5224\u65ad\u97f3\u9ad8\u5173\u7cfb\u3002\u9ad8\u7ea7\u52a0\u5165\u540c\u97f3\u540d\u4e0d\u540c\u516b\u5ea6\u7684\u5e72\u6270\u9879\u3002'
    },
    {
      id: 'interval', name: '\u97f3\u7a0b\u542c\u8fa8', icon: 'interval', levels: LEVELS,
      brief: '\u542c\u8fa8\u4e24\u97f3\u4e4b\u95f4\u7684\u97f3\u7a0b',
      full: '\u521d\u7ea7\u9650\u5927\u5c0f\u4e8c\u5ea6\u3001\u5927\u5c0f\u4e09\u5ea6\u3001\u7eaf\u56db\u5ea6\u3001\u7eaf\u4e94\u5ea6\u3001\u7eaf\u516b\u5ea6\uff1b\u4e2d\u9ad8\u7ea7\u6269\u5c55\u81f3\u5168\u90e8\u81ea\u7136\u97f3\u7a0b\u3001\u542b\u4e0a\u884c\u4e0e\u4e0b\u884c\u3001\u548c\u58f0\u97f3\u7a0b\u3002'
    },
    {
      id: 'chord', name: '\u548c\u5f26\u542c\u8fa8', icon: 'chord', levels: LEVELS,
      brief: '\u542c\u8fa8\u4e09\u548c\u5f26\u4e0e\u4e03\u548c\u5f26\u7684\u6027\u8d28\u4e0e\u8f6c\u4f4d',
      full: '\u521d\u7ea7\u9650\u539f\u4f4d\u5927\u4e09\u548c\u5f26\u4e0e\u5c0f\u4e09\u548c\u5f26\uff1b\u4e2d\u7ea7\u52a0\u5165\u589e\u3001\u51cf\u4e09\u548c\u5f26\uff1b\u9ad8\u7ea7\u52a0\u5165\u56db\u79cd\u4e03\u548c\u5f26\u53ca\u8f6c\u4f4d\u542c\u8fa8\u3002'
    },
    {
      id: 'scale', name: '\u97f3\u9636\u8c03\u5f0f\u542c\u8fa8', icon: 'scale', levels: LEVELS,
      brief: '\u542c\u8fa8\u5927\u5c0f\u8c03\u4e0e\u5404\u7c7b\u8c03\u5f0f\u97f3\u9636',
      full: '\u521d\u7ea7\u9650\u81ea\u7136\u5927\u8c03\u4e0e\u81ea\u7136\u5c0f\u8c03\uff1b\u4e2d\u7ea7\u52a0\u5165\u548c\u58f0\u3001\u65cb\u5f8b\u5c0f\u8c03\u4e0e\u4e94\u58f0\u8c03\u5f0f\uff1b\u9ad8\u7ea7\u52a0\u5165\u4e2d\u53e4\u8c03\u5f0f\u3001\u5e03\u9c81\u65af\u4e0e\u5168\u97f3\u97f3\u9636\u3002'
    },
    {
      id: 'progression', name: '\u548c\u58f0\u8fdb\u884c\u542c\u8fa8', icon: 'progression', levels: LEVELS,
      brief: '\u542c\u8fa8\u8c03\u5185\u548c\u5f26\u7684\u7f57\u9a6c\u6570\u5b57\u8fdb\u884c',
      full: '\u5148\u64ad\u653e\u4e3b\u4e09\u548c\u5f26\u786e\u7acb\u8c03\u6027\uff0c\u518d\u64ad\u653e\u548c\u5f26\u8fdb\u884c\uff0c\u5224\u65ad\u7f57\u9a6c\u6570\u5b57\u5e8f\u5217\u3002\u9ad8\u7ea7\u52a0\u5165\u5c0f\u8c03\u4e0e\u4e03\u548c\u5f26\u3002'
    },
    {
      id: 'degree', name: '\u97f3\u7ea7\u542c\u8fa8', icon: 'degree', levels: LEVELS,
      brief: '\u5728\u7ed9\u5b9a\u8c03\u6027\u4e2d\u542c\u8fa8\u5355\u97f3\u7684\u97f3\u7ea7\uff08\u9996\u8c03\u5531\u540d\uff09',
      full: '\u5148\u64ad\u653e\u4e3b\u4e09\u548c\u5f26\u786e\u7acb\u8c03\u6027\uff0c\u518d\u64ad\u653e\u5355\u97f3\uff0c\u5224\u65ad\u5176\u5728\u8c03\u5185\u7684\u7ea7\u6570\u4e0e\u5531\u540d\u3002'
    },
    {
      id: 'rhythm', name: '\u8282\u594f\u542c\u8fa8', icon: 'rhythm', levels: LEVELS,
      brief: '\u542c\u8fa8\u4e00\u5c0f\u8282\u8282\u594f\u578b\uff0c\u4ece\u4e94\u7ebf\u8c31\u4e2d\u9009\u51fa\u6b63\u786e\u9879',
      full: '\u5148\u7ed9\u51fa\u56db\u62cd\u9884\u5907\uff0c\u518d\u64ad\u653e\u8282\u594f\u3002\u521d\u7ea7\u9650\u56db\u5206\u4e0e\u4e8c\u5206\u97f3\u7b26\uff1b\u4e2d\u7ea7\u52a0\u5165\u516b\u5206\u97f3\u7b26\u3001\u9644\u70b9\u4e0e 3/4 \u62cd\uff1b\u9ad8\u7ea7\u52a0\u5165\u5341\u516d\u5206\u97f3\u7b26\u3001\u4f11\u6b62\u4e0e\u5207\u5206\u3002'
    },
    {
      id: 'melody', name: '\u65cb\u5f8b\u542c\u8fa8', icon: 'melody', levels: LEVELS,
      brief: '\u542c\u8fa8\u7b49\u65f6\u503c\u97f3\u7ec4\uff08\u4e09\u97f3\u7ec4 / \u56db\u97f3\u7ec4 / \u4e94\u97f3\u7ec4\uff09',
      full: '\u5148\u64ad\u653e\u4e3b\u4e09\u548c\u5f26\u786e\u7acb\u8c03\u6027\uff0c\u518d\u64ad\u653e\u7b49\u65f6\u503c\u97f3\u7ec4\uff0c\u4ece\u4e94\u7ebf\u8c31\u9009\u51fa\u6b63\u786e\u65cb\u5f8b\u3002\u5bf9\u5e94\u592e\u97f3\u5206\u7ea7\u7684\u201c\u4e09\u97f3\u7ec4\u201d\u201c\u56db\u97f3\u7ec4\u201d\u201c\u4e94\u97f3\u7ec4\u201d\u6a21\u5531\u3002'
    }
  ];
  var META_BY_ID = {};
  META.forEach(function (m) { META_BY_ID[m.id] = m; });

  /* =========================================================================
   *                              题型生成器
   * ====================================================================== */
  var GEN = {};

  /* --------------------------- 1. 单音听辨 ------------------------------ */
  GEN.single = function (level) {
    var cfg = {
      easy: { lo: 60, hi: 71, pcs: [0, 2, 4, 5, 7, 9, 11], ref: true },
      medium: { lo: 60, hi: 76, pcs: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], ref: true },
      hard: { lo: 55, hi: 79, pcs: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], ref: true }
    }[level];
    var pc = U.pick(cfg.pcs);
    var midi = U.pick(midisWithPc(pc, cfg.lo, cfg.hi));
    var optionPcs = level === 'easy' ? [0, 2, 4, 5, 7, 9, 11] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    var options = optionPcs.map(function (p) {
      return { value: String(p), label: level === 'easy' ? T.SHARP_NAMES[p] : chromLabel(p) };
    });
    return {
      type: 'single', level: level,
      prompt: '\u8bf7\u5224\u65ad\u64ad\u653e\u97f3\u7684\u97f3\u540d',
      hint: '\u53c2\u8003\u97f3\uff1a\u6807\u51c6\u97f3 a1\uff08A4 = ' + S.getSettings().a4 + 'Hz\uff09\uff0c\u64ad\u653e\u987a\u5e8f\u4e3a\u300c\u53c2\u8003\u97f3 \u2192 \u76ee\u6807\u97f3\u300d',
      options: options,
      answer: String(pc),
      answerLabel: chromLabel(pc),
      detail: '\u76ee\u6807\u97f3\u4e3a ' + noteName(midi) + '\uff08' + chromLabel(pc) + '\uff09\uff0c\u97f3\u57df ' +
        noteName(cfg.lo) + '\u2013' + noteName(cfg.hi) + '\u3002',
      duration: 2.0,
      payload: { midi: midi, ref: cfg.ref },
      play: function () {
        A.stopAll();
        var ev = [];
        if (cfg.ref) {
          ev.push({ midis: [69], at: 0, dur: 0.7, velocity: 0.75 });
          ev.push({ midis: [midi], at: 1.05, dur: 1.0, velocity: 0.9 });
        } else {
          ev.push({ midis: [midi], at: 0, dur: 1.0 });
        }
        A.playSequence(ev);
        return ev[ev.length - 1].at + ev[ev.length - 1].dur;
      }
    };
  };

  /* --------------------------- 2. 音高比较 ------------------------------ */
  GEN.compare = function (level) {
    var cfg = { easy: { min: 3, same: 0 }, medium: { min: 1, same: 0.12 }, hard: { min: 1, same: 0.18 } }[level];
    var lo = 57, hi = 76;
    var n1 = U.randInt(lo, hi);
    var isSame = Math.random() < cfg.same;
    var n2;
    if (isSame) n2 = n1;
    else {
      var span = level === 'easy' ? 12 : (level === 'medium' ? 15 : 20);
      var dir = Math.random() < 0.5 ? -1 : 1;
      var delta = U.randInt(cfg.min, span) * dir;
      n2 = n1 + delta;
      // 高级：同音名不同八度作为干扰
      if (level === 'hard' && Math.random() < 0.25) {
        n2 = n1 + (dir > 0 ? 12 : -12);
      }
      if (n2 < lo - 6) n2 = n1 + Math.abs(delta);
      if (n2 > hi + 8) n2 = n1 - Math.abs(delta);
    }
    var relation = n2 > n1 ? 'second' : (n2 < n1 ? 'first' : 'same');
    var labels = { first: '\u7b2c\u4e00\u4e2a\u97f3\u66f4\u9ad8', second: '\u7b2c\u4e8c\u4e2a\u97f3\u66f4\u9ad8', same: '\u4e24\u4e2a\u97f3\u97f3\u9ad8\u76f8\u540c' };
    return {
      type: 'compare', level: level,
      prompt: '\u6bd4\u8f83\u4e24\u4e2a\u97f3\u7684\u9ad8\u4f4e',
      hint: '\u4e24\u4e2a\u97f3\u4f9d\u6b21\u64ad\u653e\uff0c\u8bf7\u5224\u65ad\u97f3\u9ad8\u5173\u7cfb',
      options: ['first', 'second', 'same'].map(function (v) { return { value: v, label: labels[v] }; }),
      answer: relation,
      answerLabel: labels[relation],
      detail: '\u7b2c\u4e00\u4e2a\u97f3 ' + noteName(n1) + '\uff0c\u7b2c\u4e8c\u4e2a\u97f3 ' + noteName(n2) +
        '\uff0c\u76f8\u5dee ' + Math.abs(n2 - n1) + ' \u4e2a\u534a\u97f3\u3002',
      duration: 2.1,
      payload: { n1: n1, n2: n2 },
      play: function () {
        A.stopAll();
        A.playSequence([
          { midis: [n1], at: 0, dur: 0.8 },
          { midis: [n2], at: 1.05, dur: 0.8 }
        ]);
        return 1.85;
      }
    };
  };

  /* --------------------------- 3. 音程听辨 ------------------------------ */
  var INTERVAL_SETS = {
    easy: ['m2', 'M2', 'm3', 'M3', 'P4', 'P5', 'P8'],
    medium: ['m2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'],
    hard: ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8']
  };
  GEN.interval = function (level) {
    var set = INTERVAL_SETS[level];
    var id = U.pick(set);
    var iv = T.intervalById(id);
    var dirs = level === 'easy' ? ['up'] : ['up', 'down'];
    var dir = U.pick(dirs);
    var harmonic = level === 'hard' && Math.random() < 0.4;
    var ascend = dir === 'up';
    var root = ascend ? U.randInt(56, level === 'easy' ? 67 : 70) : U.randInt(level === 'easy' ? 70 : 69, 81);
    var second = ascend ? root + iv.semis : root - iv.semis;
    var detail = noteName(root) + (ascend ? ' \u2191 ' : ' \u2193 ') + noteName(second) + '\uff0c' + iv.cn +
      '\uff08' + iv.semis + ' \u4e2a\u534a\u97f3\uff09' + (harmonic ? '\uff0c\u548c\u58f0\u5f62\u5f0f' : '\uff0c\u65cb\u5f8b\u5f62\u5f0f');
    return {
      type: 'interval', level: level,
      prompt: '\u8bf7\u542c\u8fa8\u97f3\u7a0b',
      hint: (harmonic ? '\u548c\u58f0\u97f3\u7a0b\uff08\u4e24\u97f3\u540c\u65f6\u9e23\u54cd\uff09' : '\u65cb\u5f8b\u97f3\u7a0b\uff08\u4e24\u97f3\u4f9d\u6b21\u9e23\u54cd\uff09') +
        (level === 'easy' ? '' : '\uff0c\u65b9\u5411\u968f\u673a'),
      options: U.shuffle(set.map(function (s) {
        var x = T.intervalById(s);
        return { value: s, label: x.cn, sub: x.abbr + ' \u00b7 ' + x.semis + '\u534a\u97f3' };
      })),
      answer: id,
      answerLabel: iv.cn,
      detail: detail + '\u3002\u542c\u611f\uff1a' + iv.feel + '\uff1b\u53c2\u8003\uff1a' + iv.refUp,
      duration: harmonic ? 1.3 : 2.0,
      payload: { root: root, semis: iv.semis, ascend: ascend, harmonic: harmonic },
      play: function () {
        A.stopAll();
        if (harmonic) {
          A.playChord([root, second], { dur: 1.3 });
          return 1.3;
        }
        A.playSequence([
          { midis: [root], at: 0, dur: 0.8 },
          { midis: [second], at: 0.95, dur: 0.8 }
        ]);
        return 1.75;
      }
    };
  };

  /* --------------------------- 4. 和弦听辨 ------------------------------ */
  var CHORD_SETS = {
    easy: ['maj', 'min'],
    medium: ['maj', 'min', 'dim', 'aug'],
    hard: ['maj', 'min', 'dim', 'aug', 'maj7', 'dom7', 'min7', 'm7b5', 'dim7']
  };
  GEN.chord = function (level) {
    var pool = CHORD_SETS[level];
    var typeId = U.pick(pool);
    var chord = T.CHORD_BY_ID[typeId];
    var isTriad = chord.intervals.length === 3;
    var inversion = 0;
    if (level === 'hard' && Math.random() < 0.45) {
      inversion = isTriad ? U.randInt(1, 2) : U.randInt(1, 3);
    }
    var rootMidi = U.randInt(53, level === 'easy' ? 62 : 60);
    var midis = T.chordNotes(rootMidi, chord, inversion);

    // 高级：约 1/3 的题目改问转位
    if (level === 'hard' && isTriad && Math.random() < 0.3) {
      inversion = U.randInt(0, 2);
      midis = T.chordNotes(rootMidi, chord, inversion);
      var invLabels = ['\u539f\u4f4d', '\u7b2c\u4e00\u8f6c\u4f4d', '\u7b2c\u4e8c\u8f6c\u4f4d'];
      var invDetail = '\u8be5\u548c\u5f26\u4e3a ' + chord.cn + '\uff0c\u4f4e\u97f3\u4e3a ' + noteName(midis[0]) +
        '\uff0c\u4e3a' + invLabels[inversion] + '\u5f62\u5f0f\u3002';
      return {
        type: 'chord', level: level,
        prompt: '\u8bf7\u542c\u8fa8\u548c\u5f26\u7684\u8f6c\u4f4d\u5f62\u5f0f',
        hint: '\u5148\u786e\u8ba4\u4f4e\u97f3\u4e0e\u6839\u97f3\u7684\u5173\u7cfb',
        options: [0, 1, 2].map(function (v) { return { value: String(v), label: invLabels[v] }; }),
        answer: String(inversion),
        answerLabel: invLabels[inversion],
        detail: invDetail,
        duration: 1.5,
        payload: { rootMidi: rootMidi, typeId: typeId, inversion: inversion },
        play: function () { A.stopAll(); A.playChord(midis, { dur: 1.5 }); return 1.5; }
      };
    }

    var invTxt = isTriad ? ['\u539f\u4f4d', '\u7b2c\u4e00\u8f6c\u4f4d', '\u7b2c\u4e8c\u8f6c\u4f4d'][inversion]
      : ['\u539f\u4f4d', '\u7b2c\u4e00\u8f6c\u4f4d', '\u7b2c\u4e8c\u8f6c\u4f4d', '\u7b2c\u4e09\u8f6c\u4f4d'][inversion];
    var tonesTxt = midis.map(function (m) { return noteName(m); }).join(' - ');
    return {
      type: 'chord', level: level,
      prompt: '\u8bf7\u542c\u8fa8\u548c\u5f26\u7684\u6027\u8d28',
      hint: '\u5173\u6ce8\u548c\u5f26\u7684\u8272\u5f69\uff08\u660e\u4eae / \u6697\u6de1 / \u7d27\u5f20\uff09',
      options: U.shuffle(pool.map(function (c) {
        var x = T.CHORD_BY_ID[c];
        return { value: c, label: x.cn, sub: '\u6839\u97f3+' + (x.intervals.length === 3 ? '\u4e09\u5ea6\u53e0\u7f6e' : '\u4e03\u5ea6\u53e0\u7f6e') };
      })),
      answer: typeId,
      answerLabel: chord.cn,
      detail: '\u8be5\u548c\u5f26\u4e3a ' + chord.cn + '\uff08' + invTxt + '\uff09\uff0c\u6784\u6210\u97f3\uff1a' + tonesTxt,
      duration: 1.5,
      payload: { rootMidi: rootMidi, typeId: typeId, inversion: inversion },
      play: function () { A.stopAll(); A.playChord(midis, { dur: 1.5 }); return 1.5; }
    };
  };

  /* --------------------------- 5. 音阶调式听辨 --------------------------- */
  var SCALE_SETS = {
    easy: ['major', 'naturalMinor'],
    medium: ['major', 'naturalMinor', 'harmonicMinor', 'melodicMinor', 'pentatonicMajor', 'pentatonicMinor'],
    hard: ['major', 'naturalMinor', 'harmonicMinor', 'melodicMinor', 'dorian', 'phrygian', 'lydian',
      'mixolydian', 'locrian', 'pentatonicMajor', 'pentatonicMinor', 'blues', 'wholeTone']
  };
  GEN.scale = function (level) {
    var pool = SCALE_SETS[level];
    var id = U.pick(pool);
    var scale = T.SCALE_BY_ID[id];
    var rootMidi = U.randInt(55, 62);
    var up = scale.intervals.map(function (iv) { return rootMidi + iv; });
    var notes = up.concat([rootMidi + 12]).concat(up.slice(0, -1).reverse());
    return {
      type: 'scale', level: level,
      prompt: '\u8bf7\u542c\u8fa8\u97f3\u9636\uff08\u8c03\u5f0f\uff09',
      hint: '\u4e0a\u884c\u4e0e\u4e0b\u884c\u5b8c\u6574\u64ad\u653e\uff0c\u6ce8\u610f\u534a\u97f3\u4f4d\u7f6e\u4e0e\u7279\u5f81\u97f3',
      options: U.shuffle(pool.map(function (s) {
        var x = T.SCALE_BY_ID[s];
        return { value: s, label: x.cn, sub: x.intervals.length + ' \u4e2a\u97f3\u7ea7' };
      })),
      answer: id,
      answerLabel: scale.cn,
      detail: '\u8be5\u97f3\u9636\u4e3a ' + scale.cn + '\uff0c\u8d77\u97f3 ' + noteName(rootMidi) +
        '\uff0c\u97f3\u7ea7\u95f4\u9694\uff1a' + scale.intervals.join(' - '),
      duration: notes.length * 0.34 + 0.5,
      payload: { rootMidi: rootMidi, scaleId: id },
      play: function () {
        A.stopAll();
        A.playNoteList(notes, { noteDur: 0.3, gap: 0.04 });
        return notes.length * 0.34;
      }
    };
  };

  /* --------------------------- 6. 和声进行听辨 -------------------------- */
  var PROG_SETS = {
    easy: ['I-IV-V-I', 'I-V-vi-IV', 'I-vi-IV-V', 'vi-IV-I-V'],
    medium: ['I-IV-V-I', 'I-V-vi-IV', 'I-vi-IV-V', 'vi-IV-I-V', 'I-IV-I-V', 'ii-V-I', 'I-iii-IV-V', 'IV-V-iii-vi'],
    hard: ['I-IV-V-I', 'I-V-vi-IV', 'ii-V-I', 'I-iii-IV-V', 'IV-V-iii-vi', 'i-VI-III-VII', 'i-iv-v-i', 'i-VII-VI-VII']
  };
  GEN.progression = function (level) {
    var pool = PROG_SETS[level];
    var id = U.pick(pool);
    var prog = T.PROGRESSION_BY_ID[id];
    var isMinor = prog.mode === 'minor';
    var keyName = isMinor
      ? U.pick(['A', 'E', 'D', 'G', 'C', 'B', 'F#'].concat(level === 'hard' ? ['F', 'Bb'] : []))
      : U.pick(['C', 'G', 'D', 'F', 'Bb', 'A', 'E'].concat(level === 'hard' ? ['Eb', 'Ab'] : []));
    var key = T.buildKey(keyName + (isMinor ? 'm' : ''));
    var chords = T.progressionChords(key, prog.numerals, 4);
    var tonic = T.chordNotes(60 + key.tonicPc, T.CHORD_BY_ID[key.mode === 'minor' ? 'min' : 'maj'], 0);
    var chordNames = chords.map(function (c, i) { return prog.numerals[i] + '\uff08' + noteName(c[0]) + '\uff09'; }).join('\u3001');
    return {
      type: 'progression', level: level,
      prompt: '\u8bf7\u542c\u8fa8\u548c\u58f0\u8fdb\u884c\u7684\u7f57\u9a6c\u6570\u5b57',
      hint: '\u8c03\u6027\uff1a' + key.name + '\uff08\u5df2\u5148\u64ad\u653e\u4e3b\u4e09\u548c\u5f26\uff09',
      options: U.shuffle(pool.map(function (p) {
        var x = T.PROGRESSION_BY_ID[p];
        return { value: p, label: x.numerals.join(' - '), sub: x.cn };
      })),
      answer: id,
      answerLabel: prog.numerals.join(' - '),
      detail: '\u8c03\u6027 ' + key.name + '\uff0c\u8fdb\u884c\u4e3a ' + prog.numerals.join(' - ') +
        '\uff08' + prog.cn + '\uff09\uff0c\u5177\u4f53\u548c\u5f26\uff1a' + chordNames,
      duration: 1.1 + chords.length * 0.95,
      payload: { keyName: key.shortName, numerals: prog.numerals },
      play: function () {
        A.stopAll();
        var ev = [{ midis: tonic, at: 0, dur: 1.0, velocity: 0.7 }];
        chords.forEach(function (c, i) {
          ev.push({ midis: c, at: 1.15 + i * 0.95, dur: 0.85, velocity: 0.85 });
        });
        A.playSequence(ev);
        return 1.15 + chords.length * 0.95;
      }
    };
  };

  /* --------------------------- 7. 音级听辨 ------------------------------ */
  GEN.degree = function (level) {
    var cfg = {
      easy: { degrees: [0, 2, 4], alt: [] },
      medium: { degrees: [0, 1, 2, 3, 4, 5, 6], alt: [] },
      hard: { degrees: [0, 1, 2, 3, 4, 5, 6], alt: [3] }
    }[level];
    var keyName = level === 'easy' ? 'C' : U.pick(['C', 'G', 'D', 'F', 'Bb', 'A', 'E']);
    if (level === 'hard' && Math.random() < 0.4) keyName = U.pick(['A', 'E', 'D', 'G', 'C']) + 'm';
    var key = T.buildKey(keyName);
    var scale = key.intervals;
    var base = 60 + key.tonicPc;
    var deg = U.pick(cfg.degrees);
    var alt = cfg.alt.length && Math.random() < 0.4 ? U.pick(cfg.alt) : -1;
    var midi = base + scale[deg] + (alt >= 0 ? 1 : 0);
    var tonicTriad = [base, base + scale[2], base + scale[4]];

    var sol = T.SOLFEGE_DEGREE[deg];
    var answerLabel = sol + (alt >= 0 ? ' (\u5347' + T.SOLFEGE_DEGREE[alt] + ')' : '');
    var options;
    if (level === 'easy') {
      options = cfg.degrees.map(function (d) {
        return { value: String(d), label: T.SOLFEGE_DEGREE[d], sub: '\u7b2c ' + (d + 1) + ' \u7ea7' };
      });
    } else if (level === 'medium') {
      options = cfg.degrees.map(function (d) {
        return { value: String(d), label: T.SOLFEGE_DEGREE[d], sub: '\u7b2c ' + (d + 1) + ' \u7ea7' };
      });
    } else {
      options = cfg.degrees.map(function (d) {
        return { value: String(d), label: T.SOLFEGE_DEGREE[d], sub: '\u7b2c ' + (d + 1) + ' \u7ea7' };
      });
      options.push({ value: '3+', label: '\u5347fa', sub: '\u5347\u7b2c 4 \u7ea7' }, { value: '4+', label: '\u5347sol', sub: '\u5347\u7b2c 5 \u7ea7' });
    }
    var answerValue = alt >= 0 ? String(alt) + '+' : String(deg);
    return {
      type: 'degree', level: level,
      prompt: '\u8bf7\u5224\u65ad\u8be5\u97f3\u5728\u8c03\u5185\u7684\u97f3\u7ea7\uff08\u9996\u8c03\u5531\u540d\uff09',
      hint: '\u8c03\u6027\uff1a' + key.name + '\uff08\u5df2\u5148\u64ad\u653e\u4e3b\u4e09\u548c\u5f26\uff09',
      options: U.shuffle(options),
      answer: answerValue,
      answerLabel: answerLabel,
      detail: '\u8be5\u97f3\u4e3a ' + noteName(midi) + '\uff0c\u5728 ' + key.name + '\u4e2d\u4e3a\u9996\u8c03\u5531\u540d\u300c' + answerLabel + '\u300d\u3002',
      duration: 2.4,
      payload: { keyName: key.shortName, deg: deg, alt: alt >= 0 ? 1 : 0 },
      play: function () {
        A.stopAll();
        A.playSequence([
          { midis: tonicTriad, at: 0, dur: 1.0, velocity: 0.7 },
          { midis: [midi], at: 1.25, dur: 1.0, velocity: 0.9 }
        ]);
        return 2.25;
      }
    };
  };

  /* --------------------------- 8. 节奏听辨 ------------------------------ */
  function rhythmPool(level) {
    var pool = T.RHYTHM_PATTERNS[level].slice();
    var out = pool.map(function (p) { return { timeSig: '4/4', pattern: p }; });
    if (level !== 'easy') {
      T.RHYTHM_PATTERNS_34[level].forEach(function (p) { out.push({ timeSig: '3/4', pattern: p }); });
    }
    return out;
  }
  function sigOf(item) { return item.timeSig + '|' + JSON.stringify(item.pattern); }

  GEN.rhythm = function (level) {
    var pool = rhythmPool(level);
    var correct = U.pick(pool);
    var distractors = [];
    var guard = 0;
    while (distractors.length < 3 && guard++ < 200) {
      var cand = U.pick(pool);
      if (sigOf(cand) === sigOf(correct)) continue;
      if (distractors.some(function (d) { return sigOf(d) === sigOf(cand); })) continue;
      distractors.push(cand);
    }
    var options = U.shuffle([correct].concat(distractors));
    var ev = [];
    var beatsPerBar = parseInt(correct.timeSig.split('/')[0], 10);
    // 预备拍：2 小节（或 1 小节）
    var countIn = beatsPerBar * 2;
    for (var i = 0; i < countIn; i++) {
      ev.push({ click: true, at: i * 0.55, accent: i % beatsPerBar === 0 });
    }
    var events = T.patternToEvents(correct.pattern);
    events.forEach(function (e) {
      if (e.rest) return;
      ev.push({ click: true, at: countIn * 0.55 + e.start * 0.55, accent: false });
    });
    var total = countIn * 0.55 + T.patternTotal(correct.pattern) * 0.55 + 0.3;
    return {
      type: 'rhythm', level: level,
      prompt: '\u8bf7\u542c\u8fa8\u8282\u594f\u578b\uff0c\u9009\u51fa\u6b63\u786e\u7684\u8c31\u4f8b',
      hint: '\u524d ' + countIn + ' \u62cd\u4e3a\u9884\u5907\u62cd\uff08\u6bcf\u5c0f\u8282\u7b2c\u4e00\u62cd\u4e3a\u91cd\u62cd\uff09\uff0c\u62cd\u53f7 ' + correct.timeSig,
      options: options.map(function (o, idx) {
        return {
          value: String(idx), label: '',
          notation: { kind: 'rhythm', timeSig: o.timeSig, pattern: o.pattern }
        };
      }),
      answer: String(options.indexOf(correct)),
      answerLabel: correct.timeSig + ' \u00b7 ' + correct.pattern.map(function (p) {
        var v = typeof p === 'number' ? p : (p.r !== undefined ? p.r : p.d);
        return (typeof p === 'object' && p.r !== undefined ? '\u4f11' : '') + v;
      }).join(' + '),
      detail: '\u6b63\u786e\u8282\u594f\u4e3a ' + correct.timeSig + ' \u62cd\uff0c\u65f6\u503c\u5e8f\u5217\uff1a' +
        correct.pattern.map(function (p) {
          var v = typeof p === 'number' ? p : (p.r !== undefined ? p.r : p.d);
          return (typeof p === 'object' && p.r !== undefined ? '\u4f11\u6b62' : '') + v + '\u62cd';
        }).join(' + '),
      duration: total,
      optionKind: 'notation',
      payload: { timeSig: correct.timeSig, pattern: correct.pattern },
      play: function () {
        A.stopAll();
        var t = A.currentTime() + 0.1;
        ev.forEach(function (e) { A.playClick(t + e.at, e.accent); });
        return total;
      }
    };
  };

  /* --------------------------- 9. 旋律听辨 ------------------------------ */
  function degreeToMidi(key, d) {
    var base = 60 + key.tonicPc;
    var oct = Math.floor(d / 7);
    var idx = T.mod(d, 7);
    return base + oct * 12 + key.intervals[idx];
  }
  function randomToneGroup(key, count, maxStep) {
    var degs = [U.pick([0, 2, 4])];
    while (degs.length < count) {
      var last = degs[degs.length - 1];
      var step = U.randInt(1, maxStep) * (Math.random() < 0.5 ? -1 : 1);
      var nd = last + step;
      if (nd < -2 || nd > 8) nd = last - step;
      if (nd < -2) nd = last + 1;
      if (nd > 8) nd = last - 1;
      degs.push(nd);
    }
    return degs.map(function (d) { return degreeToMidi(key, d); });
  }
  GEN.melody = function (level) {
    var cfg = { easy: { count: 3, step: 1 }, medium: { count: 4, step: 2 }, hard: { count: 5, step: 3 } }[level];
    var keyName = U.pick(level === 'easy' ? ['C', 'G', 'F'] : ['C', 'G', 'D', 'F', 'Bb', 'A']);
    var key = T.buildKey(keyName);
    var correct = randomToneGroup(key, cfg.count, cfg.step);
    var groups = [correct];
    var guard = 0;
    while (groups.length < 4 && guard++ < 300) {
      var cand = randomToneGroup(key, cfg.count, cfg.step);
      if (groups.some(function (g) { return g.join(',') === cand.join(','); })) continue;
      groups.push(cand);
    }
    var shuffled = U.shuffle(groups);
    var correctIdx = shuffled.indexOf(correct);
    var tonicTriad = [60 + key.tonicPc, 60 + key.tonicPc + key.intervals[2], 60 + key.tonicPc + key.intervals[4]];
    var ev = [{ midis: tonicTriad, at: 0, dur: 0.9, velocity: 0.65 }];
    correct.forEach(function (m, i) {
      ev.push({ midis: [m], at: 1.1 + i * 0.62, dur: 0.5, velocity: 0.9 });
    });
    return {
      type: 'melody', level: level,
      prompt: '\u8bf7\u542c\u8fa8\u7b49\u65f6\u503c\u97f3\u7ec4\uff0c\u9009\u51fa\u6b63\u786e\u7684\u8c31\u4f8b',
      hint: '\u8c03\u6027\uff1a' + key.name + '\uff08\u5df2\u5148\u64ad\u653e\u4e3b\u4e09\u548c\u5f26\uff09\uff0c' +
        cfg.count + ' \u4e2a\u97f3\uff0c\u5747\u4e3a\u56db\u5206\u97f3\u7b26',
      options: shuffled.map(function (g, idx) {
        return { value: String(idx), label: '', notation: { kind: 'melody', midis: g, key: key } };
      }),
      answer: String(correctIdx),
      answerLabel: correct.map(function (m) { return noteName(m); }).join(' - '),
      detail: '\u6b63\u786e\u97f3\u7ec4\uff1a' + correct.map(function (m, i) {
        var sol = T.solfegeOf(m, key);
        return noteName(m) + '\uff08' + sol.text + '\uff09';
      }).join(' \u2192 '),
      duration: 1.1 + cfg.count * 0.62,
      optionKind: 'notation',
      payload: { keyName: key.shortName, midis: correct },
      play: function () {
        A.stopAll();
        A.playSequence(ev);
        return 1.1 + cfg.count * 0.62;
      }
    };
  };

  /* --------------------------- 错题重放构造 ----------------------------- */
  function replay(type, payload) {
    if (!payload) return null;
    if (type === 'single') return function () { A.stopAll(); A.playSequence([{ midis: [69], at: 0, dur: 0.7 }, { midis: [payload.midi], at: 1.05, dur: 1.0 }]); return 2; };
    if (type === 'compare') return function () { A.stopAll(); A.playSequence([{ midis: [payload.n1], at: 0, dur: 0.8 }, { midis: [payload.n2], at: 1.05, dur: 0.8 }]); return 1.9; };
    if (type === 'interval') return function () {
      A.stopAll();
      var r = payload.root, s = payload.ascend ? payload.root + payload.semis : payload.root - payload.semis;
      if (payload.harmonic) { A.playChord([r, s], { dur: 1.3 }); return 1.3; }
      A.playSequence([{ midis: [r], at: 0, dur: 0.8 }, { midis: [s], at: 0.95, dur: 0.8 }]);
      return 1.8;
    };
    if (type === 'chord') return function () { A.stopAll(); A.playChord(T.chordNotes(payload.rootMidi, T.CHORD_BY_ID[payload.typeId], payload.inversion), { dur: 1.5 }); return 1.5; };
    if (type === 'scale') return function () {
      A.stopAll();
      var sc = T.SCALE_BY_ID[payload.scaleId];
      var up = sc.intervals.map(function (v) { return payload.rootMidi + v; });
      var notes = up.concat([payload.rootMidi + 12]).concat(up.slice(0, -1).reverse());
      A.playNoteList(notes, { noteDur: 0.3, gap: 0.04 });
      return notes.length * 0.34;
    };
    if (type === 'progression') return function () {
      A.stopAll();
      var key = T.buildKey(payload.keyName);
      var chords = T.progressionChords(key, payload.numerals, 4);
      var tonic = T.chordNotes(60 + key.tonicPc, T.CHORD_BY_ID[key.mode === 'minor' ? 'min' : 'maj'], 0);
      var ev = [{ midis: tonic, at: 0, dur: 1.0, velocity: 0.7 }];
      chords.forEach(function (c, i) { ev.push({ midis: c, at: 1.15 + i * 0.95, dur: 0.85 }); });
      A.playSequence(ev);
      return 1.15 + chords.length * 0.95;
    };
    if (type === 'degree') return function () {
      A.stopAll();
      var key = T.buildKey(payload.keyName);
      var base = 60 + key.tonicPc;
      var midi = base + key.intervals[payload.deg] + (payload.alt ? 1 : 0);
      A.playSequence([
        { midis: [base, base + key.intervals[2], base + key.intervals[4]], at: 0, dur: 1.0, velocity: 0.65 },
        { midis: [midi], at: 1.25, dur: 1.0 }
      ]);
      return 2.3;
    };
    if (type === 'melody') return function () {
      A.stopAll();
      var key = T.buildKey(payload.keyName);
      var ev = [{ midis: [60 + key.tonicPc, 60 + key.tonicPc + key.intervals[2], 60 + key.tonicPc + key.intervals[4]], at: 0, dur: 0.9, velocity: 0.65 }];
      payload.midis.forEach(function (m, i) { ev.push({ midis: [m], at: 1.1 + i * 0.62, dur: 0.5 }); });
      A.playSequence(ev);
      return 1.1 + payload.midis.length * 0.62;
    };
    if (type === 'rhythm') return function () {
      A.stopAll();
      var beatsPerBar = parseInt(payload.timeSig.split('/')[0], 10);
      var countIn = beatsPerBar * 2;
      var t = A.currentTime() + 0.1;
      var total = countIn * 0.55 + T.patternTotal(payload.pattern) * 0.55;
      for (var i = 0; i < countIn; i++) A.playClick(t + i * 0.55, i % beatsPerBar === 0);
      T.patternToEvents(payload.pattern).forEach(function (e) {
        if (!e.rest) A.playClick(t + countIn * 0.55 + e.start * 0.55, false);
      });
      return total;
    };
    return null;
  }

  /* =========================================================================
   *                              通用答题引擎
   * ====================================================================== */
  function Engine(container, typeId, opts) {
    opts = opts || {};
    var meta = META_BY_ID[typeId];
    var settings = S.getSettings();
    var st = {
      typeId: typeId,
      level: opts.level || settings.level || 'easy',
      mode: opts.mode || 'practice',
      total: settings.questionCount || 10,
      index: 0,
      correct: 0,
      streak: 0,
      bestStreak: 0,
      answered: false,
      selected: null,
      question: null,
      results: [],
      startAt: 0,
      playing: false,
      playTimer: null,
      finished: false
    };
    var dom = {};
    container.innerHTML = '';

    var root = U.el('div', { class: 'trainer' });
    container.appendChild(root);

    /* ------------------------------ 顶部栏 ------------------------------ */
    function buildHeader() {
      var levelBtns = meta.levels.map(function (lv) {
        return U.el('button', {
          class: 'pill' + (lv === st.level ? ' active' : ''), type: 'button', dataset: { level: lv },
          on: { click: function () { if (st.level === lv) return; st.level = lv; S.saveSettings({ level: lv }); reset(); } }
        }, LEVEL_CN[lv]);
      });
      var countBtns = [5, 10, 20].map(function (n) {
        return U.el('button', {
          class: 'pill' + (n === st.total ? ' active' : ''), type: 'button',
          on: { click: function () { if (st.total === n && st.mode === 'test') return; st.total = n; S.saveSettings({ questionCount: n }); reset(); } }
        }, n + ' \u9898');
      });
      dom.header = U.el('div', { class: 'trainer-top' }, [
        U.el('div', { class: 'trainer-head-left' }, [
          U.el('div', { class: 'trainer-head-icon', html: I.svg(meta.icon, 22) }),
          U.el('div', {}, [
            U.el('div', { class: 'trainer-head-title', text: meta.name }),
            U.el('div', { class: 'trainer-head-sub', text: meta.brief })
          ])
        ]),
        U.el('div', { class: 'trainer-head-right' }, [
          U.el('div', { class: 'ctrl-group' }, [U.el('span', { class: 'ctrl-label', text: '\u96be\u5ea6' })].concat(levelBtns)),
          U.el('div', { class: 'ctrl-group' }, [
            U.el('span', { class: 'ctrl-label', text: '\u6a21\u5f0f' }),
            U.el('button', { class: 'pill' + (st.mode === 'practice' ? ' active' : ''), type: 'button', on: { click: function () { st.mode = 'practice'; reset(); } } }, '\u7ec3\u4e60'),
            U.el('button', { class: 'pill' + (st.mode === 'test' ? ' active' : ''), type: 'button', on: { click: function () { st.mode = 'test'; reset(); } } }, '\u6d4b\u9a8c')
          ]),
          st.mode === 'test' ? U.el('div', { class: 'ctrl-group' }, [U.el('span', { class: 'ctrl-label', text: '\u9898\u91cf' })].concat(countBtns)) : null
        ])
      ]);
      root.appendChild(dom.header);
    }

    /* ------------------------------ 题目区 ------------------------------ */
    function buildStage() {
      dom.progressLabel = U.el('div', { class: 'quiz-meta' });
      dom.progressFill = U.el('div', { class: 'quiz-bar-fill' });
      dom.hint = U.el('div', { class: 'quiz-hint' });
      dom.prompt = U.el('div', { class: 'quiz-prompt' });
      dom.visual = U.el('div', { class: 'quiz-visual' });
      dom.playBtn = U.el('button', {
        class: 'btn btn-primary btn-play', type: 'button',
        on: { click: function () { playQuestion(); } }
      });
      dom.replayBtn = U.el('button', {
        class: 'btn btn-ghost', type: 'button',
        on: { click: function () { playQuestion(); } }
      });
      dom.playBar = U.el('div', { class: 'quiz-playbar' }, [
        U.el('div', { class: 'quiz-bar' }, [dom.progressFill])
      ]);
      dom.options = U.el('div', { class: 'quiz-options' });
      dom.feedback = U.el('div', { class: 'quiz-feedback' });
      dom.nextBtn = U.el('button', {
        class: 'btn btn-primary', type: 'button', on: { click: function () { next(); } }
      }, '\u4e0b\u4e00\u9898');
      dom.endBtn = U.el('button', {
        class: 'btn btn-ghost', type: 'button', on: { click: function () { finish('manual'); } }
      }, st.mode === 'test' ? '\u63d0\u4ea4\u5e76\u7ed3\u675f' : '\u7ed3\u675f\u672c\u8f6e');
      dom.card = U.el('div', { class: 'quiz-card' }, [
        U.el('div', { class: 'quiz-card-head' }, [dom.progressLabel]),
        dom.prompt,
        dom.hint,
        dom.visual,
        U.el('div', { class: 'quiz-playrow' }, [dom.playBtn, dom.replayBtn, dom.playBar]),
        dom.options,
        dom.feedback,
        U.el('div', { class: 'quiz-actions' }, [dom.endBtn, dom.nextBtn])
      ]);
      root.appendChild(dom.card);
    }

    /* ------------------------------ 渲染题目 ---------------------------- */
    function renderQuestion() {
      var q = st.question;
      st.answered = false; st.selected = null;
      dom.feedback.className = 'quiz-feedback';
      dom.feedback.innerHTML = '';
      dom.nextBtn.textContent = st.index + 1 >= st.total && st.mode === 'test' ? '\u67e5\u770b\u6210\u7ee9' : '\u4e0b\u4e00\u9898';
      dom.prompt.textContent = q.prompt;
      dom.hint.innerHTML = q.hint || '';
      dom.visual.innerHTML = '';
      if (q.renderPrompt) {
        dom.visual.style.display = '';
        q.renderPrompt(dom.visual);
      } else dom.visual.style.display = 'none';

      // 播放按钮
      dom.playBtn.innerHTML = I.svgFilled('play', 16) + '<span>\u64ad\u653e</span>';
      dom.replayBtn.innerHTML = I.svg('replay', 16) + '<span>\u91cd\u64ad</span>';
      dom.replayBtn.style.display = q.type === 'compare' ? 'none' : '';

      // 进度
      if (st.mode === 'test') {
        dom.progressLabel.innerHTML = '\u7b2c <b>' + (st.index + 1) + '</b> / ' + st.total + ' \u9898';
      } else {
        dom.progressLabel.innerHTML = '\u5df2\u7b54 <b>' + st.index + '</b> \u9898 \u00b7 \u6b63\u786e\u7387 <b>' +
          U.pct(st.correct, st.index) + '%</b> \u00b7 \u8fde\u5bf9 <b>' + st.streak + '</b>';
      }

      // 选项
      U.clear(dom.options);
      dom.options.className = 'quiz-options' + (q.optionKind === 'notation' ? ' options-notation' : '');
      q.options.forEach(function (opt, i) {
        var btn = U.el('button', {
          class: 'opt', type: 'button', dataset: { value: opt.value },
          on: { click: function () { choose(opt.value, btn); } }
        }, [
          U.el('span', { class: 'opt-key', text: String(i + 1) }),
          U.el('span', { class: 'opt-body' }, [
            opt.label ? U.el('span', { class: 'opt-label', text: opt.label }) : null,
            opt.sub ? U.el('span', { class: 'opt-sub', text: opt.sub }) : null
          ])
        ]);
        if (opt.notation) {
          btn.classList.add('opt-notation');
          var host = U.el('div', { class: 'opt-stave' });
          btn.querySelector('.opt-body').appendChild(host);
        }
        dom.options.appendChild(btn);
      });
      // 渲染谱例选项
      if (q.optionKind === 'notation') {
        U.qsa('.opt-notation', dom.options).forEach(function (btn, i) {
          var opt = q.options[i];
          var host = btn.querySelector('.opt-stave');
          if (!host) return;
          if (opt.notation.kind === 'rhythm') {
            N.renderRhythm(host, opt.notation.pattern, { timeSig: opt.notation.timeSig, width: 300, height: 118 });
          } else if (opt.notation.kind === 'melody') {
            N.renderStave(host, {
              clef: 'treble', keySig: opt.notation.key.vexKeySig, timeSig: null, key: opt.notation.key,
              notes: opt.notation.midis.map(function (m) { return { midi: m, beats: 1 }; }),
              width: 300, height: 132
            });
          }
        });
      }

      dom.playBar.style.display = 'none';
      dom.progressFill.style.width = '0%';
      dom.nextBtn.disabled = true;
      dom.nextBtn.classList.add('is-disabled');

      if (S.getSettings().autoPlay) {
        setTimeout(function () { if (!st.answered && st.question === q) playQuestion(); }, 260);
      }
      bindKeys();
    }

    /* ------------------------------ 播放 -------------------------------- */
    function playQuestion() {
      var q = st.question;
      if (!q) return;
      A.unlock();
      var dur = q.play();
      if (typeof dur !== 'number' || !isFinite(dur)) dur = q.duration || 1.5;
      animatePlay(dur);
    }
    function animatePlay(dur) {
      if (st.playTimer) cancelAnimationFrame(st.playTimer);
      dom.playBar.style.display = '';
      var start = performance.now();
      dom.playBtn.classList.add('is-playing');
      function tick() {
        var el2 = (performance.now() - start) / 1000;
        var p = Math.min(1, el2 / dur);
        dom.progressFill.style.width = (p * 100) + '%';
        if (p < 1) st.playTimer = requestAnimationFrame(tick);
        else {
          dom.playBtn.classList.remove('is-playing');
          setTimeout(function () { dom.playBar.style.display = 'none'; }, 260);
        }
      }
      tick();
    }

    /* ------------------------------ 作答 -------------------------------- */
    function choose(value, btn) {
      if (st.answered) return;
      st.answered = true;
      st.selected = value;
      var q = st.question;
      var correct = String(value) === String(q.answer);
      if (correct) { st.correct++; st.streak++; if (st.streak > st.bestStreak) st.bestStreak = st.streak; }
      else st.streak = 0;
      st.index++;
      S.recordAnswer(q.type, correct, { streak: st.streak });
      S.bumpStreak(q.type, st.streak);
      st.results.push({ question: q, chosen: value, correct: correct });
      if (!correct) {
        var chosenOpt = q.options.filter(function (o) { return String(o.value) === String(value); })[0];
        S.addWrong({
          type: q.type, typeName: meta.name, level: st.level, prompt: q.prompt,
          answerLabel: q.answerLabel, chosenLabel: chosenOpt ? chosenOpt.label : String(value),
          detail: q.detail, payload: q.payload
        });
      }
      if (st.mode === 'test') {
        // 测验模式：仅标记选择，不揭示
        U.qsa('.opt', dom.options).forEach(function (b) {
          b.disabled = true;
          if (String(b.dataset.value) === String(value)) b.classList.add('opt-chosen');
        });
        dom.nextBtn.disabled = false;
        dom.nextBtn.classList.remove('is-disabled');
        unlockKeysNext();
        setTimeout(function () {
          if (st.index >= st.total) finish('complete');
          else next();
        }, 320);
      } else {
        reveal(correct, value);
      }
      updateStreakUI();
    }

    function reveal(correct, value) {
      var q = st.question;
      U.qsa('.opt', dom.options).forEach(function (b) {
        b.disabled = true;
        if (String(b.dataset.value) === String(q.answer)) b.classList.add('opt-correct');
        else if (String(b.dataset.value) === String(value)) b.classList.add('opt-wrong');
        else b.classList.add('opt-dim');
      });
      dom.feedback.className = 'quiz-feedback ' + (correct ? 'ok' : 'bad');
      dom.feedback.innerHTML = '';
      dom.feedback.appendChild(U.el('div', { class: 'fb-head' }, [
        U.el('span', { class: 'fb-icon', html: I.svg(correct ? 'check' : 'close', 16) }),
        U.el('span', { class: 'fb-title', text: correct ? '\u56de\u7b54\u6b63\u786e' : '\u56de\u7b54\u9519\u8bef' }),
        !correct ? U.el('span', { class: 'fb-ans', text: '\u6b63\u786e\u7b54\u6848\uff1a' + q.answerLabel }) : null
      ]));
      dom.feedback.appendChild(U.el('div', { class: 'fb-detail' }, [
        U.el('span', { class: 'fb-tag', text: '\u89e3\u6790' }), document.createTextNode(q.detail || '')
      ]));
      dom.nextBtn.disabled = false;
      dom.nextBtn.classList.remove('is-disabled');
      if (correct && S.getSettings().confetti && st.streak > 0 && st.streak % 5 === 0) U.confetti(70);
      bindKeys();
    }

    function updateStreakUI() {
      if (st.mode === 'test') {
        dom.progressLabel.innerHTML = '\u5df2\u7b54 <b>' + st.index + '</b> / ' + st.total + ' \u9898';
        return;
      }
      dom.progressLabel.innerHTML = '\u5df2\u7b54 <b>' + st.index + '</b> \u9898 \u00b7 \u6b63\u786e\u7387 <b>' +
        U.pct(st.correct, st.index) + '%</b> \u00b7 \u8fde\u5bf9 <b>' + st.streak + '</b>';
    }

    /* ------------------------------ 流程 -------------------------------- */
    function next() {
      if (st.mode === 'test' && st.index >= st.total) { finish('complete'); return; }
      A.stopAll();
      st.question = GEN[st.typeId](st.level);
      renderQuestion();
    }
    function reset() {
      A.stopAll();
      st.index = 0; st.correct = 0; st.streak = 0; st.bestStreak = 0;
      st.results = []; st.finished = false; st.startAt = Date.now();
      root.innerHTML = '';
      buildHeader(); buildStage();
      if (st.mode === 'test' && st.total < 1) st.total = 10;
      st.question = GEN[st.typeId](st.level);
      renderQuestion();
      bindKeys();
    }

    /* ------------------------------ 结算 -------------------------------- */
    function finish(reason) {
      A.stopAll();
      U.unbindKeys();
      st.finished = true;
      var answered = st.results.length;
      var acc = U.pct(st.correct, answered);
      var seconds = Math.round((Date.now() - st.startAt) / 1000);
      S.addSession({
        type: st.typeId, typeName: meta.name, mode: st.mode, level: st.level,
        total: answered, correct: st.correct, accuracy: acc, durationSec: seconds, reason: reason
      });
      // 成就
      if (acc === 100 && answered >= 5) S.unlockAchievement('perfect_' + st.typeId, meta.name + '\u5168\u90e8\u6b63\u786e');
      if (st.bestStreak >= 10) S.unlockAchievement('streak10', '\u8fde\u7eed\u7b54\u5bf9 10 \u9898');
      if (st.bestStreak >= 20) S.unlockAchievement('streak20', '\u8fde\u7eed\u7b54\u5bf9 20 \u9898');
      if (acc >= 90 && answered >= 10) S.unlockAchievement('acc90', '\u5355\u8f6e\u6b63\u786e\u7387\u8fbe\u5230 90%');

      var grade = acc >= 95 ? '\u4f18\u79c0' : acc >= 85 ? '\u826f\u597d' : acc >= 70 ? '\u5408\u683c' : '\u9700\u52a0\u5f3a';
      var score = Math.round(acc);
      var review = U.el('div', { class: 'review-list' });
      if (st.results.length) {
        st.results.forEach(function (r, i) {
          var q = r.question;
          var row = U.el('div', { class: 'review-row ' + (r.correct ? 'ok' : 'bad') }, [
            U.el('span', { class: 'review-idx', text: String(i + 1) }),
            U.el('span', { class: 'review-icon', html: I.svg(r.correct ? 'check' : 'close', 14) }),
            U.el('div', { class: 'review-body' }, [
              U.el('div', { class: 'review-ans', text: '\u6b63\u786e\uff1a' + q.answerLabel }),
              U.el('div', { class: 'review-detail', text: q.detail || '' })
            ]),
            U.el('button', {
              class: 'btn-mini', type: 'button',
              on: {
                click: function () {
                  var fn = replay(q.type, q.payload);
                  if (fn) fn();
                }
              }
            }, '\u91cd\u653e')
          ]);
          review.appendChild(row);
        });
      }
      var body = [
        U.el('div', { class: 'result-top' }, [
          U.el('div', { class: 'result-score' }, [
            U.el('div', { class: 'result-score-num', text: String(score) }),
            U.el('div', { class: 'result-score-label', text: '\u5f97\u5206' })
          ]),
          U.el('div', { class: 'result-stats' }, [
            U.el('div', { class: 'rs' }, [U.el('b', { text: String(answered) }), U.el('span', { text: '\u5df2\u7b54\u9898\u91cf' })]),
            U.el('div', { class: 'rs' }, [U.el('b', { text: st.correct + ' / ' + answered }), U.el('span', { text: '\u7b54\u5bf9 / \u7b54\u9898' })]),
            U.el('div', { class: 'rs' }, [U.el('b', { text: st.bestStreak + '' }), U.el('span', { text: '\u6700\u9ad8\u8fde\u5bf9' })]),
            U.el('div', { class: 'rs' }, [U.el('b', { text: seconds + 's' }), U.el('span', { text: '\u8017\u65f6' })])
          ]),
          U.el('div', { class: 'result-grade grade-' + (acc >= 85 ? 'good' : acc >= 70 ? 'mid' : 'bad'), text: grade })
        ]),
        U.el('div', { class: 'result-sec-title', text: '\u9010\u9898\u56de\u987e' }),
        review
      ];
      dom.card.innerHTML = '';
      dom.card.appendChild(U.el('div', { class: 'result' }, body));
      dom.card.appendChild(U.el('div', { class: 'quiz-actions' }, [
        U.el('button', { class: 'btn btn-ghost', type: 'button', on: { click: function () { reset(); } } }, '\u518d\u6765\u4e00\u8f6e'),
        U.el('button', {
          class: 'btn btn-ghost', type: 'button',
          on: { click: function () { if (opts.onExit) opts.onExit(); } }
        }, '\u8fd4\u56de\u9898\u578b\u5217\u8868')
      ]));
      if (acc >= 85 && S.getSettings().confetti) U.confetti(120);
    }

    /* ------------------------------ 快捷键 ------------------------------ */
    function bindKeys() {
      if (!S.getSettings().shortcuts) { U.unbindKeys(); return; }
      var keys = [];
      for (var i = 1; i <= Math.min(9, st.question ? st.question.options.length : 0); i++) {
        (function (n) {
          keys.push({ key: String(n), handler: function () { selectByIndex(n - 1); } });
        })(i);
      }
      keys.push({ key: ' ', handler: function () { playQuestion(); } });
      keys.push({ key: 'Enter', handler: function () { if (!dom.nextBtn.disabled) next(); } });
      U.bindKeys(keys);
    }
    function unlockKeysNext() {
      if (!S.getSettings().shortcuts) return;
      U.bindKeys([{ key: 'Enter', handler: function () { if (!dom.nextBtn.disabled) next(); } }]);
    }
    function selectByIndex(i) {
      if (st.answered) return;
      var btns = U.qsa('.opt', dom.options);
      if (!btns[i]) return;
      choose(btns[i].dataset.value, btns[i]);
    }

    /* ------------------------------ 启动 -------------------------------- */
    reset();
    A.unlock();

    return {
      root: root,
      state: st,
      destroy: function () {
        A.stopAll();
        U.unbindKeys();
        if (st.playTimer) cancelAnimationFrame(st.playTimer);
        container.innerHTML = '';
      },
      onExit: opts.onExit
    };
  }

  WB.Trainers = {
    META: META,
    META_BY_ID: META_BY_ID,
    LEVELS: LEVELS,
    LEVEL_CN: LEVEL_CN,
    GEN: GEN,
    Engine: Engine,
    replay: replay,
    noteName: noteName,
    chromLabel: chromLabel,
    degreeToMidi: degreeToMidi
  };
})(typeof window !== 'undefined' ? window : globalThis);
