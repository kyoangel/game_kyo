import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

GEMINI_MODEL = "gemini-2.5-flash"


def call_gemini(system_prompt: str, task: str) -> str:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=task,
        config=types.GenerateContentConfig(system_instruction=system_prompt),
    )

    return response.text
