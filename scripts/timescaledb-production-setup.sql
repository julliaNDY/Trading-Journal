-- =============================================================================
-- TimescaleDB Production Setup
-- Story 1.6: TimescaleDB Production Migration
-- =============================================================================
-- 
-- This script sets up the production TimescaleDB schema with:
-- - Hypertable for tick_data (1-day chunks)
-- - Compression policy (30 days)
-- - Retention policy (90 days)
-- - Continuous aggregates for 1m, 5m, 15m, 1h candles
-- - Optimized indexes
--
-- Run this script on your TimescaleDB instance AFTER creating the database.
-- Prerequisites:
--   1. TimescaleDB extension installed (comes pre-installed on Timescale Cloud)
--   2. Database created
--   3. Connected as superuser or database owner
--
-- Usage:
--   psql -h <host> -p <port> -U <user> -d <database> -f scripts/timescaledb-production-setup.sql
-- =============================================================================

-- Ensure TimescaleDB extension is enabled
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Show TimescaleDB version for verification
SELECT extversion AS timescaledb_version FROM pg_extension WHERE extname = 'timescaledb';

-- =============================================================================
-- STEP 1: Create Hypertable (AC: 2)
-- =============================================================================

-- Drop existing table if migrating (BE CAREFUL - this will delete data!)
-- Uncomment only if you're sure:
-- DROP TABLE IF EXISTS tick_data CASCADE;

-- Create the tick_data table
CREATE TABLE IF NOT EXISTS tick_data (
  time TIMESTAMPTZ NOT NULL,
  symbol TEXT NOT NULL,
  bid_price DECIMAL(20, 8),
  ask_price DECIMAL(20, 8),
  last_price DECIMAL(20, 8),
  volume BIGINT,
  source TEXT,
  trade_id UUID,
  account_id UUID
);

-- Convert to hypertable with 1-day chunks
-- This is the core TimescaleDB optimization
SELECT create_hypertable('tick_data', 'time', 
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- =============================================================================
-- STEP 2: Add Indexes (AC: 2)
-- =============================================================================

-- Primary index for time-based queries (already created by hypertable)
-- Additional indexes for common query patterns:

-- Index for symbol + time queries (most common for replay)
CREATE INDEX IF NOT EXISTS tick_data_symbol_time_idx 
  ON tick_data (symbol, time DESC);

-- Index for account-specific queries
CREATE INDEX IF NOT EXISTS tick_data_account_time_idx 
  ON tick_data (account_id, time DESC) 
  WHERE account_id IS NOT NULL;

-- BRIN index for large range scans (very space-efficient)
CREATE INDEX IF NOT EXISTS tick_data_time_brin_idx 
  ON tick_data USING BRIN (time);

-- =============================================================================
-- STEP 3: Enable Compression (AC: 3)
-- =============================================================================

-- Configure compression settings
-- Segment by symbol (each symbol compressed separately)
-- Order by time DESC (most recent first for decompression)
ALTER TABLE tick_data SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol',
  timescaledb.compress_orderby = 'time DESC'
);

-- Add compression policy: compress chunks older than 30 days
SELECT add_compression_policy('tick_data', INTERVAL '30 days', if_not_exists => TRUE);

-- Verify compression settings
SELECT * FROM timescaledb_information.compression_settings 
WHERE hypertable_name = 'tick_data';

-- =============================================================================
-- STEP 4: Configure Retention Policy (AC: 5)
-- =============================================================================

-- Add retention policy: drop chunks older than 90 days
-- Note: This deletes old data permanently! Adjust as needed.
SELECT add_retention_policy('tick_data', INTERVAL '90 days', if_not_exists => TRUE);

-- Verify retention policy
SELECT * FROM timescaledb_information.jobs 
WHERE proc_name = 'policy_retention';

-- =============================================================================
-- STEP 5: Create Continuous Aggregates (AC: 4)
-- =============================================================================

-- 1-Minute Candles
CREATE MATERIALIZED VIEW IF NOT EXISTS candle_1m
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 minute', time) AS bucket,
  symbol,
  FIRST(last_price, time) AS open,
  MAX(last_price) AS high,
  MIN(last_price) AS low,
  LAST(last_price, time) AS close,
  SUM(volume) AS volume,
  COUNT(*) AS tick_count
FROM tick_data
GROUP BY bucket, symbol
WITH NO DATA;

-- Refresh policy for 1m candles
SELECT add_continuous_aggregate_policy('candle_1m',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute',
  if_not_exists => TRUE
);

-- 5-Minute Candles
CREATE MATERIALIZED VIEW IF NOT EXISTS candle_5m
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('5 minutes', time) AS bucket,
  symbol,
  FIRST(last_price, time) AS open,
  MAX(last_price) AS high,
  MIN(last_price) AS low,
  LAST(last_price, time) AS close,
  SUM(volume) AS volume,
  COUNT(*) AS tick_count
FROM tick_data
GROUP BY bucket, symbol
WITH NO DATA;

-- Refresh policy for 5m candles
SELECT add_continuous_aggregate_policy('candle_5m',
  start_offset => INTERVAL '6 hours',
  end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes',
  if_not_exists => TRUE
);

-- 15-Minute Candles
CREATE MATERIALIZED VIEW IF NOT EXISTS candle_15m
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('15 minutes', time) AS bucket,
  symbol,
  FIRST(last_price, time) AS open,
  MAX(last_price) AS high,
  MIN(last_price) AS low,
  LAST(last_price, time) AS close,
  SUM(volume) AS volume,
  COUNT(*) AS tick_count
FROM tick_data
GROUP BY bucket, symbol
WITH NO DATA;

-- Refresh policy for 15m candles
SELECT add_continuous_aggregate_policy('candle_15m',
  start_offset => INTERVAL '1 day',
  end_offset => INTERVAL '15 minutes',
  schedule_interval => INTERVAL '15 minutes',
  if_not_exists => TRUE
);

-- 1-Hour Candles
CREATE MATERIALIZED VIEW IF NOT EXISTS candle_1h
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 hour', time) AS bucket,
  symbol,
  FIRST(last_price, time) AS open,
  MAX(last_price) AS high,
  MIN(last_price) AS low,
  LAST(last_price, time) AS close,
  SUM(volume) AS volume,
  COUNT(*) AS tick_count
FROM tick_data
GROUP BY bucket, symbol
WITH NO DATA;

-- Refresh policy for 1h candles
SELECT add_continuous_aggregate_policy('candle_1h',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- =============================================================================
-- STEP 6: Verify Setup
-- =============================================================================

-- List all hypertables
SELECT hypertable_name, num_chunks, compression_enabled
FROM timescaledb_information.hypertables;

-- List all continuous aggregates
SELECT view_name, materialization_hypertable_name
FROM timescaledb_information.continuous_aggregates;

-- List all jobs (compression, retention, aggregate refresh)
SELECT job_id, application_name, proc_name, schedule_interval, next_start
FROM timescaledb_information.jobs
ORDER BY job_id;

-- Show compression settings
SELECT hypertable_name, segmentby, orderby
FROM timescaledb_information.compression_settings;

-- =============================================================================
-- OPTIONAL: Manual Compression of Historical Data
-- =============================================================================

-- If you have historical data older than 30 days that needs immediate compression:
-- SELECT compress_chunk(c.chunk_schema || '.' || c.chunk_name)
-- FROM timescaledb_information.chunks c
-- WHERE c.hypertable_name = 'tick_data'
--   AND c.range_end < NOW() - INTERVAL '30 days'
--   AND NOT c.is_compressed;

-- =============================================================================
-- OPTIONAL: Force Refresh Continuous Aggregates
-- =============================================================================

-- If you have historical data and want to immediately populate aggregates:
-- CALL refresh_continuous_aggregate('candle_1m', NULL, NULL);
-- CALL refresh_continuous_aggregate('candle_5m', NULL, NULL);
-- CALL refresh_continuous_aggregate('candle_15m', NULL, NULL);
-- CALL refresh_continuous_aggregate('candle_1h', NULL, NULL);

-- =============================================================================
-- Setup Complete!
-- =============================================================================

\echo ''
\echo '============================================='
\echo 'TimescaleDB Production Setup Complete!'
\echo '============================================='
\echo ''
\echo 'Created:'
\echo '  - Hypertable: tick_data (1-day chunks)'
\echo '  - Compression policy: 30 days'
\echo '  - Retention policy: 90 days'
\echo '  - Continuous aggregates: candle_1m, candle_5m, candle_15m, candle_1h'
\echo ''
\echo 'Next steps:'
\echo '  1. Run the migration script to transfer data from Supabase'
\echo '  2. Run the benchmark script to verify performance'
\echo '  3. Set USE_TIMESCALEDB=true in your .env file'
\echo ''
