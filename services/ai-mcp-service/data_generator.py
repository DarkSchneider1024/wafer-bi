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
    
    valid_indices = np.where(mask)
    df = pd.DataFrame({
        "product_id": product_id,
        "lot_id": lot_id,
        "wafer_id": wafer_id,
        "parameter": param_name,
        "x": valid_indices[1] + 1,
        "y": valid_indices[0] + 1,
        "value": data[valid_indices]
    })
    
    return df

def main():
    all_data = []
    products = ["PRD-001", "PRD-002"]
    lots = ["Lot1", "Lot2", "Lot3", "Lot4"]
    parameters = ["Thickness", "Resistance"]
    wafers_per_lot = 25
    
    print("Generating multi-parameter data with Product IDs for AI Service...")
    for idx, product in enumerate(products):
        assigned_lots = lots[idx*2 : (idx+1)*2]
        for lot in assigned_lots:
            for param in parameters:
                for w_idx in range(1, wafers_per_lot + 1):
                    wafer_id = f"W{w_idx:02d}"
                    df = generate_wafer_data(product, lot, wafer_id, param)
                    all_data.append(df)
    
    full_df = pd.concat(all_data, ignore_index=True)
    
    # Ensure directory exists (or deltalake will create it)
    delta_path = "./wafer_delta_table"
    if os.environ.get("DELTA_PATH"):
        delta_path = os.environ.get("DELTA_PATH")

    print(f"Writing to Delta Lake at {delta_path}...")
    write_deltalake(delta_path, full_df, mode="overwrite")
    print("Done!")

if __name__ == "__main__":
    main()
