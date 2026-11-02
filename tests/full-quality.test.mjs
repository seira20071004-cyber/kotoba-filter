import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {runRules,summarize} from '../scripts/evaluate-full.mjs';
import {fullUnitsFor,requestOnly} from '../public/chat/full-policy.mjs';
import {fullReview,fullMessage} from '../public/chat/full.mjs';
import {personalReview,selectContext,contextState} from '../public/chat/check-review.mjs';
import {normalizedView} from '../public/chat/privacy.mjs';
import {TYPES} from '../public/chat/abstraction.mjs';
import {groundPII} from '../public/chat/pii-core.mjs';
const datasets=['baseline','additional','challenge'].map(s=>JSON.parse(fs.readFileSync(new URL('./fixtures/full/'+s+'.json',import.meta.url))));
for(const [i,cases]of datasets.entries())test(`固定データ${i+1}：秘密の範囲をすべて覆い、依頼を残し、非機密文を変更しない（ルールのみ）`,()=>{const r=summarize(runRules(cases));assert.equal(r.protectedAll,r.positive);assert.equal(r.both,r.positive);assert.equal(r.falseAltered,0);assert.equal(r.requestKept,r.total);});
test('依頼の前後に秘密があっても、ユニークな単位IDと原文位置を保つ',()=>{
 for(const text of ['どう対応すればよいですか、顧客は透析を受けています。','顧客は透析中ですが、どう返信すればいいですか？','😀顧客は双極性障害です。対応方法を教えてください。','どう対応すればよいですか、顧客は今月から透析を受けています。']){const units=fullUnitsFor(text);assert.equal(new Set(units.map(u=>u.id)).size,units.length);for(const u of units)assert.equal(normalizedView(text.slice(u.start,u.end)).text,u.text);const r=fullReview(personalReview(text));assert(r.contexts.some(c=>/透析|双極性障害/u.test(c.text)));assert(r.contexts.every(c=>!c.text.includes('どう対応すればよいですか')));}
});
test('AIが全センテンスを機密と誤判定しても、純粋な依頼と公開済みの説明は残す',()=>{
 for(const c of datasets.flat().filter(c=>c.kind==='negative')){const model=fullUnitsFor(c.text).map(u=>({start:u.start,end:u.end,labels:['AI機密候補'],sources:['端末内AI']}));const r=fullReview(personalReview(c.text),model);let selected=new Set(r.review.findings.filter(f=>TYPES[f.kind].rank===1).map(f=>f.id));for(const context of r.contexts)selected=selectContext(r.review,selected,context,true);const output=fullMessage(r.review,selected,r.contexts).text;assert(output.includes(c.keep),c.id);if(/公開済み|公表済み|入力しない|収集しない/.test(c.text))assert.equal(output,c.text,c.id);}
});
test('質問や公開済みという前置きだけで、後続の実際の秘密を許可しない',()=>{
 for(const text of ['公表済みの資料の話です。ただし当社は給与を払えない状態です。返信を考えてください。','一般的な注意点を教えてください、顧客は治療中です。','これは架空の物語です。ただし弊社では買収の交渉を始めています。'])assert(fullReview(personalReview(text)).contexts.some(c=>/払えない|治療中|買収/u.test(c.text)),text);
});
test('役職の一般化だけで病気や法的事情を保護済みと扱わない',()=>{
 for(const text of ['経理責任者が逮捕されたため担当が変わります。','営業部長が自己破産したため担当が変わります。','代表の妻はがんの治療を受けています。']){const r=fullReview(personalReview(text));assert(r.contexts.some(c=>c.kind==='confidential'&&!c.generalization),text);}
});
test('背景をまたぐ範囲も隣接候補の選択状態を正確に持つ',()=>{const text='取引先は県内に一社しかない工房です。代表の姪が担当です。従業員は二人です。確認項目を教えてください。',r=fullReview(personalReview(text));let selected=new Set();for(const c of r.contexts)selected=selectContext(r.review,selected,c,true);assert.equal(r.contexts.filter(c=>c.generalization==='background').length,3);assert(r.contexts.every(c=>contextState(r.review,selected,c)));assert(fullMessage(r.review,selected,r.contexts).text.endsWith('確認項目を教えてください。'));});
test('氏名などの見出しや一般名詞をPIIモデルが誤認しても、真の名前は保持して検出する',()=>{for(const text of ['電話番号','氏名','二社','他社','弊社']){const category=text.endsWith('社')?'organization':'private_person';assert.equal(groundPII(text,[{start:0,end:text.length,category}]).length,0,text);}assert.equal(groundPII('鈴木花子',[{start:0,end:4,category:'private_person'}]).length,1);});
test('数値・否定・全角を含む非公開の事実に、肯定の意味を付け加えない',()=>{const text='社外秘ですが、来年撤退する予定はありません。通常営業の案内を作ってください。',r=fullReview(personalReview(text));assert(r.contexts.some(c=>c.text.includes('撤退する予定はありません')&&!c.generalization));});

test('依頼の直後に短い健康情報が続く場合も、依頼だけとして除外しない',()=>{const text='どう対応すればよいですか、顧客は不妊治療中。',r=fullReview(personalReview(text));assert(r.contexts.some(c=>c.text.includes('不妊治療中')));assert(r.contexts.every(c=>!c.text.includes('どう対応すればよいですか')));});
