from fastapi import APIRouter


router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)


@router.get("/")
def chat_status():
    return {
        "message": "Chat service is ready"
    }