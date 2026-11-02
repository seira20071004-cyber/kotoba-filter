import {unitsFor} from './confidential.mjs?v=fullquality3';
import {normalizedView} from './privacy.mjs?v=fullquality3';

export const PRIVATE_CUE=/社外秘|極秘|未公開|未公表|未発表|公開前|発表前|口外禁止|社内限り|水面下|内々|NDA|秘密保持|外には出せない|まだ.{0,16}(?:公表|発表|伝えていな)/iu;
const actual=/ただし|実際|現実|弊社|当社|自社|社内では|本番/u;
const assertion=/(?:できますが|できるが|できます|ですが|ですけど|であり|なので|したため|されたため|しており|しています|していますが|してあります|決めて|決まって|打ち明け|聞きました|と言われ|と判明|受けています|まかなえ|払えない|滞って|という事情)/u;
const requestEnding=/(?:教えて|考えて|作って|提案して|説明して|整理して|短くして|読みやすくして|一覧にして|まとめて|出して|示して)(?:ください|ほしい)(?:[。！？!?]|$)|(?:相談したい|知りたい)(?:です)?[。！？!?]?$|^(?:どう|どのように).{0,32}(?:すれば|したら|対応|返信|返事).{0,15}(?:よい|いい|ですか|ください|[？?])/u;
// Requests are exempt only when they contain no asserted private fact. This is not an allow-list of topic words.
export function requestOnly(t){t=t.trim().replace(/[、,]$/u,'');return !/[、,]/u.test(t)&&requestEnding.test(t)&&!assertion.test(t)&&!PRIVATE_CUE.test(t)&&!/(?:は|が|の理由は).{0,45}(?:治療中|透析中|うつ病|逮捕|横領|自己破産|倒産|閉店する|撤退する|買収する|合併する)/u.test(t);}
const requestTail=/(?:どう(?:対応|返信|返事|したら|すれば)|どのように(?:対応|返信|返事)|(?:対応方法|返信案|確認項目|改善策|修正の優先順位)を(?:教えて|考えて|提案して))/u;
// Split only at a verified request boundary. Original UTF-16 offsets are retained through normalization.
export function fullUnitsFor(original){const v=normalizedView(original);return unitsFor(original).flatMap(u=>{
 if(requestOnly(u.text))return [{...u,parentId:u.id}];
 const cuts=new Set([0,u.text.length]);
 for(const m of u.text.matchAll(/[、,]/gu)){if(requestOnly(u.text.slice(0,m.index)))cuts.add(m.index+1);else if(requestOnly(u.text.slice(m.index+1)))cuts.add(m.index+1);}
 const tail=u.text.match(requestTail);if(tail?.index>0&&requestOnly(u.text.slice(tail.index)))cuts.add(tail.index);
 const points=[...cuts].sort((a,b)=>a-b);return points.slice(0,-1).map((a,i)=>{const b=points[i+1],start=u.normalizedStart+a,end=u.normalizedStart+b;return{...u,parentId:u.id,text:u.text.slice(a,b),normalizedStart:start,start:v.starts[start],end:v.ends[end-1]};});
 }).map((u,i)=>({...u,id:"s"+i}));}
export function publicContext(t,{scoped=false}={}){
 if(PRIVATE_CUE.test(t)||actual.test(t)||/(?:載って|掲載されて|公表されて|公開されて)(?:いない|いません|ない)|とは(?:異なり|違い)/u.test(t))return false;
 // Explicit publication is local to this clause; it never exempts following internal facts.
 if(/(?:公開済み|公表済み|プレスリリース|公開された資料|報道済み)/u.test(t))return true;
 // A prevention instruction is not a disclosure of a particular person's medical history.
 if(/(?:情報|病歴|病名|診断結果|個人情報|機密情報).{0,20}(?:を|は).{0,20}(?:入力|送信|共有|公開|収集|開示)しない(?:ように)?(?:しましょう|してください|でください)/u.test(t)&&!assertion.test(t))return true;
 if(!scoped&&/^(?:当店は|弊店は)?(?:来月|今月|来年)?(?:閉店|廃業|撤退)する予定はありません[。！!]?$/u.test(t.trim()))return true;
 return false;
}
export const RISK_RULES=Object.freeze([
 ['財務・支払能力',/(?:手持ち|手元|現金).{0,30}(?:家賃|支払|引き落とし|返済).{0,20}(?:落とせない|落とせません|できない|できません)|(?:口座残高|運転資金|手元資金|資金繰り).{0,50}(?:まかなえ|不足|足り|底を|払え|尽き|厳し|苦し)|(?:給与|給料|仕入れ代金|返済|支払い).{0,35}(?:滞って|遅れて|払えない|未払い|未払)/u],
 ['健康・家庭の具体的な事情',/(?:双極性障害|うつ病|認知症|不妊治療|がんの治療|抗がん剤|透析を受け)|(?:顧客|依頼者|同僚|働く人|社員|従業員|先方|家族|本人|私は|自分は).{0,70}(?:病気|病名|治療|通院|入院|透析|双極性障害|うつ病|認知症|がん|癌|抗がん剤|介護|借金|離婚|不妊)|(?:病歴|診断結果|障害情報|休職理由).{0,35}(?:です|だった|ある|あります|受け|判明|うつ病)/u],
 ['法務・事件の具体的な事情',/(?:逮捕|横領|捜査を受け|自己破産|内部告発|不正会計|粉飾|脱税|刑事事件|起訴|告訴|訴訟)|(?:入札|落札).{0,40}(?:前に|事前|競合|取り決め|決めて)/u],
 ['内部システムの弱点',/(?:認証|ログイン).{0,25}(?:迂回|省略|不要|せず)|(?:ID|番号|識別子|パラメータ).{0,30}(?:変更|書き換え).{0,35}(?:他社|他人|別の人|別ユーザ).{0,30}(?:見られ|開け|閲覧|注文|請求|取得)|脆弱性/iu],
 ['特定の人物の私的な事情',/(?:採用候補者|応募者|お客さま|顧客|依頼者|同僚|従業員|社員|家族)(?:は|が|から|の).{0,65}(?:面接で聞|打ち明け|妊娠|診断|治療|家計|借入|休職理由)/u],
 ['内部の製品・運用に関する具体的な説明',/(?:うち|弊社|当社|自社)の(?:次作|次期|新しい|新規|未発表).{0,65}(?:仕組み|機能|製品|サービス)|(?:来期|来月|来年).{0,30}(?:事業|部門|店舗).{0,10}(?:売却|譲渡|終了)/u],
 ['具体的な事業・人事計画',/閉店|廃業|撤退|買収|合併|倒産|解雇|休職|議決権|給与|基本給/u],
 ['独自の技術・工程',/(?:独自|ノウハウ|社外秘).{0,40}(?:工程|方法|配合|製造|歩留まり)|(?:検査|検品|点検|レビュー|確認)(?:手順|工程|作業)?(?:を|は).{0,12}(?:省く|省略|スキップ)/u],
 ['個別の非公開合意',/(?:独占|優先|特別|例外).{0,24}(?:約束|合意|契約|条件)|(?:知らせない|内輪|口外しない).{0,24}(?:約束|合意|話)/u],
]);
export function riskReasons(t){return RISK_RULES.filter(([,re])=>re.test(t)).map(([label])=>label);}
export function backgroundAxes(t){return [/(?:県内|市内|地域|国内|日本|世界).{0,6}唯一|唯一の|一社しか/u,/(?:創業者|社長|代表)の(?:長女|長男|娘|息子|妻|夫|甥|姪)|親族|家族経営/u,/(?:従業員|社員|スタッフ)(?:は|が)?[0-9一二三四五六七八九十]+人|設立.{0,8}年|創業.{0,8}年/u].map(re=>re.test(t));}
export function identifyingUnits(original,units,excluded){const found=new Set();
 for(let i=0;i<units.length;i++){
  if(excluded(units[i]))continue;
  const window=[];for(let j=i;j<Math.min(i+3,units.length);j++){const u=units[j];if(excluded(u)||/\n\s*\n/u.test(original.slice(units[i].end,u.start)))break;window.push(u);}
  const axes=backgroundAxes(window.map(u=>u.text).join(''));
  if(axes[0]&&(axes[1]||axes[2]))for(const u of window)if(backgroundAxes(u.text).some(Boolean))found.add(u);
 }
 return found;
}

export function privateScopeUnits(original,units,excluded){const found=new Set();let scoped=false,lastEnd=0;for(let i=0;i<units.length;i++){const u=units[i];if(/\n\s*\n/u.test(original.slice(lastEnd,u.start)))scoped=false;lastEnd=u.end;if(PRIVATE_CUE.test(u.text)){scoped=true;const prev=units[i-1];if(prev&&!/\n\s*\n/u.test(original.slice(prev.end,u.start))&&!excluded(prev))found.add(prev);}if(scoped&&!excluded(u))found.add(u);}return found;}
