import json
from fastapi import APIRouter, UploadFile, File, HTTPException
from routers.connection import active_clients
from core.config import settings
from core.db import get_db_client

router = APIRouter()

@router.post("/upload-json")
async def upload_json(file: UploadFile = File(...)):
    """
    Accepts a JSON file, loads its records into a temporary MongoDB collection,
    and makes it queryable immediately.
    """
    if "default" not in active_clients:
        fallback_uri = settings.TEST_URL or settings.MONGO_DEFAULT_URI
        if not fallback_uri:
            raise HTTPException(status_code=400, detail="No active database connection. Please connect first.")
        try:
            client = get_db_client(fallback_uri)
            db = client.get_default_database()
            if db is None:
                db_name = client.list_database_names()[0]
                db = client[db_name]
            active_clients["default"] = {"client": client, "db": db}
            print(f"[Upload] Auto-connected to: {db.name}")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Auto-connection failed: {str(e)}")

    if not file.filename or not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Only .json files are supported.")

    try:
        content = await file.read()
        data = json.loads(content)

        if isinstance(data, dict):
            for key, val in data.items():
                if isinstance(val, list):
                    data = val
                    break

        if not isinstance(data, list):
            raise HTTPException(status_code=400, detail="JSON must be an array of documents.")

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format.")

    if not data:
        raise HTTPException(status_code=400, detail="The uploaded JSON file is empty.")

    db = active_clients["default"]["db"]

    base_name = file.filename.replace('.json', '').replace(' ', '_').lower()
    col_name = f"upload_{base_name}"

    if col_name in db.list_collection_names():
        db[col_name].drop()

    collection = db[col_name]
    collection.insert_many(data)

    print(f"[Upload] Loaded {len(data)} records into collection: {col_name}")

    return {
        "status": "success",
        "message": f"Loaded {len(data)} records into '{col_name}'",
        "collection": col_name,
        "count": len(data)
    }