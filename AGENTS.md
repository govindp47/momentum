# Momentum — Repository Agent Instructions

## Purpose and instruction precedence

This file defines repository-wide rules for Momentum. Read it before making any
change, then read the nearest scoped `AGENTS.md` for every area the task touches:

- `src/momentum/AGENTS.md` for backend production code and backend tests
- `frontend/AGENTS.md` for the web application

Scoped files supplement this file and take precedence for their directory when a
rule is more specific. An explicit user request takes precedence over repository
instructions. If a task crosses backend and frontend boundaries, apply both scoped
files and keep the change coordinated across the API contract.

Do not edit an area merely because you inspected it. Stay within the requested
scope, and ask before making an architectural, product, or breaking-contract
decision that the task does not clearly authorize.

## Product and architecture

Momentum is a local-first personal tracking application with distinct bounded
contexts:

- **Ledger** tracks recurring daily commitments, entries, history, and statistics.
- **Stride** tracks long-term journeys, milestones, progress, statistics, and
  achievements.
- **Dashboard** is a cross-domain read/aggregation layer; it does not own Ledger or
  Stride business rules.

The system is a modular monolith: one Python application exposes FastAPI and CLI
adapters, one SQLite database stores local data, and one React application consumes
the HTTP API.

```text
React / CLI
    -> delivery adapter
    -> application service
    -> domain rules + repository
    -> SQLite
```

Preserve this shape unless the user explicitly requests an architectural change.
Do not introduce microservices, CQRS, event buses, an ORM, generic repository or
service base classes, a second frontend state/data layer, or a dependency-injection
framework for ordinary feature work.

Core ownership rules:

- Ledger and Stride remain independent; neither domain imports or reaches into the
  other.
- Cross-domain coordination belongs in `dashboard/` or in a clearly owned
  application-level capability, not inside a bounded context.
- Domain logic remains independent of FastAPI, Pydantic transport schemas, Typer,
  Rich, React, SQLite, and presentation concerns.
- API and CLI code are delivery adapters. They call application services rather
  than implementing business rules or issuing SQL.
- Repositories own persistence queries; services own use-case orchestration and
  transaction boundaries.
- `shared/` is for small concerns with multiple proven consumers, not for concepts
  whose owner has not been chosen.
- New cohesive capabilities may receive a top-level package when they do not
  belong to an existing context. Keep their domain, application, persistence, and
  delivery responsibilities explicit.

## Repository map

```text
.
├── src/momentum/
│   ├── api/                 # FastAPI factory, lifecycle-facing dependencies, root router
│   ├── app/                 # Composition root and resource lifecycle
│   ├── cli/                 # Root CLI composition
│   ├── dashboard/           # Cross-domain aggregation
│   ├── ledger/              # Ledger domain, services, repositories, API, and CLI
│   ├── shared/              # Genuinely shared backend concerns
│   ├── storage/             # SQLite connection and append-only migrations
│   └── stride/              # Stride domain, services, repositories, API, CLI, presentation
├── tests/                   # Backend tests mirroring domain/layer ownership
├── frontend/
│   └── src/
│       ├── api/             # Endpoint-specific clients over the shared HTTP client
│       ├── components/      # Shared UI and feature components
│       ├── hooks/           # React and TanStack Query hooks
│       ├── lib/             # Browser/SSR infrastructure and utilities
│       ├── routes/          # TanStack Router file routes
│       └── types/           # Backend transport contracts
├── docs/                    # Local documentation and development/sample-data helpers
├── pyproject.toml           # Python package, tools, and quality configuration
├── uv.lock                  # Reproducible Python dependency lock
└── frontend/package.json    # Frontend scripts and dependencies (locked by bun.lock)
```

Treat this map as ownership guidance, not as a requirement that every future
feature use an identical directory tree. Inspect the live tree and neighboring
code before adding files.

## Scope and change discipline

Before editing:

1. Restate the requested behavior and identify the owning context and layer.
2. Read the applicable scoped `AGENTS.md` in full.
3. Trace the existing path end to end: caller, adapter, service, domain,
   persistence, and tests as relevant.
4. Search all callers before changing a shared function, type, schema, route,
   query key, configuration value, or database field.
5. Inspect the working tree and preserve user changes, including untracked files.
6. Choose the smallest coherent change that satisfies the request.

While editing:

- Follow existing patterns when they fit; do not create speculative abstractions.
- Do not perform unrelated cleanup, renaming, formatting, dependency upgrades, or
  visual redesign.
- Preserve CLI commands, URLs, API shapes, stored-data semantics, and user-facing
  behavior unless the task explicitly changes them.
- Do not hand-edit generated files or build output.
- Add dependencies only when the current stack and standard library cannot solve
  the problem cleanly. Update the appropriate manifest and lockfile together.
- Keep configuration in the established configuration path; do not scatter
  environment reads or hard-coded hosts, paths, or secrets through the code.

## Cross-boundary and API contract changes

An API contract includes more than field names. Preserve status codes, HTTP
methods, route paths, enum literals, nullability, date/time meaning, ordering,
numeric units, ratio-versus-percentage semantics, and error behavior.

For an intentional contract change:

1. Inspect the backend schema, serializer, route, service, and tests.
2. Find the corresponding frontend transport type, API module, query hook, and all
   consumers.
3. Update both sides in one coherent change only when the task authorizes both
   areas. Otherwise preserve compatibility and report the required follow-up.
4. Add boundary tests that demonstrate the new contract and its relevant failure
   behavior.
5. Check cache invalidation and aggregate/dashboard consumers, not only the page or
   endpoint directly changed.

Do not expose persistence models directly as transport models or make frontend
types reinterpret backend values silently.

## Data, migrations, privacy, and security

Momentum stores personal data locally. Treat all user data as sensitive.

- Never read or write the user's normal Momentum database during development or
  tests. Use isolated temporary databases and the existing fixtures/configuration.
- Never commit `.env` files, credentials, tokens, cookies, authorization headers,
  personal databases, SQLite WAL/SHM files, logs, or data dumps.
- Do not log request bodies, storage contents, environment contents, arbitrary
  application state, or unsanitized sensitive URLs.
- Validate untrusted input at its boundary and enforce domain invariants in the
  owning domain/service layer. Use parameterized SQL for all values.
- Do not expose tracebacks, raw SQL errors, filesystem paths, or internal exception
  details through public interfaces.
- Schema history is append-only. Never rewrite an existing migration; add the next
  migration and preserve existing user data.
- Keep destructive actions explicit and narrowly targeted. Do not delete or reset
  user files, databases, or unrelated working-tree changes.

Local-only artifacts include `.venv/`, `node_modules/`, Python/tool caches, coverage
output, frontend build output, `.momentum/`, and local database files. Do not
intentionally commit them. Do not hand-edit generated source such as
`frontend/src/routeTree.gen.ts`; use its owning tool and follow the scoped policy on
whether generated output is tracked.

## Testing and validation strategy

Validation should be proportional to risk. Start with the narrowest relevant test
or check, then broaden when shared infrastructure, contracts, persistence,
configuration, routing, or composition changed.

Backend commands run from the repository root:

```bash
uv run pytest tests/path/to/test_file.py
uv run pytest
uv run ruff check src tests
uv run ruff format --check src tests
uv run mypy src
```

Frontend commands run from `frontend/`:

```bash
bunx tsc --noEmit
bun run lint
bun run build
```

Use `uv` for Python environment/package operations and Bun for frontend operations.
Do not create npm, pnpm, or yarn lockfiles. Do not weaken lint, type, test, or
coverage configuration to make a change pass.

Testing expectations:

- A bug fix includes the smallest regression test that fails for the original bug.
- A behavior change covers the success path and relevant validation/error paths.
- Persistence changes cover mapping, constraints, ordering, migration/upgrade, and
  rollback behavior as applicable.
- API changes cover validation, status/error behavior, and exact response shape.
- UI changes exercise loading, empty, error, success, pending, and retry states as
  applicable, plus responsive and accessible interaction.
- Use deterministic dates/times and isolated state. Do not rely on the developer's
  machine, wall clock, network, or personal configuration when avoidable.

Documentation-only instruction changes require careful inspection and diff review;
they do not require unrelated application test suites.

## Completion checklist

A change is complete only when:

1. The requested behavior is implemented at the correct architectural layer.
2. Relevant callers, contracts, composition wiring, persistence, and consumers are
   consistent.
3. Tests or verification are proportionate to the change and relevant checks pass.
4. The diff contains no unrelated edits, debug code, secrets, local data, or
   accidental generated/build artifacts.
5. Public behavior and backward compatibility are preserved except where an
   intentional change was requested.
6. The final report names the files changed, validation performed, and any genuine
   limitation or follow-up.
