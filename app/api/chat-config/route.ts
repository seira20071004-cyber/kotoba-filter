import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
export const dynamic='force-dynamic';
export async function GET(){const user=await getChatGPTUser();const e=env as unknown as Record<string,string>;return Response.json({signedIn:!!user,available:!!user&&!!e.OPENAI_API_KEY},{headers:{'Cache-Control':'no-store'}});}
