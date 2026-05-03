-- Manager quotes table with vector embeddings
CREATE TABLE manager_quotes (
    id SERIAL PRIMARY KEY,
    quote TEXT NOT NULL,
    manager_name VARCHAR(255) NOT NULL,
    context TEXT,  -- Optional: when/where said (e.g., "Press conference, 1999")
    embedding jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_manager_quotes_name ON manager_quotes(manager_name);
