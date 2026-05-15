import pandas as pd
import numpy as np
from deltalake import write_deltalake
import os

def generate_wafer_data(product_id, lot_id, wafer_id, param_name, grid_size=30):
    """Generates synthetic measurement data for a single wafer and parameter."""
    x = np.arange(grid_size)
    y = np.arange(grid_size)
    xx, yy = np.meshgrid(x, y)
    
    center = (grid_size + 1) / 2
    dist = np.sqrt((xx + 1 - center)**2 + (yy + 1 - center)**2)
    radius = grid_size * 0.45
    mask = dist <= radius
    
    # Base values based on parameter
    if param_name == "Thickness":
        base_val = 100 if lot_id == "Lot1" else 105
        noise = 2
        grad = 0.5
    else:  # Resistance
        base_val = 45 if lot_id == "Lot1" else 42
        noise = 1.5
        grad = -0.3 # Different pattern
    
    data = base_val + (dist * grad) + np.random.normal(0, noise, dist.shape)
    
    # Calculate yield for this wafer (simulated based on parameter stability)
    # If the standard deviation of measurements is high, yield is lower
    param_std = np.std(data[mask])
    if param_name == "Thickness":
        # Normal thickness std is around 2, if > 2.5 yield drops
        yield_val = 100 - max(0, (param_std - 1.8) * 5) - np.random.uniform(0, 1)
    else:
        # Normal resistance std is around 1.5
        yield_val = 100 - max(0, (param_std - 1.3) * 6) - np.random.uniform(0, 1)
    
    yield_val = max(min(yield_val, 100), 85) # Clamp between 85 and 100

    valid_indices = np.where(mask)
    df = pd.DataFrame({
        "product_id": product_id,
        "lot_id": lot_id,
        "wafer_id": wafer_id,
        "parameter": param_name,
        "x": valid_indices[1] + 1,
        "y": valid_indices[0] + 1,
        "value": data[valid_indices],
        "yield": yield_val  # Add yield column
    })
    
    return df

def main():
    all_data = []
    products = ["PRD-001", "PRD-002"]
    lots = [f"Lot{i}" for i in range(1, 31)] # Generate more lots for pagination testing
    parameters = ["Thickness", "Resistance"]
    wafers_per_lot = 25
    
    print("Generating multi-parameter data with Yield for AI Service...")
    for product in products:
        # Assign 15 lots per product
        start_idx = 0 if product == "PRD-001" else 15
        assigned_lots = lots[start_idx : start_idx + 15]
        for lot in assigned_lots:
            for param in parameters:
                for w_idx in range(1, wafers_per_lot + 1):
                    wafer_id = f"W{w_idx:02d}"
                    df = generate_wafer_data(product, lot, wafer_id, param)
                    all_data.append(df)
    
    full_df = pd.concat(all_data, ignore_index=True)
    
    # Ensure directory exists
    delta_path = "./wafer_delta_table"
    if os.environ.get("DELTA_PATH"):
        delta_path = os.environ.get("DELTA_PATH")

    print(f"Writing to Delta Lake at {delta_path} with yield data...")
    write_deltalake(delta_path, full_df, mode="overwrite")
    print("Done!")

if __name__ == "__main__":
    main()
