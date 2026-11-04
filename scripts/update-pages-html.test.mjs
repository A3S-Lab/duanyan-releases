import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {updateHtml} from './update-pages-html.mjs';
const root=process.env.PAGES_FIXTURE_ROOT || path.resolve('pages');
test('static page updates links and retains latest available per platform',async()=>{
 const html=await readFile(root+'/index.html','utf8');const base='https://github.com/A3S-Lab/duanyan-releases/';
 const make=(tag,names)=>({tag_name:tag,published_at:'2026-11-04T03:00:00Z',html_url:base+'releases/tag/'+tag,body:'A < B & C',assets:names.map(name=>({name,size:1048576,browser_download_url:base+'releases/download/'+tag+'/'+name,center_url:'https://a3s-lab.discovery.intern-ai.org.cn/apps/science-discovery/api/v1/updates/'+name}))});
 const result=updateHtml(html,{releases:[make('v9.0.0',['Test-Setup-9.0.0-x64.exe','Test-x86_64.AppImage','Test-amd64.deb']),make('v9.1.0',['Test-arm64.dmg'])]});
 assert.match(result,/id="latest-version">v9\.1\.0/);assert.match(result,/id="windows-version">v9\.0\.0/);assert.match(result,/id="mac-version">v9\.1\.0/);assert.match(result,/A &lt; B &amp; C/);assert.match(result,/releases\/download\/v9\.0\.0\/Test-Setup-9\.0\.0-x64\.exe/);
});
