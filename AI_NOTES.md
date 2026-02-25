# AI Notes

Documentation of the AI-Human collaboration for this project.

## 🤖 What AI Was Used For
- **Entity Extraction**: Core logic using Llama 3.3 on Groq to parse complex sentences into nodes and edges.
- **Contextual Reasoning**: Identifying non-obvious relationships (e.g., connecting a CEO to a Location based on a Clause).
- **Code Generation**: Scaffolding the FastAPI backend, React components, and the extensive `test_intensive.py` suite.
- **Refactoring**: Converting synchronous LLM calls into async-safe operations using thread-pool execution.

## 🧠 What I Checked Manually
- **Deduplication Logic**: Designed the regex and prefix-stripping rules (Mr, Dr, The) to ensure "Elon Musk" doesn't appear thrice.
- **Database Integrity**: Verified PostgreSQL foreign key constraints and cascade deletes to prevent hanging entities.
- **UI Polishing**: Fine-tuned CSS alignments, glassmorphism effects, and chart responsiveness.
- **API Contracts**: Manually validated JSON schemas and error handling for file uploads.
- **Docker Orchestration**: Configured networking and environment variable passing between services.
