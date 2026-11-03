/**
 * Creates (or updates) the private Supabase Storage bucket for candidate documents.
 * Usage: npm run setup:storage
 */
import { createClient } from "@supabase/supabase-js";
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from "../src/modules/documents/file-rules";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  const bucket = process.env.SUPABASE_DOCUMENTS_BUCKET ?? "candidate-documents";
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const options = { public: false, fileSizeLimit: MAX_FILE_BYTES, allowedMimeTypes: ALLOWED_MIME_TYPES };
  const { data: existing } = await supabase.storage.getBucket(bucket);
  const { error } = existing ? await supabase.storage.updateBucket(bucket, options) : await supabase.storage.createBucket(bucket, options);
  if (error) throw error;
  console.log(`Bucket "${bucket}" is ${existing ? "updated" : "created"}: private, max 10 MB, types: ${ALLOWED_MIME_TYPES.join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
