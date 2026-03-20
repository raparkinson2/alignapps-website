import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";

const filesRouter = new Hono();

const BUCKET = "team-files";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key) as SupabaseClient;
}

// Blocked MIME type prefixes
const BLOCKED_PREFIXES = ["video/", "audio/"];

function isAllowedType(contentType: string): boolean {
  return !BLOCKED_PREFIXES.some((p) => contentType.startsWith(p));
}

// Ensure the bucket exists (called lazily on first upload/list)
async function ensureBucket(supabase: ReturnType<typeof createClient>) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 52428800, // 50 MB
    });
    if (error && !error.message.includes("already exists")) {
      console.error("[files] Failed to create bucket:", error.message);
    }
  }
}

// Upload a file for a team
filesRouter.post("/upload/:teamId", async (c) => {
  const { teamId } = c.req.param();

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: "Invalid form data" }, 400);
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  if (!isAllowedType(file.type)) {
    return c.json({ error: "Video and audio files are not allowed" }, 400);
  }

  const explicitFilename = formData.get("filename");
  const rawName =
    (file as File).name ||
    (typeof explicitFilename === "string" ? explicitFilename : null) ||
    `upload_${Date.now()}`;
  const safeName = rawName.replace(/[^a-zA-Z0-9._\-() ]/g, "_");
  const ts = Date.now();
  // Path: teamId/timestamp__filename  (teamId acts as the "folder")
  const storagePath = `${teamId}/${ts}__${safeName}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: any;
  try {
    supabase = getSupabase();
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }

  await ensureBucket(supabase);

  const arrayBuffer = await file.arrayBuffer();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("[files] Supabase upload error:", error.message);
    return c.json({ error: `Upload failed: ${error.message}` }, 500);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  const fileData = {
    id: storagePath,
    path: storagePath,
    originalFilename: storagePath,
    displayName: safeName,
    contentType: file.type,
    sizeBytes: file.size,
    url: urlData.publicUrl,
    created: new Date().toISOString(),
  };

  console.log("[files] Uploaded:", storagePath);
  return c.json({ data: fileData });
});

// List files for a team
filesRouter.get("/:teamId", async (c) => {
  const { teamId } = c.req.param();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: any;
  try {
    supabase = getSupabase();
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }

  await ensureBucket(supabase);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(teamId, { limit: 500, sortBy: { column: "created_at", order: "desc" } });

  if (error) {
    console.error("[files] Supabase list error:", error.message);
    return c.json({ error: "Failed to list files" }, 500);
  }

  const files = (data ?? [] as any[])
    .filter((f: any) => f.name !== ".emptyFolderPlaceholder")
    .map((f: any) => {
      const storagePath = `${teamId}/${f.name}`;
      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath);

      // Strip timestamp prefix to get the display name
      const displayName = f.name.replace(/^\d{10,}__/, "");

      return {
        id: storagePath,
        path: storagePath,
        originalFilename: storagePath,
        displayName,
        contentType: f.metadata?.mimetype ?? "application/octet-stream",
        sizeBytes: f.metadata?.size ?? 0,
        url: urlData.publicUrl,
        created: f.created_at ?? new Date().toISOString(),
      };
    });

  console.log(`[files] list teamId=${teamId} count=${files.length}`);
  return c.json({ data: files });
});

<<<<<<< HEAD
// Delete a file by its storage path — passed as ?path= to avoid slash-in-URL issues
filesRouter.delete("/delete", async (c) => {
  const filePath = c.req.query("path");
  if (!filePath) {
    return c.json({ error: "Missing required query param: path" }, 400);
  }
=======
// Fallback: legacy single-segment id (UUID from old storage service) — just return success
filesRouter.delete("/delete/:fileId", async (c) => {
  console.log("[files] legacy delete id:", c.req.param("fileId"), "— returning success");
  return c.json({ data: { success: true } });
});

// Delete a file by its storage path: /delete/:teamId/:filename
filesRouter.delete("/delete/:teamId/:filename", async (c) => {
  const { teamId, filename } = c.req.param();
  const filePath = `${teamId}/${filename}`;
>>>>>>> github-align/main

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: any;
  try {
    supabase = getSupabase();
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }

<<<<<<< HEAD
=======
  // fileId may be a full path like "team-xxx/ts__name.pdf"
  // or just an opaque id — try to delete by treating it as the path first
>>>>>>> github-align/main
  const { error } = await supabase.storage.from(BUCKET).remove([filePath]);

  if (error) {
    console.error("[files] Supabase delete error:", error.message);
    return c.json({ error: "Delete failed" }, 500);
  }

  console.log("[files] Deleted:", filePath);
  return c.json({ data: { success: true } });
});

export { filesRouter };
