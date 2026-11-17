import { requireChatGPTUser } from '../chatgpt-auth';
import html from '../../server/generated-ui.mjs';
export const dynamic = 'force-dynamic';
export async function GET() {
  await requireChatGPTUser('/leerplatform');
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
