import hashlib
import json
from pathlib import Path

_CACHE_FILE = ".qa_cache/spec_hashes.json"


def get_spec_hash(spec_path: Path) -> str:
    return hashlib.sha256(spec_path.read_bytes()).hexdigest()


def load_cached_hash(spec_path: Path, repo_root: Path) -> str | None:
    cache_file = repo_root / _CACHE_FILE
    if not cache_file.exists():
        return None
    data = json.loads(cache_file.read_text())
    return data.get(str(spec_path))


def save_cached_hash(spec_path: Path, repo_root: Path) -> None:
    cache_file = repo_root / _CACHE_FILE
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    data: dict = {}
    if cache_file.exists():
        data = json.loads(cache_file.read_text())
    data[str(spec_path)] = get_spec_hash(spec_path)
    cache_file.write_text(json.dumps(data, indent=2))
