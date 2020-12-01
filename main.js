// import Vue from 'vue';
import {hsluvToHex} from 'hsluv';
import chroma from 'chroma-js';

const shuffleArray = arr => arr
  .map(a => [Math.random(), a])
  .sort((a, b) => a[0] - b[0])
  .map(a => a[1]);

const random = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

Vue.component('color', {
  props: ['color', 'name'],
  template: `<div class="color" v-bind:style="{background: color, color: textColor}">
              <div class="label">{{ color }}</div>
              <div class="name">{{ name.name }}</div>
             </div>`,
  computed: {
    textColor: function () {
      let currentColor = chroma( this.color );
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
      padding: .175,
      intermpolationColorModel: 'lab',
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
  },
  computed: {
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
      randomOrder = false
    ) {
      let colors = [];
      const part = Math.floor(total / parts);
      const reminder = total % parts;

      // hues to pick from
      const baseHue = random(0, 360);
      const hues = [0, 60, 120, 180, 240, 300].map(offset => {
        return (baseHue + offset) % 360;
      });

      //  low saturated color
      const baseSaturation = random(5, 40);
      const baseLightness = random(0, 20);
      const rangeLightness = 90 - baseLightness;

      colors.push( hsluvToHex([
        hues[0],
        baseSaturation,
        baseLightness * random(.25, .75),
      ]) );

      for (let i = 0; i < (part - 1); i++) {
        colors.push( hsluvToHex([
          hues[0],
          baseSaturation,
          baseLightness + (rangeLightness * Math.pow( i / (part - 1), 1.5))
        ]) );
      }

      // random shades
      const minSat = random(50, 70);
      const maxSat = minSat + 30;
      const minLight = random(45, 80);
      const maxLight = Math.min(minLight + 40, 95);

      for (let i = 0; i < (part + reminder - 1); i++) {
        colors.push( hsluvToHex([
          hues[random(0, hues.length - 1)],
          random(minSat, maxSat),
          random(minLight, maxLight),
        ]) )
      }
      
      colors.push( hsluvToHex([
        hues[0],
        baseSaturation,
        rangeLightness,
      ]) );
      
      if ( randomOrder ) {
        colors = shuffleArray(colors);
      }
      
      return colors;
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
      
      document.querySelector('.refresh').style.background = this.colors[this.colors.length - 1];
      document.querySelector('.settings').style.background = this.colors[this.colors.length - 1];
    },
    toggleSettings: function () {
      this.settingsVisible = !this.settingsVisible;
    },
  },
  mounted: function () {
    this.newColors();
  }
});