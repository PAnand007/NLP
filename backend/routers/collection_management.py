from fastapi import APIRouter, HTTPException
from routers.connection import active_clients

router = APIRouter()

@router.delete("/collections/{collection_name}")
async def delete_collection(collection_name: str):
    """
    Drops a specific collection from the active database.
    """
    if "default" not in active_clients:
        raise HTTPException(status_code=400, detail="No active database connection.")
    db = active_clients["default"]["db"]
    try:
        if collection_name not in db.list_collection_names():
            raise HTTPException(status_code=404, detail=f"Collection '{collection_name}' not found.")
        db[collection_name].drop()
        collections = db.list_collection_names()
        return {
            "status": "success",
            "message": f"Collection '{collection_name}' deleted successfully.",
            "collections": collections
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete collection: {str(e)}")