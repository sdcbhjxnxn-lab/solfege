/* =============================================================================
 * icons.js  —  内联 SVG 线性图标（24x24，stroke 风格）
 * ========================================================================== */
(function (global) {
  'use strict';
  var WB = (global.WB = global.WB || {});

  var P = {
    home: 'M3 10.7 12 3.2l9 7.5V20a1 1 0 0 1-1 1h-5.2v-6.2H9.2V21H4a1 1 0 0 1-1-1z',
    notes: 'M9 17.6V5.4l10-2v12.2|M9 17.6a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0z|M19 15.6a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0z',
    updown: 'M8 20V5|M4.6 8.4 8 5l3.4 3.4|M16 4v15|M12.6 15.6 16 19l3.4-3.4',
    interval: 'M5 20V9|M19 20V4|M5 9h14|M5 13h14',
    chord: 'M4 20V10|M12 20V4|M20 20V13|M2 20h20',
    scale: 'M3 20V15h4v-4h4V7h4V3h4',
    progression: 'M3 7h18|M3 17h18|M3 7v10|M21 7v10|M9 7v10|M15 7v10',
    degree: 'M6 3v18|M18 3v18|M6 7h12|M6 12h12|M6 17h12',
    rhythm: 'M12 2.8 6.4 20.4h11.2z|M12 8.5v6|M9.6 20.4 15 6.2',
    melody: 'M3 15c2.5-7 4-7 6 0s3.5 6 6-1 3.5-5 6 0',
    mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z|M5.5 11.5a6.5 6.5 0 0 0 13 0|M12 18v3|M9 21h6',
    book: 'M4 5a2 2 0 0 1 2-2h11.5v18H6a2 2 0 0 1-2-2z|M8 3v18',
    chart: 'M4 20h16|M7 20v-7|M12 20V6|M17 20v-4',
    gear: 'M12 15.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z|M12 2.6l1.2 2.2 2.5-.5.5 2.5 2.2 1.2-1.2 2.2 1.2 2.2-2.2 1.2-.5 2.5-2.5-.5L12 21.4l-1.2-2.2-2.5.5-.5-2.5L5.6 16l1.2-2.2L5.6 11.6l2.2-1.2.5-2.5 2.5.5z',
    play: 'M6 3.5 19.5 12 6 20.5z',
    replay: 'M20 12a8 8 0 1 1-2.4-5.7|M20 4v4.5h-4.5',
    check: 'M4 12.5 9.5 18 20 6.5',
    close: 'M6 6l12 12|M18 6 6 18',
    pause: 'M8 5h3v14H8z|M13 5h3v14h-3z',
    trophy: 'M8 4h8v5a4 4 0 0 1-8 0z|M8 5H5.5a2.5 2.5 0 0 0 2.5 5|M16 5h2.5A2.5 2.5 0 0 1 16 10|M12 13v4|M8.5 21h7|M10 17h4v4h-4z',
    target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z|M12 13.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z',
    flame: 'M12 22c3.9 0 6.5-2.6 6.5-6 0-4.5-4-6.5-4.2-10-.2-1.4-.9-2.6-2.3-3 .6 1.6.2 3.3-1.4 4.6C9 9.1 5.5 10.6 5.5 15.4c0 3.7 2.6 6.6 6.5 6.6z',
    trash: 'M4 7h16|M9.5 7V4.5h5V7|M6.5 7l1 13.5h9L17.5 7|M10.5 11v6|M13.5 11v6',
    download: 'M12 3v12|M7.5 10.5 12 15l4.5-4.5|M4 20h16',
    upload: 'M12 15V3|M7.5 7.5 12 3l4.5 4.5|M4 20h16',
    keyboard: 'M3 7h18v10H3z|M7 11h.01|M11 11h.01|M15 11h.01|M7 14h10',
    list: 'M8 6h13|M8 12h13|M8 18h13|M3.5 6h.01|M3.5 12h.01|M3.5 18h.01',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 11v5|M12 7.8h.01',
    spark: 'M12 3v4|M12 17v4|M3 12h4|M17 12h4|M6.3 6.3l2.8 2.8|M14.9 14.9l2.8 2.8|M17.7 6.3l-2.8 2.8|M9.1 14.9l-2.8 2.8',
    piano: 'M3 5h18v14H3z|M7.5 5v9|M12 5v9|M16.5 5v9|M3 14h18'
  };

  function svg(name, size, cls) {
    var d = P[name];
    if (!d) return '';
    var paths = d.split('|').map(function (p) {
      return '<path d="' + p + '"/>';
    }).join('');
    return '<svg class="icon ' + (cls || '') + '" width="' + (size || 20) + '" height="' + (size || 20) +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      paths + '</svg>';
  }
  // 需要填充的图标（播放/暂停等）
  function svgFilled(name, size, cls) {
    var d = P[name];
    if (!d) return '';
    var paths = d.split('|').map(function (p) {
      return '<path d="' + p + '"/>';
    }).join('');
    return '<svg class="icon ' + (cls || '') + '" width="' + (size || 20) + '" height="' + (size || 20) +
      '" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round">' +
      paths + '</svg>';
  }

  // 生成一个 SVG 元素
  function iconEl(name, size, cls) {
    var host = document.createElement('span');
    host.className = 'icon-host';
    host.innerHTML = svg(name, size, cls);
    return host.firstChild || host;
  }

  WB.Icons = { paths: P, svg: svg, svgFilled: svgFilled, iconEl: iconEl };
})(typeof window !== 'undefined' ? window : globalThis);
