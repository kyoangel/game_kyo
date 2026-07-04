import os
import time

from openai import OpenAI

LM_STUDIO_BASE_URL = os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
LM_STUDIO_MODEL = os.getenv("LM_STUDIO_MODEL", "google/gemma-4-e4b")
LM_STUDIO_MODEL_CODER = os.getenv("LM_STUDIO_MODEL_CODER", LM_STUDIO_MODEL)
_CACHE_TTL_S = 60.0

_availability_cache: bool | None = None
_cache_ts: float = 0.0


class LmStudioError(Exception):
    pass


def _client() -> OpenAI:
    return OpenAI(base_url=LM_STUDIO_BASE_URL, api_key="lm-studio")


def call_lm_studio(
    system_prompt: str, task: str, model: str | None = None, temperature: float = 0.3
) -> str:
    try:
        response = _client().chat.completions.create(
            model=model or LM_STUDIO_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": task},
            ],
            temperature=temperature,
        )
        return response.choices[0].message.content or ""
    except Exception as exc:
        raise LmStudioError(str(exc)) from exc


def is_available() -> bool:
    global _availability_cache, _cache_ts
    now = time.monotonic()
    if _availability_cache is None or now - _cache_ts > _CACHE_TTL_S:
        try:
            _client().models.list()
            _availability_cache = True
        except Exception:
            _availability_cache = False
        _cache_ts = now
    return _availability_cache
