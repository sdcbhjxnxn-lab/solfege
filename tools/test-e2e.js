/* =============================================================================
 * test-e2e.js — 离线端到端验证
 * 用 jsdom 加载真实的 index.html（执行全部脚本），注入假 AudioContext / Canvas2D，
 * 然后逐一挂载所有视图、枚举全部题型×难度生成题目并校验。
 * 运行： NODE_PATH=<jsdom所在> node tools/test-e2e.js
 * ========================================================================== */
const { JSDOM } = require('jsdom');
const path = require('path');

/* --------------------------- 假 AudioContext ---------------------------- */
class FakeParam {
  constructor(v) { this.value = v || 0; }
  setValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  setTargetAtTime() { return this; }
  cancelScheduledValues() { return this; }
}
class FakeNode {
  constructor(ctx, kind) {
    this.ctx = ctx; this.kind = kind; this._connected = [];
    this.gain = new FakeParam(); this.frequency = new FakeParam();
    this.detune = new FakeParam(); this.Q = new FakeParam();
    this.threshold = new FakeParam(); this.knee = new FakeParam();
    this.ratio = new FakeParam(); this.attack = new FakeParam(); this.release = new FakeParam();
  }
  connect(n) { this._connected.push(n); return n; }
  disconnect() { }
  start() { }
  stop() { }
  getFloatTimeDomainData(buf) { for (let i = 0; i < buf.length; i++) buf[i] = 0; }
}
class FakeAudioContext {
  constructor() {
    this.currentTime = 0; this.state = 'running'; this.sampleRate = 48000;
    this.destination = new FakeNode(this, 'destination');
  }
  createGain() { return new FakeNode(this, 'gain'); }
  createOscillator() { return new FakeNode(this, 'osc'); }
  createBiquadFilter() { return new FakeNode(this, 'biquad'); }
  createDynamicsCompressor() { return new FakeNode(this, 'comp'); }
  createAnalyser() { const n = new FakeNode(this, 'analyser'); n.fftSize = 2048; n.smoothingTimeConstant = 0; return n; }
  createMediaStreamSource() { return new FakeNode(this, 'src'); }
  resume() { this.state = 'running'; return Promise.resolve(); }
}
function fakeCanvas2D() {
  const noop = () => { };
  return {
    canvas: null, fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: '', lineJoin: '',
    font: '', globalAlpha: 1, textAlign: '',
    setTransform: noop, clearRect: noop, fillRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, stroke: noop, fill: noop, save: noop, restore: noop,
    translate: noop, rotate: noop, scale: noop, fillText: noop, strokeText: noop,
    createLinearGradient: () => ({ addColorStop: noop }), measureText: () => ({ width: 10 })
  };
}

/* ------------------------------- 断言工具 -------------------------------- */
let pass = 0, fail = 0;
const failures = [];
function ok(cond, msg) { if (cond) { pass++; } else { fail++; failures.push(msg); } }
function eq(actual, expected, msg) {
  if (actual === expected) pass++;
  else { fail++; failures.push(msg + '  期望=' + JSON.stringify(expected) + ' 实际=' + JSON.stringify(actual)); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const rootDir = path.resolve(__dirname, '..');
const indexFile = path.join(rootDir, 'index.html');

JSDOM.fromFile(indexFile, {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = FakeAudioContext;
    window.HTMLCanvasElement.prototype.getContext = function () { return fakeCanvas2D(); };
    window.scrollTo = function () { };
    window.console = console;
  }
}).then((dom) => {
  const win = dom.window;
  return new Promise((resolve) => {
    win.addEventListener('load', () => setTimeout(() => resolve(win), 60));
  });
}).then(async (win) => {
  const doc = win.document;
  const tick = (n) => new Promise((r) => setTimeout(r, n || 20));

  section('脚本加载与命名空间');
  const WB = win.WB;
  ok(!!WB, 'window.WB 未定义');
  ['Theory', 'Icons', 'UI', 'Store', 'Audio', 'Pitch', 'Notation', 'Trainers', 'Sight', 'Ref', 'Home', 'StatsPage', 'SettingsPage', 'App']
    .forEach((k) => ok(WB && WB[k], '缺少命名空间 WB.' + k));
  ok(WB.Notation.available(), 'VexFlow 未加载（WB.Notation.available() 为 false）');
  ok(doc.querySelector('#nav').children.length === 6, '主导航应有 6 项，实际 ' + doc.querySelector('#nav').children.length);
  ok(!!doc.querySelector('.mode-card'), '首页应渲染题型卡片');

  const T = WB.Theory;

  section('乐理：调号与拼写（12 大调 + 10 小调）');
  const MAJ = { C: 'C D E F G A B', G: 'G A B C D E F#', D: 'D E F# G A B C#', A: 'A B C# D E F# G#', E: 'E F# G# A B C# D#', B: 'B C# D# E F# G# A#', 'F#': 'F# G# A# B C# D# E#', F: 'F G A Bb C D E', Bb: 'Bb C D Eb F G A', Eb: 'Eb F G Ab Bb C D', Ab: 'Ab Bb C Db Eb F G', Db: 'Db Eb F Gb Ab Bb C' };
  Object.keys(MAJ).forEach((k) => {
    const key = T.buildKey(k);
    const got = key.spell.map((s) => s.letter + (s.acc > 0 ? '#'.repeat(s.acc) : 'b'.repeat(-s.acc))).join(' ');
    eq(got, MAJ[k], '大调 ' + k + ' 拼写错误');
  });
  const MIN = { Am: 'A B C D E F G', Em: 'E F# G A B C D', Bm: 'B C# D E F# G A', 'F#m': 'F# G# A B C# D E', Dm: 'D E F G A Bb C', Gm: 'G A Bb C D Eb F', Cm: 'C D Eb F G Ab Bb', Fm: 'F G Ab Bb C Db Eb' };
  Object.keys(MIN).forEach((k) => {
    const key = T.buildKey(k);
    const got = key.spell.map((s) => s.letter + (s.acc > 0 ? '#'.repeat(s.acc) : 'b'.repeat(-s.acc))).join(' ');
    eq(got, MIN[k], '小调 ' + k + ' 拼写错误');
  });
  eq(T.buildKey('Eb').vexKeySig, 'Eb', 'Eb 的 VexFlow 调号名');
  eq(T.buildKey('F#m').vexKeySig, 'F#m', 'F#m 的 VexFlow 调号名');
  eq(T.midiToFreq(69, 440).toFixed(2), '440.00', 'A4 频率');
  eq(T.midiToFreq(60, 440).toFixed(2), '261.63', 'C4 频率');
  eq(T.nameToMidi('Bb3'), 58, 'Bb3 -> MIDI');
  eq(T.nameToMidi('F#5'), 78, 'F#5 -> MIDI');

  section('和声进行与音级');
  const chC = T.progressionChords(T.buildKey('C'), ['I', 'IV', 'V', 'I'], 4);
  eq(JSON.stringify(chC), JSON.stringify([[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]]), 'C 大调 I-IV-V-I 和弦音');
  const chAm = T.progressionChords(T.buildKey('Am'), ['i', 'VI', 'III', 'VII'], 4);
  eq(chAm[0].join(','), '69,72,76', 'a 小调 i 级和弦');
  eq(T.solfegeOf(64, T.buildKey('G')).text, 'la', 'G 大调中 E4 的首调唱名应为 la');
  eq(T.solfegeOf(64, T.buildKey('C')).text, 'mi', 'C 大调中 E4 的首调唱名应为 mi');

  section('节奏型数据完整性');
  const meters = [['4/4', T.RHYTHM_PATTERNS, 4], ['3/4', T.RHYTHM_PATTERNS_34, 3]];
  meters.forEach(([meter, set, per]) => {
    ['easy', 'medium', 'hard'].forEach((lv) => {
      set[lv].forEach((p, i) => {
        const sum = T.patternTotal(p);
        ok(Math.abs(sum - per) < 1e-9, meter + ' ' + lv + ' 第' + i + '条节奏总时值=' + sum + '，应为 ' + per);
      });
    });
  });

  section('所有题型 × 难度 生成校验');
  const LEVELS = ['easy', 'medium', 'hard'];
  WB.Trainers.META.forEach((m) => {
    LEVELS.forEach((lv) => {
      for (let i = 0; i < 24; i++) {
        let q, err = null;
        try { q = WB.Trainers.GEN[m.id](lv); } catch (e) { err = e; }
        if (err) { fail++; failures.push(m.id + '/' + lv + ' 生成异常: ' + err.message); break; }
        ok(Array.isArray(q.options) && q.options.length >= 2, m.id + '/' + lv + ' 选项数不足');
        const values = q.options.map((o) => String(o.value));
        ok(values.indexOf(String(q.answer)) >= 0, m.id + '/' + lv + ' 正确答案不在选项中：' + q.answer);
        ok(new Set(values).size === values.length, m.id + '/' + lv + ' 选项值重复');
        ok(!!q.answerLabel && q.answerLabel.length > 0, m.id + '/' + lv + ' 缺少 answerLabel');
        ok(!!q.detail && q.detail.length > 0, m.id + '/' + lv + ' 缺少解析 detail');
        ok(!!q.prompt, m.id + '/' + lv + ' 缺少题干');
        let dur = null;
        try { dur = q.play(); } catch (e) { fail++; failures.push(m.id + '/' + lv + ' play() 异常: ' + e.message); break; }
        ok(typeof dur === 'number' && isFinite(dur) && dur > 0, m.id + '/' + lv + ' play() 返回时长非法: ' + dur);
        // 谱例选项可渲染
        if (q.optionKind === 'notation') {
          const host = doc.createElement('div');
          doc.body.appendChild(host);
          const o = q.options[0].notation;
          try {
            if (o.kind === 'rhythm') WB.Notation.renderRhythm(host, o.pattern, { timeSig: o.timeSig, width: 320 });
            else WB.Notation.renderStave(host, { clef: 'treble', keySig: o.key.vexKeySig, key: o.key, notes: o.midis.map((x) => ({ midi: x, beats: 1 })), width: 320 });
          } catch (e) { fail++; failures.push(m.id + '/' + lv + ' 谱例渲染异常: ' + e.message); }
          ok(!!host.querySelector('svg'), m.id + '/' + lv + ' 谱例选项未渲染出 SVG');
          doc.body.removeChild(host);
        }
        // 错题重放可用
        const rp = WB.Trainers.replay(m.id, q.payload);
        ok(typeof rp === 'function', m.id + '/' + lv + ' 缺少重放函数');
        if (rp) { try { rp(); } catch (e) { fail++; failures.push(m.id + '/' + lv + ' 重放异常: ' + e.message); } }
      }
    });
  });

  section('各视图挂载');
  const views = [
    ['#home', '.hero'],
    ['#ear', '.mode-grid'],
    ['#ear/interval', '.trainer .quiz-card'],
    ['#ear/rhythm', '.quiz-options.options-notation'],
    ['#ear/melody', '.quiz-options.options-notation'],
    ['#sight', '.page-sight'],
    ['#ref', '.page-ref'],
    ['#stats', '.stat-cards'],
    ['#stats/wrong', '.page-stats'],
    ['#settings', '.set-row']
  ];
  for (const [hash, sel] of views) {
    win.location.hash = hash;
    await tick(70);
    const host = doc.querySelector('#view');
    ok(!!host.querySelector(sel), '视图 ' + hash + ' 未找到元素 ' + sel + '（内容长度 ' + host.innerHTML.length + '）');
    ok(host.querySelector('.err') === null, '视图 ' + hash + ' 出现错误面板');
  }

  section('乐理速查各标签页');
  for (const tab of ['note', 'interval', 'chord', 'scale', 'progression', 'cof', 'keyboard']) {
    win.location.hash = '#ref/' + tab;
    await tick(60);
    const host = doc.querySelector('#view');
    ok(!host.querySelector('.err'), '乐理页 ' + tab + ' 出现错误');
  }
  win.location.hash = '#ref/keyboard';
  await tick(60);
  ok(!!doc.querySelector('.piano-svg'), '键盘页未渲染钢琴 SVG');
  win.location.hash = '#ref/cof';
  await tick(60);
  ok(doc.querySelectorAll('.cof-sector').length === 24, '五度圈扇区数应为 24，实际 ' + doc.querySelectorAll('.cof-sector').length);

  section('答题引擎交互（练习模式）');
  win.location.hash = '#ear/interval';
  await tick(80);
  const optBtns = doc.querySelectorAll('#view .opt');
  ok(optBtns.length >= 7, '音程题选项数应 >= 7，实际 ' + optBtns.length);
  const firstLabel = doc.querySelector('#view .quiz-prompt').textContent;
  ok(!!firstLabel, '题干为空');
  optBtns[0].click();
  await tick(40);
  ok(!!doc.querySelector('#view .quiz-feedback.ok') || !!doc.querySelector('#view .quiz-feedback.bad'), '作答后未出现反馈');
  ok(!!doc.querySelector('#view .opt-correct'), '作答后未标记正确选项');
  const nextBtn = doc.querySelector('#view .quiz-actions .btn-primary');
  ok(nextBtn && !nextBtn.disabled, '下一题按钮应可用');
  nextBtn.click();
  await tick(40);
  ok(doc.querySelectorAll('#view .opt-correct').length === 0, '进入下一题后应清除上题标记');

  section('答题引擎交互（测验模式 5 题并结算）');
  const wrongBeforeTest = WB.Store.listWrong().length;
  win.location.hash = '#ear/scale';
  await tick(90);
  // 切换到测验
  const modePills = Array.from(doc.querySelectorAll('#view .trainer-head-right .pill'));
  const testPill = modePills.find((p) => p.textContent === '测验');
  ok(!!testPill, '未找到「测验」模式按钮');
  testPill.click();
  await tick(90);
  const countPill = Array.from(doc.querySelectorAll('#view .pill')).find((p) => p.textContent.replace(/\s/g, '') === '5题');
  ok(!!countPill, '未找到「5 题」题量按钮');
  if (countPill) { countPill.click(); await tick(90); }
  ok(doc.querySelector('#view .quiz-meta') && /5/.test(doc.querySelector('#view .quiz-meta').textContent), '测验进度应显示 5 题');
  let guard = 0;
  while (!doc.querySelector('#view .result') && guard++ < 12) {
    const opts = doc.querySelectorAll('#view .opt');
    if (!opts.length) break;
    opts[0].click();
    await tick(430);   // 测验模式自动进入下一题需等待内部定时器
  }
  ok(!!doc.querySelector('#view .result'), '测验完成 5 题后应显示结算页');
  ok(!!doc.querySelector('#view .result-score-num'), '结算页缺少得分');
  ok(doc.querySelectorAll('#view .review-row').length === 5, '结算页应含 5 条逐题回顾，实际 ' + doc.querySelectorAll('#view .review-row').length);
  ok(doc.querySelector('#view .result-stats') !== null, '结算页缺少统计区');

  section('错题本记录与重放');
  win.location.hash = '#ear/single';
  await tick(90);
  let sawWrong = false;
  for (let i = 0; i < 14 && !sawWrong; i++) {
    const opts = Array.from(doc.querySelectorAll('#view .opt'));
    if (!opts.length) break;
    // 故意选择「非正确项」：先点第 1 项；若正确则继续下一题
    opts[0].click();
    await tick(50);
    if (doc.querySelector('#view .quiz-feedback.bad')) sawWrong = true;
    else {
      const nb = doc.querySelector('#view .quiz-actions .btn-primary');
      if (nb && !nb.disabled) { nb.click(); await tick(50); }
    }
  }
  ok(sawWrong, '14 次尝试内未产生一次错误作答（异常）');
  const wrongAfter = WB.Store.listWrong();
  ok(wrongAfter.length > wrongBeforeTest, '错题本未记录新增错题：' + wrongBeforeTest + ' -> ' + wrongAfter.length);
  if (wrongAfter[0]) {
    ok(!!wrongAfter[0].answerLabel, '错题记录缺少正确答案');
    ok(!!wrongAfter[0].payload, '错题记录缺少重放载荷');
    let replayOk = true;
    try { const fn = WB.Trainers.replay(wrongAfter[0].type, wrongAfter[0].payload); replayOk = typeof fn === 'function'; if (fn) fn(); } catch (e) { replayOk = false; }
    ok(replayOk, '错题重放失败');
  }
  win.location.hash = '#stats/wrong';
  await tick(90);
  ok(doc.querySelectorAll('#view .wrong-row').length > 0, '错题本页面未列出错题');
  ok(!!doc.querySelector('#view .wrong-row .btn-mini'), '错题本缺少重放按钮');

  section('视唱：谱面与节奏模仿');
  win.location.hash = '#sight';
  await tick(90);
  const staffSvg = doc.querySelector('#view .staff-panel svg');
  ok(!!staffSvg, '视唱谱面未渲染 SVG');
  const barLines = doc.querySelectorAll('#view .staff-panel .vf-stave').length;
  ok(barLines >= 2, '视唱谱应包含多个小节，实际 ' + barLines);

  // ---- 谱面几何回归（以下缺陷都曾在真实浏览器中复现，此处做离线守卫） ----
  // 1) 节奏谱音符必须落在谱表中间线。旧实现传 midi:null → spellMidi(null) 算出 C-1，
  //    VexFlow 把音符头画到谱表下方约 200px 并配 200px 长符干，整条被 SVG 视口裁掉，
  //    用户看到的是「没有任何音符的空谱表」。jsdom 无 getBBox，故直接解析符干的 path 数据。
  const stemLengths = (root) => {
    const out = [];
    Array.from(root.querySelectorAll('g.vf-stem')).forEach((g) => {
      Array.from(g.querySelectorAll('path')).forEach((p) => {
        const m = /^M\s*(-?[\d.]+)\s+(-?[\d.]+)\s*L\s*(-?[\d.]+)\s+(-?[\d.]+)$/.exec((p.getAttribute('d') || '').trim());
        if (m) out.push(Math.abs(parseFloat(m[4]) - parseFloat(m[2])));
      });
    });
    return out;
  };
  {
    const N = win.WB.Notation;
    const host = doc.createElement('div');
    host.style.width = '300px';
    doc.body.appendChild(host);
    N.renderRhythm(host, [1, 1, 1, 1], { timeSig: '4/4', width: 300 });
    const heads = host.querySelectorAll('.vf-notehead').length;
    const stems = stemLengths(host);
    ok(heads === 4, '节奏谱音符头数量异常，实际 ' + heads);
    ok(stems.length === 4, '节奏谱符干数量异常，实际 ' + stems.length);
    ok(stems.every((v) => v > 0 && v <= 60),
      '节奏谱符干长度异常（音符落到了谱表之外）：' + stems.map((v) => Math.round(v)).join(','));
    ok(!!host.querySelector('svg g.vf-stave'),
      '节奏谱缺少谱表');
    host.remove();
  }
  // 2) 高音谱表最小高度：VexFlow 把第 0 条线放在 y+40、谱表框高 90，
  //    旧公式按「第 0 线 ≈ y」估算高度，漏算 40px 偏移 → 谱表下半部与音符被裁
  //    （见 skill vexflow4-notation 的「垂直几何」一节）。
  {
    const N = win.WB.Notation;
    const host = doc.createElement('div');
    host.style.width = '600px';
    doc.body.appendChild(host);
    const single = N.renderStave(host, {
      clef: 'treble', keySig: 'C', timeSig: '4/4',
      notes: [{ midi: 71, beats: 1 }], width: 600
    });
    ok(!!single && single.height >= 120, '单谱表高度不足（会裁掉谱表下半部），实际 ' + (single && single.height));
    const system = N.renderSystem(host, {
      clef: 'treble', keySig: 'C', timeSig: '4/4',
      bars: [[{ midi: 71, beats: 2 }], [{ midi: 72, beats: 2 }]], width: 600
    });
    ok(!!system && system.height >= 120, '多小节系统高度不足（会裁掉谱表下半部），实际 ' + (system && system.height));
    host.remove();
  }
  // 3) 视唱每小节总时值必须等于拍号拍数。旧实现把含休止符的节奏型「过滤」而非等值替换，
  //    如 4/4 的 [{r:1},1,1,1] 过滤后只剩 3 拍 → 小节线位置与拍号不符、节拍器对不齐。
  {
    const N = win.WB.Notation;
    const origSystem = N.renderSystem;
    const captured = [];
    N.renderSystem = function (c, spec) {
      if (spec && spec.bars) captured.push(spec);
      return origSystem.apply(N, arguments);
    };
    win.location.hash = '#home';
    await tick(60);
    win.location.hash = '#sight';
    await tick(90);
    const pick = (label, value) => {
      const groups = Array.from(doc.querySelectorAll('#view .ctrl-bar .ctrl-group'));
      const g = groups.find((x) => ((x.querySelector('.ctrl-label') || {}).textContent || '').trim() === label);
      if (!g) return false;
      const b = Array.from(g.querySelectorAll('.pill')).find((x) => x.textContent.trim() === value);
      if (b) b.click();
      return !!b;
    };
    for (const ts of ['2/4', '3/4', '4/4']) {
      pick('拍号', ts);
      for (const lv of ['初级', '中级', '高级']) {
        pick('难度', lv);
        for (let i = 0; i < 6; i++) {
          const btn = doc.querySelectorAll('#view .ctrl-bar .btn')[0];
          if (btn) btn.click();
        }
      }
    }
    N.renderSystem = origSystem;
    // 休止符若未被等值替换，beats 会是对象 {r:0.5}，求和得到非数值——必须显式判非数值，
    // 否则 `NaN > 1e-6` 恒为 false，检查会静默放行。
    const nonNumeric = [];
    const bad = [];
    captured.forEach((spec) => {
      const per = parseInt(String(spec.timeSig).split('/')[0], 10);
      spec.bars.forEach((bar, bi) => {
        bar.forEach((n) => {
          if (typeof n.beats !== 'number' || !isFinite(n.beats)) nonNumeric.push(spec.timeSig + ':' + JSON.stringify(n.beats));
        });
        const sum = bar.reduce((a, n) => a + (typeof n.beats === 'number' ? n.beats : NaN), 0);
        if (!isFinite(sum) || Math.abs(sum - per) > 1e-6) {
          bad.push(spec.timeSig + ' 第' + (bi + 1) + '小节=' + sum + '拍');
        }
      });
    });
    ok(captured.length >= 20, '视唱谱面捕获样本不足，实际 ' + captured.length);
    ok(nonNumeric.length === 0, '视唱谱面存在非数值时值（休止符未被等值替换）：' + nonNumeric.slice(0, 5).join(', '));
    ok(bad.length === 0, '视唱小节时值与拍号不符：' + bad.slice(0, 5).join('; '));
  }
  // 节奏模仿标签
  const segs = Array.from(doc.querySelectorAll('#view .seg-tab'));
  const tapSeg = segs.find((s) => s.textContent.indexOf('节奏模仿') >= 0);
  ok(!!tapSeg, '未找到节奏模仿标签');
  if (tapSeg) {
    tapSeg.click();
    await tick(90);
    ok(!!doc.querySelector('#view .tap-pad'), '节奏模仿页缺少击拍区');
    ok(!!doc.querySelector('#view .tap-panel .staff-panel svg'), '节奏模仿页缺少节奏谱');
  }
  // 音准仪标签
  win.location.hash = '#sight';
  await tick(80);
  const segs2 = Array.from(doc.querySelectorAll('#view .seg-tab'));
  const tunerSeg = segs2.find((s) => s.textContent.indexOf('音准仪') >= 0);
  if (tunerSeg) {
    tunerSeg.click();
    await tick(80);
    ok(!!doc.querySelector('#view .tuner-display'), '音准仪页缺少显示区');
  }

  section('统计与错题本');
  win.location.hash = '#stats';
  await tick(90);
  ok(!!doc.querySelector('#view .perf-list'), '统计页缺少各题型表现');
  ok(doc.querySelectorAll('#view .ach').length >= 10, '成就数量异常');
  ok(doc.querySelectorAll('#view .sess-row').length > 0, '统计页缺少练习记录');

  section('设置项交互');
  win.location.hash = '#settings';
  await tick(80);
  const sw = doc.querySelector('#view .switch');
  ok(!!sw, '未找到开关控件');
  if (sw) {
    const before = sw.classList.contains('on');
    sw.click();
    await tick(30);
    ok(sw.classList.contains('on') !== before, '开关点击后状态未变化');
  }
  const sel = doc.querySelector('#view .select');
  ok(!!sel && sel.options.length >= 5, '音色下拉选项不足');

  section('数据持久化（localStorage 或内存降级）');
  const st = WB.Store.getStats();
  ok(st.totalAttempts > 0, '统计未记录答题数: ' + st.totalAttempts);
  const s2 = WB.Store.saveSettings({ volume: 0.55 });
  eq(s2.volume, 0.55, '设置保存失败');
  const dump = JSON.parse(WB.Store.exportAll());
  ok(dump.app === 'solfege-trainer', '导出格式错误');
  ok(dump.stats && dump.stats.totalAttempts > 0, '导出缺少统计');

  section('主题切换');
  const before = doc.documentElement.dataset.theme;
  WB.App.toggleTheme();
  await tick(60);
  ok(doc.documentElement.dataset.theme !== before, '主题未切换');
  WB.App.toggleTheme();
  await tick(60);
  eq(doc.documentElement.dataset.theme, before, '主题未切回');

  console.log('\n---------------------------------------------');
  console.log('通过：' + pass + '    失败：' + fail);
  if (fail) {
    console.log('\n失败明细（最多 40 条）：');
    failures.slice(0, 40).forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f));
    process.exitCode = 1;
  } else {
    console.log('全部通过 ✓');
  }
  win.close();
}).catch((e) => {
  console.error('测试执行异常：', e);
  process.exitCode = 1;
});
