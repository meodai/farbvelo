import fs from 'node:fs/promises';
import path from 'node:path';
import babel from '@babel/core';

const { transformAsync } = babel;

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const projectRoot = process.cwd();
  const inputPath = path.join(projectRoot, 'node_modules', 'colorsort-js', 'dist', 'colorsort.js');
  const outDir = path.join(projectRoot, 'vendor');
  const outPath = path.join(outDir, 'colorsort-js.es5.js');

  if (!(await fileExists(inputPath))) {
    console.error(`colorsort-js input not found: ${inputPath}`);
    process.exit(1);
  }

  await fs.mkdir(outDir, { recursive: true });

  // Tiny incremental optimization: skip if output is newer than input.
  try {
    const [inStat, outStat] = await Promise.all([fs.stat(inputPath), fs.stat(outPath)]);
    if (outStat.mtimeMs >= inStat.mtimeMs) {
      return;
    }
  } catch {
    // (re)generate if output doesn't exist
  }

  const source = await fs.readFile(inputPath, 'utf8');

  const result = await transformAsync(source, {
    filename: inputPath,
    babelrc: false,
    configFile: false,
    sourceMaps: false,
    comments: false,
    compact: true,
    presets: [
      ['@babel/preset-env', { targets: { ie: '11' }, modules: false }]
    ],
    plugins: [
      '@babel/plugin-transform-class-properties'
    ]
  });

  if (!result?.code) {
    console.error('Failed to transpile colorsort-js.');
    process.exit(1);
  }

  await fs.writeFile(outPath, result.code + '\n', 'utf8');
}

await main();
