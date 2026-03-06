# Development Log

This directory contains documentation of design decisions, investigations, and implementation patterns for the Deliberation Empirica project.

## Purpose

The devLog serves as institutional knowledge for the project, helping:
- **Future development**: Reference past decisions when implementing new features
- **Agent workflows**: Provide context for AI agents to make informed decisions
- **Onboarding**: Help new contributors understand architectural choices
- **Avoiding rework**: Document what was tried and why certain approaches were chosen or rejected

## Structure

### `/decisions`
Architectural and design decisions that affect the project structure or behavior.

**When to create a decision entry:**
- Choosing between multiple architectural approaches
- Adding a new external integration or dependency
- Changing core data models or APIs
- Making trade-offs that future developers should understand

**Naming convention:** `NNN-short-description.md` (e.g., `001-daily-video-integration.md`)

### `/investigations`
Documentation of bug investigations, performance analysis, or exploratory work.

**When to create an investigation entry:**
- Debugging a complex or recurring issue
- Performance profiling and optimization work
- Exploring a new technology or approach
- Root cause analysis of production issues

**Naming convention:** `YYYY-MM-DD-short-description.md` (e.g., `2026-01-26-device-alignment-spam.md`)

### `/patterns`
Reusable implementation patterns and coding conventions used in the project.

**When to create a pattern entry:**
- Documenting a standard way to handle common scenarios
- Establishing coding conventions for specific features
- Sharing implementation approaches that should be consistent across the codebase

**Naming convention:** `category-name.md` (e.g., `error-handling.md`, `testing-strategies.md`)

## Usage Guidelines

### For Developers

1. **Before implementing a significant feature:**
   - Check `/decisions` for related architectural decisions
   - Check `/patterns` for established implementation patterns
   - If no decision exists, create one and link it in your PR

2. **When debugging a complex issue:**
   - Document your investigation in `/investigations`
   - Include what you tried, what worked, and what didn't
   - Link to the relevant issue and PR

3. **When establishing a new pattern:**
   - Document it in `/patterns`
   - Update this when the pattern evolves

### For AI Agents

When working on tasks:
1. **Search devLog first**: Before implementing, check for related decisions or patterns
2. **Create entries for significant work**: For architectural changes, create a decision entry before submitting the PR
3. **Link in PRs**: Reference relevant devLog entries in pull request descriptions
4. **Update existing entries**: If a decision is superseded or a pattern evolves, update the relevant entry

### Linking Convention

When referencing devLog entries in issues, PRs, or commits:
- Use relative paths: `devLog/decisions/001-video-integration.md`
- Or use anchored links in GitHub: `[Video Integration Decision](devLog/decisions/001-video-integration.md)`

## Index

### Decisions
<!-- Maintain this list as decisions are added -->
- None yet

### Recent Investigations
<!-- Maintain this list as investigations are added -->
- None yet

### Patterns
<!-- Maintain this list as patterns are documented -->
- None yet

## Template Files

- [Decision Template](decisions/template.md)
- [Investigation Template](investigations/template.md)
- [Pattern Template](patterns/template.md)
