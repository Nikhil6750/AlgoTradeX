import requests
import json
import pandas as pd
import numpy as np

# load one of the CSV datasets
df = pd.read_csv("/Users/prashanthkumar/Projects/TradingBot/backend/datasets/c4e5f6a8-044c-4884-84c6-d58cf4e999a3.csv")
df.columns = [str(c).lower().strip() for c in df.columns]

if "timestamp" in df.columns:
    df.rename(columns={"timestamp": "time"}, inplace=True)
if "date" in df.columns:
    df.rename(columns={"date": "time"}, inplace=True)
if "datetime" in df.columns:
    df.rename(columns={"datetime": "time"}, inplace=True)

df = df.replace({np.nan: None})
candles = df.to_dict(orient="records")

payload = {
    "symbol": "custom",
    "timeframe": "1m",
    "config": {"mode": "template", "strategy": "ma_crossover", "parameters": {"fast_period": 10, "slow_period": 30}},
    "candles": candles
}
resp = requests.post("http://localhost:8000/run-backtest", json=payload)
print(resp.status_code)
print(resp.text)
