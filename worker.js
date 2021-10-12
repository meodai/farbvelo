import chroma from 'chroma-js';

/**
 *
 * @param {Number} min
 * @param {Number} max
 * @returns {Number}
 */
const getRandomIntInclusive = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 *
 * @param {Uint8ClampedArray} dataArray
 * @returns {Array<Array<{Number}>>}
 */
const calculateColorsArray = (dataArray) => {
  const pixels = [];
  const length = dataArray.length;

  for (let i = 0; i < length; i += 4) {
    pixels.push([dataArray[i], dataArray[i + 1], dataArray[i + 2]]);
  }

  return pixels;
};

/**
 *
 *
 * @param {Number} colorValue
 * @param {{min: Number, max: Number}} bounds
 * @returns {{min: Number, max: Number}}
 */
const getColorBounds = (colorValue, bounds) => ({
  min: Math.min(colorValue, bounds.min),
  max: Math.max(colorValue, bounds.max),
});

/**
 *
 * @param {Array<Array<Number>>} pixels
 * @returns {{r: {min:Number, max:Number}, g: {min:Number, max:Number}, b: {min:Number, max:Number}}}
 */
const calculateColorRanges = (pixels) =>
  pixels.reduce(
    (acc, pixel) => {
      acc.r = getColorBounds(pixel[0], acc.r);
      acc.g = getColorBounds(pixel[1], acc.g);
      acc.b = getColorBounds(pixel[2], acc.b);

      return acc;
    }, {
      r: {
        min: 255,
        max: 0,
      },
      g: {
        min: 255,
        max: 0,
      },
      b: {
        min: 255,
        max: 0,
      },
    }
  );

/**
 *
 * @param {Array<Number>} rgbColors
 * @returns {Array<Number>}
 */
const calculateAverageRGBSquared = (rgbColors) =>
  rgbColors
  .reduce(
    (averageColor, currentColor) => {
      for (let i = 0; i < currentColor.length; i++) {
        averageColor[i] += Math.pow(currentColor[i], 2);
      }
      return averageColor;
    },
    [0, 0, 0]
  )
  .map((value) => Math.sqrt(value / rgbColors.length));

/**
 *
 * @param {Array<Number>} rgbColors
 * @returns {Array<Number>}
 */
const calculateAverageRGB = (rgbColors) =>
  rgbColors
  .reduce(
    (averageColor, currentColor) => {
      for (let i = 0; i < currentColor.length; i++) {
        averageColor[i] += currentColor[i];
      }
      return averageColor;
    },
    [0, 0, 0]
  )
  .map((value) => value / rgbColors.length);

/**
 *
 * @param {{r: {min:Number, max:Number}, g: {min:Number, max:Number}, b: {min:Number, max:Number}}} ranges
 */
const createRandomCentroid = (ranges) => [
  getRandomIntInclusive(ranges['r'].min, ranges['r'].max),
  getRandomIntInclusive(ranges['g'].min, ranges['g'].max),
  getRandomIntInclusive(ranges['b'].min, ranges['b'].max),
];

/**
 *
 * @param {Array<Array<Number>>} pixels
 * @returns {Array<Number>}
 */
const getRandomCentroid = (pixels) =>
  pixels[getRandomIntInclusive(0, pixels.length - 1)];

const createInitialClusters = (pixels, clusterCount, ranges) => {
  const clusters = [];
  for (let i = 0; i < clusterCount; i++) {
    clusters.push({
      // centroid: createRandomCentroid(ranges),
      centroid: getRandomCentroid(pixels),
      points: [],
    });
  }

  return clusters;
};

/**
 *
 * @param {Array<Number>} a
 * @param {Array<Number>} b
 * @returns {Number}
 */
const calulateRGBEuclideanDistance = (a, b) =>
  Math.sqrt(
    2 * Math.pow(b[0] - a[0], 2) +
    4 * Math.pow(b[1] - a[1], 2) +
    3 * Math.pow(b[2] - a[2], 2)
  );

/**
 *
 * @param {Array<Number>} a
 * @param {Array<Number>} b
 * @returns {Number}
 */
const calculateBetterRGBEuclideanDistance = (a, b) => {
  const rDelta = Math.pow(b[0] - a[0], 2);
  const gDelta = Math.pow(b[1] - a[1], 2);
  const bDelta = Math.pow(b[2] - a[2], 2);
  const r = (b[0] - a[0]) / 2;
  return Math.sqrt(
    2 * rDelta + 4 * gDelta + 3 * bDelta + (r * (rDelta - bDelta)) / 256
  );
};

const updateClusters = (clusters, ranges, pixels) =>
  clusters.map((cluster) => ({
    points: [],
    _previousCentroid: cluster.centroid,
    percentage: Math.round((cluster.points.length / pixels.length) * 100),
    centroid: cluster.points.length > 0 ?
      calculateAverageRGB(cluster.points) :
      createRandomCentroid(ranges),
  }));

const calculateClusters = (clusters, pixels) => {
  pixels.forEach((pixel, i) => {
    let minDistance = Number.MAX_VALUE;
    let closestCentroidIndex = 0;

    clusters.forEach((cluster, i) => {
      const distance = calculateBetterRGBEuclideanDistance(
        cluster.centroid,
        pixel
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestCentroidIndex = i;
      }
    });
    clusters[closestCentroidIndex].points.push(pixel);
  });

  return clusters;
};

const filterPixels = (pixels, filterOptions) => {
  const filteredPixels = [];
  for (let i = 0; i < pixels.length; i++) {
    const [hue, saturation, lightness] = chroma([pixels[i][0], pixels[i][1], pixels[i][2]], 'rgb').hsl();
    if (
      saturation > filterOptions.saturation &&
      lightness > filterOptions.lightness
    ) {
      filteredPixels.push(pixels[i]);
    }
  }

  return filteredPixels;
};

const calculateKMeansClustering = (rawPixels, k, filterOptions) => {
  const MAX_ITERATIONS = 15;
  const DISTANCE_DELTA = 0.2;
  const pixels = filterPixels(rawPixels, filterOptions);
  const ranges = calculateColorRanges(pixels);
  let clusters = createInitialClusters(pixels, k, ranges);

  let iterations = 0;
  do {
    iterations += 1;
    clusters = calculateClusters(clusters, pixels);
    clusters = updateClusters(clusters, ranges, pixels);
  } while (
    clusters.some(
      (c) =>
      calculateBetterRGBEuclideanDistance(
        c.centroid,
        c._previousCentroid
      ) > DISTANCE_DELTA
    ) &&
    iterations < MAX_ITERATIONS
  );

  return clusters
    .map((c) => ({
      color: c.centroid.map((v) => Math.ceil(v)),
      percentage: c.percentage,
    }))
    .sort((a, b) => b.percentage - a.percentage);
};

let pixels = null;

self.addEventListener('message', e => {
    switch (e.data.type) {
        case 'GENERATE_COLORS_ARRAY':
            pixels = calculateColorsArray(e.data.imageData.data, e.data.width);
            self.postMessage({
                type: 'GENERATE_COLORS_ARRAY',
                // pixels
            });
            break;
        case 'GENERATE_CLUSTERS':
            const clusters = calculateKMeansClustering(e.data.pixels || pixels, e.data.k, e.data.filterOptions);
            self.postMessage({
                type: 'GENERATE_CLUSTERS',
                clusters
            });
            break;
    }
}, false);
