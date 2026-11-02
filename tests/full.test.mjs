import test from 'node:test';import assert from 'node:assert/strict';
import {fullReview,fullMessage} from '../public/chat/full.mjs';
import {personalReview,selectContext,contextKey,copyIsReady} from '../public/chat/check-review.mjs';
import {TYPES,abstractMessage,partitionReview} from '../public/chat/abstraction.mjs';
import {restoreText} from '../public/chat/pii-core.mjs';
const session='aabbccddeeff';
function protect(raw,model=[]){const s=fullReview(personalReview(raw),model);let selected=new Set(s.review.findings.filter(f=>TYPES[f.kind].rank===1).map(f=>f.id));for(const c of s.contexts)selected=selectContext(s.review,selected,c,true);return{...s,selected,...fullMessage(s.review,selected,s.contexts,{session})};}
test('珍しい背景と閉店事情を一般化し、契約相談と質問を残す',()=>{
 const raw='県内唯一の医療機器専門店で、創業者の長女が経理を担当しています。その人から、来月閉店するので契約を打ち切りたいと言われました。どう返事すればよいですか？',r=protect(raw);
 for(const q of ['県内唯一','医療機器専門店','創業者の長女','来月閉店'])assert(!r.text.includes(q),q);
 for(const q of ['詳しい背景は省略します','事業上の事情により','契約を打ち切りたい','どう返事すればよいですか？'])assert(r.text.includes(q),r.text);
 assert(r.mapping.some(m=>m.restorable===false));assert(r.contexts.every(c=>c.reason));
});
test('フルでも候補を残す選択なら名前・電話だけの初期保護を維持する',()=>{
 const raw='名前は山田太郎です。来月閉店するので契約を打ち切ります。電話は090(0000)0001です。',s=fullReview(personalReview(raw));let selected=new Set(s.review.findings.filter(f=>TYPES[f.kind].rank===1).map(f=>f.id));for(const c of s.contexts)selected=selectContext(s.review,selected,c,false);const r=fullMessage(s.review,selected,s.contexts,{session});assert(r.text.includes('来月閉店'));assert(!r.text.includes('山田太郎'));assert(!r.text.includes('090'));assert(r.text.includes('電話は'));
});
test('意味を確定できない機密文は内容を含む範囲を隠し、質問を残す',()=>{
 const raw='認証を迂回できる管理画面が残っています。対応方法を教えてください。',r=protect(raw);assert(!r.text.includes('認証を迂回'));assert(r.text.includes('非公開情報'));assert(r.text.includes('対応方法を教えてください。'));
});
test('同じ文の末尾にある相談の依頼まで隠さない',()=>{
 const raw='管理画面では認証を省略できますがどう対応すればよいですか？',r=protect(raw);assert(!r.text.includes('認証を省略'));assert(r.text.includes('どう対応すればよいですか？'));
});
test('趣味・一般論・架空の設定に背景候補を追加しない',()=>{
 for(const raw of ['週末は映画を見ます。','唯一の趣味は映画です。','機密情報とはどういう意味ですか？','これは架空の物語です。県内唯一の専門店が来月閉店します。'])assert.equal(fullReview(personalReview(raw)).contexts.length,0,raw);
});
test('一般化した背景の中にPIIがあっても断片ごとに同じ言葉を重複出力しない',()=>{
 const raw='県内唯一の医療機器専門店の担当者は山田太郎です。どう返事すればよいですか？',r=protect(raw);assert(!r.text.includes('山田太郎'));assert.equal((r.text.match(/詳しい背景は省略します/g)||[]).length,1);assert(r.text.includes('どう返事すればよいですか？'));
});
test('一般化部分を復元せず、別のPIIラベルだけを正確に復元する',()=>{
 const raw='名前は山田太郎です。来月閉店するので契約を打ち切ります。',r=protect(raw),out=restoreText(r.text,r.mapping);assert(out.text.includes('山田太郎'));assert(out.text.includes('事業上の事情により'));assert(!out.text.includes('来月閉店'));assert.equal(out.unknown.length,0);
 assert.throws(()=>restoreText('関係者',[{replacement:'関係者',original:'創業者の娘',restorable:false}]),/置換表/);
});
test('背景の一部分だけを選択した場合は文全体の一般化を適用しない',()=>{
 const raw='県内唯一の医療機器専門店の名前は山田太郎です。',s=fullReview(personalReview(raw)),selected=new Set(s.review.findings.filter(f=>f.kind==='person').map(f=>f.id)),r=fullMessage(s.review,selected,s.contexts,{session});assert(r.text.includes('県内唯一'));assert(!r.text.includes('詳しい背景は省略します'));assert(!r.text.includes('山田太郎'));
});
test('名寄せなどで分割が変わっても一般化の範囲と理由を保つ',()=>{
 const raw='県内唯一の専門店で、創業者の長女が担当しています。',s=fullReview(personalReview(raw)),review=partitionReview(s.review,[{start:0,end:3,kind:'manual',labels:['手動'],sources:['手動']}]),selected=new Set(review.findings.map(f=>f.id)),r=fullMessage(review,selected,s.contexts,{session});assert.equal(r.text,'特定につながる詳しい背景は省略します。');
});
test('AI判定だけで見つかった非公開事実も確認候補になり、コピー前の判断を必要とする',()=>{
 const raw='次の提案では顧客ごとの検査手順を省くことになりました。質問に答えてください。',end=raw.indexOf('。')+1,s=fullReview(personalReview(raw),[{start:0,end,labels:['文脈上の機密候補'],sources:['端末内AI']}]);assert(s.contexts.length);assert(!copyIsReady(true,false,s.contexts,new Map()));const decisions=new Map(s.contexts.map(c=>[contextKey(c),'hide']));assert(copyIsReady(true,false,s.contexts,decisions));const r=protect(raw,[{start:0,end,labels:['文脈上の機密候補'],sources:['端末内AI']}]);assert(!r.text.includes('検査手順を省く'));assert(r.text.includes('質問に答えてください。'));
});

test('同じ文に別の機密が残るときは、部分的な一般化で保護済み扱いにしない',()=>{const raw='来月閉店するので契約を打ち切り、従業員への給与未払いも発生しています。どう対応すればよいですか？',r=protect(raw);assert(!r.text.includes('給与未払い'));assert(!r.text.includes('来月閉店'));assert(r.text.includes('どう対応すればよいですか？'));});
test('否定された事業方針を肯定する言い換えにしない',()=>{for(const raw of ['来月閉店する予定はありません。','閉店するのではなく改装します。']){const r=protect(raw);assert(!r.text.includes('事業上の事情により'));assert(!r.text.includes('今後の事業方針に変更がある'));}});

test('顧客に関する検査や確認工程を省く具体的な方針を保護候補にする',()=>{const raw='次の提案では顧客ごとの検査手順を省くことになりました。対応方法を教えてください。',r=protect(raw);assert(!r.text.includes('検査手順を省く'));assert(r.text.includes('対応方法を教えてください。'));});

test('具体的な非公開の取引合意や、顧客の健康・家庭の事情を候補にする',()=>{for(const raw of ['先方とは他の代理店には知らせない独占の約束をしています。どのように返信すればよいですか？','顧客は健康診断で病気が判明し治療中です。対応方法を教えてください。']){const r=protect(raw);assert(r.text.includes('非公開情報'));assert(!r.text.includes('独占の約束'));assert(!r.text.includes('治療中'));}});

test('具体的な取引先の事情がない一般論・定義の質問を機密文にしない',()=>{for(const raw of ['独占契約とは何ですか？','特別な取引条件の一般的な決め方を教えてください。'])assert.equal(fullReview(personalReview(raw)).contexts.length,0,raw);});
