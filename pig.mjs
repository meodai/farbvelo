import init, {
  pigments
} from 'pigmnts';


export async function runPigment(canvas, colorsLength, colors) {
  await init('node_modules/pigmnts/pigmnts_bg.wasm');
  const palette = pigments(canvas, colorsLength);

  console.log(palette)

  colors.colorsValues = palette.map(c => c.hex);
};

window.runPigment = runPigment;
