from pathlib import Path


def load(name: str, repo_root: Path) -> str:
    return (repo_root / "prompts" / f"{name}.txt").read_text()
