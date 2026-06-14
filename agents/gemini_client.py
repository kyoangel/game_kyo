import os
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel

load_dotenv()

GEMINI_MODEL = "gemini-2.5-flash"


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

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=task,
        config=types.GenerateContentConfig(**config_kwargs),
    )

    if response_schema is not None:
        return response.parsed

    return response.text
