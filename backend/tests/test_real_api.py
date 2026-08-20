import sqlite3
from datetime import datetime
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient

from backend.app.config import settings
from backend.app.database import open_readonly
from backend.app.main import app


pytestmark = pytest.mark.skipif(
    not settings.report_path.is_file()
    or not (settings.database_root / "message" / "message_0.db").is_file(),
    reason="local decrypted snapshot is unavailable",
)


def test_real_snapshot_core_api_smoke() -> None:
    with TestClient(app) as client:
        health = client.get("/api/health")
        assert health.status_code == 200
        assert health.json()["status"] == "ok"
        assert health.json()["configured"] is True
        assert health.json()["message_count"] >= 0

        profile = client.get("/api/profile")
        assert profile.status_code == 200
        assert profile.json()["profile"]["username"]

        for path in (
            "/api/overview",
            "/api/contacts?limit=5",
            "/api/media?limit=5",
            "/api/contributions",
            "/api/conversations?limit=5",
            "/api/chat-list?limit=5",
        ):
            response = client.get(path)
            assert response.status_code == 200, path

        if settings.fts_extension.is_file() and settings.weixin_dll.is_file():
            checks = client.get("/api/fts/validate")
            assert checks.status_code == 200
            assert all(
                value["quick_check"] == ["ok"]
                for value in checks.json().values()
            )


def test_source_database_uri_is_not_cache_path() -> None:
    assert settings.database_root.resolve() != settings.cache_path.parent.resolve()
    assert settings.cache_path.is_relative_to(settings.panel_root / ".cache")


def test_source_connection_rejects_writes() -> None:
    with open_readonly(settings.database_root / "contact" / "contact.db") as connection:
        with pytest.raises(sqlite3.OperationalError):
            connection.execute("CREATE TABLE public_repo_must_not_write(value INTEGER)")


def test_conversation_filter_export_and_message_links() -> None:
    with TestClient(app) as client:
        listing = client.get("/api/conversations", params={"limit": 5}).json()
        if not listing["items"]:
            pytest.skip("snapshot contains no conversation episodes")

        peak = max(listing["hourly"], key=lambda item: item["count"])
        filtered = client.get(
            "/api/conversations", params={"hour": peak["hour"], "limit": 5}
        )
        assert filtered.status_code == 200
        assert filtered.json()["total"] >= len(filtered.json()["items"])
        assert client.get("/api/conversations", params={"hour": 24}).status_code == 422

        exported = client.get(
            "/api/conversations/export",
            params={"format": "json", "hour": peak["hour"], "order": "desc"},
        )
        assert exported.status_code == 200
        timestamps = [row["create_time"] for row in exported.json()]
        assert timestamps == sorted(timestamps, reverse=True)

        first = listing["items"][0]
        detail = client.get(f"/api/conversations/{first['id']}")
        assert detail.status_code == 200
        assert detail.json()["messages"]
        message = detail.json()["messages"][0]
        message_response = client.get(f"/api/messages/{message['id']}")
        assert message_response.status_code == 200
        assert message_response.json()["episode_id"]


def test_chat_list_uses_snapshot_sessions_and_daily_metrics() -> None:
    with TestClient(app) as client:
        response = client.get("/api/chat-list", params={"limit": 8})
        assert response.status_code == 200
        listing = response.json()
        assert listing["total"] == listing["counts"]["all"]
        assert (
            listing["counts"]["groups"] + listing["counts"]["contacts"]
            == listing["counts"]["all"]
        )
        if not listing["items"]:
            pytest.skip("snapshot contains no chat sessions")

        timestamps = [
            datetime.fromisoformat(item["last_active"])
            for item in listing["items"]
        ]
        assert timestamps == sorted(timestamps, reverse=True)

        first = listing["items"][0]
        detail_response = client.get(
            f"/api/chat-list/{quote(first['username'], safe='')}",
            params={"limit": 40},
        )
        assert detail_response.status_code == 200
        detail = detail_response.json()
        assert detail["session"]["username"] == first["username"]
        assert detail["stats"]["messages"] == first["message_count"]
        assert len(detail["messages"]) <= 40

        contacts_only = client.get(
            "/api/chat-list", params={"scope": "contacts", "limit": 20}
        ).json()
        assert all(not item["is_group"] for item in contacts_only["items"])
