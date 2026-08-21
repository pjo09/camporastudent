// =====================================================
// CAMPORA SHARED IMAGE URL & STORAGE HELPER — NATIVE SUPABASE
// Centralizes image URL construction, Supabase Storage bucket URLs,
// Cloudinary legacy fallbacks, and validation.
// =====================================================

import { API, SUPABASE_URL } from "./config.js";
import { supabase } from "./supabaseClient.js";

const IMAGE_BASE = (SUPABASE_URL || API || "").replace(/\/+$/, "") + "/storage/v1/object/public/properties/";

/**
 * Build a safe absolute URL for a stored image path.
 * @param {string} path - image path from DB (may be undefined)
 * @param {string} fallback - local fallback image
 * @returns {string} usable <img src>
 */
export function getImageUrl(path, fallback = "/assets/images/property-placeholder.jpg") {
  if (!path) return fallback;

  // Already absolute URL (Cloudinary / Supabase Storage / http(s) / data: / blob:)
  if (/^(https?:|data:|blob:)/i.test(path)) return path;

  // Already absolute path from web root (/assets/...)
  if (path.startsWith("/")) return path;

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

  const { data, error } = await supabase.storage
    .from("properties")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: true
    });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage
    .from("properties")
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
