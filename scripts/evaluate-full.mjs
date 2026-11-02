import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {fullReview,fullMessage} from '../public/chat/full.mjs';
import {personalReview,selectContext} from '../public/chat/check-review.mjs';
import {TYPES} from '../public/chat/abstraction.mjs';
export function score(c,marks,output){
 let offset=0;const ranges=marks.map(m=>{const start=offset;offset+=m.text.length;return {...m,start,end:offset};}).filter(m=>m.selected);
 if(marks.map(m=>m.text).join('')!==c.text)throw Error('原文と評価範囲が一致しません: '+c.id);
 const targets=c.targets.map(t=>{let start=c.text.indexOf(t);if(start<0)throw Error('注釈不一致: '+c.id);const end=start+t.length;let cursor=start;for(const r of ranges){if(r.end<=cursor)continue;if(r.start>cursor)break;cursor=Math.max(cursor,r.end);}return{text:t,covered:cursor>=end};});
 const protectedAll=targets.length>0&&targets.every(t=>t.covered),requestKept=output.includes(c.keep);
 return{id:c.id,kind:c.kind,targets,protectedAll,requestKept,both:protectedAll&&requestKept,altered:output!==c.text,output};
}
export function summarize(rows){const p=rows.filter(c=>c.kind==='positive'),n=rows.filter(c=>c.kind==='negative');return {positive:p.length,protectedAll:p.filter(c=>c.protectedAll).length,negative:n.length,falseAltered:n.filter(c=>c.altered).length,total:rows.length,requestKept:rows.filter(c=>c.requestKept).length,both:p.filter(c=>c.both).length,targets:p.flatMap(c=>c.targets).length,targetsCovered:p.flatMap(c=>c.targets).filter(t=>t.covered).length};}
export function runRules(cases){return cases.map(c=>{
 const personal=personalReview(c.text),r=fullReview(personal);let selected=new Set(r.review.findings.filter(f=>TYPES[f.kind].rank===1).map(f=>f.id));for(const context of r.contexts)selected=selectContext(r.review,selected,context,true);
 const output=fullMessage(r.review,selected,r.contexts,{session:'aabbccddeeff'}).text,marks=r.review.findings;let cursor=0,segments=[];for(const f of marks){if(cursor<f.start)segments.push({text:c.text.slice(cursor,f.start),selected:false});segments.push({text:c.text.slice(f.start,f.end),selected:selected.has(f.id)});cursor=f.end;}if(cursor<c.text.length)segments.push({text:c.text.slice(cursor),selected:false});return score(c,segments,output);
 });}
if(process.argv[1]===fileURLToPath(import.meta.url)){const cases=JSON.parse(fs.readFileSync(process.argv[2]||'tests/fixtures/full/baseline.json')),recordings=process.argv[3]?JSON.parse(fs.readFileSync(process.argv[3])):null;const rows=recordings?cases.map(c=>{const r=recordings.find(r=>r.id===c.id);if(!r)throw Error('未実測: '+c.id);return score(c,r.marks,r.output);}):runRules(cases);const result={method:recordings?'browser-recorded':'rules-only (no AI)',summary:summarize(rows),rows};if(process.argv[4])fs.writeFileSync(process.argv[4],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));}
