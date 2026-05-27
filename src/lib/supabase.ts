import { createClient } from '@supabase/supabase-js';

/**
 * Supabase 클라이언트 (서버사이드 전용)
 * 
 * Storage 접근을 위해 service_role key 사용.
 * 클라이언트 사이드에서는 사용하지 않음.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
});

export const PHOTO_BUCKET = 'museum-photos';

/**
 * Supabase Storage에서 사진의 public URL을 생성
 */
export function getPhotoPublicUrl(path: string): string {
    if (!supabaseUrl) return '';
    return `${supabaseUrl}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}
