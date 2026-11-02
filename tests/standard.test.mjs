import test from 'node:test';import assert from 'node:assert/strict';
import {standardRules,standardReview,groundStandard} from '../public/chat/standard.mjs';
import {personalReview,selectContext,contextKey,copyIsReady} from '../public/chat/check-review.mjs';
import {abstractMessage,TYPES} from '../public/chat/abstraction.mjs';
import {unitsFor} from '../public/chat/confidential.mjs';
import {restoreText} from '../public/chat/pii-core.mjs';
const process=text=>{const s=standardReview(personalReview(text)),selected=new Set(s.review.findings.filter(f=>TYPES[f.kind].rank===1).map(f=>f.id));let next=selected;for(const c of s.contexts.filter(c=>!c.unresolved))next=selectContext(s.review,next,c,true);return{...s,...abstractMessage(s.review,next,{session:'aabbccddeeff'})};};
test('説明・社外秘の宣言・立場・普通の文を残し、スタンダードは具体値だけを隠す',()=>{
 const raw='担当者名：山田 太郎\n電話番号は090(0000)0001です。\nここからが社外秘です。\n上司への見積金額は300万円、値引率は28%です。注文番号はORD-2027-042です。\n新製品名はミラージュで、発売予定日は2027年4月1日です。支払条件は翌月末払いです。\n週末は映画を見ます。',r=process(raw);
 for(const value of ['山田 太郎','090(0000)0001','300万円','28%','ORD-2027-042','ミラージュ','2027年4月1日','翌月末払い'])assert(!r.text.includes(value),value);
 for(const keep of ['電話番号は','ここからが社外秘です。','上司への見積金額は','値引率は','注文番号は','新製品名は','発売予定日は','支払条件は','週末は映画を見ます。'])assert(r.text.includes(keep),keep);
 assert(r.mapping.every(m=>m.reason));assert(!r.text.includes('非公開情報'));assert.equal(r.unresolved.length,0);
});
test('ライトは取引金額や条件を追加検出しない',()=>{const text='見積金額は300万円。支払条件は翌月末払いです。',r=personalReview(text);assert.equal(r.findings.length,0);assert.equal(abstractMessage(r,new Set()).text,text);});
test('同じ機密値の繰り返しには同じラベルを使い、一括で正確に復元する',()=>{const raw='社外秘です。見積金額は300万円。追加予算も300万円。',r=process(raw);assert.equal(r.mapping.length,2);assert.equal(r.mapping[0].replacement,r.mapping[1].replacement);assert.equal(restoreText(r.text,r.mapping).text,raw);});
test('数量の説明を残し、値を置換する',()=>{const raw='社外秘です。年間300台を納品する契約です。',r=process(raw);assert(r.text.includes('年間['));assert(!r.text.includes('300台'));});
test('趣味の金額・一般論・公開済みの事実を自動で機密の値にしない',()=>{for(const raw of ['映画代は1800円で、明日見ます。','週末に300円のカレーを作ります。','一般的な契約の注意点を教えてください。','公開済みの売上は300万円です。'])assert.equal(standardRules(raw).length,0,raw);});
test('未公開の具体値を切り出せないときは文を隠さず要確認にし、確認なしのコピーを許可しない',()=>{const raw='社外秘です。認証を迂回できる管理画面が残っています。',s=standardReview(personalReview(raw));assert(s.unresolved.length);assert.equal(abstractMessage(s.review,new Set()).text,raw);const decisions=new Map();assert(!copyIsReady(true,false,s.contexts,decisions));for(const c of s.contexts)decisions.set(contextKey(c),'keep');assert(copyIsReady(true,false,s.contexts,decisions));});
test('機密の宣言だけを未解決候補や置換対象にしない',()=>{for(const raw of ['ここからが社外秘です。','以下は社外秘です。','社外秘です。']){const s=standardReview(personalReview(raw));assert.equal(s.values.length,0);assert.equal(s.unresolved.length,0);}});
test('端末内AIの引用を全角・不可視文字を含む原文の位置へ戻す',()=>{const raw='製造のコツは、洗浄液を毎回交換することです。',units=unitsFor(raw),r=groundStandard({decisions:{s0:{status:'review',values:[{quote:'洗浄液を毎回交換すること',type:'technical'}]}}},units,raw);assert.equal(r.values[0].text,'洗浄液を毎回交換すること');assert.equal(r.unresolved.length,0);const out=standardReview(personalReview(raw),r);assert(out.contexts.some(c=>c.sources.includes('端末内AI（具体値抽出）')));});
test('文章中にない値・曖昧な繰り返し・全文をモデルが返しても勝手に隠さず要確認にする',()=>{const raw='社内の工程は、冷却してから加熱する方式です。',units=unitsFor(raw);for(const quote of ['存在しない秘密',raw,raw.slice(0,-1)]){const r=groundStandard({decisions:{s0:{status:'review',values:[{quote,type:'technical'}]}}},units,raw);assert.equal(r.values.length,0);assert.equal(r.unresolved.length,1);}});
test('AIが値を返せない場合、欠けた文IDや未知の分類を完了扱いにしない',()=>{const raw='特別な配合です。',units=unitsFor(raw);assert.throws(()=>groundStandard({decisions:{}},units,raw));assert.throws(()=>groundStandard({decisions:{s0:{status:'review',values:[{quote:'配合',type:'invented'}]}}},units,raw));assert.equal(groundStandard({decisions:{s0:{status:'review',values:[]}}},units,raw).unresolved.length,1);});
test('機密を残す選択をしても名前や電話番号の置換を解除しない',()=>{const raw='見積金額は300万円。電話番号は090(0000)0001です。',s=standardReview(personalReview(raw));let selected=new Set(s.review.findings.filter(f=>TYPES[f.kind].rank===1).map(f=>f.id));for(const c of s.contexts){selected=selectContext(s.review,selected,c,true);selected=selectContext(s.review,selected,c,false);}const out=abstractMessage(s.review,selected).text;assert(out.includes('300万円'));assert(!out.includes('090'));assert(out.includes('電話番号は'));});

test('AIが説明ラベル付きの引用や公開判定との矛盾を返しても、番号・金額の値だけを採用する',()=>{
 const raw='見積金額は300万円です。',units=unitsFor(raw),r=groundStandard({decisions:{s0:{status:'public',values:[{quote:'見積金額は300万円',type:'amount'}]}}},units,raw);assert.equal(r.values[0].text,'300万円');assert.equal(r.unresolved.length,0);
});
test('解決できないAI警告は理由と検出元を必ず持ち、保護済みの連絡先と重複しない',()=>{
 const raw='電話番号は090(0000)0001です。',units=unitsFor(raw),model=groundStandard({decisions:{s0:{status:'review',values:[]}}},units,raw);assert(model.unresolved[0].sources.length);assert(model.unresolved[0].labels.length);assert.equal(standardReview(personalReview(raw),model).unresolved.length,0);
});

test('AIが機密と判定した工程の具体的手順だけを補助抽出し、試験の背景と結果は残す',()=>{
 const raw='社内の試験では、洗浄液を再利用せず毎回交換すると歩留まりが改善しました。',units=unitsFor(raw),r=groundStandard({decisions:{s0:{status:'review',values:[]}}},units,raw);assert.equal(r.values[0].text,'洗浄液を再利用せず毎回交換する');assert.equal(r.unresolved.length,0);const s=standardReview(personalReview(raw),r),selected=new Set(s.review.findings.map(f=>f.id)),out=abstractMessage(s.review,selected).text;assert(out.includes('社内の試験では、['));assert(out.includes('と歩留まりが改善しました。'));
});

test('引用符付き製品名・桁区切り金額・支払いサイトなどの別書式も具体値を保護する',()=>{
 const raw='ここからが社外秘です。製品名は「月灯」です。見積額は1,200,000円です。支払いサイトは翌々月15日払いです。',r=process(raw);for(const value of ['月灯','1,200,000円','翌々月15日払い'])assert(!r.text.includes(value),value);for(const label of ['製品名は「','見積額は','支払いサイトは'])assert(r.text.includes(label),label);
});
