import requests
import json

BASE_URL = "http:

def test_query():
    payload = {
        "query": "what is this database",
        "collection_name": "upload_sample_data"
    }
    print(f"Sending query: {payload['query']}...")
    try:
        response = requests.post(f"{BASE_URL}/query", json=payload)
        if response.status_code == 200:
            result = response.json()
            print("\n✅ Query Successful!")
            print(f"Detected Lang: {result['detected_lang']}")
            print(f"Insight Summary: {result['insight_summary']}")
            if "order" in result['insight_summary'].lower() or "product" in result['insight_summary'].lower():
                print("✨ SUCCESS: AI correctly analyzed the data context!")
            else:
                print("⚠️ WARNING: AI response still seems generic. Check logic.")
        else:
            print(f"❌ Query failed with status {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Error during test: {e}")

if __name__ == "__main__":
    test_query()