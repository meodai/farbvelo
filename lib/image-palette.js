// Handles image loading and palette extraction logic
import chroma from "chroma-js";
import { quantize as quantizeGifenc } from 'gifenc';

const CANVAS_SCALE = 0.4;
const workers = [];

export function startWorker(colors, imageUrl, imageData, width, filterOptions, colorsLength) {
  // Fix worker path to point to the root-level worker.js
  const worker = new Worker('../worker.js');
  workers.push(worker);

  worker.addEventListener(
    'message',
    (e) => {
      switch (e.data.type) {
        case 'GENERATE_COLORS_ARRAY': {
          const pixels = e.data.colors;
          worker.postMessage({
            type: 'GENERATE_CLUSTERS',
            pixels,
            k: colorsLength,
            filterOptions,
          });
          break;
        }
        case 'GENERATE_CLUSTERS': {
          console.timeEnd('calculating colors');
          const clusters = e.data.colors;
          colors.colorsValues = clusters.sort((c1, c2) =>
            chroma(c1).lch()[0] - chroma(c2).lch()[0]
          );
          document.documentElement.classList.remove('is-imagefetching');
          break;
        }
      }
    },
    false
  );

  worker.postMessage({
    type: 'GENERATE_COLORS_ARRAY',
    imageData,
    width,
    k: colorsLength,
  });
}

export function imageLoadCallback(colors, image, canvas, ctx, colorsLength, quantizationMethod) {
  console.time('calculating colors');
  const width = Math.floor(image.naturalWidth * CANVAS_SCALE);
  const height = Math.floor(image.naturalHeight * CANVAS_SCALE);
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const filterOptions = { saturation: 0, lightness: 0 };
  if (quantizationMethod === 'gifenc') {
    const rgbColors = quantizeGifenc(imageData.data, colorsLength);
    const hexColors = rgbColors.map(rgb => chroma(rgb[0], rgb[1], rgb[2]).hex());
    colors.colorsValues = hexColors;
    document.documentElement.classList.remove('is-imagefetching');
  } else {
    startWorker(colors, image.src, imageData, width, filterOptions, colorsLength);
  }
}

export function loadImage(colors, canvas, ctx, source, colorsLength, quantizationMethod) {
  workers.forEach(w => w.terminate());
  const image = new Image();
  image.crossOrigin = 'Anonymous';
  image.src = source;
  image.onload = imageLoadCallback.bind(null, colors, image, canvas, ctx, colorsLength, quantizationMethod);
}
