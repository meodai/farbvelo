// import Vue from 'vue';
import {hsluvToHex} from 'hsluv';
import chroma from 'chroma-js';
import 'cmyk-rgb'

const shuffleArray = arr => arr
  .map(a => [Math.random(), a])
  .sort((a, b) => a[0] - b[0])
  .map(a => a[1]);

const random = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

Vue.component('color', {
  props: ['colorhex', 'name', 'colorvaluetype'],
  template: `<div @click="copy" class="color" v-bind:style="{background: colorhex, color: textColor}">
              <div class="label">{{ value }}</div>
              <div class="name">{{ name.name }}</div>
             </div>`,
  
  methods: {
    copy: function () {
      navigator.clipboard.writeText(`${this.name.name}: ${this.value}`);
    }
  },
  computed: {
    value: function () {
      if(this.colorvaluetype === 'hex') {
        return this.colorhex;
      } else  {
        return chroma(this.colorhex).css(this.colorvaluetype);
      }
    },
    textColor: function () {
      let currentColor = chroma( this.colorhex );
      let lum = currentColor.luminance();
      let contrastColor;
      if ( lum < 0.15 ) {
        contrastColor = currentColor.set('hsl.l', '+.25');  
      } else {
        contrastColor = currentColor.set('hsl.l', '-.35');
      }
      return contrastColor;
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
      randomOrder: false,
      hasGradients: true,
      hasBackground: true,
      hasOutlines: false,
      padding: .175,
      minHueDistance: 60,
      intermpolationColorModel: 'lab',
      intermpolationColorModels: ['lab', 'hsl', 'hsv', 'hsi', 'lch', 'rgb', 'lrgb'],
      colorValueType: 'hex',
      colorValueTypes: ['hex', 'rgb', 'hsl'],
      geneartorFunction: 'Legacy',
      generatorFunctionList: ['Hue Bingo', 'Legacy', 'Full Random']
    }
  },
  watch: {
    amount: function () {
      this.colorsInGradient = Math.min(this.colorsInGradient, this.amount);
    },
    colorsInGradient: function () {
      this.newColors();
    },
    randomOrder: function () {
      this.newColors();
    },
    geneartorFunction: function () {
      this.newColors();
    },
    minHueDistance: function () {
      this.newColors();
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
      return this.colors && this.colors.length ? this.colors[this.colors.length - 1] : '#2121';
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
    backgroundGradient: function () {
      let gradient = [...this.colors];
      gradient[0] += ' 12vmin'
      gradient[gradient.length - 1] += ' 69%'
      //url("https://www.transparenttextures.com/patterns/concrete-wall.png"),

      return `
        linear-gradient(to bottom, ${gradient.join(',')})
      `;
    }
  },
  methods: {
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
      
      if (this.geneartorFunction === 'Hue Bingo') {
        // create an array of hues to pick from.
        const baseHue = random(0, 360);
        const hues = new Array(360 / minHueDiffAngle).fill('').map((offset, i) => {
          return (baseHue + i * minHueDiffAngle) % 360;
        });

        //  low saturation color
        const baseSaturation = random(5, 40);
        const baseLightness = random(0, 20);
        const rangeLightness = 90 - baseLightness;

        colors.push(
          hsluvToHex([
            hues[0],
            baseSaturation,
            baseLightness * random(0.25, 0.75),
          ])
        );

        // random shades
        const minSat = random(50, 70);
        const maxSat = minSat + 30;
        const minLight = random(35, 70);
        const maxLight = Math.min(minLight + random(20, 40), 95);
        // const lightDiff = maxLight - minLight;

        const remainingHues = [...hues];

        for (let i = 0; i < parts - 2; i++) {
          const hue = remainingHues.splice(random(0, remainingHues.length - 1),1)[0];
          const saturation = random(minSat, maxSat);
          const light = baseLightness + random(0,10) + ((rangeLightness/(parts - 1)) * i);

          colors.push( 
            hsluvToHex([
              hue,
              saturation,
              random(light, maxLight),
            ])
          )
        }
        
        colors.push( 
          hsluvToHex([
            remainingHues[0],
            baseSaturation,
            rangeLightness + 10,
          ])
        );
      } else if (this.geneartorFunction === 'Legacy') {
        const part = Math.floor(total / parts);
        const reminder = total % parts;

        // hues to pick from
        const baseHue = random(0, 360);
        const hues = new Array(360 / minHueDiffAngle).fill('').map((offset, i) => {
          return (baseHue + i * minHueDiffAngle) % 360;
        });

        //  low saturated color
        const baseSaturation = random(5, 40);
        const baseLightness = random(0, 20);
        const rangeLightness = 90 - baseLightness;

        colors.push(
          hsluvToHex([
            hues[0],
            baseSaturation,
            baseLightness * random(0.25, 0.75),
          ])
        );

        for (let i = 0; i < (part - 1); i++) {
          colors.push( 
            hsluvToHex([
              hues[0],
              baseSaturation,
              baseLightness + (rangeLightness * Math.pow( i / (part - 1), 1.5))
            ]) 
          );
        }

        // random shades
        const minSat = random(50, 70);
        const maxSat = minSat + 30;
        const minLight = random(45, 80);
        const maxLight = Math.min(minLight + 40, 95);

        for (let i = 0; i < (part + reminder - 1); i++) {
          colors.push( 
            hsluvToHex([
              hues[random(0, hues.length - 1)],
              random(minSat, maxSat),
              random(minLight, maxLight),
            ])
          )
        }
        
        colors.push( 
          hsluvToHex([
            hues[0],
            baseSaturation,
            rangeLightness,
          ])
        );
      } if (this.geneartorFunction === 'Full Random') {
        for (let i = 0; i < parts; i++) {
          colors.push( 
            hsluvToHex([  
              random(0, 360),
              random(0, 100),
              random(0, 100),
            ])
          )
        }
        console.log(colors)
      }
      
      if ( randomOrder ) {
        colors = shuffleArray(colors);
      }
      
      return colors;
    },

    copy: function () {

      const list = this.names.map(color => ({name: color.name ,value: color.requestedHex}));
      let expString = this.paletteTitle + '\n';
      expString += `⸺\n`;
      expString = list.reduce((rem, color) => (
        rem + color.name + ' ' + color.value + '\n'
      ), expString);
      
      navigator.clipboard.writeText(expString);
    },

    getNames: function (colors) {
      fetch(`https://api.color.pizza/v1/${colors.join().replace(/#/g, '')}?noduplicates=true&goodnamesonly=true`)
      .then(data => data.json())
      .then(data => {
        this.names = data.colors;
      });
    },
    newColors: function () {
      let colorArr = this.generateRandomColors(
        this.amount, 
        this.intermpolationColorModel, 
        parseFloat(this.padding), 
        this.colorsInGradient, 
        this.randomOrder
      )
      
      this.colorsValues = colorArr;
    },
    toggleSettings: function () {
      this.settingsVisible = !this.settingsVisible;
    },
  },
  mounted: function () {
    this.newColors();
  }
});