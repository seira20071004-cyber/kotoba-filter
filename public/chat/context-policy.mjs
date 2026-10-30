import {unitsFor} from './confidential.mjs?v=quality1';
// Narrow intent/scope checks, not a blanket exemption for words such as "fiction".
const privateCue=/社外秘|極秘|未公表|未公開|未発表|口外禁止|NDA|秘密保持|内々|水面下|社内限り|外には出せない|まだ.{0,16}(?:公表|発表|伝えていな)/iu;
const realAnchor=/実際|現実|弊社|当社|自社|社内|顧客|取引先|従業員|社員|人事|査定|基本給|認証|管理画面|パスワード|API.?キー|アクセストークン|本番/u;
const guidance=/^(?:(?:機密情報|個人情報|社外秘情報|営業秘密|情報漏えい|情報漏洩)[^。！？!?]{0,65}(?:一般的な|基本的な|一般論として)[^。！？!?]{0,35}(?:注意点|対策|定義|方法|解説|意味)[^。！？!?]{0,25}(?:教えて|説明して|知りたい|読みたい)|(?:機密情報|個人情報|社外秘情報|営業秘密)(?:とは|の意味)[^。！？!?]{0,50}(?:教えて|説明して))[^。！？!?]{0,10}[。？！!?]?$/u;
const fictionIntro=/^(?:これは|以下は|ここからは)?(?:完全に)?(?:架空の(?:物語|小説|設定)|フィクション(?:の設定)?)(?:です|になります)[。！!]?$/u;
const factual=/[^、。]{1,30}(?:は|を|が|に|では).{0,45}(?:無料にした|免除した|下げることが|迂回でき|省略でき|交渉して|調整して|仕入れ|計画では|予定です|決まりました)/u;
export function contextPolicy(original){
 const units=unitsFor(original),decisions=new Map();let fictional=false,lastEnd=0;
 for(const u of units){
  if(/\n\s*\n/u.test(original.slice(lastEnd,u.start)))fictional=false;
  const intro=fictionIntro.test(u.text),actual=realAnchor.test(u.text),explicit=privateCue.test(u.text);
  if(actual||explicit)fictional=false;
  const pureGuidance=guidance.test(u.text)&&!factual.test(u.text)&&!realAnchor.test(u.text.replace(/個人情報|機密情報|社外秘情報|営業秘密/gu,''))&&!/(?:未公開|未発表|社外秘の|秘密保持|NDA)/iu.test(u.text);
  const generalFunding=/(?:資金調達|増資|議決権).{0,40}(?:とはどういう意味|一般論として知りたい)/u.test(u.text)&&!factual.test(u.text)&&!actual;
  const published=/公開済み|公表済み|プレスリリース/u.test(u.text)&&/(?:一般的|解説|紹介文|読みたい|教えて)/u.test(u.text)&&!explicit&&!actual;
  const exclude=pureGuidance||generalFunding||published||intro||(fictional&&!actual&&!explicit);
  decisions.set(u.id,{unit:u,exclude,reason:exclude?(intro||fictional?'明示された架空設定':'具体的な非公開事実を含まない一般的な相談'):null});
  if(intro)fictional=true;lastEnd=u.end;
 }
 return decisions;
}
export function refineContextFindings(original,findings){
 const policy=[...contextPolicy(original).values()];
 return findings.flatMap(f=>policy.filter(p=>!p.exclude&&p.unit.start<f.end&&p.unit.end>f.start).map(p=>({...f,start:Math.max(f.start,p.unit.start),end:Math.min(f.end,p.unit.end)})));
}
export function contextualRiskRules(original){
 const out=[];
 for(const {unit:u,exclude} of contextPolicy(original).values()){
  if(!exclude&&/(?:資金調達|増資|出資|議決権|調達額)/u.test(u.text)&&/(?:水面下|内々|未公表|未公開|社内限り|外には出せない)/u.test(u.text)&&/(?:調整|交渉|割当|相談|条件|計画)/u.test(u.text))out.push({start:u.start,end:u.end,labels:['非公開指定のある資金調達・出資条件'],sources:['文脈補助ルール'],reason:'非公開を示す表現と、資金調達・出資条件の具体的な検討が併記されているため確認してください。'});
 }
 return out;
}
