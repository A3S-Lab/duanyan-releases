(function () {
  "use strict";

  var REPO = "A3S-Lab/duanyan-releases";
  var API_URL = "https://api.github.com/repos/" + REPO + "/releases?per_page=12";
  var FALLBACK_URL = "releases-fallback.json";
  var CENTER_BASE = "https://a3s-lab.discovery.intern-ai.org.cn/apps/science-discovery/api/v1/updates/";
  var CACHE_KEY = "duanyan-release-page-v2";
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
      centerUrl: String(asset.center_url || asset.centerUrl || "")
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
      return;
    }
    card.classList.remove("unavailable");
    setText(os + "-version", "v" + data.release.version);
    if (primary) {
      primary.href = data.primary.url;
      primary.innerHTML = '<svg><use href="#dl"/></svg>' +
        (os === "mac" ? "GitHub · DMG" : os === "windows" ? "GitHub · 完整安装版" : "GitHub · AppImage");
    }
    if (secondary) {
      if (data.secondary) {
        secondary.hidden = false;
        secondary.href = data.secondary.url;
        secondary.textContent = os === "windows" ? "GitHub · 便携版" : "GitHub · deb";
      } else {
        secondary.hidden = true;
      }
    }
    centerLink(centerPrimary, data.primary); centerLink(centerSecondary, data.secondary);
    centerLink(onlineCenter, data.online);
    if (onlineGithub) {
      onlineGithub.hidden = !data.online;
      if (data.online) {
        onlineGithub.href = data.online.url;
        onlineGithub.textContent = "GitHub · 在线安装器（" + formatSize(data.online.size) + "）";
      }
    }
    if (onlineCenter && data.online && !onlineCenter.hidden) onlineCenter.textContent = "A3S Lab · 在线安装器（" + formatSize(data.online.size) + "）";
    setText(os + "-size", formatSize(data.primary.size) || "安装包");
  }

  function releasePlatforms(release) {
    var labels = [];
    if (findAsset(release, /\.dmg$/i)) labels.push("macOS");
    if (findAsset(release, /-Setup-.*-x64\.exe$/i)) labels.push("Windows");
    if (findAsset(release, /-x86_64\.AppImage$/i)) labels.push("Linux");
    return labels;
  }

  function renderHistory(releases) {
    var box = byId("release-history");
    if (!box) return;
    box.textContent = "";
    releases.slice(1, 5).forEach(function (release) {
      var article = document.createElement("article");
      var head = document.createElement("div");
      var version = document.createElement("b");
      var time = document.createElement("time");
      var summary = document.createElement("p");
      var platforms = document.createElement("span");
      version.textContent = "v" + release.version;
      time.dateTime = release.publishedAt;
      time.textContent = formatDate(release.publishedAt, true);
      summary.textContent = summaryFromBody(release.body);
      platforms.textContent = releasePlatforms(release).join(" · ") || "查看发布页";
      head.append(version, time);
      article.append(head, summary, platforms);
      article.tabIndex = 0;
      article.addEventListener("click", function () { window.open(release.url, "_blank", "noopener"); });
      article.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          window.open(release.url, "_blank", "noopener");
        }
      });
      box.append(article);
    });
    setText("history-count", releases.length > 1 ? "最近 " + Math.min(4, releases.length - 1) + " 个版本" : "等待更多版本");
  }

  function render(releases, source, checkedAt) {
    if (!releases.length) return;
    var latest = releases[0];
    var platforms = pickPlatforms(releases);
    var selectedOS = detectOS();
    state.releases = releases;
    state.source = source;
    state.checkedAt = checkedAt || Date.now();

    setText("nav-version", latest.version);

    setText("latest-version", "v" + latest.version);
    setText("latest-title", latest.name);
    setText("latest-date", formatDate(latest.publishedAt));
    var latestDate = byId("latest-date");
    if (latestDate) latestDate.dateTime = latest.publishedAt;
    setText("latest-summary", summaryFromBody(latest.body));
    setLink("latest-link", latest.url, "完整发布说明 ↗");

    var highlights = byId("latest-highlights");
    if (highlights) {
      highlights.textContent = "";
      var items = bulletsFromBody(latest.body, 4);
      if (!items.length) items = [summaryFromBody(latest.body)];
      items.forEach(function (value) {
        var li = document.createElement("li");
        li.textContent = value;
        highlights.append(li);
      });
    }

    var platformChips = byId("latest-platforms");
    if (platformChips) {
      platformChips.textContent = "";
      var releaseLabels = releasePlatforms(latest);
      if (!releaseLabels.length) releaseLabels = ["Release"];
      releaseLabels.forEach(function (label) {
        var chip = document.createElement("span");
        chip.textContent = label;
        platformChips.append(chip);
      });
    }

    renderHistory(releases);
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
        primary.href = online ? (safeCenter ? online.centerUrl : online.url) : recommendation.primary.url;
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

  async function load() {
    var cached = readCache();
    if (cached) render(cached.releases, "cache", cached.checkedAt);

    var fallbackCheckedAt = null;
    try {
      var fallback = await fetchJSON(FALLBACK_URL + "?v=" + Date.now());
      var fallbackReleases = normalizeReleases(fallback.releases || fallback);
      if (fallbackReleases.length) {
        fallbackCheckedAt = Date.parse(fallback.generated_at || "") || Date.now();
        render(fallbackReleases, "pages", fallbackCheckedAt);
        writeCache(fallbackReleases);
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
        render(releases, "api", Date.now());
        writeCache(releases);
      } catch (_) {
        // keep the static links already in the page
      }
    }
  }

  window.DuanyanReleases = {
    normalizeReleases: normalizeReleases,
    pickPlatforms: pickPlatforms,
    summaryFromBody: summaryFromBody,
    bulletsFromBody: bulletsFromBody
  };

  load();
})();
