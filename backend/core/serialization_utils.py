import math
from bson import ObjectId
from datetime import datetime, date

def json_serializable(obj):
    """
    Recursively converts non-serializable objects (ObjectId, datetime, NaN) into strings or None.
    """
    try:
        if isinstance(obj, list):
            return [json_serializable(item) for item in obj]
        if isinstance(obj, dict):
            return {str(key) if not isinstance(key, (str, int, float, bool, type(None))) else key: json_serializable(value) for key, value in obj.items()}
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return None
        return obj
    except Exception as e:
        print(f"Serialization error for object: {type(obj)} - {obj}")
        raise e