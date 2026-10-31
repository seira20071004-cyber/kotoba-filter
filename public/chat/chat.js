import {TYPES,partitionReview,abstractMessage,addAbstractionManual} from './abstraction.mjs?v=review2';
import * as semanticDetector from './local-detector.mjs?v=review2';
import * as piiDetector from './pii-detector.mjs?v=review2';
import {restoreText,applyIdentityLinks,mergePIICandidates} from './pii-core.mjs?v=review2';
import {personalReview,contextCandidates,initialSelection,selectContext,contextState,contextKey,pendingContexts,projectSelection,copyIsReady} from './check-review.mjs?v=review2';
const $=s=>document.querySelector(s),input=$('#messageInput');
let review=null,baseReview=null,contexts=[],selected=new Set(),mapping=[],links=[],manualRanges=[],busy=false,complete=false,generation=0,preparing=false,composing=false,session='';
let contextDecisions=new Map(),preparationEpoch=0;
const withContext=()=>$('#includeConfidential').checked;
const mode=()=>document.querySelector('[name=checkMode]:checked').value;
const ready=()=>piiDetector.isReady()&&(!withContext()||semanticDetector.isReady());
const newSession=()=>{session=Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>n.toString(16).padStart(2,'0')).join('');$('#responseInput').value='';$('#restoredOutput').value='';$('#restoreStatus').textContent='';$('#copyRestored').disabled=true;};
function error(text=''){$('#error').textContent=text;$('#error').hidden=!text;}
function controls(){
  const locked=busy||preparing;
  input.disabled=busy;
  $('#checkButton').disabled=locked||!input.value.trim()||input.value.length>2000;
  $('#checkButton').firstChild.textContent=busy?'チェックしています… ':'文章をチェックする ';
  $('#cancelCheck').hidden=!locked;
  $('#counter').textContent=input.value.length.toLocaleString()+' / 2,000文字';$('#inputLimitError').hidden=input.value.length<=2000;input.setAttribute('aria-invalid',String(input.value.length>2000));
  $('#clearButton').disabled=locked||!input.value;$('#sampleButton').disabled=locked;
  $('#prepareLocalAI').disabled=locked||ready()||mode()==='rules';
  $('#prepareLocalAI').textContent=ready()?'準備完了':preparing?'準備しています…':'先に準備する';
  $('#modelState').textContent=preparing?'端末内AI：準備中':mode()==='rules'?'ルールのみ（AIは未実行）':'個人情報AI：'+(piiDetector.isReady()?'準備完了':'未準備')+(withContext()?' ／ 機密情報AI：'+(semanticDetector.isReady()?'準備完了':'未準備'):'');
  $('#copyButton').disabled=!review||!copyIsReady(complete,locked,contexts,contextDecisions);
  $('#selectAll').disabled=!complete||!review?.findings.length;$('#selectNone').disabled=!complete||!review?.findings.length;
  for(const id of ['manualAdd','manualPhrase','aliasAdd','aliasPhrase','aliasTarget'])$('#'+id).disabled=!complete;
  $('#aliasClear').disabled=!complete||!links.length;
  $('#restorePanel').hidden=!complete||!mapping.length;$('#restoreButton').disabled=!complete||!mapping.length||!$('#responseInput').value.trim()||$('#responseInput').value.length>20000;
  $('#confidentialKeywords').disabled=locked;$('#piiDevice').disabled=locked||mode()==='rules';
  $('#includeConfidential').disabled=locked;
  document.querySelectorAll('[name=checkMode]').forEach(el=>el.disabled=locked);
  $('#reviewOriginal').querySelectorAll('button').forEach(b=>b.disabled=!complete);
  $('#contextList').querySelectorAll('input,button').forEach(b=>b.disabled=!complete);$('#contextHideAll').disabled=!complete;$('#contextKeepAll').disabled=!complete;
}
function invalidate({preservePreparation=false}={}){
  generation++;if(preparing&&!preservePreparation){preparationEpoch++;preparing=false;}if(!preparing){piiDetector.cancelChecks();semanticDetector.cancelChecks();}review=null;baseReview=null;contexts=[];links=[];manualRanges=[];mapping=[];contextDecisions.clear();selected.clear();complete=false;busy=false;newSession();
  $('#restorePanel').open=false;$('#emptyResult').hidden=false;$('#resultContent').hidden=true;$('#contextReview').hidden=true;$('#resultBadge').textContent='もう一度チェックしてください';
  for(const id of ['reviewOriginal','findingReasons','replacementList','aliasLinks','aliasTarget','contextList'])$('#'+id).replaceChildren();
  $('#reviewPreview').value='';$('#copyStatus').textContent='';$('#manualPhrase').value='';$('#manualError').textContent='';$('#aliasPhrase').value='';$('#aliasError').textContent='';error();controls();
}
function preview(){
  if(!review)return;
  const result=abstractMessage(review,selected,{session});mapping=complete?result.mapping:[];$('#reviewPreview').value=complete?result.text:'';$('#reviewPreview').placeholder=complete?'':'チェックが完了すると加工後の文章が表示されます。';
  const map=$('#replacementList');map.replaceChildren();const seen=new Set();
  for(const m of mapping){const key=m.original+'|'+m.replacement;if(seen.has(key))continue;seen.add(key);const li=document.createElement('li'),heading=document.createElement('strong'),why=document.createElement('p');heading.textContent=m.original+' → '+m.replacement;why.textContent='理由：'+m.reason;li.append(heading,why);map.append(li);}
  $('#selectionCount').textContent=selected.size+' / '+review.findings.length+'箇所を置換';$('#unselectedWarning').hidden=selected.size===review.findings.length;$('#copyStatus').textContent='';
  $('#reviewOriginal').querySelectorAll('[data-finding]').forEach(b=>{const active=selected.has(b.dataset.finding);b.setAttribute('aria-pressed',String(active));b.classList.toggle('selected',active);});
  $('#contextList').querySelectorAll('input').forEach((box,i)=>{const c=contexts[i],key=contextKey(c),hidden=contextState(review,selected,c);box.checked=hidden;const status=$('#contextStatus'+i);status.textContent=!contextDecisions.has(key)?'選択待ち':hidden?'隠す選択済み':'内容を残す選択済み';status.classList.toggle('pending',!contextDecisions.has(key));});
  const remaining=contexts.filter(c=>!contextState(review,selected,c)).length;
  const pending=pendingContexts(contexts,contextDecisions).length;$('#reviewProgress').textContent=!complete?'チェック中です。':pending?'機密候補'+pending+'件の扱いを選ぶとコピーできます。':remaining?'選択済みです。内容を残した機密候補が'+remaining+'件あります。':'コピー前に加工文をご確認ください。';$('#copyButton').textContent=pending?'機密候補を確認してください':'文章をコピー';
  $('#contextSelection').textContent=pending?'未確認が'+pending+'件あります。「隠す」か「内容を残す」を選んでください。':remaining?remaining+'件の機密候補は一部または全体が原文のまま残ります。開示してよいか確認してください。':'機密候補はすべて置換対象に選ばれています。';
  controls();
}
function render(){
  if(!review)return;$('#emptyResult').hidden=true;$('#resultContent').hidden=false;
  const area=$('#reviewOriginal');area.replaceChildren();let cursor=0;
  for(const f of review.findings){area.append(document.createTextNode(review.original.slice(cursor,f.start)));const b=document.createElement('button');b.type='button';b.className='privacy-mark';b.dataset.finding=f.id;b.textContent=f.text;b.title=f.sources.join('＋')+'：'+TYPES[f.kind].label;b.setAttribute('aria-label',b.title+'：'+f.text+'。選択して置換する');b.onclick=()=>{if(!complete)return;newSession();selected.has(f.id)?selected.delete(f.id):selected.add(f.id);for(const c of contexts)if(c.start<f.end&&f.start<c.end)contextDecisions.set(contextKey(c),'custom');preview();};area.append(b);cursor=f.end;}
  area.append(document.createTextNode(review.original.slice(cursor)));
  $('#resultSummary').textContent=!complete?'選んだチェックを実行中です。完了するまでコピーはできません。':review.findings.length?(withContext()?'機密候補は'+contexts.length+'件です。個人情報は初期選択し、機密候補を隠すかは本人が選びます。':'個人情報の候補を初期選択しました。原文と加工文を確認してください。'):'候補は見つかりませんでした。個人情報・機密情報がないという保証ではありません。';
  const reasons=$('#findingReasons');reasons.replaceChildren();for(const f of review.findings){const li=document.createElement('li');li.textContent=f.sources.join('＋')+'：'+TYPES[f.kind].label;reasons.append(li);}
  $('#contextReview').hidden=!withContext()||!contexts.length;
  const list=$('#contextList');list.replaceChildren();
  contexts.forEach((c,i)=>{
    const li=document.createElement('li'),label=document.createElement('label'),box=document.createElement('input'),title=document.createElement('strong'),quote=document.createElement('blockquote'),why=document.createElement('p'),source=document.createElement('small'),keep=document.createElement('button'),status=document.createElement('span');
    box.type='checkbox';box.id='contextChoice'+i;box.setAttribute('aria-label','機密候補'+(i+1)+'を隠す');title.textContent='この範囲を隠す';label.append(box,title);
    quote.textContent=review.original.slice(c.start,c.end);why.textContent='確認する理由：'+c.reason;source.textContent='検出元：'+c.sources.join('＋')+' ／ 機密性を断定するものではありません。';
    keep.type='button';keep.className='secondary';keep.textContent='内容を残す';keep.setAttribute('aria-label','機密候補'+(i+1)+'の内容を残す');status.id='contextStatus'+i;status.className='decision-status';
    box.onchange=()=>{if(!complete)return;selected=selectContext(review,selected,c,box.checked);contextDecisions.set(contextKey(c),box.checked?'hide':'keep');newSession();preview();};
    keep.onclick=()=>{if(!complete)return;selected=selectContext(review,selected,c,false);contextDecisions.set(contextKey(c),'keep');newSession();preview();};
    const actions=document.createElement('div');actions.className='decision-actions';actions.append(keep,status);li.append(label,quote,why,source,actions);list.append(li);
  });
  preview();
}
function method(text,incomplete=false){$('#resultMethod').textContent=text;$('#resultMethod').classList.toggle('incomplete',incomplete);}
function aliasOptions(){const select=$('#aliasTarget');select.replaceChildren();const seen=new Set();for(const f of baseReview.findings.filter(f=>['person','company'].includes(f.kind))){const key=f.kind+':'+f.text;if(seen.has(key))continue;seen.add(key);const option=document.createElement('option');option.value=f.id;option.textContent=f.text+'（'+TYPES[f.kind].label+'）';select.append(option);}}
const piiDescription=()=>piiDetector.device()==='webgpu'?'OpenAI Privacy Filter / GPU':'日本語NERモデル＋ルール / CPU';
async function prepareModel(which,id,active=()=>id===generation){const detector=which==='pii'?piiDetector:semanticDetector;await detector.prepare(text=>{if(active())$('#localModelStatus').textContent=(which==='pii'?'個人情報AI：':'機密情報AI：')+text;},$('#piiDevice').value);}
async function prepare(){
  if(preparing||busy||mode()==='rules')return;
  const epoch=++preparationEpoch,active=()=>epoch===preparationEpoch;
  preparing=true;error();controls();
  try{await prepareModel('pii',generation,active);if(!active())return;if(withContext())await prepareModel('context',generation,active);if(active())$('#localModelStatus').textContent='準備完了：'+piiDescription()+(withContext()?' ＋ 機密情報AI（GPU）':'');}
  catch(e){if(active())error(e.message);}
  finally{if(active())preparing=false;controls();}
}
async function check(){
  if(busy||preparing||!input.value.trim()||input.value.length>2000)return;
  const id=++generation;busy=true;complete=false;selected.clear();links=[];manualRanges=[];contexts=[];mapping=[];contextDecisions.clear();newSession();error();$('#manualPhrase').value='';$('#manualError').textContent='';$('#aliasPhrase').value='';$('#aliasError').textContent='';$('#aliasLinks').replaceChildren();
  try{
    review=personalReview(input.value,$('#confidentialKeywords').value.split(/\r?\n/).map(s=>s.trim()).filter(s=>s.length>=2&&s.length<=80).slice(0,20));$('#resultBadge').textContent='確認中';method('個人情報を確認しています…',true);render();
    if(mode()==='ai'){
      if(!piiDetector.isReady())await prepareModel('pii',id);if(id!==generation)return;
      const result=await piiDetector.analyze(review.original,[],text=>{if(id===generation)method('個人情報：'+text,true);});if(id!==generation)return;
      review=partitionReview(mergePIICandidates(review,result.findings));
    }
    if(withContext()){
      let extra=[];
      if(mode()==='ai'){
        method('個人情報の確認済み · 機密情報を端末内AIで確認しています…',true);render();
        if(!semanticDetector.isReady())await prepareModel('context',id);if(id!==generation)return;
        const result=await semanticDetector.analyze(review.original,[],text=>{if(id===generation)method('機密情報：'+text,true);});if(id!==generation)return;extra=result.findings;
      }
      contexts=contextCandidates(review.original,extra,review);
      review=partitionReview(review,contexts);
    }
    if(id!==generation)return;
    method(mode()==='ai'?'個人情報：'+piiDescription()+(withContext()?' ／ 機密情報：端末内AI＋ルール':' ／ 機密情報チェック：オフ')+'。見落とし・誤検出は残ります。':'ルールのみで確認しました。'+(withContext()?'機密情報は明示された非公開指定のみを確認し、文脈AIは未実行です。':'機密情報チェックはオフです。')+'端末内AIは実行していません。');
    baseReview=review;selected=initialSelection(review);complete=true;$('#resultBadge').textContent='チェック完了';$('#localModelStatus').textContent=mode()==='ai'?'確認完了：'+piiDescription()+(withContext()?' ＋ 機密情報AI（GPU）':''):'ルールのみで確認しました。';aliasOptions();render();
  }catch(e){if(id!==generation)return;complete=false;$('#resultBadge').textContent='確認が完了していません';method('選んだ確認を完了できませんでした。コピーは無効です。',true);error(e.message+(withContext()?' 機密情報チェックをオフにして再チェックするか、「ルールのみ」を選べます。':' 「ルールのみ」を選んで再チェックすることもできます。'));}
  finally{if(id===generation){busy=false;controls();}}
}
$('#contextHideAll').onclick=()=>{if(!complete)return;for(const c of contexts){selected=selectContext(review,selected,c,true);contextDecisions.set(contextKey(c),'hide');}newSession();preview();};
$('#contextKeepAll').onclick=()=>{if(!complete)return;for(const c of contexts){selected=selectContext(review,selected,c,false);contextDecisions.set(contextKey(c),'keep');}newSession();preview();};
$('#checkButton').onclick=check;$('#cancelCheck').onclick=()=>{invalidate();$('#resultBadge').textContent='確認を中止しました';};input.addEventListener('input',()=>invalidate({preservePreparation:true}));input.addEventListener('compositionstart',()=>composing=true);input.addEventListener('compositionend',()=>composing=false);input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.isComposing&&!composing&&e.keyCode!==229){e.preventDefault();void check();}});
$('#confidentialKeywords').addEventListener('input',invalidate);document.querySelectorAll('[name=checkMode]').forEach(el=>el.onchange=invalidate);
$('#includeConfidential').onchange=()=>{invalidate();$('#contextHelp').textContent=withContext()?'未公開の計画や社内事情などを、文章の文脈から確認します。候補は理由を見て隠すか選べます。文脈AIはWebGPU対応環境が必要です。':'名前・住所・連絡先などを確認します。機密情報の文脈チェックは行いません。';};
$('#piiDevice').onchange=()=>{piiDetector.reset();invalidate();$('#localModelStatus').textContent='個人情報AIの実行環境を変更しました。再準備してチェックしてください。';};
$('#clearAllData').onclick=()=>{input.value='';$('#confidentialKeywords').value='';invalidate();$('#resultBadge').textContent='画面のデータを消去しました';$('#localModelStatus').textContent='画面のデータを消去しました。クリップボードとモデルキャッシュは残ります。';input.focus();};
$('#clearButton').onclick=()=>{input.value='';invalidate();$('#resultBadge').textContent='まだチェックしていません';input.focus();};
$('#sampleButton').onclick=()=>{if(input.value&&!confirm('入力中の文章をサンプルに置き換えますか？'))return;input.value=withContext()?'担当は山田太郎、メールはtaro@example.comです。来月、まだ発表していない新製品を発売する予定です。週末は映画を見ます。':'担当は山田太郎です。山田さんに返信してください。彼のメールはtaro@example.com、電話は090-0000-0000です。週末は映画を見ます。';invalidate();input.focus();};
$('#prepareLocalAI').onclick=()=>void prepare();$('#selectAll').onclick=()=>{if(!complete)return;newSession();selected=new Set(review.findings.map(f=>f.id));for(const c of contexts)contextDecisions.set(contextKey(c),'hide');preview();};$('#selectNone').onclick=()=>{newSession();selected.clear();for(const c of contexts)contextDecisions.set(contextKey(c),'keep');preview();};
$('#manualAdd').onclick=()=>{if(!complete)return;try{const phrase=$('#manualPhrase').value;const r=addAbstractionManual(review,selected,phrase);let p=0;while((p=review.original.indexOf(phrase,p))>=0){manualRanges.push({start:p,end:p+phrase.length,kind:'manual',labels:['本人が追加した非表示箇所'],sources:['手動']});p+=phrase.length;}review=r.review;selected=r.selected;newSession();$('#manualPhrase').value='';$('#manualError').textContent='';render();}catch(e){$('#manualError').textContent=e.message;}};
$('#aliasAdd').onclick=()=>{try{const target=baseReview.findings.find(f=>f.id===$('#aliasTarget').value);if(!target)throw Error('検出した人物・組織を選んでください。');const next=[...links,{alias:$('#aliasPhrase').value,target:target.text,kind:target.kind}];const extra=applyIdentityLinks(baseReview,next);const nextReview=partitionReview(baseReview,[...manualRanges,...extra]);selected=projectSelection(review,selected,nextReview,extra);review=nextReview;links=next;newSession();$('#aliasLinks').replaceChildren();for(const l of links){const li=document.createElement('li');li.textContent=l.alias+' → '+l.target+' と同じラベル';$('#aliasLinks').append(li);}$('#aliasPhrase').value='';$('#aliasError').textContent='';render();}catch(e){$('#aliasError').textContent=e.message;}};
$('#aliasClear').onclick=()=>{links=[];const nextReview=partitionReview(baseReview,manualRanges);selected=projectSelection(review,selected,nextReview);review=nextReview;newSession();$('#aliasLinks').replaceChildren();render();};
async function copy(text,status){const version=session;try{await navigator.clipboard.writeText(text);if(version!==session)return;$('#'+status).textContent='コピーしました。貼り付け先でも内容をご確認ください。';}catch{$('#'+status).textContent='自動コピーが使えません。文章を選択して ⌘ / Ctrl＋C でコピーしてください。';}}
$('#copyButton').onclick=()=>{if(review&&copyIsReady(complete,busy||preparing,contexts,contextDecisions))void copy(abstractMessage(review,selected,{session}).text,'copyStatus');};
$('#responseInput').oninput=()=>{$('#restoredOutput').value='';$('#restoreStatus').textContent=$('#responseInput').value.length>20000?'復元できる回答は20,000文字までです。文章は切り捨てていません。':'';$('#copyRestored').disabled=true;controls();};$('#restoreButton').onclick=()=>{try{const r=restoreText($('#responseInput').value,mapping);$('#restoredOutput').value=r.text;$('#restoreStatus').textContent=r.unknown.length?'現在の置換表と一致しないラベルが'+r.unknown.length+'種類あります。元に戻さず残しています。':r.restored?r.restored+'箇所を端末内で復元しました。内容をご確認ください。':'一致するラベルがありません。別の文章の回答や、AIが書き換えたラベルは復元できません。';$('#copyRestored').disabled=!r.restored||!!r.unknown.length;}catch(e){$('#restoreStatus').textContent=e.message;}};$('#copyRestored').onclick=()=>{if(!$('#copyRestored').disabled)void copy($('#restoredOutput').value,'restoreStatus');};
$('#aboutButton').onclick=()=>$('#aboutDialog').showModal();$('#closeAbout').onclick=()=>$('#aboutDialog').close();newSession();controls();
