/**
 * Image Validation & Inspection Utilities (Phase 2.4).
 * Enforces file format validation, MIME security checks, size boundaries,
 * and asynchronous bitmap decoding tests before accepting images into the editor.
 */

export const MAX_IMAGE_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 Megabytes

export const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
]);

export interface ImageValidationResult {
  isValid: boolean;
  error?: string;
  width_px?: number;
  height_px?: number;
}

/**
 * Validates file headers, MIME type, extension, and file size.
 */
export function validateImageFile(
  file: File,
  maxSizeBytes = MAX_IMAGE_FILE_SIZE_BYTES
): { isValid: boolean; error?: string } {
  if (!file) {
    return { isValid: false, error: 'No image file was selected.' };
  }

  // 1. Check File Size
  if (file.size <= 0) {
    return { isValid: false, error: 'The selected image file is empty (0 bytes).' };
  }

  if (file.size > maxSizeBytes) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    return {
      isValid: false,
      error: `Image file size (${sizeMb} MB) exceeds the maximum allowed limit of ${maxMb} MB.`,
    };
  }

  // 2. Check File Extension
  const filename = file.name || '';
  const lastDot = filename.lastIndexOf('.');
  const ext = lastDot !== -1 ? filename.substring(lastDot).toLowerCase() : '';

  if (!SUPPORTED_IMAGE_EXTENSIONS.has(ext)) {
    return {
      isValid: false,
      error: `Unsupported file extension "${ext}". Supported image types: PNG, JPEG, and WebP.`,
    };
  }

  // 3. Check MIME type (if provided by browser)
  if (file.type && !SUPPORTED_IMAGE_MIME_TYPES.has(file.type.toLowerCase())) {
    return {
      isValid: false,
      error: `Unsupported image MIME type "${file.type}". Supported types: PNG, JPEG, and WebP.`,
    };
  }

  return { isValid: true };
}

/**
 * Decodes the image in browser memory to verify file integrity and extract intrinsic dimensions.
 */
export function decodeImageFile(
  file: File,
  maxSizeBytes = MAX_IMAGE_FILE_SIZE_BYTES
): Promise<ImageValidationResult> {
  const initialCheck = validateImageFile(file, maxSizeBytes);
  if (!initialCheck.isValid) {
    return Promise.resolve(initialCheck);
  }

  return new Promise((resolve) => {
    let objectUrl: string | null = null;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      resolve({ isValid: false, error: 'Failed to access image file data in browser memory.' });
      return;
    }

    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }

      if (width <= 0 || height <= 0) {
        resolve({
          isValid: false,
          error: 'Image has invalid or degenerate zero dimensions.',
        });
        return;
      }

      resolve({
        isValid: true,
        width_px: width,
        height_px: height,
      });
    };

    img.onerror = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      resolve({
        isValid: false,
        error: 'Unable to decode image file. The file may be corrupt, damaged, or not a valid image format.',
      });
    };

    img.src = objectUrl;
  });
}
