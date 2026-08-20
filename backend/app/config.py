from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


PANEL_ROOT = Path(__file__).resolve().parents[2]
REPOSITORY_ROOT = PANEL_ROOT


def _path_from_env(name: str, default: Path) -> Path:
    value = os.getenv(name)
    return Path(value).expanduser().resolve() if value else default.resolve()


@dataclass(frozen=True, slots=True)
class Settings:
    panel_root: Path
    repository_root: Path
    database_root: Path
    report_path: Path
    cache_path: Path
    fts_extension: Path
    weixin_dll: Path
    timezone: str = "Asia/Shanghai"
    episode_gap_seconds: int = 30 * 60
    response_max_seconds: int = 24 * 60 * 60

    def __post_init__(self) -> None:
        cache_path = self.cache_path.resolve()
        cache_root = (self.panel_root / ".cache").resolve()
        database_root = self.database_root.resolve()
        if cache_path == database_root or cache_path.is_relative_to(database_root):
            raise ValueError("analytics cache must not be stored in the source database tree")
        if cache_path == cache_root or not cache_path.is_relative_to(cache_root):
            raise ValueError("analytics cache must be a file inside the project .cache directory")

    @classmethod
    def from_env(cls) -> "Settings":
        database_root = _path_from_env(
            "WECHAT_DB_ROOT", REPOSITORY_ROOT / "data" / "db_decrypt" / "all"
        )
        return cls(
            panel_root=PANEL_ROOT,
            repository_root=REPOSITORY_ROOT,
            database_root=database_root,
            report_path=_path_from_env(
                "WECHAT_DECRYPTION_REPORT",
                REPOSITORY_ROOT / "data" / "db_decrypt" / "decryption_report.json",
            ),
            cache_path=_path_from_env(
                "WECHAT_ANALYTICS_CACHE", PANEL_ROOT / ".cache" / "analytics.sqlite"
            ),
            fts_extension=_path_from_env(
                "WECHAT_FTS_EXTENSION",
                REPOSITORY_ROOT / "dist" / "weixin_fts_tokenizer.dll",
            ),
            weixin_dll=_path_from_env(
                "WEIXIN_DLL_PATH",
                REPOSITORY_ROOT / "data" / "Weixin.dll",
            ),
            timezone=os.getenv("WECHAT_TIMEZONE", "Asia/Shanghai"),
            episode_gap_seconds=int(os.getenv("WECHAT_EPISODE_GAP_SECONDS", "1800")),
            response_max_seconds=int(os.getenv("WECHAT_RESPONSE_MAX_SECONDS", "86400")),
        )


settings = Settings.from_env()
