-- Device Monitor Database Schema
-- Run this in Supabase SQL Editor to set up your tables

-- Devices table: stores registered devices
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT UNIQUE NOT NULL,
    device_name TEXT NOT NULL DEFAULT 'Unknown Device',
    api_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ,
    online BOOLEAN NOT NULL DEFAULT FALSE
);

-- Device data table: stores telemetry data from devices
CREATE TABLE IF NOT EXISTS device_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Commands table: stores commands to be sent to devices
CREATE TABLE IF NOT EXISTS commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    command TEXT NOT NULL,
    params JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_device_data_device_id ON device_data(device_id);
CREATE INDEX IF NOT EXISTS idx_device_data_created_at ON device_data(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commands_device_id ON commands(device_id);
CREATE INDEX IF NOT EXISTS idx_commands_status ON commands(status);

-- Enable RLS
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE commands ENABLE ROW LEVEL SECURITY;

-- Policies: allow service role full access (backend uses service_role key)
-- These are permissive since we authenticate via API key in the backend
CREATE POLICY "Service role full access" ON devices FOR ALL USING (true);
CREATE POLICY "Service role full access" ON device_data FOR ALL USING (true);
CREATE POLICY "Service role full access" ON commands FOR ALL USING (true);
