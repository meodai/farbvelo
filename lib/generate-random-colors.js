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
    colors.push(coordsToHex(hues[0], baseSaturation, baseLightness * random(0.25, 0.75), colorMode));
    const minSat = random(50, 70);
    const maxSat = minSat + 30;
    const minLight = random(35, 70);
    const maxLight = Math.min(minLight + random(20, 40), 95);
    const remainingHues = [...hues];
    for (let i = 0; i < parts - 2; i++) {
      const hue = remainingHues.splice(random(0, remainingHues.length - 1), 1)[0];
      const saturation = random(minSat, maxSat);
      const light = baseLightness + random(0, 10) + ((rangeLightness / (parts - 1)) * i);
      colors.push(coordsToHex(hue, saturation, random(light, maxLight), colorMode));
    }
    colors.push(coordsToHex(remainingHues[0], baseSaturation, rangeLightness + 10, colorMode));
  } else if (generatorFunction === 'Legacy') {
    const part = Math.floor(amount / parts);
    const reminder = amount % parts;
    const baseHue = random(0, 360);
    const hues = new Array(Math.round(360 / minHueDiffAngle)).fill('').map((_, i) => (baseHue + i * minHueDiffAngle) % 360);
    const baseSaturation = random(5, 40);
    const baseLightness = random(0, 20);
    const rangeLightness = 90 - baseLightness;
    colors.push(coordsToHex(hues[0], baseSaturation, baseLightness * random(0.25, 0.75), colorMode));
    for (let i = 0; i < (part - 1); i++) {
      colors.push(coordsToHex(hues[0], baseSaturation, baseLightness + (rangeLightness * Math.pow(i / (part - 1), 1.5)), colorMode));
    }
    const minSat = random(50, 70);
    const maxSat = minSat + 30;
    const minLight = random(45, 80);
    const maxLight = Math.min(minLight + 40, 95);
    for (let i = 0; i < (part + reminder - 1); i++) {
      colors.push(coordsToHex(hues[random(0, hues.length - 1)], random(minSat, maxSat), random(minLight, maxLight), colorMode));
    }
    colors.push(coordsToHex(hues[0], baseSaturation, rangeLightness, colorMode));
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
