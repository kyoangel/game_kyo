from unittest.mock import MagicMock, patch

import pytest
from google.genai import errors
from pydantic import BaseModel

from agents import gemini_client


def test_call_gemini_returns_text_response(monkeypatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    mock_response = MagicMock()
    mock_response.text = "OK"

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("agents.gemini_client.genai.Client", return_value=mock_client) as mock_client_cls:
        result = gemini_client.call_gemini(system_prompt="You are helpful.", task="Reply with OK")

    mock_client_cls.assert_called_once_with(api_key="test-key")
    mock_client.models.generate_content.assert_called_once()

    _, kwargs = mock_client.models.generate_content.call_args
    assert kwargs["model"] == "gemini-2.5-flash"
    assert kwargs["contents"] == "Reply with OK"
    assert kwargs["config"].system_instruction == "You are helpful."
    assert kwargs["config"].response_mime_type is None

    assert result == "OK"


class _EchoResult(BaseModel):
    approved: bool
    comments: list[str]


def test_call_gemini_with_response_schema_returns_parsed(monkeypatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    expected = _EchoResult(approved=True, comments=["looks good"])
    mock_response = MagicMock()
    mock_response.parsed = expected

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("agents.gemini_client.genai.Client", return_value=mock_client):
        result = gemini_client.call_gemini(
            system_prompt="You are a reviewer.",
            task="Review this diff.",
            response_schema=_EchoResult,
        )

    _, kwargs = mock_client.models.generate_content.call_args
    config = kwargs["config"]
    assert config.response_mime_type == "application/json"
    assert config.response_schema is _EchoResult

    assert result == expected


def test_call_gemini_wraps_api_error(monkeypatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = errors.APIError(
        500, {"error": {"message": "internal error", "status": "INTERNAL"}}
    )

    with patch("agents.gemini_client.genai.Client", return_value=mock_client):
        with pytest.raises(gemini_client.GeminiClientError) as exc_info:
            gemini_client.call_gemini(system_prompt="You are helpful.", task="Reply with OK")

    assert "internal error" in str(exc_info.value)


@pytest.mark.gemini
def test_call_gemini_real_api_returns_parsed_review_result() -> None:
    class _ReviewResult(BaseModel):
        approved: bool
        comments: list[str]

    result = gemini_client.call_gemini(
        system_prompt="You are a strict TypeScript code reviewer. Respond with JSON matching the schema.",
        task="Review this code:\nconst x: any = 1;",
        response_schema=_ReviewResult,
    )

    assert isinstance(result, _ReviewResult)
    assert isinstance(result.approved, bool)
    assert isinstance(result.comments, list)
