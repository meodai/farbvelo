// Utility functions for Farbvelo

// Log an array of colors to the console with color backgrounds
export const logColors = (colors) => {
  let o = "", s = [];
  for (const c of colors) {
    o += `%c ${c} `;
    s.push(`background:${c}; color:${c}`);
  }
  console.log(o, ...s);
};

// Shuffle an array randomly
export const shuffleArray = (arr) =>
  arr.map(a => [Math.random(), a])
    .sort((a, b) => a[0] - b[0])
    .map(a => a[1]);

// Generate a random string of given length
export const randomStr = (length = 14) =>
  Math.random().toString(16).substr(2, length);

// Extract Unsplash photo ID from URL
export const unsplashURLtoID = url => {
  const match = url.match(/https:\/\/images\.unsplash\.com\/photo-([\da-f]+-[\da-f]+)/);
  return match ? match[1] : null;
};

// Convert color coordinates to hex string based on mode
import { hsluvToHex, hpluvToHex } from 'hsluv';
import chroma from 'chroma-js';
export function coordsToHex(angle, val1, val2, mode = 'hsluv') {
  if (mode === 'hsluv') {
    return hsluvToHex([angle, val1, val2]);
  } else if (mode === 'hpluv') {
    return hpluvToHex([angle, val1, val2]);
  } else if (mode === 'hcl') {
    return chroma(angle, val1, val2, 'hcl').hex();
  } else if (mode === 'lch') {
    return chroma(val2, val1, angle, 'lch').hex();
  } else if (mode === 'oklch') {
    return chroma(val2 / 100 * 0.999, val1 / 100 * 0.322, angle, 'oklch').hex();
  } else if (['hsl', 'hsv', 'hcg'].includes(mode)) {
    return chroma(angle, val1 / 100, val2 / 100, mode).hex();
  }
}
