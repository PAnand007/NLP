# NLP Backend - FastAPI Engine

The backend of the NLP project is a high-performance FastAPI server that handles natural language processing, MongoDB interaction, and data analysis.

## 🔧 Core Components

- **FastAPI**: Handles API routing and middleware.
- **LLM Context Engine**: Translates natural language prompts into MongoDB queries.
- **Pandas Analysis**: Processes query results to provide statistical summaries.
- **PyMongo**: Interfaces directly with MongoDB.

## 🚀 Setup

1. **Environment Config**:
   Create a `.env.backend` file with:
   ```env
   OPENAI_API_KEY=your_openai_api_key
   MONGO_DEFAULT_URI=mongodb://localhost:27017
   ```

2. **Run Server**:
   ```bash
   pip install -r requirements.txt
   python main.py
   ```

## 📡 Endpoints

- `POST /query`: Processes a natural language string and returns data + insights.
- `POST /upload`: Ingests JSON data for immediate analysis.
- `GET /stats`: Returns overall database statistics.
