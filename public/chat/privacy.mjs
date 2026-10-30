// Detection uses a normalized view; every result points back to unchanged original text.
export const REVIEW_VERSION='context-2';
export const HIDDEN='[非表示]';
export function normalizedView(original){
 const starts=[],ends=[];let text='';
 const chunks=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(original)]:[...original.matchAll(/.(?:[\p{M}ﾞﾟ])*/gsu)].map(m=>({segment:m[0],index:m.index}));
 for(const {segment,index}of chunks){for(let c of segment.normalize('NFKC')){if(/\p{Cf}/u.test(c))continue;if(/\s/u.test(c))c=' ';text+=c;for(let i=0;i<c.length;i++){starts.push(index);ends.push(index+segment.length);}}}
 return{text,starts,ends};
}
function luhn(digits){let n=0;for(let i=digits.length-1,odd=false;i>=0;i--,odd=!odd){let d=Number(digits[i]);if(odd){d*=2;if(d>9)d-=9;}n+=d;}return n%10===0;}
const rules=[
 ['メールアドレス',/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.(?:xn--[A-Z0-9-]+|[A-Z]{2,}|日本|みんな)/giu],
 ['URL',/https?:\/\/[^\s<>"'。、]+/giu],
 ['アカウントID',/(?<![A-Za-z0-9._%+-])@[A-Za-z0-9_][A-Za-z0-9_.-]{2,}/gu],
 ['郵便番号',/〒?\d{3}[- ]\d{4}/gu],
 ['氏名',/(?:本名|氏名|名前)(?:は|[:：])\s*([一-龯ぁ-んァ-ヶA-Za-z][一-龯ぁ-んァ-ヶA-Za-z ]{1,30}?)(?=です|と申します|といいます|[。!?,、]|$)/gu,1],
 ['カード・口座・識別番号',/(?:カード番号|クレカ(?:番号)?|クレジットカード(?:番号)?|口座番号|マイナンバー)(?:は|[:：=])?\s*(\d(?:[ \p{Pd}−ー]*\d){2,31})/gu,1],
 ['セキュリティコード',/(?:CVV|CVC|PIN|暗証番号|セキュリティコード)(?:は|[:：=])?\s*(\d{3,8})/giu,1],
 ['有効期限',/(?:カードの)?有効期限(?:は|[:：=])?\s*(\d{1,2}\s*[/-]\s*\d{2,4})/gu,1],
 ['秘密情報',/(?:password|passwd|api[_ -]?key|access[_ -]?token|secret)\s*[:=]\s*["']?([A-Za-z0-9_./+=-]{6,})/giu,1],
 ['秘密情報',/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|hf_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})/gu],
 ['秘密情報',/(?:Authorization\s*[:=]\s*)?Bearer\s+([A-Za-z0-9._~-]{10,})/giu,1],
 ['秘密情報',/sk-(?:proj-)?[A-Za-z0-9_-]{12,}/gu],
 ['秘密情報',/(?:パスワード|認証コード|ワンタイムパスワード)(?:は|[:：=])\s*([^\s。、！？!,]{3,100})/gu,1],
 ['住所',/(?:北海道|東京都|大阪府|京都府|[一-龯]{2,3}県)[一-龯ぁ-んァ-ヶ]{1,12}(?:市|区|町|村)[一-龯ぁ-んァ-ヶ]{1,12}\d[0-9丁目番地号 \p{Pd}−ー]{0,20}/gu],
 ['住所',/[一-龯]{2,8}(?:市|区|町|村)[一-龯ぁ-んァ-ヶ]{1,12}\d[0-9丁目番地号 \p{Pd}−ー]{0,20}/gu],
 ['学校・所属',/[一-龯ァ-ヶA-Za-z]{2,20}(?:大学|高等学校|専門学校|高校|中学校|小学校|学園)/gu],
 ['勤務先',/(?:株式会社|有限会社)[一-龯ぁ-んァ-ヶA-Za-z0-9]{2,25}/gu],
 ['駅名',/[一-龯ァ-ヶA-Za-z0-9]{1,12}駅/gu],
 ['地名',/(?:北海道|青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|東京|神奈川|新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知|三重|滋賀|京都|大阪|兵庫|奈良|和歌山|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄)(?:都|道|府|県)?|(?:名古屋|横浜|札幌|仙台|さいたま|川崎|金沢|浜松|神戸|北九州|那覇|渋谷|新宿|池袋|吉祥寺|梅田|難波|博多)(?:市|区|町)?/gu]
];
export function detectPrivacy(original){
 if(typeof original!=='string'||original.length>2000)throw Error('確認する文章は2,000文字以内にしてください。');
 const view=normalizedView(original),spans=[];
 const add=(start,end,label)=>{if(start<0||end<=start||end>view.text.length)return;spans.push({start:view.starts[start],end:view.ends[end-1],labels:[label]});};
 for(const[label,re,group]of rules){for(const m of view.text.matchAll(re)){let quote=group?m[group]:m[0];if(label==='メールアドレス')quote=quote.replace(/^.*(?:メール(?:アドレス)?|連絡先)(?:は|[:：])\s*/u,'');if(label==='勤務先')quote=quote.replace(/(?:です|でした|から|へ|に)$/u,'').replace(/の[一-龯]{1,5}(?:さん|様)$/u,'');if((label==='氏名'&&/^(?:秘密|内緒|非公開|仲良くなってから)$/.test(quote.trim()))||(label==='駅名'&&/^(?:最寄り|最寄|最寄の)?駅$/.test(quote)))continue;const start=m.index+m[0].lastIndexOf(quote);add(start,start+quote.length,label);}}
 // Whole number runs avoid masking just part of a card as a phone number.
 for(const m of view.text.matchAll(/\+?\d(?:[ \p{Pd}−ー]*\d){5,}/gu)){const digits=m[0].replace(/\D/g,'');if((/^0[1-9]/.test(digits)&&[10,11].includes(digits.length))||(m[0].startsWith('+81')&&[12,13].includes(digits.length)))add(m.index,m.index+m[0].length,'電話番号');else if(digits.length>=13&&digits.length<=19&&luhn(digits))add(m.index,m.index+m[0].length,'カード番号の候補');}
 spans.sort((a,b)=>a.start-b.start||b.end-a.end);const merged=[];
 for(const span of spans){const last=merged.at(-1);if(last&&span.start<last.end){last.end=Math.max(last.end,span.end);last.labels=[...new Set([...last.labels,...span.labels])];}else merged.push({...span});}
 return {original,normalizedChanged:view.text!==original,findings:merged.map((span,i)=>({...span,id:'p'+i,text:original.slice(span.start,span.end)}))};
}
export function reviewedMessage(review,selected){
 if(!review||typeof review.original!=='string'||!Array.isArray(review.findings)||!(selected instanceof Set))throw Error('確認結果が無効です。');
 const known=new Set(review.findings.map(f=>f.id));if([...selected].some(id=>!known.has(id)))throw Error('選択結果を確認し直してください。');
 let cursor=0,text='';for(const f of review.findings){if(!Number.isInteger(f.start)||!Number.isInteger(f.end)||f.start<cursor||f.end<=f.start||f.end>review.original.length||review.original.slice(f.start,f.end)!==f.text)throw Error('確認した文章が変わっています。');text+=review.original.slice(cursor,f.start)+(selected.has(f.id)?HIDDEN:f.text);cursor=f.end;}return text+review.original.slice(cursor);
}
