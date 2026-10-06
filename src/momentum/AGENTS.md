# Momentum Backend — Agent Instructions

## Scope and precedence

These instructions apply to all Python backend code under `src/momentum/`. They
supplement the repository-root `AGENTS.md`; follow the more specific instruction
when rules differ. Backend tests live under `tests/` and should be updated when a
backend behavior or contract changes.

Do not inspect or modify `frontend/` unless the user explicitly expands the task.
If a backend API change has frontend implications, preserve the existing contract
when possible and report the required frontend follow-up rather than editing it.

## Product and architecture

Momentum is a local-first modular monolith with one Python application and one
SQLite database. It exposes the same application capabilities through FastAPI and
Typer/Rich CLI delivery adapters.

```text
HTTP / CLI input
      -> delivery adapter
      -> application service
      -> domain rules + repositories
      -> SQLite
```

Keep this architecture. Do not add microservices, event buses, CQRS, ORM layers,
generic repository/service base classes, or a dependency-injection framework
unless a task explicitly requires an architectural change.

## Package ownership

```text
src/momentum/
├── api/             # FastAPI factory, lifespan, root router, dependencies, health
├── app/             # composition root and resource lifecycle
├── cli/             # root CLI composition
├── dashboard/       # cross-domain read aggregation and its delivery adapters
├── ledger/          # recurring daily commitments bounded context
│   ├── api/         # HTTP schemas, serializers, routes, error translation
│   ├── cli/         # Ledger CLI delivery
│   ├── domain/      # models, rules, and domain errors
│   ├── repositories/ # Ledger persistence
│   └── services/    # Ledger use cases and orchestration
├── shared/          # only small, genuinely cross-cutting backend concerns
├── storage/         # SQLite lifecycle and append-only migrations
└── stride/          # long-term journeys bounded context
    ├── api/
    ├── cli/
    ├── domain/
    ├── presentation/ # Rich-only formatting and rendering
    ├── repositories/
    └── services/
```

New cohesive capabilities may use a top-level package beside these contexts when
they do not belong to Ledger, Stride, Dashboard, or `shared`. Keep their domain,
service, persistence, and delivery responsibilities visibly separated even when
the package is small.

### Dependency direction

- Domain code is framework- and storage-independent. It may use the standard
  library but must not import FastAPI, Pydantic API schemas, Typer/Rich, SQLite,
  repositories, or application composition.
- Services implement use cases and business orchestration. They consume domain
  types/rules and repositories through explicit constructor dependencies.
- Repositories own SQL and translate database rows into domain values. They do not
  contain HTTP/CLI behavior or business workflow orchestration.
- API and CLI modules are delivery adapters. They validate/parse transport input,
  call services, translate expected errors, and serialize/render results.
- `app/` and root API/CLI modules compose concrete dependencies. Do not construct
  repositories or open databases inside route handlers or commands.
- Cross-domain reads and coordination belong in `dashboard/` or another explicit
  orchestration package. Ledger and Stride must not depend on one another.
- Add code to `shared/` only after confirming it has multiple real consumers. Do
  not move domain-specific concepts there to avoid choosing an owner.

## Existing composition and lifecycle conventions

- `config.py` is the source of runtime configuration. Keep configuration explicit,
  typed, and injectable; do not scatter environment-variable reads through the
  application.
- `AppContext` is the composition root. It creates repositories and services from
  the application database and exposes services to delivery adapters.
- FastAPI uses `create_app()` plus a lifespan handler. Resolve configuration and
  acquire/close resources in the lifespan, not at import time.
- API dependencies retrieve services from the lifespan-owned `AppContext`.
- CLI commands create an `AppContext` for the command lifetime and reuse the same
  services as the API.
- Preserve ownership semantics when a `Database` is injected into `AppContext`:
  the creator remains responsible for closing an injected database.
- Do not hide dependencies in module globals or service locators.

When adding a service exposed through HTTP or CLI, trace the full composition path:

1. repository/domain dependency,
2. service constructor,
3. `AppContext` construction,
4. FastAPI dependency or CLI context access,
5. router/command registration,
6. tests using an isolated database or explicit test doubles.

## Domain and service rules

- Prefer typed dataclasses/enums and pure rule functions for business concepts.
- Keep invariants in domain rules or services so API and CLI behavior cannot drift.
- Services own multi-step workflows and transaction boundaries.
- Use the existing domain error hierarchy for expected failures. Add a specific,
  context-owned error when callers need to distinguish a new failure mode.
- Do not make services return HTTP responses, Pydantic boundary models, Rich
  objects, or untyped dictionaries solely for presentation convenience.
- Preserve semantic distinctions already modeled by the domain. For example,
  absence of a daily entry is not the same as an explicit negative entry, and a
  ratio in `0..1` is not a percentage in `0..100`.
- Keep date/time meaning deliberate. Do not casually switch between local naive
  datetimes, UTC-aware datetimes, dates, or storage strings. Follow the owning
  context's established representation and add boundary tests when changing it.
- Inject or parameterize the reference date/time where deterministic testing or
  historical calculations require it.

## Persistence and transactions

Momentum intentionally uses synchronous `sqlite3`; do not introduce an ORM or a
second persistence mechanism for ordinary features.

- SQL belongs in repositories or `storage/`, never in API routes, CLI commands,
  domain modules, or presentation code.
- Always use parameterized SQL for values. Never interpolate user input into SQL.
- Convert rows to typed domain models at the repository boundary.
- Preserve `sqlite3.Row` and the connection pragmas configured by `Database`.
- The connection uses autocommit mode. Repositories must not call `commit()` or
  `rollback()` and must not silently start transactions.
- Services use the injected `Database.transaction` manager for workflows that
  must succeed or fail as a unit. Keep all coupled writes inside one transaction.
- Avoid nested transactions: the current transaction manager intentionally rejects
  them. Compose atomic operations under one service-owned boundary instead.
- Let database constraints protect durable invariants, while validating business
  rules before writes so users receive meaningful domain errors.
- Preserve foreign-key behavior, ordering guarantees, and case-sensitivity
  semantics when changing queries or schema.

### Schema migrations

`storage/migrations.py` is the single migration history for the whole application.

- Never edit, reorder, renumber, or delete an existing migration that may have
  been applied. Append a new migration with the next unique positive version.
- A migration must be deterministic, atomic, and safe to execute exactly once.
- Preserve existing user data. For SQLite table rebuilds, explicitly copy data,
  restore constraints/indexes, and verify foreign keys.
- Add only constraints and indexes justified by integrity or actual query shapes.
- Keep domain-specific tables owned by their context; do not attach unrelated
  fields to Ledger or Stride tables for convenience.
- Test both a fresh database and upgrading a database at the previous schema
  version. Verify that a failed migration is not recorded as applied.
- Do not commit local database files, WAL/SHM files, or generated dumps.

## FastAPI conventions

- The public API is rooted at `/api/v1`; bounded-context routers own their suffixes.
- Keep the application factory import-safe and testable with an injected
  `config_factory`.
- Define request/response Pydantic models at API boundaries. Domain dataclasses are
  not API schemas, even when their fields currently align.
- Use explicit serializer functions to map domain results to response models.
- Declare `response_model`, success status, query/body constraints, and documented
  error responses consistently with neighboring endpoints.
- Route handlers should stay thin: transport validation, one or a few service
  calls, known-error translation, and response serialization.
- Map expected domain errors to stable HTTP statuses and `{"detail": "..."}`
  responses. Do not catch unexpected exceptions merely to turn them into 400s.
- Retrieve services through `api/dependencies.py`; do not reach into the database
  or instantiate application dependencies in a route.
- Preserve response field names, nullability, enum values, numeric units, and HTTP
  semantics unless the task explicitly authorizes a breaking contract change.
- Health means process liveness; readiness may verify initialized dependencies.
  Keep these meanings distinct.

## CLI and presentation conventions

- CLI commands are adapters over the same services used by FastAPI. Do not create
  CLI-only business rules or direct SQL paths.
- Keep parsing and interactive prompts in `cli/`; keep Rich tables, panels, and
  formatting in presentation modules where that separation already exists.
- Translate known domain errors into concise user-facing failures and preserve the
  established non-zero exit behavior.
- Keep commands scriptable: avoid changing command names, option meanings, output
  semantics, or prompts without explicit reason and matching tests.
- Export assembly belongs in an application service; filesystem destination and
  transport response handling belong in the delivery layer.

## Security, privacy, and robustness

- Momentum data is personal. Collect and retain only data required by the feature.
- Never log or persist secrets, credentials, authorization headers, cookies,
  request bodies, environment contents, or arbitrary application state.
- Bound free-form payloads and collection sizes at the API boundary and validate
  again where a domain invariant is involved.
- Do not expose raw SQL errors, tracebacks, filesystem paths, or internal exception
  details through public responses.
- Use `pathlib.Path` and validate user-controlled paths before file operations.
- Keep externally triggered best-effort diagnostics isolated from core workflows;
  a diagnostic failure must not corrupt or roll back unrelated domain work.

## Coding standards

- Python is 3.12+, managed with `uv`.
- The configured quality gates are Ruff and strict mypy. Add complete type hints to
  changed production code; avoid `Any`, blanket ignores, and unchecked casts.
- Follow the repository's 100-character Ruff line length and import ordering.
- Prefer small explicit functions and concrete dependencies over clever or
  speculative abstractions.
- Match neighboring naming, docstring, enum, and dataclass patterns.
- Use absolute `momentum...` imports and preserve package boundaries.
- Do not add a dependency when the standard library or current stack is adequate.
- Do not perform unrelated cleanup while implementing a focused change.

## Testing strategy

Tests mirror backend boundaries under `tests/`:

- domain tests cover pure rules, calculations, invariants, and state transitions;
- service tests cover use cases, orchestration, error behavior, and atomicity;
- repository/storage tests cover SQL mapping, constraints, ordering, migrations,
  and rollback behavior against temporary SQLite databases;
- API tests cover status codes, validation, response shape, serialization, and
  application lifespan/dependency wiring;
- CLI tests cover parsing, commands, visible output, errors, and exit codes;
- integration tests cover connections and behavior spanning layers.

Use `tmp_path`, the existing fixtures, explicit `AppConfig`, and isolated databases.
Never let tests read or write the user's normal Momentum data directory. Avoid
mocking SQLite for repository behavior; use the real temporary database. Prefer
fixed dates/times over assertions tied to the wall clock.

For every bug fix, add the smallest regression test that fails for the original
bug. For behavior changes, test the success path, relevant validation/error path,
and persistence or rollback semantics when writes are involved.

## Change workflow

Before editing:

1. Read the owning domain, service, repository, and delivery paths.
2. Search all callers before changing a shared signature or type.
3. Identify contract, migration, transaction, CLI, and test implications.
4. Choose the smallest coherent layer-aware change.

Typical change paths:

| Change | Usually inspect/update |
| --- | --- |
| Business rule | domain rules/models/errors, services, domain/service tests |
| Persisted field | migration, domain model, repository mapping/SQL, service, adapters, tests |
| API endpoint | schema, serializer, router, dependency wiring, API tests |
| New service | repository/domain dependencies, `AppContext`, adapter dependency, tests |
| Cross-domain view | `dashboard` service/schema/adapter, each source service, tests |
| CLI behavior | CLI adapter/presentation, shared service, CLI tests |

After editing:

1. Review the diff for scope creep, accidental contract changes, and generated data.
2. Run targeted tests first, then the broadest relevant checks.
3. Verify migration and transaction behavior when persistence changed.
4. Report files changed, validation run, and any remaining limitation.

## Validation commands

Run commands from the repository root:

```bash
# Focused test while iterating
uv run pytest tests/path/to/test_file.py

# Full backend test suite
uv run pytest

# Lint/format verification
uv run ruff check src tests
uv run ruff format --check src tests

# Strict type checking
uv run mypy src
```

Use `uv run` rather than invoking environment-specific binaries directly. Do not
silence a failing check by weakening configuration or broadly excluding code.

## Definition of done

A backend change is complete when it preserves the architecture and domain
boundaries, keeps API/CLI contracts stable unless intentionally changed, handles
transactions and migrations safely, includes proportionate regression coverage,
passes the relevant configured checks, and leaves no debug output, generated
artifacts, local databases, or unrelated edits.
