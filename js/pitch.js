/* =============================================================================
 * pitch.js  —  麦克风实时音高检测（自相关 / 归一化互相关）
 * 用于视唱音准检测与调音器，无需第三方库
 * ========================================================================== */
(function (global) {
  'use strict';
  var WB = (global.WB = global.WB || {});
  var T = WB.Theory;

  /**
   * 归一化互相关的基频检测
   * @param {Float32Array} buf  时域样本
   * @param {number} sampleRate 采样率
   * @param {object} opts {minFreq, maxFreq, threshold}
   * @return {{freq:number, clarity:number, rms:number}} freq=-1 表示未检测到
   */
  function detectPitch(buf, sampleRate, opts) {
    opts = opts || {};
    var minFreq = opts.minFreq || 60;
    var maxFreq = opts.maxFreq || 1500;
    var threshold = opts.threshold !== undefined ? opts.threshold : 0.90;
    var SIZE = buf.length;

    var rms = 0;
    for (var i = 0; i < SIZE; i++) { rms += buf[i] * buf[i]; }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.006) return { freq: -1, clarity: 0, rms: rms };

    var minLag = Math.floor(sampleRate / maxFreq);
    var maxLag = Math.min(Math.ceil(sampleRate / minFreq), SIZE - 2);
    if (minLag < 2) minLag = 2;

    // 能量归一化（对整段做一次）
    var totalEnergy = 0;
    for (var i = 0; i < SIZE; i++) { totalEnergy += buf[i] * buf[i]; }
    if (totalEnergy <= 1e-9) return { freq: -1, clarity: 0, rms: rms };

    var ncc = new Float32Array(maxLag + 2);
    var bestLag = -1, bestVal = -1;
    for (var lag = minLag; lag <= maxLag; lag++) {
      var sum = 0, e2 = 0;
      for (var j = 0; j + lag < SIZE; j++) {
        sum += buf[j] * buf[j + lag];
        e2 += buf[j + lag] * buf[j + lag];
      }
      var e1 = totalEnergy - e2; // 近似：前段能量
      var denom = Math.sqrt(Math.max(e1, 1e-9) * Math.max(e2, 1e-9));
      var v = denom > 0 ? sum / denom : 0;
      ncc[lag] = v;
      if (v > bestVal) { bestVal = v; bestLag = lag; }
    }
    if (bestLag < 0 || bestVal < 0.30) return { freq: -1, clarity: Math.max(bestVal, 0), rms: rms };

    // 取「第一个超过阈值*峰值」的局部极大，抑制八度误判
    var pick = -1;
    for (var lag = minLag + 1; lag < maxLag; lag++) {
      if (ncc[lag] > ncc[lag - 1] && ncc[lag] >= ncc[lag + 1] && ncc[lag] > bestVal * threshold) {
        pick = lag; break;
      }
    }
    if (pick < 0) pick = bestLag;

    // 抛物线插值细化
    var x1 = ncc[pick - 1] || 0, x2 = ncc[pick], x3 = ncc[pick + 1] || 0;
    var a = (x1 + x3 - 2 * x2) / 2;
    var b = (x3 - x1) / 2;
    var refined = pick;
    if (Math.abs(a) > 1e-9) refined = pick - b / (2 * a);
    if (refined < minLag) refined = pick;

    var freq = sampleRate / refined;
    if (freq < minFreq || freq > maxFreq) return { freq: bestVal > 0.5 ? sampleRate / bestLag : -1, clarity: bestVal, rms: rms };
    return { freq: freq, clarity: ncc[pick], rms: rms };
  }

  /* 频率 -> 音名/八度/音分偏差 */
  function freqToNoteInfo(freq, a4) {
    a4 = a4 || 440;
    var midiFloat = T.freqToMidi(freq, a4);
    var nearest = Math.round(midiFloat);
    var cents = (midiFloat - nearest) * 100;
    return {
      midiFloat: midiFloat,
      midi: nearest,
      cents: cents,
      name: T.midiToName(nearest, false),
      octave: T.octaveOf(nearest)
    };
  }

  /* --------------------------- 麦克风采集器 ------------------------------ */
  function Tuner() {
    this.stream = null;
    this.analyser = null;
    this.buf = null;
    this.raf = null;
    this.running = false;
    this.history = [];
  }

  Tuner.prototype.start = function (onUpdate, onError) {
    var self = this;
    if (!global.navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (onError) onError('NOT_SUPPORTED');
      return Promise.reject(new Error('NOT_SUPPORTED'));
    }
    var ctx = WB.Audio.getContext();
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    }).then(function (stream) {
      self.stream = stream;
      var src = ctx.createMediaStreamSource(stream);
      var analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      src.connect(analyser);
      self.analyser = analyser;
      self.buf = new Float32Array(analyser.fftSize);
      self.running = true;
      var tickCount = 0;
      function loop() {
        if (!self.running) return;
        self.raf = requestAnimationFrame(loop);
        tickCount++;
        if (tickCount % 2 !== 0) return; // 约 30fps，降低 CPU 占用
        analyser.getFloatTimeDomainData(self.buf);
        var res = detectPitch(self.buf, ctx.sampleRate, { minFreq: 65, maxFreq: 1400 });
        var info = null;
        if (res.freq > 0 && res.clarity > 0.55) {
          info = freqToNoteInfo(res.freq, WB.Audio.getSettings().a4);
          self.history.push(info.midiFloat);
          if (self.history.length > 5) self.history.shift();
          // 中值平滑
          var sorted = self.history.slice().sort(function (a, b) { return a - b; });
          info.midiFloatSmooth = sorted[Math.floor(sorted.length / 2)];
          info.centsSmooth = (info.midiFloatSmooth - Math.round(info.midiFloatSmooth)) * 100;
        } else {
          self.history.length = 0;
        }
        if (onUpdate) onUpdate(info, res);
      }
      loop();
      return stream;
    }).catch(function (err) {
      var code = 'DENIED';
      if (err && err.name === 'NotAllowedError') code = 'DENIED';
      else if (err && err.name === 'NotFoundError') code = 'NO_DEVICE';
      else if (err && String(err.message || '') === 'NOT_SUPPORTED') code = 'NOT_SUPPORTED';
      if (onError) onError(code, err);
      throw err;
    });
  };

  Tuner.prototype.stop = function () {
    this.running = false;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
    if (this.stream) {
      this.stream.getTracks().forEach(function (t) { t.stop(); });
      this.stream = null;
    }
    this.analyser = null;
    this.history.length = 0;
  };

  function isSupported() {
    return !!(global.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && global.isSecureContext !== false);
  }

  WB.Pitch = {
    detectPitch: detectPitch,
    freqToNoteInfo: freqToNoteInfo,
    Tuner: Tuner,
    isSupported: isSupported
  };
})(typeof window !== 'undefined' ? window : globalThis);
