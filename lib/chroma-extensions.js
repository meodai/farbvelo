// lib/chroma-extensions.js
import chroma from 'chroma-js';
import { okhsvToOklab, oklabToOkhsv } from './okhsv-conversions.js';

// Add Okhsv support to Chroma.js

// Constructor: chroma.okhsv(h, s, v, alpha) or chroma.okhsv([h,s,v,a]) or chroma.okhsv({h,s,v,a})
// h in [0, 360], s in [0, 1], v in [0, 1], alpha in [0,1]
chroma.okhsv = function(...args) {
    let h_deg, s_norm, v_norm, alpha = 1;

    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
        if (Array.isArray(args[0])) { // Input: [h, s, v, alpha_optional]
            h_deg = args[0][0];
            s_norm = args[0][1];
            v_norm = args[0][2];
            alpha = (args[0][3] === undefined) ? 1 : args[0][3];
        } else { // Input: {h, s, v, alpha_optional}
            h_deg = args[0].h;
            s_norm = args[0].s;
            v_norm = args[0].v;
            alpha = (args[0].alpha === undefined) ? 1 : args[0].alpha;
        }
    } else if (args.length >= 3) { // Input: h, s, v, alpha_optional
        h_deg = args[0];
        s_norm = args[1];
        v_norm = args[2];
        alpha = (args[3] === undefined) ? 1 : args[3];
    } else {
        throw new Error('Invalid arguments for chroma.okhsv. Expected (h,s,v,[alpha]), or ([h,s,v,alpha]), or ({h,s,v,alpha}).');
    }

    if (typeof h_deg === 'undefined' || typeof s_norm === 'undefined' || typeof v_norm === 'undefined') {
         throw new Error('Invalid Okhsv components: h, s, and v must be provided.');
    }

    const oklabColor = okhsvToOklab(h_deg, s_norm, v_norm);
    return chroma.oklab(oklabColor.L, oklabColor.a, oklabColor.b).alpha(alpha);
};

// Method: color.okhsv() -> [h, s, v, alpha]
// Returns h in [0, 360], s in [0, 1], v in [0, 1], alpha in [0,1]
chroma.Color.prototype.okhsv = function() {
    const [L, a, b] = this.oklab(); // Gets L,a,b from the current color
    const okhsvColor = oklabToOkhsv(L, a, b);
    return [okhsvColor.h, okhsvColor.s, okhsvColor.v, this.alpha()];
};

// Placeholder for Okhsl if needed in the future
// chroma.okhsl = function(...) { /* ... */ };
// chroma.Color.prototype.okhsl = function() { /* ... */ };

export default chroma;
