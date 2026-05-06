import { z } from "zod";

/**
 * Env-var set the manager injects at Railway `serviceCreate`. Runtime
 * reads on boot.
 *
 * Two modes — captured by the `USE_MANAGER_SAVE` boolean flag (per
 * deliberation-lab#11):
 *
 * - `USE_MANAGER_SAVE=true`  — manager-launched. Tick channel is the
 *   data path. Manager-set fields required; legacy GitHub fields
 *   forbidden (their presence indicates configuration drift).
 * - `USE_MANAGER_SAVE=false` — solo-dev / isolated-instance. Direct-
 *   Octokit data path. Legacy GitHub fields required; manager fields
 *   may be absent.
 *
 * The runtime owns the branching since it consumes both modes; the
 * manager only ever produces mode-true env. See manager
 * interface-contract.md §"Runtime configuration injected at
 * serviceCreate" for provenance of each field.
 */

const nonEmpty = z.string().min(1);
const stringifiedBool = z.enum(["true", "false"]);
const stringifiedPositiveInt = z
  .string()
  .regex(/^\d+$/, "must be a base-10 non-negative integer string");

/** Identity + correlation — set on both mode branches when the
 *  manager launches; absent in solo-dev. */
const managerIdentity = z.object({
  INSTANCE_ID: nonEmpty,
  BATCH_ID: nonEmpty,
  STUDY_ID: nonEmpty,
  WORKSPACE_ID: nonEmpty,
  SUBDOMAIN: nonEmpty,
});

/** Channel-enabling — required only on the mode-true branch.
 *  `JWT_VERIFY_SECRET` is the HS256 secret per manager ADR 0010 +
 *  manager#135; the runtime reads it at boot to verify
 *  MANAGER_INSTANCE_TOKEN's signature (deliberation-lab#109). The
 *  manager mints under the same secret + emits it on every spawn. */
const managerChannel = z.object({
  MANAGER_URL: z.string().url(),
  MANAGER_INSTANCE_TOKEN: nonEmpty,
  JWT_VERIFY_SECRET: nonEmpty,
});

/** Resource-context — for Sentry tagging and runtime self-awareness
 *  near the participant cap. Required on mode-true; absent on
 *  mode-false. */
const managerResource = z.object({
  INSTANCE_MEMORY_LIMIT_MB: stringifiedPositiveInt,
  INSTANCE_CPU_ALLOCATION: nonEmpty,
  INSTANCE_PARTICIPANT_CAP: stringifiedPositiveInt,
});

/** Empirica + filesystem operational config — required in BOTH
 *  modes. `DATA_DIR` is the writable filesystem path Tajriba uses
 *  for `tajriba.json` and the runtime uses for export-file staging
 *  (per server/src/preFlight/preFlightChecks.js); the runtime
 *  refuses to boot without it regardless of mode. EMPIRICA_SRTOKEN
 *  arrives manager-side via deliberation-lab#74 and is required on
 *  mode-true; in solo-dev the bundled value in `.empirica/empirica.toml`
 *  is used instead. EMPIRICA_ADMIN_PW is per-Instance random under
 *  the manager, or whatever's in the local .env in solo-dev mode. */
const empiricaOps = z.object({
  DATA_DIR: nonEmpty,
  EMPIRICA_ADMIN_PW: nonEmpty,
  EMPIRICA_SRTOKEN: nonEmpty.optional(),
});

/** Provider creds — a mix of platform-shared and workspace-scoped
 *  in manager mode; in solo-dev they're whatever the local .env
 *  carries. All optional; the runtime falls back gracefully when a
 *  treatment doesn't reference the corresponding integration. */
const providers = z.object({
  DAILY_APIKEY: z.string().optional(),
  QUALTRICS_API_TOKEN: z.string().optional(),
  QUALTRICS_DATACENTER: z.string().optional(),
  ETHERPAD_API_KEY: z.string().optional(),
  ETHERPAD_BASE_URL: z.string().optional(),
});

/** Observability — Sentry DSN + image tag for release tagging. */
const observability = z.object({
  SENTRY_DSN: z.string().optional(),
  CONTAINER_IMAGE_VERSION_TAG: nonEmpty,
});

/** Legacy GitHub data flow — required on mode-false, FORBIDDEN on
 *  mode-true (their presence indicates configuration drift, per
 *  manager interface-contract.md §"Gone from manager-launched
 *  runtimes"). The runtime's preflight enforces the absence. */
const legacyGithub = z.object({
  DELIBERATION_MACHINE_USER_TOKEN: nonEmpty,
  GITHUB_PRIVATE_DATA_OWNER: nonEmpty,
  GITHUB_PRIVATE_DATA_REPO: nonEmpty,
  GITHUB_PRIVATE_DATA_BRANCH: nonEmpty,
  GITHUB_PUBLIC_DATA_OWNER: nonEmpty,
  GITHUB_PUBLIC_DATA_REPO: nonEmpty,
  GITHUB_PUBLIC_DATA_BRANCH: nonEmpty,
});

/** Manager-launched env. `process.env` carries far more than this
 *  set on a typical container (PATH, HOME, etc.), so we use
 *  `.passthrough()` to accept unknown keys; the superRefine then
 *  specifically rejects the legacy GitHub fields, since their
 *  presence under manager mode indicates configuration drift. */
export const managerLaunchedEnv = z
  .object({
    USE_MANAGER_SAVE: z.literal("true"),
  })
  .merge(managerIdentity)
  .merge(managerChannel)
  .merge(managerResource)
  .merge(empiricaOps)
  .merge(providers)
  .merge(observability)
  .passthrough()
  .superRefine((data, ctx) => {
    for (const key of Object.keys(legacyGithub.shape)) {
      if (data[key] !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `Legacy GitHub env var ${key} must be unset when USE_MANAGER_SAVE=true; its presence indicates configuration drift`,
        });
      }
    }
  });

/** Solo-dev env. Inverse: legacy GitHub fields required, manager
 *  fields permitted but unused. */
export const soloDevEnv = z
  .object({
    USE_MANAGER_SAVE: z.literal("false").optional(),
  })
  .merge(legacyGithub)
  .merge(empiricaOps)
  .merge(providers)
  .merge(observability.partial())
  .passthrough();

/** Discriminated parser — pick the right schema based on the flag.
 *  Returns the validated env object or throws. */
export const env = z.union([managerLaunchedEnv, soloDevEnv]);

export {
  managerIdentity,
  managerChannel,
  managerResource,
  empiricaOps,
  providers,
  observability,
  legacyGithub,
  stringifiedBool,
};
