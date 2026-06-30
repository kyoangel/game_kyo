import os
import time
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import errors, types
from pydantic import BaseModel

load_dotenv()

GEMINI_MODEL = "gemini-2.5-flash"
_RETRY_DELAYS = [10, 30, 60]  # seconds between retries on 503


class GeminiClientError(Exception):
    pass


def call_gemini(
    system_prompt: str,
    task: str,
    response_schema: type[BaseModel] | None = None,
) -> Any:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    config_kwargs: dict[str, Any] = {"system_instruction": system_prompt}
    if response_schema is not None:
        config_kwargs["response_mime_type"] = "application/json"
        config_kwargs["response_schema"] = response_schema

    last_exc: Exception | None = None
    for attempt, delay in enumerate([0] + _RETRY_DELAYS):
        if delay:
            print(f"⏳ Gemini 503 — retrying in {delay}s (attempt {attempt + 1}/{len(_RETRY_DELAYS) + 1})")
            time.sleep(delay)
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=task,
                config=types.GenerateContentConfig(**config_kwargs),
            )
            break
        except errors.ServerError as exc:
            last_exc = exc
            continue
        except errors.APIError as exc:
            raise GeminiClientError(str(exc)) from exc
    else:
        raise GeminiClientError(str(last_exc)) from last_exc

    if response_schema is not None:
        return response.parsed

    return response.text
