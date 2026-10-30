// Never read the body, credentials, or database of requests from legacy chat clients.
export function retiredChat() {
  return Response.json({error:'CHAT_RETIRED',message:'文章チェック専用に変更しました。ページを再読み込みしてください。'}, {status:410,headers:{'Cache-Control':'no-store'}});
}
