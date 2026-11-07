"""`GET /api/catalog`: heads, shafts, grips, length and lie options, product videos (plan §7)."""

from fastapi import APIRouter

from app.fitting.catalog import catalog_response
from app.schemas.fit import CatalogResponse

router = APIRouter(tags=["fit"])


@router.get("/api/catalog")
async def catalog() -> CatalogResponse:
    return catalog_response()
