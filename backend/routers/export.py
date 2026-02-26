from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any
import pandas as pd
import io

router = APIRouter()

class ExportRequest(BaseModel):
    data: List[Dict[str, Any]]
@router.post("/csv")
def export_csv(req: ExportRequest):
    df = pd.DataFrame(req.data)
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=export.csv"
    return response

@router.post("/pdf")
def export_pdf(req: ExportRequest):
    return {"status": "success", "message": "PDF generation endpoint placeholder"}