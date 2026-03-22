import requests

url = "https://sslecal2.investing.com/api/financialdata/calendar"
headers = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json"
}

resp = requests.get(url, headers=headers)
print("Status:", resp.status_code)
if resp.status_code == 200:
    data = resp.json()
    print("Keys:", data.keys() if isinstance(data, dict) else type(data))
    if isinstance(data, dict) and "data" in data:
        print("Data[0]:", data["data"][0] if data["data"] else "Empty")
    elif isinstance(data, list):
        print("Data[0]:", data[0] if data else "Empty")
