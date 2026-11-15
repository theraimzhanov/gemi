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

CREATE TABLE IF NOT EXISTS users (
  id            bigserial PRIMARY KEY,
  username      text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Only a hash of the session token is stored, so a database leak cannot be replayed as a login.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

ALTER TABLE look_events ADD COLUMN IF NOT EXISTS user_id bigint;

-- Login is by email; the username is the public name shown on shared looks. Demo accounts have no email.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);

-- Every generated look is saved for its owner; only shared ones appear in the community feed.
ALTER TABLE looks ADD COLUMN IF NOT EXISTS user_id bigint REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE looks ADD COLUMN IF NOT EXISTS shared boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS looks_user_idx ON looks (user_id, created_at DESC);

-- One row per generation request. The server sets it to done or failed; the page watches it.
CREATE TABLE IF NOT EXISTS jobs (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'working' CHECK (status IN ('working', 'done', 'failed')),
  result      jsonb,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS jobs_user_created_idx ON jobs (user_id, created_at DESC);

-- What the user asked, so the chat can be rebuilt after leaving the page or closing the browser.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS request jsonb NOT NULL DEFAULT '{}';

-- A shopping search saved to run by itself on a later date (before an event, in a week, next month).
CREATE TABLE IF NOT EXISTS plans (
  id         bigserial PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request    text NOT NULL,
  budget_usd numeric,
  categories jsonb NOT NULL DEFAULT '[]',
  note       text NOT NULL DEFAULT '',
  run_at     timestamptz NOT NULL,
  status     text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'running', 'done', 'failed', 'cancelled')),
  claimed_at timestamptz,
  job_id     bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plans_due_idx ON plans (status, run_at);
