// Handles image loading and palette extraction logic
import chroma from "chroma-js";
import { quantize as quantizeGifenc } from 'gifenc';

const CANVAS_SCALE = 0.4;
const workers = [];

export function startColorLocatorWorker(imageDataObject, targetRgbColors, onResultCallback, onErrorCallback) {
  if (!imageDataObject || !imageDataObject.data || typeof imageDataObject.width !== 'number' || typeof imageDataObject.height !== 'number') {
    if (onErrorCallback) onErrorCallback({ message: "Valid imageData object (with data, width, height) is required." });
    return null;
  }
  if (!targetRgbColors || !Array.isArray(targetRgbColors) || targetRgbColors.some(c => typeof c.r !== 'number' || typeof c.g !== 'number' || typeof c.b !== 'number')) {
    if (onErrorCallback) onErrorCallback({ message: "targetRgbColors must be an array of {r,g,b} objects." });
    return null;
  }

  const worker = new Worker('../color-locator-worker.js'); // Path relative to lib/image-palette.js

  // Create a mapping from rgbKey to hex color to help with logging
  const rgbToHexMap = {};
  targetRgbColors.forEach((rgb, index) => {
    const key = `${rgb.r}-${rgb.g}-${rgb.b}`;
    rgbToHexMap[key] = chroma(rgb.r, rgb.g, rgb.b).hex();
  });

  worker.onmessage = (event) => {
    if (event.data.status === 'SUCCESS') {
      if (onResultCallback) onResultCallback(event.data.locations);
    } else if (event.data.status === 'ERROR') {
      console.error('Color locator worker error:', event.data.message);
      if (onErrorCallback) onErrorCallback({ message: event.data.message, stack: event.data.stack });
    }
  };

  worker.onerror = (error) => {
    console.error('Worker error event:', error);
    if (onErrorCallback) onErrorCallback({ message: `Worker error: ${error.message}`, errorObject: error });
  };

  const messagePayload = {
    imageData: imageDataObject, // Expected to be { width, height, data: Uint8ClampedArray }
    targetRgbColors: targetRgbColors
  };

  worker.postMessage(messagePayload);
  return worker;
}

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
  const width = Math.floor(image.naturalWidth * CANVAS_SCALE);
  const height = Math.floor(image.naturalHeight * CANVAS_SCALE);
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);

  // Store a clone of necessary imageData parts on the 'colors' object (Vue instance from main.js)
  if (colors && typeof colors === 'object') {
    colors.currentImageData = {
        width: imageData.width,
        height: imageData.height,
        // Create a copy of the data buffer to ensure it's safe and available for later use
        data: new Uint8ClampedArray(imageData.data)
    };
  }

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
