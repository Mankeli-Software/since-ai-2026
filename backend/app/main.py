"""App factory. Routes are autodiscovered from `app/api/routes/*.py` in sorted order: each module
exposes `router = APIRouter(tags=["<lane>"])`. Add a file; never edit this one to add a route.

`app.main:app` (uvicorn) is built lazily on first access, so importing `create_app` (e.g. from
`app.export`) does not build the app a second time."""

import logging
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import Response
from starlette.types import ASGIApp, Scope

from app import __version__
from app.config import get_settings
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging
from app.core.registry import discover
from app.core.security import SecurityHeadersMiddleware
from app.persistence.memory import InMemorySessionStore

log = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parent.parent
# The image copies web/dist to /app/static (= backend/static); app/static also works locally.
STATIC_CANDIDATES = (BACKEND_DIR / "static", BACKEND_DIR / "app" / "static")


def unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}" if route.tags else route.name


class SpaStaticFiles(StaticFiles):
    """Static multi-page app; unknown extension-less paths fall back to index.html."""

    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404 or path.startswith("api") or "." in Path(path).name:
                raise
            return await super().get_response("index.html", scope)


class FitterApp(FastAPI):
    """Puts `SecurityHeadersMiddleware` outside Starlette's `ServerErrorMiddleware`, so every
    response, including unhandled-exception 500s, carries CSP + nosniff (plan §6.5)."""

    def __init__(self, *, frame_ancestors: str, **kwargs: Any) -> None:
        self.frame_ancestors = frame_ancestors
        super().__init__(**kwargs)

    def build_middleware_stack(self) -> ASGIApp:
        return SecurityHeadersMiddleware(super().build_middleware_stack(), self.frame_ancestors)


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging()
    app = FitterApp(
        frame_ancestors=settings.allowed_frame_ancestors,
        title="Takomo Fitter Studio API",
        version=__version__,
        generate_unique_id_function=unique_id,
    )
    install_error_handlers(app)

    if settings.store != "memory":
        log.warning("store_unavailable", extra={"store": settings.store, "using": "memory"})
    app.state.store = InMemorySessionStore()

    for module in discover("app.api.routes"):
        router = getattr(module, "router", None)
        if router is None:
            raise RuntimeError(f"{module.__name__} must define `router`")
        app.include_router(router)

    static_dir = next((p for p in STATIC_CANDIDATES if p.is_dir()), None)
    if static_dir is not None:
        app.mount("/", SpaStaticFiles(directory=static_dir, html=True), name="static")
    return app


_app: FastAPI | None = None


def __getattr__(name: str) -> Any:
    """PEP 562: `app.main.app` is created on first access (uvicorn, `from app.main import app`)."""
    global _app
    if name != "app":
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    if _app is None:
        _app = create_app()
    return _app
