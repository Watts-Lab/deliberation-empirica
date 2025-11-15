# Documentation Work Plan

This README tracks how we will turn the current collection of notes into a coherent user-facing documentation set. It is intentionally excluded from the MkDocs build so we can keep planning details close to the content without publishing them.

## Goals
- Establish audience-aware documentation that follows the experiment lifecycle (plan → run → analyze).
- Provide an onboarding pathway that explains what Deliberation Lab is, when to use it, and how it differs from adjacent tools.
- Normalize formats (tutorials, how-tos, reference, explanations) so writers can work in parallel without producing inconsistent artifacts.

## Guiding Structure
We will anchor navigation around three user roles (Experiment Designers, Session Operators, Data Analysts) and pair that with a reference layer. Proposed MkDocs tree:

1. **Getting Started**
   - What Is Deliberation Lab
   - When to Use It (comparison/fit guide)
   - Quickstart Tour (run the sample deliberation end-to-end)
2. **Planning Experiments (Designers)**
   - Designing Treatments (tutorial + schema overview)
   - Stimuli & Prompts
   - Participant Assignment & Flows
   - Templates, Checklists, and QA
3. **Running Sessions (Operators)**
   - Environment + Preflight
   - Launching & Monitoring Batches
   - Facilitator Tools, Live Support, Troubleshooting
4. **Analyzing Results (Analysts)**
   - Data Export & Verification
   - Data Schema Reference
   - Analysis Playbooks / Sample Notebooks
   - Reporting & Insight Templates
5. **Reference & Specifications**
   - Treatment manifest schema
   - Batch config, CLI/scripts, glossary, architecture
6. **Background & Roadmap**
   - Vision, design principles, comparisons, research goals, contribution guidelines

## Workstreams
1. **Inventory & Gap Analysis**
   - Catalog current docs (`docs/*.md`) with owner, freshness, and audience tags.
   - Log missing topics (running sessions, analysis, orientation content).
2. **Personas & Journeys**
   - Document designer/operator/analyst responsibilities and their “first 30 minutes.”
   - Validate with stakeholders so new docs answer real questions.
3. **Information Architecture & Style Guide**
   - Update `mkdocs.yml` nav to match the structure above.
   - Draft short style rules (voice, admonitions, code fences) plus templates per doc type.
4. **Content Sprints**
   - Sprint 1: Getting Started + overview pieces.
   - Sprint 2: Planning/how-to rewrites (existing treatment notes).
   - Sprint 3: Running sessions + operations playbooks.
   - Sprint 4: Analysis guides + data reference.
5. **Quality & Maintenance**
   - Add Markdown lint/link-check to CI.
   - Create doc update checklist for feature PRs.
   - Schedule quarterly audits with SME sign-off and “last verified release” tags.

## Next Actions
- [ ] Finish inventory spreadsheet with status/owners.
- [ ] Draft personas + onboarding journeys.
- [ ] Update `mkdocs.yml` nav scaffolding (can be stubbed with TODO placeholders).
- [ ] Create doc templates (`docs/templates/*.md`?).
- [ ] Kick off Sprint 1: Getting Started tutorial + orientation essays.
