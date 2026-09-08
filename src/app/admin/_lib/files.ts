/** 업로드된 이미지 파일을 미리보기/저장이 가능한 data URL 문자열로 변환 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function filesToDataUrls(files: FileList | File[]): Promise<string[]> {
  const list = Array.from(files);
  return Promise.all(list.map(fileToDataUrl));
}
