// import Vue from 'vue';
import {hsluvToHex} from 'hsluv';
import chroma from 'chroma-js';
import rgbtocmyk from './lib/rgb-cymk';
import Seedrandom from 'seedrandom';
import SimplexNoise from 'simplex-noise';
import randomColor from 'randomcolor';

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
      randomOrder: false,
      hasGradients: true,
      hasBackground: false,
      hasOutlines: false,
      highContrast: false,
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
      generatorFunctionList: ['Hue Bingo', 'Legacy', 'RandomColor.js', 'Simplex Noise', 'Full Random'],
      isLoading: true,
      isAnimating: true,
      currentSeed: randomStr(),
      rnd: new Seedrandom(),
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
        {key:'sc', prop: 'showContrast'}, // false
        {key:'bw', prop: 'addBWContrast'}, // true
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
    }
  },
  computed: {
    paletteTitle: function() {
      if( this.names.length ) {
        const first = this.names[0].name.match(/[^\s-]+-?/g)[0];
        let last = this.names[this.names.length - 1].name.match(/[^\s-]+-?/g);
        last = last[last.length - 1];
        return `${first} ${last}`;
      } else {
        return 'Doubble Rainbow'
      }
    },
    lastColor: function () {
      return this.colors && this.colors.length ? this.colors[this.colors.length - 1] : '#212121';
    },
    lastColorContrast: function () {
      return chroma(this.lastColor).luminance() < .5 ? '#fff' : '#212121';
    },
    firstColor: function () {
      return this.colors && this.colors.length ? this.colors[0] : '#212121';
    },
    colors: function () {
      const colors = chroma
        .scale(this.colorsValues.length ? this.colorsValues : ['#f00', '#0f0', '#00f', '#0ff'])
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
    backgroundGradient: function () {
      let gradient = [...this.colors];
      gradient[0] += ' 12vmin'
      gradient[gradient.length - 1] += ' 69%'

      /*
      // hard stops
      let col = this.colors.reduce((r,d,i) => (`${r ? r + ',' : ''} ${d} ${((i)/this.colors.length) * 100}%, ${d} ${((i + 1)/this.colors.length) * 100}%`),'');
      return `linear-gradient(to bottom, ${col})`;
      */

      return `linear-gradient(to bottom, ${gradient.join(',')})`;
    }
  },
  methods: {
    random: function (min, max) {
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

    copy: function () {
      const list = this.names.map(color => ({
        name: color.name,
        value: color.requestedHex
      }));

      let expString = this.paletteTitle + '\n';
      expString += `⸺\n`;
      expString = list.reduce((rem, color) => (
        rem + color.name + ' ' + color.value + '\n'
      ), expString);
      expString += `⸺\n`;
      expString += `${this.colors.join(',')}\n`;
      expString += `⸺\n`;
      expString += `URL:\n`;
      expString += `${window.location.origin + "/?s=" + this.constructURL()}\n`;


      navigator.clipboard.writeText(expString);
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
      //console.log(url)
      return fetch(url)
      .then(data => data.json())
      .then(data => {
        this.names = data.colors;
      });
    },
    updateFavicon: function () {
      const favicons = document.querySelectorAll('[rel="icon"]');
      const faviconSize = 100;
      const innerSize = 80;

      const canvas = document.createElement('canvas');
      canvas.width = faviconSize;
      canvas.height = faviconSize;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, faviconSize);
      ctx.fillStyle = '#212121';
      ctx.fillRect(0, 0, faviconSize, faviconSize);

      this.colors.forEach((color, i) => {
        /*ctx.fillStyle = color;
        ctx.fillRect(
          (faviconSize - innerSize) / 2,
          ((faviconSize - innerSize) / 2) + (i/color.length * innerSize),
          innerSize,
          (i/color.length) * innerSize
        )*/
        gradient.addColorStop(Math.min(1, i/color.length), color);
      });

      ctx.fillStyle = gradient;
      ctx.fillRect(faviconSize * .1, faviconSize * .1, faviconSize * .8, faviconSize * .8);

      // Replace favicon

      const faviconBase64 = canvas.toDataURL('image/png')
      favicons.forEach($icon => $icon.href = faviconBase64);
    },
    settingsFromURL: function () {
      const params = window.location.search;
      const stateString = new URLSearchParams(params).get('s');

      if (stateString) {
        let settings = JSON.parse(atob(stateString));

        Object.keys(settings).forEach(settingKey => {
          const setting = this.trackInURL.find(s => (s.key === settingKey));
          //this[setting.prop] = settings[settingKey].prop;
          this[setting.prop] = setting.p ? setting.p(settings[settingKey]) : settings[settingKey];
        });

        return true;
      } else {
        return false;
      }
    },
    shareURL: function () {
      navigator.clipboard.writeText(`${window.location.origin + "/?s=" + this.constructURL()}`);
    },
    constructURL: function () {
      const state = this.trackInURL.reduce((o,i)=> Object.assign(o, {[i.key]: this[i.prop]}) ,{});
      const serializedState = btoa(JSON.stringify(state));
      return serializedState;
    },
    updateURL: function () {
      history.replaceState(history.state, document.title, "?s=" + this.constructURL);
    },
    newColors: function (newSeed) {
      if (newSeed) {
        this.currentSeed = randomStr();
      }

      this.rnd = new Seedrandom(this.currentSeed);

      let colorArr = this.generateRandomColors(
        this.amount,
        this.intermpolationColorModel,
        parseFloat(this.padding),
        this.colorsInGradient,
        this.randomOrder,
        this.minHueDistance
      )

      this.colorsValues = colorArr;
      this.updateFavicon();
    },
    toggleSettings: function () {
      this.settingsVisible = !this.settingsVisible;
    },
    cancelSwipe: function (e) {
      e.stopPropagation();
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
      });

      document.addEventListener('pointermove', (e)=> {
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
    }
  },
  mounted: function () {
    const hadSettings = this.settingsFromURL();

    this.newColors(!hadSettings);

    if (hadSettings) {
      window.history.replaceState({}, document.title, location.pathname);
    }

    this.addMagicControls();


    document.querySelector('body').classList.remove('is-loading');

    setTimeout(() => {
      this.isLoading = false;
    }, 100);

    setTimeout(() => {
      this.isAnimating = false;
    }, 1600);

    setTimeout(() => {
      this.hasBackground = true;
    }, 2000);
  }
});
