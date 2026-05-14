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
    def __init__(self, api_key: str, model_name: str = "models/text-embedding-004"):
        if not api_key:
            raise ValueError("GEMINI_API_KEY is required for embeddings")
        # Configure genai once
        genai.configure(api_key=api_key)
        self._model_name = model_name

    def __call__(self, input: Documents) -> Embeddings:
        # Call Google's API directly
        try:
            response = genai.embed_content(
                model=self._model_name,
                content=input,
                task_type="retrieval_document",
            )
            return response["embedding"]
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
            model_name="models/text-embedding-004"
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

        try:
            dt = DeltaTable(delta_path)
            df = dt.to_pandas()

            # Group by wafer to create status summaries
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
