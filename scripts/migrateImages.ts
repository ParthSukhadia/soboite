// scripts/migrateImages.ts
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs';
import * as path from 'path';


function loadSupabaseCreds() {
  const __dirname = path.dirname(__filename);
  
  const tomlPath = path.resolve(__dirname, '..', 'backend', 'wrangler.toml');
  console.log('Loading wrangler.toml from', tomlPath);
  const content = readFileSync(tomlPath, 'utf-8');
  const varsSection = content.split('[vars]')[1];
  if (!varsSection) throw new Error('No [vars] section in wrangler.toml');
  const lines = varsSection.split('\n');
  let url = '';
  let key = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) break; // stop at next section
    if (!trimmed) continue; // skip empty lines
    const [k, v] = trimmed.split('=');
    if (!k) continue;
    const cleanKey = k.trim();
    const cleanVal = v.trim().replace(/^"|"$/g, '');
    console.log('Key:', cleanKey, 'Value:', cleanVal);
    if (cleanKey === 'SUPABASE_URL') url = cleanVal;
    if (cleanKey === 'SUPABASE_SERVICE_ROLE_KEY') key = cleanVal;
  }
  if (!url || !key) throw new Error('Supabase credentials not found in wrangler.toml');
  return { url, key };
}

const { url: supabaseUrl, key: supabaseKey } = loadSupabaseCreds();
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to upload a base64 data URL and return public URL
async function uploadBase64(dataUrl: string, name: string): Promise<string | null> {
  const [header, base64] = dataUrl.split(',')
  const mimeMatch = header.match(/:(.*?);/)
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg'
  const ext = mimeType.split('/')[1] ?? 'jpg'
  const fileName = `${name}-${Date.now()}.${ext}`
  const buffer = Buffer.from(base64, 'base64');
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  const { error } = await supabase.storage
    .from('soboite')
    .upload(fileName, arrayBuffer, { contentType: mimeType })
  if (error) {
    console.error('Upload error for', name, error)
    return null
  }
  const { data } = supabase.storage.from('soboite').getPublicUrl(fileName)
  return data?.publicUrl ?? null
}

async function migrateTable(table: string, imageField: string) {
  console.log(`Migrating ${table}…`)
  const pageSize = 500
  let offset = 0
  while (true) {
    const { data: rows, error } = await supabase
      .from(table)
      .select(`id, ${imageField}`)
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    if (!rows || rows.length === 0) break
    for (const row of rows as any[]) {
      const img = row[imageField]
      if (img && typeof img === 'string' && img.startsWith('data:')) {
        const publicUrl = await uploadBase64(img, `${table}-${row.id}`)
        if (publicUrl) {
          const { error: updErr } = await supabase
            .from(table)
            .update({ image_storage_url: publicUrl })
            .eq('id', row.id)
          if (updErr) console.error('Update error', updErr)
          else console.log(`✅ ${table} ${row.id} updated`)
        }
      }
    }
    if (rows.length < pageSize) break
    offset += pageSize
  }
}

async function main() {
  await migrateTable('restaurants', 'image_url')
  await migrateTable('dishes', 'image_url')
}

main().catch((e) => console.error('Migration failed', e))
