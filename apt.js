(function () {
  "use strict";
  var status = document.getElementById("linux-apt-status");
  var pending = document.getElementById("linux-apt-pending");
  var ready = document.getElementById("linux-apt-ready");
  var fingerprint = document.getElementById("linux-apt-fingerprint");
  var repository = "https://a3s-lab.discovery.intern-ai.org.cn/apps/science-discovery/api/v1/updates/apt";
  if (!status || !pending || !ready || !fingerprint) return;

  async function load() {
    var response = await fetch("apt/repository.json", { cache: "no-store" });
    if (!response.ok) throw new Error("APT configuration unavailable");
    var config = await response.json();
    if (config.schema !== "duanyan-apt-pages/v1" || config.enabled !== true) return;
    if (!/^(?:[A-F0-9]{40}|[A-F0-9]{64})$/.test(config.fingerprint || "") ||
        !/^[a-f0-9]{64}$/.test(config.sha256 || "") ||
        config.key_file !== "duanyan-archive-keyring.gpg" || config.repository !== repository ||
        config.suite !== "stable" || config.architecture !== "amd64" ||
        config.package !== "duanyan-science-discovery-desktop") throw new Error("invalid APT configuration");
    var key = await fetch("apt/duanyan-archive-keyring.gpg", { cache: "no-store" });
    if (!key.ok || !window.crypto || !window.crypto.subtle) throw new Error("APT public key unavailable");
    var bytes = await key.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > 128 * 1024) throw new Error("invalid APT public key");
    var hash = await window.crypto.subtle.digest("SHA-256", bytes);
    var actual = Array.from(new Uint8Array(hash)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    if (actual !== config.sha256) throw new Error("APT public key checksum mismatch");
    fingerprint.textContent = config.fingerprint.match(/.{1,4}/g).join(" ");
    ready.hidden = false;
    pending.hidden = true;
    status.textContent = "可用";
  }
  load().catch(function () { status.textContent = "暂不可用"; });
})();
