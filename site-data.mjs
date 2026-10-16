export const RELEASE = Object.freeze({ version: '1.1.8', date: '2026-10-15' });
export const RELEASE_PAGE = `https://github.com/A3S-Lab/duanyan-releases/releases/tag/v${RELEASE.version}`;
const distribution = 'https://a3s-lab.discovery.intern-ai.org.cn/apps/science-discovery/api/v1/updates/';
export const DOWNLOADS = Object.freeze({
  windows: Object.freeze({ label: '下载 Windows 版', href: `${distribution}Duanyan-Science-Discovery-Setup-${RELEASE.version}-x64.exe` }),
  linux: Object.freeze({ label: '下载 Linux 版', href: `${distribution}Duanyan-Science-Discovery-${RELEASE.version}-x86_64.AppImage` }),
  mac: Object.freeze({ label: '下载 macOS 版 · Apple Silicon', href: `https://github.com/A3S-Lab/duanyan-releases/releases/download/v${RELEASE.version}/Duanyan-Breeding-Research-${RELEASE.version}-arm64.dmg` }),
});

// iPadOS can identify as Macintosh. Do not recommend desktop installers to tablets.
export function detectPlatform({ userAgent = '', platform = '', maxTouchPoints = 0 } = {}) {
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || (/Mac/i.test(platform) && maxTouchPoints > 1)) return null;
  if (/Windows/i.test(userAgent)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'mac';
  if (/Linux/i.test(userAgent) && /x86_64|amd64/i.test(userAgent) && !/CrOS|aarch64|arm64|armv[78]/i.test(userAgent)) return 'linux';
  return null;
}

export const FIELDS = Object.freeze({
  breeding: { question: '这批表型数据，适合怎样的遗传评估？', description: '先核对表型、系谱与基因型的对应关系，再讨论模型选择和验证方法。', tags: ['表型探索', '遗传评估', '模型验证'] },
  bioinformatics: { question: '这些序列之间，有怎样的关联？', description: '从序列比对、参考注释到系统发育，找到适合研究问题的分析路径。', tags: ['序列分析', '参考注释', '系统发育'] },
  chemistry: { question: '怎样有依据地比较这一组分子？', description: '从分子结构与性质出发，探索描述符、相似性与可用的研究证据。', tags: ['分子结构', '分子描述符', '相似性分析'] },
  clinical: { question: '怎样把一个临床问题，变成可检验的研究？', description: '围绕研究设计、队列与结局，梳理变量和分析方法。面向科研，不用于个体诊疗。', tags: ['研究设计', '队列研究', '结局分析'] },
  omics: { question: '多种组学数据，可以怎样放在一起看？', description: '连接不同层次的数据，从样本对齐与质量控制出发，寻找值得深入研究的关联。', tags: ['样本对齐', '质量控制', '组学整合'] },
  methods: { question: '这个研究假设，怎样验证才更可靠？', description: '从假设、实验设计到统计分析，让研究路径更清晰，让结果更易复现。', tags: ['假设检验', '实验设计', '可复现性'] },
});
