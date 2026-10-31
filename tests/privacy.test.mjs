import test from 'node:test';import assert from 'node:assert/strict';
import {detectPrivacy,normalizedView,reviewedMessage,HIDDEN} from '../public/chat/privacy.mjs';
test('全角・不可視文字で検出し、原文の文字位置と表記を保存',()=>{const raw='  😊連絡先：ｔａ\u200bｒｏ＠ｅｘａｍｐｌｅ．ｃｏｍ\nよろしく！  ';const r=detectPrivacy(raw);assert.equal(r.original,raw);assert(r.normalizedChanged);assert.equal(r.findings.length,1);assert.equal(r.findings[0].text,'ｔａ\u200bｒｏ＠ｅｘａｍｐｌｅ．ｃｏｍ');assert.equal(raw.slice(r.findings[0].start,r.findings[0].end),r.findings[0].text);assert.equal(reviewedMessage(r,new Set()),raw);assert.equal(reviewedMessage(r,new Set(['p0'])),'  😊連絡先：[非表示]\nよろしく！  ');});
test('濁点結合や合字も正規化後から原文へ対応付ける',()=>{assert.equal(normalizedView('ｶﾞ・か\u3099・ﬃ').text,'ガ・が・ffi');const raw='名前はｶﾞｸです。';const r=detectPrivacy(raw);assert(r.findings.some(f=>f.text==='ｶﾞｸ'));assert.equal(reviewedMessage(r,new Set(r.findings.map(f=>f.id))),'名前は[非表示]です。');});
test('一つ選んだときだけその箇所を置換し、同じ情報の別の出現を勝手に変更しない',()=>{const raw='渋谷で映画を見ます。渋谷にも詳しいです。';const r=detectPrivacy(raw);assert.equal(r.findings.length,2);assert.equal(reviewedMessage(r,new Set([r.findings[0].id])),'[非表示]で映画を見ます。渋谷にも詳しいです。');assert.equal(reviewedMessage(r,new Set()),raw);});
test('重なる地名・駅名や学校名をまとめ、個人情報の一部を残さない',()=>{for(const raw of ['渋谷駅の近くです。','東京大学に通っています。']){const r=detectPrivacy(raw);assert.equal(r.findings.length,1);const result=reviewedMessage(r,new Set(r.findings.map(f=>f.id)));assert(!result.includes('渋谷'));assert(!result.includes('東京'));assert.equal((result.match(/\[非表示\]/g)||[]).length,1);}});
test('電話番号・カード・CVV・期限・本名を原文の範囲で検出',()=>{const raw='氏名は山田 太郎です。電話：０９０−１２３４−５６７８。カード番号は４２４２ ４２４２ ４２４２ ４２４２。CVVは１２３。有効期限は１２／２９。';const r=detectPrivacy(raw);assert.equal(r.findings.length,5);for(const f of r.findings)assert.equal(raw.slice(f.start,f.end),f.text);const out=reviewedMessage(r,new Set(r.findings.map(f=>f.id)));assert(!out.includes('山田'));assert(!/[0-9０-９]/.test(out));assert.equal((out.match(/\[非表示\]/g)||[]).length,5);});
test('カード番号を途中の電話番号だけとして切り取らない',()=>{for(const raw of ['カード番号は4000 0000 0000 0002です','4242 4242 4242 4242']){const r=detectPrivacy(raw);assert.equal(r.findings.length,1);assert.equal(r.findings[0].text.replace(/\D/g,'').length,16);assert(!/\d/.test(reviewedMessage(r,new Set(['p0']))));}});
test('都道府県・住所・URL・所属を検出',()=>{for(const raw of ['東京都新宿区西新宿２丁目８番１号','https://example.com/private','株式会社サンプルです','早稲田大学です'])assert(detectPrivacy(raw).findings.length,raw);});
test('普通の文章・HTML・記号を勝手に変えず候補ゼロで保持',()=>{for(const raw of ['映画が好きです！\nありがとう😊','<img src=x onerror=alert(1)>','  今日はどうしよう？  ',HIDDEN]){const r=detectPrivacy(raw);assert.equal(r.findings.length,0);assert.equal(reviewedMessage(r,new Set()),raw);}});
test('選択範囲の偽造や別の原文の選択IDを拒否する',()=>{const r=detectPrivacy('渋谷です');assert.throws(()=>reviewedMessage(r,new Set(['unknown'])));assert.throws(()=>reviewedMessage({...r,original:'新宿です'},new Set(['p0'])));assert.throws(()=>reviewedMessage({...r,findings:[{...r.findings[0],start:-1}]},new Set(['p0'])));});
test('改行で終わる氏名欄・かなや中黒を含む名乗りを原文のまま検出する',()=>{
 for(const [raw,name] of [['担当者名：山田 太郎\n電話番号：090(0000)0001','山田 太郎'],['氏名：佐々木 葵\r\nメール：a@example.com','佐々木 葵'],['お名前：ジョン・スミス\nよろしくお願いします','ジョン・スミス'],['Name is not Japanese.\n氏名：John Smith','John Smith'],['せいらと申します。','せいら'],['名前はｼﾞｮﾝ･ｽﾐｽです。','ｼﾞｮﾝ･ｽﾐｽ']]){
  const r=detectPrivacy(raw);assert(r.findings.some(f=>f.text===name&&f.labels.includes('氏名')),raw);assert(!reviewedMessage(r,new Set(r.findings.map(f=>f.id))).includes(name));
 }
});
test('括弧・全角・国際表記の電話番号をモデルなしでも全桁保護する',()=>{
 for(const phone of ['090(0000)0001','03（0000）0001','０９０（００００）０００１','+81 3 0000 0001','＋８１（０）３－００００－０００１','+81 90 0000 0001']){
  const raw=`電話番号：${phone}です。`,r=detectPrivacy(raw);assert(r.findings.some(f=>f.text===phone&&f.labels.includes('電話番号')),phone);assert.equal(reviewedMessage(r,new Set(r.findings.map(f=>f.id))),'電話番号：[非表示]です。');
 }
 for(const raw of ['2026-11-01','注文番号：1234567890','09000\n000001','担当者は未定です。名前は秘密です。','休日は映画を見ます。'])assert.equal(detectPrivacy(raw).findings.length,0,raw);
});
