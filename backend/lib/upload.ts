// backend/lib/upload.ts

import type { SupabaseClient } from '@supabase/supabase-js';

/** Convert a data URL to a Blob */
function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
}

/** Upload a base64 image string to Supabase Storage and return the public URL */
export async function uploadBase64Image(
  supabase: SupabaseClient,
  dataurl: string,
  folder: string = 'photos'
): Promise<string> {
  if (!dataurl.startsWith('data:')) return dataurl;
  const blob = dataURLtoBlob(dataurl);
  const ext = 'jpg';
  const fileName = `${Math.random().toString(36).slice(2, 11)}-${Date.now()}.${ext}`;
  const filePath = `${folder}/${fileName}`;
  const { error: uploadError } = await supabase.storage.from('photos').upload(filePath, blob, {
    contentType: 'image/jpeg',
    cacheControl: '3600',
    upsert: true,
  });
  if (uploadError) {
    // Attempt to create bucket if missing
    if (uploadError.message.includes('bucket not found') || uploadError.message.includes('does not exist')) {
      const { error: bucketError } = await supabase.storage.createBucket('photos', { public: true });
      if (bucketError) throw new Error(`Failed to create bucket: ${bucketError.message}`);
      const { error: retryError } = await supabase.storage.from('photos').upload(filePath, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true,
      });
      if (retryError) throw retryError;
    } else {
      throw uploadError;
    }
  }
  const { data } = supabase.storage.from('photos').getPublicUrl(filePath);
  return data.publicUrl;
}
