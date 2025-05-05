// Clipboard and export utility functions for Farbvelo

export function buildImage(colors, lightmode, size = 100, padding = 0.1, hardStops = false) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const innerSize = size * (1 - padding * 2);
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  ctx.fillStyle = lightmode ? "#fff" : "#000";
  ctx.fillRect(0, 0, size, size);
  colors.forEach((color, i) => {
    if (hardStops) {
      ctx.fillStyle = color;
      ctx.fillRect(
        size * padding,
        size * padding + (i / colors.length) * innerSize - 1,
        innerSize,
        innerSize / colors.length + 1
      );
    } else {
      gradient.addColorStop(Math.min(1, i / colors.length), color);
    }
  });
  if (!hardStops) {
    ctx.fillStyle = gradient;
    ctx.fillRect(
      size * padding,
      size * padding,
      size * (1 - padding * 2),
      size * (1 - padding * 2)
    );
  }
  return canvas;
}

export function buildSVG(colors, size = 100, padding = 0.1, hardStops = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="gradient" x1="50%" y1="0%" x2="50%" y2="100%">
        ${colors
          .map((color, i) => {
            return `<stop offset="${(i / colors.length) * 100}%" stop-color="${color}" />`;
          })
          .join("")}
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#gradient)" />
  </svg>`;
}

export function copyExport({
  exportAs,
  colorList,
  colors,
  lightmode,
  buildImageFn,
  buildSVGFn,
  setCopying
}) {
  clearTimeout(copyExport.copyTimer);
  setCopying(true);
  copyExport.copyTimer = setTimeout(() => setCopying(false), 1000);
  if (exportAs === "image") {
    buildImageFn(colors, lightmode, 1000, 0.1, true).toBlob((blob) => {
      const item = new ClipboardItem({
        "image/png": blob,
      });
      navigator.clipboard.write([item]);
    });
  } else if (exportAs === "SVG" || exportAs === "svg") {
    const svg = buildSVGFn(colors, 1000, 0.1, true);
    navigator.clipboard.writeText(svg);
  } else {
    navigator.clipboard.writeText(colorList);
  }
}

export function shareURL(url) {
  navigator.clipboard.writeText(url);
}
