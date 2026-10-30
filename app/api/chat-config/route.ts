export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json({available:false,mode:'local-text-checker'}, {headers:{'Cache-Control':'no-store'}});
}
