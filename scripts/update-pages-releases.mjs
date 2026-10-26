import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://api.github.com/repos/A3S-Lab/duanyan-releases/releases?per_page=12";
const target = path.resolve(process.argv[2] || "releases-fallback.json");
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "duanyan-pages-release-sync"
};
if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

const response = await fetch(API, { headers });
if (!response.ok) throw new Error(`GitHub Releases API: HTTP ${response.status}`);

const releases = (await response.json())
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
      browser_download_url: asset.browser_download_url
    }))
  }));

let current = null;
try {
  current = JSON.parse(await readFile(target, "utf8"));
} catch {}

const unchanged = current &&
  JSON.stringify(current.releases || []) === JSON.stringify(releases);
const output = {
  generated_at: unchanged
    ? current.generated_at
    : new Date().toISOString(),
  source: API,
  releases
};

if (!unchanged || JSON.stringify(current) !== JSON.stringify(output)) {
  await writeFile(target, `${JSON.stringify(output, null, 2)}\n`, "utf8");
}

console.log(`pages release index: ${releases.length} versions, latest ${releases[0]?.tag_name || "none"}`);
