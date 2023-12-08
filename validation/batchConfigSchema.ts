import { z } from "zod";

const batchConfigSchema = z.object({
  batchName: z.string(),
  treatmentFile: z.string().regex(/\.yaml$/),
  treatments: z.array(z.string()).nonempty(),
  launchDate: z
    .date()
    .optional()
    .refine((date) => date > new Date(), {
      message: "Launch date must be in the future",
    }),
  introSequence: z.string().optional(),
  preregRepos: z
    .array(
      z.object({
        owner: z.string(),
        repo: z.string(),
        branch: z.string(),
        directory: z.string(),
      })
    )
    .optional(),
  dataRepos: z.array(
    z.object({
      owner: z.string(),
      repo: z.string(),
      branch: z.string(),
      directory: z.string(),
    })
  ),
  preregister: z.boolean().optional(),
  checkAudio: z.boolean().optional(),
  checkVideo: z.boolean().optional(),
  cdn: z.string().optional(),
});

export function validateBatchConfig(config: unknown) {
  const result = batchConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}
