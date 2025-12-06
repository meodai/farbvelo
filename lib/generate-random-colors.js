import SimplexNoise from 'simplex-noise';
import randomColor from 'randomcolor';
import { shuffleArray, coordsToHex } from '../utils.js';

export default function generateRandomColors({
  generatorFunction,
  random,
  currentSeed,
  colorMode,
  amount = 6,
  parts = 4,
  randomOrder = false,
  colorArrangement = "default",
  minHueDiffAngle = 60
}) {
  let colors = [];
  minHueDiffAngle = parseInt(minHueDiffAngle);
  amount = parseInt(amount);
  parts = parseInt(parts);
  minHueDiffAngle = Math.min(minHueDiffAngle, 360 / parts);

  if (generatorFunction === 'Hue Bingo') {
    const baseHue = random(0, 360);
    const hues = new Array(Math.round(360 / minHueDiffAngle)).fill('').map((_, i) => (baseHue + i * minHueDiffAngle) % 360);
    const baseSaturation = random(5, 40);
    const baseLightness = random(0, 20);
    const rangeLightness = 90 - baseLightness;

    // Generate separate arrays for H, S, L
    const colorHues = [];
    const colorSaturations = [];
    const colorLightnesses = [];

    colorHues.push(hues[0]);
    colorSaturations.push(baseSaturation);
    colorLightnesses.push(baseLightness * random(0.25, 0.75));

    const minSat = random(50, 70);
    const maxSat = minSat + 30;
    const minLight = random(35, 70);
    const maxLight = Math.min(minLight + random(20, 40), 95);
    const remainingHues = [...hues];

    for (let i = 0; i < parts - 2; i++) {
      const hue = remainingHues.splice(random(0, remainingHues.length - 1), 1)[0];
      const saturation = random(minSat, maxSat);
      const light = baseLightness + random(0, 10) + ((rangeLightness / (parts - 1)) * i);
      colorHues.push(hue);
      colorSaturations.push(saturation);
      colorLightnesses.push(random(light, maxLight));
    }

    colorHues.push(remainingHues[0]);
    colorSaturations.push(baseSaturation);
    colorLightnesses.push(rangeLightness + 10);

    // Sort lightnesses if needed
    if (colorArrangement !== 'default') {
      const sortedLightnesses = [...colorLightnesses].sort((a, b) => a - b);
      const centerIndex = Math.floor(sortedLightnesses.length / 2);
      const reordered = new Array(sortedLightnesses.length);

      if (colorArrangement === 'darkCenter') {
        // Place darkest in center
        reordered[centerIndex] = sortedLightnesses[0];
        let leftIndex = centerIndex - 1;
        let rightIndex = centerIndex + 1;
        for (let i = 1; i < sortedLightnesses.length; i++) {
          if (leftIndex >= 0) {
            reordered[leftIndex] = sortedLightnesses[i];
            leftIndex--;
            i++;
          }
          if (i < sortedLightnesses.length && rightIndex < sortedLightnesses.length) {
            reordered[rightIndex] = sortedLightnesses[i];
            rightIndex++;
          }
        }
        colorLightnesses.splice(0, colorLightnesses.length, ...reordered);
      } else if (colorArrangement === 'lightCenter') {
        // Place lightest in center
        reordered[centerIndex] = sortedLightnesses[sortedLightnesses.length - 1];
        let leftIndex = centerIndex - 1;
        let rightIndex = centerIndex + 1;
        for (let i = sortedLightnesses.length - 2; i >= 0; i--) {
          if (leftIndex >= 0) {
            reordered[leftIndex] = sortedLightnesses[i];
            leftIndex--;
            i--;
          }
          if (i >= 0 && rightIndex < sortedLightnesses.length) {
            reordered[rightIndex] = sortedLightnesses[i];
            rightIndex++;
          }
        }
        colorLightnesses.splice(0, colorLightnesses.length, ...reordered);
      }
    }

    // Combine H/S/L into colors
    for (let i = 0; i < colorHues.length; i++) {
      colors.push(coordsToHex(colorHues[i], colorSaturations[i], colorLightnesses[i], colorMode));
    }
  } else if (generatorFunction === 'Legacy') {
    const part = Math.floor(amount / parts);
    const reminder = amount % parts;
    const baseHue = random(0, 360);
    const hues = new Array(Math.round(360 / minHueDiffAngle)).fill('').map((_, i) => (baseHue + i * minHueDiffAngle) % 360);
    const baseSaturation = random(5, 40);
    const baseLightness = random(0, 20);
    const rangeLightness = 90 - baseLightness;

    // Generate separate arrays for H, S, L
    const colorHues = [];
    const colorSaturations = [];
    const colorLightnesses = [];

    colorHues.push(hues[0]);
    colorSaturations.push(baseSaturation);
    colorLightnesses.push(baseLightness * random(0.25, 0.75));

    for (let i = 0; i < (part - 1); i++) {
      colorHues.push(hues[0]);
      colorSaturations.push(baseSaturation);
      colorLightnesses.push(baseLightness + (rangeLightness * Math.pow(i / (part - 1), 1.5)));
    }

    const minSat = random(50, 70);
    const maxSat = minSat + 30;
    const minLight = random(45, 80);
    const maxLight = Math.min(minLight + 40, 95);

    for (let i = 0; i < (part + reminder - 1); i++) {
      colorHues.push(hues[random(0, hues.length - 1)]);
      colorSaturations.push(random(minSat, maxSat));
      colorLightnesses.push(random(minLight, maxLight));
    }

    colorHues.push(hues[0]);
    colorSaturations.push(baseSaturation);
    colorLightnesses.push(rangeLightness);

    // Sort lightnesses if needed
    if (colorArrangement !== 'default') {
      const sortedLightnesses = [...colorLightnesses].sort((a, b) => a - b);
      const centerIndex = Math.floor(sortedLightnesses.length / 2);
      const reordered = new Array(sortedLightnesses.length);

      if (colorArrangement === 'darkCenter') {
        // Place darkest in center
        reordered[centerIndex] = sortedLightnesses[0];
        let leftIndex = centerIndex - 1;
        let rightIndex = centerIndex + 1;
        for (let i = 1; i < sortedLightnesses.length; i++) {
          if (leftIndex >= 0) {
            reordered[leftIndex] = sortedLightnesses[i];
            leftIndex--;
            i++;
          }
          if (i < sortedLightnesses.length && rightIndex < sortedLightnesses.length) {
            reordered[rightIndex] = sortedLightnesses[i];
            rightIndex++;
          }
        }
        colorLightnesses.splice(0, colorLightnesses.length, ...reordered);
      } else if (colorArrangement === 'lightCenter') {
        // Place lightest in center
        reordered[centerIndex] = sortedLightnesses[sortedLightnesses.length - 1];
        let leftIndex = centerIndex - 1;
        let rightIndex = centerIndex + 1;
        for (let i = sortedLightnesses.length - 2; i >= 0; i--) {
          if (leftIndex >= 0) {
            reordered[leftIndex] = sortedLightnesses[i];
            leftIndex--;
            i--;
          }
          if (i >= 0 && rightIndex < sortedLightnesses.length) {
            reordered[rightIndex] = sortedLightnesses[i];
            rightIndex++;
          }
        }
        colorLightnesses.splice(0, colorLightnesses.length, ...reordered);
      }
    }

    // Combine H/S/L into colors
    for (let i = 0; i < colorHues.length; i++) {
      colors.push(coordsToHex(colorHues[i], colorSaturations[i], colorLightnesses[i], colorMode));
    }
  } else if (generatorFunction === 'Full Random') {
    for (let i = 0; i < parts; i++) {
      colors.push(coordsToHex(random(0, 360), random(0, 100), random(0, 100), colorMode));
    }
  } else if (generatorFunction === 'Simplex Noise') {
    const simplex = new SimplexNoise(currentSeed);
    const minLight = random(50, 80);
    const maxLight = Math.min(minLight + 40, 95);
    const minSat = random(20, 80);
    const maxSat = random(80, 100);
    const satRamp = maxSat - minSat;
    for (let i = 0; i < parts + 1; i++) {
      colors.push(coordsToHex(simplex.noise2D(.5, (i / parts) * (3 * (minHueDiffAngle / 360))) * 360, minSat + (i / parts) * satRamp, i ? 55 + i / parts * (maxLight - minLight) : random(10, 40), colorMode));
    }
  } else if (generatorFunction === 'RandomColor.js') {
    colors = [
      randomColor({ luminosity: 'dark', seed: currentSeed }),
      ...randomColor({ seed: currentSeed + 50, count: parts - 2 }),
      randomColor({ luminosity: 'light', seed: currentSeed + 100 })
    ];
  }
  if (randomOrder) {
    colors = shuffleArray(colors);
  }

  return colors;
}
