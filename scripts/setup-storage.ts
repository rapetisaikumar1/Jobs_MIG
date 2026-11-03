/**
 * Creates (or updates) the private Supabase Storage bucket for candidate documents.
 * Usage: npm run setup:storage
 */
import { scriptSupabaseAdmin } from "./supabase-admin";
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from "../src/modules/documents/file-rules";

async function main() {
  const bucket = process.env.SUPABASE_DOCUMENTS_BUCKET ?? "candidate-documents";
  const supabase = scriptSupabaseAdmin();

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
