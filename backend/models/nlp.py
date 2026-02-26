from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class NLPQueryRequest(BaseModel):
    user_query: str
    collection_name: str
    schema_info: Dict[str, Any]

class NLPValidationContext(BaseModel):
    allowed_operations: List[str] = ["find", "count", "aggregate", "distinct"]


class StructuredMongoPipeline(BaseModel):
    collection: str
    operation: str = Field(..., description="E.g., find, aggregate, count")
    filters: Optional[Dict[str, Any]] = None
    group_by: Optional[str] = None
    metrics: Optional[List[str]] = None
    sort: Optional[Dict[str, int]] = None
    limit: Optional[int] = 1000
    raw_pipeline: Optional[List[Dict[str, Any]]] = None