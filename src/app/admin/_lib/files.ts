const MAX_DIMENSION = 960;
const JPEG_QUALITY = 0.72;

/**
 * 업로드된 이미지 파일을 캔버스로 리사이즈 + JPEG 압축한 뒤 data URL로 변환.
 *
 * Firestore 문서 1개당 1MB 제한이 있고, 주점 이미지가 많아질 수 있어서
 * (설명 최대 5장 + 메뉴 최대 8장) 업로드 단계에서 미리 용량을 줄여둠.
 * 장당 대략 80~150KB 수준으로 줄어듦.
 */
export function resizeImageFile(
  file: File,
  maxDimension = MAX_DIMENSION,
  quality = JPEG_QUALITY,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("캔버스 컨텍스트를 생성할 수 없습니다."));
        return;
      }

      // 투명 배경 PNG를 JPEG로 압축할 때 검은 배경이 되지 않도록 흰 배경을 먼저 채움
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지를 불러오지 못했습니다."));
    };

    img.src = objectUrl;
  });
}

export async function resizeImageFiles(
  files: FileList | File[],
  maxDimension?: number,
  quality?: number,
): Promise<string[]> {
  const list = Array.from(files);
  return Promise.all(list.map((f) => resizeImageFile(f, maxDimension, quality)));
}
