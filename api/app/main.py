from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.auth import AuthMiddleware
from app.config import settings
from app.db import close_pool, init_pool
from app.middleware import RequestSizeLimitMiddleware
from app.routes import events_router, utility_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    yield
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


app.include_router(events_router)
app.include_router(utility_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
