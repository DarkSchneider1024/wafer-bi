import chromadb
from chromadb.utils import embedding_functions
import os
import pandas as pd
from deltalake import DeltaTable
from dotenv import load_dotenv

load_dotenv()

class ChromaManager:
    def __init__(self, persist_directory="./chroma_db"):
        self.client = chromadb.PersistentClient(path=persist_directory)
        
        # Using Gemini embedding function
        self.gemini_ef = embedding_functions.GoogleGenerativeAiEmbeddingFunction(
            api_key=os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY"),
            model_name="models/embedding-001"
        )
        self.collection = self.client.get_or_create_collection(
            name="wafer_status_gemini",
            embedding_function=self.gemini_ef
        )

    def ingest_from_delta(self, delta_path):
        """Read data from Delta table and ingest into ChromaDB"""
        if not os.path.exists(delta_path):
            print(f"Delta path {delta_path} does not exist.")
            return

        dt = DeltaTable(delta_path)
        df = dt.to_pandas()

        # Group by wafer to create status summaries
        # Example: "Wafer W01 in Lot L01 has an average Thickness of 10.5 with std dev 0.2"
        wafers = df.groupby(['lot_id', 'wafer_id', 'parameter']).agg({
            'value': ['mean', 'std', 'min', 'max']
        }).reset_index()

        documents = []
        metadatas = []
        ids = []

        for _, row in wafers.iterrows():
            lot_id = row['lot_id'][0] if isinstance(row['lot_id'], tuple) else row['lot_id']
            wafer_id = row['wafer_id'][0] if isinstance(row['wafer_id'], tuple) else row['wafer_id']
            param = row['parameter'][0] if isinstance(row['parameter'], tuple) else row['parameter']
            
            mean_val = row[('value', 'mean')]
            std_val = row[('value', 'std')]
            
            doc = f"Wafer {wafer_id} in Lot {lot_id} status for {param}: Average is {mean_val:.4f}, Standard Deviation is {std_val:.4f}."
            
            documents.append(doc)
            metadatas.append({
                "lot_id": str(lot_id),
                "wafer_id": str(wafer_id),
                "parameter": str(param),
                "mean": float(mean_val),
                "std": float(std_val)
            })
            ids.append(f"{lot_id}_{wafer_id}_{param}")

        if documents:
            self.collection.upsert(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            print(f"Ingested {len(documents)} records into ChromaDB.")

    def query_wafer(self, query_text, n_results=3):
        results = self.collection.query(
            query_texts=[query_text],
            n_results=n_results
        )
        return results

if __name__ == "__main__":
    # Test ingestion
    manager = ChromaManager()
    # Path relative to the service or absolute
    DELTA_PATH = "../../services/wafer-bi/wafer_delta_table"
    manager.ingest_from_delta(DELTA_PATH)
