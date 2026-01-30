import { multiAuto } from './vendor/colorsort-js.es5.js';
import DATA from 'colorsort-js/dist/trained.json';

function isValidColorArray(colors) {
  return Array.isArray(colors) && colors.every((color) => typeof color === 'string');
}

self.onmessage = (event) => {
  try {
    const { colors, requestId } = event.data || {};

    if (!isValidColorArray(colors)) {
      throw new Error('Invalid colors. Expected an array of hex color strings.');
    }

    const best = multiAuto(colors, DATA)[0];
    const sorted = best && best.sorted;

    if (!Array.isArray(sorted)) {
      throw new Error('Color sorting failed to produce an array.');
    }

    self.postMessage({
      status: 'SUCCESS',
      requestId,
      sorted,
    });
  } catch (error) {
    self.postMessage({
      status: 'ERROR',
      requestId: event && event.data ? event.data.requestId : undefined,
      message: error && error.message ? error.message : String(error),
    });
  }
};
