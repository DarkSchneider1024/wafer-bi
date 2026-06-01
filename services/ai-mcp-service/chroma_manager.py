import chromadb
import os
import pandas as pd
from deltalake import DeltaTable
from dotenv import load_dotenv
import google.generativeai as genai
from chromadb.api.types import Documents, Embeddings, EmbeddingFunction

load_dotenv()

class GeminiEmbeddingFunction(EmbeddingFunction):
    """Custom Embedding Function for Gemini to avoid chromadb SDK bugs"""
    def __init__(self, api_key: str, model_name: str = "models/gemini-embedding-001"):
        if not api_key:
            raise ValueError("GEMINI_API_KEY is required for embeddings")
        # Configure genai once
        genai.configure(api_key=api_key)
        self._model_name = model_name

    def __call__(self, input: Documents) -> Embeddings:
        import time
        # Chunk input into batches of 100 to avoid API payload/batch size limits
        batch_size = 100
        all_embeddings = []
        try:
            for i in range(0, len(input), batch_size):
                batch = input[i:i + batch_size]
                if i > 0:
                    time.sleep(0.5)  # Avoid rate limits (e.g. 429 Too Many Requests)
                response = genai.embed_content(
                    model=self._model_name,
                    content=batch,
                    task_type="retrieval_document",
                )
                all_embeddings.extend(response["embedding"])
            return all_embeddings
        except Exception as e:
            print(f"Embedding error: {e}")
            # Return zero embeddings as fallback or re-raise
            raise e

class ChromaManager:
    def __init__(self, persist_directory="./chroma_db"):
        self.client = chromadb.PersistentClient(path=persist_directory)
        
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
        
        # Using our custom Gemini embedding function
        self.gemini_ef = GeminiEmbeddingFunction(
            api_key=api_key,
            model_name="models/gemini-embedding-001"
        )
        
        self.collection = self.client.get_or_create_collection(
            name="wafer_status_gemini_v2",
            embedding_function=self.gemini_ef
        )

    def ingest_from_delta(self, delta_path):
        """Read data from Delta table and ingest into ChromaDB"""
        if not os.path.exists(delta_path):
            print(f"Delta path {delta_path} does not exist.")
            return

        try:
            dt = DeltaTable(delta_path)
            df = dt.to_pandas()

            # Check if product_id is in dataframe, if not add a dummy
            if 'product_id' not in df.columns:
                df['product_id'] = 'Unknown'
            
            # Check if yield is in dataframe, if not add a dummy
            if 'yield' not in df.columns:
                df['yield'] = 100.0

            # Group by wafer to create status summaries
            wafers = df.groupby(['product_id', 'lot_id', 'wafer_id', 'parameter']).agg({
                'value': ['mean', 'std', 'min', 'max'],
                'yield': 'first'
            }).reset_index()

            documents = []
            metadatas = []
            ids = []

            # 1. Create Lot-level summary chunks
            lots = df.groupby(['product_id', 'lot_id', 'parameter']).agg({
                'value': ['mean', 'std'],
                'yield': 'mean'
            }).reset_index()
            
            for _, row in lots.iterrows():
                product_id = row['product_id'][0] if isinstance(row['product_id'], tuple) else row['product_id']
                lot_id = row['lot_id'][0] if isinstance(row['lot_id'], tuple) else row['lot_id']
                param = row['parameter'][0] if isinstance(row['parameter'], tuple) else row['parameter']
                
                mean_val = row[('value', 'mean')]
                std_val = row[('value', 'std')]
                yield_val = row[('yield', 'mean')]
                
                doc = f"Lot Summary: Lot {lot_id} (Product {product_id}) status for {param}. Overall Average is {mean_val:.4f}, Std Dev is {std_val:.4f}, Average Yield is {yield_val:.2f}%."
                documents.append(doc)
                metadatas.append({
                    "type": "lot_summary",
                    "product_id": str(product_id),
                    "lot_id": str(lot_id),
                    "parameter": str(param)
                })
                ids.append(f"lot_{lot_id}_{param}")

            # 2. Create Wafer-level chunks
            for _, row in wafers.iterrows():
                product_id = row['product_id'][0] if isinstance(row['product_id'], tuple) else row['product_id']
                lot_id = row['lot_id'][0] if isinstance(row['lot_id'], tuple) else row['lot_id']
                wafer_id = row['wafer_id'][0] if isinstance(row['wafer_id'], tuple) else row['wafer_id']
                param = row['parameter'][0] if isinstance(row['parameter'], tuple) else row['parameter']
                
                mean_val = row[('value', 'mean')]
                std_val = row[('value', 'std')]
                min_val = row[('value', 'min')]
                max_val = row[('value', 'max')]
                yield_val = row[('yield', 'first')]
                
                # Check for anomalies (e.g. Scratches might be indicated by high std dev or extreme max/min)
                anomaly_note = ""
                if std_val > 2.0 or yield_val < 90.0:
                    anomaly_note = " Note: Potential anomaly or scratches detected due to high variance or low yield."
                
                doc = f"Wafer Detail: Wafer {wafer_id} in Lot {lot_id} (Product {product_id}) status for {param}. Average is {mean_val:.4f}, Std Dev is {std_val:.4f}, Min is {min_val:.4f}, Max is {max_val:.4f}, Yield is {yield_val:.2f}%.{anomaly_note}"
                
                documents.append(doc)
                metadatas.append({
                    "type": "wafer_detail",
                    "product_id": str(product_id),
                    "lot_id": str(lot_id),
                    "wafer_id": str(wafer_id),
                    "parameter": str(param),
                    "mean": float(mean_val),
                    "std": float(std_val),
                    "yield": float(yield_val)
                })
                ids.append(f"wafer_{lot_id}_{wafer_id}_{param}")

            if documents:
                self.collection.upsert(
                    documents=documents,
                    metadatas=metadatas,
                    ids=ids
                )
                print(f"Ingested {len(documents)} records into ChromaDB.")
        except Exception as e:
            print(f"Ingestion failed: {e}")

    def query_wafer(self, query_text, n_results=3):
        results = self.collection.query(
            query_texts=[query_text],
            n_results=n_results
        )
        return results

if __name__ == "__main__":
    # Test ingestion
    manager = ChromaManager()
    DELTA_PATH = "../../services/wafer-bi/wafer_delta_table"
    manager.ingest_from_delta(DELTA_PATH)
