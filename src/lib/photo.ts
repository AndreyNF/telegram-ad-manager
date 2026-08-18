const MAX_SIDE = 2000;
const TARGET_BYTES = 1400 * 1024;

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось открыть изображение'));
    };
    img.src = url;
  });

export interface PreparedPhoto {
  name: string;
  type: string;
  data: string;
}

export const preparePhoto = async (file: File): Promise<PreparedPhoto> => {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Браузер не поддерживает обработку фото');
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.85;
  let data = canvas.toDataURL('image/jpeg', quality);

  while (data.length * 0.75 > TARGET_BYTES && quality > 0.4) {
    quality -= 0.12;
    data = canvas.toDataURL('image/jpeg', quality);
  }

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return { name: `${baseName}.jpg`, type: 'image/jpeg', data };
};

export default preparePhoto;