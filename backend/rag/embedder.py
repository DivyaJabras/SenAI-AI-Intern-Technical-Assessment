from sentence_transformers import SentenceTransformer

# Load the model globally so it's only loaded into memory once at startup.
# all-MiniLM-L6-v2 produces 384-dimensional embeddings and runs efficiently on CPU.
model = SentenceTransformer('all-MiniLM-L6-v2')

def get_embedding(text: str) -> list[float]:
    """
    Takes a string and returns a 384-dimensional float array representing its embedding.
    """
    # model.encode returns a numpy array, we convert to a Python list
    return model.encode(text).tolist()
