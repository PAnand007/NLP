from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from routers.connection import router as connection_router
from routers.upload import router as upload_router
from routers.query import router as query_router
from routers.export import router as export_router
from routers.collection_management import router as collection_management_router
from routers.connection import active_clients
from core.db import get_db_client
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    uri = settings.TEST_URL or settings.MONGO_DEFAULT_URI
    if uri:
        try:
            client = get_db_client(uri)
            db = client.get_default_database()
            if db is None:
                db_name = client.list_database_names()[0]
                db = client[db_name]
            active_clients["default"] = {"client": client, "db": db}
            print(f"Connected to MongoDB: {db.name}")
        except Exception as e:
            print(f"Failed to auto-connect to MongoDB: {e}")
    yield
    if "default" in active_clients:
        active_clients["default"]["client"].close()
        print("MongoDB connection closed.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan

)
print("Starting FastAPI application...")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],  
)

@app.get("/health", tags=["health"])
def health_check():
    """
    Health check endpoint to verify the API is running.
    """
    return {"status": "ok", "message": "ZERO ONE AI Backend is running."}


app.include_router(connection_router, prefix=f"{settings.API_V1_STR}", tags=["connection"])
app.include_router(upload_router, prefix=f"{settings.API_V1_STR}", tags=["upload"])
app.include_router(query_router, prefix=f"{settings.API_V1_STR}", tags=["query"])
app.include_router(export_router, prefix=f"{settings.API_V1_STR}/export", tags=["export"])
app.include_router(collection_management_router, prefix=f"{settings.API_V1_STR}", tags=["collections"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)