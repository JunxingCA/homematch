import "server-only";
import { requireSession } from "./supabase";
import { ProfileRepository } from "./repositories/ProfileRepository";
import { PreferenceController } from "./controllers/PreferenceController";
export async function profileController() {
  const { client, user } = await requireSession();
  return new PreferenceController(new ProfileRepository(client, user.id));
}
