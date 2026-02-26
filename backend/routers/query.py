from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from routers.connection import active_clients
from core.db import get_full_db_schema
from services.llm_engine import llm_engine
from services.query_validator import validate_pipeline
from services.analytics import analyze_data
from core.serialization_utils import json_serializable

router = APIRouter()

class NLQueryRequest(BaseModel):
    query: str
    collection_name: str

class QueryResponse(BaseModel):
    data: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    insight_summary: str
    structured_query: Dict[str, Any]
    detected_lang: Optional[str] = "english"


@router.post("/query", response_model=QueryResponse)
async def process_natural_language_query(request: NLQueryRequest):
    try:
        if "default" not in active_clients:
            raise HTTPException(status_code=400, detail="Database not connected.")
        db = active_clients["default"]["db"]
        col_name = request.collection_name
        full_schema = get_full_db_schema(db)
        structured_query, detected_lang = await llm_engine.generate_query(request.query, full_schema, col_name)
        intent = structured_query.get("intent", "analytical")

        if intent == "conversational":
            explanation = await llm_engine.generate_explanation(
                user_question=request.query, 
                metrics={}, trend="", data_glimpse="", raw_pipeline=[],
                detected_lang=detected_lang,
                intent="conversational",
                schema_info=full_schema
            )
            return QueryResponse(
                data=[], metrics={}, insight_summary=explanation,
                structured_query={}, detected_lang=detected_lang
            )
        raw_pipeline = structured_query.get("raw_pipeline", [])
        validated_pipeline = validate_pipeline(raw_pipeline)
        collection = db[col_name]
        data = list(collection.aggregate(validated_pipeline))

        context_sample = list(collection.find().limit(100))

        analytics_result = analyze_data(data if data else context_sample)
        explanation = await llm_engine.generate_explanation(
            user_question=request.query, 
            metrics=analytics_result["metrics"], 
            trend=analytics_result["trend"],
            data_glimpse=analytics_result.get("data_glimpse", ""),
            raw_pipeline=validated_pipeline,
            detected_lang=detected_lang,
            intent="analytical"
        )
        return QueryResponse(
            data=json_serializable(data),
            metrics=json_serializable(analytics_result["metrics"]),
            insight_summary=explanation,
            structured_query=json_serializable(structured_query),
            detected_lang=detected_lang
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")