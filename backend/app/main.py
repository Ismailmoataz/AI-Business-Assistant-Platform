from fastapi import FastAPI

from app.config.settings import settings
from app.api.routes.chat import router as chat_router
from app.database.connection import Base, engine
from app.database.models import User

app = FastAPI(
    title=settings.app_name
)


app.include_router(chat_router)

Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {
        "message": "AI Business Assistant Platform API is running",
        "environment": settings.environment
    }

