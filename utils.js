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
import chroma from './lib/chroma-extensions.js';

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
  } else if (mode === 'okhsv') {
    // Okhsv inputs: angle (hue 0-360), val1 (saturation 0-100), val2 (value 0-100)
    // chroma.okhsv expects: h_deg (0-360), s_norm (0-1), v_norm (0-1)
    let s_norm = val1 / 100; // Adjusted for chroma.okhsv
    let v_norm = Math.pow(val2 / 100, .9) * 1.1 + 0.15; // Adjusted for chroma.okhsv
    // max them out to 1
    s_norm = Math.min(s_norm, 1);
    v_norm = Math.min(v_norm, 1);
    return chroma.okhsv(angle, s_norm, v_norm).hex();
  } else if (mode === 'okhsl') {
    const s_norm = val1 / 100; // Adjusted for chroma.okhsl
    const l_norm = val2 / 100;
    return chroma.okhsl(angle, s_norm, l_norm).hex();
  } else if (['hsl', 'hsv', 'hcg'].includes(mode)) {
    return chroma(angle, val1 / 100, val2 / 100, mode).hex();
  }
  // Fallback for unknown modes, or if a mode wasn't handled (should not happen with proper checks)
  console.warn(`Unknown color mode: ${mode} in coordsToHex. Falling back to black.`);
  return '#000000';
}
