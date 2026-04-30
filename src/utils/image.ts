const MAX_WIDTH = 800;
const MAX_HEIGHT = 1600;
const QUALITY = 0.8;
const MAX_SCREENSHOTS = 3;
const MAX_BASE64_LENGTH = 500_000; // ~375KB after base64 overhead

/**
 * Compress an image file to a JPEG data URL.
 * Resizes to max 800x1600, JPEG 0.8 quality, max ~375KB output.
 */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
        if (dataUrl.length > MAX_BASE64_LENGTH) {
          // Re-compress at lower quality
          const fallback = canvas.toDataURL('image/jpeg', 0.5);
          if (fallback.length > MAX_BASE64_LENGTH) {
            reject(new Error('图片过大，请裁剪后重试'));
            return;
          }
          resolve(fallback);
          return;
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * Compress a Blob (e.g. from clipboard) to a JPEG data URL.
 */
export function compressBlob(blob: Blob): Promise<string> {
  return compressImage(new File([blob], 'paste.png', { type: blob.type }));
}

export { MAX_SCREENSHOTS };
