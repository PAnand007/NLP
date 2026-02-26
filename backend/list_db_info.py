from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv("../.env.backend")

uri = os.getenv("TEST_URL") or os.getenv("MONGO_DEFAULT_URI")
print(f"Connecting to: {uri}")

try:
    client = MongoClient(uri)
    db = client.get_default_database()
    if db is None:
        db_names = client.list_database_names()
        db_names = [d for d in db_names if d not in ['admin', 'local', 'config', 'test']]
        if not db_names:
             raise Exception("No databases found on this cluster.")
        db = client[db_names[0]]
    print(f"Connected to Database: {db.name}")
    collections = db.list_collection_names()
    print("\nCollections and record counts:")
    for col_name in collections:
        if col_name.startswith('system.'): continue
        count = db[col_name].count_documents({})
        print(f"- {col_name}: {count} records")
except Exception as e:
    print(f"Error: {e}")