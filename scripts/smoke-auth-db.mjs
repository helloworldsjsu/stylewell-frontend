import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const result = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^"|"$/g, '');

    if (!(key in process.env)) {
      result[key] = value;
    }
  }

  return result;
}

function required(value, key) {
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

async function main() {
  const repoRoot = process.cwd();
  const envFromFile = parseEnvFile(path.join(repoRoot, '.env'));

  const env = {
    ...envFromFile,
    ...process.env,
  };

  const supabaseUrl = required(env.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL');
  const supabaseAnonKey = required(env.VITE_SUPABASE_ANON_KEY, 'VITE_SUPABASE_ANON_KEY');
  const smokeEmail = env.SMOKE_TEST_EMAIL || '';
  const smokePassword = env.SMOKE_TEST_PASSWORD || '';
  const bucket = env.VITE_SUPABASE_STORAGE_BUCKET || 'clothing-images';

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('[smoke] Starting auth + DB smoke checks...');

  if (smokeEmail && smokePassword) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: smokeEmail,
      password: smokePassword,
    });

    if (signInError) {
      throw new Error(`Auth sign-in failed: ${signInError.message}`);
    }

    console.log('[smoke] Auth sign-in: PASS');
  } else {
    console.log('[smoke] Auth sign-in: SKIPPED (set SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD to enable)');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(`Auth getSession failed: ${sessionError.message}`);
  }
  console.log(`[smoke] Auth getSession: PASS (${sessionData.session ? 'session active' : 'no active session'})`);

  const checkTable = async (tableName) => {
    const { error } = await supabase.from(tableName).select('*').limit(1);
    if (error) {
      throw new Error(`Table check failed for ${tableName}: ${error.message}`);
    }
    console.log(`[smoke] DB table ${tableName}: PASS`);
  };

  await checkTable('garment_items');
  await checkTable('outfits');
  await checkTable('app_config');

  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

  if (bucketError) {
    throw new Error(`Storage bucket check failed for ${bucket}: ${bucketError.message}`);
  }

  const bucketRow = (buckets || []).find((entry) => entry.id === bucket);
  if (!bucketRow) {
    throw new Error(`Storage bucket ${bucket} was not found`);
  }

  console.log(`[smoke] Storage bucket ${bucket}: PASS (public=${bucketRow.public})`);

  console.log('[smoke] Completed successfully.');
}

main().catch((error) => {
  console.error(`[smoke] FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
