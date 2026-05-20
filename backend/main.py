from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from api.ingest import router as ingest_router
from api.rag import router as rag_router
from api.agent import router as agent_router
from api.analytics import router as analytics_router
from api.intelligence import router as intelligence_router
from api.threads import router as threads_router
from api.drafts import router as drafts_router

app = FastAPI(title="SenAI CRM Intelligence", version="1.0.0")

app.include_router(ingest_router, prefix="/api")
app.include_router(rag_router, prefix="") 
app.include_router(agent_router, prefix="") 
app.include_router(analytics_router, prefix="") 
app.include_router(intelligence_router, prefix="")
app.include_router(threads_router, prefix="")
app.include_router(drafts_router, prefix="")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "error_code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred",
            "details": {"error": str(exc)}
        }
    )

@app.get("/health")
async def health_check():
    return {"status": "success", "data": {"health": "ok"}}
