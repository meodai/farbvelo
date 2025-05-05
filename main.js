// import Vue from 'vue';
import {hsluvToHex, hpluvToHex} from 'hsluv';
import chroma from 'chroma-js';
import Seedrandom from 'seedrandom';
import SimplexNoise from 'simplex-noise';
import randomColor from 'randomcolor';
import getShareLink from './lib/share-strings';
import {
  quantize as quantizeGifenc
} from "gifenc";
import spectral from 'spectral.js';
import { logColors, shuffleArray, randomStr, coordsToHex, unsplashURLtoID } from './utils.js';

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

const workers = [];
const CANVAS_SCALE = 0.4;

const startWorker = (
  imageUrl,
  imageData,
  width,
  filterOptions,
  colorsLength,
) => {
  const worker = new Worker('./worker.js');

  workers.push(worker);

  worker.addEventListener(
    'message',
    (e) => {
      switch (e.data.type) {
        case 'GENERATE_COLORS_ARRAY':
          const pixels = e.data.colors;
          for (let i = 0; i < 1; i++) {
            worker.postMessage({
              type: 'GENERATE_CLUSTERS',
              pixels,
              k: colorsLength,
              filterOptions,
            });
          }
          break;
        case 'GENERATE_CLUSTERS':
          console.timeEnd('calculating colors');
          const clusters = e.data.colors;
          colors.colorsValues = clusters.sort((c1,c2) =>
            chroma(c1).lch()[0] - chroma(c2).lch()[0]
          ).map(cluster =>
            cluster
          );

          document.documentElement.classList.remove('is-imagefetching');
        break;
      }
    },
    false
  );

  worker.postMessage({
    type: 'GENERATE_COLORS_ARRAY',
    imageData,
    width,
    k: colorsLength,
  });
};

const imageLoadCallback = (image, canvas, ctx, colorsLength, quantizationMethod) => {
  console.time('calculating colors');

  const width = Math.floor(image.naturalWidth * CANVAS_SCALE);
  const height = Math.floor(image.naturalHeight * CANVAS_SCALE);
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);


  const filterOptions = {
    saturation: 0,
    lightness: 0
  };

  //console.log(quantizationMethod === 'pigmnts' && window.runPigments)

  if (quantizationMethod === 'gifenc') {
    const rgbColors = quantizeGifenc(imageData.data, colorsLength);
    const hexColors = rgbColors.map(rgb => chroma(rgb[0], rgb[1], rgb[2]).hex());

    colors.colorsValues = hexColors;
    document.documentElement.classList.remove('is-imagefetching');
  /*} else if (quantizationMethod === 'pigmnts' && window.runPigments) {
    window.runPigments(canvas, colorsLength, colors);
  */
  } else {
    //art-palette
    startWorker(image.src, imageData, width, filterOptions, colorsLength);
  }
};

const loadImage = (source, colorsLength, quantizationMethod) => {
  workers.forEach(w => w.terminate());

  const image = new Image();
  image.crossOrigin = 'Anonymous';
  image.src = source;
  image.onload = imageLoadCallback.bind(null, image, canvas, ctx, colorsLength, quantizationMethod);
};

Vue.component('color', {
  props: ['colorhex', 'name', 'colorvaluetype', 'contrastcolor', 'nextcolorhex', 'contrastcolors'],
  template: `<aside @click="copy" class="color" v-bind:style="{'--color': colorhex, '--color-next': nextcolorhex, '--color-text': contrastcolor, '--color-best-contrast': bestContrast}">
              <div class="color__values">
                <var class="color__value" v-html="value"></var>
                <section class="color__contrasts" v-if="hasWCAGColorPairs" aria-label="good contrast colors">
                  <ol>
                    <li v-for="c in contrastcolors" v-if="c" :key="c" :style="{'--paircolor': c}"><var>{{c}}</var></li>
                  </ol>
                </section>
              </div>
              <h3 class="color__name">{{ name && name.name }}</h3>
              <section class="color__info" v-bind:aria-label="'color values for ' + (name && name.name)">
                <ol>
                  <li>{{ valueRGB }}</li>
                  <li>{{ valueHSL }}</li>
                  <li>{{ valueCMYK }}</li>
                </ol>
              </section>
            </aside>`,

  methods: {
    copy: function () {
      navigator.clipboard.writeText(`${this.name.name} ・ ${this.valueHEX} ・ ${this.valueRGB} ・ ${this.valueHSL} ・ ${this.valueCMYK} `);
    }
  },
  computed: {
    valueHEX() {
      return this.colorhex;
    },
    valueCMYK() {
      return chroma(this.colorhex).css('cmyk');
    },
    valueRGB() {
      return chroma(this.colorhex).css('rgb');
    },
    valueHSL() {
      return chroma(this.colorhex).css('hsl');
    },
    value() {
      if(this.colorvaluetype === 'hex') {
        return `<span>${this.colorhex}</span>`;
      } else if (this.colorvaluetype === 'cmyk') {
        const letters = 'CMYK'.split('');
        return `${chroma(this.colorhex).cmyk().map((d,i) => `${letters[i]} <sup>${Math.round(d * 100)}%</sup>`).join(' ')}`
      } else if (this.colorvaluetype === 'rgb') {
        const rgb = chroma(this.colorhex).rgb();
        const letters = 'RGB'.split('');

        return `${rgb.map((d,i) => `${letters[i]} <sup>${d}</sup>`).join(' ')}`
      } else if (this.colorvaluetype === 'hsl') {
        const hsl = chroma(this.colorhex).hsl();
        hsl.pop()
        const letters = 'HSL'.split('');
        return `${hsl.map(
          (d, i) => `${letters[i]} <sup>${Math.round(d * 1000) / (i ? 10 : 1000)}${i ? '%' : '°'}</sup>`
        ).join(' ')}`
      } else {
        return chroma(this.colorhex).css(this.colorvaluetype);
      }
    },
    hasWCAGColorPairs() {
      return this.contrastcolors.filter(c => c !== false);
    },
    bestContrast() {
      return chroma.contrast(this.colorhex, 'black') > chroma.contrast(this.colorhex, 'white') ? 'black' : 'white';
    }
  }
});

let colors = new Vue({
  el: '#app',
  data: () => {
    return {
      colorsValues: [],
      names: [],
      amount: 6,
      colorsInGradient: 4,
      settingsVisible: false,
      shareVisible: false,
      randomOrder: false,
      hasGradients: true,
      hasBackground: false,
      animateBackgroundIntro: false,
      hasOutlines: false,
      highContrast: false,
      autoHideUI: false,
      expandUI: false,
      hasBleed: false,
      hasGrain: false,
      hideText: false,
      showContrast: false,
      addBWContrast: true,
      padding: .175,
      colorMode: 'hsluv',
      colorModeList: ['hsluv', 'oklch', 'hcl', 'hsl', 'hcg', 'hsv', 'hpluv'],
      minHueDistance: 60,
      interpolationColorModel: 'lab',
      interpolationColorModels: ['lab', 'oklab', 'spectral', 'rgb', 'lrgb', 'hcl', 'hsl', 'hsv', 'hsi', 'oklch'],
      colorValueType: 'hex',
      colorValueTypes: ['hex', 'rgb', 'hsl', 'cmyk'],
      generatorFunction: 'Legacy',
      generatorFunctionList: ['Hue Bingo', 'Legacy', 'ImageExtract', 'RandomColor.js', 'Simplex Noise', 'Full Random'],
      nameLists: [
        'default', 'bestOf', 'wikipedia', 'basic', 'html', 'japaneseTraditional', 'leCorbusier', 'ntc', 'osxcrayons', 'ral', 'ridgway', 'sanzoWadaI', 'thesaurus', 'werner', 'windows', 'x11', 'xkcd'
      ],
      quantizationMethod: 'art-palette',
      quantizationMethods: ['art-palette', 'gifenc'/*, 'pigmnts'*/],
      nameList: 'bestOf',
      changedNamesOnly: false,
      isLoading: true,
      isAnimating: true,
      currentSeed: randomStr(),
      rnd: new Seedrandom(),
      moveTimer: null,
      showUI: true,
      lightmode: false,
      sameHeightColors: false,
      exportAs: 'jsArray',
      isCopiying: false,
      imgURL: '',
      paletteTitle: 'Double Rainbow',
      trackInURL: [
        {key: 's', prop: 'currentSeed'},
        {key: 'a', prop: 'amount', p: parseInt}, //6
        {key: 'cg', prop: 'colorsInGradient', p: parseInt}, //4
        {key: 'hg', prop: 'hasGradients', p: Boolean}, // true
        {key: 'hb', prop: 'hasBackground', p: Boolean}, // false
        {key: 'ho', prop: 'hasOutlines', p: Boolean}, // false
        {key: 'hc', prop: 'highContrast', p: Boolean}, // false
        {key: 'ht', prop: 'hideText', p: Boolean}, // false,
        {key: 'b', prop: 'hasBleed', p: Boolean}, // false,
        {key: 'p', prop: 'padding', p: parseFloat}, // .175
        {key: 'md', prop: 'minHueDistance', p: parseInt}, // 60,
        {key: 'cm', prop: 'interpolationColorModel'}, // 'lab'
        {key: 'f', prop: 'generatorFunction'}, // 'Legacy'
        {key: 'c', prop: 'colorMode'}, // 'hsluv'
        {key: 'sc', prop: 'showContrast', p: Boolean}, // false
        {key: 'bw', prop: 'addBWContrast', p: Boolean}, // true
        {key: 'ah', prop: 'autoHideUI', p: Boolean}, // false
        {key: 'iu', prop: 'imgURL'}, // ''
        {key: 'lm', prop: 'lightmode', p: Boolean}, // true
        {key: 'sm', prop: 'sameHeightColors', p: Boolean}, // false
        {key: 'cv', prop: 'colorValueType'}, // hex,
        {key: 'qm', prop: 'quantizationMethod'}, // art-palette,
        {key: 'nl', prop: 'nameList'}, // nameList,
      ],
    }
  },
  watch: {
    amount: function () {
      this.amount = Math.min(Math.max(this.amount, 3), 10);
      this.colorsInGradient = Math.min(this.colorsInGradient, this.amount);
    },
    colorsInGradient: function () {
      this.colorsInGradient = Math.min(Math.max(this.colorsInGradient, 2), this.amount);
      this.newColors();
    },
    quantizationMethod: function () {
      this.newColors();
    },
    randomOrder: function () {
      this.newColors();
    },
    minHueDistance: function () {
      this.newColors();
    },
    colorMode: function () {
      this.newColors();
    },
    lightmode: function(newValue) {
      if (newValue) {
        document.querySelector('body').classList.add('lightmode');
      } else {
        document.querySelector('body').classList.remove('lightmode');
      }
      this.updateMeta();
    },
    generatorFunction: function () {
      this.newColors();
      if ( this.generatorFunction == 'Legacy' ) {
        console.info('Legacy: Results in mostly vaporwavey color combinations. Old and broken color engine intially used on https://codepen.io/meodai/pen/RerqjG?editors=1100.');
      } else if ( this.generatorFunction == 'Hue Bingo' ) {
        console.info('Hue Bingo: Selects ℕ0 hue`s (color stops) at a user defined minimum angle ∠, using a controlled random lightness ramp.');
      } else if ( this.generatorFunction == 'Full Random' ) {
        console.info('Random: Picks ℕ0 random hsl colors. Make sure to use "Mix Padding" with this one.');
      } else if ( this.generatorFunction === 'RandomColor.js' ) {
        console.info('RandomColor.js: https://randomcolor.lllllllllllllllll.com/');
      }
    },
    colorsValues: function () {
      this.updateMeta();
    },
    nameList: function () {
      this.getNames(this.colorsValues, true);
    }
  },
  computed: {
    lastColor() {
      return this.colors && this.colors.length ? this.colors[this.colors.length - 1] : '#212121';
    },
    lastColorContrast() {
      return chroma(this.lastColor).luminance() < .5 ? '#fff' : '#212121';
    },
    firstColor() {
      return this.colors && this.colors.length ? this.colors[0] : '#212121';
    },
    firstColorContrast() {
      return chroma(this.firstColor).luminance() < .5 ? '#fff' : '#212121';
    },
    colors() {
      let colors;

      if (this.interpolationColorModel === 'spectral' && this.colorsValues.length < this.amount) {
        // define the original array of X colors
        const xColors = [...this.colorsValues];

        // define the desired length of the new array
        const yLength = this.amount;

        // calculate the number of gaps between colors
        const numGaps = xColors.length - 1;

        // calculate the spacing between intermediate colors
        const spacing = numGaps > 0 ? (yLength - 2) / numGaps : 0;

        // create the new array of Y colors
        const yColors = new Array(yLength);

        // set the first color in the new array to match X
        yColors[0] = xColors[0];

        // compute the intermediate colors using spectral mixing
        let yIndex = 1;
        for (let i = 0; i < numGaps; i++) {
          const color1 = xColors[i];
          const color2 = xColors[i + 1];
          const gapLength = spacing + 1;
          for (let j = 1; j <= gapLength; j++) {
            const mixRatio = j / gapLength;
            const mixedColor = spectral.mix(color1, color2, mixRatio);
            yColors[yIndex] = mixedColor;
            yIndex++;
          }
        }

        // set the last color in the new array to match X
        yColors[yLength - 1] = xColors[xColors.length - 1];
        colors = chroma.scale(yColors).padding(parseFloat(this.padding)).colors(this.amount);

      } else {
        colors = chroma
          .scale(this.colorsValues.length ? this.colorsValues : ['#202124', '#fff'])
          .padding(parseFloat(this.padding))
          .mode(this.interpolationColorModel !== 'spectral' ? this.interpolationColorModel : 'lch')
          .colors(this.amount);
      }

      this.getNames(colors);

      logColors(colors);

      return colors;
    },
    wcagContrastColors() {
      return this.colors.map(color =>
        (this.addBWContrast ? [...this.colors, '#fff', '#000'] : this.colors).map(
          color2 => (4.5 <= chroma.contrast(color, color2) ? color2 : false)
        )
      )
    },
    gradientStops() {
      const gradient = [...this.colors];
      gradient[0] += ' 12vh'
      gradient[gradient.length - 1] += this.sameHeightColors ? ' 80%' : ' 69%'
      return gradient.join(',');
    },
    backgroundGradient() {
      /*
      // hard stops
      let col = this.colors.reduce((r,d,i) => (`${r ? r + ',' : ''} ${d} ${((i)/this.colors.length) * 100}%, ${d} ${((i + 1)/this.colors.length) * 100}%`),'');
      return `linear-gradient(to bottom, ${col})`;
      */

      return `linear-gradient(to bottom, ${this.gradientStops})`;
    },
    appStyles() {
      return {
        '--color-first': this.firstColor,
        '--color-last': this.lastColor,
        '--color-last-contrast': this.lastColorContrast,
        '--color-first-contrast': this.firstColorContrast,
        '--colors': this.colors.length,
      }
    },
    appClasses() {
      return {
        'is-loading': this.isLoading,
        'is-animating': this.isAnimating,
        'wrap__hidetext': this.hideText,
        'wrap__showcontrast': this.showContrast,
        'wrap__hasOutlines': this.hasOutlines,
        'wrap__highContrast': this.highContrast,
        'wrap__hasGradients': this.hasGradients,
        'wrap__showSettings': this.settingsVisible,
        'wrap__showShare': this.shareVisible,
        'wrap__hasBackground': this.hasBackground,
        'wrap__hasBleed': this.hasBleed,
        'wrap__hideUI': !this.showUI,
        'wrap__expandUI': this.expandUI,
        'wrap__hasDithering': this.hasGrain,
        'wrap__lightmode': this.lightmode,
        'wrap__sameHeightColors': this.sameHeightColors,
      }
    },
    namedColorList() {
      return this.names.map(color => {
        const c = chroma(color.requestedHex);

        return {
          name: color.name,
          value: color.requestedHex,
          values: {
            hex: color.requestedHex,
            rgb: c.css('rgb'),
            hsl: c.css('hsl'),
            cmyk: c.css('cymk'),
          },
        }
      });
    },

    colorList() {
      const namedColors = this.namedColorList.map(color => ({
        ...color,
        value: color.values[this.colorValueType]
      }));

      if (this.exportAs === 'list') {
        return namedColors.map(c => c.value).join('\n');
      } else if (this.exportAs === 'csvList') {
        return `name,value${namedColors.reduce((r,c) => `${r}\n${c.name},${c.value}`,'') }\n`;
      } else if (this.exportAs === 'jsArray') {
        return `[\n  "${namedColors.map(c => c.value).join('", \n  "')}"\n]`;
      } else if (this.exportAs === 'jsObject') {
        return `{${namedColors.reduce((r,c) => `${r}\n  "${c.name}": "${c.value}",`,'') }\n}`;
      } else if (this.exportAs === 'css') {
        return `${namedColors.reduce((r,c) => `${r}${r ? `\n` : ''}--${CSS.escape(c.name.replace(/ /g,'-')).toLowerCase()}: ${c.value};`,'') }`;
      } else if (this.exportAs === 'cssGradient') {
        return `linear-gradient(\n  ${namedColors.map(c => c.value).join(', \n  ')}\n);`;
      }
    },
    currentURL() {
      return window.location.origin + "/?s=" + this.constructURL();
    },
  },
  methods: {
    random(min = 1, max) {
      if (!max) return this.rnd() * min;
      return Math.floor(this.rnd() * (max - min + 1)) + min;
    },
    getContrastColor(color) {
      const currentColor = chroma(color);
      const lum = currentColor.luminance();
      return lum < 0.15
        ? currentColor.set('hsl.l', '+.25').hex()
        : currentColor.set('hsl.l', '-.35').hex();
    },
    generateRandomColors(
      total,
      mode = 'lab',
      padding = .1,
      parts = 4,
      randomOrder = false,
      minHueDiffAngle = 60,
    ) {
      let colors = [];

      minHueDiffAngle = parseInt(minHueDiffAngle);
      total = parseInt(total);
      parts = parseInt(parts);

      minHueDiffAngle = Math.min(minHueDiffAngle, 360/parts);

      if (this.generatorFunction === 'Hue Bingo') {
        // create an array of hues to pick from.
        const baseHue = this.random(0, 360);
        const hues = new Array(Math.round( 360 / minHueDiffAngle) ).fill('').map((offset, i) => {
          return (baseHue + i * minHueDiffAngle) % 360;
        });

        //  low saturation color
        const baseSaturation = this.random(5, 40);
        const baseLightness = this.random(0, 20);
        const rangeLightness = 90 - baseLightness;

        colors.push(
          coordsToHex(
            hues[0],
            baseSaturation,
            baseLightness * this.random(0.25, 0.75),
            this.colorMode
          )
        );

        // random shades
        const minSat = this.random(50, 70);
        const maxSat = minSat + 30;
        const minLight = this.random(35, 70);
        const maxLight = Math.min(minLight + this.random(20, 40), 95);
        // const lightDiff = maxLight - minLight;

        const remainingHues = [...hues];

        for (let i = 0; i < parts - 2; i++) {
          const hue = remainingHues.splice(this.random(0, remainingHues.length - 1),1)[0];
          const saturation = this.random(minSat, maxSat);
          const light = baseLightness + this.random(0,10) + ((rangeLightness/(parts - 1)) * i);

          colors.push(
            coordsToHex(
              hue,
              saturation,
              this.random(light, maxLight),
              this.colorMode,
            )
          )
        }

        colors.push(
          coordsToHex(
            remainingHues[0],
            baseSaturation,
            rangeLightness + 10,
            this.colorMode,
          )
        );
      } else if (this.generatorFunction === 'Legacy') {
        const part = Math.floor(total / parts);
        const reminder = total % parts;

        // hues to pick from
        const baseHue = this.random(0, 360);
        const hues = new Array(Math.round( 360 / minHueDiffAngle)).fill('').map((offset, i) => {
          return (baseHue + i * minHueDiffAngle) % 360;
        });

        //  low saturated color
        const baseSaturation = this.random(5, 40);
        const baseLightness = this.random(0, 20);
        const rangeLightness = 90 - baseLightness;

        colors.push(
          coordsToHex(
            hues[0],
            baseSaturation,
            baseLightness * this.random(0.25, 0.75),
            this.colorMode,
          )
        );

        for (let i = 0; i < (part - 1); i++) {
          colors.push(
            coordsToHex(
              hues[0],
              baseSaturation,
              baseLightness + (rangeLightness * Math.pow( i / (part - 1), 1.5)),
              this.colorMode
            )
          );
        }

        // random shades
        const minSat = this.random(50, 70);
        const maxSat = minSat + 30;
        const minLight = this.random(45, 80);
        const maxLight = Math.min(minLight + 40, 95);

        for (let i = 0; i < (part + reminder - 1); i++) {
          colors.push(
            coordsToHex(
              hues[this.random(0, hues.length - 1)],
              this.random(minSat, maxSat),
              this.random(minLight, maxLight),
              this.colorMode,
            )
          )
        }

        colors.push(
          coordsToHex(
            hues[0],
            baseSaturation,
            rangeLightness,
            this.colorMode,
          )
        );
      } else if (this.generatorFunction === 'Full Random') {
        for (let i = 0; i < parts; i++) {
          colors.push(
            coordsToHex(
              this.random(0, 360),
              this.random(0, 100),
              this.random(0, 100),
              this.colorMode,
            )
          )
        }
      } else if (this.generatorFunction === 'Simplex Noise') {
        const simplex = new SimplexNoise(this.currentSeed);

        const minLight = this.random(50, 80);
        const maxLight = Math.min(minLight + 40, 95);
        const minSat = this.random(20, 80);
        const maxSat = this.random(80,100)
        const satRamp = maxSat - minSat;
        for (let i = 0; i < parts + 1; i++) {
          colors.push(
            coordsToHex(
              simplex.noise2D(.5, (i/parts) * (3 * (minHueDiffAngle / 360))) * 360,
              minSat + (i/parts) * satRamp,
              i ? 55 + i/parts * (maxLight - minLight) : this.random(10, 40),
              this.colorMode,
            )
          )
        }
      } else if (this.generatorFunction === 'RandomColor.js') {
        colors = [
          randomColor({
            luminosity: 'dark', //bright, light or dark
            seed: this.currentSeed,
          }),
          ...randomColor({
            //  luminosity: 'bright', //bright, light or dark
            seed: this.currentSeed + 50,
            count: parts - 2,
          }),
          randomColor({
            luminosity: 'light', //bright, light or dark
            seed: this.currentSeed + 100,
          })
        ];
      }

      if ( randomOrder ) {
        colors = shuffleArray(colors);
      }

      return colors;
    },
    copyExport(e) {
      clearTimeout(this.copyTimer);
      this.isCopiying = true;
      this.copyTimer = setTimeout(() => {
        this.isCopiying = false;
      }, 1000);
      if (this.exportAs === 'image') {
        this.buildImage(1000, .1, true).toBlob((blob) => {
          const item = new ClipboardItem({
            "image/png": blob
          });
          navigator.clipboard.write([item]);
        });
      } else {
        navigator.clipboard.writeText(this.colorList);
      }
    },
    getNames(colors, onlyNames) {
      const url = new URL('https://api.color.pizza/v1/');

      const params = {
        noduplicates: true,
        //goodnamesonly: true,
        list: this.nameList,
        values: colors.map(c => c.replace('#', '')),
      };

      //url.pathname += colors.join().replace(/#/g, '');

      url.search = new URLSearchParams(params).toString();

      return fetch(url)
      .then(data => data.json())
      .then(data => {
        this.names = data.colors;
        /*console.log(
          this.names,
          colors.map(c => c.replace('#', ''))
        )*/
        this.paletteTitle = data.paletteTitle;
      });
    },
    buildImage(
      size = 100,
      padding = .1,
      hardStops = false
    ) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const innerSize = size * (1 - padding * 2);
      const ctx = canvas.getContext('2d');

      const gradient = ctx.createLinearGradient(0, 0, 0, size);

      ctx.fillStyle = this.lightmode ? '#fff' : '#000';
      ctx.fillRect(0, 0, size, size);

      this.colors.forEach((color, i) => {
        if (hardStops) {
          ctx.fillStyle = color;

          ctx.fillRect(
            size * padding,
            size * padding + (i / this.colors.length * innerSize) - 1,
            innerSize,
            innerSize / this.colors.length + 1
          );
          /*
          ctx.fillStyle = '#000';
          ctx.font = '20px "Inter UI"';
          ctx.fillText(
            color,
            size * padding * 4,
            size * padding + (i / this.colors.length * innerSize) - 1
            + (innerSize / this.colors.length) * .5 + 10
          );
          */

        } else {
          gradient.addColorStop(Math.min(1, i / this.colors.length), color);
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
    },
    updateMeta() {
      const theme = document.querySelector('[name="theme-color"]');
      const favicons = document.querySelectorAll('[rel="icon"]');
      theme.setAttribute('content', this.colors[0]);

      // Replace favicon
      const faviconBase64 = this.buildImage(100, 0.1).toDataURL('image/png');
      favicons.forEach($icon => $icon.href = faviconBase64);
    },
    settingsFromURL() {
      const params = window.location.search;
      const stateString = new URLSearchParams(params).get('s');

      const colorString = new URLSearchParams(params).get('c');

      if (stateString) {
        let settings = JSON.parse(Buffer.from(stateString, 'base64').toString('ascii'));

        Object.keys(settings).forEach(settingKey => {
          const setting = this.trackInURL.find(s => (s.key === settingKey));
          //this[setting.prop] = settings[settingKey].prop;

          this[setting.prop] = setting.p ? setting.p(settings[settingKey]) : settings[settingKey];
        });

        // side effects :(
        this.animateBackgroundIntro = !!settings.hb;

        return true;
      } else {
        return false;
      }
    },
    shareURL() {
      navigator.clipboard.writeText(`${window.location.origin + "/?s=" + this.constructURL()}`);
    },
    constructURL() {
      const state = this.trackInURL.reduce((o,i) => Object.assign(o, {[i.key]: this[i.prop]}) ,{});
      const serializedState = Buffer.from(JSON.stringify(state)).toString('base64');
      return serializedState;
    },
    updateURL() {
      history.pushState(history.state, document.title, "?s=" + this.constructURL());
    },
    newColors(newSeed) {
      document.documentElement.classList.remove('is-imagefetching');

      if (newSeed) {
        this.currentSeed = randomStr();
      }

      this.rnd = new Seedrandom(this.currentSeed);

      //this.updateURL();

      if (this.generatorFunction !== 'ImageExtract') {
        let colorArr = this.generateRandomColors(
          this.amount,
          this.interpolationColorModel,
          parseFloat(this.padding),
          this.colorsInGradient,
          this.randomOrder,
          this.minHueDistance
        );

        this.colorsValues = colorArr;
      } else if (this.generatorFunction === 'ImageExtract') {
        if (!this.imgURL || newSeed) {
          document.documentElement.classList.add('is-imagefetching');
          fetch('https://source.unsplash.com/random/').then(data => {
            const url = data.url;
            //const id = unsplashURLtoID(url)
            this.imgURL = url;

            loadImage(
              url,
              this.colorsInGradient,
              this.quantizationMethod,
            );
          });
        } else {
          loadImage(
            this.imgURL,
            this.colorsInGradient,
            this.quantizationMethod,
          );
        }

        this.colorsValues = this.colorsValues;
      }
    },
    toggleSettings() {
      this.shareVisible = false;
      if (!this.settingsVisible) {
        this.$refs.panel.scrollTo(0, 0);
      }
      this.settingsVisible = !this.settingsVisible;
    },
    toggleShare() {
      this.settingsVisible = false;
      if (!this.shareVisible) {
        this.$refs.panel.scrollTo(0, 0);
      }
      this.shareVisible = !this.shareVisible;
    },
    cancelSwipe(e) {
      e.stopPropagation();
    },
    hideTools() {
      this.showUI = true;

      if (this.autoHideUI) {
        clearTimeout(this.moveTimer);
        this.moveTimer = setTimeout(() => {
          this.showUI = false;
        }, 3000);
      }
    },
    addMagicControls() {
      document.addEventListener('keydown', (e) => {
        if ( e.code === 'Space' ) {
          this.newColors(true);
        } else if ( e.code === 'ArrowRight' ) {
          this.padding = Math.min(1, this.padding + .01);
        } else if ( e.code === 'ArrowLeft' ) {
          this.padding = Math.max(0, this.padding - .01);
        }
      });

      let isTouching = false;
      let lastX;

      // maybe add swipe controls at some point
      document.addEventListener('pointerdown', (e)  => {
        isTouching = true;
        lastX = e.clientX;
        this.hideTools();
      });

      document.addEventListener('pointermove', (e)=> {
        this.hideTools();
        if(isTouching) {
          e.preventDefault();
          const direction = Math.sign(e.clientX - lastX);
          let lastPadd = this.padding;
          if (direction == -1) {
            this.padding = Math.max(
              0,
              this.padding - (
                Math.abs(e.clientX - lastX) / window.innerWidth
              )
            );
          } else {
            this.padding = Math.min(
              1,
              this.padding + (
                Math.abs(e.clientX - lastX) / window.innerWidth
              )
            );
          }
          lastX = e.clientX;
        }
      });

      document.addEventListener('pointerup', (e)  => {
        isTouching = false;
      });
    },
    handlefile(e) {
      const reader = new FileReader();
      reader.addEventListener('loadend', this.imageLoaded);
      reader.readAsDataURL(e.target.files[0]);
    },
    imageLoaded(event) {
      const srcimg = new Image();

      srcimg.onload = imageLoadCallback.bind(null, srcimg, canvas, ctx, this.colorsInGradient, this.quantizationMethod);
      srcimg.src = event.target.result;
      this.imgURL = event.target.result;
    },
    getShareLink(provider) {
      return getShareLink(provider, this.currentURL, this.paletteTitle);
    }
  },
  mounted() {
    const hadSettings = this.settingsFromURL();
    /*
    window.addEventListener('popstate', () => {
      console.log('ok');
      this.settingsFromURL();
    });
    */
    if('ondrop' in window) {
      document.documentElement.addEventListener('dragover', (e) => {
        e.preventDefault();
      });

      document.documentElement.addEventListener('dragleave', (e) => {
        e.preventDefault();
      });

      document.documentElement.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (e.dataTransfer.files.length && file.type.match(/^image\//)) {
          e.preventDefault();
          this.imgURL = ' ';
          this.generatorFunction = 'ImageExtract';
          const reader = new FileReader();
          reader.addEventListener('loadend', this.imageLoaded);
          reader.readAsDataURL(file);
          setTimeout(() => {
            this.settingsVisible = true;
          }, 500);
        }
      });
    };

    const isPalm = window.matchMedia('(max-width: 850px)');

    if (isPalm.matches) {
      this.expandUI = true;
    }

    const moreContrast = window.matchMedia('(prefers-contrast: more)');

    if (moreContrast.matches) {
      this.highContrast = true;
      this.hasGradients = false;
    }

    this.newColors(!hadSettings);

    if (hadSettings) {
      window.history.replaceState({}, document.title, location.pathname);
    } else {
      const wantLightMode = window.matchMedia('(prefers-color-scheme: light)');
      if ( wantLightMode ) {
        this.lightmode = true;
      }
    }

    this.addMagicControls();

    document.querySelector('body').classList.remove('is-loading');

    setTimeout(() => {
      this.isLoading = false;
    }, 100);

    setTimeout(() => {
      this.isAnimating = false;
    }, 1600);

    if( this.animateBackgroundIntro ) {
      setTimeout(() => {
        this.hasBackground = true;
      }, 2000);
    }
  }
});
