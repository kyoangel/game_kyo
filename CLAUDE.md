# CLAUDE.md — Game Factory Project Conventions

## Folder Structure

### Plans (`docs/plans/`)
All implementation plans — from any skill including `/plan`, `/spec-driven-development`, or superpowers — go to:
```
docs/plans/YYYY-MM-DD-{summary}.md
```
Do NOT create `docs/superpowers/plans/` or any other variant.

### Feature Specs (`docs/specs/`)
All feature specification files are organised by workspace:
```
docs/specs/{workspace}/{feature-slug}.md
docs/specs/{workspace}/backlog.md
```
Examples:
- `docs/specs/pixel-squad/skill-tree.md`
- `docs/specs/pixel-squad/backlog.md`
- `docs/specs/math-merge-10/game-design.md`

Do NOT use the root-level `specs/` directory (it has been migrated to `docs/specs/`).
Do NOT prefix filenames with the workspace name — the workspace is the directory.

### Other directories
- `workspace-{name}/` — game source code (TypeScript / Phaser 3)
- `prompts/` — agent system prompts (`.txt`)
- `agents/` — Python agent modules
- `harness/` — build/test runner utilities
- `traces/` — autonomous loop execution traces

## Autonomous Loop
The autonomous loop (`autonomous_loop.py`) reads/writes:
- Backlog: `docs/specs/{workspace}/backlog.md`
- Feature specs: `docs/specs/{workspace}/{slug}.md`
- Resume state: `docs/specs/{workspace}/.resume.json`

## Orchestration Rules (index only — do not inline content here)
Dispatch rules: `~/.claude-personal/rules/AGENTS.md` (always loaded).
On-demand playbooks: `~/.claude-personal/playbooks/` — model-dispatch,
judgment-rubrics, task-prompt-templates, maintenance (read per AGENTS.md index).
