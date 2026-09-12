const {load,test,eq}=require('../harness.js')
const S=load('Status.js')
test('healthy state is neutral',()=>eq(S.severity({phase:'ready',lastSuccess:999},1000),'neutral'))
test('backup activity uses accent',()=>eq(S.severity({phase:'backing-up',updatedAt:999},1000),'active'))
test('waiting cannot mask overdue status',()=>eq(S.severity({phase:'waiting',lastSuccess:1},200000),'warning'))
test('waiting cannot mask earlier failure',()=>eq(S.severity({phase:'waiting',lastSuccess:199999,lastError:'failed'},200000),'error'))
test('stale active state is not shown as working',()=>eq(S.description({phase:'backing-up',updatedAt:1},1000),'Waiting for the backup service to resume'))
test('bar shows rounded logical backup size with precise tooltip',()=>{
 eq(S.compactSize(2482718830),'2G')
 eq(S.size(2482718830),'2.3 GiB')
})
test('unknown and invalid backup sizes never appear as zero',()=>{
 for (const value of [undefined,null,'', '123',-1,NaN,Infinity]) {
  eq(S.compactSize(value),'—')
  eq(S.size(value),'Unavailable')
 }
})
test('compact sizes support empty and small backups',()=>{
 eq(S.compactSize(0),'0B')
 eq(S.compactSize(512),'512B')
 eq(S.compactSize(2048),'2K')
 eq(S.compactSize(5*1024*1024),'5M')
 eq(S.compactSize(2*1024**4),'2T')
})
