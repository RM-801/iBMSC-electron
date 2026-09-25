import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBMS } from '../src/bms.js';
import { statistics } from '../src/diagnostics.js';
test('upstream matrix counts LN endpoints, hidden overlap and BGA in grand total', () => {
 const c = parseBMS('#LNOBJ ZZ\n#00003:78\n#00009:01\n#00011:01ZZ\n#00051:00000202\n#00031:00000003\n#00021:01\n#00001:01\n#00004:01');
 for (const nt of [false,true]) {
  const {data} = statistics(c,{nt});
  assert.deepEqual(data[0],[1,0,0,0,0,1]);
  assert.deepEqual(data[1],[1,0,0,0,0,1]);
  // LNOBJ shares a position with the LN head. NT weights that error by 2.
  assert.deepEqual(data[2],[3,2,1,1,nt ? 3 : 2,5]);
  assert.deepEqual(data[3],[1,0,0,0,0,1]);
  assert.deepEqual(data[4],[1,0,0,0,0,1]);
  assert.deepEqual(data[5],[8,2,1,1,nt ? 3 : 2,10]);
 }
});
test('statistics errors follow pairing, not missing resources', () => {
 assert.equal(statistics(parseBMS('#00011:01')).data[5][4],0);
 assert.equal(statistics(parseBMS('#00051:01')).data[5][4],1);
 assert.equal(statistics(parseBMS('#LNOBJ ZZ\n#00011:ZZ')).data[5][4],1);
 const c = parseBMS('#00071:0101');
 assert.deepEqual(statistics(c,{nt:true}).data[2],[0,2,0,2,0,2]);
 assert.deepEqual(statistics(parseBMS('')).data[5],[0,0,0,0,0,0]);
});

test('A1-A8 breakdown follows physical lane mapping and sums exactly to A subtotal',()=>{
 const channels = ['16','11','12','13','14','15','18','19'];
 const c = parseBMS(channels.map((ch,i)=>`#000${ch}:`+'01'.repeat(i+1)).join('\n')+
   '\n#00151:0101\n#00231:01\n#00321:01\n#00301:01');
 for (const nt of [false,true]) {
  const s=statistics(c,{nt});
  assert.deepEqual(s.aLanes.map(r=>r.name),['A1','A2','A3','A4','A5','A6','A7','A8']);
  assert.deepEqual(s.aLanes.map(r=>r.counts[5]),[1,5,3,4,5,6,7,8]);
  assert.deepEqual(s.aLanes[1].counts,[3,2,0,1,0,5]);
  assert.deepEqual(Array.from({length:6},(_,i)=>s.aLanes.reduce((sum,r)=>sum+r.counts[i],0)),s.data[2]);
 }
});

test('Double D1-D8 breakdown includes D8 scratch, hidden and LN in its own subtotal',()=>{
 const channels = ['21','22','23','24','25','28','29','26'];
 const c = parseBMS('#PLAYER 3\n'+channels.map((ch,i)=>`#000${ch}:`+'01'.repeat(i+1)).join('\n')+
   '\n#00166:0101\n#00246:01\n#00311:01');
 for (const nt of [false,true]) {
  const s=statistics(c,{nt});
  assert.equal(s.showD,true);
  assert.deepEqual(s.dLanes.map(r=>r.name),['D1','D2','D3','D4','D5','D6','D7','D8']);
  assert.deepEqual(s.dLanes.map(r=>r.counts[5]),[1,2,3,4,5,6,7,11]);
  assert.deepEqual(s.dLanes[7].counts,[9,2,0,1,0,11]);
  assert.deepEqual(Array.from({length:6},(_,i)=>s.dLanes.reduce((sum,r)=>sum+r.counts[i],0)),s.data[3]);
  assert.equal(s.data[2][5],1);
 }
 assert.equal(statistics(parseBMS('#PLAYER 3')).showD,true);
 assert.equal(statistics(parseBMS('#PLAYER 2')).showD,true);
 assert.equal(statistics(parseBMS('#PLAYER 1')).showD,false);
 assert.equal(statistics(parseBMS('#PLAYER 1\n#00021:01')).showD,true);
});

test('toolbar follows CalculateTotalNotes: only A1-A8, hidden included, LN endpoints counted', () => {
 const c = parseBMS('#BPM 120\n#LNOBJ ZZ\n#00011:01ZZ\n#00151:0101\n#00231:01\n#00316:01\n#00021:01\n#00061:0101\n#00001:01\n#00003:78\n#00004:01');
 for (const nt of [false,true]) assert.equal(statistics(c,{nt}).data[2][5],6);
});
