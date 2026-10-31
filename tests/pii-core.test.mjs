import test from 'node:test';import assert from 'node:assert/strict';
import {decodeBIOES,tokenSpansToChars,piiChunks,groundPII,restoreText,applyIdentityLinks} from '../public/chat/pii-core.mjs';
import {abstractionReview,partitionReview,levelSelection,abstractMessage} from '../public/chat/abstraction.mjs';
const session='012345abcdef';
test('BIOESは不正な開始・遷移・終端を避け、名前の範囲を一つにする',()=>{const labels={0:'O',1:'B-private_person',2:'I-private_person',3:'E-private_person',4:'S-private_person'};const data=Float32Array.from([0,9,20,0,0,0,0,1,9,0,9,0,0,0,0]);assert.deepEqual(decodeBIOES(data,3,labels),[{startToken:0,endToken:2,category:'private_person'}]);assert.throws(()=>decodeBIOES(Float32Array.from([NaN]),1,{0:'O'}));});
test('UTF16の絵文字を含む原文の位置とNFKCの展開に対応する',()=>{const raw='😊名前はｶﾞｸです。';const found=groundPII(raw,[{start:5,end:7,category:'private_person'}]);assert.equal(raw.slice(found[0].start,found[0].end),'ｶﾞｸ');assert.throws(()=>groundPII(raw,[{start:0,end:999,category:'private_person'}]));assert.throws(()=>groundPII(raw,[{start:0,end:1,category:'invented'}]));});
test('日本語の途中までのバイトトークンを含んでも文字全体を保護する',()=>{const dec=ids=>ids.length===0?'':ids.length===1?'�':ids.length===2?'山':'山田';assert.deepEqual(tokenSpansToChars([{startToken:0,endToken:1,category:'private_person'}],[1,2,3],'山田',dec),[{start:0,end:1,category:'private_person'}]);assert.throws(()=>tokenSpansToChars([],[],'a',()=>''));});
test('長い入力は重複つきの範囲へ分割し、絵文字を分断せず全体を確認する',()=>{const s='😊'.repeat(600);const chunks=piiChunks(s);assert(chunks.length>1);const covered=new Set();for(const c of chunks){assert(!/^[\uDC00-\uDFFF]/.test(c.text));for(let i=c.offset;i<c.offset+c.text.length;i++)covered.add(i);}assert.equal(covered.size,s.length);});
test('復元は完全一致した現在の表だけ、一回で置換し、未知の表は残す',()=>{const mapping=[{replacement:'[人物1_'+session+']',original:'山田太郎'},{replacement:'[個人情報1_'+session+']',original:'$&[人物1_'+session+']'}];const r=restoreText('[人物1_'+session+']様。 [個人情報1_'+session+'] / [人物1_ffffffffffff]',mapping);assert(r.text.startsWith('山田太郎様。 $&[人物1_'));assert.equal(r.restored,2);assert.deepEqual(r.unknown,['[人物1_ffffffffffff]']);assert.throws(()=>restoreText('x',[{replacement:'x',original:'a'},{replacement:'x',original:'b'}]));});
test('名寄せは本人が指定した別表記・代名詞だけを一つの仮名にし、復元先は統合先に統一する',()=>{const base=abstractionReview('名前は山田太郎です。山田さんと彼に返信。'),links=[{alias:'山田',target:'山田太郎',kind:'person'},{alias:'彼',target:'山田太郎',kind:'person'}];const extra=applyIdentityLinks(base,links),review=partitionReview(base,extra),r=abstractMessage(review,levelSelection(review,'light'),{session});assert.equal((r.text.match(/人物1_/g)||[]).length,3);assert(!r.text.includes('人物2_'));const restored=restoreText(r.text,r.mapping).text;assert(restored.includes('山田太郎さんと山田太郎'));assert.throws(()=>applyIdentityLinks(base,[{alias:'山田',target:'存在しない',kind:'person'}]));});
test('曖昧な二人の同姓は自動統合せず、衝突する本人指定も拒否する',()=>{const base=abstractionReview('名前は山田太郎です。名前は山田花子です。山田さんが来ます。');const r=abstractMessage(base,levelSelection(base,'light'),{session});assert(r.text.includes('人物1_'));assert(r.text.includes('人物2_'));assert.throws(()=>applyIdentityLinks(base,[{alias:'山田',target:'山田太郎',kind:'person'},{alias:'山田',target:'山田花子',kind:'person'}]));});
test('別のチェックの識別子では既存の回答を誤復元しない',()=>{const base=abstractionReview('名前は山田太郎です。'),selected=levelSelection(base,'light');const a=abstractMessage(base,selected,{session}),b=abstractMessage(base,selected,{session:'ffffffffffff'});const r=restoreText(a.text,b.mapping);assert.equal(r.restored,0);assert.equal(r.unknown.length,1);});

test('文頭の人名でも空配列をtokenizer.decodeへ渡さない',()=>{const decode=ids=>{if(!ids.length)throw Error('empty');return ids.length===1?'山田':'山田です';};assert.deepEqual(tokenSpansToChars([{startToken:0,endToken:1,category:'private_person'}],[1,2],'山田です',decode),[{start:0,end:2,category:'private_person'}]);});
test('表記正規化で同一ラベルになる値も復元先が衝突しない',()=>{const r=abstractionReview('Ａ社とA社の相談です。'),p=abstractMessage(r,levelSelection(r,'light'),{session});assert.doesNotThrow(()=>restoreText(p.text,p.mapping));});
test('モデルが含めた空白と敬称は残し、文章の意味と体裁を保つ',()=>{const raw='To Alice Morgan さんへ';const findings=groundPII(raw,[{start:2,end:18,category:'private_person'}]);assert.equal(raw.slice(findings[0].start,findings[0].end),'Alice Morgan');});
test('明示された生年月日をライトでも保護し、一般の予定日は残す',()=>{const raw='生年月日は1998年7月14日です。会議は12月5日です。',r=abstractionReview(raw);const out=abstractMessage(r,levelSelection(r,'light'),{session}).text;assert(!out.includes('1998年7月14日'));assert(out.includes('12月5日'));});
test('AIが識別子を削ったラベルも、黙って復元成功として扱わない',()=>{const r=restoreText('[人物1]様、[人物1_012345abcdef]です。',[{replacement:'[人物1_012345abcdef]',original:'山田'}]);assert.equal(r.restored,1);assert.deepEqual(r.unknown,['[人物1]']);});
test('NERがメールを名前や組織へ分割しても、メール全体を一つの候補として維持する',async()=>{const {mergePIICandidates}=await import('../public/chat/pii-core.mjs');const raw='alice@example.com',base=abstractionReview(raw);const r=partitionReview(mergePIICandidates(base,[{start:0,end:5,kind:'person',labels:['氏名'],sources:['専用PIIモデル']},{start:6,end:17,kind:'company',labels:['社名・所属'],sources:['専用PIIモデル']}]));assert.equal(r.findings.length,1);assert.equal(r.findings[0].kind,'email');const p=abstractMessage(r,levelSelection(r,'light'),{session});assert.equal(p.mapping.length,1);assert(p.text.startsWith('[メール1_'));});
test('メールの国際表記や英語ラベルの認証情報もルールで補う',()=>{for(const raw of ['連絡先はユーザー@例え.jpです。','password=synthetic-test-secret','api_key: synthetic_test_key_12345','Bearer synthetic-test-bearer-token']){const r=abstractionReview(raw),out=abstractMessage(r,levelSelection(r,'light')).text;assert.notEqual(out,raw);assert(!out.includes('synthetic-test-secret'));}});
test('会社名の後の丁寧語や人物の呼称を組織名に巻き込まない',()=>{const r=abstractionReview('株式会社サンプルです。');assert.equal(abstractMessage(r,levelSelection(r,'light')).text,'[組織1]です。');});
test('カードと郵便番号の候補が重なっても識別番号として置換する',()=>{const r=abstractionReview('テスト用のカード番号は4242 4242 4242 4242です。'),p=abstractMessage(r,levelSelection(r,'light'),{session});assert.equal(p.mapping[0].kind,'identifier');assert(p.text.includes('[識別番号1_'));});

test('電話のAIスパンに説明ラベルや語尾が含まれても番号だけを置換する',()=>{
 const original='電話番号は０９０（００００）０００１です。';
 const spans=groundPII(original,[{start:0,end:original.normalize('NFKC').length,category:'private_phone'}]);
 assert.equal(original.slice(spans[0].start,spans[0].end),'０９０（００００）０００１');
});

test('正規化で改行をまたいだ人名スパンは別々の人物に分割する',()=>{
 const original='ジョン・スミス\nせいら',spans=groundPII(original,[{start:0,end:original.length,category:'private_person'}]);
 assert.deepEqual(spans.map(f=>original.slice(f.start,f.end)),['ジョン・スミス','せいら']);
});
