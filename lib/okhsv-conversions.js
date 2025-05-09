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
        // V_okhsv = L_ok / L_cusp (simplified, assumes L_ok <= L_cusp)
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

// ES6 Exports
export {
    okhsvToOklab,
    oklabToOkhsv,
    // The internal functions can also be exported if needed for testing/debugging elsewhere
    // For now, only exporting the main conversion functions.
    // toe,
    // toe_inv,
    // oklab_to_linear_srgb,
    // find_gamut_intersection_chroma,
    // get_cusp_approx
};
