// import Vue from 'vue';
import chroma from './lib/chroma-extensions.js'; // New import
import Seedrandom from 'seedrandom';
import getShareLink from './lib/share-strings';
import spectral from 'spectral.js';
import { logColors, randomStr } from './utils.js';
import generateRandomColors from './lib/generate-random-colors.js';
import { loadImage, startColorLocatorWorker } from './lib/image-palette.js';
import { buildImage, buildSVG, copyExport, shareURL } from './lib/export-utils.js';
import { visualizeColorPositions } from './lib/visualize-color-positions.js';
import { solidFirstImpressionSeeds } from './seeds.js';

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const fistImpressionSeed = solidFirstImpressionSeeds[
  Math.floor(Math.random() * solidFirstImpressionSeeds.length)
];

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
      } else {
        const formatters = {
          'cmyk': () => {
            const letters = 'CMYK'.split('');
            return chroma(this.colorhex).cmyk().map((d,i) =>
              `${letters[i]} <sup>${Math.round(d * 100)}%</sup>`).join(' ');
          },
          'rgb': () => {
            const rgb = chroma(this.colorhex).rgb();
            const letters = 'RGB'.split('');
            return rgb.map((d,i) => `${letters[i]} <sup>${d}</sup>`).join(' ');
          },
          'hsl': () => {
            const hsl = chroma(this.colorhex).hsl();
            hsl.pop(); // Remove alpha
            const letters = 'HSL'.split('');
            return hsl.map((d, i) =>
              `${letters[i]} <sup>${Math.round(d * 1000) / (i ? 10 : 1000)}${i ? '%' : '°'}</sup>`
            ).join(' ');
          }
        };

        return formatters[this.colorvaluetype] ?
          formatters[this.colorvaluetype]() :
          chroma(this.colorhex).css(this.colorvaluetype);
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

const defaultSettings = {
  amount: 6,
  colorsInGradient: 4,
  randomOrder: false,
  colorArrangement: "default",
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
  padding: 0.175,
  colorMode: "hsluv",
  minHueDistance: 60,
  interpolationColorModel: "lab",
  colorValueType: "hex",
  generatorFunction: "Hue Bingo",
  quantizationMethod: "art-palette",
  nameList: "bestOf",
  showUI: true,
  sameHeightColors: false,
  exportAs: "jsArray",
  imgURL: "",
  imgID: "",
  trackSettingsInURL: true,
};

new Vue({
  el: "#app",
  data: () => {
    return {
      colorsValues: [],
      names: [],
      colorModeList: ["hsluv", "oklch", "okhsv", "okhsl", "hcl", "hsl", "hcg", "hsv", "hpluv"],
      interpolationColorModels: [
        "lab",
        "oklab",
        "spectral",
        "rgb",
        "lrgb",
        "hcl",
        "hsl",
        "hsv",
        "hsi",
        "oklch",
      ],
      colorValueTypes: ["hex", "rgb", "hsl", "cmyk"],
      generatorFunctionList: [
        "Hue Bingo",
        "Legacy",
        "ImageExtract",
        "RandomColor.js",
        "Simplex Noise",
        "Full Random",
      ],
      nameLists: {
        bestOf: {
          title: "Best of Color Names",
          source: "https://github.com/meodai/color-names",
          description: "Best color names selected from various sources.",
          key: "bestOf",
          colorCount: 4541,
          license: "MIT",
          url: "/v1/?list=bestOf",
        },
      },
      quantizationMethods: ["art-palette", "gifenc" /*, 'pigmnts'*/],
      colorPositions: [],
      changedNamesOnly: false,
      isLoading: true,
      isAnimating: true,
      currentSeed: randomStr(),
      rnd: new Seedrandom(),
      moveTimer: null,
      fetchThrottleTimer: null,
      fetchAbortController: null,
      isCopiying: false,
      paletteTitle: "Double Rainbow",
      lightmode: false,
      settingsVisible: false,
      shareVisible: false,
      trackSettingsInURL: true, // Initialize here
      trackInURL: [
        { key: "s", prop: "currentSeed" },
        { key: "a", prop: "amount", p: parseInt }, //6
        { key: "cg", prop: "colorsInGradient", p: parseInt }, //4
        { key: "p", prop: "padding", p: parseFloat }, // .175
        { key: "md", prop: "minHueDistance", p: parseInt }, // 60,
        { key: "cm", prop: "interpolationColorModel" }, // 'lab'
        { key: "f", prop: "generatorFunction" }, // 'Legacy'
        { key: "c", prop: "colorMode" }, // 'hsluv'
        { key: "qm", prop: "quantizationMethod" }, // art-palette,
      ],
      trackInLocalStorage: [
        { key: "a", prop: "amount", p: parseInt }, //6
        { key: "cg", prop: "colorsInGradient", p: parseInt }, //4
        { key: "hg", prop: "hasGradients", p: Boolean }, // true
        { key: "hb", prop: "hasBackground", p: Boolean }, // false
        { key: "ho", prop: "hasOutlines", p: Boolean }, // false
        { key: "hc", prop: "highContrast", p: Boolean }, // false
        { key: "ht", prop: "hideText", p: Boolean }, // false,
        { key: "b", prop: "hasBleed", p: Boolean }, // false,
        { key: "p", prop: "padding", p: parseFloat }, // .175
        { key: "md", prop: "minHueDistance", p: parseInt }, // 60,
        { key: "cm", prop: "interpolationColorModel" }, // 'lab'
        { key: "f", prop: "generatorFunction" }, // 'Legacy'
        { key: "c", prop: "colorMode" }, // 'hsluv'
        { key: "sc", prop: "showContrast", p: Boolean }, // false
        { key: "bw", prop: "addBWContrast", p: Boolean }, // true
        { key: "ah", prop: "autoHideUI", p: Boolean }, // false
        { key: "iu", prop: "imgURL" }, // ''
        { key: "lm", prop: "lightmode", p: Boolean }, // true
        { key: "sm", prop: "sameHeightColors", p: Boolean }, // false
        { key: "cv", prop: "colorValueType" }, // hex,
        { key: "qm", prop: "quantizationMethod" }, // art-palette,
        { key: "nl", prop: "nameList" }, // nameList,
        { key: "ts", prop: "trackSettingsInURL", p: Boolean }, // false
        { key: "ca", prop: "colorArrangement" }, // default
      ],
      ...defaultSettings,
    };
  },
  watch: {
    $data: {
      handler: function (newValue, oldValue) {
        if (this.trackSettingsInURL) {
          this.updateURL();
        }
      },
      deep: true,
    },
    trackSettingsInURL: function (newValue, oldValue) {
      if (newValue === false) {
        //remove the settings from the url
        history.pushState(
          history.state,
          document.title,
          window.location.pathname
        );
      } // Removed the incorrect assignment: this.trackSettingsInURL = newValue;
      // The actual data property this.trackSettingsInURL is already bound and will update.
    },
    amount: function () {
      this.amount = Math.min(Math.max(this.amount, 3), 10);
      this.colorsInGradient = Math.min(this.colorsInGradient, this.amount);
    },
    colorsInGradient: function () {
      this.colorsInGradient = Math.min(
        Math.max(this.colorsInGradient, 2),
        this.amount
      );
      this.newColors();
    },
    quantizationMethod: function () {
      this.newColors();
    },
    randomOrder: function () {
      this.newColors();
    },
    colorArrangement: function () {
      this.newColors();
    },
    minHueDistance: function () {
      this.newColors();
    },
    colorMode: function () {
      this.newColors();
    },
    lightmode: function (newValue) {
      if (newValue) {
        document.querySelector("body").classList.add("lightmode");
      } else {
        document.querySelector("body").classList.remove("lightmode");
      }
      this.updateMeta();
    },
    generatorFunction: function () {
      this.newColors();
      if (this.generatorFunction == "Legacy") { // Corrected: == instead of single =
        console.info(
          "Legacy: Results in mostly vaporwavey color combinations. Old and broken color engine intially used on https://codepen.io/meodai/pen/RerqjG?editors=1100."
        );
      } else if (this.generatorFunction == "Hue Bingo") { // Corrected: == instead of single =
        console.info(
          "Hue Bingo: Selects ℕ0 hue`s (color stops) at a user defined minimum angle ∠, using a controlled random lightness ramp."
        );
      } else if (this.generatorFunction == "Full Random") { // Corrected: == instead of single =
        console.info(
          'Random: Picks ℕ0 random hsl colors. Make sure to use "Mix Padding" with this one.'
        );
      } else if (this.generatorFunction === "RandomColor.js") {
        console.info(
          "RandomColor.js: https://randomcolor.lllllllllllllllll.com/"
        );
      }
    },
    colorsValues: function () {
      this.updateMeta();
    },
    nameList: function () {
      // When the nameList changes, fetch names for the current colors with the new list
      if (this.colorsValues && this.colorsValues.length) {
        this.getNames(this.colors);
      }
    },
    colors: function() {
      this.getNames(this.colors);
      logColors(this.colors);

      // When the final colors are calculated, find their positions if we're using ImageExtract
      if (this.generatorFunction === 'ImageExtract' && this.currentImageData) {
        this.findAndStoreColorLocations();
      }
    }
  },
  computed: {
    lastColor() {
      return this.colors && this.colors.length
        ? this.colors[this.colors.length - 1]
        : "#202126";
    },
    lastColorContrast() {
      return chroma(this.lastColor).luminance() < 0.5 ? "#fff" : "#202126";
    },
    firstColor() {
      return this.colors && this.colors.length ? this.colors[0] : "#202126";
    },
    firstColorContrast() {
      return chroma(this.firstColor).luminance() < 0.5 ? "#fff" : "#202126";
    },
    colors() {
      let colors;

      if (
        this.interpolationColorModel === "spectral" &&
        this.colorsValues.length < this.amount
      ) {
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
        colors = chroma
          .scale(yColors)
          .padding(parseFloat(this.padding))
          .colors(this.amount);
      } else {
        colors = chroma
          .scale(
            this.colorsValues.length ? this.colorsValues : ["#202124", "#fff"]
          )
          .padding(parseFloat(this.padding))
          .mode(
            this.interpolationColorModel !== "spectral"
              ? this.interpolationColorModel
              : "lch"
          )
          .colors(this.amount);
      }

      return colors;
    },
    wcagContrastColors() {
      return this.colors.map((color) =>
        (this.addBWContrast
          ? [...this.colors, "#fff", "#000"]
          : this.colors
        ).map((color2) =>
          4.5 <= chroma.contrast(color, color2) ? color2 : false
        )
      );
    },
    gradientStopsBG() {
      const gradient = [...this.colors];
      gradient[0] += " 12vh";
      gradient[gradient.length - 1] += this.sameHeightColors ? " 80%" : " 69%";
      return gradient.join(",");
    },
    gradientStops() {
      return [...this.colors].join(',');
    },
    hardStops() {
      return this.colors.map(
          (c, i) =>
            `${c} ${(i / this.colors.length) * 100}% ${
              ((i + 1) / this.colors.length) * 100
            }%`
        )
        .join(",");
    },
    appStyles() {
      return {
        "--color-first": this.firstColor,
        "--color-last": this.lastColor,
        "--color-last-contrast": this.lastColorContrast,
        "--color-first-contrast": this.firstColorContrast,
        "--colors": this.colors.length,
        "--gradientBG": this.gradientStopsBG,
        "--gradient-hard": this.hardStops,
        "--gradient": this.gradientStops,
      };
    },
    appClasses() {
      return {
        "is-loading": this.isLoading,
        "is-animating": this.isAnimating,
        wrap__hidetext: this.hideText,
        wrap__showcontrast: this.showContrast,
        wrap__hasOutlines: this.hasOutlines,
        wrap__highContrast: this.highContrast,
        wrap__hasGradients: this.hasGradients,
        wrap__showSettings: this.settingsVisible,
        wrap__showShare: this.shareVisible,
        wrap__hasBackground: this.hasBackground,
        wrap__hasBleed: this.hasBleed,
        wrap__hideUI: !this.showUI,
        wrap__expandUI: this.expandUI,
        wrap__hasDithering: this.hasGrain,
        wrap__lightmode: this.lightmode,
        wrap__sameHeightColors: this.sameHeightColors,
      };
    },
    namedColorList() {
      return this.names.map((color) => {
        const c = chroma(color.requestedHex);

        return {
          name: color.name,
          value: color.requestedHex,
          values: {
            hex: color.requestedHex,
            rgb: c.css("rgb"),
            hsl: c.css("hsl"),
            cmyk: c.css("cymk"),
          },
        };
      });
    },
    currentListData() {
      return this.nameLists[this.nameList];
    },
    colorList() {
      const namedColors = this.namedColorList.map((color) => ({
        ...color,
        value: color.values[this.colorValueType],
      }));

      if (this.exportAs === "list") {
        return namedColors.map((c) => c.value).join("\n");
      } else if (this.exportAs === "csvList") {
        return `name,value${namedColors.reduce(
          (r, c) => `${r}\n${c.name},${c.value}`,
          ""
        )}\n`;
      } else if (this.exportAs === "jsArray") {
        return `[\n  "${namedColors.map((c) => c.value).join('", \n  "')}"\n]`;
      } else if (this.exportAs === "jsObject") {
        return `{${namedColors.reduce(
          (r, c) => `${r}\n  "${c.name}": "${c.value}",`,
          ""
        )}\n}`;
      } else if (this.exportAs === "css") {
        return `${namedColors.reduce(
          (r, c) =>
            `${r}${r ? `\n` : ""}--${CSS.escape(
              c.name.replace(/ /g, "-")
            ).toLowerCase()}: ${c.value};`,
          ""
        )}`;
      } else if (this.exportAs === "cssGradient") {
        return `linear-gradient(\n  ${namedColors
          .map((c) => c.value)
          .join(", \n  ")}\n);`;
      }
    },
    currentURL() {
      return window.location.origin + "/?s=" + this.constructShareURL();
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
        ? currentColor.set("hsl.l", "+.25").hex()
        : currentColor.set("hsl.l", "-.35").hex();
    },
    copyExport(e) {
      copyExport({
        exportAs: this.exportAs,
        colorList: this.colorList,
        colors: this.colors,
        lightmode: this.lightmode,
        buildImageFn: buildImage,
        buildSVGFn: buildSVG,
        setCopying: (val) => {
          this.isCopiying = val;
        },
      });
    },
    shareURL() {
      shareURL(this.currentURL);
    },
    buildImage(size = 100, padding = 0.1, hardStops = false) {
      return buildImage(this.colors, this.lightmode, size, padding, hardStops);
    },
    buildSVG(size = 100, padding = 0.1, hardStops = false) {
      return buildSVG(this.colors, size, padding, hardStops);
    },
    getLists() {
      const url = new URL("https://api.color.pizza/v1/lists/");
      return fetch(url, {
        headers: {
          "X-Referrer": "https://farbvelo.elastiq.ch/",
        },
      })
        .then((data) => data.json())
        .then((data) => {
          // some of the lists have to little names, remove all that have less than 100
          const listsToKeep = {};
          Object.keys(data.listDescriptions).forEach((key) => {
            if (data.listDescriptions[key].colorCount > 120) {
              listsToKeep[key] = data.listDescriptions[key];
            }
          });
          this.nameLists = listsToKeep;
        });
    },
    getNames(colors, onlyNames) {
      // Clear any existing throttle timer
      if (this.fetchThrottleTimer) {
        clearTimeout(this.fetchThrottleTimer);
      }

      // Abort any ongoing fetch
      if (this.fetchAbortController) {
        this.fetchAbortController.abort();
      }

      // Throttle the fetch by 100ms
      this.fetchThrottleTimer = setTimeout(() => {
        // Create new AbortController for this fetch
        this.fetchAbortController = new AbortController();

        const url = new URL("https://api.color.pizza/v1/");

        const params = {
          noduplicates: true,
          list: this.nameList,
          values: colors.map((c) => c.replace("#", "")),
        };

        //url.pathname += colors.join().replace(/#/g, '');

        url.search = new URLSearchParams(params).toString();

        return fetch(url, {
          headers: {
            "X-Referrer": "https://farbvelo.elastiq.ch/",
          },
          signal: this.fetchAbortController.signal,
        })
          .then((data) => data.json())
          .then((data) => {
            this.names = data.colors;
            this.paletteTitle = data.paletteTitle;
          })
          .catch((error) => {
            // Ignore abort errors
            if (error.name !== 'AbortError') {
              console.error('Fetch error:', error);
            }
          });
      }, 100);
    },
    updateMeta() {
      const theme = document.querySelector('[name="theme-color"]');
      const favicons = document.querySelectorAll('[rel="icon"]');
      theme.setAttribute("content", this.colors[0]);

      // Replace favicon
      const faviconBase64 = this.buildImage(100, 0.1).toDataURL("image/png");
      favicons.forEach(($icon) => ($icon.href = faviconBase64));
    },
    settingsFromURLAndLocalStorage() {
      // 1. Load all settings from localStorage (trackInLocalStorage)
      const savedSettingsString = localStorage.getItem("farbveloSettings");
      let mergedSettings = {};
      let hadSettingsFromLocalStorage = false;
      if (savedSettingsString) {
        try {
          const settings = JSON.parse(savedSettingsString);
          this.trackInLocalStorage.forEach((settingConfig) => {
            if (settings.hasOwnProperty(settingConfig.prop)) {
              mergedSettings[settingConfig.prop] = settings[settingConfig.prop];
              hadSettingsFromLocalStorage = true; // Set if any setting is loaded
            }
          });
        } catch (e) {
          console.error("Error loading settings from localStorage:", e);
          localStorage.removeItem("farbveloSettings");
        }
      }

      // 2. Load settings from URL (trackInURL) and overwrite mergedSettings
      const params = new URLSearchParams(window.location.search);
      const shareStateString = params.get("s");
      let hadSettingsFromURL = false;

      if (shareStateString) {
        // Try parsing the compact share URL first
        try {
          // Decode base64 (browser-native)
          const binaryString = atob(shareStateString);
          // Modern way to decode Base64 to UTF-8 string
          const uint8Array = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
          }
          const jsonString = new TextDecoder().decode(uint8Array);
          let urlSettings = JSON.parse(jsonString);

          Object.keys(urlSettings).forEach((settingKey) => {
            const setting = this.trackInURL.find((s) => s.key === settingKey);
            if (setting) {
              mergedSettings[setting.prop] = setting.p
                ? setting.p(urlSettings[settingKey])
                : urlSettings[settingKey];
            }
          });
          this.animateBackgroundIntro = !!urlSettings.hb; // side effect
          hadSettingsFromURL = true;
        } catch (e) {
          console.error("Error restoring settings from compact share URL:", e);
        }
      } else {
        // If no 's' param, try parsing explicit URL parameters
        let explicitSettingsFound = false;
        this.trackInURL.forEach((settingConfig) => {
          if (params.has(settingConfig.prop)) {
            const value = params.get(settingConfig.prop);
            mergedSettings[settingConfig.prop] = settingConfig.p
              ? settingConfig.p(value)
              : value;
            explicitSettingsFound = true;
          }
        });
        if (explicitSettingsFound) {
          hadSettingsFromURL = true;
          // Potentially handle side effects like 'animateBackgroundIntro' if needed for explicit params
          // For now, assuming 'hb' (hasBackground) is only in compact URL or localStorage
        }
      }

      // 2.5. If lightmode is not defined, use system preference
      if (typeof mergedSettings.lightmode === 'undefined') {
        const wantLightMode = window.matchMedia("(prefers-color-scheme: light)");
        mergedSettings.lightmode = wantLightMode.matches;
      }

      // Validate and clamp settings before applying them to the instance
      if (mergedSettings.hasOwnProperty('amount')) {
        let numAmount = Number(mergedSettings.amount);
        if (isNaN(numAmount)) numAmount = defaultSettings.amount; // Fallback for safety
        mergedSettings.amount = Math.min(Math.max(numAmount, 3), 10);
      }

      if (mergedSettings.hasOwnProperty('colorsInGradient')) {
        let numColorsInGradient = Number(mergedSettings.colorsInGradient);
        if (isNaN(numColorsInGradient)) numColorsInGradient = defaultSettings.colorsInGradient; // Fallback

        const amountToUse = mergedSettings.hasOwnProperty('amount')
          ? mergedSettings.amount // Use the potentially just clamped amount from mergedSettings
          : defaultSettings.amount; // Fallback to default if amount is not in mergedSettings
        mergedSettings.colorsInGradient = Math.min(Math.max(numColorsInGradient, 2), amountToUse);
      }

      // Validate quantizationMethod
      if (mergedSettings.hasOwnProperty('quantizationMethod') && !this.quantizationMethods.includes(mergedSettings.quantizationMethod)) {
        console.warn(`Invalid quantizationMethod from URL/localStorage: ${mergedSettings.quantizationMethod}. Falling back to default.`);
        mergedSettings.quantizationMethod = defaultSettings.quantizationMethod;
      }

      // Validate colorMode
      if (mergedSettings.hasOwnProperty('colorMode') && !this.colorModeList.includes(mergedSettings.colorMode)) {
        console.warn(`Invalid colorMode from URL/localStorage: ${mergedSettings.colorMode}. Falling back to default.`);
        mergedSettings.colorMode = defaultSettings.colorMode;
      }

      // Validate interpolationColorModel
      if (mergedSettings.hasOwnProperty('interpolationColorModel') && !this.interpolationColorModels.includes(mergedSettings.interpolationColorModel)) {
        console.warn(`Invalid interpolationColorModel from URL/localStorage: ${mergedSettings.interpolationColorModel}. Falling back to default.`);
        mergedSettings.interpolationColorModel = defaultSettings.interpolationColorModel;
      }

      // Validate generatorFunction
      if (mergedSettings.hasOwnProperty('generatorFunction') && !this.generatorFunctionList.includes(mergedSettings.generatorFunction)) {
        console.warn(`Invalid generatorFunction from URL/localStorage: ${mergedSettings.generatorFunction}. Falling back to default.`);
        mergedSettings.generatorFunction = defaultSettings.generatorFunction;
      }

      // Validate colorValueType
      if (mergedSettings.hasOwnProperty('colorValueType') && !this.colorValueTypes.includes(mergedSettings.colorValueType)) {
        console.warn(`Invalid colorValueType from URL/localStorage: ${mergedSettings.colorValueType}. Falling back to default.`);
        mergedSettings.colorValueType = defaultSettings.colorValueType;
      }

      // Validate nameList
      if (mergedSettings.hasOwnProperty('nameList') && !Object.keys(this.nameLists).includes(mergedSettings.nameList)) {
        console.warn(`Invalid nameList from URL/localStorage: ${mergedSettings.nameList}. Falling back to default.`);
        mergedSettings.nameList = defaultSettings.nameList;
      }

      // 3. Apply merged settings to Vue instance
      Object.keys(mergedSettings).forEach((prop) => {
        this[prop] = mergedSettings[prop];
      });

      // 4. Save merged settings back to localStorage
      this.saveSettingsToLocalStorage();

      return { hadSettingsFromURL, hadSettingsFromLocalStorage };
    },
    constructShareURL() { // Renamed from constructURL
      const state = this.trackInURL.reduce(
        (o, i) => Object.assign(o, { [i.key]: this[i.prop] }),
        {}
      );
      const jsonString = JSON.stringify(state);
      // Modern way to encode UTF-8 string to Base64
      const uint8Array = new TextEncoder().encode(jsonString);
      const binaryString = String.fromCharCode.apply(null, uint8Array);
      const serializedState = btoa(binaryString);
      return serializedState;
    },
    constructExplicitTrackingURL() {
      const params = new URLSearchParams();
      this.trackInURL.forEach(setting => {
        // Do not include trackSettingsInURL itself in the explicit URL
        if (setting.prop !== 'trackSettingsInURL' && this[setting.prop] !== undefined) {
          params.append(setting.prop, this[setting.prop]);
        }
      });
      return params.toString() ? '?' + params.toString() : '';
    },
    updateURL() {
      if (this.trackSettingsInURL) {
        const explicitTrackingURL = this.constructExplicitTrackingURL();
        const shareableSettingsString = this.constructShareURL(); // For history state

        const newPath = window.location.pathname + explicitTrackingURL;

        // Only add to history if the path actually changed
        if (window.location.pathname + window.location.search !== newPath) {
          history.pushState(
            { seed: this.currentSeed, settings: shareableSettingsString }, // Store compact version in state
            document.title,
            newPath
          );
        }
      }
      this.saveSettingsToLocalStorage(); // Save settings when URL is updated
    },
    newColors(newSeed) {
      document.documentElement.classList.remove("is-imagefetching");
      if (newSeed) {
        this.currentSeed = randomStr();
      }
      this.rnd = new Seedrandom(this.currentSeed);
      this.updateURL();
      if (this.generatorFunction !== "ImageExtract") { // Added parentheses around the condition
        let colorArr = generateRandomColors({
          generatorFunction: this.generatorFunction,
          random: this.random,
          currentSeed: this.currentSeed,
          colorMode: this.colorMode,
          amount: this.amount,
          parts: this.colorsInGradient,
          randomOrder: this.randomOrder,
          colorArrangement: this.colorArrangement,
          minHueDiffAngle: this.minHueDistance,
        });
        this.colorsValues = colorArr;
      } else if (this.generatorFunction === "ImageExtract") {
        // Always use a random image when using ImageExtract
        // This ensures uploaded images are not tracked in the URL
        const imgSrc = `https://picsum.photos/seed/${this.currentSeed}/${
          325 * 2
        }/${483 * 2}`;
        this.imgURL = imgSrc;
        loadImage(
          this,
          canvas,
          ctx,
          imgSrc,
          this.colorsInGradient,
          this.quantizationMethod
        );
        this.colorsValues = this.colorsValues;
      }
    },
    resetSettings() {
      // restore all settings set in defaultSettings
      Object.keys(defaultSettings).forEach((key) => {
        this[key] = defaultSettings[key];
      });
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
      document.addEventListener("keydown", (e) => {
        // Skip if any modifier key is pressed to avoid interfering with system shortcuts
        if (e.metaKey || e.ctrlKey) {
          return;
        }

        if (e.code === "Space") {
          this.newColors(true);
        } else if (e.code === "ArrowRight") {
          this.padding = Math.min(1, this.padding + 0.01);
        } else if (e.code === "ArrowLeft") {
          this.padding = Math.max(0, this.padding - 0.01);
        } else if (e.code === "Escape") {
          if (this.settingsVisible || this.shareVisible) {
            this.settingsVisible = false;
            this.shareVisible = false;
          }
        }
      });

      let isTouching = false;
      let lastX = 0;

      // maybe add swipe controls at some point
      document.addEventListener("pointerdown", (e) => {
        isTouching = true;
        lastX = e.clientX;
        this.hideTools();
      });

      document.addEventListener("pointermove", (e) => {
        this.hideTools();
        if (isTouching) {
          e.preventDefault();
          const direction = Math.sign(e.clientX - lastX);
          let lastPadd = this.padding;
          if (direction == -1) {
            this.padding = Math.max(
              0,
              this.padding - Math.abs(e.clientX - lastX) / window.innerWidth
            );
          } else {
            this.padding = Math.min(
              1,
              this.padding + Math.abs(e.clientX - lastX) / window.innerWidth
            );
          }
          lastX = e.clientX;
        }
      });

      document.addEventListener("pointerup", (e) => {
        isTouching = false;
      });
    },
    handlefile(e) {
      const reader = new FileReader();
      reader.addEventListener("loadend", this.imageLoaded);
      reader.readAsDataURL(e.target.files[0]);
    },
    imageLoaded(event) {
      this.processImageSource(event.target.result);
    },
    processImageSource(src) {
      const srcimg = new Image();
      srcimg.onload = () => {
        // Set imgURL to display the image in the UI
        this.imgURL = src;
        loadImage(
          this,
          canvas,
          ctx,
          srcimg.src,
          this.colorsInGradient,
          this.quantizationMethod
        );
      };
      srcimg.src = src;
    },
    getShareLink(provider) {
      return getShareLink(provider, this.currentURL, this.paletteTitle);
    },
    saveSettingsToLocalStorage() {
      const settingsToSave = this.trackInLocalStorage.reduce((acc, setting) => {
        acc[setting.prop] = this[setting.prop];
        return acc;
      }, {});
      try {
        localStorage.setItem(
          "farbveloSettings",
          JSON.stringify(settingsToSave)
        );
      } catch (e) {
        console.error("Error saving settings to localStorage:", e);
      }
    },
    loadSettingsFromLocalStorage() {
      const savedSettingsString = localStorage.getItem("farbveloSettings");
      if (savedSettingsString) {
        try {
          const settings = JSON.parse(savedSettingsString);
          let settingsApplied = false;
          this.trackInLocalStorage.forEach((settingConfig) => {
            if (settings.hasOwnProperty(settingConfig.prop)) {
              this[settingConfig.prop] = settings[settingConfig.prop];
              settingsApplied = true;
            }
          });

          if (settingsApplied) {
            // Apply side-effects for loaded settings
            if (this.lightmode) {
              document.querySelector("body").classList.add("lightmode");
            } else {
              document.querySelector("body").classList.remove("lightmode");
            }
            this.animateBackgroundIntro = !!this.hasBackground;
            this.updateMeta();
            return true;
          }
        } catch (e) {
          console.error("Error loading settings from localStorage:", e);
          localStorage.removeItem("farbveloSettings");
        }
      }
      return false;
    },
    findAndStoreColorLocations() {
      if (this.generatorFunction !== 'ImageExtract' || !this.currentImageData || !this.colors || this.colors.length === 0) {
        return; // Exit if conditions aren't met
      }

      // Get RGB colors from the hex palette
      const targetRgbColors = this.colors.map(hexColor => {
        const rgb = chroma(hexColor).rgb();
        return { r: rgb[0], g: rgb[1], b: rgb[2] };
      });

      // Create a mapping from RGB keys to hex colors
      const rgbToHexMap = {};
      targetRgbColors.forEach((rgb, index) => {
        const key = `${rgb.r}-${rgb.g}-${rgb.b}`;
        rgbToHexMap[key] = this.colors[index];
      });

      // Find color positions using the worker
      startColorLocatorWorker(
        this.currentImageData,
        targetRgbColors,
        (locations) => {
          // Store only one position per color (the best one - closest to center with lowest distance)
          const colorPositions = [];

          Object.entries(locations).forEach(([colorKey, positions]) => {
            // Filter out default positions
            const realPositions = positions.filter(p => !p.isDefault);

            if (realPositions.length > 0) {
              // Sort positions by distance from center (ascending)
              realPositions.sort((a, b) => a.distance - b.distance);

              // Strategically select a position to avoid clustering at the absolute center
              let strategicIndex = 0;
              if (realPositions.length > 1) {
                // If there are multiple positions, pick one that's not the absolute closest.
                // This aims for roughly the median position by distance.
                // Examples:
                // - length 2: index 1 (the further one)
                // - length 3: index 1 (the middle one)
                // - length 4: index 2
                // - length 5: index 2 (the middle one)
                strategicIndex = Math.min(realPositions.length - 1, Math.floor(realPositions.length * 0.5));
                // Ensure index is at least 0 if realPositions.length is 1.
                if (realPositions.length === 1) strategicIndex = 0;
              }
              const bestPosition = realPositions[strategicIndex];

              // Add to our array with hex color and position
              colorPositions.push({
                color: rgbToHexMap[colorKey] || colorKey,
                position: {
                  x: bestPosition.x,
                  y: bestPosition.y,
                  distance: bestPosition.distance
                }
              });
            }
          });

          // Store the results
          this.colorPositions = colorPositions;

          // Find the image container to place the visualization
          const imgContainer = document.querySelector('.image-container') || document.querySelector('.app-intro');
          if (imgContainer && colorPositions.length > 0) {
            // Convert to format needed by visualization function
            const visLocations = {};
            colorPositions.forEach(item => {
              const rgb = chroma(item.color).rgb();
              const key = `${rgb[0]}-${rgb[1]}-${rgb[2]}`;
              visLocations[key] = [item.position];
            });

            // Visualize the positions on the image
            visualizeColorPositions(visLocations, this.colors, imgContainer, this.currentImageData);
          }
        },
        (error) => {
          console.error("Color locator error:", error.message);
        }
      );
    },
  },
  mounted() {
    this.getLists();
    const loadStatus = this.settingsFromURLAndLocalStorage();
    const hadSettingsFromURL = loadStatus.hadSettingsFromURL;
    const hadSettingsFromLocalStorage = loadStatus.hadSettingsFromLocalStorage;
    const anySettingsLoaded = hadSettingsFromURL || hadSettingsFromLocalStorage;

    // Remove URL query string if settings came from it and not tracking in URL
    if (hadSettingsFromURL && !this.trackSettingsInURL) {
      window.history.replaceState({}, document.title, location.pathname);
    }

    // Add popstate event listener to handle browser back/forward buttons
    window.addEventListener('popstate', (event) => {
      // Handle state restoration when the user navigates through browser history
      if (event.state && event.state.seed) {
        this.currentSeed = event.state.seed;

        // If we have settings in the state, restore them (expects compact format)
        if (event.state.settings) {
          try {
            // Decode base64 (browser-native)
            const binaryString = atob(event.state.settings);
            // Modern way to decode Base64 to UTF-8 string
            const uint8Array = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              uint8Array[i] = binaryString.charCodeAt(i);
            }
            const jsonString = new TextDecoder().decode(uint8Array);
            let urlSettings = JSON.parse(jsonString);

            // Apply the settings from history state
            this.trackInURL.forEach((setting) => {
              if (urlSettings[setting.key]) {
                this[setting.prop] = setting.p
                  ? setting.p(urlSettings[setting.key])
                  : urlSettings[setting.key];
              }
            });

            // Regenerate colors with the restored seed
            this.rnd = new Seedrandom(this.currentSeed);
            this.newColors(false); // false because we're restoring, not creating a new seed
          } catch (e) {
            console.error('Error restoring settings from history state:', e);
          }
        }
      } else {
        // If no state (e.g., user navigated to base URL), reset to defaults
        if (!window.location.search) {
          this.resetSettings();
          this.newColors(true);
        }
      }
    });

    if ("ondrop" in window) {
      document.documentElement.addEventListener("dragover", (e) => {
        e.preventDefault();
      });

      document.documentElement.addEventListener("dragleave", (e) => {
        e.preventDefault();
      });

      document.documentElement.addEventListener("drop", (e) => {
        const file = e.dataTransfer.files[0];
        if (e.dataTransfer.files.length && file.type.match(/^image\//)) {
          e.preventDefault();
          this.imgURL = " ";
          this.generatorFunction = "ImageExtract";
          const reader = new FileReader();
          reader.addEventListener("loadend", (event) => {
            this.processImageSource(event.target.result);
            setTimeout(() => {
              this.settingsVisible = true;
            }, 500);
          });
          reader.readAsDataURL(file);
        }
      });
    }

    const isPalm = window.matchMedia("(max-width: 850px)");

    if (isPalm.matches) {
      this.expandUI = true;
    }

    const moreContrast = window.matchMedia("(prefers-contrast: more)");

    if (moreContrast.matches && !anySettingsLoaded) {
      this.highContrast = true;
      this.hasGradients = false;
    }

    if (!anySettingsLoaded) {
      // Use one of the solid first impression seeds if no settings loaded
      this.currentSeed = fistImpressionSeed;
      this.rnd = new Seedrandom(this.currentSeed);
      this.newColors(false); // false because we're using a preset seed

      // Apply OS theme if no settings loaded from anywhere
      const wantLightMode = window.matchMedia("(prefers-color-scheme: light)");
      if (wantLightMode.matches) {
        this.lightmode = true;
      }
    } else {
      this.newColors(false); // Don't generate a new seed if settings were loaded
    }

    this.addMagicControls();

    document.querySelector("body").classList.remove("is-loading");

    setTimeout(() => {
      this.isLoading = false;
    }, 100);

    setTimeout(() => {
      this.isAnimating = false;
    }, 1600);

    if (this.animateBackgroundIntro && !anySettingsLoaded) {
      // Only animate intro if not loading from settings
      setTimeout(() => {
        this.hasBackground = true;
      }, 2000);
    }
  },
});
