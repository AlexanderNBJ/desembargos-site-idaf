-- migrations/001_create_users.sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('GERENTE','COMUM')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
