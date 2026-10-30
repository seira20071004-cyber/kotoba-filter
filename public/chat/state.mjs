// Only complete recent turns are sent. Browser memory is the sole conversation store.
export function contextFor(history,current){let recent=history.slice(-20);while(recent.length&&recent.reduce((n,m)=>n+m.content.length,0)+current.length>12000)recent=recent.slice(2);return [...recent.map(m=>({role:m.role,content:m.content})),{role:'user',content:current}];}
