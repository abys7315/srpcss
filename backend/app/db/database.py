"""
Database Engine and Session Configuration.
SIH 2026, PS26120 — Baghewala Heavy Oil Digital Twin.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from pathlib import Path

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
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

# SQLite needs connect_args check_same_thread=False
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """FastAPI Dependency for database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
