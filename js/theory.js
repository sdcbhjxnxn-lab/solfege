/* =============================================================================
 * theory.js  —  乐理核心引擎
 * 音名/音高换算、调号与音符拼写、音程、和弦、音阶调式、和声进行、节奏型
 * 设计依据：中央音乐学院视唱练耳分级要求（见 README 来源说明）
 * ========================================================================== */
(function (global) {
  'use strict';
  var WB = (global.WB = global.WB || {});

  /* ----------------------------- 常量与基础 ------------------------------- */
  var SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  var LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  var LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  var SOLFEGE_FIXED = { C: 'do', D: 're', E: 'mi', F: 'fa', G: 'sol', A: 'la', B: 'si' };
  // 首调唱名：音阶级数 1-7 对应唱名
  var SOLFEGE_DEGREE = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'];
  var SOLFEGE_DEGREE_CN = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'];

  var ACC_SYMBOL = { '-2': '\u266d\u266d', '-1': '\u266d', 0: '', 1: '\u266f', 2: '\u266f\u266f' };
  var ACC_VEX = { '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' };

  var MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
  var NATURAL_MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
  var MAJOR_BY_FIFTHS = {
    '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F',
    '0': 'C', '1': 'G', '2': 'D', '3': 'A', '4': 'E', '5': 'B', '6': 'F#', '7': 'C#'
  };
  var MINOR_BY_FIFTHS = {
    '-7': 'Abm', '-6': 'Ebm', '-5': 'Bbm', '-4': 'Fm', '-3': 'Cm', '-2': 'Gm', '-1': 'Dm',
    '0': 'Am', '1': 'Em', '2': 'Bm', '3': 'F#m', '4': 'C#m', '5': 'G#m', '6': 'D#m', '7': 'A#m'
  };

  function mod(n, m) { return ((n % m) + m) % m; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ----------------------------- 音高换算 -------------------------------- */
  // MIDI 60 = C4（中央 C），MIDI 69 = A4
  function midiToFreq(midi, a4) { return (a4 || 440) * Math.pow(2, (midi - 69) / 12); }
  function freqToMidi(freq, a4) { return 69 + 12 * Math.log2(freq / (a4 || 440)); }
  function centsBetween(f1, f2) { return 1200 * Math.log2(f2 / f1); }
  function pcOf(midi) { return mod(midi, 12); }
  function octaveOf(midi) { return Math.floor(midi / 12) - 1; }

  function midiToName(midi, preferFlat) {
    var names = preferFlat ? FLAT_NAMES : SHARP_NAMES;
    return names[pcOf(midi)] + octaveOf(midi);
  }

  // 解析 "C#4" / "Bb3" / "C4" -> midi
  function nameToMidi(name) {
    var m = /^([A-Ga-g])([#b\u266f\u266d]*)(-?\d+)$/.exec(String(name).trim());
    if (!m) return null;
    var pc = LETTER_PC[m[1].toUpperCase()];
    var acc = m[2] || '';
    for (var i = 0; i < acc.length; i++) {
      if (acc[i] === '#' || acc[i] === '\u266f') pc += 1;
      else if (acc[i] === 'b' || acc[i] === '\u266d') pc -= 1;
    }
    return pc + (parseInt(m[3], 10) + 1) * 12;
  }

  /* ------------------------- 调号与音符拼写 ------------------------------ */
  // 调名 -> 调号升降数（五度圈）
  var MAJOR_KEY_FIFTHS = {
    Cb: -7, Gb: -6, Db: -5, Ab: -4, Eb: -3, Bb: -2, F: -1, C: 0,
    G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7
  };
  var MINOR_KEY_FIFTHS = {
    Ab: -7, Eb: -6, Bb: -5, F: -4, C: -3, G: -2, D: -1, A: 0,
    E: 1, B: 2, 'F#': 3, 'C#': 4, 'G#': 5, 'D#': 6, 'A#': 7
  };
  // 供界面使用的常用调（控制在四个升降号以内，符合央音分级与艺考要求）
  var USABLE_MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab', 'Db'];
  var USABLE_MINOR_KEYS = ['A', 'E', 'B', 'F#', 'D', 'G', 'C', 'F', 'Bb', 'Eb'];

  // 解析调名的字母与升降号，如 'Eb' -> {letter:'E', acc:-1}
  function parseTonicName(name) {
    var m = /^([A-G])([#b]?)$/.exec(String(name).replace(/\u266f/g, '#').replace(/\u266d/g, 'b'));
    if (!m) return { letter: 'C', acc: 0 };
    return { letter: m[1], acc: m[2] === '#' ? 1 : (m[2] === 'b' ? -1 : 0) };
  }

  // 用「字母序列 + 目标音级」推导出正确拼写（含升降记号）
  function spellScaleFromLetter(tonicLetter, tonicAcc, intervals) {
    var startIdx = LETTERS.indexOf(tonicLetter);
    var tonicPc = mod(LETTER_PC[tonicLetter] + (tonicAcc || 0), 12);
    var out = [];
    for (var i = 0; i < intervals.length; i++) {
      var letter = LETTERS[mod(startIdx + i, 7)];
      var targetPc = mod(tonicPc + intervals[i], 12);
      var acc = mod(targetPc - LETTER_PC[letter], 12);
      if (acc > 6) acc -= 12; // 取最近的等音拼写
      out.push({ letter: letter, acc: acc, pc: targetPc });
    }
    return out;
  }

  /**
   * 构建一个调：buildKey('Eb') / buildKey('F#m')
   * 返回 { name, vexKeySig, tonicPc, mode, fifths, intervals, spell }
   */
  function buildKey(keyName, mode) {
    var raw = String(keyName || 'C');
    var isMinor = /m$/.test(raw) || mode === 'minor';
    var base = raw.replace(/m$/, '') || 'C';
    var tn = parseTonicName(base);
    var fifths = isMinor
      ? (MINOR_KEY_FIFTHS[base] !== undefined ? MINOR_KEY_FIFTHS[base] : 0)
      : (MAJOR_KEY_FIFTHS[base] !== undefined ? MAJOR_KEY_FIFTHS[base] : 0);
    var intervals = isMinor ? NATURAL_MINOR_SCALE : MAJOR_SCALE;
    var spell = spellScaleFromLetter(tn.letter, tn.acc, intervals);
    var vexKeySig = (isMinor ? MINOR_BY_FIFTHS : MAJOR_BY_FIFTHS)[String(fifths)] || 'C';
    return {
      name: base + (tn.acc ? ACC_SYMBOL[String(tn.acc)] : '') + (isMinor ? ' \u5c0f\u8c03' : ' \u5927\u8c03'),
      shortName: base + (tn.acc ? (tn.acc > 0 ? '#' : 'b') : '') + (isMinor ? 'm' : ''),
      tonicLetter: tn.letter,
      tonicAcc: tn.acc,
      tonicPc: spell[0].pc,
      mode: isMinor ? 'minor' : 'major',
      fifths: fifths,
      intervals: intervals,
      spell: spell,
      vexKeySig: vexKeySig
    };
  }

  // 由 midi + 调 得到拼写 { letter, acc, octave }
  function spellMidi(midi, key) {
    var pc = pcOf(midi), oct = octaveOf(midi);
    if (key) {
      for (var i = 0; i < key.spell.length; i++) {
        if (key.spell[i].pc === pc) {
          return { letter: key.spell[i].letter, acc: key.spell[i].acc, octave: oct, pc: pc };
        }
      }
    }
    var flat = key && key.fifths < 0;
    var n = (flat ? FLAT_NAMES : SHARP_NAMES)[pc];
    var letter = n[0], acc = n.length > 1 ? (n[1] === '#' ? 1 : -1) : 0;
    return { letter: letter, acc: acc, octave: oct, pc: pc };
  }

  function spellToName(sp) { return sp.letter + (ACC_SYMBOL[sp.acc] || '') + sp.octave; }
  function spellToVexKey(sp) {
    return sp.letter.toLowerCase() + ACC_VEX[String(sp.acc)] + '/' + sp.octave;
  }
  // 便捷：midi -> VexFlow key
  function midiToVexKey(midi, key) { return spellToVexKey(spellMidi(midi, key)); }

  // 首调唱名（相对调主音）；返回 { text, accText }
  function solfegeOf(midi, key) {
    if (!key) return SOLFEGE_FIXED[SHARP_NAMES[pcOf(midi)][0]] || '';
    var diff = mod(pcOf(midi) - key.tonicPc, 12);
    // 找最接近的半音映射
    var table = [
      [0, 0, 0], [1, 0, 1], [1, 1, -1], [2, 1, 0], [3, 2, 1], [3, 3, -1],
      [4, 2, 0], [5, 3, 0], [6, 3, 1], [6, 4, -1], [7, 4, 0],
      [8, 5, 1], [8, 6, -1], [9, 5, 0], [10, 6, 1], [10, 7, -1], [11, 6, 0]
    ];
    for (var i = 0; i < table.length; i++) {
      if (table[i][0] === diff) {
        var deg = table[i][1];
        var acc = table[i][2];
        return {
          degree: acc >= 0 ? deg + 1 : deg + 1,
          text: SOLFEGE_DEGREE[deg === 7 ? 0 : deg],
          accText: acc > 0 ? '\u2191' : (acc < 0 ? '\u2193' : ''),
          acc: acc
        };
      }
    }
    return { degree: 1, text: 'do', accText: '', acc: 0 };
  }

  /* ------------------------------- 音程 --------------------------------- */
  // 参考曲目来源：Soundbrenner 听力训练专题 / 维基教科书《音阶与音程》
  // 听感描述来源：SkyMedia《理解音乐中的音程》
  var INTERVALS = [
    { id: 'P1', semis: 0, cn: '纯一度', abbr: 'P1', consonant: '完全协和', feel: '同音重复', refUp: '\u2014', refDown: '\u2014' },
    { id: 'm2', semis: 1, cn: '小二度', abbr: 'm2', consonant: '不协和', feel: '紧张、刺耳', refUp: '《大白鲨》主题曲', refDown: '《致爱丽丝》' },
    { id: 'M2', semis: 2, cn: '大二度', abbr: 'M2', consonant: '不协和', feel: '级进、柔和', refUp: '《生日快乐》', refDown: '《玛丽有只小羊羔》' },
    { id: 'm3', semis: 3, cn: '小三度', abbr: 'm3', consonant: '不完全协和', feel: '忧伤、柔和', refUp: '《绿袖子》', refDown: '《Hey Jude》' },
    { id: 'M3', semis: 4, cn: '大三度', abbr: 'M3', consonant: '不完全协和', feel: '明亮、欢快', refUp: '《圣徒进行曲》', refDown: '《Summertime》' },
    { id: 'P4', semis: 5, cn: '纯四度', abbr: 'P4', consonant: '完全协和', feel: '开阔、稳定', refUp: '《婚礼进行曲》', refDown: '《圣善夜》' },
    { id: 'TT', semis: 6, cn: '增四度 / 减五度（三全音）', abbr: 'TT', consonant: '不协和', feel: '躁动、尖锐', refUp: '《辛普森一家》主题曲', refDown: '《Maria》（西区故事）' },
    { id: 'P5', semis: 7, cn: '纯五度', abbr: 'P5', consonant: '完全协和', feel: '强劲、空旷', refUp: '《小星星》', refDown: '\u2014' },
    { id: 'm6', semis: 8, cn: '小六度', abbr: 'm6', consonant: '不完全协和', feel: '黯淡、惆怅', refUp: '\u2014', refDown: '《Enter Sandman》' },
    { id: 'M6', semis: 9, cn: '大六度', abbr: 'M6', consonant: '不完全协和', feel: '温暖、甜美', refUp: '《My Bonnie Lies Over the Ocean》', refDown: '\u2014' },
    { id: 'm7', semis: 10, cn: '小七度', abbr: 'm7', consonant: '不协和', feel: '扩张、未解决', refUp: '《Somewhere》（西区故事）', refDown: '\u2014' },
    { id: 'M7', semis: 11, cn: '大七度', abbr: 'M7', consonant: '不协和', feel: '渴望、悬念', refUp: '《Take On Me》', refDown: '\u2014' },
    { id: 'P8', semis: 12, cn: '纯八度', abbr: 'P8', consonant: '极完全协和', feel: '同一个音的高八度', refUp: '《Over the Rainbow》', refDown: '\u2014' }
  ];
  var INTERVAL_BY_SEMIS = {};
  INTERVALS.forEach(function (iv) { INTERVAL_BY_SEMIS[iv.semis] = iv; });
  function intervalById(id) { for (var i = 0; i < INTERVALS.length; i++) if (INTERVALS[i].id === id) return INTERVALS[i]; return null; }

  /* ------------------------------- 和弦 --------------------------------- */
  // 四种三和弦 + 常见七和弦（对齐央音考纲：四种三和弦、四种七和弦的原位与转位）
  var CHORDS = [
    { id: 'maj', cn: '大三和弦', sym: '', intervals: [0, 4, 7], group: 'triad' },
    { id: 'min', cn: '小三和弦', sym: 'm', intervals: [0, 3, 7], group: 'triad' },
    { id: 'dim', cn: '减三和弦', sym: 'dim', intervals: [0, 3, 6], group: 'triad' },
    { id: 'aug', cn: '增三和弦', sym: 'aug', intervals: [0, 4, 8], group: 'triad' },
    { id: 'sus4', cn: '挂四和弦', sym: 'sus4', intervals: [0, 5, 7], group: 'triad' },
    { id: 'sus2', cn: '挂二和弦', sym: 'sus2', intervals: [0, 2, 7], group: 'triad' },
    { id: 'pow5', cn: '强力和弦（五度）', sym: '5', intervals: [0, 7], group: 'triad' },
    { id: 'maj7', cn: '大七和弦', sym: 'maj7', intervals: [0, 4, 7, 11], group: 'seventh' },
    { id: 'dom7', cn: '属七和弦', sym: '7', intervals: [0, 4, 7, 10], group: 'seventh' },
    { id: 'min7', cn: '小七和弦', sym: 'm7', intervals: [0, 3, 7, 10], group: 'seventh' },
    { id: 'm7b5', cn: '半减七和弦', sym: 'm7\u266d5', intervals: [0, 3, 6, 10], group: 'seventh' },
    { id: 'dim7', cn: '减七和弦', sym: 'dim7', intervals: [0, 3, 6, 9], group: 'seventh' },
    { id: 'mMaj7', cn: '小大七和弦', sym: 'mMaj7', intervals: [0, 3, 7, 11], group: 'seventh' },
    { id: 'aug7', cn: '增七和弦', sym: 'aug7', intervals: [0, 4, 8, 10], group: 'seventh' },
    { id: 'maj6', cn: '大六和弦', sym: '6', intervals: [0, 4, 7, 9], group: 'seventh' }
  ];
  var CHORD_BY_ID = {};
  CHORDS.forEach(function (c) { CHORD_BY_ID[c.id] = c; });

  // 生成和弦音 midi 列表（可按转位）
  function chordNotes(rootMidi, chord, inversion) {
    inversion = inversion || 0;
    var notes = chord.intervals.map(function (iv) { return rootMidi + iv; });
    for (var i = 0; i < inversion; i++) {
      notes.push(notes.shift() + 12);
    }
    return notes;
  }

  /* ------------------------------- 音阶 --------------------------------- */
  var SCALES = [
    { id: 'major', cn: '自然大调（Ionian 伊奥尼亚）', intervals: [0, 2, 4, 5, 7, 9, 11], group: 'basic' },
    { id: 'naturalMinor', cn: '自然小调（Aeolian 伊奥利亚）', intervals: [0, 2, 3, 5, 7, 8, 10], group: 'basic' },
    { id: 'harmonicMinor', cn: '和声小调（升七级）', intervals: [0, 2, 3, 5, 7, 8, 11], group: 'minor' },
    { id: 'melodicMinor', cn: '旋律小调（上行）', intervals: [0, 2, 3, 5, 7, 9, 11], group: 'minor' },
    { id: 'dorian', cn: '多利亚调式 Dorian', intervals: [0, 2, 3, 5, 7, 9, 10], group: 'mode' },
    { id: 'phrygian', cn: '弗里吉亚调式 Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10], group: 'mode' },
    { id: 'lydian', cn: '利底亚调式 Lydian', intervals: [0, 2, 4, 6, 7, 9, 11], group: 'mode' },
    { id: 'mixolydian', cn: '混合利底亚调式 Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10], group: 'mode' },
    { id: 'locrian', cn: '洛克里亚调式 Locrian', intervals: [0, 1, 3, 5, 6, 8, 10], group: 'mode' },
    { id: 'pentatonicMajor', cn: '大调五声音阶（宫调式）', intervals: [0, 2, 4, 7, 9], group: 'china' },
    { id: 'pentatonicMinor', cn: '小调五声音阶（羽调式）', intervals: [0, 3, 5, 7, 10], group: 'china' },
    { id: 'blues', cn: '布鲁斯音阶（含蓝调音）', intervals: [0, 3, 5, 6, 7, 10], group: 'other' },
    { id: 'wholeTone', cn: '全音音阶', intervals: [0, 2, 4, 6, 8, 10], group: 'other' }
  ];
  var SCALE_BY_ID = {};
  SCALES.forEach(function (s) { SCALE_BY_ID[s.id] = s; });

  function scaleNotes(rootMidi, scale) {
    return scale.intervals.map(function (iv) { return rootMidi + iv; });
  }
  // 上下行完整音阶（上行 8 音含高八度 + 下行）
  function scaleUpDown(rootMidi, scale) {
    var up = scale.intervals.map(function (iv) { return rootMidi + iv; });
    var down = up.slice(0, -1).reverse();
    return up.concat([rootMidi + 12]).concat(down);
  }

  /* ----------------------------- 和声进行 -------------------------------- */
  // 罗马数字：度数 deg(1-7) + 性质 type，根音取调内音级
  var DEGREE_QUALITY_MAJOR = { 1: 'maj', 2: 'min', 3: 'min', 4: 'maj', 5: 'maj', 6: 'min', 7: 'dim' };
  var DEGREE_QUALITY_MINOR = { 1: 'min', 2: 'dim', 3: 'maj', 4: 'min', 5: 'min', 6: 'maj', 7: 'maj' };

  var PROGRESSIONS = [
    { id: 'I-IV-V-I', numerals: ['I', 'IV', 'V', 'I'], cn: '正格进行（最常用）', mode: 'major' },
    { id: 'I-V-vi-IV', numerals: ['I', 'V', 'vi', 'IV'], cn: '流行金曲进行', mode: 'major' },
    { id: 'I-vi-IV-V', numerals: ['I', 'vi', 'IV', 'V'], cn: '五十年代进行', mode: 'major' },
    { id: 'vi-IV-I-V', numerals: ['vi', 'IV', 'I', 'V'], cn: '伤感流行进行', mode: 'major' },
    { id: 'I-IV-I-V', numerals: ['I', 'IV', 'I', 'V'], cn: '基础四和弦', mode: 'major' },
    { id: 'ii-V-I', numerals: ['ii', 'V', 'I'], cn: '爵士终止式', mode: 'major' },
    { id: 'I-iii-IV-V', numerals: ['I', 'iii', 'IV', 'V'], cn: '级进上行', mode: 'major' },
    { id: 'IV-V-iii-vi', numerals: ['IV', 'V', 'iii', 'vi'], cn: '卡农进行片段', mode: 'major' },
    { id: 'i-VI-III-VII', numerals: ['i', 'VI', 'III', 'VII'], cn: '小调流行进行', mode: 'minor' },
    { id: 'i-iv-v-i', numerals: ['i', 'iv', 'v', 'i'], cn: '小调正格进行', mode: 'minor' },
    { id: 'i-VII-VI-VII', numerals: ['i', 'VII', 'VI', 'VII'], cn: '小调终止式', mode: 'minor' }
  ];
  var PROGRESSION_BY_ID = {};
  PROGRESSIONS.forEach(function (p) { PROGRESSION_BY_ID[p.id] = p; });

  // 把一个罗马数字解析为 {deg, type, seventh}
  function parseNumeral(numeral) {
    var m = /^(b|#)?(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i|\u00b0|\u2070)(\u00b0|7|\u2070)?$/.exec(numeral);
    var roman = numeral.replace(/[^IViv\u00b0\u20707.#b]/g, '');
    var alt = 0;
    if (roman[0] === 'b') { alt = -1; roman = roman.slice(1); }
    else if (roman[0] === '#') { alt = 1; roman = roman.slice(1); }
    var suffix = '';
    var core = roman;
    if (/7$/.test(roman)) { suffix = '7'; core = roman.slice(0, -1); }
    if (/\u00b0|\u2070$/.test(core)) { suffix = 'dim'; core = core.replace(/[\u00b0\u2070]/g, ''); }
    var isUpper = core === core.toUpperCase();
    var DEG = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 };
    var deg = DEG[core.toUpperCase()] || 1;
    var type;
    if (suffix === '7') type = isUpper ? 'dom7' : 'min7';
    else if (suffix === 'dim') type = 'dim';
    else type = isUpper ? 'maj' : 'min';
    return { deg: deg, alt: alt, type: type };
  }

  // 生成和声进行的和弦音（返回 [[midis], ...]），levels 用于把低音放在合适音区
  function progressionChords(key, numerals, baseOctave) {
    baseOctave = baseOctave === undefined ? 4 : baseOctave;
    var scale = key.mode === 'minor' ? NATURAL_MINOR_SCALE : MAJOR_SCALE;
    var base = (baseOctave + 1) * 12 + key.tonicPc;
    return numerals.map(function (num) {
      var p = parseNumeral(num);
      var rootMidi = base + scale[p.deg - 1] + p.alt;
      var chord = CHORD_BY_ID[p.type] || CHORD_BY_ID.maj;
      return chordNotes(rootMidi, chord, 0);
    });
  }

  /* ------------------------------- 节奏型 -------------------------------- */
  // 每个元素为 { d: 时值(拍) } 或 { r: 时值(拍) } 表示休止
  var RHYTHM_PATTERNS = {
    easy: [
      [1, 1, 1, 1],
      [2, 2],
      [2, 1, 1],
      [1, 1, 2],
      [1, 2, 1],
      [4]
    ],
    medium: [
      [1, 0.5, 0.5, 1, 1],
      [0.5, 0.5, 0.5, 0.5, 2],
      [1, 1, 0.5, 0.5, 1],
      [1.5, 0.5, 2],
      [2, 0.5, 0.5, 1],
      [0.5, 0.5, 1, 2],
      [1, 1, 1, 0.5, 0.5],
      [2, 1, 0.5, 0.5]
    ],
    hard: [
      [0.25, 0.25, 0.5, 1, 1, 1],
      [0.5, 0.25, 0.25, 1, 1, 1],
      [1, 0.5, 0.25, 0.25, 1, 1],
      [1.5, 0.5, 0.5, 0.5, 1],
      [0.75, 0.25, 1, 1, 1],
      [1, 1.5, 1.5],
      [2, 1, 0.5, 0.5],
      [{ r: 1 }, 1, 1, 1],
      [{ r: 0.5 }, 0.5, 1, 1, 1]
    ]
  };

  // 3/4 拍节奏型（央音要求覆盖 2/4、3/4、4/4 拍）
  var RHYTHM_PATTERNS_34 = {
    easy: [
      [1, 1, 1],
      [2, 1],
      [1, 2],
      [1.5, 1.5],
      [1, 0.5, 0.5, 1]
    ],
    medium: [
      [0.5, 0.5, 1, 1],
      [1, 0.5, 0.5, 1],
      [1.5, 0.5, 1],
      [1, 1, 0.5, 0.5],
      [0.5, 0.5, 2],
      [2, 0.5, 0.5]
    ],
    hard: [
      [0.25, 0.25, 0.5, 1, 1],
      [1, 0.5, 0.25, 0.25, 1],
      [1.5, 0.5, 0.5, 0.5],
      [{ r: 0.5 }, 0.5, 1, 1],
      [0.75, 0.25, 1, 1],
      [1, 1.5, 0.5]
    ]
  };

  var DUR_VEX = {    '4': 'w', '3': 'hd', '2': 'h', '1.5': 'qd', '1': 'q', '0.75': '8d', '0.5': '8', '0.25': '16'
  };
  function beatsToVexDuration(beats) {
    var k = String(beats);
    return DUR_VEX[k] || 'q';
  }
  function patternToEvents(pattern) {
    var t = 0;
    return pattern.map(function (item) {
      var dur = typeof item === 'number' ? item : (item.r !== undefined ? item.r : item.d);
      var ev = { start: t, dur: dur, rest: typeof item === 'object' && item.r !== undefined };
      t += dur;
      return ev;
    });
  }
  function patternTotal(pattern) {
    return pattern.reduce(function (a, b) {
      return a + (typeof b === 'number' ? b : (b.r !== undefined ? b.r : b.d));
    }, 0);
  }

  /* ------------------------------- 导出 ---------------------------------- */
  WB.Theory = {
    SHARP_NAMES: SHARP_NAMES,
    FLAT_NAMES: FLAT_NAMES,
    LETTERS: LETTERS,
    LETTER_PC: LETTER_PC,
    SOLFEGE_FIXED: SOLFEGE_FIXED,
    SOLFEGE_DEGREE: SOLFEGE_DEGREE,
    ACC_SYMBOL: ACC_SYMBOL,
    ACC_VEX: ACC_VEX,
    MAJOR_SCALE: MAJOR_SCALE,
    NATURAL_MINOR_SCALE: NATURAL_MINOR_SCALE,
    MAJOR_KEY_FIFTHS: MAJOR_KEY_FIFTHS,
    MINOR_KEY_FIFTHS: MINOR_KEY_FIFTHS,
    USABLE_MAJOR_KEYS: USABLE_MAJOR_KEYS,
    USABLE_MINOR_KEYS: USABLE_MINOR_KEYS,
    parseTonicName: parseTonicName,
    INTERVALS: INTERVALS,
    INTERVAL_BY_SEMIS: INTERVAL_BY_SEMIS,
    CHORDS: CHORDS,
    CHORD_BY_ID: CHORD_BY_ID,
    SCALES: SCALES,
    SCALE_BY_ID: SCALE_BY_ID,
    PROGRESSIONS: PROGRESSIONS,
    PROGRESSION_BY_ID: PROGRESSION_BY_ID,
    RHYTHM_PATTERNS: RHYTHM_PATTERNS,
    RHYTHM_PATTERNS_34: RHYTHM_PATTERNS_34,
    DEGREE_QUALITY_MAJOR: DEGREE_QUALITY_MAJOR,
    DEGREE_QUALITY_MINOR: DEGREE_QUALITY_MINOR,
    mod: mod,
    clamp: clamp,
    midiToFreq: midiToFreq,
    freqToMidi: freqToMidi,
    centsBetween: centsBetween,
    pcOf: pcOf,
    octaveOf: octaveOf,
    midiToName: midiToName,
    nameToMidi: nameToMidi,
    buildKey: buildKey,
    spellScaleFromLetter: spellScaleFromLetter,
    spellMidi: spellMidi,
    spellToName: spellToName,
    spellToVexKey: spellToVexKey,
    midiToVexKey: midiToVexKey,
    solfegeOf: solfegeOf,
    intervalById: intervalById,
    chordNotes: chordNotes,
    scaleNotes: scaleNotes,
    scaleUpDown: scaleUpDown,
    parseNumeral: parseNumeral,
    progressionChords: progressionChords,
    beatsToVexDuration: beatsToVexDuration,
    patternToEvents: patternToEvents,
    patternTotal: patternTotal
  };
})(typeof window !== 'undefined' ? window : globalThis);
