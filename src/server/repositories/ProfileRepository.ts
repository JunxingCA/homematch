import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  profileSchema,
  type Preference,
  type Profile,
} from "@/domain/preferences";
import { AppError } from "../http";

type Row = {
  id: string;
  revision: number;
  confirmed: boolean;
  updated_at: string;
  payload: unknown;
};
const project = "id,revision,confirmed,updated_at,payload";
const mapRow = (row: Row): Profile => ({
  id: row.id,
  revision: row.revision,
  confirmed: row.confirmed,
  updatedAt: row.updated_at,
  preference: profileSchema.parse(row.payload),
});
function check(error: { message: string } | null) {
  if (!error) return;
  if (error.message.includes("PROFILE_LIMIT"))
    throw new AppError(
      "PROFILE_LIMIT",
      "You can save up to four profiles. Delete one before adding another.",
      409,
    );
  if (error.message.includes("LOCATION"))
    throw new AppError(
      "UNVERIFIED_LOCATION",
      "Resolve every destination before confirming.",
      422,
    );
  throw new AppError(
    "STORAGE_FAILED",
    "Your profile could not be saved or loaded. Please retry.",
    503,
    true,
  );
}

export class ProfileRepository {
  constructor(
    private client: SupabaseClient,
    private userId: string,
  ) {}
  async list(): Promise<Profile[]> {
    const { data, error } = await this.client
      .from("preference_profiles")
      .select(project)
      .eq("user_id", this.userId)
      .order("updated_at", { ascending: false });
    check(error);
    return (data as Row[]).map(mapRow);
  }
  async get(id: string): Promise<Profile> {
    const { data, error } = await this.client
      .from("preference_profiles")
      .select(project)
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();
    check(error);
    if (!data) throw new AppError("NOT_FOUND", "Profile not found.", 404);
    return mapRow(data as Row);
  }
  async create(preference: Preference) {
    const { data, error } = await this.client
      .from("preference_profiles")
      .insert({ user_id: this.userId, payload: preference })
      .select(project)
      .single();
    check(error);
    return mapRow(data as Row);
  }
  async update(
    id: string,
    revision: number,
    change: { payload: Preference } | { confirmed: true },
  ) {
    const { data, error } = await this.client
      .from("preference_profiles")
      .update(change)
      .eq("user_id", this.userId)
      .eq("id", id)
      .eq("revision", revision)
      .select(project)
      .maybeSingle();
    check(error);
    if (!data)
      throw new AppError(
        "PROFILE_CONFLICT",
        "This profile changed in another tab or is no longer available. Reload it before saving.",
        409,
      );
    return mapRow(data as Row);
  }
  async remove(id: string, revision: number) {
    const { data, error } = await this.client
      .from("preference_profiles")
      .delete()
      .eq("user_id", this.userId)
      .eq("id", id)
      .eq("revision", revision)
      .select("id");
    check(error);
    if (!data?.length)
      throw new AppError(
        "PROFILE_CONFLICT",
        "This profile changed. Reload before deleting.",
        409,
      );
  }
}
