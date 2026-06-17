from pathlib import Path

from harness import spec_cache


def test_get_spec_hash_returns_consistent_sha256(tmp_path: Path) -> None:
    f = tmp_path / "spec.md"
    f.write_text("Build something")
    h1 = spec_cache.get_spec_hash(f)
    h2 = spec_cache.get_spec_hash(f)
    assert h1 == h2
    assert len(h1) == 64  # SHA-256 hex digest


def test_load_cached_hash_returns_none_when_no_cache_file(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("spec")
    assert spec_cache.load_cached_hash(spec_path, tmp_path) is None


def test_save_and_load_cached_hash_round_trips(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("Build something")
    spec_cache.save_cached_hash(spec_path, tmp_path)
    loaded = spec_cache.load_cached_hash(spec_path, tmp_path)
    assert loaded == spec_cache.get_spec_hash(spec_path)


def test_save_cached_hash_overwrites_existing_entry(tmp_path: Path) -> None:
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("version 1")
    spec_cache.save_cached_hash(spec_path, tmp_path)
    first_hash = spec_cache.load_cached_hash(spec_path, tmp_path)

    spec_path.write_text("version 2")
    spec_cache.save_cached_hash(spec_path, tmp_path)
    second_hash = spec_cache.load_cached_hash(spec_path, tmp_path)

    assert first_hash != second_hash
    assert second_hash == spec_cache.get_spec_hash(spec_path)
