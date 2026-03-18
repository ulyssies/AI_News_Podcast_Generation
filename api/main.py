from pathlib import Path
import traceback

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from routes import router as api_router, limiter

# Load .env from api/ so keys are found when running from project root
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv()  # Also try project root


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI News Podcast Generator API",
        description="POC FastAPI backend for generating AI-powered news podcast episodes.",
        version="0.1.0",
    )

    @app.exception_handler(Exception)
    async def catch_all(_request: Request, exc: Exception):
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": f"{type(exc).__name__}: {str(exc)}"},
        )

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_exceeded_handler(_request: Request, _exc: RateLimitExceeded):
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Daily generation limit reached. Please try again tomorrow."
            },
        )

    app.state.limiter = limiter  # used by SlowAPIMiddleware
    app.add_middleware(SlowAPIMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)
    return app


app = create_app()
