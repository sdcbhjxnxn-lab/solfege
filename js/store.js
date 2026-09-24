/* =============================================================================
 * store.js  —  本地数据持久化（localStorage）
 * 设置 / 训练统计 / 错题本 / 练习记录 / 导入导出
 * ========================================================================== */
(function (global) {
  'use strict';
  var WB = (global.WB = global.WB || {});
  var NS = 'solfege.v1.';

  var DEFAULT_SETTINGS = {
    theme: 'dark',
    instrument: 'piano',
    volume: 0.8,
    a4: 440,
    autoPlay: true,
    shortcuts: true,
    confetti: true,
    questionCount: 10,
    level: 'easy'
  };

  var memFallback = {};
  var usable = (function () {
    try {
      var k = NS + '__t';
      global.localStorage.setItem(k, '1');
      global.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  function rawGet(k) {
    if (!usable) return memFallback[k] === undefined ? null : memFallback[k];
    try { return global.localStorage.getItem(NS + k); } catch (e) { return null; }
  }
  function rawSet(k, v) {
    if (!usable) { memFallback[k] = v; return; }
    try { global.localStorage.setItem(NS + k, v); } catch (e) { /* 容量或隐私模式 */ }
  }
  function rawDel(k) {
    if (!usable) { delete memFallback[k]; return; }
    try { global.localStorage.removeItem(NS + k); } catch (e) { /* noop */ }
  }

  function getJSON(k, def) {
    var raw = rawGet(k);
    if (raw === null || raw === undefined) return def;
    try { return JSON.parse(raw); } catch (e) { return def; }
  }
  function setJSON(k, v) { rawSet(k, JSON.stringify(v)); }

  /* ------------------------------ 设置 ---------------------------------- */
  function getSettings() {
    var s = getJSON('settings', {});
    return Object.assign({}, DEFAULT_SETTINGS, s || {});
  }
  function saveSettings(patch) {
    var s = Object.assign(getSettings(), patch || {});
    setJSON('settings', s);
    return s;
  }

  /* ------------------------------ 统计 ---------------------------------- */
  function emptyStats() {
    return {
      byType: {},
      totalAttempts: 0,
      totalCorrect: 0,
      bestStreak: 0,
      days: {}
    };
  }
  function getStats() {
    return Object.assign(emptyStats(), getJSON('stats', {}) || {});
  }
  function recordAnswer(type, correct, meta) {
    var st = getStats();
    var t = st.byType[type] || { attempts: 0, correct: 0, bestStreak: 0, streak: 0, lastAt: 0 };
    t.attempts += 1;
    if (correct) t.correct += 1;
    st.totalAttempts += 1;
    if (correct) st.totalCorrect += 1;
    t.lastAt = Date.now();
    st.byType[type] = t;
    var day = new Date().toISOString().slice(0, 10);
    st.days[day] = st.days[day] || { attempts: 0, correct: 0 };
    st.days[day].attempts += 1;
    if (correct) st.days[day].correct += 1;
    setJSON('stats', st);
    if (meta && meta.streak !== undefined && meta.streak > st.bestStreak) {
      st.bestStreak = meta.streak;
      setJSON('stats', st);
    }
    return t;
  }
  function bumpStreak(type, streak) {
    var st = getStats();
    var t = st.byType[type] || { attempts: 0, correct: 0, bestStreak: 0, streak: 0 };
    t.streak = streak;
    if (streak > (t.bestStreak || 0)) t.bestStreak = streak;
    st.byType[type] = t;
    if (streak > (st.bestStreak || 0)) st.bestStreak = streak;
    setJSON('stats', st);
  }
  function resetStats() { rawDel('stats'); }

  /* ----------------------------- 错题本 --------------------------------- */
  var WRONG_MAX = 300;
  function listWrong() { return getJSON('wrongbook', []) || []; }
  function addWrong(item) {
    var list = listWrong();
    // 去重：同题型同答案且题干相同则更新时间
    var sig = item.type + '|' + item.answerLabel + '|' + (item.prompt || '');
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].sig === sig) { idx = i; break; }
    }
    var rec = {
      id: item.id || ('w' + Date.now() + Math.floor(Math.random() * 1000)),
      sig: sig,
      type: item.type,
      typeName: item.typeName,
      level: item.level,
      prompt: item.prompt,
      answerLabel: item.answerLabel,
      chosenLabel: item.chosenLabel,
      detail: item.detail,
      payload: item.payload,
      count: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    if (idx >= 0) {
      rec.count = (list[idx].count || 1) + 1;
      rec.id = list[idx].id;
      rec.createdAt = list[idx].createdAt;
      list.splice(idx, 1);
    }
    list.unshift(rec);
    if (list.length > WRONG_MAX) list = list.slice(0, WRONG_MAX);
    setJSON('wrongbook', list);
    return rec;
  }
  function removeWrong(id) {
    var list = listWrong().filter(function (w) { return w.id !== id; });
    setJSON('wrongbook', list);
  }
  function clearWrong() { rawDel('wrongbook'); }

  /* --------------------------- 练习/测验记录 ----------------------------- */
  var SESSION_MAX = 120;
  function listSessions() { return getJSON('sessions', []) || []; }
  function addSession(s) {
    var list = listSessions();
    list.unshift(Object.assign({ at: Date.now() }, s));
    if (list.length > SESSION_MAX) list = list.slice(0, SESSION_MAX);
    setJSON('sessions', list);
    return list[0];
  }
  function clearSessions() { rawDel('sessions'); }

  /* --------------------------- 成就（徽章） ------------------------------ */
  function getAchievements() { return getJSON('achievements', []) || []; }
  function unlockAchievement(id, title) {
    var list = getAchievements();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return false;
    list.push({ id: id, title: title, at: Date.now() });
    setJSON('achievements', list);
    return true;
  }

  /* ------------------------------ 导入导出 ------------------------------- */
  function exportAll() {
    return JSON.stringify({
      app: 'solfege-trainer',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: getSettings(),
      stats: getStats(),
      wrongbook: listWrong(),
      sessions: listSessions(),
      achievements: getAchievements()
    }, null, 2);
  }
  function download(filename, text) {
    var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }
  function importAll(text) {
    var data = JSON.parse(text);
    if (!data || data.app !== 'solfege-trainer') throw new Error('文件格式不匹配');
    if (data.settings) setJSON('settings', data.settings);
    if (data.stats) setJSON('stats', data.stats);
    if (data.wrongbook) setJSON('wrongbook', data.wrongbook);
    if (data.sessions) setJSON('sessions', data.sessions);
    if (data.achievements) setJSON('achievements', data.achievements);
    return true;
  }
  function clearAll() {
    ['settings', 'stats', 'wrongbook', 'sessions', 'achievements'].forEach(rawDel);
  }

  WB.Store = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    usable: usable,
    getSettings: getSettings,
    saveSettings: saveSettings,
    getStats: getStats,
    recordAnswer: recordAnswer,
    bumpStreak: bumpStreak,
    resetStats: resetStats,
    listWrong: listWrong,
    addWrong: addWrong,
    removeWrong: removeWrong,
    clearWrong: clearWrong,
    listSessions: listSessions,
    addSession: addSession,
    clearSessions: clearSessions,
    getAchievements: getAchievements,
    unlockAchievement: unlockAchievement,
    exportAll: exportAll,
    importAll: importAll,
    download: download,
    clearAll: clearAll
  };
})(typeof window !== 'undefined' ? window : globalThis);
