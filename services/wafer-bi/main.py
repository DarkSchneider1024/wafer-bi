from fastapi import FastAPI, HTTPException, Path, Query
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

@app.get("/meta")
@app.get("/api/meta")
async def get_meta():
    df = get_df()
    return {
        "products": sorted(df["product_id"].unique().tolist()) if "product_id" in df.columns else [],
        "lots": sorted(df["lot_id"].unique().tolist()),
        "wafers": sorted(df["wafer_id"].unique().tolist()),
        "parameters": sorted(df["parameter"].unique().tolist())
    }

@app.get("/wafer-map/{lot_id}/{wafer_id}")
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

@app.get("/cdf/{lot_id}")
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

@app.get("/lot-wafers/{lot_id}")
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

@app.get(
    "/stats/{lot_id}",
    tags=["Statistics"],
    summary="取得批次的統計盒鬚圖數據",
    response_description="每片晶圓的 min/q1/median/q3/max 五數概括，以及各晶圓平均值的趨勢序列",
)
@app.get("/api/stats/{lot_id}", include_in_schema=False)
async def get_lot_stats(
    lot_id: str = Path(..., description="批次編號", examples=["Lot1"]),
    parameter: str = Query(
        "Thickness",
        description="要統計的測試參數名稱，對應資料表裡的 parameter 欄位",
        examples=["Thickness", "Resistance"],
    ),
):
    """
    依批次 (Lot) 與參數 (Parameter) 計算每片晶圓的五數概括統計 (Five-Number Summary)，
    是箱型圖 (Box Plot) 與趨勢圖的資料來源。

    計算方式：先篩選出屬於這個批次、這個參數的所有量測值，
    再依 `wafer_id` 分組，對每片晶圓的數值算出 min / Q1(25百分位) / median / Q3(75百分位) / max，
    並取平均值當作跨晶圓比較的趨勢指標。

    找不到符合條件的資料時回傳 404。
    """
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

@app.get("/report")
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

@app.get("/regression/{lot_id}")
@app.get("/api/regression/{lot_id}")
async def get_regression(lot_id: str, parameter: str = "Thickness"):
    df = get_df()
    lot_df = df[(df["lot_id"] == lot_id) & (df["parameter"] == parameter)]
    
    if lot_df.empty:
        raise HTTPException(status_code=404, detail="Data not found")
        
    # Get mean per wafer
    wafer_means = lot_df.groupby("wafer_id")["value"].mean().reset_index()
    wafer_means = wafer_means.sort_values("wafer_id")
    
    # Calculate linear regression
    y = wafer_means["value"].values
    x = np.arange(len(y))
    
    slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
    
    # Generate regression line points
    regression_line = (slope * x + intercept).tolist()
    
    return {
        "lot_id": lot_id,
        "parameter": parameter,
        "wafer_ids": wafer_means["wafer_id"].tolist(),
        "means": y.tolist(),
        "regression_line": regression_line,
        "slope": float(slope),
        "intercept": float(intercept),
        "r_squared": float(r_value ** 2) if not np.isnan(r_value) else 0.0,
        "p_value": float(p_value) if not np.isnan(p_value) else 1.0,
        "std_err": float(std_err) if not np.isnan(std_err) else 0.0,
        "formula": f"y = {slope:.6f}x + {intercept:.4f}"
    }

@app.get("/yield/lots")
@app.get("/api/yield/lots")
async def get_lot_yields(product_id: str = None):
    df = get_df()
    if product_id:
        df = df[df["product_id"] == product_id]
    
    # Aggregating yield by lot
    # Each wafer in each parameter has a yield, we take the average per lot
    lot_yields = df.groupby("lot_id").agg({
        "yield": "mean",
        "product_id": "first"
    }).reset_index()
    
    lot_yields = lot_yields.sort_values(by="lot_id", ascending=False).head(25)
    
    return lot_yields.to_dict(orient="records")

@app.get("/yield/wafers/{lot_id}")
@app.get("/api/yield/wafers/{lot_id}")
async def get_wafer_yields(lot_id: str):
    df = get_df()
    lot_df = df[df["lot_id"] == lot_id]
    
    if lot_df.empty:
        raise HTTPException(status_code=404, detail="Lot not found")
        
    # Get yield per wafer (first parameter's yield is enough since it's per wafer)
    wafer_yields = lot_df.groupby("wafer_id").agg({
        "yield": "mean",
        "parameter": "first"
    }).reset_index()
    
    return wafer_yields.to_dict(orient="records")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
