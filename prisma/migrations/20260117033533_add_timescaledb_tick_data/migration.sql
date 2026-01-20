-- POC TimescaleDB: Create tick_data table with hypertable and compression
-- 
-- NOTE: This migration requires TimescaleDB extension to be installed.
-- If using Supabase, TimescaleDB may not be available. In that case:
-- 1. Use a dedicated PostgreSQL instance with TimescaleDB extension
-- 2. Or set up TimescaleDB locally for development
--
-- To enable TimescaleDB:
--   CREATE EXTENSION IF NOT EXISTS timescaledb;
--
-- To verify:
--   SELECT * FROM timescaledb_information.hypertables;

-- Create tick_data table (time-series data)
CREATE TABLE IF NOT EXISTS tick_data (
  time TIMESTAMPTZ NOT NULL,
  symbol TEXT NOT NULL,
  account_id UUID,
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  
  -- Price data
  bid_price DECIMAL(20, 8),
  ask_price DECIMAL(20, 8),
  last_price DECIMAL(20, 8),
  volume BIGINT,
  
  -- Metadata
  source TEXT, -- 'broker', 'market_data_provider'
  
  PRIMARY KEY (time, symbol, account_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS tick_data_symbol_idx ON tick_data(symbol);
CREATE INDEX IF NOT EXISTS tick_data_account_id_idx ON tick_data(account_id);
CREATE INDEX IF NOT EXISTS tick_data_trade_id_idx ON tick_data(trade_id);
CREATE INDEX IF NOT EXISTS tick_data_time_symbol_idx ON tick_data(time DESC, symbol);

-- Convert to hypertable (TimescaleDB)
-- Only execute if TimescaleDB extension is available
DO $$
BEGIN
  -- Check if TimescaleDB extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    -- Convert to hypertable
    PERFORM create_hypertable(
      'tick_data',
      'time',
      chunk_time_interval => INTERVAL '1 day',
      if_not_exists => TRUE
    );
    
    -- Enable compression (compress after 30 days)
    PERFORM add_compression_policy('tick_data', INTERVAL '30 days');
    
    RAISE NOTICE 'TimescaleDB hypertable and compression policy created successfully';
  ELSE
    RAISE WARNING 'TimescaleDB extension not found. Table created but not converted to hypertable. Install TimescaleDB to enable time-series optimizations.';
  END IF;
END $$;

-- Continuous aggregates for candles (pre-aggregated for performance)
-- Only create if TimescaleDB is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    -- Create 1-minute candle view
    CREATE MATERIALIZED VIEW IF NOT EXISTS candle_1m
    WITH (timescaledb.continuous) AS
    SELECT 
      time_bucket('1 minute', time) AS bucket,
      symbol,
      account_id,
      FIRST(bid_price, time) AS open,
      MAX(bid_price) AS high,
      MIN(bid_price) AS low,
      LAST(bid_price, time) AS close,
      SUM(volume) AS volume
    FROM tick_data
    GROUP BY bucket, symbol, account_id;
    
    -- Add refresh policy (refresh every minute)
    PERFORM add_continuous_aggregate_policy(
      'candle_1m',
      start_offset => INTERVAL '1 hour',
      end_offset => INTERVAL '1 minute',
      schedule_interval => INTERVAL '1 minute',
      if_not_exists => TRUE
    );
    
    RAISE NOTICE 'Continuous aggregate candle_1m created successfully';
  ELSE
    RAISE WARNING 'Skipping continuous aggregate creation (TimescaleDB not available)';
  END IF;
END $$;
