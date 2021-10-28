# FarbVelo
"Random" color palette generator.  
## Farbvelo

FarbVelo (Swiss-German for color bicycle) is a playful color picking tool. It uses simple rules and lots of random numbers to help you come up with pleasing color combinations or just chill while cycling through color harmonies (I almost find it a bit psychedelic while listening to [custom made white noise](https://mynoise.net/NoiseMachines/tropicalRainNoiseGenerator.php)).

## About

1. Picking ℕ0 hue's (color stops) using [HSLuv](https://www.hsluv.org/) <a>at a user defined minimum angle ∠.</a>
2. Interpolating between color stops in CIE L*a*b* by default, using [chroma.js](https://gka.github.io/chroma.js/).
3. Finding pleasing [color names](https://github.com/meodai/color-names) using the color name [API](https://github.com/meodai/color-names#api-)
4. Icons made by [Ravindra Kalkani](https://thenounproject.com/search/?q=reload&i=1973430).
5. Originally released as a [Codepen](https://codepen.io/meodai/pen/RerqjG).
6. Source is on [github](https://github.com/meodai/farbvelo) and licensed under a [Creative Commons Attribution Share Alike 4.0](https://github.com/meodai/farbvelo/blob/main/LICENSE.md) license.

## Engine

If you are anything like me, you are probably here to find out how the color picking works. Since this code is based on an old project and the code is very 
messy, let me help you:

```js
// minHueDiffAngle = 60

// create an array of hues to pick from.
  const baseHue = random(0, 360);
  const hues = new Array(Math.round( 360 / minHueDiffAngle) ).fill('').map((offset, i) => {
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

  chroma.scale(colors)
        .padding(.175)
        .mode('lab')
        .colors(6);
```

## Techstack & Credits

- Icons: [iconoir](https://iconoir.com/)
- Vue
- Chroma.js
- Inter Font
- Space Mono Font

## Samples

![sample screenshot of color bingo engine](public/samples/engine-color-bingo-01.png)
![sample screenshot of color bingo engine](public/samples/engine-color-bingo-02.png)
![sample screenshot of color bingo engine](public/samples/engine-color-bingo-03.png)
![sample screenshot of color bingo engine](public/samples/engine-color-bingo-04.png)
![sample screenshot of color bingo engine](public/samples/engine-color-bingo-05.png)
![sample screenshot of color bingo engine](public/samples/engine-color-bingo-06.png)
![sample screenshot of legacy engine](public/samples/engine-legacy-01.png)
![sample screenshot of legacy engine](public/samples/engine-legacy-02.png)
![sample screenshot of legacy engine](public/samples/engine-legacy-03.png)
![sample screenshot of legacy engine](public/samples/engine-legacy-04.png)
![sample screenshot of legacy engine](public/samples/engine-legacy-05.png)
![sample screenshot of legacy engine](public/samples/engine-legacy-06.png)
![sample screenshot of legacy engine](public/samples/engine-legacy-07.png)
![sample screenshot of legacy engine](public/samples/engine-legacy-08.png)
![sample screenshot of legacy engine](public/samples/engine-legacy-09.png)
![sample screenshot of legacy engine](public/samples/engine-legacy-10.png)
![sample screenshot of legacy engine](public/samples/engine-legacy-11.png)
![sample screenshot of legacy engine](public/samples/engine-legacy-12.png)
