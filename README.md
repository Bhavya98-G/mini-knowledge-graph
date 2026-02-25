# Mini Knowledge Graph

Extract entities and relationships from documents using LLMs and visualize them as interactive 2D graphs.

## 🚀 How to Run

### 1. Prerequisites
- Docker & Docker Compose
- Groq API Key ([Get one here](https://console.groq.com))

### 2. Launch
```bash
# 1. Set your API Key
export GROQ_API_KEY=your_key_here

# 2. Start the services
docker-compose up --build
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000/docs

---

## ✅ What is Done
- **Async Extraction**: Scalable document processing using FastAPI + LangChain + Groq (Llama 3.3).
- **Interactive Visualization**: Smooth 2D force-directed graph with search, zoom, and highlight features.
- **Normalization**: Automatic entity deduplication (e.g., merging "Mr. Musk" and "Elon Musk").
- **Manual Merging**: UI tools to manually merge entities the LLM might miss.
- **Provenance**: Every entity and relationship links back to the original source sentence.
- **Intensive QA**: 1500+ line test suite covering concurrency, limits, and graph integrity.
- **Premium UI**: Glassmorphism design, dynamic loading screens, and responsive side panels.

## 🚧 What is Not Done
- **Vector Search**: No semantic search or embedding-based deduplication yet.
- **Advanced Querying**: Currently limited to visual exploration; no Cypher/SPARQL support.
- **Real-time Sync**: No WebSocket support for live multi-user editing.
- **Export Formats**: Lacks export to RDF, JSON-LD, or Neo4j.
- **Large Scales**: Optimized for small-to-medium datasets; needs partitioning for massive graphs.
