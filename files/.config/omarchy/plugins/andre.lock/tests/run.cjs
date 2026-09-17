const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFileSync,spawnSync}=require('node:child_process');
const p=path.resolve(__dirname,'..');
const O=require(path.join(p,'Observation.js'));
let s=O.fresh();
s=O.begin(s,1000,true); assert.equal(s.pending,1);
assert.equal(O.begin(s,1100,true),null); assert.equal(O.begin(s,1100,false),null);
assert.equal(O.finish(s,7,'accepted',1200),null);
s=O.finish(s,1,'accepted',2400); assert.equal(s.outcome,'accepted'); assert.equal(s.pending,0);
assert.equal(O.finish(s,1,'rejected',2500),null); assert.equal(O.begin(s,2600,true),null);
s=O.begin(s,2700,false); assert.equal(s.pending,2);
s=O.finish(s,2,'cancelled',2800); assert.equal(s.outcome,'cancelled');
assert.equal(O.finish(s,2,'accepted',2900),null);
s=O.rearm(s); s=O.begin(s,3000,true);
s=O.finish(s,s.pending,'accepted',20000); assert.equal(s.outcome,'timeout');
for(const outcome of ['accepted','rejected','unavailable','timeout','cancelled']) {
 const b=O.begin(O.fresh(),1000,true); const f=O.finish(b,b.pending,outcome,1200);assert.equal(f.outcome,outcome); assert.equal(f.pending,0);
}
// Verify unchanged stock authentication functions, not just a success-path mock.
const service=fs.readFileSync(path.join(p,'Service.qml'),'utf8');
const stock=fs.readFileSync('/usr/share/omarchy/shell/plugins/lock/Service.qml','utf8');
function fn(src,name){const start=src.indexOf('  function '+name+'(');assert(start>=0);const next=src.indexOf('\n  }',start);return src.slice(start,next+4)}
for(const name of ['finishUnlock','submitPassword','respondToPasswordPrompt','handlePasswordFailure','startFingerprint','handleFingerprintFinished','requestSessionLock']) assert.equal(fn(service,name),fn(stock,name),name);
const observer=fs.readFileSync(path.join(p,'FaceObserver.qml'),'utf8');
assert(!/finishUnlock|sessionLock|passwordPam|pendingPassword|enteredPassword/.test(observer));
assert(observer.includes('config: "omarchy-face-observe"'));
assert(!observer.includes('.respond('));
assert.equal((service.match(/finishUnlock\(\)/g)||[]).length,(stock.match(/finishUnlock\(\)/g)||[]).length);
const ui=fs.readFileSync(path.join(p,'FaceStatus.qml'),'utf8');
assert(!/PopupWindow|PanelWindow|WlSessionLock/.test(ui));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'lock-observe-test-'));
try {
 const dir=path.join(temp,'stock');fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'file'),'first');
 const baseline=path.join(temp,'baseline');
 const hash=execFileSync('bash',['-c',"find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum | sha256sum | cut -d ' ' -f 1"],{cwd:dir,encoding:'utf8'});fs.writeFileSync(baseline,hash);
 const check=()=>execFileSync(path.join(p,'check-upstream'),[dir,baseline],{encoding:'utf8'}).trim();
 assert.equal(check(),'current');fs.writeFileSync(path.join(dir,'file'),'second');assert.equal(check(),'changed');
 fs.writeFileSync(path.join(dir,'file'),'first');fs.writeFileSync(path.join(dir,'added'),'x');assert.equal(check(),'changed');
 fs.unlinkSync(path.join(dir,'added'));fs.unlinkSync(path.join(dir,'file'));assert.equal(check(),'changed');
 fs.writeFileSync(baseline,'invalid');assert.notEqual(spawnSync(path.join(p,'check-upstream'),[dir,baseline]).status,0);
 const env={...process.env,XDG_STATE_HOME:temp};
 const log=(...args)=>execFileSync(path.join(p,'observation-log'),args,{env,encoding:'utf8'}).trim();
 assert.deepEqual(JSON.parse(log('read')),[]);
 const entry={timestamp:'2026-09-17T17:00:00Z',attempt:1,outcome:'accepted',duration_ms:100,extra:'must not persist'};
 log('append',JSON.stringify(entry));const rows=JSON.parse(log('read'));assert.equal(rows[0].outcome,'accepted');assert(!('extra' in rows[0]));
 assert.notEqual(spawnSync(path.join(p,'observation-log'),['append',JSON.stringify({...entry,outcome:'invented'})],{env}).status,0);
 const logPath=path.join(temp,'omarchy-face-observe/events.jsonl');fs.writeFileSync(logPath,' '.repeat(1048576));log('append',JSON.stringify(entry));assert(fs.existsSync(logPath+'.1'));assert.equal(JSON.parse(log('read')).length,1);
 fs.unlinkSync(logPath);fs.symlinkSync(path.join(temp,'outside'),logPath);assert.notEqual(spawnSync(path.join(p,'observation-log'),['append',JSON.stringify(entry)],{env}).status,0);
}finally{fs.rmSync(temp,{recursive:true,force:true})}
console.log('PASS: attempt lifecycle, duplicate/late results, timeout, unchanged password paths, isolated UI, baseline detection, bounded private logging');
