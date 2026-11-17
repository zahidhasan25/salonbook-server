import axios from "axios";

/**
 * Upload an image buffer to ImgBB when IMGBB_API_KEY is set.
 * Otherwise return the supplied imageUrl, or a placeholder URL.
 * Never throws for a missing key — callers fall back gracefully.
 */
export async function uploadImage(file, imageUrl) {
  const key = process.env.IMGBB_API_KEY;
  if (file && key) {
    try {
      const form = new URLSearchParams();
      form.append("image", file.buffer.toString("base64"));
      const { data } = await axios.post(
        `https://api.imgbb.com/1/upload?key=${key}`,
        form,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 30000 }
      );
      if (data?.data?.url) return data.data.url;
    } catch (err) {
      console.error("ImgBB upload failed:", err?.response?.data || err.message);
      throw new Error("Image upload failed. Please try again.");
    }
  }
  if (imageUrl) return imageUrl;
  if (file && !key) {
    // Dev fallback: no ImgBB key configured — use a placeholder, never crash.
    return "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80";
  }
  return "";
}

export const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80";
