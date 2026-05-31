import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export const uploadImage = async (base64Data: string): Promise<string> => {
  if (!base64Data || !base64Data.startsWith('data:')) {
    return base64Data;
  }
  try {
    const blob = dataURLtoBlob(base64Data);
    const fileExt = 'jpg';
    const fileName = `${Math.random().toString(36).slice(2, 11)}-${Date.now()}.${fileExt}`;
    const filePath = `public/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      if (uploadError.message.includes('bucket not found') || uploadError.message.includes('does not exist')) {
        console.log("Bucket 'photos' not found. Attempting to create it...");
        const { error: bucketError } = await supabase.storage.createBucket('photos', {
          public: true
        });
        if (bucketError) {
          throw new Error(`Failed to create bucket 'photos': ${bucketError.message}`);
        }
        const { error: retryError } = await supabase.storage
          .from('photos')
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: true
          });
        if (retryError) throw retryError;
      } else {
        throw uploadError;
      }
    }

    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error("Error uploading image to Supabase Storage:", error);
    return base64Data; // Fallback to base64 so it still works if storage fails
  }
};
