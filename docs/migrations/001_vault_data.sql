-- WhaleVault V3: Encrypted Cloud Backup Table
CREATE TABLE vault_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_hash TEXT UNIQUE NOT NULL,
  encrypted_data TEXT NOT NULL,
  nonce TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Public access (data is AES-256-GCM encrypted client-side)
ALTER TABLE vault_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON vault_data FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON vault_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON vault_data FOR UPDATE USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vault_data_updated_at
  BEFORE UPDATE ON vault_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
