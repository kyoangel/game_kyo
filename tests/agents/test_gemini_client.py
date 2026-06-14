from unittest.mock import MagicMock, patch

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
