from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from deltalake import DeltaTable
import pandas as pd
import numpy as np
from scipy import stats

app = FastAPI(title="Wafer BI API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DELTA_PATH = "./wafer_delta_table"

def get_df():
    try:
        dt = DeltaTable(DELTA_PATH)
        return dt.to_pandas()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read Delta table: {str(e)}")

@app.get("/api/meta")
async def get_meta():
    df = get_df()
    return {
        "lots": sorted(df["lot_id"].unique().tolist()),
        "wafers": sorted(df["wafer_id"].unique().tolist()),
        "parameters": sorted(df["parameter"].unique().tolist())
    }

@app.get("/api/wafer-map/{lot_id}/{wafer_id}")
async def get_wafer_map(lot_id: str, wafer_id: str, parameter: str = "Thickness"):
    df = get_df()
    wafer_df = df[(df["lot_id"] == lot_id) & (df["wafer_id"] == wafer_id) & (df["parameter"] == parameter)]
    
    if wafer_df.empty:
        raise HTTPException(status_code=404, detail="Data not found")
        
    data = wafer_df[["x", "y", "value"]].values.tolist()
    
    return {
        "lot_id": lot_id,
        "wafer_id": wafer_id,
        "parameter": parameter,
        "data": data,
        "min": float(wafer_df["value"].min()),
        "max": float(wafer_df["value"].max())
    }

@app.get("/api/cdf/{lot_id}")
async def get_cdf(lot_id: str, parameter: str = "Thickness"):
    df = get_df()
    lot_df = df[(df["lot_id"] == lot_id) & (df["parameter"] == parameter)]
    
    if lot_df.empty:
        raise HTTPException(status_code=404, detail="Data not found")
    
    values = lot_df["value"].sort_values().values
    
    # Sample points for CDF
    if len(values) > 500:
        indices = np.linspace(0, len(values) - 1, 200).astype(int)
        x_sampled = values[indices]
        y_sampled = np.linspace(0, 1, len(indices))
    else:
        x_sampled = values
        y_sampled = np.linspace(0, 1, len(values))

    return {
        "lot_id": lot_id,
        "parameter": parameter,
        "points": [{"x": float(xv), "y": float(yv)} for xv, yv in zip(x_sampled, y_sampled)]
    }

@app.get("/api/lot-wafers/{lot_id}")
async def get_lot_wafers(lot_id: str, parameter: str = "Thickness"):
    df = get_df()
    lot_df = df[(df["lot_id"] == lot_id) & (df["parameter"] == parameter)]
    
    if lot_df.empty:
        raise HTTPException(status_code=404, detail="Data not found")
        
    result = {}
    for wafer_id in sorted(lot_df["wafer_id"].unique()):
        wafer_data = lot_df[lot_df["wafer_id"] == wafer_id]
        
        # Sample points for thumbnail (every 4th point to keep it fast)
        sampled = wafer_data.iloc[::4]
        
        result[wafer_id] = {
            "avg": float(wafer_data["value"].mean()),
            "std": float(wafer_data["value"].std()),
            "min": float(wafer_data["value"].min()),
            "max": float(wafer_data["value"].max()),
            "data": [[int(x), int(y), float(v)] for x, y, v in zip(sampled["x"], sampled["y"], sampled["value"])]
        }
    
    return result

@app.get("/api/stats/{lot_id}")
async def get_lot_stats(lot_id: str, parameter: str = "Thickness"):
    df = get_df()
    lot_df = df[(df["lot_id"] == lot_id) & (df["parameter"] == parameter)]
    
    if lot_df.empty:
        raise HTTPException(status_code=404, detail="Data not found")
        
    stats = lot_df.groupby("wafer_id")["value"].agg([
        "min", 
        lambda x: np.percentile(x, 25), 
        "median", 
        lambda x: np.percentile(x, 75), 
        "max",
        "mean"
    ]).reset_index()
    
    stats.columns = ["wafer_id", "min", "q1", "median", "q3", "max", "mean"]
    stats = stats.sort_values("wafer_id")
    
    return {
        "lot_id": lot_id,
        "parameter": parameter,
        "wafer_ids": stats["wafer_id"].tolist(),
        "boxplot": stats[["min", "q1", "median", "q3", "max"]].values.tolist(),
        "trend": stats["mean"].tolist()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
