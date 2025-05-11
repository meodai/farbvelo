import chroma from 'chroma-js';
import {
  okhsvToOklab,
  oklabToOkhsv,
  okhslToOklab,
  oklabToOkhsl,
} from "./okhsv-conversions.js";

// Add Okhsv support to Chroma.js

// Helper to extract arguments for okhsv/okhsl constructors
function parseOkColorArgs(args, keys) {
    let vals = keys.map(() => undefined);
    let alpha = 1;
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
        if (Array.isArray(args[0])) {
            vals = args[0].slice(0, keys.length);
            alpha = args[0][keys.length] === undefined ? 1 : args[0][keys.length];
        } else {
            vals = keys.map(k => args[0][k]);
            alpha = args[0].alpha === undefined ? 1 : args[0].alpha;
        }
    } else if (args.length >= keys.length) {
        vals = args.slice(0, keys.length);
        alpha = args[keys.length] === undefined ? 1 : args[keys.length];
    } else {
        throw new Error(`Invalid arguments for chroma.ok${keys.join('')}. Expected (${keys.join(',')},[alpha]), or ([${keys.join(',')},alpha]), or ({${keys.join(',')},alpha}).`);
    }
    if (vals.some(v => typeof v === 'undefined')) {
        throw new Error(`Invalid Ok${keys.join('')} components: ${keys.join(', ')} must be provided.`);
    }
    return [...vals, alpha];
}

// Constructor: chroma.okhsv(h, s, v, alpha) or chroma.okhsv([h,s,v,a]) or chroma.okhsv({h,s,v,a})
// h in [0, 360], s in [0, 1], v in [0, 1], alpha in [0,1]
chroma.okhsv = function(...args) {
    const [h, s, v, alpha] = parseOkColorArgs(args, ['h', 's', 'v']);
    const oklabColor = okhsvToOklab(h, s, v);
    return chroma.oklab(oklabColor.L, oklabColor.a, oklabColor.b).alpha(alpha);
};

// Method: color.okhsv() -> [h, s, v, alpha]
// Returns h in [0, 360], s in [0, 1], v in [0, 1], alpha in [0,1]
chroma.Color.prototype.okhsv = function() {
    const [L, a, b] = this.oklab(); // Gets L,a,b from the current color
    const okhsvColor = oklabToOkhsv(L, a, b);
    return [okhsvColor.h, okhsvColor.s, okhsvColor.v, this.alpha()];
};

// Add Okhsl support to Chroma.js

// Constructor: chroma.okhsl(h, s, l, alpha) or chroma.okhsl([h,s,l,a]) or chroma.okhsl({h,s,l,a})
// h in [0, 360], s in [0, 1], l in [0, 1], alpha in [0,1]
chroma.okhsl = function(...args) {
    const [h, s, l, alpha] = parseOkColorArgs(args, ['h', 's', 'l']);
    const oklabColor = okhslToOklab(h, s, l);
    return chroma.oklab(oklabColor.L, oklabColor.a, oklabColor.b).alpha(alpha);
};

// Method: color.okhsl() -> [h, s, l, alpha]
// Returns h in [0, 360], s in [0, 1], l in [0, 1], alpha in [0,1]
chroma.Color.prototype.okhsl = function() {
    const [L, a, b] = this.oklab(); // Gets L,a,b from the current color
    const okhslColor = oklabToOkhsl(L, a, b);
    return [okhslColor.h, okhslColor.s, okhslColor.l, this.alpha()];
};

export default chroma;
