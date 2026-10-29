import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.github.com/repos/A3S-Lab/duanyan-releases/releases?per_page=12";
const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(process.argv[2] || path.join(here, "..", "releases-fallback.json"));
const CENTER = "https://a3s-lab.discovery.intern-ai.org.cn/apps/science-discovery/api/v1/updates/";
const headers = { Accept: "application/vnd.github+json", "User-Agent": "duanyan-homepage-release-sync" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const response = process.env.DUANYAN_RELEASES_JSON ? null : await fetch(API, { headers });
if (response && !response.ok) throw new Error(`GitHub Releases API: HTTP ${response.status}`);
const source = response ? await response.json() : JSON.parse(await readFile(process.env.DUANYAN_RELEASES_JSON, "utf8"));
let current = null;
try { current = JSON.parse(await readFile(target, "utf8")); } catch {}

const releases = source
  .filter((release) => !release.draft && !release.prerelease)
  .map((release) => ({
    tag_name: release.tag_name,
    name: release.name,
    published_at: release.published_at,
    html_url: release.html_url,
    body: release.body || "",
    draft: false,
    prerelease: false,
    assets: (release.assets || []).map((asset) => ({
      name: asset.name,
      size: asset.size,
      browser_download_url: asset.browser_download_url,
      digest: asset.digest || ""
    }))
  }));

// Pages cannot read this cross-origin feed directly (no CORS). Verify each
// mirror from the release workflow and expose only matching-size files. A
// timeout/404 leaves GitHub available instead of advertising a broken link.
await Promise.all(releases.flatMap(release => release.assets.map(asset => ({release,asset}))).map(async ({release,asset}) => {
  if (!/^[A-Za-z0-9._-]+$/.test(asset.name) || !/\.(?:exe|AppImage|deb|dmg)$/i.test(asset.name) || !asset.size || !asset.digest) return;
  const oldRelease = current?.releases?.find(row => row.tag_name === release.tag_name);
  const old = oldRelease?.assets?.find(row => row.name === asset.name && row.digest === asset.digest && row.size === asset.size && row.center_url === CENTER + asset.name);
  const preserve = () => { if (old) asset.center_url = old.center_url; };
  try {
    const check = await fetch(CENTER + asset.name, {method:"HEAD",redirect:"error",signal:AbortSignal.timeout(10000)});
    if (check.ok && Number(check.headers.get("content-length")) === asset.size) asset.center_url = CENTER + asset.name;
    else if (check.status >= 500 || check.status === 403 || check.status === 429) preserve();
  } catch { preserve(); }
}));

const unchanged = current &&
  JSON.stringify(current.releases || []) === JSON.stringify(releases);
const output = {
  generated_at: unchanged ? current.generated_at : new Date().toISOString(),
  source: API,
  releases
};

if (!unchanged || JSON.stringify(current) !== JSON.stringify(output)) {
  await writeFile(target, `${JSON.stringify(output, null, 2)}\n`, "utf8");
}

console.log(`release fallback: ${releases.length} versions, latest ${releases[0]?.tag_name || "none"}`);
