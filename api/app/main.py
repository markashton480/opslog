from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.auth import AuthMiddleware
from app.config import settings
from app.db import close_pool, init_pool
from app.middleware import RequestSizeLimitMiddleware
from app.oidc import close_oidc_verifier
from app.routes import events_router, issues_router, servers_router, utility_router


def validate_startup_config() -> None:
    if not settings.oidc_enabled:
        return

    missing: list[str] = []
    if not settings.oidc_issuer:
        missing.append("OIDC_ISSUER")
    if not settings.oidc_audience:
        missing.append("OIDC_AUDIENCE")
    if missing:
        raise RuntimeError(f"OIDC_ENABLED=true requires {', '.join(missing)}")
    if not settings.oidc_algorithms:
        raise RuntimeError("OIDC_ENABLED=true requires at least one OIDC algorithm")


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_startup_config()
    await init_pool()
    yield
    await close_oidc_verifier()
    await close_pool()


app = FastAPI(
    title="Lintel OpsLog",
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(RequestSizeLimitMiddleware, max_body_bytes=settings.max_request_bytes)
app.add_middleware(AuthMiddleware)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"data": {"error": exc.detail}, "warnings": []},
    )


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(_, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "data": {"error": "validation_error", "detail": jsonable_encoder(exc.errors())},
            "warnings": [],
        },
    )


app.include_router(events_router)
app.include_router(issues_router)
app.include_router(servers_router)
app.include_router(utility_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
