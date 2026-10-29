import { getChatGPTUser } from '../../../chatgpt-auth';
import { env } from 'cloudflare:workers';
import { handleAPI } from '../../../../server/api.mjs';

// Deze route vereist de officiële Vinext/Sites-starter. Die ontbreekt momenteel
// in de uitvoeromgeving; geen eigen login of alternatieve Worker-hosting toevoegen.
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  const user = await getChatGPTUser();
  return handleAPI(request, { user, db: env.DB, env });
}
export { handle as GET, handle as PUT, handle as DELETE, handle as POST };
