CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS looks (
  id         bigserial PRIMARY KEY,
  author     text NOT NULL,
  image      bytea NOT NULL,
  image_mime text NOT NULL,
  garments   jsonb NOT NULL,
  total_usd  numeric NOT NULL,
  embedding  vector(768),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS looks_embedding_idx ON looks USING hnsw (embedding vector_cosine_ops);

-- Reference pictures (outfit photo or product photos) that let anyone re-create the look.
CREATE TABLE IF NOT EXISTS garment_refs (
  id      bigserial PRIMARY KEY,
  look_id bigint NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
  image   bytea NOT NULL,
  mime    text NOT NULL
);

CREATE TABLE IF NOT EXISTS look_events (
  time    timestamptz NOT NULL DEFAULT now(),
  look_id bigint NOT NULL,
  kind    text NOT NULL CHECK (kind IN ('like', 'tryon'))
);
SELECT create_hypertable('look_events', 'time', if_not_exists => true);
CREATE INDEX IF NOT EXISTS look_events_look_idx ON look_events (look_id, time DESC);
