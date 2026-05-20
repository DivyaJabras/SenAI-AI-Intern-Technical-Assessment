# SenAI CRM Architecture Diagram

```mermaid
flowchart TD
    %% External Inputs
    EmailFile[Email JSON File] -->|Reads| StreamingSim[Streaming Simulator]
    StreamingSim -->|POST /api/ingest| IngestionAPI[API: Ingestion Layer]

    %% Ingestion & Pre-processing
    subgraph FastAPI Backend
        IngestionAPI --> HeuristicFilter[Heuristic Pre-filter]
        HeuristicFilter --> PriorityQueue[Priority Queue / Background Task]
        
        %% Intelligence Core
        PriorityQueue --> LLMClass[LLM Classification Engine]
        
        %% RAG Integration
        KnowledgeBase[(pgvector: Knowledge Chunks)] -.->|RAG Context Injection| LLMClass
        
        %% Agent Loop
        LLMClass --> AgentLoop[Agent Loop (ReAct)]
        AgentLoop -->|Uses Tools| Tools[Agent Tools]
        Tools -.->|Queries/Updates| DB[(PostgreSQL Database)]
        
        %% Web Intelligence Branch
        AgentLoop -->|Triggers async| WebScraper[Web Intelligence Scraper]
        WebScraper -.->|Fetches Trustpilot/G2| PublicWeb((Public Web))
        WebScraper -->|Caches results| DB
    end

    %% Database Layer
    DB --> RESTAPI[REST API Layer]
    
    %% Audit Write Paths
    IngestionAPI -.->|Writes| AuditLog[(Audit Log)]
    AgentLoop -.->|Writes| AuditLog
    RESTAPI -.->|Writes| AuditLog

    %% Frontend UI
    RESTAPI <--> Frontend[React Frontend Dashboard]
```
