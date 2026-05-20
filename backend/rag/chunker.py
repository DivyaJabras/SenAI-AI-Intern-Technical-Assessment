def chunk_document(text: str, chunk_size: int = 400, overlap: int = 50) -> list[str]:
    """
    Splits text by double newlines (paragraphs), then groups them into chunks.
    Targeting ~400 tokens per chunk with a 50 token overlap.
    We approximate 1 word = 1.3 tokens for simplicity and speed.
    """
    words_per_chunk = int(chunk_size / 1.3)
    words_overlap = int(overlap / 1.3)
    
    paragraphs = text.split('\n\n')
    chunks = []
    current_chunk_words = []
    
    for para in paragraphs:
        para_words = para.split()
        if not para_words:
            continue
            
        # If adding this paragraph exceeds our chunk size, and we already have words
        if len(current_chunk_words) + len(para_words) > words_per_chunk and current_chunk_words:
            chunks.append(" ".join(current_chunk_words))
            # Keep the overlap from the end of the current chunk
            current_chunk_words = current_chunk_words[-words_overlap:]
            
        current_chunk_words.extend(para_words)
        
        # If a single paragraph is larger than the chunk size, we need to hard split it
        while len(current_chunk_words) > words_per_chunk:
            chunks.append(" ".join(current_chunk_words[:words_per_chunk]))
            current_chunk_words = current_chunk_words[words_per_chunk - words_overlap:]
            
    if current_chunk_words:
        chunks.append(" ".join(current_chunk_words))
        
    return chunks
