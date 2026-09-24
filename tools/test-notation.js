/* 离线验证：在 jsdom 中渲染五线谱，确认 API 调用与拼写逻辑正确 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="a" style="width:600px"></div></body></html>', {
  pretendToBeVisual: true
});
const win = dom.window;
global.window = win;
global.document = win.document;
global.navigator = win.navigator;
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);

const root = path.resolve(__dirname, '..');
// VexFlow 必需在 window 上
win.Vex = require(path.join(root, 'vendor', 'vexflow.js'));
win.VexFlow = win.Vex;

for (const f of ['theory.js', 'notation.js']) {
  const code = fs.readFileSync(path.join(root, 'js', f), 'utf8');
  (new Function(code)).call(win);
}
const WB = win.WB;
const el = win.document.getElementById('a');
const T = WB.Theory;

console.log('notation available:', WB.Notation.available());

function report(tag, container) {
  const svg = container.querySelector('svg');
  const notes = container.querySelectorAll('.vf-stavenote').length;
  const acc = container.querySelectorAll('.vf-accidental').length;
  const stems = container.querySelectorAll('.vf-stem').length;
  const beams = container.querySelectorAll('.vf-beam').length;
  console.log(`${tag}: svg=${!!svg} paths=${svg ? svg.querySelectorAll('path').length : 0} notes=${notes} accidentals=${acc} stems=${stems} beams=${beams}`);
}

// 1. 调号与拼写
['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db'].forEach(k => {
  const key = T.buildKey(k);
  console.log(`major ${k.padEnd(3)} fifths=${String(key.fifths).padStart(2)} vex=${key.vexKeySig.padEnd(3)} spell=${key.spell.map(s => s.letter + (T.ACC_SYMBOL[String(s.acc)] || '')).join(' ')}`);
});
['A', 'E', 'B', 'F#', 'D', 'G', 'C', 'F', 'Bb', 'Eb'].forEach(k => {
  const key = T.buildKey(k + 'm');
  console.log(`minor ${(k + 'm').padEnd(3)} fifths=${String(key.fifths).padStart(2)} vex=${key.vexKeySig.padEnd(3)} spell=${key.spell.map(s => s.letter + (T.ACC_SYMBOL[String(s.acc)] || '')).join(' ')}`);
});

// 2. C 大调旋律
const keyC = T.buildKey('C');
let r = WB.Notation.renderStave(el, {
  clef: 'treble', keySig: keyC.vexKeySig, timeSig: '4/4', key: keyC,
  notes: [60, 62, 64, 65, 67, 69, 71, 72].map(m => ({ midi: m, beats: 0.5 })), width: 600
});
report('C-major melody(8th)', el);

// 3. Eb 大调（降号调）旋律
const keyEb = T.buildKey('Eb');
WB.Notation.renderStave(el, {
  clef: 'treble', keySig: keyEb.vexKeySig, timeSig: '4/4', key: keyEb,
  notes: [63, 65, 67, 68, 70, 72, 74, 75].map(m => ({ midi: m, beats: 1 })), width: 600
});
report('Eb-major melody', el);

// 4. 含变化音：F 大调里出现 B 本位
const keyF = T.buildKey('F');
WB.Notation.renderStave(el, {
  clef: 'treble', keySig: keyF.vexKeySig, timeSig: '4/4', key: keyF,
  notes: [70, 71, 70, 69].map(m => ({ midi: m, beats: 1 })), width: 500
});
report('F-major with B natural', el);

// 5. 节奏型（含休止/附点）
WB.Notation.renderRhythm(el, [1, 0.5, 0.5, 1, 0.5, 0.5, 0.5], { width: 600 });
report('rhythm mixed', el);
WB.Notation.renderRhythm(el, [1.5, 0.5, { r: 1 }, 1, 1], { width: 600 });
report('rhythm dotted+rest', el);
WB.Notation.renderRhythm(el, [0.25, 0.25, 0.5, 1, 1, 1], { width: 600 });
report('rhythm 16ths', el);

// 6. 低频谱表
WB.Notation.renderStave(el, {
  clef: 'bass', keySig: T.buildKey('F').vexKeySig, timeSig: '4/4', key: T.buildKey('F'),
  notes: [48, 50, 52, 53].map(m => ({ midi: m, beats: 1 })), width: 500
});
report('bass clef', el);

// 7. 和声进行 & 音级
const keyG = T.buildKey('G');
console.log('progression I-IV-V-I in G:', JSON.stringify(T.progressionChords(keyG, ['I', 'IV', 'V', 'I'], 4)));
console.log('progression i-VI-III-VII in Am:', JSON.stringify(T.progressionChords(T.buildKey('Am'), ['i', 'VI', 'III', 'VII'], 4)));
console.log('parse ii7:', JSON.stringify(T.parseNumeral('ii7')), 'V7:', JSON.stringify(T.parseNumeral('V7')));
console.log('scale majorNotes C:', JSON.stringify(T.scaleNotes(60, T.SCALE_BY_ID.major)));
console.log('solfege E4 in G major:', JSON.stringify(T.solfegeOf(64, keyG)));
console.log('ALL OK');
