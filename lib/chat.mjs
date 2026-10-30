import {REVIEW_VERSION} from '../public/chat/privacy.mjs';
export const LIMITS={message:2000,reply:6000,messages:21,total:12000,daily:60};
export const instructions='あなたはPrivacy Chatの会話相手です。日本語で親しみやすく、簡潔に役立つ返答をしてください。質問の文脈を踏まえ、必要な場合だけ確認してください。ユーザーに本名、住所、電話番号、学校名、勤務先、カード番号、秘密の情報を尋ねないでください。個人情報検出・マスキング・匿名化が完了したとは主張しないでください。ルールによる送信前チェックと本人による選択的な非表示がありますが、完全な匿名化や端末内AIの検出を実装済みと主張しないでください。[非表示]の内容を推測・復元・質問しないでください。秘密情報を受け取った場合は繰り返さず、共有しないよう短く伝えてください。';
export const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function validMessages(messages){return Array.isArray(messages)&&messages.length>0&&messages.length<=LIMITS.messages&&messages.length%2===1&&messages.every((m,i)=>m&&Object.keys(m).sort().join(',')==='content,role'&&m.role===(i%2?'assistant':'user')&&typeof m.content==='string'&&m.content.trim().length>0&&m.content.length<=(m.role==='user'?LIMITS.message:LIMITS.reply))&&messages.reduce((n,m)=>n+m.content.length,0)<=LIMITS.total;}
async function boundedBody(request){const reader=request.body?.getReader();if(!reader)throw Error();const chunks=[];let size=0;for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>64000){await reader.cancel();throw Error();}chunks.push(value);}const bytes=new Uint8Array(size);let off=0;for(const c of chunks){bytes.set(c,off);off+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));}
export async function handleChat(request,{userId,apiKey,model='gpt-4.1-mini',db},fetcher=fetch){
 if(!userId)return json({error:'AUTH_REQUIRED'},401);
 if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'ORIGIN_REJECTED'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'INVALID_CONTENT_TYPE'},415);
 let body;try{body=await boundedBody(request);}catch{return json({error:'INVALID_REQUEST'},400);}
 if(body?.reviewVersion!==REVIEW_VERSION)return json({error:'PRIVACY_REVIEW_REQUIRED'},422);
 if(!body||Object.keys(body).sort().join(',')!=='consent,messages,reviewVersion'||body.consent!==true||!validMessages(body.messages))return json({error:'INVALID_REQUEST'},400);
 if(!apiKey)return json({error:'AI_NOT_CONFIGURED'},503);
 if(!db)return json({error:'STORAGE_UNAVAILABLE'},503);
 try{const used=await db.prepare('INSERT INTO request_usage (user_id,day,count) VALUES (?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET count=count+1 WHERE count<? RETURNING count').bind(userId,new Date().toISOString().slice(0,10),LIMITS.daily).first();if(!used)return json({error:'DAILY_LIMIT'},429);}catch{return json({error:'STORAGE_UNAVAILABLE'},503);}
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),30000);const stop=()=>abort.abort();request.signal.addEventListener('abort',stop,{once:true});
 try{
  const upstream=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,store:false,instructions,input:body.messages,max_output_tokens:1200}),signal:abort.signal});
  if(!upstream.ok){let reason;try{reason=await upstream.json();}catch{}const code=reason?.error?.code;return json({error:code==='insufficient_quota'||code==='credit_balance_exhausted'?'AI_QUOTA_EXCEEDED':upstream.status===401?'AI_KEY_EXPIRED':upstream.status===429?'AI_RATE_LIMIT':'AI_UNAVAILABLE'},502);}
  const data=await upstream.json();const content=(data.output||[]).filter(m=>m.type==='message').flatMap(m=>m.content||[]);const text=content.filter(c=>c.type==='output_text'&&typeof c.text==='string').map(c=>c.text).join('\n').trim();
  if(data.status!=='completed'||!text||text.length>LIMITS.reply)return json({error:'OUTPUT_UNAVAILABLE'},502);
  return json({reply:text});
 }catch{return json({error:abort.signal.aborted?'AI_TIMEOUT':'AI_UNAVAILABLE'},502);}finally{clearTimeout(timer);request.signal.removeEventListener('abort',stop);}
}
