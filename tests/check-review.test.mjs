import test from 'node:test';
import assert from 'node:assert/strict';
import {personalReview,contextCandidates,initialSelection,selectContext,contextState} from '../public/chat/check-review.mjs';
import {partitionReview,abstractMessage} from '../public/chat/abstraction.mjs';
import {unitsFor,groundedFindings} from '../public/chat/confidential.mjs';

test('基本チェックは金額・予定・非公開文を機密候補にせず、明確な個人情報だけを初期選択する',()=>{
 const text='名前は山田太郎です。メールはtaro@example.comです。来月、未発表の新製品を300万円で販売します。';
 const r=personalReview(text),out=abstractMessage(r,initialSelection(r)).text;
 assert(!out.includes('山田太郎'));assert(!out.includes('taro@example.com'));assert(out.includes('未発表の新製品を300万円'));assert(r.findings.every(f=>f.kind!=='confidential'));
});
test('機密チェックを追加しても機密候補の文は勝手に置換せず、理由を表示できる',()=>{
 const text='名前は山田太郎です。来月、未発表の新製品を発売します。週末は映画を見ます。';
 const cs=contextCandidates(text),r=partitionReview(personalReview(text),cs),selected=initialSelection(r);
 assert.equal(cs.length,1);assert.match(cs[0].reason,/非公開|未公開/);assert(!contextState(r,selected,cs[0]));
 const out=abstractMessage(r,selected).text;assert(!out.includes('山田太郎'));assert(out.includes('来月、未発表の新製品を発売します。'));assert(out.includes('週末は映画を見ます。'));
});
test('機密候補を選ぶとその範囲を隠し、解除しても個人情報の保護を維持する',()=>{
 const text='未公開の計画を山田さんと進めます。',cs=contextCandidates(text),r=partitionReview(personalReview(text),cs),initial=initialSelection(r);
 const selected=selectContext(r,initial,cs[0],true);assert(contextState(r,selected,cs[0]));const hidden=abstractMessage(r,selected).text;assert(!hidden.includes('計画'));assert(!hidden.includes('山田'));assert.match(hidden,/非公開情報/);
 const back=selectContext(r,selected,cs[0],false),out=abstractMessage(r,back).text;assert(out.includes('未公開の計画'));assert(!out.includes('山田'));assert(!contextState(r,back,cs[0]));
});
test('一般論・公開済みの文章には明示的な機密候補を追加しない',()=>{
 for(const text of ['社外秘情報の意味を教えてください。','公開済みの新製品について相談したいです。','休日はカレーを作ります。'])assert.equal(contextCandidates(text).length,0);
});
test('端末内AIの分類理由を原文の範囲に対応付け、知らない分類は採用しない',()=>{
 const text='先輩の基本給が下がると人事から聞きました。',units=unitsFor(text),found=groundedFindings({decisions:{s0:'personnel'}},units),cs=contextCandidates(text,found);
 assert.equal(cs[0].text,text);assert.match(cs[0].reason,/人事情報/);assert.deepEqual(cs[0].sources,['端末内AI']);assert.throws(()=>groundedFindings({decisions:{s0:'invented'}},units));
});
test('複数の機密候補を個別に選べ、別の候補や普通の文へ選択が波及しない',()=>{
 const text='未発表の新製品を出します。週末は映画を見ます。社外秘の契約を結びました。',cs=contextCandidates(text),r=partitionReview(personalReview(text),cs);
 assert.equal(cs.length,2);const selected=selectContext(r,initialSelection(r),cs[0],true),out=abstractMessage(r,selected).text;assert(!out.includes('未発表の新製品'));assert(out.includes('週末は映画を見ます。'));assert(out.includes('社外秘の契約'));assert(!contextState(r,selected,cs[1]));
});
test('改行した氏名欄と括弧付き電話は個人情報として初期選択し、機密確認から外しても保護する',()=>{
 const text='担当者名：山田 太郎\n電話番号：090(0000)0001',p=personalReview(text),cs=contextCandidates(text,[{start:0,end:text.length,text,labels:['文脈上の機密候補'],sources:['端末内AI']}],p);
 assert.equal(cs.length,0);assert(p.findings.some(f=>f.kind==='person'&&f.text==='山田 太郎'));assert(p.findings.some(f=>f.kind==='phone'&&f.text==='090(0000)0001'));
 const out=abstractMessage(p,initialSelection(p)).text;assert(!out.includes('山田'));assert(!out.includes('090'));assert(out.includes('\n電話番号：'));
});
test('機密範囲の一部しか選択されていない場合は保護済みと判定しない',()=>{const original='秘密の内容です。',candidate={start:0,end:original.length},review={original,findings:[{id:'partial',start:0,end:2}]};assert.equal(contextState(review,new Set(['partial']),candidate),false);});
