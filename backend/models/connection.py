from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ConnectRequest(BaseModel):
    uri: str

class ConnectResponse(BaseModel):
    status: str
    message: str
    collections: Optional[List[str]] = None

class SchemaResponse(BaseModel):
    collection: str
    schema_info: Dict[str, Any]