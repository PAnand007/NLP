from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from core.schema_utils import get_collection_schema

def get_db_client(uri: str):
    """
    Connects to MongoDB and returns the client if connection is successful.
    Raises an exception if it fails.
    """
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        return client
    except Exception as e:
        raise Exception(f"Failed to connect to MongoDB: {str(e)}")

def get_full_db_schema(db, limit: int = 5):
    """
    Infers schema for all collections to allow cross-collection joins ($lookup).
    Optimized to skip internal collections and limit field discovery.
    """
    full_schema = {}
    try:
        collections = db.list_collection_names()
        collections = [c for c in collections if not c.startswith('system.')]
        for coll_name in collections[:20]:
            full_schema[coll_name] = get_collection_schema(db, coll_name, limit)
    except Exception as e:
        print(f"Schema fetching warning: {e}")
    return full_schema