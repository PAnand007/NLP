import json
from openai import AsyncOpenAI
from core.config import settings
from core.serialization_utils import json_serializable

class LLMEngine:
    def __init__(self):
        self.client = None
        if settings.OPENAI_API_KEY:
            self.client = AsyncOpenAI(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_BASE_URL
            )
        self.model = settings.OPENAI_MODEL
        print(f"LLM Engine initialized using model: {self.model}")
        print(f"Base URL: {settings.OPENAI_BASE_URL}")
        print(f"API Key configured: {'Yes' if settings.OPENAI_API_KEY else 'No'}")

    async def generate_query(self, user_question: str, schema_info: dict, collection_name: str) -> dict:
        """
        Detects the language and intent (analytical vs conversational) of the user's question.
        """
        detection_prompt = f"""
        Analyze this user question: "{user_question}".
        1. Identify the language: "hindi", "hinglish", or "english". 
           - "english": Only English words.
           - "hindi": Using Hindi script or very traditional words.
           - "hinglish": A mix of Hindi and English words (e.g., "Total sales dikhao").
        2. Identify the intent: 
           - "analytical" (user wants to query data, e.g., "top sales", "summarize data")
           - "conversational" (user is greeting, thanking, or making small talk, e.g., "Thanks", "Dhanewadh", "Hi")
        Return ONLY a JSON object: {{"lang": "...", "intent": "..."}}
        """
        lang_res = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": detection_prompt}],
            response_format={ "type": "json_object" },
            temperature=0.0
        )
        detection_data = json.loads(lang_res.choices[0].message.content)
        detected_lang = detection_data.get("lang", "english")
        intent = detection_data.get("intent", "analytical")

        if intent == "conversational":
            analytical_keywords = ["analyze", "what is", "about", "database", "data", "tell me", "ky", "hai", "dikhao"]
            if any(k in user_question.lower() for k in analytical_keywords):
                intent = "analytical"
            else:
                return {"intent": "conversational"}, detected_lang

        """
        Translates the natural language question into a structured MongoDB aggregation pipeline.
        """
        system_prompt = f"""
You are a MongoDB data extraction expert.
Convert the following user question into a structured JSON query object based on this schema:
{json.dumps(json_serializable(schema_info), indent=2)}

CRITICAL INSTRUCTIONS:
1. If the user's question relates to data that is spread out, you MUST use the `$lookup` pipeline stage to join collections (Data Normalization/Denormalization).
2. MULTILINGUAL: The user may ask questions in English, Hindi, or Hinglish (e.g., "Total sales dikhao"). Understand the intent and convert it into the correct MongoDB query regardless of the input language.
3. For instance, if you have `sales` and `users` collections, and the user asks "Sales by user name", use `$lookup` to join them before `$group`.

EXAMPLES:
User: "What is the total revenue by product category?"
{{
    "collection": "sales",
    "operation": "aggregate",
    "raw_pipeline": [
        {{"$group": {{"_id": "$category", "total_revenue": {{"$sum": "$amount"}}}}}},
        {{"$sort": {{"total_revenue": -1}}}}
    ]
}}

User: "How many active users do we have?"
{{
    "collection": "users",
    "operation": "count",
    "raw_pipeline": [
        {{"$match": {{"status": "active"}}}}
    ]
}}

Output valid JSON exactly matching this structure (no markdown wrapper, just raw JSON):
{{
    "collection": "{collection_name}",
    "operation": "aggregate", 
    "raw_pipeline": [] 
}}
"""
        if not self.client:
            raise ValueError("LLM API key is not configured in .env.backend.")

        res = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_question}
            ],
            temperature=0.0
        )
        content = res.choices[0].message.content.strip()
        if content.startswith("```json"):
            content = content[7:-3]
        elif content.startswith("```"):
            content = content[3:-3]
        try:
            return json.loads(content), detected_lang
        except json.JSONDecodeError:
            raise ValueError("Failed to parse LLM's query generation. The response was not valid JSON.")

    async def generate_explanation(self, user_question: str, metrics: dict, trend: str, data_glimpse: str, raw_pipeline: list, detected_lang: str = "english", intent: str = "analytical", schema_info: dict = None) -> str:
        """
        Generates a human-readable summary of the data insights or a social response.
        """
        system_prompt = f"""
        You are a highly intelligent Data Analyst.
        DETECTED LANGUAGE: {detected_lang}
        INTENT: {intent}
        CRITICAL RULES:
        1. If INTENT is 'conversational', respond warm and human. {f"Use this schema to explain what the database contains if relevant: {json.dumps(schema_info)}" if schema_info else ""}
        2. If INTENT is 'analytical', strictly summarize the data results.
        3. MANDATORY: MATCH THE RESPONSE LANGUAGE TO '{detected_lang}' EXACTLY. 
           - If '{detected_lang}' is 'english', DO NOT use any Hindi or Hinglish words.
           - If '{detected_lang}' is 'hinglish', use the natural mix as requested.
        4. NEVER include MongoDB code in this summary.
        5. If the user asks 'what is this' and you have schema info, describe the available fields and their purpose in '{detected_lang}'.
        """
        user_prompt = f"""
        User Question: {user_question}
        Metrics: {json.dumps(json_serializable(metrics))}
        Trend Summary: {trend}
        Data Sample (Glimpse of records):
        {data_glimpse}

        MongoDB Pipeline Used: {json.dumps(json_serializable(raw_pipeline))}
        """

        if not self.client:
            raise ValueError("LLM API key is not configured.")

        res = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3
        )
        return res.choices[0].message.content.strip()

llm_engine = LLMEngine()