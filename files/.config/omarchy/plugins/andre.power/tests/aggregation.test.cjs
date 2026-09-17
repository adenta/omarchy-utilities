const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const filter = path.join(__dirname, '../bin/aggregate.jq');
function aggregate(rows, interval, kind) {
 const input={type:'a(udu)',data:[rows]};
 const result=spawnSync('jq',['--argjson','interval',String(interval),'--arg','kind',kind,'-f',filter],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:8*1024*1024});
 assert.equal(result.status,0,result.stderr);
 return JSON.parse(result.stdout).data[0];
}
const rows=[[10,8,2],[40,12,2],[80,50,1],[310,14,2],[340,18,2],[700,30,1]];
assert.deepEqual(aggregate(rows,0,'rate'),rows);
assert.deepEqual(aggregate(rows,300,'rate'),[[25,10,2,true],[325,16,2,true],[700,0,0,true]]);
assert.equal(aggregate(rows,300,'charge')[0][1],70/3);
for(const [span,interval] of [[86400,300],[604800,1800]]) {
 const dense=Array.from({length:span/30},(_,i)=>[i*30+10,i%2?20:10,i%3?2:1]);
 const averaged=aggregate(dense,interval,'rate');
 assert.equal(averaged.length,span/interval);
 assert(averaged.every(r=>r[2]===2 && r[1]>=10 && r[1]<=20));
}
console.log('Fixed buckets, discharge-only averages, gaps, unchanged hour and large payload passed.');
