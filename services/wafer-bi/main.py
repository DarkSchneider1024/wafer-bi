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

# --- OpenTelemetry Instrumentation ---
import os
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

# Set service name
resource = Resource(attributes={
    "service.name": "wafer-bi-service"
})

provider = TracerProvider(resource=resource)
processor = BatchSpanProcessor(OTLPSpanExporter(
    endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector-service.k8sdemo.svc.cluster.local:4317"),
    insecure=True
))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

FastAPIInstrumentor.instrument_app(app)
# -------------------------------------

DELTA_PATH = "/app/wafer_delta_table"

def ensure_data():
    import os
    if not os.path.exists(DELTA_PATH):
        print("Delta table not found. Generating sample data...")
        import data_generator
        data_generator.main()

def get_df():
    ensure_data()
    try:
        dt = DeltaTable(DELTA_PATH)
        return dt.to_pandas()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read Delta table: {str(e)}")

@app.get("/api/meta")
async def get_meta():
    df = get_df()
    return {
        "products": sorted(df["product_id"].unique().tolist()) if "product_id" in df.columns else [],
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
        
        # Use all points for thumbnails
        sampled = wafer_data
        
        result[wafer_id] = {
            "avg": float(wafer_data["value"].mean()),
            "std": float(wafer_data["value"].std()),
            "min": float(wafer_data["value"].min()),
            "max": float(wafer_data["value"].max()),
            "data": [[float(x), float(y), float(v)] for x, y, v in zip(sampled["x"], sampled["y"], sampled["value"])]
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

@app.get("/api/report")
async def get_report(
    page: int = 1, 
    limit: int = 100, 
    product_id: str = None,
    lot_id: str = None, 
    wafer_id: str = None,
    sort_by: str = "wafer_id",
    sort_order: str = "asc"
):
    df = get_df()
    
    # Filtering
    if product_id:
        df = df[df["product_id"] == product_id]
    if lot_id:
        df = df[df["lot_id"] == lot_id]
    if wafer_id:
        df = df[df["wafer_id"] == wafer_id]
        
    # Sorting
    if sort_by in df.columns:
        df = df.sort_values(by=sort_by, ascending=(sort_order == "asc"))
        
    total = len(df)
    start = (page - 1) * limit
    end = start + limit
    
    # Selection of columns to return
    cols = ["lot_id", "wafer_id", "parameter", "x", "y", "value"]
    if "product_id" in df.columns:
        cols.insert(0, "product_id")
        
    report_df = df.iloc[start:end][cols]
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "data": report_df.to_dict(orient="records")
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
