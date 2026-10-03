export const uiAssetUrls = [
  new URL('./sprites/ui/frame.png', import.meta.url).href,
  new URL('./sprites/ui/parchment-frame.png', import.meta.url).href,
  new URL('./sprites/ui/buttons.png', import.meta.url).href,
  new URL('./sprites/ui/portrait.png', import.meta.url).href,
];

// Extract button states at startup; the original pack sheets stay intact.
export async function prepareUIAssets() {
  const image = new Image();
  image.src = uiAssetUrls[2];
  await image.decode();
  for (const [index, name] of ['rest', 'hover', 'pressed', 'disabled'].entries()) {
    const canvas = document.createElement('canvas');
    canvas.width = 96; canvas.height = 22;
    canvas.getContext('2d').drawImage(image, index * 96, 0, 96, 22, 0, 0, 96, 22);
    document.documentElement.style.setProperty(`--button-${name}`, `url("${canvas.toDataURL()}")`);
  }
  await Promise.all([document.fonts.load('400 16px Cinzel'), document.fonts.load('400 16px "Pixelify Sans"')]);
}
