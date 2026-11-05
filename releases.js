(function () {
  "use strict";

  var REPO = "A3S-Lab/duanyan-releases";
  var API_URL = "https://api.github.com/repos/" + REPO + "/releases?per_page=12";
  var FALLBACK_URL = "releases-fallback.json";
  var CENTER_BASE = "https://a3s-lab.discovery.intern-ai.org.cn/apps/science-discovery/api/v1/updates/";
  var CENTER_INDEX = "https://a3s-lab.discovery.intern-ai.org.cn/apps/duanyan-release-feed/";
  var centerReleases = [];
  var githubReachable = false;
  // A withdrawn release must not survive in a previously cached catalogue.
  var CACHE_KEY = "duanyan-release-page-v3";
  var CACHE_TTL = 5 * 60 * 1000;
  var state = { releases: [], source: "fallback", checkedAt: null };

  function cleanText(value) {
    return String(value || "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_`>#]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function summaryFromBody(body) {
    var blocks = String(body || "")
      .replace(/\r/g, "")
      .split(/\n{2,}/)
      .map(function (block) { return block.trim(); })
      .filter(Boolean);
    var first = blocks.find(function (block) {
      return !/^#+\s/.test(block) && !/^[-*]\s/.test(block);
    });
    return cleanText(first || blocks[0] || "查看完整发布说明。");
  }

  function bulletsFromBody(body, limit) {
    return String(body || "")
      .split(/\r?\n/)
      .filter(function (line) { return /^[-*]\s+/.test(line.trim()); })
      .map(function (line) { return cleanText(line.replace(/^[-*]\s+/, "")); })
      .filter(Boolean)
      .slice(0, limit || 4);
  }

  function normalizeAsset(asset) {
    return {
      name: String(asset.name || ""),
      size: Number(asset.size || 0),
      url: String(asset.browser_download_url || asset.url || ""),
      digest: String(asset.digest || ""),
      centerUrl: String(asset.center_url || asset.centerUrl || ""),
      centerOnly: Boolean(asset.centerOnly),
      centerPlatform: String(asset.centerPlatform || "")
    };
  }

  function normalizeRelease(release) {
    var tag = String(release.tag_name || release.tag || "");
    return {
      tag: tag,
      version: tag.replace(/^v/i, ""),
      name: String(release.name || tag),
      publishedAt: String(release.published_at || release.publishedAt || release.created_at || ""),
      url: String(release.html_url || release.url || ""),
      body: String(release.body || ""),
      draft: Boolean(release.draft),
      prerelease: Boolean(release.prerelease),
      centerOnly: Boolean(release.centerOnly),
      assets: Array.isArray(release.assets) ? release.assets.map(normalizeAsset) : []
    };
  }

  function normalizeReleases(input) {
    return (Array.isArray(input) ? input : [])
      .map(normalizeRelease)
      .filter(function (release) {
        return release.tag && !release.draft && !release.prerelease;
      })
      .sort(function (a, b) {
        var av = /^v?(\d+)\.(\d+)\.(\d+)$/i.exec(a.tag);
        var bv = /^v?(\d+)\.(\d+)\.(\d+)$/i.exec(b.tag);
        if (av && bv) {
          for (var i = 1; i <= 3; i++) {
            var diff = Number(bv[i]) - Number(av[i]);
            if (diff) return diff;
          }
        }
        return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
      });
  }

  function findAsset(release, test) {
    return release.assets.find(function (asset) {
      return test.test(asset.name);
    }) || null;
  }

  function pickPlatforms(releases) {
    var platforms = { mac: null, windows: null, linux: null };
    releases.forEach(function (release) {
      if (!platforms.mac) {
        var dmg = findAsset(release, /\.dmg$/i);
        if (dmg) platforms.mac = { release: release, primary: dmg, secondary: null };
      }
      if (!platforms.windows) {
        var setup = findAsset(release, /-Setup-.*-x64\.exe$/i);
        if (setup) {
          platforms.windows = {
            release: release,
            primary: setup,
            online: findAsset(release, /^Duanyan-Online-Setup-\d+\.\d+\.\d+\.exe$/i),
            secondary: findAsset(release, /-Portable-.*-x64\.exe$/i)
          };
        }
      }
      if (!platforms.linux) {
        var appImage = findAsset(release, /-x86_64\.AppImage$/i);
        if (appImage) {
          platforms.linux = {
            release: release,
            primary: appImage,
            secondary: findAsset(release, /-amd64\.deb$/i)
          };
        }
      }
    });
    return platforms;
  }

  function formatDate(value, short) {
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "日期未知";
    return new Intl.DateTimeFormat("zh-CN", short
      ? { year: "numeric", month: "2-digit", day: "2-digit" }
      : { year: "numeric", month: "long", day: "numeric" }
    ).format(date).replace(/\//g, ".");
  }

  function formatSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    if (bytes < 1024 * 1024) return Math.ceil(bytes / 1024) + " KB";
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
    return Math.round(bytes / (1024 * 1024)) + " MB";
  }

  function detectOS() {
    var ua = navigator.userAgent;
    var platform = navigator.platform || "";
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return null;
    if (/Mac/i.test(platform) && navigator.maxTouchPoints > 1) return null;
    if (/Windows/i.test(ua)) return "windows";
    if (/Mac/i.test(ua)) return "mac";
    if (/Linux/i.test(ua) && /x86_64|amd64/i.test(ua) && !/CrOS|aarch64|arm/i.test(ua)) {
      return "linux";
    }
    return null;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var node = byId(id);
    if (node) node.textContent = value;
  }

  function setLink(id, href, label) {
    var node = byId(id);
    if (!node) return;
    node.href = href;
    if (label) node.textContent = label;
  }

  function renderPlatform(os, data) {
    var card = document.querySelector('[data-os="' + os + '"]');
    if (!card) return;
    var primary = byId(os + "-primary");
    var secondary = byId(os + "-secondary");
    var centerPrimary = byId(os + "-center-primary");
    var centerSecondary = byId(os + "-center-secondary");
    var onlineGithub = byId(os + "-online-github");
    var onlineCenter = byId(os + "-online-center");
    function centerLink(node, asset) {
      if (!node) return;
      var safe = asset && /^[A-Za-z0-9._-]+$/.test(asset.name) && asset.centerUrl === CENTER_BASE + asset.name;
      node.hidden = !safe;
      if (safe) node.href = asset.centerUrl;
      else node.removeAttribute("href");
    }
    if (!data) {
      card.classList.add("unavailable");
      setText(os + "-version", "暂无安装包");
      if (primary) {
        primary.href = "https://github.com/" + REPO + "/releases";
        primary.textContent = "查看可用版本";
      }
      if (secondary) secondary.hidden = true;
      centerLink(centerPrimary, null); centerLink(centerSecondary, null);
      centerLink(onlineCenter, null);
      if (onlineGithub) onlineGithub.hidden = true;
      setText(os + "-size", "等待下一次发布");
      hideEmptyRows(card);
      return;
    }
    card.classList.remove("unavailable");
    setText(os + "-version", "v" + data.release.version);
    if (primary) {
      primary.hidden = !data.primary.url;
      if (data.primary.url) primary.href = data.primary.url;
      else primary.removeAttribute("href");
      primary.textContent = "GitHub";
    }
    if (secondary) {
      secondary.hidden = !data.secondary || !data.secondary.url;
      if (data.secondary && data.secondary.url) secondary.href = data.secondary.url;
      else secondary.removeAttribute("href");
    }
    centerLink(centerPrimary, data.primary); centerLink(centerSecondary, data.secondary);
    centerLink(onlineCenter, data.online);
    if (onlineGithub) {
      onlineGithub.hidden = !data.online || !data.online.url;
      if (data.online && data.online.url) onlineGithub.href = data.online.url;
      else onlineGithub.removeAttribute("href");
      if (data.online) setText(os + "-online-size", formatSize(data.online.size));
    }
    setText(os + "-size", formatSize(data.primary.size) || "安装包");
    hideEmptyRows(card);
  }

  function hideEmptyRows(card) {
    Array.prototype.forEach.call(card.querySelectorAll(".dl-row"), function (row) {
      row.hidden = !row.querySelector("a:not([hidden])");
    });
  }

  function render(releases, source, checkedAt) {
    if (!releases.length) return;
    var latest = releases[0];
    var platforms = pickPlatforms(releases);
    if (!githubReachable && centerReleases.length) {
      var centerPlatforms = pickPlatforms(normalizeReleases(centerReleases));
      ["mac", "windows", "linux"].forEach(function (os) {
        if (centerPlatforms[os]) platforms[os] = centerPlatforms[os];
      });
    }
    var selectedOS = detectOS();
    state.releases = releases;
    state.source = source;
    state.checkedAt = checkedAt || Date.now();

    setText("nav-version", latest.version);

    setText("latest-version", "v" + latest.version);
    setText("latest-date", formatDate(latest.publishedAt));
    var latestDate = byId("latest-date");
    if (latestDate) latestDate.dateTime = latest.publishedAt;
    setText("latest-summary", summaryFromBody(latest.body));
    setLink("latest-link", latest.url, latest.centerOnly ? "中心更新说明 ↗" : "发布说明 ↗");

    if (window.drawMilestones) window.drawMilestones(releases);
    renderPlatform("mac", platforms.mac);
    renderPlatform("windows", platforms.windows);
    renderPlatform("linux", platforms.linux);

    var summary = ["macOS", "Windows", "Linux"].map(function (name) {
      var key = name.toLowerCase() === "windows" ? "windows" : name === "macOS" ? "mac" : "linux";
      var item = platforms[key];
      return name + " " + (item ? "v" + item.release.version : "暂无");
    }).join(" · ");
    setText("download-summary", "免费下载 · " + summary + " · 安装版支持应用内更新");

    var recommendation = selectedOS ? platforms[selectedOS] : null;
    var primary = byId("primary");
    if (primary) {
      if (recommendation) {
        var online = recommendation.online;
        var safeCenter = online && /^[A-Za-z0-9._-]+$/.test(online.name) && online.centerUrl === CENTER_BASE + online.name;
        var mainAsset = recommendation.primary;
        var mainCenter = mainAsset && mainAsset.centerUrl === CENTER_BASE + mainAsset.name;
        primary.href = online ? (safeCenter ? online.centerUrl : online.url || latest.url)
          : (mainCenter ? mainAsset.centerUrl : mainAsset.url || latest.url);
        setText("primary-label", "下载 " + ({ mac: "macOS", windows: "Windows", linux: "Linux" }[selectedOS]) + " 版 · " + recommendation.release.version);
        var card = document.querySelector('[data-os="' + selectedOS + '"]');
        if (card) {
          card.classList.add("rec");
          var badge = card.querySelector(".rl");
          if (badge) badge.hidden = false;
        }
      } else {
        primary.href = latest.url;
        setText("primary-label", "查看最新版 · " + latest.version);
      }
    }

    document.documentElement.classList.add("release-ready");
  }

  function readCache() {
    try {
      var value = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!value || !Array.isArray(value.releases) || Date.now() - value.checkedAt > CACHE_TTL) return null;
      return value;
    } catch (_) {
      return null;
    }
  }

  function writeCache(releases) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        checkedAt: Date.now(),
        releases: releases
      }));
    } catch (_) {}
  }

  async function fetchJSON(url) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 10000);
    try {
      var response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/vnd.github+json" },
        signal: controller.signal
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // The independent read-only endpoint follows the desktop feeds directly,
  // so an unreachable GitHub API does not delay current platform versions.
  function parseCenterManifest(text) {
    var version = /^version:\s*["']?(\d+\.\d+\.\d+)["']?\s*$/m.exec(text);
    if (!version) return null;
    var date = /^releaseDate:\s*["']?([^"'\r\n]+)["']?\s*$/m.exec(text);
    var files = [], current = null;
    String(text).split(/\r?\n/).forEach(function (line) {
      var match = /^\s*-\s*url:\s*["']?([A-Za-z0-9._-]+)["']?\s*$/.exec(line);
      if (match) { current = { name: match[1] }; files.push(current); return; }
      match = /^\s+sha512:\s*["']?([A-Za-z0-9+/=]+)["']?\s*$/.exec(line);
      if (match && current) current.sha512 = match[1];
      match = /^\s+size:\s*(\d+)\s*$/.exec(line);
      if (match && current) current.size = Number(match[1]);
    });
    return { version: version[1], date: date ? date[1].trim() : "", files: files };
  }

  async function centerText(name) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 10000);
    try {
      var response = await fetch(CENTER_INDEX + name + "?v=" + Date.now(), { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Center HTTP " + response.status);
      return await response.text();
    } finally { clearTimeout(timer); }
  }

  async function fetchCenterReleases() {
    var names = ["catalog.json", "latest.yml", "latest-linux.yml", "latest-mac.yml", "release-notes.json"];
    var responses = await Promise.allSettled(names.map(centerText));
    if (responses[0].status !== "fulfilled") throw new Error("Center catalog unavailable");
    var catalog = JSON.parse(responses[0].value), byName = Object.create(null), notes = [];
    (Array.isArray(catalog.files) ? catalog.files : []).forEach(function (file) {
      if (file && /^[A-Za-z0-9._-]+$/.test(file.name) && Number.isSafeInteger(file.size) && file.size > 0) byName[file.name] = file.size;
    });
    if (responses[4].status === "fulfilled") {
      try { notes = JSON.parse(responses[4].value).versions || []; } catch (_) {}
    }
    var rows = Object.create(null), updated = [];
    function row(version, date) {
      if (!rows[version]) {
        var note = Array.isArray(notes) && notes.find(function (item) { return item.version === version; });
        rows[version] = { tag: "v" + version, version: version, name: "端砚 " + version,
          publishedAt: date || (note && note.date) || "", url: CENTER_BASE + "release-notes.json",
          body: note && note.summary || "查看中心更新源。", centerOnly: true, assets: [] };
      }
      return rows[version];
    }
    function add(target, filename, expectedSize, platform) {
      if (!byName[filename] || (expectedSize && byName[filename] !== expectedSize)) return false;
      target.assets.push({ name: filename, size: byName[filename], url: "", digest: "", centerUrl: CENTER_BASE + filename, centerOnly: true, centerPlatform: platform });
      return true;
    }
    [1, 2, 3].forEach(function (index) {
      if (responses[index].status !== "fulfilled") return;
      var manifest = parseCenterManifest(responses[index].value);
      if (!manifest) return;
      var version = manifest.version, target = row(version, manifest.date);
      function verified(filename) {
        var entry = manifest.files.find(function (item) { return item.name === filename; });
        return entry && /^[A-Za-z0-9+/]{86}==$/.test(entry.sha512 || "") && entry.size > 0 && byName[filename] === entry.size;
      }
      if (index === 1) {
        var setup = "Duanyan-Science-Discovery-Setup-" + version + "-x64.exe";
        if (verified(setup)) {
          updated.push("windows");
          add(target, setup, byName[setup], "windows");
          add(target, "Duanyan-Science-Discovery-Portable-" + version + "-x64.exe", null, "windows");
          add(target, "Duanyan-Online-Setup-" + version + ".exe", null, "windows");
        }
      } else if (index === 2) {
        var image = "Duanyan-Science-Discovery-" + version + "-x86_64.AppImage";
        var deb = "Duanyan-Science-Discovery-" + version + "-amd64.deb";
        if (verified(image)) {
          updated.push("linux");
          add(target, image, byName[image], "linux");
          if (verified(deb)) add(target, deb, byName[deb], "linux");
        }
      } else {
        var zip = "Duanyan-Breeding-Research-" + version + "-arm64.zip";
        var dmg = "Duanyan-Breeding-Research-" + version + "-arm64.dmg";
        if (verified(zip) && byName[dmg]) { updated.push("mac"); add(target, dmg, null, "mac"); }
      }
    });
    var result = Object.keys(rows).map(function (key) { return rows[key]; }).filter(function (item) { return item.assets.length; });
    if (!result.length) throw new Error("No valid center platform manifests");
    return { rows: result, updated: updated };
  }

  function mergePartialCenter(previous, incoming) {
    var rows = Object.create(null);
    function collect(releases, keep) {
      releases.forEach(function (item) {
        var assets = item.assets.filter(keep);
        if (!assets.length) return;
        var target = rows[item.tag];
        if (!target) { target = Object.assign({}, item, { assets: [] }); rows[item.tag] = target; }
        target.assets = target.assets.concat(assets);
      });
    }
    collect(previous, function (asset) { return incoming.updated.indexOf(asset.centerPlatform) < 0; });
    collect(incoming.rows, function () { return true; });
    return Object.keys(rows).map(function (key) { return rows[key]; });
  }

  function mergeCenterReleases(base, extra) {
    var merged = normalizeReleases(base).filter(function (item) { return !item.centerOnly; });
    merged.forEach(function (item) { item.assets = item.assets.filter(function (asset) { return !asset.centerOnly; }); });
    extra.forEach(function (item) {
      var target = merged.find(function (existing) { return existing.tag === item.tag; });
      if (!target) { merged.push(item); return; }
      item.assets.forEach(function (asset) {
        var known = target.assets.find(function (existing) { return existing.name === asset.name; });
        if (known && known.size === asset.size) known.centerUrl = asset.centerUrl;
        else if (known) target.assets[target.assets.indexOf(known)] = asset;
        else target.assets.push(asset);
      });
    });
    return normalizeReleases(merged);
  }

  var loading = false;
  var REFRESH_INTERVAL = 60 * 1000;

  async function load() {
    if (loading) return;
    loading = true;
    var centerRequest = fetchCenterReleases().then(function (result) {
      centerReleases = mergePartialCenter(centerReleases, result);
      var merged = mergeCenterReleases(state.releases, centerReleases);
      if (merged.length) { render(merged, "center", Date.now()); writeCache(merged); }
    }).catch(function () {});
    try {
    var fallbackCheckedAt = null;
    try {
      var fallback = await fetchJSON(FALLBACK_URL + "?v=" + Date.now());
      var fallbackReleases = normalizeReleases(fallback.releases || fallback);
      if (fallbackReleases.length) {
        fallbackCheckedAt = Date.parse(fallback.generated_at || "") || 0;
        // A delayed Pages build must not replace a newer API or cached result.
        var current = state.releases[0];
        var candidate = fallbackReleases[0];
        var fallbackIsNewer = current && candidate.tag !== current.tag &&
          normalizeReleases([candidate, current])[0].tag === candidate.tag;
        if (!current || current.centerOnly || fallbackIsNewer || fallbackCheckedAt > (state.checkedAt || 0)) {
          var fromPages = mergeCenterReleases(fallbackReleases, centerReleases);
          render(fromPages, "pages", fallbackCheckedAt);
          writeCache(fromPages);
        }
      }
    } catch (_) {}

    // Show the same-origin index immediately and check GitHub asynchronously.
    // If GitHub is blocked or rate-limited, keep the last verified index.
    {
      try {
        var payload = await fetchJSON(API_URL);
        var releases = normalizeReleases(payload);
        if (!releases.length) throw new Error("No published releases");
        // Only retain mirror links when the index identifies the same GitHub
        // asset digest; same-version replacements must not reuse stale links.
        releases.forEach(function (release) {
          var indexed = state.releases.find(function (row) { return row.tag === release.tag; });
          release.assets.forEach(function (asset) {
            var match = indexed && indexed.assets.find(function (row) { return row.name === asset.name && row.digest && row.digest === asset.digest; });
            if (match) asset.centerUrl = match.centerUrl;
          });
        });
        githubReachable = true;
        var fromApi = mergeCenterReleases(releases, centerReleases);
        render(fromApi, "api", Date.now());
        writeCache(fromApi);
      } catch (_) {
        githubReachable = false;
        if (centerReleases.length) render(mergeCenterReleases(state.releases, centerReleases), "center", Date.now());
      }
    }
    } finally {
      await centerRequest;
      loading = false;
    }
  }

  window.DuanyanReleases = {
    normalizeReleases: normalizeReleases,
    pickPlatforms: pickPlatforms,
    summaryFromBody: summaryFromBody,
    bulletsFromBody: bulletsFromBody,
    parseCenterManifest: parseCenterManifest,
    mergeCenterReleases: mergeCenterReleases
  };

  var cached = readCache();
  if (cached) render(cached.releases, "cache", cached.checkedAt);
  load();
  window.setInterval(function () {
    if (document.visibilityState !== "hidden") load();
  }, REFRESH_INTERVAL);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") load();
  });
  window.addEventListener("online", load);
})();
