"""
Main FastAPI application for SimpleWatch.
"""
import os
import logging
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from database import init_db, SessionLocal
from utils.db import create_default_admin
from scheduler import start_scheduler, stop_scheduler

from api import auth, status, services, users, monitors, webhooks, heartbeat

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    logger.info("Starting SimpleWatch...")

    init_db()
    logger.info("Database initialized")

    db = SessionLocal()
    try:
        create_default_admin(db)
        logger.info("Default admin user checked")

        create_examples = os.getenv("CREATE_EXAMPLES", "true").lower() == "true"
        if create_examples:
            from utils.examples import create_example_monitors
            create_example_monitors(db)
            logger.info("Example monitors created")
    finally:
        db.close()

    start_scheduler()
    logger.info("Scheduler started")

    yield

    stop_scheduler()
    logger.info("SimpleWatch stopped")


app = FastAPI(
    title="SimpleWatch",
    description="Self-hosted monitoring dashboard for business users",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(status.router)
app.include_router(services.router)
app.include_router(users.router)
app.include_router(monitors.router)
app.include_router(webhooks.router)
app.include_router(heartbeat.router)

frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
app.mount("/static", StaticFiles(directory=frontend_path), name="static")


@app.get("/")
def read_root():
    """Serve the main dashboard page."""
    return FileResponse(os.path.join(frontend_path, "index.html"))


@app.get("/health")
def health_check():
    """Health check endpoint for Docker."""
    return {"status": "healthy"}


@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """Handle 404 errors by serving the main page (for SPA routing)."""
    if request.url.path.startswith("/api"):
        return JSONResponse(
            status_code=404,
            content={"success": False, "error": "Not found", "error_code": "NOT_FOUND"}
        )
    return FileResponse(os.path.join(frontend_path, "index.html"))


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    """Handle 500 errors."""
    logger.error(f"Internal server error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error", "error_code": "INTERNAL_ERROR"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=5050,
        reload=False,
        log_level="info"
    )
