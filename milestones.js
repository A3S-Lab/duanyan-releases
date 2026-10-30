// 更新日志里的累计发布曲线：横轴是日期，纵轴是累计版本数，上方标关键里程碑。
// 发布记录里比 VERSIONS 更新的版本由 releases.js 传进来，自动补成曲线上的点。
(function () {
  var VERSIONS = [["2026-08-31","1.0.0"],["2026-09-02","1.0.1"],["2026-09-03","1.0.2"],["2026-09-12","1.0.3"],["2026-09-12","1.0.4"],["2026-09-12","1.0.5"],["2026-09-14","1.0.6"],["2026-09-16","1.0.7"],["2026-09-21","1.0.18"],["2026-09-21","1.0.19"],["2026-09-22","1.0.20"],["2026-09-23","1.0.21"],["2026-09-23","1.0.22"],["2026-09-29","1.0.23"],["2026-09-30","1.0.24"],["2026-10-08","1.1.0"],["2026-10-08","1.1.1"],["2026-10-10","1.1.2"],["2026-10-11","1.1.3"],["2026-10-12","1.1.4"],["2026-10-13","1.1.5"],["2026-10-13","1.1.6"],["2026-10-14","1.1.7"],["2026-10-15","1.1.8"],["2026-10-19","1.1.9"],["2026-10-21","1.1.10"],["2026-10-21","1.1.11"],["2026-10-22","1.1.12"],["2026-10-27","1.1.13"],["2026-10-28","1.1.14"]];
  var G = "#2f7d5b", P = "#6b4fa8", O = "#c0643f", B = "#3c74b3", T = "#1f8a8a", K = "#141413", Y = "#b07a1e";
  var ICONS = {
    rocket: "M12 3c3 2 5 6 5 10l-2 3H9l-2-3c0-4 2-8 5-10zM12 9v.01M9 16l-2 4 3-1M15 16l2 4-3-1",
    pack: "M4 4h7v7H4zM13 13h7v7h-7zM13 7.5h7M4 16.5h7",
    link: "M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1",
    grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    srv: "M4 4h16v7H4zM4 13h16v7H4zM8 7.5h.01M8 16.5h.01",
    target: "M12 3a9 9 0 1 0 .01 0M12 7a5 5 0 1 0 .01 0M12 11.5v1",
    flask: "M9 3h6M10 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2l-5-10V3",
    book: "M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 2zM20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2z",
    screen: "M3 5h18v11H3zM8 20h8M12 16v4",
    spark: "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z",
    chip: "M7 7h10v10H7zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4",
    scope: "M9 3l4 2-3 6-4-2zM8 11l-1 3M5 21h14M12 21a6 6 0 0 0 4-10",
    shield: "M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6zM9 12l2 2 4-4",
    loop: "M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M20 4v5h-5M4 20v-5h5",
    cloud: "M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9z"
  };
  var MILESTONES = {"1.0.0":["科研智能体工作台",G,"rocket"],"1.0.1":["跨学科科学包",P,"pack"],"1.0.2":["证据溯源",G,"link"],"1.0.6":["科研数据库互联",P,"grid"],"1.0.18":["算力集群直连",O,"srv"],"1.0.19":["GPU 集群纳管",O,"srv"],"1.0.24":["长程自主科研",O,"target"],"1.1.0":["自主实验台",B,"flask"],"1.1.2":["响应速度大幅优化",T,"book"],"1.1.3":["全平台",K,"screen"],"1.1.6":["用户数据回流与自改进","#b0466e","loop"],"1.1.8":["完整科学技能库",P,"spark"],"1.1.9":["多引擎汇聚",Y,"chip"],"1.1.11":["专业科研软件",B,"scope"],"1.1.13":["多层可信审查",G,"shield"],"1.1.14":["云端数据与大科学装置",B,"cloud"]};
  var DAY = 864e5, START = Date.parse(VERSIONS[0][0]);
  var timer = null;

  function newer(a, b) {
    var x = a.split(".").map(Number), y = b.split(".").map(Number);
    for (var i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
    return false;
  }

  function points(releases) {
    var known = {};
    var list = VERSIONS.map(function (item) { known[item[1]] = true; return { t: Date.parse(item[0]), v: item[1] }; });
    var last = VERSIONS[VERSIONS.length - 1][1];
    (releases || []).forEach(function (release) {
      var t = Date.parse(release.publishedAt);
      if (!known[release.version] && newer(release.version, last) && !isNaN(t)) {
        known[release.version] = true;
        list.push({ t: t, v: release.version });
      }
    });
    return list.sort(function (a, b) { return a.t - b.t; });
  }

  function label(t) {
    var d = new Date(t);
    return String(d.getUTCMonth() + 1).padStart(2, "0") + "." + String(d.getUTCDate()).padStart(2, "0");
  }

  function draw(releases) {
    var svg = document.getElementById("milestones");
    if (!svg) return;
    var list = points(releases);
    var span = Math.max(1, Math.round((list[list.length - 1].t - START) / DAY));
    var W = 1400, X0 = 56, X1 = 1250;
    var x = function (t) { return X0 + (t - START) / DAY / span * (X1 - X0); };
    var pts = list.map(function (p, i) { return { px: x(p.t), n: i + 1, v: p.v, m: MILESTONES[p.v] }; });

    // 上方标签逐行摆放，放不下就换一行
    var rows = [], TOP = 8, RH = 46, labs = [];
    pts.filter(function (p) { return p.m; }).forEach(function (p) {
      var w = p.m[0].length * 15 + 40;
      var cx = Math.min(Math.max(p.px, w / 2 + 6), W - 6 - w / 2), l = cx - w / 2, r = cx + w / 2;
      p.cx = cx;
      var k = rows.findIndex(function (e) { return e < l - 6; });
      if (k < 0) { k = rows.length; rows.push(0); }
      rows[k] = r;
      labs.push([p, k, w]);
    });
    var total = pts.length, top = Math.ceil(total / 10) * 10;
    var Y1 = TOP + rows.length * RH + 28, Y0 = Y1 + 170;
    var y = function (n) { return Y0 - n / top * (Y0 - Y1); };

    var s = '<defs><linearGradient id="ms-fill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f7d5b" stop-opacity=".16"/><stop offset=".5" stop-color="#c0643f" stop-opacity=".12"/><stop offset="1" stop-color="#3c74b3" stop-opacity=".18"/></linearGradient><linearGradient id="ms-line" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f7d5b"/><stop offset=".5" stop-color="#c0643f"/><stop offset="1" stop-color="#3c74b3"/></linearGradient></defs>';
    for (var n = 10; n <= top; n += 10) {
      s += '<line x1="' + X0 + '" y1="' + y(n) + '" x2="' + X1 + '" y2="' + y(n) + '" stroke="#efede6" stroke-dasharray="3 5"/><text x="' + (X0 - 10) + '" y="' + (y(n) + 4) + '" text-anchor="end">' + n + '</text>';
    }
    var path = "M" + X0 + " " + y(0);
    pts.forEach(function (p) { p.py = y(p.n); path += "H" + p.px + "V" + p.py; });
    s += '<clipPath id="ms-reveal"><rect id="ms-reveal-rect" x="0" y="0" width="' + W + '" height="' + (Y0 + 2) + '"/></clipPath><g clip-path="url(#ms-reveal)"><path d="' + path + 'V' + Y0 + 'H' + X0 + 'Z" fill="url(#ms-fill)"/><path d="' + path + '" fill="none" stroke="url(#ms-line)" stroke-width="2.5" stroke-linejoin="round"/></g>';
    s += '<line x1="' + X0 + '" y1="' + Y0 + '" x2="' + X1 + '" y2="' + Y0 + '" stroke="#d9d6ca"/>';
    labs.forEach(function (item) {
      var p = item[0], k = item[1], w = item[2], name = p.m[0], c = p.m[1], ty = TOP + k * RH;
      s += '<g class="ri ri-up" data-i="' + (p.n - 1) + '">';
      s += '<line x1="' + p.px + '" y1="' + (ty + 36) + '" x2="' + p.px + '" y2="' + (p.py - 8) + '" stroke="' + c + '" stroke-opacity=".35" stroke-dasharray="2 3"/>';
      s += '<g transform="translate(' + (p.cx - w / 2) + ' ' + ty + ')"><rect width="' + w + '" height="26" rx="6" fill="#fff"/><g transform="translate(6 2) scale(.9)" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + ICONS[p.m[2]] + '"/></g><text class="ms-name" x="32" y="19" fill="' + c + '">' + name + '</text></g>';
      s += '<text x="' + p.px + '" y="' + (ty + 38) + '" text-anchor="middle" class="ms-ver" fill="' + c + '">v' + p.v + '</text></g>';
    });
    pts.forEach(function (p) {
      s += '<g class="ri ri-dot" data-i="' + (p.n - 1) + '">' + (p.m
        ? '<circle cx="' + p.px + '" cy="' + p.py + '" r="6" fill="' + p.m[1] + '" stroke="#fff" stroke-width="2"/>'
        : '<circle cx="' + p.px + '" cy="' + p.py + '" r="3" fill="#141413"/>') + '</g>';
    });
    var end = pts[pts.length - 1];
    s += '<text class="ri ms-total" data-i="' + (total - 1) + '" x="' + (end.px + 14) + '" y="' + (end.py + 6) + '">' + total + ' 个版本</text>';
    var ticks = [list[0].t];
    for (var t = START + DAY; t < list[list.length - 1].t - 3 * DAY; t += DAY) {
      var d = new Date(t).getUTCDate();
      if (d === 1 || d === 15) ticks.push(t);
    }
    var last = list[list.length - 1].t;
    ticks = ticks.filter(function (t, i) { return i === 0 || t - ticks[i - 1] >= 3 * DAY; });
    ticks.push(last);
    ticks.forEach(function (t) { s += '<text x="' + x(t) + '" y="' + (Y0 + 20) + '" text-anchor="middle" class="ms-tick">' + label(t) + '</text>'; });

    svg.setAttribute("viewBox", "0 0 " + W + " " + (Y0 + 30));
    svg.innerHTML = s;
    animate(svg, pts.map(function (p) { return p.px; }), X0, W);
  }

  // 进入视野播放一次，点图重播；不支持或减少动态时直接完整显示。
  // 数据到达会重画，所以每一帧都按当前元素查找，而不是持有旧节点。
  var view = { xs: [], X0: 0, W: 0, started: false };
  function show(svg, k) {
    svg.querySelectorAll(".ri").forEach(function (e) { e.classList.toggle("on", +e.dataset.i <= k); });
    var rect = svg.querySelector("#ms-reveal-rect");
    if (rect) rect.setAttribute("width", k < 0 ? view.X0 : (k >= view.xs.length - 1 ? view.W : view.xs[k + 1] - 1));
  }
  function play(svg) {
    clearInterval(timer);
    view.started = true;
    svg.classList.add("play");
    var k = -1;
    show(svg, -1);
    timer = setInterval(function () {
      k++;
      show(svg, k);
      if (k >= view.xs.length - 1) clearInterval(timer);
    }, 160);
  }
  function animate(svg, xs, X0, W) {
    view.xs = xs; view.X0 = X0; view.W = W;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    if (view.started) {
      clearInterval(timer);
      show(svg, xs.length - 1);
      return;
    }
    if (svg.dataset.bound) return;
    svg.dataset.bound = "1";
    svg.classList.add("play");
    show(svg, -1);
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); play(svg); }
    }, { threshold: 0.3 });
    io.observe(svg);
    svg.addEventListener("click", function () { play(svg); });
  }

  window.drawMilestones = draw;
  draw([]);
})();
