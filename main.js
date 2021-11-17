// import Vue from 'vue';
import {hsluvToHex} from 'hsluv';
import chroma from 'chroma-js';
import rgbtocmyk from './lib/rgb-cymk';
import Seedrandom from 'seedrandom';
import SimplexNoise from 'simplex-noise';
import randomColor from 'randomcolor';
import getShareLink from './lib/share-strings';

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

const workers = [];
const CANVAS_SCALE = 0.4;

const unsplashURLtoID = url =>
url.match(
  /https:\/\/images\.unsplash\.com\/photo-([\da-f]+-[\da-f]+)/
)[1];

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

const imageLoadCallback = (image, canvas, ctx, colorsLength) => {
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

  startWorker(image.src, imageData, width, filterOptions, colorsLength);
};

const loadImage = (source, colorsLength) => {
  workers.forEach(w => w.terminate());

  const image = new Image();
  image.crossOrigin = 'Anonymous';
  image.src = source;

  image.onload = imageLoadCallback.bind(null, image, canvas, ctx, colorsLength);
};


const shuffleArray = arr => arr
  .map(a => [Math.random(), a])
  .sort((a, b) => a[0] - b[0])
  .map(a => a[1]);

const randomStr = (length = 14) => {
    return Math.random().toString(16).substr(2, length);
};

Vue.component('color', {
  props: ['colorhex', 'name', 'colorvaluetype', 'contrastcolor', 'nextcolorhex', 'contrastcolors'],
  template: `<aside @click="copy" class="color" v-bind:style="{'--color': colorhex, '--color-next': nextcolorhex, '--color-text': contrastcolor, '--color-best-contrast': bestContrast}">
              <div class="color__values">
                <var class="color__value">{{value}}</var>
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
      navigator.clipboard.writeText(`${this.name.name} ・ ${this.value} ・ ${this.valueRGB} ・ ${this.valueHSL} ・ ${this.valueCMYK} `);
    }
  },
  computed: {
    valueCMYK: function () {
      return `cmyk(${rgbtocmyk(chroma(this.colorhex).rgb()).map(d => Math.round(d * 100) + `°`).join(',')})`;
    },
    valueRGB: function () {
      return chroma(this.colorhex).css('rgb');
    },
    valueHSL: function () {
      return chroma(this.colorhex).css('hsl');
    },
    value: function () {
      if(this.colorvaluetype === 'hex') {
        return this.colorhex;
      } else  {
        return chroma(this.colorhex).css(this.colorvaluetype);
      }
    },
    hasWCAGColorPairs: function () {
      return this.contrastcolors.filter(c => c !== false);
    },
    bestContrast: function () {
      return chroma.contrast(this.colorhex, 'black') > chroma.contrast(this.colorhex, 'white') ? 'black' : 'white';
    }
  }
});

function coordsToHex (angle, val1, val2, mode = 'hsluv') {
  if (mode === 'hsluv') {
    return hsluvToHex([ angle, val1, val2, ]);
  } else if (mode === 'hcl') {
    return chroma(angle, val1, val2, 'hcl').hex();
  } else if (mode === 'lch') {
    return chroma(val1, val2, angle, 'lch').hex();
  } else if (mode === 'hsl' || mode === 'hsv' || mode === 'hcg') {
    return chroma(angle, val1/100, val2/100, mode).hex();
  }
}


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
      animateBackgroundIntro: true,
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
      colorModeList: ['hsluv', 'hcl', 'hsl', 'hcg', 'hsv', 'lch'],
      minHueDistance: 60,
      intermpolationColorModel: 'lab',
      intermpolationColorModels: ['lab', 'hsl', 'hsv', 'hsi', 'lch', 'rgb', 'lrgb'],
      colorValueType: 'hex',
      colorValueTypes: ['hex', 'rgb', 'hsl'],
      generatorFunction: 'Legacy',
      generatorFunctionList: ['Hue Bingo', 'Legacy', 'ImageExtract', 'RandomColor.js', 'Simplex Noise', 'Full Random'],
      isLoading: true,
      isAnimating: true,
      currentSeed: randomStr(),
      rnd: new Seedrandom(),
      nameRnd1: 0,
      nameRnd2: 0,
      moveTimer: null,
      showUI: true,
      lightmode: false,
      sameHeightColors: false,
      exportAs: 'jsArray',
      isCopiying: false,
      imgURL: '',
      paletteTitle: 'Double Rainbow',
      trackInURL: [
        {key:'s' , prop: 'currentSeed'},
        {key:'a' , prop: 'amount', p: parseInt}, //6
        {key:'cg' , prop: 'colorsInGradient', p: parseInt}, //4
        {key:'hg' , prop: 'hasGradients', p: Boolean}, // true
        {key:'hb' , prop: 'hasBackground', p: Boolean}, // false
        {key:'ho' , prop: 'hasOutlines', p: Boolean}, // false
        {key:'hc' , prop: 'highContrast', p: Boolean}, // false
        {key:'ht' , prop: 'hideText', p: Boolean}, // false,
        {key:'b' , prop: 'hasBleed', p: Boolean}, // false,
        {key:'p' , prop: 'padding', p: parseFloat}, // .175
        {key:'md' , prop: 'minHueDistance', p: parseInt}, // 60,
        {key:'cm' , prop: 'intermpolationColorModel'}, // 'lab'
        {key:'f' , prop: 'generatorFunction'}, // 'Legacy'
        {key:'c', prop: 'colorMode'}, // 'hsluv'
        {key:'sc', prop: 'showContrast', p: Boolean}, // false
        {key:'bw', prop: 'addBWContrast', p: Boolean}, // true
        {key: 'ah', prop: 'autoHideUI', p: Boolean}, // false
        {key: 'iu', prop: 'imgURL'}, // ''
        {key: 'lm', prop: 'lightmode', p: Boolean}, // true
        {key: 'sm', prop: 'sameHeightColors', p: Boolean}, // false
        {key: 'n1', prop: 'nameRnd1', p: parseFloat},
        {key: 'n2', prop: 'nameRnd2', p: parseFloat},
      ],
    }
  },
  watch: {
    amount: function () {
      this.amount = Math.min(Math.max(this.amount, 3),10);
      this.colorsInGradient = Math.min(this.colorsInGradient, this.amount);
    },
    colorsInGradient: function () {
      this.colorsInGradient = Math.min(Math.max(this.colorsInGradient, 2), this.amount);
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
    }
  },
  computed: {
    lastColor: function () {
      return this.colors && this.colors.length ? this.colors[this.colors.length - 1] : '#212121';
    },
    lastColorContrast: function () {
      return chroma(this.lastColor).luminance() < .5 ? '#fff' : '#212121';
    },
    firstColor: function () {
      return this.colors && this.colors.length ? this.colors[0] : '#212121';
    },
    firstColorContrast: function () {
      return chroma(this.firstColor).luminance() < .5 ? '#fff' : '#212121';
    },
    colors: function () {
      const colors = chroma
        .scale(this.colorsValues.length ? this.colorsValues : ['#202124', '#fff'])
        .padding(parseFloat(this.padding))
        .mode(this.intermpolationColorModel)
        .colors(this.amount);

      this.getNames(colors);

      return colors;
    },
    wcagContrastColors: function () {
      return this.colors.map(color =>
        (this.addBWContrast ? [...this.colors, '#fff', '#000'] : this.colors).map(
          color2 => (4.5 <= chroma.contrast(color, color2) ? color2 : false)
        )
      )
    },
    gradientStops: function () {
      const gradient = [...this.colors];
      gradient[0] += ' 12vh'
      gradient[gradient.length - 1] += this.sameHeightColors ? ' 80%' : ' 69%'
      return gradient.join(',');
    },
    backgroundGradient: function () {
      /*
      // hard stops
      let col = this.colors.reduce((r,d,i) => (`${r ? r + ',' : ''} ${d} ${((i)/this.colors.length) * 100}%, ${d} ${((i + 1)/this.colors.length) * 100}%`),'');
      return `linear-gradient(to bottom, ${col})`;
      */

      return `linear-gradient(to bottom, ${this.gradientStops})`;
    },
    appStyles: function () {
      return {
        '--color-first': this.firstColor,
        '--color-last': this.lastColor,
        '--color-last-contrast': this.lastColorContrast,
        '--color-first-contrast': this.firstColorContrast,
        '--colors': this.colors.length,
      }
    },
    appClasses: function () {
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
    namedColorList: function () {
      return this.names.map(color => ({
        name: color.name,
        value: color.requestedHex,
      }));
    },

    colorList: function () {
      const namedColors = this.namedColorList;

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
    currentURL: function () {
      return window.location.origin + "/?s=" + this.constructURL();
    },
  },
  methods: {
    getPaletteTitle: function (rnd1, rnd2) {
      if (this.names.length) {
        const names = this.names.map(n => n.name);

        const indexFirst = Math.round(rnd1 * (names.length - 1));
        const firstName = names.splice(indexFirst, 1);
        const lastIndex = Math.round(rnd2 * (names.length - 1));

        const first = firstName[0].match(/[^\s-]+-?/g)[0];
        let last = names[lastIndex].match(/[^\s-]+-?/g);
        last = last[last.length - 1];
        return `${first} ${last}`;
      } else {
        return 'Doubble Rainbow';
      }
    },
    convretedColor: function (value) {
      return this.colorValueType === 'hex' ? value : chroma(value).css(this.colorValueType);
    },
    random: function (min = 1, max) {
      if (!max) {
        return this.rnd() * min;
      }
      return Math.floor(this.rnd()  * (max - min + 1)) + min;
    },
    getContrastColor: function (color) {
      let currentColor = chroma( color );
      let lum = currentColor.luminance();
      let contrastColor;

      if ( lum < 0.15 ) {
        contrastColor = currentColor.set('hsl.l', '+.25');
      } else {
        contrastColor = currentColor.set('hsl.l', '-.35');
      }

      return contrastColor.hex();
    },
    generateRandomColors: function (
      total,
      mode = 'lab',
      padding = .175,
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
    copyExport: function (e) {
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
    getNames: function (colors) {
      const url = new URL('https://api.color.pizza/v1/');

      const params = {
        noduplicates: true,
        goodnamesonly: true,
        colors: ['f0f0f0', 'f00'],
      };

      url.pathname += colors.join().replace(/#/g, '');

      url.search = new URLSearchParams(params).toString();

      return fetch(url)
      .then(data => data.json())
      .then(data => {
        this.names = data.colors;
        this.paletteTitle = this.getPaletteTitle(this.nameRnd1, this.nameRnd2);
      });
    },
    buildImage: function (
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
    updateMeta: function () {
      const theme = document.querySelector('[name="theme-color"]');
      const favicons = document.querySelectorAll('[rel="icon"]');
      theme.setAttribute('content', this.colors[0]);

      // Replace favicon
      const faviconBase64 = this.buildImage(100, 0.1).toDataURL('image/png');
      favicons.forEach($icon => $icon.href = faviconBase64);
    },
    settingsFromURL: function () {
      const params = window.location.search;
      const stateString = new URLSearchParams(params).get('s');
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
    shareURL: function () {
      navigator.clipboard.writeText(`${window.location.origin + "/?s=" + this.constructURL()}`);
    },
    constructURL: function () {
      const state = this.trackInURL.reduce((o,i) => Object.assign(o, {[i.key]: this[i.prop]}) ,{});
      const serializedState = Buffer.from(JSON.stringify(state)).toString('base64');
      return serializedState;
    },
    updateURL: function () {
      history.pushState(history.state, document.title, "?s=" + this.constructURL());
    },
    newColors: function (newSeed) {
      document.documentElement.classList.remove('is-imagefetching');

      if (newSeed) {
        this.currentSeed = randomStr();
      }

      this.rnd = new Seedrandom(this.currentSeed);

      //this.updateURL();

      if (this.generatorFunction !== 'ImageExtract') {
        let colorArr = this.generateRandomColors(
          this.amount,
          this.intermpolationColorModel,
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
            );
          });
        } else {
          loadImage(
            this.imgURL,
            this.colorsInGradient,
          );
        }

        this.colorsValues = this.colorsValues;
      }

      if (newSeed) {
        this.nameRnd1 = this.random();
        this.nameRnd2 = this.random();
      }
    },
    toggleSettings: function () {
      this.shareVisible = false;
      if (!this.settingsVisible) {
        this.$refs.panel.scrollTo(0, 0);
      }
      this.settingsVisible = !this.settingsVisible;
    },
    toggleShare: function () {
      this.settingsVisible = false;
      if (!this.shareVisible) {
        this.$refs.panel.scrollTo(0, 0);
      }
      this.shareVisible = !this.shareVisible;
    },
    cancelSwipe: function (e) {
      e.stopPropagation();
    },
    hideTools: function () {
      this.showUI = true;

      if (this.autoHideUI) {
        clearTimeout(this.moveTimer);
        this.moveTimer = setTimeout(() => {
          this.showUI = false;
        }, 3000);
      }
    },
    addMagicControls: function () {
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
    handlefile: function (e) {
      const reader = new FileReader();
      reader.addEventListener('loadend', this.imageLoaded);
      reader.readAsDataURL(e.target.files[0]);
    },
    imageLoaded: function (event) {
      const srcimg = new Image();

      srcimg.onload = imageLoadCallback.bind(null, srcimg, canvas, ctx, 4);
      srcimg.src = event.target.result;
      this.imgURL = event.target.result;
    },
    getShareLink: function (provider) {
      return getShareLink(provider, this.currentURL, this.paletteTitle);
    }
  },
  mounted: function () {
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
