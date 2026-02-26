import requests
import json

BASE_URL = "http:

def test_translation():
    inputs = [
        "What is the total revenue?",
        "Top sales by category",
        "Hello, how are you?"
    ]
    for text in inputs:
        print(f"Translating: '{text}'...")
        try:
            response = requests.post(f"{BASE_URL}/translate", json={"text": text})
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Result: {result['translated_text']}")
            else:
                print(f"❌ Failed with status {response.status_code}")
                print(response.text)
        except Exception as e:
            print(f"❌ Error: {e}")
        print("-" * 20)

if __name__ == "__main__":
    test_translation()