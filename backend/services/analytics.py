import pandas as pd
from typing import List, Dict, Any

def analyze_data(data: List[Dict[str, Any]]) -> dict:
    """
    Takes a list of MongoDB documents, converts to Pandas DataFrame, and computes insights.
    """
    if not data:
        return {"metrics": {}, "trend": "No data available."}
    df = pd.DataFrame(data)
    numeric_cols = df.select_dtypes(include=['number', 'float64', 'int64']).columns
    metrics = {}
    for col in numeric_cols:
        metrics[col] = float(df[col].sum())
    categorical_cols = df.select_dtypes(include=['object', 'category']).columns
    categorical_metrics = {}
    for col in categorical_cols:
        try:
            first_val = df[col].dropna().iloc[0] if not df[col].dropna().empty else None
            if isinstance(first_val, (list, dict)):
                continue
            if df[col].nunique() < len(df) or df[col].nunique() < 50:
                 top_cats = df[col].value_counts().head(20).to_dict()
                 categorical_metrics[col] = top_cats
        except Exception:
            continue

    metrics["Top_Categories"] = categorical_metrics

    data_glimpse = ""
    if not df.empty:
        glimpse_df = df.head(5).copy()
        cols_to_drop = [c for c in glimpse_df.columns if str(c).startswith('_') and c != '_id']
        glimpse_df.drop(columns=cols_to_drop, inplace=True, errors='ignore')
        data_glimpse = glimpse_df.to_string(index=False)

    trend = f"Analyzed {len(df)} records. "
    if numeric_cols.empty:
        trend += "No numeric data found for quantitative trends."
    else:
        avg_val = df[numeric_cols[0]].mean()
        max_val = df[numeric_cols[0]].max()
        trend += f"Average {numeric_cols[0]} is {avg_val:.2f}, with a peak of {max_val}."
    return {
        "metrics": metrics,
        "trend": trend,
        "data_glimpse": data_glimpse,
        "dataframe_shape": df.shape
    }