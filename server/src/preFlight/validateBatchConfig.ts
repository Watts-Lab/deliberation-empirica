import { z } from "zod";
import { getText } from "../providers/cdn";

/*
Checks to write:
- treatmentFile exists and is valid
- treatments are present in treatment file
- introSequence is present in treatment file, or "none"
- videoStorage.bucket exists in given region
*/

export const batchConfigSchema = z.object({
  batchName: z.string(),
  cdn: z.enum(["test", "prod", "local"]),
  treatmentFile: z.string().regex(/\.yaml$/),
  introSequence: z.literal("none").or(z.string()),
  treatments: z.array(z.string()).nonempty(),
  exitCodes: z
    .object({
      complete: z.string(),
      error: z.string(),
      lobbyTimeout: z.string(),
    })
    .or(z.literal("none")),
  launchDate: z.literal("none").or(
    z
      .string()
      .transform((str) => new Date(str))
      .refine((date) => date > new Date(), {
        message: "Launch date must be in the future",
      })
  ),
  dispatchWait: z.number().positive(),
  videoStorage: z.literal("none").or(
    z.object({
      bucket: z.string(),
      region: z.enum([
        "af-south-1",
        "ap-east-1",
        "ap-northeast-1",
        "ap-northeast-2",
        "ap-northeast-3",
        "ap-south-1",
        "ap-south-2",
        "ap-southeast-1",
        "ap-southeast-2",
        "ap-southeast-3",
        "ap-southeast-4",
        "ca-central-1",
        "ca-west-1",
        "eu-central-1",
        "eu-central-2",
        "eu-north-1",
        "eu-south-1",
        "eu-south-2",
        "eu-west-1",
        "eu-west-2",
        "eu-west-3",
        "il-central-1",
        "me-central-1",
        "me-south-1",
        "sa-east-1",
        "us-east-1",
        "us-east-2",
        "us-west-1",
        "us-west-2",
      ]),
    })
  ),
  preregRepos: z.literal("none").or(
    z.array(
      z.object({
        owner: z.string(),
        repo: z.string(),
        branch: z.string(),
        directory: z.string(),
      })
    )
  ),
  dataRepos: z.array(
    z.object({
      owner: z.string(),
      repo: z.string(),
      branch: z.string(),
      directory: z.string(),
    })
  ),
  preregister: z.boolean(),
  checkAudio: z.boolean(),
  checkVideo: z.boolean(),
});

export function validateBatchConfig(config) {
  const result = batchConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}
