from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from models.connection import ConnectRequest, ConnectResponse, SchemaResponse
from core.db import get_db_client, get_collection_schema

router = APIRouter()


active_clients = {}

@router.post("/connect", response_model=ConnectResponse)
def connect_to_mongo(req: ConnectRequest):
    try:
        client = get_db_client(req.uri)
        db = client.get_default_database()
        if db is None:
            db_name = client.list_database_names()[0]
            db = client[db_name]
        collections = db.list_collection_names()
        active_clients["default"] = {"client": client, "db": db}
        return {
            "status": "success",
            "message": f"Connected to MongoDB database: {db.name}",
            "collections": collections
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/schema/{collection_name}", response_model=SchemaResponse)
def get_schema(collection_name: str):
    if "default" not in active_clients:
        raise HTTPException(status_code=400, detail="No active database connection")
    db = active_clients["default"]["db"]
    if collection_name not in db.list_collection_names():
        raise HTTPException(status_code=404, detail="Collection not found")
    schema_info = get_collection_schema(db, collection_name)
    return {
        "collection": collection_name,
        "schema_info": schema_info
    }