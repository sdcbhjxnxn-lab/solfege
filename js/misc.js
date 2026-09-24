/* =============================================================================
 * misc.js  —  首页 / 学习统计 / 错题本 / 设置
 * ========================================================================== */
(function (global) {
  'use strict';
  var WB = (global.WB = global.WB || {});
  var T = WB.Theory;
  var A = WB.Audio;
  var U = WB.UI;
  var I = WB.Icons;
  var S = WB.Store;

  var SHARP = '\u266f';

  /* =============================== 首页 ================================= */
  function homeMount(container, opts) {
    opts = opts || {};
    container.innerHTML = '';
    var st = S.getStats();
    var sessions = S.listSessions();
    var wrong = S.listWrong();
    var root = U.el('div', { class: 'page page-home' });
    container.appendChild(root);

    var hero = U.el('div', { class: 'hero' }, [
      U.el('div', { class: 'hero-main' }, [
        U.el('h1', { class: 'hero-title' }, '视唱练耳训练台'),
        U.el('p', { class: 'hero-sub' }, '体系化练耳 · 音准视唱 · 乐理速查。基于中央音乐学院视唱练耳分级要求设计，全部音频实时合成，可完全离线运行。'),
        U.el('div', { class: 'hero-actions' }, [
          U.el('button', {
            class: 'btn btn-primary btn-lg', type: 'button',
            on: { click: function () { WB.App.navigate('ear'); } }
          }, [U.el('span', { class: 'btn-icon', html: I.svgFilled('play', 15) }), U.el('span', { text: '开始练耳' })]),
          U.el('button', {
            class: 'btn btn-ghost btn-lg', type: 'button',
            on: { click: function () { WB.App.navigate('sight'); } }
          }, [U.el('span', { class: 'btn-icon', html: I.svg('mic', 15) }), U.el('span', { text: '视唱训练' })]),
          U.el('button', {
            class: 'btn btn-ghost btn-lg', type: 'button',
            on: { click: function () { WB.App.navigate('ref'); } }
          }, [U.el('span', { class: 'btn-icon', html: I.svg('book', 15) }), U.el('span', { text: '乐理速查' })])
        ])
      ]),
      U.el('div', { class: 'hero-stats' }, [
        statBlock(String(st.totalAttempts), '累计答题'),
        statBlock(U.pct(st.totalCorrect, st.totalAttempts) + '%', '总正确率'),
        statBlock(String(st.bestStreak), '最高连对'),
        statBlock(String(sessions.length), '练习轮次')
      ])
    ]);
    root.appendChild(hero);

    // 题型卡片
    var cards = WB.Trainers.META.map(function (m) {
      var t = st.byType[m.id] || { attempts: 0, correct: 0, bestStreak: 0 };
      return U.el('button', {
        class: 'mode-card', type: 'button',
        on: { click: function () { WB.App.navigate('ear', { type: m.id }); } }
      }, [
        U.el('div', { class: 'mode-card-head' }, [
          U.el('span', { class: 'mode-card-icon', html: I.svg(m.icon, 20) }),
          U.el('span', { class: 'mode-card-name', text: m.name })
        ]),
        U.el('p', { class: 'mode-card-desc', text: m.brief }),
        U.el('div', { class: 'mode-card-foot' }, [
          U.el('span', { class: 'chip', text: t.attempts ? '\u7b54\u9898 ' + t.attempts : '\u672a\u7ec3\u4e60' }),
          t.attempts ? U.el('span', { class: 'chip chip-acc', text: '\u6b63\u786e\u7387 ' + U.pct(t.correct, t.attempts) + '%' }) : null
        ])
      ]);
    });
    root.appendChild(U.el('section', { class: 'section' }, [
      U.el('h3', { class: 'section-title' }, '练耳题型'),
      U.el('div', { class: 'mode-grid' }, cards)
    ]));

    // 其他模块
    root.appendChild(U.el('section', { class: 'section' }, [
      U.el('h3', { class: 'section-title' }, '\u5176\u4ed6\u6a21\u5757'),
      U.el('div', { class: 'feature-grid' }, [
        featureCard('mic', '\u89c6\u5531\u8bad\u7ec3', '\u8c31\u4f8b\u89c6\u5531\u3001\u9010\u97f3\u6a21\u5531\u97f3\u51c6\u68c0\u6d4b\u3001\u97f3\u51c6\u4eea\u4e0e\u8282\u594f\u6a21\u4eff', function () { WB.App.navigate('sight'); }),
        featureCard('book', '\u4e50\u7406\u901f\u67e5', '\u97f3\u540d\u3001\u97f3\u7a0b\u3001\u548c\u5f26\u3001\u8c03\u5f0f\u3001\u4e94\u5ea6\u5708\u4e0e\u4ea4\u4e92\u5f0f\u952e\u76d8', function () { WB.App.navigate('ref'); }),
        featureCard('chart', '\u5b66\u4e60\u7edf\u8ba1', '\u6b63\u786e\u7387\u8d8b\u52bf\u3001\u9898\u578b\u8868\u73b0\u3001\u8fde\u5bf9\u8bb0\u5f55\u4e0e\u9519\u9898\u672c', function () { WB.App.navigate('stats'); }),
        featureCard('list', '\u9519\u9898\u672c', wrong.length ? '\u5f85\u590d\u4e60\u9519\u9898 ' + wrong.length + ' \u9898' : '\u6682\u65e0\u9519\u9898\uff0c\u7ee7\u7eed\u4fdd\u6301', function () { WB.App.navigate('stats', { tab: 'wrong' }); }),
        featureCard('gear', '\u8bbe\u7f6e', '\u97f3\u8272\u3001\u97f3\u91cf\u3001A4 \u57fa\u51c6\u3001\u6570\u636e\u5bfc\u5165\u5bfc\u51fa', function () { WB.App.navigate('settings'); }),
        featureCard('info', '\u4f7f\u7528\u8bf4\u660e', '\u5feb\u6377\u952e\u3001\u96be\u5ea6\u5bf9\u5e94\u5173\u7cfb\u4e0e\u7ec3\u4e60\u5efa\u8bae', function () { showHelp(); })
      ])
    ]));

    function statBlock(v, label) {
      return U.el('div', { class: 'hero-stat' }, [
        U.el('div', { class: 'hero-stat-num', text: v }),
        U.el('div', { class: 'hero-stat-label', text: label })
      ]);
    }
    function featureCard(icon, title, desc, onClick) {
      return U.el('button', {
        class: 'feature-card', type: 'button', on: { click: onClick }
      }, [
        U.el('span', { class: 'feature-icon', html: I.svg(icon, 20) }),
        U.el('span', { class: 'feature-body' }, [
          U.el('span', { class: 'feature-title', text: title }),
          U.el('span', { class: 'feature-desc', text: desc })
        ])
      ]);
    }
    return { destroy: function () { } };
  }

  function showHelp() {
    var body = U.el('div', { class: 'help' }, [
      U.el('h4', {}, '\u5feb\u6377\u952e'),
      U.el('ul', {}, [
        U.el('li', {}, '1 \u2013 9\uff1a\u9009\u62e9\u5bf9\u5e94\u5e8f\u53f7\u7684\u9009\u9879'),
        U.el('li', {}, '\u7a7a\u683c\u952e\uff1a\u91cd\u65b0\u64ad\u653e\u5f53\u524d\u9898\u76ee\uff08\u8282\u594f\u6a21\u4eff\u9875\u9762\u4e3a\u51fb\u62cd\uff09'),
        U.el('li', {}, 'Enter\uff1a\u8fdb\u5165\u4e0b\u4e00\u9898'),
        U.el('li', {}, 'Esc\uff1a\u5173\u95ed\u5f53\u524d\u5f39\u7a97')
      ]),
      U.el('h4', {}, '\u96be\u5ea6\u4e0e\u5185\u5bb9\u5bf9\u5e94'),
      U.el('ul', {}, [
        U.el('li', {}, '\u521d\u7ea7\uff1a\u5bf9\u5e94\u592e\u97f3\u5206\u7ea7\u4e00\u81f3\u4e8c\u7ea7\u2014\u2014\u81ea\u7136\u97f3\u7ea7\u3001\u539f\u4f4d\u5927\u5c0f\u4e09\u548c\u5f26\u3001\u57fa\u672c\u8282\u594f\u578b'),
        U.el('li', {}, '\u4e2d\u7ea7\uff1a\u5bf9\u5e94\u4e09\u81f3\u56db\u7ea7\u2014\u2014\u5347\u964d\u8bb0\u53f7\u3001\u4e09\u548c\u5f26\u8f6c\u4f4d\u3001\u548c\u58f0\u4e0e\u65cb\u5f8b\u5c0f\u8c03\u3001\u9644\u70b9\u4e0e\u516b\u5206\u97f3\u7b26'),
        U.el('li', {}, '\u9ad8\u7ea7\uff1a\u5bf9\u5e94\u4e94\u7ea7\u53ca\u4ee5\u4e0a\u4e0e\u827a\u8003\u5927\u7eb2\u2014\u2014\u56db\u79cd\u4e03\u548c\u5f26\u3001\u4e2d\u53e4\u8c03\u5f0f\u3001\u5341\u516d\u5206\u97f3\u7b26\u4e0e\u5207\u5206')
      ]),
      U.el('h4', {}, '\u7ec3\u4e60\u5efa\u8bae'),
      U.el('ul', {}, [
        U.el('li', {}, '\u5148\u7528\u300c\u7ec3\u4e60\u6a21\u5f0f\u300d\u9010\u9898\u770b\u89e3\u6790\uff0c\u518d\u7528\u300c\u6d4b\u9a8c\u6a21\u5f0f\u300d\u68c0\u9a8c\u638c\u63e1\u7a0b\u5ea6\u3002'),
        U.el('li', {}, '\u6bcf\u6b21 10\u201315 \u5206\u949f\uff0c\u6bcf\u5929\u575a\u6301\uff1b\u6b63\u786e\u7387\u8fde\u7eed\u4e24\u8f6e\u8d85 90% \u540e\u518d\u5347\u96be\u5ea6\u3002'),
        U.el('li', {}, '\u5355\u97f3\u4e0e\u97f3\u7a0b\u7ec3\u4e60\u5efa\u8bae\u5148\u7528\u300c\u7eaf\u97f3\u300d\u97f3\u8272\uff0c\u907f\u514d\u6ce2\u58eb\u4e0e\u97f3\u8272\u5e72\u6270\u3002'),
        U.el('li', {}, '\u89c6\u5531\u6a21\u5531\u9700\u4f7f\u7528 http://localhost \u6253\u5f00\u9875\u9762\uff0c\u6d4f\u89c8\u5668\u624d\u4f1a\u5141\u8bb8\u9ea5\u514b\u98ce\u3002')
      ])
    ]);
    U.modal({ title: '\u4f7f\u7528\u8bf4\u660e', body: body, width: 620, actions: [{ label: '\u77e5\u9053\u4e86', class: 'btn-primary' }] });
  }

  /* =============================== 统计 ================================= */
  function statsMount(container, opts) {
    opts = opts || {};
    container.innerHTML = '';
    var cur = opts.tab || 'overview';
    var root = U.el('div', { class: 'page page-stats' });
    container.appendChild(root);
    var tabBar = U.el('div', { class: 'seg-tabs' }, ['overview', 'wrong'].map(function (id) {
      return U.el('button', {
        class: 'seg-tab' + (id === cur ? ' active' : ''), type: 'button', dataset: { view: id },
        on: {
          click: function () {
            cur = id;
            U.qsa('.seg-tab', tabBar).forEach(function (b) { b.classList.toggle('active', b.dataset.view === id); });
            render();
          }
        }
      }, id === 'overview' ? '\u5b66\u4e60\u6982\u89c8' : '\u9519\u9898\u672c');
    }));
    root.appendChild(U.el('div', { class: 'page-head' }, [
      U.el('div', { class: 'page-head-left' }, [
        U.el('div', { class: 'page-head-icon', html: I.svg('chart', 22) }),
        U.el('div', {}, [
          U.el('h2', { class: 'page-title', text: '\u5b66\u4e60\u7edf\u8ba1' }),
          U.el('p', { class: 'page-sub', text: '\u6570\u636e\u4fdd\u5b58\u5728\u672c\u5730\u6d4f\u89c8\u5668\uff0c\u4e0d\u4e0a\u4f20\u4efb\u4f55\u670d\u52a1\u5668' })
        ])
      ]),
      tabBar
    ]));
    var body = U.el('div', { class: 'page-body' });
    root.appendChild(body);

    function render() {
      U.clear(body);
      if (cur === 'overview') renderOverview();
      else renderWrong();
    }

    function renderOverview() {
      var st = S.getStats();
      var sessions = S.listSessions();
      var acc = U.pct(st.totalCorrect, st.totalAttempts);

      body.appendChild(U.el('div', { class: 'stat-cards' }, [
        bigStat('target', '总正确率', acc + '%', st.totalCorrect + ' / ' + st.totalAttempts + ' \u9898'),
        bigStat('flame', '\u6700\u9ad8\u8fde\u5bf9', String(st.bestStreak), '\u5386\u53f2\u6700\u4f73\u8fde\u7eed\u7b54\u5bf9'),
        bigStat('list', '\u7ec3\u4e60\u8f6e\u6b21', String(sessions.length), '\u5df2\u5b8c\u6210\u7684\u7ec3\u4e60/\u6d4b\u9a8c'),
        bigStat('trophy', '\u6210\u5c31\u5fbd\u7ae0', String(S.getAchievements().length), '\u5df2\u89e3\u9501')
      ]));

      // 各题型表现
      var rows = WB.Trainers.META.map(function (m) {
        var t = st.byType[m.id] || { attempts: 0, correct: 0, bestStreak: 0 };
        var a = U.pct(t.correct, t.attempts);
        return U.el('div', { class: 'perf-row' }, [
          U.el('span', { class: 'perf-icon', html: I.svg(m.icon, 16) }),
          U.el('span', { class: 'perf-name', text: m.name }),
          U.el('div', { class: 'perf-bar' }, [
            U.el('div', { class: 'perf-bar-fill', style: { width: a + '%' } })
          ]),
          U.el('span', { class: 'perf-val', text: t.attempts ? (a + '%') : '\u2014' }),
          U.el('span', { class: 'perf-sub', text: t.attempts ? (t.correct + '/' + t.attempts) : '\u672a\u7ec3\u4e60' })
        ]);
      });
      body.appendChild(U.el('section', { class: 'panel' }, [
        U.el('div', { class: 'panel-title' }, [U.el('span', { html: I.svg('chart', 16) }), U.el('span', { text: '\u5404\u9898\u578b\u6b63\u786e\u7387' })]),
        U.el('div', { class: 'perf-list' }, rows)
      ]));

      // 近 14 天趋势
      var days = [];
      var today = new Date();
      for (var i = 13; i >= 0; i--) {
        var d = new Date(today.getTime() - i * 86400000);
        var key = d.toISOString().slice(0, 10);
        var rc = st.days[key] || { attempts: 0, correct: 0 };
        days.push({ key: key, label: (d.getMonth() + 1) + '/' + d.getDate(), acc: rc.attempts ? U.pct(rc.correct, rc.attempts) : 0, attempts: rc.attempts });
      }
      var trendCanvas = U.el('canvas', { class: 'trend-canvas' });
      body.appendChild(U.el('section', { class: 'panel' }, [
        U.el('div', { class: 'panel-title' }, [U.el('span', { html: I.svg('spark', 16) }), U.el('span', { text: '\u8fd1 14 \u5929\u6b63\u786e\u7387\u8d8b\u52bf' })]),
        trendCanvas,
        U.el('div', { class: 'trend-axis' }, days.map(function (d) {
          return U.el('span', { class: 'trend-tick', text: d.label });
        }))
      ]));
      requestAnimationFrame(function () {
        U.sparkline(trendCanvas, days.map(function (d) { return d.acc; }), { max: 100, min: 0 });
      });

      // 最近练习
      var recent = sessions.slice(0, 12);
      body.appendChild(U.el('section', { class: 'panel' }, [
        U.el('div', { class: 'panel-title' }, [U.el('span', { html: I.svg('list', 16) }), U.el('span', { text: '\u6700\u8fd1\u7ec3\u4e60\u8bb0\u5f55' })]),
        recent.length ? U.el('div', { class: 'sess-list' }, recent.map(function (s) {
          var d = new Date(s.at);
          var ts = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') +
            ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
          return U.el('div', { class: 'sess-row' }, [
            U.el('span', { class: 'sess-time', text: ts }),
            U.el('span', { class: 'sess-type', text: s.typeName || s.type }),
            U.el('span', { class: 'chip', text: WB.Trainers.LEVEL_CN[s.level] || s.level }),
            U.el('span', { class: 'chip', text: s.mode === 'test' ? '\u6d4b\u9a8c' : '\u7ec3\u4e60' }),
            U.el('span', { class: 'sess-score ' + (s.accuracy >= 85 ? 'ok' : s.accuracy >= 70 ? 'mid' : 'bad'), text: s.accuracy + '%' }),
            U.el('span', { class: 'sess-sub', text: s.correct + '/' + s.total + ' \u00b7 ' + s.durationSec + 's' })
          ]);
        })) : U.el('div', { class: 'empty-tip', text: '\u6682\u65e0\u8bb0\u5f55\uff0c\u53bb\u7ec3\u4e60\u4e00\u8f6e\u5427' })
      ]));

      // 成就
      var achs = S.getAchievements();
      var ALL_ACH = [
        { id: 'sight_first', title: '\u5b8c\u6210\u9996\u6b21\u89c6\u5531\u6a21\u5531', desc: '\u5f00\u542f\u9ea5\u514b\u98ce\u5e76\u5b8c\u6210\u4e00\u6761\u65cb\u5f8b' },
        { id: 'sight_90', title: '\u89c6\u5531\u51c6\u786e\u7387\u8fbe 90%', desc: '\u9010\u97f3\u6a21\u5531\u51c6\u786e\u7387\u8fbe\u5230 90%' },
        { id: 'streak10', title: '\u8fde\u7eed\u7b54\u5bf9 10 \u9898', desc: '\u4efb\u4e00\u9898\u578b\u8fde\u5bf9\u8fbe 10' },
        { id: 'streak20', title: '\u8fde\u7eed\u7b54\u5bf9 20 \u9898', desc: '\u4efb\u4e00\u9898\u578b\u8fde\u5bf9\u8fbe 20' },
        { id: 'acc90', title: '\u5355\u8f6e\u6b63\u786e\u7387\u8fbe\u5230 90%', desc: '\u5355\u8f6e\u81f3\u5c11 10 \u9898\u4e14\u6b63\u786e\u7387 \u2265 90%' }
      ].concat(WB.Trainers.META.map(function (m) {
        return { id: 'perfect_' + m.id, title: m.name + '\u5168\u90e8\u6b63\u786e', desc: '\u5355\u8f6e\u81f3\u5c11 5 \u9898\u5168\u90e8\u7b54\u5bf9' };
      }));
      var got = {};
      achs.forEach(function (a) { got[a.id] = a; });
      body.appendChild(U.el('section', { class: 'panel' }, [
        U.el('div', { class: 'panel-title' }, [U.el('span', { html: I.svg('trophy', 16) }), U.el('span', { text: '\u6210\u5c31\u5fbd\u7ae0' })]),
        U.el('div', { class: 'ach-grid' }, ALL_ACH.map(function (a) {
          var on = !!got[a.id];
          return U.el('div', { class: 'ach' + (on ? ' on' : '') }, [
            U.el('span', { class: 'ach-icon', html: I.svg(on ? 'trophy' : 'target', 18) }),
            U.el('span', { class: 'ach-body' }, [
              U.el('span', { class: 'ach-title', text: a.title }),
              U.el('span', { class: 'ach-desc', text: on ? '\u5df2\u89e3\u9501' : a.desc })
            ])
          ]);
        }))
      ]));
    }

    function renderWrong() {
      var list = S.listWrong();
      body.appendChild(U.el('div', { class: 'ctrl-bar' }, [
        U.el('span', { class: 'ctrl-label', text: '\u5171 ' + list.length + ' \u9898' }),
        U.el('button', {
          class: 'btn btn-ghost', type: 'button',
          on: {
            click: function () {
              U.confirm({ title: '\u6e05\u7a7a\u9519\u9898\u672c', message: '\u5c06\u5220\u9664\u5168\u90e8\u9519\u9898\u8bb0\u5f55\uff0c\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\u3002', okText: '\u6e05\u7a7a', danger: true })
                .then(function (ok) { if (ok) { S.clearWrong(); render(); U.toast('\u5df2\u6e05\u7a7a\u9519\u9898\u672c', 'ok'); } });
            }
          }
        }, '\u6e05\u7a7a\u9519\u9898\u672c')
      ]));
      if (!list.length) {
        body.appendChild(U.el('div', { class: 'empty-state' }, [
          U.el('span', { class: 'empty-icon', html: I.svg('check', 34) }),
          U.el('div', { class: 'empty-title', text: '\u9519\u9898\u672c\u4e3a\u7a7a' }),
          U.el('div', { class: 'empty-desc', text: '\u7ec3\u4e60\u4e2d\u7b54\u9519\u7684\u9898\u76ee\u4f1a\u81ea\u52a8\u8bb0\u5f55\u5230\u8fd9\u91cc\uff0c\u4fbf\u4e8e\u91cd\u70bc\u3002' })
        ]));
        return;
      }
      var rows = list.map(function (w) {
        var d = new Date(w.updatedAt || w.createdAt);
        var ts = (d.getMonth() + 1) + '/' + d.getDate();
        var replayBtn = U.el('button', {
          class: 'btn-mini', type: 'button',
          on: {
            click: function () {
              var fn = WB.Trainers.replay(w.type, w.payload);
              if (fn) fn(); else U.toast('\u8be5\u9898\u578b\u6682\u4e0d\u652f\u6301\u91cd\u653e', 'warn');
            }
          }
        }, '\u91cd\u653e');
        var delBtn = U.el('button', {
          class: 'btn-mini btn-mini-danger', type: 'button',
          on: { click: function () { S.removeWrong(w.id); render(); } }
        }, '\u79fb\u9664');
        return U.el('div', { class: 'wrong-row' }, [
          U.el('div', { class: 'wrong-head' }, [
            U.el('span', { class: 'chip', text: w.typeName || w.type }),
            U.el('span', { class: 'chip', text: WB.Trainers.LEVEL_CN[w.level] || '' }),
            w.count > 1 ? U.el('span', { class: 'chip chip-warn', text: '\u9519 ' + w.count + ' \u6b21' }) : null,
            U.el('span', { class: 'wrong-time', text: ts })
          ]),
          U.el('div', { class: 'wrong-q', text: w.prompt || '' }),
          U.el('div', { class: 'wrong-ans' }, [
            U.el('span', { class: 'wrong-ans-label', text: '\u6b63\u786e\uff1a' }),
            U.el('span', { class: 'wrong-ans-val', text: w.answerLabel || '' }),
            w.chosenLabel ? U.el('span', { class: 'wrong-chosen', text: '\u4f60\u9009\uff1a' + w.chosenLabel }) : null
          ]),
          w.detail ? U.el('div', { class: 'wrong-detail', text: w.detail }) : null,
          U.el('div', { class: 'wrong-actions' }, [replayBtn, delBtn])
        ]);
      });
      body.appendChild(U.el('div', { class: 'wrong-list' }, rows));
    }

    function bigStat(icon, label, value, sub) {
      return U.el('div', { class: 'big-stat' }, [
        U.el('span', { class: 'big-stat-icon', html: I.svg(icon, 20) }),
        U.el('div', { class: 'big-stat-body' }, [
          U.el('div', { class: 'big-stat-label', text: label }),
          U.el('div', { class: 'big-stat-value', text: value }),
          U.el('div', { class: 'big-stat-sub', text: sub })
        ])
      ]);
    }
    render();
    return { destroy: function () { } };
  }

  /* =============================== 设置 ================================= */
  function settingsMount(container, opts) {
    container.innerHTML = '';
    var s = S.getSettings();
    var root = U.el('div', { class: 'page page-settings' });
    container.appendChild(root);
    root.appendChild(U.el('div', { class: 'page-head' }, [
      U.el('div', { class: 'page-head-left' }, [
        U.el('div', { class: 'page-head-icon', html: I.svg('gear', 22) }),
        U.el('div', {}, [
          U.el('h2', { class: 'page-title', text: '\u8bbe\u7f6e' }),
          U.el('p', { class: 'page-sub', text: '\u6240\u6709\u8bbe\u7f6e\u4fdd\u5b58\u5728\u672c\u5730\u6d4f\u89c8\u5668' })
        ])
      ])
    ]));
    var body = U.el('div', { class: 'page-body' });
    root.appendChild(body);

    function update(patch) {
      s = S.saveSettings(patch);
      if (patch.volume !== undefined) A.setVolume(s.volume);
      if (patch.instrument !== undefined) A.setInstrument(s.instrument);
      if (patch.a4 !== undefined) A.setA4(s.a4);
      if (patch.theme !== undefined) WB.App.setTheme(s.theme);
    }

    function row(title, desc, control) {
      return U.el('div', { class: 'set-row' }, [
        U.el('div', { class: 'set-info' }, [
          U.el('div', { class: 'set-title', text: title }),
          desc ? U.el('div', { class: 'set-desc', text: desc }) : null
        ]),
        U.el('div', { class: 'set-control' }, control)
      ]);
    }
    function switchEl(key) {
      var on = !!s[key];
      var btn = U.el('button', { class: 'switch' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false' }, [U.el('span', { class: 'switch-knob' })]);
      btn.addEventListener('click', function () {
        var nv = !btn.classList.contains('on');
        btn.classList.toggle('on', nv);
        btn.setAttribute('aria-pressed', nv ? 'true' : 'false');
        update((function () { var o = {}; o[key] = nv; return o; })());
      });
      return btn;
    }

    body.appendChild(U.el('section', { class: 'panel' }, [
      U.el('div', { class: 'panel-title' }, [U.el('span', { html: I.svg('piano', 16) }), U.el('span', { text: '\u97f3\u9891' })]),
      row('\u97f3\u8272', '\u7eaf\u97f3\u6700\u9002\u5408\u5355\u97f3\u4e0e\u97f3\u7a0b\u8bad\u7ec3\uff1b\u94a2\u7434\u66f4\u63a5\u8fd1\u771f\u5b9e\u4e50\u5668', (function () {
        var sel = U.el('select', { class: 'select' }, A.voiceList().map(function (v) {
          return U.el('option', { value: v.id, selected: v.id === s.instrument ? 'selected' : null }, v.label);
        }));
        sel.addEventListener('change', function () { update({ instrument: sel.value }); A.unlock(); A.playNote(60, { dur: 0.9 }); });
        return sel;
      })()),
      row('\u97f3\u91cf', null, (function () {
        var rng = U.el('input', { class: 'range', type: 'range', min: '0', max: '100', value: String(Math.round(s.volume * 100)) });
        var val = U.el('span', { class: 'range-val', text: Math.round(s.volume * 100) + '%' });
        rng.addEventListener('input', function () {
          val.textContent = rng.value + '%';
          A.setVolume(parseInt(rng.value, 10) / 100);
          S.saveSettings({ volume: parseInt(rng.value, 10) / 100 });
        });
        rng.addEventListener('change', function () { A.playNote(60, { dur: 0.7 }); });
        return U.el('div', { class: 'range-wrap' }, [rng, val]);
      })()),
      row('A4 \u57fa\u51c6\u97f3\u9ad8', '\u6807\u51c6\u97f3 a1 \u7684\u9891\u7387\uff0c\u5e38\u7528 440 Hz', (function () {
        var inp = U.el('input', { class: 'input-num', type: 'number', min: '415', max: '466', step: '1', value: String(s.a4) });
        inp.addEventListener('change', function () {
          var v = parseFloat(inp.value);
          if (!isFinite(v) || v < 400 || v > 480) { inp.value = String(s.a4); return; }
          update({ a4: v });
          U.toast('A4 \u57fa\u51c6\u5df2\u8bbe\u4e3a ' + v + ' Hz', 'ok');
        });
        return U.el('div', { class: 'unit-wrap' }, [inp, U.el('span', { class: 'unit', text: 'Hz' })]);
      })())
    ]));

    body.appendChild(U.el('section', { class: 'panel' }, [
      U.el('div', { class: 'panel-title' }, [U.el('span', { html: I.svg('gear', 16) }), U.el('span', { text: '\u4ea4\u4e92\u4e0e\u663e\u793a' })]),
      row('\u9898\u76ee\u81ea\u52a8\u64ad\u653e', '\u65b0\u9898\u76ee\u51fa\u73b0\u540e\u81ea\u52a8\u64ad\u653e\u4e00\u6b21', switchEl('autoPlay')),
      row('\u5feb\u6377\u952e', '1\u20139 \u9009\u9879\u3001\u7a7a\u683c\u91cd\u64ad\u3001Enter \u4e0b\u4e00\u9898', switchEl('shortcuts')),
      row('\u7b54\u5bf9\u5f69\u5e26\u52a8\u6548', '\u8fde\u5bf9\u8fbe 5 \u7684\u500d\u6570\u65f6\u663e\u793a\u5f69\u5e26', switchEl('confetti')),
      row('\u4e3b\u9898', '\u6df1\u8272\u66f4\u9002\u5408\u957f\u65f6\u95f4\u7ec3\u4e60', (function () {
        return U.el('div', { class: 'pill-row' }, [
          U.el('button', {
            class: 'pill' + (s.theme === 'dark' ? ' active' : ''), type: 'button',
            on: { click: function () { update({ theme: 'dark' }); WB.App.refreshSettings(); } }
          }, '\u6df1\u8272'),
          U.el('button', {
            class: 'pill' + (s.theme === 'light' ? ' active' : ''), type: 'button',
            on: { click: function () { update({ theme: 'light' }); WB.App.refreshSettings(); } }
          }, '\u6d45\u8272')
        ]);
      })()),
      row('\u9ed8\u8ba4\u96be\u5ea6', '\u65b0\u5efa\u7ec3\u4e60\u65f6\u7684\u521d\u59cb\u96be\u5ea6', (function () {
        return U.el('div', { class: 'pill-row' }, ['easy', 'medium', 'hard'].map(function (v) {
          return U.el('button', {
            class: 'pill' + (s.level === v ? ' active' : ''), type: 'button',
            on: { click: function () { update({ level: v }); WB.App.refreshSettings(); } }
          }, WB.Trainers.LEVEL_CN[v]);
        }));
      })())
    ]));

    body.appendChild(U.el('section', { class: 'panel' }, [
      U.el('div', { class: 'panel-title' }, [U.el('span', { html: I.svg('download', 16) }), U.el('span', { text: '\u6570\u636e\u7ba1\u7406' })]),
      row('\u5bfc\u51fa\u5168\u90e8\u6570\u636e', '\u5c06\u8bbe\u7f6e\u3001\u7edf\u8ba1\u3001\u9519\u9898\u672c\u5bfc\u51fa\u4e3a JSON \u6587\u4ef6', U.el('button', {
        class: 'btn btn-ghost', type: 'button',
        on: {
          click: function () {
            S.download('solfege-backup-' + new Date().toISOString().slice(0, 10) + '.json', S.exportAll());
            U.toast('\u5df2\u5bfc\u51fa\u5907\u4efd\u6587\u4ef6', 'ok');
          }
        }
      }, '\u5bfc\u51fa')),
      row('\u5bfc\u5165\u6570\u636e', '\u4ece JSON \u5907\u4efd\u6062\u590d\uff0c\u4f1a\u8986\u76d6\u5f53\u524d\u6570\u636e', (function () {
        var file = U.el('input', { class: 'file-input', type: 'file', accept: '.json,application/json' });
        file.addEventListener('change', function () {
          var f = file.files && file.files[0];
          if (!f) return;
          var reader = new FileReader();
          reader.onload = function () {
            try {
              S.importAll(String(reader.result));
              U.toast('\u5bfc\u5165\u6210\u529f', 'ok');
              WB.App.refreshSettings();
              WB.App.reload();
            } catch (e) { U.toast('\u5bfc\u5165\u5931\u8d25\uff1a' + e.message, 'bad', 3200); }
          };
          reader.readAsText(f);
          file.value = '';
        });
        return file;
      })()),
      row('\u6e05\u7a7a\u5168\u90e8\u6570\u636e', '\u5220\u9664\u672c\u5730\u4fdd\u5b58\u7684\u8bbe\u7f6e\u3001\u7edf\u8ba1\u4e0e\u9519\u9898\u8bb0\u5f55', U.el('button', {
        class: 'btn btn-danger', type: 'button',
        on: {
          click: function () {
            U.confirm({
              title: '\u6e05\u7a7a\u5168\u90e8\u6570\u636e', danger: true, okText: '\u786e\u5b9a\u6e05\u7a7a',
              message: '\u5c06\u5220\u9664\u5168\u90e8\u672c\u5730\u6570\u636e\uff08\u8bbe\u7f6e\u3001\u7edf\u8ba1\u3001\u9519\u9898\u672c\u3001\u6210\u5c31\uff09\uff0c\u4e0d\u53ef\u6062\u590d\u3002\u5efa\u8bae\u5148\u5bfc\u51fa\u5907\u4efd\u3002'
            }).then(function (ok) {
              if (!ok) return;
              S.clearAll();
              U.toast('\u5df2\u6e05\u7a7a\u5168\u90e8\u6570\u636e', 'ok');
              WB.App.refreshSettings();
              WB.App.reload();
            });
          }
        }
      }, '\u6e05\u7a7a'))
    ]));

    body.appendChild(U.el('section', { class: 'panel about' }, [
      U.el('div', { class: 'panel-title' }, [U.el('span', { html: I.svg('info', 16) }), U.el('span', { text: '\u5173\u4e8e\u4e0e\u6570\u636e\u8bf4\u660e' })]),
      U.el('ul', { class: 'about-list' }, [
        U.el('li', {}, '\u97f3\u9891\u5168\u90e8\u7531 Web Audio API \u5b9e\u65f6\u5408\u6210\uff0c\u65e0\u9700\u4e0b\u8f7d\u4efb\u4f55\u91c7\u6837\u6587\u4ef6\uff0c\u53ef\u5b8c\u5168\u79bb\u7ebf\u8fd0\u884c\u3002'),
        U.el('li', {}, '\u4e94\u7ebf\u8c31\u6e32\u67d3\u4f7f\u7528 VexFlow 4\uff08\u672c\u5730\u56fa\u5b9a\u7248\u672c\uff09\uff0c\u5b57\u4f53\u4e0e\u97f3\u7b26\u5747\u7ed1\u5b9a\u5728\u5e93\u5185\u3002'),
        U.el('li', {}, '\u6240\u6709\u7ec3\u4e60\u6570\u636e\u4ec5\u5b58\u50a8\u5728\u6d4f\u89c8\u5668 localStorage\uff0c\u4e0d\u4f1a\u4e0a\u4f20\u3002'),
        U.el('li', {}, '\u5185\u5bb9\u5206\u5c42\u53c2\u8003\u4e2d\u592e\u97f3\u4e50\u5b66\u9662\u89c6\u5531\u7ec3\u8033\u5206\u7ea7\u8981\u6c42\u4e0e\u827a\u8003\u5927\u7eb2\uff1b\u97f3\u7a0b\u53c2\u8003\u66f2\u76ee\u6765\u6e90\u89c1\u4e50\u7406\u901f\u67e5\u9875\u8bf4\u660e\u3002')
      ])
    ]));
    return { destroy: function () { } };
  }

  WB.Home = { mount: homeMount, showHelp: showHelp };
  WB.StatsPage = { mount: statsMount };
  WB.SettingsPage = { mount: settingsMount };
})(typeof window !== 'undefined' ? window : globalThis);
