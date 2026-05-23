export type StorageProvider = "google-drive" | "cloudinary" | "supabase" | "firebase";

export type UploadImageInput = {
  file: File;
  folder: string;
  alt?: string;
  ownerId?: string;
};

export type StoredImage = {
  id: string;
  url: string;
  provider: StorageProvider;
  width?: number;
  height?: number;
  alt?: string;
};

export async function uploadImage(_input: UploadImageInput): Promise<StoredImage> {
  throw new Error("ยังไม่ได้ตั้งค่า image storage provider");
}

export function getImageUrl(image: StoredImage | string | null | undefined) {
  if (!image) return "";
  return typeof image === "string" ? image : image.url;
}

export async function deleteImage(_imageId: string): Promise<{ ok: true }> {
  throw new Error("ยังไม่ได้ตั้งค่า image storage provider");
}
