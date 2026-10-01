"""
Database Engine and Session Configuration.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from pathlib import Path


def normalize_database_url(url: str) -> str:
    """
    Make a hosting-provider URL usable by SQLAlchemy 2.x + psycopg (v3).

    Render/Heroku-style providers hand out ``postgres://`` (rejected by SQLAlchemy 2.x) or a bare
    ``postgresql://`` (which would select the legacy psycopg2 driver). Both are mapped to
    ``postgresql+psycopg://``. URLs that already name a driver are left untouched.
    """
    url = url.strip()
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL:
    DATABASE_URL = normalize_database_url(DATABASE_URL)
else:
    _backend_dir = Path(__file__).resolve().parent.parent.parent
    _root_dir = _backend_dir.parent
    _db_root = _root_dir / "sih_digital_twin.db"
    _db_backend = _backend_dir / "sih_digital_twin.db"
    if _db_root.exists():
        DATABASE_URL = f"sqlite:///{_db_root.resolve().as_posix()}"
    elif _db_backend.exists():
        DATABASE_URL = f"sqlite:///{_db_backend.resolve().as_posix()}"
    else:
        DATABASE_URL = f"sqlite:///{_db_root.resolve().as_posix()}"

_is_sqlite = DATABASE_URL.startswith("sqlite")

# SQLite needs connect_args check_same_thread=False
connect_args = {"check_same_thread": False} if _is_sqlite else {}

_engine_kwargs = {"connect_args": connect_args, "echo": False}
if not _is_sqlite:
    # Managed Postgres closes idle connections (and free instances sleep): validate before use and
    # recycle so the first request after an idle period does not fail with a stale connection.
    _engine_kwargs.update(pool_pre_ping=True, pool_recycle=300, pool_size=5, max_overflow=5)

engine = create_engine(DATABASE_URL, **_engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """FastAPI Dependency for database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
