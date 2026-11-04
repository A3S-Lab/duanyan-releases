import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const CENTER='https://a3s-lab.discovery.intern-ai.org.cn/apps/science-discovery/api/v1/updates/';
const GITHUB='https://github.com/A3S-Lab/duanyan-releases/';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function updateHtml(html, input) {
 const rows=(input.releases||[]).filter(r=>!r.draft&&!r.prerelease&&/^v\d+\.\d+\.\d+$/.test(r.tag_name||''));
 rows.sort((a,b)=>{const x=a.tag_name.slice(1).split('.').map(Number),y=b.tag_name.slice(1).split('.').map(Number);return y[0]-x[0]||y[1]-x[1]||y[2]-x[2]});
 if(!rows.length)throw Error('No stable releases in index');
 function text(id,value){const p=new RegExp(`(<[a-z]+\\b[^>]*\\bid="${id}"[^>]*>)[^<]*(</[a-z]+>)`,'i');if(!p.test(html))throw Error('Missing '+id);html=html.replace(p,(_,a,b)=>a+escape(value)+b)}
 function attribute(id,name,value){const p=new RegExp(`(<[a-z]+\\b[^>]*\\bid="${id}"[^>]*>)`,'i');if(!p.test(html))throw Error('Missing '+id);html=html.replace(p,tag=>{tag=tag.replace(new RegExp(`\\s+${name}="[^"]*"`,'i'),'');tag=tag.replace(/\s+hidden(?=[\s>])/i,'');return value?tag.replace(/>$/,` ${name}="${escape(value)}">`):tag.replace(/>$/,' hidden>')})}
 const latest=rows[0],version=latest.tag_name.slice(1),published=new Date(latest.published_at);if(!Number.isFinite(published.getTime()))throw Error('Invalid release date');
 const d=`${published.getUTCFullYear()}-${String(published.getUTCMonth()+1).padStart(2,'0')}-${String(published.getUTCDate()).padStart(2,'0')}`;
 const summary=String(latest.body||'查看完整发布说明。').replace(/\r/g,'').split(/\n{2,}/).map(x=>x.trim()).find(x=>x&&!/^#+\s|^[-*]\s/.test(x))||'查看完整发布说明。';
 text('nav-version',version);text('latest-version','v'+version);text('latest-date',`${published.getUTCFullYear()}年${published.getUTCMonth()+1}月${published.getUTCDate()}日`);attribute('latest-date','datetime',d);text('latest-summary',summary.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*_`>#]/g,'').replace(/\s+/g,' ').trim());if(!String(latest.html_url||'').startsWith(GITHUB+'releases/tag/'))throw Error('Invalid release URL');attribute('latest-link','href',latest.html_url);
 for(const [os,primary,secondary] of [['mac',/\.dmg$/i,null],['windows',/-Setup-.*-x64\.exe$/i,/-Portable-.*-x64\.exe$/i],['linux',/-x86_64\.AppImage$/i,/-amd64\.deb$/i]]){
  const row=rows.find(r=>(r.assets||[]).some(a=>primary.test(a.name)));if(!row)continue;const assets=row.assets||[],first=assets.find(a=>primary.test(a.name)),second=secondary&&assets.find(a=>secondary.test(a.name));text(os+'-version',row.tag_name);
  const set=(id,a,center=false)=>{if(!a){attribute(id,'href',null);return}const url=center?(/^[A-Za-z0-9._-]+$/.test(a.name)&&a.center_url===CENTER+a.name?a.center_url:null):(String(a.browser_download_url||'').startsWith(GITHUB+'releases/download/')?a.browser_download_url:null);attribute(id,'href',url)};
  set(os+'-primary',first);set(os+'-center-primary',first,true);if(secondary){set(os+'-secondary',second);set(os+'-center-secondary',second,true)}
  if(os==='windows'){const online=assets.find(a=>/^Duanyan-Online-Setup-\d+\.\d+\.\d+\.exe$/i.test(a.name));set('windows-online-github',online);set('windows-online-center',online,true);if(online)text('windows-online-size',Math.ceil(online.size/1024)+' KB')}
  text(os+'-size',first.size?Math.round(first.size/1048576)+' MB':'');
 }
 return html;
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){const [page,index]=process.argv.slice(2);if(!page||!index)throw Error('Expected HTML and release index paths');const html=updateHtml(await readFile(page,'utf8'),JSON.parse(await readFile(index,'utf8')));await writeFile(page,html)}
