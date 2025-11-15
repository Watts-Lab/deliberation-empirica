# What Is Deliberation Lab?

Deliberation Lab is a fully-automated online laboratory for running large-scale conversation experiments. It gives research teams control over every aspect of a discussion—from participant onboarding and matching to synchronized prompts, stimuli, and post-session surveys—so once a batch is configured, you can collect as many conversations as you can recruit participants for, much like fielding an online survey.

## Who It’s For

- **Basic science researchers** probing how different conversation behaviors or platform affordances shape discourse outcomes.
- **Applied researchers** testing interventions that improve dialogue, e.g. across lines of disagreement, in problem-solving settings, etc.

## Why We Built It

Conversation research suffers from “causal density”: participant traits, group composition, and the evolving path of a dialogue all interact, making it hard to attribute effects to a single intervention. Traditional lab or Zoom-based workflows compound the problem:

- Sessions are slow to schedule and staff, limiting the volume of data collection.
- Procedures, tooling, and facilitator habits differ across labs, so results are hard to compare.
- External events shift during multi-month data collection, reducing temporal validity.

Deliberation Lab standardizes the entire workflow so researchers can run many matched conversations quickly, compare effects across conditions, and pool findings without hidden procedural differences.

## What It Offers

- **Automated lifecycle**: Configure a batch once, share the participation link, and the platform handles onboarding, matching, treatment assignment, synchronous discussions, surveys, and debriefing. Throughput is bounded only by how quickly you can recruit.
- **Constraint-based group formation**: Define group-level targets (ideology mix, demographics, prior attitudes) and the system randomizes incoming participants into groups that satisfy those features, even when arrivals are unpredictable.
- **Scriptable experiences**: Precisely time stimuli, orchestrate breakout rooms, and walk participants through each step, so that everyone receives the intended treatment.
- **Precisely replicable treatments**: Every step is explicitly specified, ensuring a treatment runs the same way across replications or follow-up studies.
- **Traceable data pipeline**: Conditions, measures, and timestamps are synced directly to version-controlled repositories, so you can audit every point in the data pipeline, from what participants see and how they react through analysis and publication.
- **Rapid iteration**: Modify an existing manifest or instrument, redeploy, collect data, and analyze results within a day, making it easy to refine stimuli or run quick follow-up experiments.
- **Commensurable data**: Treatments, manifests, and outputs follow shared schemas, making it straightforward to compare across studies or share protocols with other teams.

## State of the Platform

Deliberation Lab is still evolving. We’ve focused first on researchers who need maximum experimental power—people willing to trade a bit of setup effort for precise control, templating syntaxes, and other “power user” capabilities. In parallel, we’re building tooling that lowers the barrier for broader teams:

- Automated treatment definition tests catch configuration errors or missing assets before a batch launches.
- Higher-level templates and guardrails make it easier to script multi-stage treatments without hand-editing every step.
- UX polish and setup helpers are steadily reducing rough edges, though you should still expect some hands-on configuration today.

Expect rapid iteration across these areas as we keep balancing horsepower with usability.

## The Deliberation Lab Design Model

The Deliberation Lab separates **content** from **logic** to make experiments easy to author, understand, and reproduce.

### Content vs. Logic

At its core, the design model separates:

- **Content** — the text, media, and prompts shown to participants, written in plain Markdown for readability and easy editing.
- **Logic** — the rules that determine _when_, _to whom_, and _under what conditions_ that content appears, expressed through YAML treatment files.

This separation lets social scientists update study materials without touching orchestration code. Markdown provides a minimal syntax for formatting documents, while YAML treatment manifests provide a powerful yet transparent way to express presentation logic.

### Flexible Experimental Structure

This architecture supports complex experiments that:

- Consist of multiple **stages** (intro, discussion, survey, debrief, etc.).
- Present different **content** to different participants or groups.
- Apply **conditional visibility** or **timing rules** to manipulate interactions.
- Integrate diverse **modalities**—text, audio, or video—without changing the underlying logic.

Because logic and content are stored in separate, version-controlled files, each experiment can be fully documented and replicated. Reading the treatment and Markdown files together provides a complete, human‑readable record of what participants experienced and under what conditions.

### Why This Matters

The goal of this model is to make experimentation **transparent**, **modular**, and **collaborative**:

- **Transparent** — anyone can inspect a study’s assets to see exactly what participants saw and when.
- **Modular** — components like intros, stages, and surveys can be reused across studies.
- **Collaborative** — teams can divide work cleanly between content editing and experimental design.

## When to Choose Deliberation Lab

Use it when you need:

- Fine-grained control over conversational structure or stimuli.
- Rapid replication of the same treatment across many cohorts.
- Automated matching and facilitation without live staff.
- Data exports that tie back to clearly versioned manifests.

Consider lighter tools (e.g., Zoom) if you only need a handful of sessions and don’t need precise replicability.

## Participant Devices Supported by Deliberation Lab

Mobile devices (including phones or tablets) are currently not supported, and will receive an error page.

Participants can use windows, mac, or linux, with one of the following browsers:

| Browser | Minimum Supported Version |
| ------- | ------------------------- |
| Chrome  | 89                        |
| Firefox | 89                        |
| Safari  | 15                        |
| Edge    | 89                        |
| Opera   | 75                        |

## What’s Next

If you’re new, continue to the [Setup](setup.md) to set up a local development server and run an annotated demo end-to-end.
