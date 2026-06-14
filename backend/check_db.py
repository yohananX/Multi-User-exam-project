import os
from dotenv import load_dotenv
load_dotenv()

import httpx

url = f"{os.getenv('SUPABASE_URL')}/rest/v1/subjects?limit=1"
headers = {
    "apikey": os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
    "Authorization": f"Bearer {os.getenv('SUPABASE_SERVICE_ROLE_KEY')}"
}

r = httpx.get(url, headers=headers)
print("Status Code:", r.status_code)
if r.status_code == 200:
    data = r.json()
    if data:
        print("Columns:", list(data[0].keys()))
        print("Sample data:", data[0])
    else:
        print("No data in subjects table.")
else:
    print("Error:", r.text)
