from fastapi import APIRouter

from app.api.chat import router as chat_router
from app.api.chat_stream import router as chat_stream_router
from app.api.documents import router as documents_router
from app.api.health import router as health_router
from app.api.users import router as users_router

api_router = APIRouter()
api_router.include_router(users_router)
api_router.include_router(documents_router)
api_router.include_router(chat_router)
api_router.include_router(chat_stream_router)
api_router.include_router(health_router)
