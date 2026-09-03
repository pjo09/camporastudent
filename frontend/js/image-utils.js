// =====================================================
// CAMPORA SHARED IMAGE URL & STORAGE HELPER — NATIVE SUPABASE
// Centralizes image URL construction, Supabase Storage bucket URLs,
// Cloudinary legacy fallbacks, and validation.
// =====================================================

import { API, SUPABASE_URL } from "./config.js";
import { supabase } from "./supabaseClient.js";

const IMAGE_BASE = (SUPABASE_URL || API || "").replace(/\/+$/, "") + "/storage/v1/object/public/properties/";

export function getImageUrl(pathInput, fallback = "/assets/images/property-placeholder.jpg") {
  let path = pathInput;

  if (Array.isArray(path)) {
    path = path.length > 0 ? path[0] : "";
  }

  if (path && typeof path === "object") {
    path = path.url || path.image_url || path.path || path.filename || path.src || "";
  }

  if (!path || typeof path !== "string" || !path.trim()) {
    return fallback;
  }

  path = path.trim();

  // Already absolute URL (Cloudinary / Supabase Storage / http(s) / data: / blob:)
  if (/^(https?:|data:|blob:)/i.test(path)) return path;

  // Already absolute path from web root (/assets/..., /images/...)
  if (path.startsWith("/")) return path;

  // Clean relative storage path prefixes
  path = path.replace(/^\/+/, "");
  path = path.replace(/^storage\/v1\/object\/public\/properties\//i, "");
  path = path.replace(/^properties\//i, "");

  // Stored in Supabase Storage or relative path
  return IMAGE_BASE + path;
}

/**
 * Upload an image file directly to Supabase Storage bucket 'properties'.
 * @param {File} file - Browser File object
 * @param {string} folder - Optional subfolder name
 * @returns {Promise<string>} Public URL of uploaded image
 */
export async function uploadImageToSupabase(file, folder = "properties") {
  if (!file) throw new Error("No file provided for upload");
  
  validateImageFile(file);

  const fileExt = file.name.split('.').pop();
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

  let { data, error } = await supabase.storage
    .from("properties")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: true
    });

  if (error) {
    const errStr = (error.message || JSON.stringify(error)).toLowerCase();
    if (errStr.includes("bucket not found") || error.status === 400 || error.statusCode === "404" || error.error === "Bucket not found") {
      const fallbackBuckets = ["property-images", "documents", "public"];
      for (const bucket of fallbackBuckets) {
        try {
          const { data: fbData, error: fbErr } = await supabase.storage
            .from(bucket)
            .upload(fileName, file, { cacheControl: "3600", upsert: true });
          if (!fbErr && fbData) {
            const { data: pubUrl } = supabase.storage.from(bucket).getPublicUrl(fileName);
            return pubUrl.publicUrl;
          }
        } catch { /* continue */ }
      }
      return await fileToDataUrl(file);
    }
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from("properties")
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a document file (JPEG, PNG, PDF) to Supabase Storage bucket 'documents'.
 * @param {File} file - Browser File object
 * @returns {Promise<string>} Uploaded file URL or path
 */
export async function uploadDocumentToSupabase(file) {
  if (!file) throw new Error("No file provided for upload");

  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg", "application/pdf"];
  if (!validTypes.includes(file.type.toLowerCase())) {
    throw new Error("Invalid document format. Please upload JPEG, PNG, WEBP, or PDF.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Document file size must be under 5MB.");
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const fileExt = file.name.split('.').pop();
  const fileName = `documents/${user.id}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from("documents")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: true
    });

  if (error) {
    // Fallback to properties bucket under documents/ prefix if documents bucket not created
    const { data: fallbackData, error: fallbackErr } = await supabase.storage
      .from("properties")
      .upload(fileName, file, { cacheControl: "3600", upsert: true });

    if (fallbackErr) throw fallbackErr;

    const { data: fallbackUrl } = supabase.storage.from("properties").getPublicUrl(fileName);
    return fallbackUrl.publicUrl;
  }

  const { data: publicUrlData } = supabase.storage
    .from("documents")
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

/**
 * Delete an image file from Supabase Storage bucket.
 * @param {string} filePath - File path inside bucket
 */
export async function deleteImageFromSupabase(filePath) {
  if (!filePath) return;
  const { error } = await supabase.storage.from("properties").remove([filePath]);
  if (error) console.warn("Supabase Storage image deletion error:", error.message);
}

/**
 * Validate image file size and MIME type.
 * @param {File} file
 */
export function validateImageFile(file, maxMB = 5) {
  if (!file) throw new Error("No file selected");
  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/gif"];
  if (!validTypes.includes(file.type.toLowerCase())) {
    throw new Error("Invalid image format. Please upload JPEG, PNG, WEBP, or GIF.");
  }
  if (file.size > maxMB * 1024 * 1024) {
    throw new Error(`Image file size must be under ${maxMB}MB.`);
  }
  return true;
}

export default {
  getImageUrl,
  uploadImageToSupabase,
  deleteImageFromSupabase,
  validateImageFile
};
