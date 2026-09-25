# Momentum 🚀

**Momentum** is a local-first personal tracking application that brings two complementary ideas together:

- **LifeLedger** — track the daily commitments that keep life balanced.
- **Stride** — track longer-term journeys, goals, milestones, and progress.

Together, Momentum helps answer two different questions:

> **Am I consistently giving attention to the things that matter today?**

and

> **Am I making meaningful progress toward the things I want to accomplish?**

The goal is not to turn life into a score. Momentum makes your patterns, consistency, effort, and progress visible so you can reflect and keep moving.

---

## ✨ What You Can Track

Momentum combines daily commitments and longer-term journeys in one application.

### 📖 LifeLedger — Daily Commitments

Define a small set of recurring commitments and a minimum daily cutoff for each one.

```text
Exercise
Minimum: At least 30 minutes of physical activity
Done? [y/n]: y
```

Track:

- 📝 Daily commitments
- 🎯 Minimum cutoffs
- ✅ Daily completion
- 📅 Historical records
- 📊 Completion rates
- 📈 Consistency and trends
- ⚖️ Distribution of attention across commitments
- 🗂️ Archived commitments without losing history

An unrecorded day is different from a failed day:

```text
YES            → cutoff was met
NO             → cutoff was not met
NOT RECORDED   → no entry exists
```

---

### 🏃 Stride — Long-Term Journeys

Create journeys for goals that take days, weeks, months, or longer.

Examples:

```text
Master Distributed Systems
├── Networking        ✓
├── Replication       ✓
├── Consistency       ✓
├── Consensus         ○
└── Final Project     ○
```

```text
Run 1000 km
430 / 1000 km · 43%
```

```text
Gym — 200 Days
126 / 200 days · 63%
```

Stride supports four tracking methods:

- **Milestone** — progress through customizable checkpoints
- **Count** — each completion adds one unit
- **Quantity** — record arbitrary numeric progress
- **Duration** — record time spent

Progress is based on recorded events, keeping the historical record consistent when corrections are needed.

---

## 🧩 The Combined Model

Momentum keeps the two concepts distinct while presenting them through one application.

```text
                         Momentum
                            │
              ┌─────────────┴─────────────┐
              │                           │
         LifeLedger                    Stride
      Daily Commitments            Long-Term Journeys
              │                           │
       Daily Tracking              Milestones / Goals
              │                           │
       Consistency                  Progress Events
              │                           │
       Trends / Stats              Progress / Stats
              │                           │
              └─────────────┬─────────────┘
                            │
                       Dashboard
```

LifeLedger focuses on **consistency in the present**.

Stride focuses on **progress toward the future**.

They share the same application and infrastructure, but their domain models remain independent.

---

## 📊 Dashboard

Momentum provides a combined view of your personal tracking data.

A dashboard can bring together information such as:

```text
TODAY

Daily Commitments
────────────────────────────
Exercise              ✓
Learning              ✓
Reading               ○
Personal Project      ✓

Completion             75%


ACTIVE JOURNEYS
────────────────────────────
Build StockLens        68%
Learn Distributed      43%
Read 20 Books          35%


RECENT PROGRESS
────────────────────────────
3 commitments completed today
2 milestones completed this week
4 active journeys
12-day consistency streak
```

The dashboard is an aggregation layer. It does not replace either LifeLedger or Stride.

---

## ⚖️ Philosophy

Momentum deliberately avoids reducing personal progress to a single arbitrary score.

Instead, it exposes transparent measurements:

```text
Exercise          83%
Learning          73%
Social            67%
Reading           27%

Highest            83%
Lowest             27%
Spread             56 pp
```

For journeys:

```text
Run 1000 km       43%
Distributed Sys.  68%
Read 20 Books     35%
```

These measurements are intended to make patterns visible, not prescribe how you should live.

> **Consistency matters, but progress needs direction.**

Momentum combines both perspectives without forcing them into one metric.

---

## 🏗️ Architecture

Momentum is a modular monolith.

It uses one application, one FastAPI backend, one local database, and one frontend while keeping LifeLedger and Stride as separate bounded contexts.

```text
Frontend
    │
    │ HTTP / JSON
    ▼
FastAPI
    │
    ├── Dashboard
    │
    ├── LifeLedger
    │   ├── Domain
    │   ├── Services
    │   └── Repositories
    │
    └── Stride
        ├── Domain
        ├── Services
        └── Repositories
                │
                ▼
          Shared SQLite DB
```

The same application services can be used by both the web API and the CLI.

```text
                 Services
                    │
          ┌─────────┴─────────┐
          │                   │
       FastAPI               CLI
          │                   │
       Frontend            Terminal
```

This keeps business logic independent from the presentation layer.

---

## 🖥️ Interfaces

Momentum supports both a web application and command-line workflows.

### Web

The web frontend provides the primary visual experience:

- Combined dashboard
- Daily commitment tracking
- Journey management
- Milestone management
- Progress logging
- History
- Statistics
- Trends
- Achievements

### CLI

The CLI remains available for fast, scriptable interaction.

Typical operations include:

```bash
momentum --help

momentum ledger task add
momentum ledger today
momentum ledger history
momentum ledger stats

momentum stride journey create
momentum stride journey list
momentum stride milestone add
momentum stride progress log
momentum stride stats
momentum stride achievements
```

The exact command options are available through:

```bash
momentum --help
```

---

## 🛠️ Tech Stack

### Backend

- Python
- [uv](https://docs.astral.sh/uv/)
- FastAPI
- SQLite
- Pydantic
- pytest
- Ruff
- mypy

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS

Momentum is designed as a local-first application with no required cloud backend, account system, or external service dependency.

---

## 🚀 Development

Create the environment and install dependencies:

```bash
uv sync
```

Run the backend:

```bash
uv run momentum
```

Run tests:

```bash
uv run pytest
```

Run linting:

```bash
uv run ruff check .
```

Format the project:

```bash
uv run ruff format .
```

Run type checking:

```bash
uv run mypy src
```

Run the frontend from the frontend directory:

```bash
npm install
npm run dev
```

---

## 💾 Data

Momentum stores personal tracking data locally in SQLite.

The application uses a single local database containing separate data for the LifeLedger and Stride domains.

```text
.personal-tracker/
└── tracker.db
```

Your personal data remains on your machine.

There is:

- No required account
- No cloud synchronization
- No telemetry
- No external database dependency
- No requirement for an internet connection during normal use

---

## 🔒 Local-First

Momentum is designed around ownership of personal data.

The application should remain useful without:

- Signing in
- Creating an account
- Connecting a cloud service
- Sending personal tracking information to a remote server

The local database is the source of truth.

---

## 🗂️ Project Structure

```text
momentum/
│
├── backend/
│   └── src/
│       └── momentum/
│           │
│           ├── app/
│           ├── api/
│           │
│           ├── ledger/
│           │   ├── domain/
│           │   ├── services/
│           │   ├── storage/
│           │   ├── api/
│           │   └── cli/
│           │
│           ├── stride/
│           │   ├── domain/
│           │   ├── services/
│           │   ├── storage/
│           │   ├── api/
│           │   └── cli/
│           │
│           ├── dashboard/
│           │
│           ├── shared/
│           │
│           └── storage/
│
├── frontend/
│
├── tests/
│   ├── ledger/
│   ├── stride/
│   ├── dashboard/
│   └── integration/
│
├── docs/
├── pyproject.toml
├── uv.lock
└── README.md
```

The architecture intentionally keeps the two core domains independent:

```text
LifeLedger                  Stride
    │                          │
    ├── Domain                 ├── Domain
    ├── Services               ├── Services
    ├── Storage                ├── Storage
    └── API                    └── API
            │                  │
            └──────┬───────────┘
                   │
              Shared App
                   │
             Shared Database
```

---

## 🎯 Philosophy

Momentum is built around a simple distinction:

> **Daily consistency creates momentum. Long-term progress gives it direction.**

LifeLedger helps you notice whether you are consistently giving attention to the things that matter.

Stride helps you see whether your effort is moving you toward larger goals.

Momentum brings those two perspectives together without turning either into a competition or a single score.

The purpose is simple:

**Track what you do. See where you are going. Keep moving.** 🚀

---

## License

See [LICENSE](LICENSE).
