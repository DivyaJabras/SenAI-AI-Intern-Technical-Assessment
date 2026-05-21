import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker

# Automatically load environment variables from .env files
def _load_env():
    possible_paths = [
        os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),  # backend/.env
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),  # root/.env
    ]
    for path in possible_paths:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, val = line.split("=", 1)
                        os.environ.setdefault(key.strip(), val.strip().strip("'\""))

_load_env()

# Note: We are using asyncpg since FastAPI handles concurrent I/O well
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:password@localhost:5432/senai_crm")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
