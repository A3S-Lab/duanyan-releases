'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const { _electron }=require('playwright');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'duanyan-restart-ci-'));
const exe=path.join(process.env.LOCALAPPDATA,'Programs','duanyan-science-discovery-desktop','端砚· Science Discovery.exe');
const key='HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\dcbc705a-7c4e-53ad-8acc-0d7ce57b38ca';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let app;
(async()=>{
 const env={...process.env,DUANYAN_USER_DATA_DIR:path.join(root,'profile'),APP_AUTH_MODE:'optional',AUTH_LAB_GATEWAY_URL:'',INTELLIGENT_PREWARM:'0',DUANYAN_LAB_BENCH:'0'};
 for(const k of ['ELECTRON_RUN_AS_NODE','DUANYAN_UPDATE_FEED_URL','DUANYAN_DEV_SERVER_URL','DUANYAN_REMOTE_API_URL','DUANYAN_REMOTE_APP_URL'])delete env[k];
 app=await _electron.launch({executablePath:exe,env,timeout:180000});const page=await app.firstWindow();assert.equal(await app.evaluate(({app})=>app.getVersion()),'1.1.19');
 await page.waitForURL(url => url.protocol === 'file:' && url.pathname.endsWith('/index.html'), {timeout:180000});
 await page.waitForFunction(() => Boolean(window.duanyanDesktop && window.duanyanDesktop.checkForUpdates), null, {timeout:30000});
 console.log('MAIN_WINDOW_READY');const oldPid=app.process().pid;
 const checked=await page.evaluate(()=>window.duanyanDesktop.checkForUpdates());assert.equal(checked.state.status,'available');assert.equal(checked.state.version,'1.1.20');console.log('CHECK_1.1.19_TO_1.1.20_OK');
 const downloaded=await page.evaluate(()=>window.duanyanDesktop.downloadUpdate());assert.equal(downloaded.state.status,'ready');console.log('DOWNLOAD_READY');
 try{await page.evaluate(()=>window.duanyanDesktop.installUpdate())}catch(e){console.log('Old app closed for update:',e.message.slice(0,100))}
 app=null;let installed=false,newPid=null;
 for(let i=0;i<240;i++){
  await sleep(5000);let reg='';try{reg=execFileSync('reg.exe',['query',key,'/v','DisplayVersion'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore']})}catch{}
  if(!/REG_SZ\s+1\.1\.20\b/.test(reg))continue;
  const ps="Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -and $_.ExecutablePath -eq $env:DUANYAN_CI_EXE} | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress";
  let raw='';try{raw=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{encoding:'utf8',windowsHide:true,env:{...process.env,DUANYAN_CI_EXE:exe}}).trim()}catch{}
  if(!raw)continue;const p=JSON.parse(raw),list=Array.isArray(p)?p:[p];const found=list.find(x=>x.ProcessId!==oldPid && /--updated/i.test(x.CommandLine||''));if(found){installed=true;newPid=found.ProcessId;break}
 }
 assert.ok(installed,'1.1.20 was not automatically relaunched with --updated');let shown=false;for(let i=0;i<90;i++){await sleep(1000);const ps=`$p=Get-Process -Id ${newPid} -ErrorAction SilentlyContinue; if($p){[string]$p.MainWindowHandle}`;const handle=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{encoding:'utf8',windowsHide:true}).trim();if(handle&&handle!=='0'){shown=true;break}}assert.ok(shown,'Restarted Windows app did not show a window');await sleep(10000);process.kill(newPid,0);console.log('REAL_WINDOWS_UPDATE_AND_AUTO_RESTART_OK',JSON.stringify({oldPid,newPid,from:'1.1.19',to:'1.1.20',windowVisible:true}));
})().catch(e=>{console.error(e.stack);process.exitCode=1}).finally(async()=>{if(app)await app.close().catch(()=>{})});
