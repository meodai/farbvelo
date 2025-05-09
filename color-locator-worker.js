// color-locator-worker.js
// This worker finds where specified RGB colors appear in image data,
// searching from the center outwards.

/**
 * Converts an RGB color object to a string key.
 * @param {{r: number, g: number, b: number}} rgb - The RGB color object.
 * @returns {string} A string representation (e.g., "255-0-0").
 */
function rgbToKey(rgb) {
  return `${rgb.r}-${rgb.g}-${rgb.b}`;
}

/**
 * Calculates the squared Euclidean distance between two RGB colors.
 * This is faster than calculating the actual distance as it avoids Math.sqrt().
 * @param {{r: number, g: number, b: number}} color1
 * @param {{r: number, g: number, b: number}} color2
 * @returns {number} The squared distance between the colors.
 */
function colorDistanceSq(color1, color2) {
  const dr = color1.r - color2.r;
  const dg = color1.g - color2.g;
  const db = color1.b - color2.b;
  return dr * dr + dg * dg + db * db;
}

/**
 * Finds locations of target RGB colors within image data.
 * @param {ImageData} imageData - Object with width, height, and data (Uint8ClampedArray).
 * @param {Array<{r: number, g: number, b: number}>} targetRgbColors - Array of RGB colors to find.
 * @param {Object} [options={}] - Optional configuration.
 * @param {number} [options.maxPositionsPerColor=30] - Max positions to find per color.
 * @param {number} [options.distanceThresholdSq=900] - Squared color distance threshold for a match (e.g., 30*30).
 * @returns {Object} An object mapping color keys to arrays of found positions.
 */
function findColorLocations(imageData, targetRgbColors, options = {}) {
  const {
    maxPositionsPerColor = 30,
    distanceThresholdSq = 900 // Default allows for some tolerance
  } = options;

  const { width, height, data } = imageData;

  const foundLocations = {};
  targetRgbColors.forEach(rgb => {
    foundLocations[rgbToKey(rgb)] = [];
  });

  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const maxSearchRadius = Math.sqrt(centerX * centerX + centerY * centerY); // Max distance from center to a corner

  let colorsStillSearching = targetRgbColors.length;
  const radiusIncrementBase = Math.max(1, Math.floor(Math.min(width, height) / 200));

  for (let radius = 0; radius <= maxSearchRadius && colorsStillSearching > 0; /* radius incremented below */) {
    let angleStep;
    if (radius < 1) { // Center pixel
      angleStep = 2 * Math.PI; // Will only run once for angle = 0
    } else if (radius < 20) {
      angleStep = Math.PI / 8;
    } else if (radius < 50) {
      angleStep = Math.PI / 6;
    } else if (radius < 100) {
      angleStep = Math.PI / 4;
    } else {
      angleStep = Math.PI / 3;
    }

    for (let angle = 0; angle < 2 * Math.PI; angle += angleStep) {
      const x = (radius === 0) ? centerX : Math.round(centerX + radius * Math.cos(angle));
      const y = (radius === 0) ? centerY : Math.round(centerY + radius * Math.sin(angle));

      if (x < 0 || x >= width || y < 0 || y >= height) {
        continue; // Pixel is outside image bounds
      }

      const pixelIndex = (y * width + x) * 4;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      const a = data[pixelIndex + 3];

      if (a < 128) { // Skip significantly transparent pixels
        continue;
      }

      const currentPixelRgb = { r, g, b };

      for (const targetRgb of targetRgbColors) {
        const targetKey = rgbToKey(targetRgb);
        if (foundLocations[targetKey].length >= maxPositionsPerColor) {
          continue; // Already found enough positions for this color
        }

        const distSq = colorDistanceSq(currentPixelRgb, targetRgb);

        if (distSq < distanceThresholdSq) {
          foundLocations[targetKey].push({
            x: x / width,          // Normalized x-coordinate
            y: y / height,         // Normalized y-coordinate
            distance: maxSearchRadius > 0 ? radius / maxSearchRadius : 0 // Normalized distance from center
          });

          if (foundLocations[targetKey].length === maxPositionsPerColor) {
            colorsStillSearching--;
            if (colorsStillSearching === 0) break; // All colors found max positions
          }
          break; // Pixel matched one target color, move to next pixel on spiral
        }
      }
      if (colorsStillSearching === 0) break; // All colors found max positions
      if (radius === 0) break; // Center pixel processed, move to next radius
    }

    // Increment radius for next iteration of the spiral
    let currentIncrement = radiusIncrementBase;
    if (radius === 0) { // Ensure progression from center
        currentIncrement = Math.max(1, radiusIncrementBase);
    } else {
        if (radius > 100) currentIncrement += radiusIncrementBase; // Speed up for larger radii
        if (radius > 200) currentIncrement += radiusIncrementBase * 2;
    }
    radius += currentIncrement;
  }

  // For any colors where no positions were found, add a default center position
  targetRgbColors.forEach(rgb => {
    const key = rgbToKey(rgb);
    if (foundLocations[key].length === 0) {
      foundLocations[key].push({
        x: 0.5,
        y: 0.5,
        distance: 0,
        isDefault: true
      });
    }
  });

  return foundLocations;
}

// Worker message handler
self.onmessage = function(event) {
  try {
    const eventData = event.data || {};
    const { imageData, targetRgbColors, options } = eventData;

    // Validate inputs
    if (!imageData || !imageData.data || typeof imageData.width !== 'number' || typeof imageData.height !== 'number') {
      throw new Error('Invalid or missing imageData. Expected {data, width, height}.');
    }
    if (!targetRgbColors || !Array.isArray(targetRgbColors) || targetRgbColors.length === 0) {
      throw new Error('Invalid or missing targetRgbColors. Expected an array of {r,g,b} objects.');
    }
    for (const color of targetRgbColors) {
        if (typeof color.r !== 'number' || typeof color.g !== 'number' || typeof color.b !== 'number') {
            throw new Error('Invalid RGB color format in targetRgbColors. Each color must be an object with r, g, b properties as numbers.');
        }
    }

    const locations = findColorLocations(imageData, targetRgbColors, options || {});

    // Ensure the result is structured-clone compliant
    const result = {
      status: 'SUCCESS',
      locations: {}
    };
    Object.keys(locations).forEach(key => {
      result.locations[key] = locations[key].map(pos => ({
        x: pos.x,
        y: pos.y,
        distance: pos.distance,
        isDefault: !!pos.isDefault
      }));
    });
    self.postMessage(result);

  } catch (error) {
    self.postMessage({
      status: 'ERROR',
      message: error.message,
      stack: error.stack // Stack might not always be available or cloneable
    });
  }
};
