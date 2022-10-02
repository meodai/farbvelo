import init, {
  pigments
} from 'pigmnts';

async function runPigment(canvas, colorsLength, colors) {
  await init('https://unpkg.com/pigmnts/pigmnts_bg.wasm');
  const palette = pigments(canvas, colorsLength);

  console.log(palette)

  colors.colorsValues = palette.map(c => c.hex);
}

export default runPigment;
