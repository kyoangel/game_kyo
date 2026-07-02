import os

from openai import OpenAI

LM_STUDIO_BASE_URL = os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
LM_STUDIO_MODEL = os.getenv("LM_STUDIO_MODEL", "google/gemma-4-e4b")


class LmStudioError(Exception):
    pass


def _client() -> OpenAI:
    return OpenAI(base_url=LM_STUDIO_BASE_URL, api_key="lm-studio")


def call_lm_studio(system_prompt: str, task: str, temperature: float = 0.3) -> str:
    try:
        response = _client().chat.completions.create(
            model=LM_STUDIO_MODEL,
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
    try:
        _client().models.list()
        return True
    except Exception:
        return False
