import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes.chat import router as chat_router
from app.api.routes.health import router as health_router
from app.config.settings import settings
from app.database.connection import Base, engine
from app.database.models import User

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
    except SQLAlchemyError as exc:
        logger.exception("Database initialization failed")
        raise RuntimeError("Database initialization failed") from exc
    yield
    engine.dispose()


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
    docs_url=None if settings.environment == "production" else "/docs",
    redoc_url=None if settings.environment == "production" else "/redoc",
)

app.include_router(health_router)
app.include_router(chat_router)


@app.get("/", tags=["Root"])
def root() -> dict[str, str]:
    return {"message": "AI Business Assistant Platform API is running"}
