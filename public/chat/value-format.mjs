import {normalizedView} from './privacy.mjs?v=meaning3';
const number='(?:[0-9][0-9,]*(?:\\.[0-9]+)?(?:兆|億|万|千|百)?|[一二三四五六七八九十百千万億兆]+)';
const quantity=new RegExp('^(?:年間|月間|毎月)?\\s*('+number+')\\s*(セット|ロット|パック|ケース|メートル|トン|キロ|台|個|件|本|枚|箱|冊|袋|組|人|kg|ml|g|L|時間|日|週間|か月|ヶ月|年|月)(?:以上|以下|未満)?$','iu');
const amount=new RegExp('^([¥$€]\\s*)?('+number+')\\s*(円|ドル|ユーロ|%|パーセント|割)?(?:以上|以下|未満)?$','u');
// Only known measurement syntax is split. Dates, identifiers, product names and
// free-form terms remain whole. Magnitude words (万 etc.) stay with the secret number.
export function meaningfulValueSpan(original,value){
 if(!['quantity','amount','confidentialValue'].includes(value.kind))return value;
 if(!Number.isInteger(value.start)||!Number.isInteger(value.end)||original.slice(value.start,value.end)!==value.text)throw Error('原文が変わっています。');
 const v=normalizedView(value.text),valueKind=value.kind==='confidentialValue'?(quantity.test(v.text)?'quantity':'amount'):value.kind,m=v.text.match(valueKind==='quantity'?quantity:amount);
 if(!m)return value;
 const quote=valueKind==='quantity'?m[1]:m[2],unit=valueKind==='quantity'?m[2]:m[3]||m[1]?.trim();
 if(!unit)return value;
 const a=v.text.indexOf(quote),start=value.start+v.starts[a],end=value.start+v.ends[a+quote.length-1];
 const kind=valueKind==='quantity'?(/^(?:時間|日|週間|か月|ヶ月|年|月)$/u.test(unit)?'durationValue':'quantityValue'):/^(?:%|パーセント|割)$/u.test(unit)?'ratioValue':'amountValue';
 return {...value,start,end,text:original.slice(start,end),kind,reason:(value.reason||'業務の具体値を保護します。')+' 数値を隠し、単位・比較表現は原文のまま残します。'};
}
