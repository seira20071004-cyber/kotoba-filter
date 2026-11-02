import test from 'node:test';import assert from 'node:assert/strict';
import {personalReview,contextCandidates,initialSelection,selectContext,projectSelection,contextKey,copyIsReady} from '../public/chat/check-review.mjs';
import {partitionReview,abstractMessage} from '../public/chat/abstraction.mjs';
import {applyIdentityLinks} from '../public/chat/pii-core.mjs';
import {unitsFor,groundedFindings} from '../public/chat/confidential.mjs';
const aiAll=text=>groundedFindings({decisions:Object.fromEntries(unitsFor(text).map(u=>[u.id,'review']))},unitsFor(text));
test('未確認の機密候補があればコピーを止め、本人の選択後だけ有効になる',()=>{const c={start:0,end:10},decisions=new Map();assert(!copyIsReady(true,false,[c],decisions));decisions.set(contextKey(c),'keep');assert(copyIsReady(true,false,[c],decisions));assert(!copyIsReady(false,false,[c],decisions));assert(!copyIsReady(true,true,[c],decisions));assert(copyIsReady(true,false,[],new Map()));});
test('一件の確認だけでは残りの機密候補を確認済みにしない',()=>{const a={start:0,end:2},b={start:3,end:6},d=new Map([[contextKey(a),'hide']]);assert(!copyIsReady(true,false,[a,b],d));d.set(contextKey(b),'keep');assert(copyIsReady(true,false,[a,b],d));});
test('機密を隠す選択は名寄せの追加・解除でも維持する',()=>{const text='名前は山田太郎です。山田さんに返信します。社外秘の製造計画です。',cs=contextCandidates(text),base=partitionReview(personalReview(text),cs);let selected=selectContext(base,initialSelection(base),cs[0],true);const extra=applyIdentityLinks(base,[{alias:'山田',target:'山田太郎',kind:'person'}]);const next=partitionReview(base,extra),kept=projectSelection(base,selected,next,extra);assert(!abstractMessage(next,kept).text.includes('製造計画'));const back=projectSelection(next,kept,base);assert(!abstractMessage(base,back).text.includes('製造計画'));});
test('名寄せ時に本人が解除した別の個人情報を勝手に選択し直さない',()=>{const raw='名前は山田太郎です。山田さんのメールはtaro@example.comです。',base=personalReview(raw),sel=initialSelection(base);const email=base.findings.find(f=>f.kind==='email');sel.delete(email.id);const extra=applyIdentityLinks(base,[{alias:'山田',target:'山田太郎',kind:'person'}]),next=partitionReview(base,extra);const out=abstractMessage(next,projectSelection(base,sel,next,extra)).text;assert(out.includes('taro@example.com'));assert(!out.includes('山田'));assert.throws(()=>projectSelection(base,sel,personalReview('別の文章')));});
test('改行だけで区切った文も分割し、原文の位置を保持する',()=>{const raw='これは架空の物語です\r\n雲の工場が帽子を作ります\r\n\r\n社外秘の製造条件です';const units=unitsFor(raw);assert.equal(units.length,3);assert.equal(raw.slice(units[1].start,units[1].end),'雲の工場が帽子を作ります');const cs=contextCandidates(raw,aiAll(raw));assert.equal(cs.length,1);assert.equal(cs[0].text,'社外秘の製造条件です');});
test('短い補足文・挨拶・文章作成の依頼だけなら追加の機密候補にしない',()=>{for(const raw of ['一般論として知りたいです。','決まり次第お知らせします。','よろしくお願いいたします。','メールの署名文を考えてください。'])assert.equal(contextCandidates(raw,aiAll(raw)).length,0,raw);});
test('挨拶・補足文が含まれても、同じ文の機密内容は除外しない',()=>{for(const raw of ['未公開の価格は通常の半額ですので、よろしくお願いします。','一般論として知りたいですが、社内の認証は特定ヘッダーで回避できます。'])assert(contextCandidates(raw,aiAll(raw)).length>0,raw);});
test('保護済みの連絡先の定型文は機密カードを重複表示せずPIIは残す',()=>{const raw='名前は山田太郎です。メールはtaro@example.com、電話は090-0000-0000です。',p=personalReview(raw);assert.equal(contextCandidates(raw,aiAll(raw),p).length,0);const out=abstractMessage(p,initialSelection(p)).text;assert(!out.includes('taro@example.com'));assert(!out.includes('山田太郎'));assert(!out.includes('090-0000-0000'));});
test('連絡先の文に非公開の契約事実が併記されていれば機密カードを残す',()=>{const raw='担当の名前は山田太郎ですが、顧客向け単価は通常の半額にする秘密保持契約です。';assert(contextCandidates(raw,aiAll(raw),personalReview(raw)).length>0);});
test('名前を含む返信の依頼は既存PII保護と重複する機密カードを出さず、依頼文を残す',()=>{const raw='名前は山田太郎です。山田さんに返信してください。',p=personalReview(raw);assert.equal(contextCandidates(raw,aiAll(raw),p).length,0);assert(abstractMessage(p,initialSelection(p)).text.includes('さんに返信してください'));});
test('GPU探索中に準備を中止しても、後からWorkerを起動しない',async t=>{
 const nav=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldWorker=globalThis.Worker;let resolveAdapter,created=0;
 Object.defineProperty(globalThis,'navigator',{value:{gpu:{requestAdapter:()=>new Promise(resolve=>resolveAdapter=resolve)}},configurable:true});globalThis.Worker=class{constructor(){created++;}};
 t.after(()=>{Object.defineProperty(globalThis,'navigator',nav);globalThis.Worker=oldWorker;});
 for(const module of ['pii-detector','local-detector']){
  const detector=await import('../public/chat/'+module+'.mjs?early-cancel-'+module);const preparation=detector.prepare().catch(e=>e);await Promise.resolve();detector.cancelChecks();resolveAdapter({});const result=await preparation;assert.match(result.message,/中止/);assert(!detector.isReady());
 }
 assert.equal(created,0);
});
test('隠すと確認した範囲が実際に選択されていなければコピーを無効にする',()=>{const c={start:0,end:4},review={original:'秘密情報',findings:[{id:'f',start:0,end:4}]},decisions=new Map([['0:4','hide']]);assert.equal(copyIsReady(true,false,[c],decisions,review,new Set()),false);assert.equal(copyIsReady(true,false,[c],decisions,review,new Set(['f'])),true);});
