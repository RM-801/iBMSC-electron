import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseBMS,events,longPairs,serializeBMS,flattenBGMLongs,timeline} from '../src/bms.js';
import {captureNotes,eventId,putCaptured} from '../src/commands.js';
import {writeColumn,originalColumns} from '../src/columns.js';
import {readProject,writeProject} from '../src/project.js';
import {resizeNotes} from '../src/note-edit.js';
function park(text='#00051:01\n#00251:02') {
 const c=parseBMS(text);
 putCaptured(c,captureNotes(c,new Set(events(c).map(eventId))),{deltaColumn:21});
 return c;
}
test('LN parked in BGM keeps length, resampling and move back restores LN',()=>{
 const c=park();
 assert.equal(longPairs(c).pairs.length,1);
 assert.deepEqual(longPairs(c).pairs[0].map(e=>e.beat),[0,8]);
 const b=originalColumns({bgm:1}).find(c=>c.id===26);
 writeColumn(c,b,0,1,16,'03');
 assert.equal(longPairs(c).pairs.length,1);
 const pair=longPairs(c).pairs[0];
 putCaptured(c,captureNotes(c,new Set(pair.map(eventId))),{deltaColumn:-21});
 assert.deepEqual(longPairs(c).pairs[0].map(e=>[e.channel,e.beat]),[['51',0],['51',8]]);
 assert.equal(events(c).filter(e=>e.channel==='01').length,1);
});
test('BMS export refuses silent loss; confirmed copy emits start only; project retains length',()=>{
 const c=park();
 assert.throws(()=>serializeBMS(c),/BGM/);
 const safe=flattenBGMLongs(c);
 const saved=parseBMS(serializeBMS(safe));
 assert.deepEqual(events(saved).map(e=>[e.channel,e.beat,e.value]),[['01',0,'01']]);
 assert.equal(longPairs(c).pairs.length,1);
 assert.equal(timeline(c).length,1);
 const project=readProject(writeProject(c));
 assert.deepEqual(longPairs(project).pairs[0].map(e=>[e.channel,e.beat]),[['01',0],['01',8]]);
});
test('LNOBJ parks as a BGM long note and zero-length resize becomes one normal note',()=>{
 const c=park('#LNOBJ ZZ\n#00011:01\n#00211:ZZ');
 assert.equal(longPairs(c).pairs.length,1);
 resizeNotes(c,new Set(events(c).map(eventId)),true,-8);
 assert.equal(longPairs(c).pairs.length,0);
 assert.equal(events(c).length,1);
 assert.doesNotThrow(()=>serializeBMS(c));
});
