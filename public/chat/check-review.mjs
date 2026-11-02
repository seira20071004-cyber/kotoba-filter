import {refineContextFindings,contextualRiskRules} from './context-policy.mjs?v=full1';
import {abstractionReview,partitionReview,TYPES} from './abstraction.mjs?v=full1';
import {mergeReview,contextRuleFindings,CATEGORY_REASONS} from './confidential.mjs?v=full1';

// Business figures, roles and contextual warnings are never selected as PII.
export function personalReview(original,keywords=[]){
  const review=abstractionReview(original,keywords);
  return partitionReview({...review,findings:review.findings.filter(f=>TYPES[f.kind].rank===1)});
}
export function contextCandidates(original,aiFindings=[],personal=personalReview(original)){
  return mergeReview({original,findings:[]},[...refineContextFindings(original,contextRuleFindings(original)),...contextualRiskRules(original),...refineContextFindings(original,aiFindings)]).findings.filter(f=>!contactOnlyCandidate(original,f,personal)).map((f,i)=>({...f,id:'context'+i,kind:'confidential',reason:contextReason(f)}));
}
export function contextReason(f){
  const labels=f.labels.join('・');
  if(labels.includes('直前の非公開'))return '直前の非公開指定に続く具体的な内容のため、開示してよいか確認してください。';
  if(labels.includes('明示された非公開'))return '文章に未公開・社外秘などの指定があるため、開示してよいか確認してください。';
  const clues=[['business',/未(?:発表|公表|公開)|社内だけ|リリース|新製品|事業計画/u],['technical',/独自|ノウハウ|工程|配合|製造/u],['customer',/顧客|契約|取引|値引|原価|仕入|単価/u],['financial',/売上|利益|資金|予算|決算/u],['personnel',/給与|基本給|人事|査定|異動|解雇/u],['legal',/訴訟|調査|紛争|弁護士/u],['security',/認証|パスワード|ログイン|管理画面|脆弱性/u]];
  const clue=clues.find(([,re])=>re.test(f.text||''));
  return f.reason||(clue?CATEGORY_REASONS[clue[0]]:null)||'端末内AIが文脈上の機密・個人情報の可能性を検出しました。実際に非公開の内容か確認してください。';
}
export function initialSelection(review){return new Set(review.findings.filter(f=>f.kind!=='confidential').map(f=>f.id));}
export function selectContext(review,selected,candidate,hide){
  const next=new Set(selected);
  for(const f of review.findings){
    if(f.start>=candidate.start&&f.end<=candidate.end){
      if(hide)next.add(f.id);
      else if(TYPES[f.kind].rank>1)next.delete(f.id);
    }
  }
  return next;
}
export function contextState(review,selected,candidate){
  const parts=review.findings.filter(f=>f.start>=candidate.start&&f.end<=candidate.end);
  return parts.length>0&&parts.every(f=>selected.has(f.id));
}

// Suppress a duplicate context card only for a complete contact template already covered by PII.
export function contactOnlyCandidate(original,candidate,personal){
 const spans=personal.findings.filter(f=>f.start>=candidate.start&&f.end<=candidate.end&&['person','company','email','phone','address','url','personalDate','identifier','contact'].includes(f.kind));
 if(!spans.length)return false;
 let rest='',cursor=candidate.start;
 for(const f of spans){rest+=original.slice(cursor,f.start);cursor=f.end;}
 rest+=original.slice(cursor,candidate.end);
 return /^(?:(?:ご?担当者名|担当者|担当|氏名|名前|本名|連絡先|メールアドレス|メール|電話番号|電話|住所|所在地|に返信してください|に連絡してください|へ連絡してください|生年月日|誕生日|会社名|勤務先|は|です|さん|様)|[\s、。,:：=・])*$/u.test(rest);
}
export const contextKey=c=>c.start+':'+c.end;
export function pendingContexts(contexts,decisions){return contexts.filter(c=>!decisions.has(contextKey(c)));}
export function projectSelection(previous,selected,next,forced=[]){
 if(previous.original!==next.original)throw Error('原文が変わっています。再チェックしてください。');
 const ranges=[...previous.findings.filter(f=>selected.has(f.id)),...forced].sort((a,b)=>a.start-b.start);
 const covered=f=>{let end=f.start;for(const r of ranges){if(r.end<=end)continue;if(r.start>end)break;end=Math.max(end,r.end);if(end>=f.end)return true;}return false;};
 return new Set(next.findings.filter(covered).map(f=>f.id));
}
export function copyIsReady(complete,locked,contexts,decisions){return !!complete&&!locked&&pendingContexts(contexts,decisions).length===0;}
