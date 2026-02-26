def get_collection_schema(db, collection_name: str, limit: int = 50):
    """
    Infers a very basic schema by examining a few documents.
    """
    collection = db[collection_name]
    docs = collection.find().limit(limit)
    field_counts = {}
    schema_types = {}
    for doc in docs:
        for key, value in doc.items():
            if key not in schema_types:
                schema_types[key] = type(value).__name__
            field_counts[key] = field_counts.get(key, 0) + 1
    sorted_fields = sorted(field_counts.items(), key=lambda x: x[1], reverse=True)[:20]
    schema = {}
    for key, _ in sorted_fields:
        schema[key] = schema_types[key]
    return schema