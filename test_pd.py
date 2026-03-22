import pandas as pd
df = pd.DataFrame({"time": [1700000000, "1700000000", "2024-01-01 10:00:00"]})
def safe_parse_time(v):
    if pd.isna(v):
        return 0
    if isinstance(v, (int, float)):
        if v > 1e11:  
            return int(v / 1000)
        return int(v)
    try:
        val = float(v)
        if val > 1e11:
            return int(val / 1000)
        return int(val)
    except ValueError:
        dt = pd.to_datetime(v, errors="coerce")
        if pd.notnull(dt):
            return int(dt.timestamp())
        return 0
df["parsed_time"] = df["time"].apply(safe_parse_time)
print(df)
