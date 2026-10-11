import "server-only";
import { z } from "zod";
import { profileSchema, confirmedProfileSchema } from "@/domain/preferences";
import { ProfileRepository } from "../repositories/ProfileRepository";
import { config } from "../config";
import { AppError } from "../http";

export class PreferenceController {
  constructor(private repository: ProfileRepository) {}
  list() {
    return this.repository.list();
  }
  async save(input: unknown, id?: string) {
    const { preference, revision } = z
      .object({
        preference: profileSchema,
        revision: z.number().int().positive().optional(),
      })
      .strict()
      .parse(input);
    if (
      config().LOCATION_MODE === "onemap" &&
      preference.destinations.some((d) => d.location?.source === "fixture")
    )
      throw new AppError(
        "FIXTURE_LOCATION",
        "Replace preview destinations with OneMap search results.",
        422,
      );
    if (id) {
      if (!revision)
        throw new AppError(
          "REVISION_REQUIRED",
          "Reload the profile before saving.",
          409,
        );
      return this.repository.update(z.uuid().parse(id), revision, {
        payload: preference,
      });
    }
    return this.repository.create(preference);
  }
  async confirm(id: string, input: unknown) {
    const { revision } = z
      .object({ revision: z.number().int().positive() })
      .strict()
      .parse(input);
    const profile = await this.repository.get(z.uuid().parse(id));
    confirmedProfileSchema.parse(profile.preference);
    return this.repository.update(id, revision, { confirmed: true });
  }
  async remove(id: string, input: unknown) {
    const { revision } = z
      .object({ revision: z.number().int().positive() })
      .strict()
      .parse(input);
    await this.repository.remove(z.uuid().parse(id), revision);
    return { deleted: true };
  }
}
