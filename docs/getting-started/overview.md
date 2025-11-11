# What Is Deliberation Lab?

Deliberation Lab is a fully-automated online laboratory for running large-scale conversation experiments. It gives research teams control over every aspect of a discussion—from participant onboarding and matching to synchronized prompts, stimuli, and post-session surveys—so once a batch is configured, you can collect as many conversations as you can recruit participants for, much like fielding an online survey.

## Who It’s For

- **Basic science researchers** probing how different conversation behaviors or platform affordances shape discourse outcomes.
- **Applied researchers** testing interventions that improve dialogue across disagreement (e.g., cross-partisan, intergroup conflict, community deliberation).

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

## When to Choose Deliberation Lab

Use it when you need:

- Fine-grained control over conversational structure or stimuli.
- Rapid replication of the same treatment across many cohorts.
- Automated matching and facilitation without live staff.
- Data exports that tie back to clearly versioned manifests.

Consider lighter tools (e.g., Zoom) if you only need a handful of sessions and don’t need precise replicability.

## What’s Next

If you’re new, continue to the “Quickstart Tour” to run the sample study end-to-end. Existing researchers can jump to the Planning, Running, or Analysis sections depending on their role. For questions about whether Deliberation Lab fits your project, reach out via the research team Slack or file an issue in this repo.
