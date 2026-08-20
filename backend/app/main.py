from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .repository import WeChatRepository


repository = WeChatRepository()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if repository.configured:
        try:
            await asyncio.to_thread(repository.ensure_cache)
        except Exception:
            # Keep health diagnostics available when a snapshot is corrupt or incompatible.
            pass
    yield


app = FastAPI(
    title="Local WeChat Database Panel API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["127.0.0.1", "localhost", "testserver"],
)


@app.middleware("http")
async def require_decrypted_snapshot(request: Request, call_next):
    setup_paths = {"/api/health", "/api/docs", "/api/openapi.json"}
    if request.url.path.startswith("/api") and request.url.path not in setup_paths:
        if not repository.configured:
            return JSONResponse(repository.health(), status_code=503)
    return await call_next(request)


@app.get("/api/health")
def health() -> dict:
    repository.reload_configuration_if_available()
    return repository.health()


@app.get("/api/profile")
def profile() -> dict:
    return repository.profile()


@app.get("/api/overview")
def overview(days: Annotated[int, Query(ge=1, le=366)] = 30) -> dict:
    return repository.overview(days)


@app.get("/api/contacts")
def contacts(
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    q: Annotated[str, Query(max_length=200)] = "",
) -> dict:
    return repository.contacts(limit=limit, offset=offset, query=q)


@app.get("/api/contacts/graph")
def contacts_graph(limit: Annotated[int, Query(ge=2, le=100)] = 30) -> dict:
    return repository.contact_graph(limit)


@app.get("/api/chat-list")
def chat_list(
    limit: Annotated[int, Query(ge=1, le=500)] = 120,
    offset: Annotated[int, Query(ge=0)] = 0,
    q: Annotated[str, Query(max_length=200)] = "",
    scope: Annotated[str, Query(pattern=r"^(all|groups|contacts)$")] = "all",
) -> dict:
    return repository.chat_sessions(
        limit=limit,
        offset=offset,
        query=q,
        scope=scope,
    )


@app.get("/api/chat-list/{username}")
def chat_list_detail(
    username: str,
    limit: Annotated[int, Query(ge=20, le=500)] = 180,
    year: Annotated[int | None, Query(ge=1970, le=2200)] = None,
    date: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}-\d{2}$")] = None,
) -> dict:
    result = repository.chat_session(
        username,
        limit=limit,
        year=year,
        selected_date=date,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return result


@app.get("/api/media")
def media(limit: Annotated[int, Query(ge=1, le=200)] = 24) -> dict:
    return repository.media(limit)


@app.get("/api/contributions")
def contributions(
    year: Annotated[int | None, Query(ge=1970, le=2200)] = None,
    date: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}-\d{2}$")] = None,
) -> dict:
    return repository.contributions(year=year, selected_date=date)


@app.get("/api/conversations")
def conversations(
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    start_date: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}-\d{2}$")] = None,
    end_date: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}-\d{2}$")] = None,
    session: Annotated[str | None, Query(max_length=200)] = None,
    category: Annotated[str | None, Query(max_length=40)] = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
    hour: Annotated[int | None, Query(ge=0, le=23)] = None,
    date: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}-\d{2}$")] = None,
    message: Annotated[str | None, Query(max_length=64)] = None,
    sort: Annotated[str, Query(pattern=r"^(asc|desc)$")] = "desc",
    order: Annotated[str | None, Query(pattern=r"^(asc|desc)$")] = None,
) -> dict:
    if date:
        start_date = date
        end_date = date
    return repository.conversations(
        limit=limit,
        offset=offset,
        start_date=start_date,
        end_date=end_date,
        session=session,
        category=category,
        query=q,
        hour=hour,
        message_id=message,
        sort=order or sort,
    )


@app.get("/api/conversations/export")
def conversations_export(
    format: Annotated[str, Query(pattern=r"^(csv|json|html)$")] = "csv",
    start_date: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}-\d{2}$")] = None,
    end_date: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}-\d{2}$")] = None,
    session: Annotated[str | None, Query(max_length=200)] = None,
    category: Annotated[str | None, Query(max_length=40)] = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
    hour: Annotated[int | None, Query(ge=0, le=23)] = None,
    date: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}-\d{2}$")] = None,
    order: Annotated[str, Query(pattern=r"^(asc|desc)$")] = "desc",
) -> Response:
    if date:
        start_date = date
        end_date = date
    payload, media_type, filename = repository.export_conversations(
        format_name=format,
        start_date=start_date,
        end_date=end_date,
        session=session,
        category=category,
        query=q,
        hour=hour,
        order=order,
    )
    return Response(
        content=payload,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/conversations/{episode_id}")
def conversation_episode(episode_id: str) -> dict:
    result = repository.episode_messages(episode_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Episode not found")
    return result


@app.get("/api/messages/{message_id}")
def message(message_id: str) -> dict:
    result = repository.message(message_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Message not found")
    return result


@app.get("/api/search")
def search(
    q: Annotated[str, Query(min_length=1, max_length=500)],
    scope: Annotated[str, Query(pattern=r"^(all|messages|contacts|favorites)$")] = "all",
    limit: Annotated[int, Query(ge=1, le=200)] = 20,
) -> dict:
    return repository.search(q, scope=scope, limit=limit)


@app.get("/api/fts/validate")
def validate_fts() -> dict:
    return repository.validate_fts()


@app.get("/api/avatars/{username}")
def avatar(username: str) -> Response:
    payload, media_type, etag = repository.avatar(username)
    return Response(
        content=payload,
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=3600",
            "ETag": f'"{etag}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@app.get("/api/resources/{kind}/{rowid}")
def resource(kind: str, rowid: int, download: bool = False) -> FileResponse:
    result = repository.resource(kind, rowid)
    if result is None:
        raise HTTPException(status_code=404, detail="Resource is unavailable")
    path, media_type, file_name = result
    return FileResponse(
        path,
        media_type=media_type,
        filename=file_name if download or kind == "file" else None,
        content_disposition_type="attachment" if download or kind == "file" else "inline",
        headers={
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )


@app.get("/api/settings")
def local_settings() -> dict:
    return {
        "database_root": str(repository.database_root),
        "cache_path": str(repository.settings.cache_path),
        "timezone": repository.settings.timezone,
        "episode_gap_seconds": repository.settings.episode_gap_seconds,
        "response_max_seconds": repository.settings.response_max_seconds,
        "listen_policy": "127.0.0.1 only",
        "source_read_only": True,
        "telemetry": False,
        "snapshot_time": repository.snapshot_time,
    }
