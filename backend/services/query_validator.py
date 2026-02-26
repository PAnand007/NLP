def validate_pipeline(pipeline: list) -> bool:
    """
    Validates the generated MongoDB aggregation pipeline against a set of rules.
    Prevents execution of dangerous operators.
    """
    dangerous_operators = ["$where", "$out", "$merge", "$func"]
    pipeline_str = str(pipeline)
    for op in dangerous_operators:
        if op in pipeline_str:
            raise ValueError(f"Dangerous operator {op} detected in pipeline.")
    has_limit = False
    for stage in pipeline:
        if "$limit" in stage:
            has_limit = True
    if not has_limit:
        pipeline.append({"$limit": 1000})

    return pipeline