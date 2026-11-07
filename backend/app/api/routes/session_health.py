from fastapi import APIRouter

from app import __version__
from app.api.deps import SettingsDep
from app.schemas.session import HealthResponse

router = APIRouter(tags=["session"])


@router.get("/api/health")
async def health(settings: SettingsDep) -> HealthResponse:
    return HealthResponse(
        ok=True, version=__version__, llm_mode=settings.llm_mode, store=settings.store
    )
