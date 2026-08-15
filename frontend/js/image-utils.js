// =====================================================
// CAMPORA SHARED IMAGE URL HELPER
// Centralizes fragile image URL construction so all
// pages handle Cloudinary URLs, local /uploads paths,
// and bare filenames consistently.
// =====================================================

import { API } from "./config.js";

// Base for locally-served uploads: http://localhost:5000
const IMAGE_BASE = API.replace(/\/api\/?$/, "") + "/";

/**
 * Build a safe absolute URL for a stored image path.
 * @param {string} path - image path from DB (may be undefined)
 * @param {string} fallback - local fallback image
 * @returns {string} usable <img src>
 */
export function getImageUrl(path, fallback = "/assets/images/property-placeholder.jpg") {
  if (!path) return fallback;

  // Already absolute URL (Cloudinary / http(s) / data: / blob:)
  if (/^(https?:|data:|blob:)/i.test(path)) return path;

  // Already absolute path from server root (/uploads/...)
  if (path.startsWith("/")) return IMAGE_BASE.replace(/\/$/, "") + path;

  // Legacy: stored as "uploads/xxx.jpg" (relative to server root)
  if (path.startsWith("uploads/")) return IMAGE_BASE + path;

  // Relative images path (e.g. "images/foo.jpg")
  if (path.startsWith("images/")) return IMAGE_BASE + path;

  // Bare filename — assume it lives under /uploads/
  return IMAGE_BASE + "uploads/" + path;
}

/**
 * Default export object for callers that use `import images from ...`
 */
export default { getImageUrl };

