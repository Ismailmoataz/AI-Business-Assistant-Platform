# AI Agent Operating Manual

This file defines the mandatory operating rules for AI coding agents working in this repository. It applies to Codex, OpenAI agents, ChatGPT-based agents, Claude Code, Gemini CLI, Cursor, and future automated contributors. Detailed technical policy remains in the linked project documentation; this manual governs how agents use it.

## 1. Project Mission

AI Business Assistant Platform is a secure, multi-tenant business operations and knowledge-retrieval product. Contributions must extend the real system coherently, protect tenant data, preserve established architecture, and meet professional production-quality expectations.

Before proposing work, understand the engineering requirements in [PROJECT_STANDARDS.md](PROJECT_STANDARDS.md) and the implementation status in [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md). Roadmap labels are factual status markers, not permission to implement unrelated future work. Quality, correctness, and verified behavior are required outcomes—not optional refinements.

## 2. Required Reading Order

Before making changes, every agent must read these files in order:

1. [PROJECT_STANDARDS.md](PROJECT_STANDARDS.md)
2. [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md)
3. [ARCHITECTURE.md](ARCHITECTURE.md)
4. [UI_UX_GUIDELINES.md](UI_UX_GUIDELINES.md)
5. [SECURITY.md](SECURITY.md)
6. [API_GUIDELINES.md](API_GUIDELINES.md)
7. [TESTING.md](TESTING.md)
8. [DEPLOYMENT.md](DEPLOYMENT.md)
9. [DECISIONS.md](DECISIONS.md)
10. [README.md](README.md)

Read additional source, tests, migrations, configuration, and historical documents relevant to the task. Re-read affected guides when scope changes during implementation. Do not begin from a remembered or assumed version of the project.

## 3. Source of Truth

The repository is the sole source of truth. Current application code, migrations, tests, configuration, dependency manifests, and generated contracts override assumptions, prior conversations, generic conventions, and stale narrative material.

Agents must:

- Inspect the current implementation before planning or editing.
- Distinguish implemented, partially integrated, planned, and absent behavior.
- Never invent features, endpoints, screens, infrastructure, integrations, or guarantees.
- Never document functionality that does not exist.
- Resolve documentation/code discrepancies in favor of verified implementation, then update affected documentation when authorized by the task.
- Preserve unrelated user changes and inspect the worktree before editing.

If evidence is incomplete or contradictory, report the uncertainty. Do not convert an inference into a fact.

## 4. Development Rules

Follow [PROJECT_STANDARDS.md](PROJECT_STANDARDS.md) for detailed conventions and [DECISIONS.md](DECISIONS.md) for accepted architectural constraints. At minimum:

- Preserve the modular backend layers and existing frontend architecture.
- Keep HTTP routes thin; place authorization and business workflows in services and persistence queries in repositories.
- Maintain company, role, department, ownership, and visibility isolation on every read, write, reference, background task, file operation, and retrieval path.
- Apply authorization filters before pagination, download, or vector ranking.
- Reuse existing services, schemas, repositories, components, utilities, design tokens, and provider abstractions. Do not create parallel implementations or duplicate code.
- Keep database changes in explicit Alembic migrations; never introduce automatic schema creation at application startup.
- Keep public API schemas, frontend types, OpenAPI, and runtime behavior aligned.
- Follow [UI_UX_GUIDELINES.md](UI_UX_GUIDELINES.md) for accessibility, responsive behavior, interaction states, and design-system usage.
- Follow [SECURITY.md](SECURITY.md). Never hardcode, expose, log, or commit secrets, credentials, tokens, tenant documents, or provider payloads.
- Make the smallest coherent change that fully satisfies the requested scope. Do not implement roadmap work unless explicitly requested.
- Do not modify application code for a documentation-only task.

When existing code conflicts with these rules, do not silently redesign it. Explain the conflict, scope the safest correction, and preserve compatibility unless the task explicitly authorizes a breaking change.

## 5. Documentation Rules

Documentation is part of the implementation. Whenever architecture, behavior, configuration, API contracts, security posture, testing, deployment, decisions, or roadmap status changes, update the relevant root documentation and [CHANGELOG.md](CHANGELOG.md) before reporting completion.

Documentation must describe current behavior, clearly label limitations, and use consistent terminology across files. Link to the authoritative guide instead of copying large sections into new documents. Never leave documentation knowingly outdated, claim planned work as delivered, or hide an incomplete integration behind aspirational language.

For documentation-only work, verify references, links, commands, status labels, and agreement with the current codebase.

## 6. Verification Rules

Before claiming completion, perform the checks applicable to the change and follow the commands and environments in [TESTING.md](TESTING.md) and [DEPLOYMENT.md](DEPLOYMENT.md):

- Build or production-build checks
- Automated tests, including relevant negative tenant/security cases
- Compilation or import validation
- Type checking
- Linting
- Alembic migration validation when persistence changes
- OpenAPI generation and contract validation when API behavior changes
- Documentation link, terminology, status, and cross-file consistency checks

Choose verification proportional to risk, but do not skip a relevant check merely because the change appears small. Never claim that a check passed when it was not run. If verification cannot run because of missing dependencies, credentials, services, platform support, permissions, or another environment limitation, state the exact command or check affected and the exact reason. Distinguish environment blockers from test failures and implementation defects.

## 7. Reporting Rules

Every completion report must state:

- Files created
- Files modified
- Tests added or changed
- Verification performed and its results
- Remaining recommendations
- Known limitations or unverified areas

Also identify migrations, API changes, security implications, or deployment steps when relevant. Use precise language: “implemented” means the code exists; “verified” means the applicable check ran successfully. Never claim a feature is complete unless it is implemented, documented, and verified. If no files, tests, recommendations, or limitations exist in a category, say so explicitly rather than omitting the category.

## 8. Long-Term Quality

This project prioritizes:

- Maintainability through clear boundaries and low duplication
- Scalability through tenant-safe data access and deliberate runtime design
- Security through least privilege, secret hygiene, and defense in depth
- Accessibility through semantic, keyboard-operable, inclusive interfaces
- Performance through measured, bounded, and efficient behavior
- User experience through consistent, responsive, honest interaction states
- Production readiness through migration discipline, observability, recoverability, and documented operations

Quality always takes precedence over speed. Prefer a smaller, well-integrated, tested change over a broad, fragile one. Leave the repository more understandable and no less secure than you found it.
