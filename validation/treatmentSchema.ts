import { z } from "zod";

export const introSequenceSchema = z.object({});

export const conditionSchema = z.object({
  promptName: z.string(),
  position: z
    .enum(["shared", "player", "all"])
    .or(z.number().nonnegative().int())
    .default("player"),
  comparator: z.enum([
    "exists",
    "notExists",
    "equal",
    "notEqual",
    "isAbove",
    "isBelow",
    "isAtLeast",
    "isAtMost",
    "lengthAtLeast",
    "lengthAtMost",
    "include",
    "notInclude",
    "match",
    "notMatch",
    "oneOf",
    "notOneOf",
  ]),
  value: z
    .number()
    .or(z.string())
    .or(z.array(z.string().or(z.number())))
    .optional(),
});

export const elementSchema = z.object({
  name: z.string().optional(),
  desc: z.string().optional(),

  displayTime: z.number().nonnegative().optional(),
  hideTime: z.number().gt(0).optional(),
  showToPositions: z.array(z.number()).optional(),
  hideFromPositions: z.array(z.number()).optional(),
  conditions: z.array(conditionSchema).optional(),
  // shared: z.boolean().optional(),
});

export const audioSchema = elementSchema.extend({
  type: z.literal("audio"),
  file: z.string(),
  // Todo: check that file exists
});

export const displaySchema = elementSchema.extend({
  type: z.literal("display"),
  promptName: z.string(),
  position: z
    .enum(["shared", "player", "all"])
    .or(z.number().nonnegative().int())
    .default("player"),
  // Todo: check that promptName is a valid prompt name
  // Todo: check that position is a valid position
});

export const promptSchema = elementSchema.extend({
  type: z.literal("prompt"),
  file: z.string(),
  shared: z.boolean().optional(),
  // Todo: check that file exists
});

export const promptShorthandSchema = z.string().transform((str) => {
  const newElement = {
    type: "prompt",
    file: str,
  };
  return newElement;
});

export const qualtricsSchema = elementSchema.extend({
  type: z.literal("qualtrics"),
  url: z.string(),
  params: z.array(z.record(z.string().or(z.number()))).optional(),
});

export const separatorSchema = elementSchema.extend({
  type: z.literal("separator"),
  style: z.enum(["thin", "thick", "regular"]).optional(),
});

export const sharedNotepadSchema = elementSchema.extend({
  type: z.literal("sharedNotepad"),
});

export const submitButtonSchema = elementSchema.extend({
  type: z.literal("submitButton"),
  buttonText: z.string().optional(),
});

export const surveySchema = elementSchema.extend({
  type: z.literal("survey"),
  surveyName: z.string(),
  // Todo: check that surveyName is a valid survey name
});

export const talkMeterSchema = elementSchema.extend({
  type: z.literal("talkMeter"),
});

export const timerSchema = elementSchema.extend({
  type: z.literal("timer"),
  startTime: z.number().gt(0).optional(),
  endTime: z.number().gt(0).optional(),
  warnTimeRemaining: z.number().gt(0).optional(),
  // Todo: check that startTime < endTime
  // Todo: check that warnTimeRemaining < endTime - startTime
});

export const videoSchema = elementSchema.extend({
  type: z.literal("video"),
  url: z.string().url(),
  // Todo: check that url is a valid url
});

export const treatmentSchema = z
  .object({
    name: z.string(),
    desc: z.string().optional(),
    playerCount: z.number(),
    groupComposition: z
      .array(
        z.object({
          desc: z.string().optional(),
          position: z.number().nonnegative().int(),
          title: z.string().optional(),
        })
      )
      .optional(),
    gameStages: z.array(
      z.object({
        name: z.string(),
        duration: z.number().gt(0),
        desc: z.string().optional(),
        elements: z
          .array(
            z
              .discriminatedUnion("type", [
                audioSchema,
                displaySchema,
                promptSchema,
                qualtricsSchema,
                separatorSchema,
                sharedNotepadSchema,
                submitButtonSchema,
                surveySchema,
                talkMeterSchema,
                timerSchema,
                videoSchema,
              ])
              .or(promptShorthandSchema)
          )
          .nonempty(),
      })
    ),
    exitSequence: z
      .array(
        z.object({
          name: z.string(),
          desc: z.string().optional(),
          elements: z
            .array(
              z
                .discriminatedUnion("type", [
                  audioSchema,
                  displaySchema,
                  promptSchema,
                  qualtricsSchema,
                  separatorSchema,
                  sharedNotepadSchema,
                  submitButtonSchema,
                  surveySchema,
                  talkMeterSchema,
                  timerSchema,
                  videoSchema,
                ])
                .or(promptShorthandSchema)
            )
            .nonempty(),
        })
      )
      .optional(),
  })
  .strict();
