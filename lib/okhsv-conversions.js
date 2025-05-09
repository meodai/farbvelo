// Farbvelo Okhsv <-> Oklab Conversion Utilities
// Based on Oklab color space by Björn Ottosson
// Okhsv definition also by Björn Ottosson

// Non-linearity functions for Oklab cone responses (effectively cbrt and cube)
function toe(x) {
    return Math.cbrt(x);
}

function toe_inv(x_prime) {
    return x_prime * x_prime * x_prime;
}

// Matrix to convert LMS (cone responses) to XYZ. (M1_inv from Ottosson's post)
const LMS_TO_XYZ_MATRIX = [
    [1.22701385, -0.55779998, 0.28125615],
    [-0.04058017, 1.11225686, -0.07167669],
    [-0.07638128, -0.42148198, 1.58616322]
];

// Coefficients to convert Oklab's L,a,b to l',m',s' (primed cone responses).
// Derived from M2_inv matrix from Ottosson's post.
const OKLAB_TO_LMS_PRIME_COEFFS = {
    a_coeffs: [0.3963377774, -0.1055613458, -0.0894841775], // Coefficients for a_ok
    b_coeffs: [0.2158037573, -0.0638541728, -1.2914855480]  // Coefficients for b_ok
};

// Matrix to convert XYZ to Linear sRGB (D65 illuminant).
const XYZ_TO_SRGB_MATRIX = [
    [3.2404542, -1.5371385, -0.4985314],
    [-0.9692660, 1.8760108, 0.0415560],
    [0.0556434, -0.2040259, 1.0572252]
];

// Helper function: Convert Oklab to Linear sRGB
function oklab_to_linear_srgb(L_ok, a_ok, b_ok) {
    const l_p = L_ok + OKLAB_TO_LMS_PRIME_COEFFS.a_coeffs[0] * a_ok + OKLAB_TO_LMS_PRIME_COEFFS.b_coeffs[0] * b_ok;
    const m_p = L_ok + OKLAB_TO_LMS_PRIME_COEFFS.a_coeffs[1] * a_ok + OKLAB_TO_LMS_PRIME_COEFFS.b_coeffs[1] * b_ok;
    const s_p = L_ok + OKLAB_TO_LMS_PRIME_COEFFS.a_coeffs[2] * a_ok + OKLAB_TO_LMS_PRIME_COEFFS.b_coeffs[2] * b_ok;

    const L_cone = toe_inv(l_p);
    const M_cone = toe_inv(m_p);
    const S_cone = toe_inv(s_p);

    const X = LMS_TO_XYZ_MATRIX[0][0] * L_cone + LMS_TO_XYZ_MATRIX[0][1] * M_cone + LMS_TO_XYZ_MATRIX[0][2] * S_cone;
    const Y = LMS_TO_XYZ_MATRIX[1][0] * L_cone + LMS_TO_XYZ_MATRIX[1][1] * M_cone + LMS_TO_XYZ_MATRIX[1][2] * S_cone;
    const Z = LMS_TO_XYZ_MATRIX[2][0] * L_cone + LMS_TO_XYZ_MATRIX[2][1] * M_cone + LMS_TO_XYZ_MATRIX[2][2] * S_cone;

    const r_lin = XYZ_TO_SRGB_MATRIX[0][0] * X + XYZ_TO_SRGB_MATRIX[0][1] * Y + XYZ_TO_SRGB_MATRIX[0][2] * Z;
    const g_lin = XYZ_TO_SRGB_MATRIX[1][0] * X + XYZ_TO_SRGB_MATRIX[1][1] * Y + XYZ_TO_SRGB_MATRIX[1][2] * Z;
    const b_lin = XYZ_TO_SRGB_MATRIX[2][0] * X + XYZ_TO_SRGB_MATRIX[2][1] * Y + XYZ_TO_SRGB_MATRIX[2][2] * Z;

    return { r: r_lin, g: g_lin, b: b_lin };
}

// Helper: Finds the maximum chroma C for a given Oklab L and hue h_rad within sRGB gamut
function find_gamut_intersection_chroma(h_rad, L_target) {
    if (L_target < -0.001 || L_target > 1.001) return 0; // L must be ~[0, 1]

    let low_C = 0;
    let high_C = 0.5; // Max possible chroma in Oklab for sRGB is ~0.3-0.4
    const N_ITERATIONS = 15;
    let C_max_in_gamut = 0;

    for (let i = 0; i < N_ITERATIONS; i++) {
        const mid_C = (low_C + high_C) / 2;
        if (mid_C < 1e-5) {
            C_max_in_gamut = Math.max(C_max_in_gamut, mid_C);
            low_C = mid_C;
            continue;
        }
        const a = mid_C * Math.cos(h_rad);
        const b = mid_C * Math.sin(h_rad);
        const rgb = oklab_to_linear_srgb(L_target, a, b);
        const tolerance = 1e-4;
        if (rgb.r >= -tolerance && rgb.r <= 1 + tolerance &&
            rgb.g >= -tolerance && rgb.g <= 1 + tolerance &&
            rgb.b >= -tolerance && rgb.b <= 1 + tolerance) {
            C_max_in_gamut = mid_C;
            low_C = mid_C;
        } else {
            high_C = mid_C;
        }
    }
    return C_max_in_gamut;
}

// Helper: Approximates the L_cusp and C_cusp for a given hue.
// NOTE: This is a computationally intensive approximation.
function get_cusp_approx(h_rad) {
    let max_C_found = 0;
    let L_at_max_C = 0.5;
    const L_STEPS = 50; // Performance vs. accuracy trade-off

    for (let i = 0; i <= L_STEPS; i++) {
        const l_test = i / L_STEPS;
        const c_at_l_test = find_gamut_intersection_chroma(h_rad, l_test);
        if (c_at_l_test > max_C_found) {
            max_C_found = c_at_l_test;
            L_at_max_C = l_test;
        }
    }
    if (max_C_found < 1e-5) { // Achromatic or near-achromatic
        L_at_max_C = 0.5; // Default L_cusp for C_cusp = 0
    }
    return { L_cusp: L_at_max_C, C_cusp: max_C_found };
}

/**
 * Converts Okhsv color coordinates to Oklab.
 * @param {number} h_okhsv_deg Hue in degrees [0, 360).
 * @param {number} s_okhsv Saturation [0, 1].
 * @param {number} v_okhsv Value [0, 1].
 * @returns {{L: number, a: number, b: number}} Oklab color.
 */
function okhsvToOklab(h_okhsv_deg, s_okhsv, v_okhsv) {
    // Handle achromatic case: if saturation is near zero, L is v, a and b are 0.
    if (s_okhsv < 1e-5) {
        return { L: Math.max(0.0, Math.min(1.0, v_okhsv)), a: 0, b: 0 };
    }

    const h_rad = (h_okhsv_deg % 360) * Math.PI / 180.0;
    const { L_cusp } = get_cusp_approx(h_rad);
    // Note: C_cusp from get_cusp_approx is not directly used here, but L_cusp is vital.

    // V_okhsv maps L_ok from 0 up to L_cusp.
    // So, L_ok = v_okhsv * L_cusp. When v_okhsv is 1, L_ok should be L_cusp.
    let L_ok = v_okhsv * L_cusp;
    L_ok = Math.max(0.0, Math.min(1.0, L_ok)); // Clamp L_ok for stability

    // S_okhsv maps C_ok from 0 up to the max chroma possible for this L_ok and h_rad.
    const C_ok_max_at_L = find_gamut_intersection_chroma(h_rad, L_ok);
    const C_ok = s_okhsv * C_ok_max_at_L;

    const a_ok = C_ok * Math.cos(h_rad);
    const b_ok = C_ok * Math.sin(h_rad);
    return { L: L_ok, a: a_ok, b: b_ok };
}

/**
 * Converts Oklab color coordinates to Okhsv.
 * @param {number} L_ok Lightness [0, 1].
 * @param {number} a_ok Green-red axis.
 * @param {number} b_ok Blue-yellow axis.
 * @returns {{h: number, s: number, v: number}} Okhsv color (h in degrees [0, 360)).
 */
function oklabToOkhsv(L_ok, a_ok, b_ok) {
    const C_ok = Math.sqrt(a_ok * a_ok + b_ok * b_ok);

    // Handle achromatic case: if chroma is near zero, s is 0, v is L_ok. Hue is arbitrary (e.g., 0).
    if (C_ok < 1e-5) {
        return { h: 0, s: 0, v: Math.max(0.0, Math.min(1.0, L_ok)) };
    }

    let h_rad = Math.atan2(b_ok, a_ok);

    const L_ok_clamped = Math.max(0.0, Math.min(1.0, L_ok));
    const { L_cusp } = get_cusp_approx(h_rad); // C_cusp is also returned but not directly used here.

    let v_okhsv;
    if (L_cusp < 1e-5) {
        // If L_cusp is effectively zero (e.g. for an achromatic hue, or error in cusp calculation),
        // L_ok_clamped / L_cusp is ill-defined or very large.
        // Set v_okhsv to 1 if L_ok is not black, otherwise 0.
        v_okhsv = (L_ok_clamped > 1e-5) ? 1.0 : 0.0;
    } else {
        // V_OKhsv = L_ok / L_cusp (simplified, assumes L_ok <= L_cusp)
        v_okhsv = L_ok_clamped / L_cusp;
    }
    v_okhsv = Math.max(0, Math.min(1, v_okhsv)); // Clamp v_okhsv to [0, 1]

    const C_ok_max_at_L = find_gamut_intersection_chroma(h_rad, L_ok_clamped);
    let s_okhsv = (C_ok_max_at_L < 1e-5) ? 0 : C_ok / C_ok_max_at_L;
    s_okhsv = Math.max(0, Math.min(1, s_okhsv)); // Clamp s_okhsv to [0, 1]

    let h_okhsv_deg = h_rad * 180.0 / Math.PI;
    h_okhsv_deg = (h_okhsv_deg % 360 + 360) % 360; // Normalize hue to [0, 360)

    return { h: h_okhsv_deg, s: s_okhsv, v: v_okhsv };
}

// Constants for Okhsl's L_r lightness estimate
const K1_LR = 0.206;
const K2_LR = 0.03;
const K3_LR = (1.0 + K1_LR) / (1.0 + K2_LR);

// Toe function for Okhsl's L_r from Oklab's L
function toe_Lr(L_ok) {
    return 0.5 * (K3_LR * L_ok - K1_LR + Math.sqrt((K3_LR * L_ok - K1_LR) * (K3_LR * L_ok - K1_LR) + 4 * K2_LR * K3_LR * L_ok));
}

// Inverse toe function for Oklab's L from Okhsl's l (L_r)
function toe_inv_Lr(l_okhsl) {
    return (l_okhsl * l_okhsl + K1_LR * l_okhsl) / (K3_LR * (l_okhsl + K2_LR));
}

// Helper for Okhsl: Smooth approximation of the cusp location for C_mid
// Polynomial coefficients from Ottosson's C++ code (get_ST_mid)
function get_ST_mid(a_, b_) {
    const S = 0.11516993 + 1.0 / (
        +7.44778970 +
        +4.15901240 * b_ +
        a_ * (-2.19557347 +
            +1.75198401 * b_ +
            a_ * (-2.13704948 +
                -10.02301043 * b_ +
                a_ * (-4.24894561 +
                    +5.38770819 * b_ + 4.69891013 * a_
                )
            )
        )
    );
    const T = 0.11239642 + 1.0 / (
        +1.61320320 +
        -0.68124379 * b_ +
        a_ * (+0.40370612 +
            +0.90148123 * b_ +
            a_ * (-0.27087943 +
                +0.61223990 * b_ +
                a_ * (+0.00299215 +
                    -0.45399568 * b_ - 0.14661872 * a_
                )
            )
        )
    );
    return { S_mid: S, T_mid: T };
}

// Helper for Okhsl: Calculate C_0, C_mid, C_max for a given L_oklab and hue (a_, b_)
function get_Cs(L_oklab, a_, b_, h_rad) {
    const cusp = get_cusp_approx(h_rad); // { L_cusp, C_cusp }

    // C_max: Max chroma in sRGB gamut for this L_oklab and hue
    const C_max = find_gamut_intersection_chroma(h_rad, L_oklab);

    // Scale factor k to compensate for the curved part of gamut shape
    // cusp.L_cusp can be 0 for black, cusp.C_cusp can be 0.
    // Avoid division by zero if L_cusp or (1-L_cusp) is zero.
    let S_cusp = 0;
    let T_cusp = 0;
    if (cusp.L_cusp > 1e-7) S_cusp = cusp.C_cusp / cusp.L_cusp;
    if ((1.0 - cusp.L_cusp) > 1e-7) T_cusp = cusp.C_cusp / (1.0 - cusp.L_cusp);

    const C_max_triangle_component = Math.min(L_oklab * S_cusp, (1.0 - L_oklab) * T_cusp);
    const k = (C_max_triangle_component > 1e-7) ? C_max / C_max_triangle_component : 0;

    // C_mid: Smoothed chroma estimate
    const { S_mid, T_mid } = get_ST_mid(a_, b_);
    const C_a_mid = L_oklab * S_mid;
    const C_b_mid = (1.0 - L_oklab) * T_mid;
    // Soft minimum: ( (C_a_mid^-n + C_b_mid^-n) / 2 ) ^ (-1/n)
    // Using n=4 as in Ottosson's code (sqrt(sqrt(1/(1/C_a^4 + 1/C_b^4))))
    // Simplified to avoid issues with C_a_mid or C_b_mid being zero or very small.
    let C_mid_val;
    if (C_a_mid < 1e-7 || C_b_mid < 1e-7) {
        C_mid_val = 0;
    } else {
         C_mid_val = 0.9 * k * Math.pow(1.0 / (Math.pow(C_a_mid, -4) + Math.pow(C_b_mid, -4)), 0.25);
    }


    // C_0: Chroma for near-achromatic colors, hue-independent shape
    // Values for S_0 and T_0 are constants (0.4 and 0.8) from Ottosson's code
    const C_a_0 = L_oklab * 0.4;
    const C_b_0 = (1.0 - L_oklab) * 0.8;
    // Soft minimum with n=2
    let C_0_val;
    if (C_a_0 < 1e-7 || C_b_0 < 1e-7) {
        C_0_val = 0;
    } else {
        C_0_val = Math.sqrt(1.0 / (1.0 / (C_a_0 * C_a_0) + 1.0 / (C_b_0 * C_b_0)));
    }


    return { C_0: C_0_val, C_mid: C_mid_val, C_max: C_max };
}


/**
 * Converts Okhsl color coordinates to Oklab.
 * @param {number} h_okhsl_deg Hue in degrees [0, 360).
 * @param {number} s_okhsl Saturation [0, 1].
 * @param {number} l_okhsl Lightness [0, 1].
 * @returns {{L: number, a: number, b: number}} Oklab color.
 */
function okhslToOklab(h_okhsl_deg, s_okhsl, l_okhsl) {
    if (l_okhsl >= 0.99999) return { L: 1.0, a: 0, b: 0 }; // White
    if (l_okhsl <= 0.00001) return { L: 0.0, a: 0, b: 0 }; // Black

    const L_ok = toe_inv_Lr(l_okhsl); // Oklab L from Okhsl l

    const h_rad = (h_okhsl_deg % 360) * Math.PI / 180.0;
    const a_ = Math.cos(h_rad);
    const b_ = Math.sin(h_rad);

    const { C_0, C_mid, C_max } = get_Cs(L_ok, a_, b_, h_rad);

    let C_ok;
    const mid_s = 0.8; // Saturation threshold for interpolation change
    const mid_s_inv = 1.0 / mid_s;

    if (s_okhsl < mid_s) {
        const t = mid_s_inv * s_okhsl;
        const k1 = mid_s * C_0;
        const k2 = (C_mid > 1e-7) ? (1.0 - k1 / C_mid) : 1.0; // Avoid division by zero if C_mid is zero
        C_ok = (k1 > 1e-7 && (1.0 - k2 * t) > 1e-7) ? (t * k1 / (1.0 - k2 * t)) : 0.0;
    } else {
        const t = (s_okhsl - mid_s) / (1.0 - mid_s);
        const k0 = C_mid;
        const k1 = (C_0 > 1e-7) ? ((1.0 - mid_s) * C_mid * C_mid * mid_s_inv * mid_s_inv / C_0) : 0.0;
        const C_delta = C_max - C_mid;
        const k2 = (C_delta > 1e-7 || C_delta < -1e-7) ? (1.0 - k1 / C_delta) : 1.0; // Avoid division by zero
        C_ok = (k1 > 1e-7 && (1.0 - k2 * t) > 1e-7) ? (k0 + t * k1 / (1.0 - k2 * t)) : k0;
    }
     C_ok = Math.max(0, C_ok);


    return { L: L_ok, a: C_ok * a_, b: C_ok * b_ };
}

/**
 * Converts Oklab color coordinates to Okhsl.
 * @param {number} L_ok Lightness [0, 1].
 * @param {number} a_ok Green-red axis.
 * @param {number} b_ok Blue-yellow axis.
 * @returns {{h: number, s: number, l: number}} Okhsl color (h in degrees [0, 360)).
 */
function oklabToOkhsl(L_ok, a_ok, b_ok) {
    const l_okhsl = toe_Lr(L_ok); // Okhsl l from Oklab L

    if (l_okhsl >= 0.99999) return { h: 0, s: 0, l: 1.0 }; // White
    if (l_okhsl <= 0.00001) return { h: 0, s: 0, l: 0.0 }; // Black

    const C_ok = Math.sqrt(a_ok * a_ok + b_ok * b_ok);

    if (C_ok < 1e-5) { // Achromatic
        return { h: 0, s: 0, l: l_okhsl };
    }

    let h_rad = Math.atan2(b_ok, a_ok);
    const a_ = Math.cos(h_rad); // or a_ok / C_ok
    const b_ = Math.sin(h_rad); // or b_ok / C_ok

    const { C_0, C_mid, C_max } = get_Cs(L_ok, a_, b_, h_rad);

    let s_okhsl;
    const mid_s = 0.8;
    const mid_s_inv = 1.0 / mid_s;

    if (C_ok < C_mid) {
        const k1 = mid_s * C_0;
        const k2 = (C_mid > 1e-7) ? (1.0 - k1 / C_mid) : 1.0;
        const t = (k1 > 1e-7 || (k2 * C_ok) > 1e-7 ) ? C_ok / (k1 + k2 * C_ok) : 0.0;
        s_okhsl = t * mid_s;
    } else {
        const k0 = C_mid;
        const k1 = (C_0 > 1e-7) ? ((1.0 - mid_s) * C_mid * C_mid * mid_s_inv * mid_s_inv / C_0) : 0.0;
        const C_delta = C_max - C_mid;
        const k2 = (C_delta > 1e-7 || C_delta < -1e-7) ? (1.0 - k1 / C_delta) : 1.0;
        const C_ok_minus_k0 = C_ok - k0;
        const t = (k1 > 1e-7 || (k2 * C_ok_minus_k0) > 1e-7) ? C_ok_minus_k0 / (k1 + k2 * C_ok_minus_k0) : 0.0;
        s_okhsl = mid_s + (1.0 - mid_s) * t;
    }
    s_okhsl = Math.max(0, Math.min(1, s_okhsl));


    let h_okhsl_deg = h_rad * 180.0 / Math.PI;
    h_okhsl_deg = (h_okhsl_deg % 360 + 360) % 360;

    return { h: h_okhsl_deg, s: s_okhsl, l: l_okhsl };
}


// ES6 Exports
export {
    okhsvToOklab,
    oklabToOkhsv,
    okhslToOklab,
    oklabToOkhsl,
    // The internal functions can also be exported if needed for testing/debugging elsewhere
    // For now, only exporting the main conversion functions.
    // toe,
    // toe_inv,
    // oklab_to_linear_srgb,
    // find_gamut_intersection_chroma,
    // get_cusp_approx
};
