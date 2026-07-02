from unittest.mock import MagicMock, patch

from agents import lm_studio_client


def test_is_available_caches_result_within_60s(monkeypatch) -> None:
    call_count = 0

    def counting_list():
        nonlocal call_count
        call_count += 1

    mock_client = MagicMock()
    mock_client.models.list = counting_list
    monkeypatch.setattr(lm_studio_client, "_cache_ts", 0.0)
    monkeypatch.setattr(lm_studio_client, "_availability_cache", None)

    with patch("agents.lm_studio_client._client", return_value=mock_client):
        lm_studio_client.is_available()
        lm_studio_client.is_available()
        lm_studio_client.is_available()

    assert call_count == 1


def test_is_available_refreshes_cache_after_60s(monkeypatch) -> None:
    call_count = 0

    def counting_list():
        nonlocal call_count
        call_count += 1

    mock_client = MagicMock()
    mock_client.models.list = counting_list
    monkeypatch.setattr(lm_studio_client, "_cache_ts", 0.0)
    monkeypatch.setattr(lm_studio_client, "_availability_cache", None)

    with patch("agents.lm_studio_client._client", return_value=mock_client), \
         patch("agents.lm_studio_client.time") as mock_time:
        mock_time.monotonic.return_value = 0.0
        lm_studio_client.is_available()

        mock_time.monotonic.return_value = 61.0
        monkeypatch.setattr(lm_studio_client, "_cache_ts", 0.0)
        lm_studio_client.is_available()

    assert call_count == 2
