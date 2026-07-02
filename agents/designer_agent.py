import re
from pathlib import Path

from agents import claude_cli, lm_studio_client
from agents.lm_studio_client import LmStudioError
from harness import prompt_store

_TYPES_MAX_LINES = 150
_CONTEXT_FILES = [
    "workspace-pixel-squad/src/types.ts",
    "workspace-pixel-squad/src/data/skills.ts",
]


class DesignerError(Exception):
    pass


def _build_lm_context(backlog_path: Path, repo_root: Path) -> str:
    parts = [backlog_path.read_text()]

    for rel in _CONTEXT_FILES:
        p = repo_root / rel
        if p.exists():
            lines = p.read_text().splitlines()[:_TYPES_MAX_LINES]
            parts.append(f"\n## {rel} (first {_TYPES_MAX_LINES} lines)\n```typescript\n" + "\n".join(lines) + "\n```")

    existing = sorted((repo_root / "specs").glob("pixel-squad-*.md"))
    if existing:
        names = "\n".join(f"- {p.name}" for p in existing)
        parts.append(f"\n## Already-written specs\n{names}")

    return "\n".join(parts)


def _run_lm_designer(workspace: str, backlog_path: Path, repo_root: Path) -> Path | None:
    system_prompt = prompt_store.load("designer-lm", repo_root, workspace=workspace)
    task = _build_lm_context(backlog_path, repo_root)

    output = lm_studio_client.call_lm_studio(system_prompt, task)

    if "SPEC_PATH: DONE" in output:
        return None

    slug_match = re.search(r"<spec_slug>(.*?)</spec_slug>", output, re.DOTALL)
    content_match = re.search(r"<spec_content>(.*?)</spec_content>", output, re.DOTALL)

    if not slug_match or not content_match:
        raise DesignerError(f"LM Studio designer output missing tags: {output[-300:]!r}")

    slug = slug_match.group(1).strip().strip("-")
    spec_content = content_match.group(1).strip()
    spec_path = repo_root / "specs" / f"{workspace}-{slug}.md"
    spec_path.write_text(spec_content)

    # Mark first unchecked item in backlog
    backlog_text = backlog_path.read_text()
    updated = re.sub(r"- \[ \] (.+?)(?=\n|$)", lambda m: f"- [x] {m.group(1)}", backlog_text, count=1)
    backlog_path.write_text(updated)

    return spec_path


def run_designer(workspace: str, backlog_path: Path, repo_root: Path) -> Path | None:
    if lm_studio_client.is_available():
        print("🤖 Using LM Studio for Designer")
        try:
            return _run_lm_designer(workspace, backlog_path, repo_root)
        except LmStudioError as e:
            print(f"⚠️  LM Studio designer failed, falling back to Claude CLI: {e}")

    system_prompt = prompt_store.load("designer", repo_root, workspace=workspace)
    task = backlog_path.read_text()

    output = claude_cli.call_coder(
        system_prompt=system_prompt,
        task=task,
        repo_root=repo_root,
    )

    for line in reversed(output.splitlines()):
        line = line.strip()
        if line.startswith("SPEC_PATH:"):
            value = line[len("SPEC_PATH:"):].strip()
            if value == "DONE":
                return None
            return Path(value)

    raise DesignerError(f"Designer output missing SPEC_PATH signal: {output[-200:]!r}")
