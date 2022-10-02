import PaletteExtractor from './lib/palette-extractor';

let paletteExtractor = new PaletteExtractor();
let colors;

self.addEventListener('message', e => {
  switch (e.data.type) {
    case 'GENERATE_COLORS_ARRAY':
      //pixels = calculateColorsArray(e.data.imageData.data, e.data.width);
      paletteExtractor = new PaletteExtractor();
      colors = paletteExtractor.processImageData(e.data.imageData.data, e.data.k);
      self.postMessage({
          type: 'GENERATE_COLORS_ARRAY',
          // pixels
      });
    break;
    case 'GENERATE_CLUSTERS':
      self.postMessage({
        type: 'GENERATE_CLUSTERS',
        colors
      });
    break;
  }
}, false);
