// Authored body poses for committed skills. Times are seconds
// from the input: startup, active/release, then recovery. Values move the cat's
// actual limbs/body, not an overlay. Others keep their existing animations.
export const SKILL_ACTIONS = {
  meteor_paw: {
    startup: 0.18, active: 0.10, recovery: 0.12,
    frames: [
      [0,    { crouch: 0.15, lean: -0.18, frontX: -3, frontY: 2, backX: 0, backY: 2 }],
      [0.18, { crouch: 0.60, lean: -0.28, frontX: 15, frontY: -25, backX: -24, backY: -20, headTilt: -0.18 }],
      [0.25, { crouch: 0.04, lean: 0.18, frontX: 24, frontY: -35, backX: -28, backY: -31, headTilt: -0.25 }],
      [0.40, {}],
    ],
  },
  lunar_beam: {
    startup: 0.18, active: 0.08, recovery: 0.12,
    frames: [
      [0,    { crouch: 0.12, lean: -0.16, frontX: -5, frontY: -2, backX: 4, backY: 0 }],
      [0.18, { crouch: 0.40, lean: -0.28, frontX: 1, frontY: -11, backX: 3, backY: -8, headTilt: 0.12 }],
      [0.23, { crouch: 0.18, lean: 0.40, frontX: 23, frontY: -9, backX: 15, backY: -6, headTilt: 0.04 }],
      [0.38, {}],
    ],
  },
  executioner: {
    startup: 0.25, active: 0.09, recovery: 0.12,
    frames: [
      [0,    { crouch: 0.18, lean: -0.15, frontX: -7, frontY: 1, backX: -3, backY: 1 }],
      [0.24, { crouch: 0.45, lean: -0.34, bodyRoll: -0.15, frontX: -11, frontY: -25, backX: -7, backY: -21, headTilt: -0.25 }],
      [0.29, { crouch: 0.64, lean: 0.48, bodyRoll: 0.22, frontX: 21, frontY: 12, backX: 10, backY: 8, headTilt: 0.22 }],
      [0.46, {}],
    ],
  },
  rending_wave: {
    startup: 0.25, active: 0.09, recovery: 0.12,
    frames: [
      [0,    { crouch: 0.12, lean: -0.25, frontX: -7, frontY: 4, backX: 0, backY: 4 }],
      [0.24, { crouch: 0.68, lean: -0.38, bodyRoll: -0.12, frontX: -20, frontY: 7, backX: -8, backY: -2 }],
      [0.30, { crouch: 0.58, lean: 0.54, bodyRoll: 0.15, frontX: 29, frontY: 7, backX: -8, backY: 4 }],
      [0.46, {}],
    ],
  },
  starfall_volley: {
    startup: 0.22, active: 0.10, recovery: 0.12,
    frames: [
      [0,    { crouch: 0.08, lean: -0.10, frontX: -5, frontY: 3 }],
      [0.21, { crouch: 0.40, lean: -0.20, bodyRoll: -0.12, frontX: -15, frontY: 1, backX: -20, backY: -8 }],
      [0.27, { crouch: 0.05, lean: 0.15, bodyRoll: 0.08, frontX: 29, frontY: -32, backX: -9, backY: 8, headTilt: -0.22 }],
      [0.44, {}],
    ],
  },
  guardian_lion: {
    startup: 0.25, active: 0.10, recovery: 0.13,
    frames: [
      [0,    { crouch: 0.15, lean: -0.12, frontX: -4, frontY: -2 }],
      [0.24, { crouch: 0.28, lean: -0.25, frontX: 22, frontY: -28, backX: -22, backY: -25 }],
      [0.31, { crouch: 0.78, lean: 0.45, bodyRoll: 0.25, frontX: 15, frontY: 22, backX: -24, backY: 19, headTilt: 0.15 }],
      [0.48, {}],
    ],
  },
  spirit_cat: {
    startup: 0.25, active: 0.09, recovery: 0.12,
    frames: [
      [0,    { crouch: 0.10, frontX: -2, frontY: 3, backX: 0, backY: 2 }],
      [0.24, { crouch: 0.38, lean: -0.32, frontX: -8, frontY: -11, backX: -24, backY: 3, headTilt: -0.15 }],
      [0.30, { crouch: 0.10, lean: 0.30, bodyRoll: -0.05, frontX: 29, frontY: -20, backX: -26, backY: 8, headTilt: 0.12 }],
      [0.46, {}],
    ],
  },
  spirit_orbs: {
    startup: 0.25, active: 0.10, recovery: 0.12,
    frames: [
      [0,    { crouch: 0.12, frontX: -2, frontY: 2, backX: -3, backY: 2 }],
      [0.24, { crouch: 0.28, lean: -0.12, frontX: 8, frontY: 13, backX: -25, backY: -26, headTilt: -0.18 }],
      [0.30, { crouch: 0.12, bodyRoll: -0.13, frontX: 28, frontY: 11, backX: -29, backY: -32, headTilt: 0.19 }],
      [0.47, {}],
    ],
  },
  gravity_well: {
    startup: 0.25, active: 0.10, recovery: 0.12,
    frames: [
      [0,    { crouch: 0.12, lean: 0.12, frontX: 12, frontY: -6, backX: 5, backY: -4 }],
      [0.24, { crouch: 0.38, lean: 0.30, frontX: 27, frontY: -8, backX: 13, backY: 8 }],
      [0.30, { crouch: 0.58, lean: -0.45, bodyRoll: -0.22, frontX: -8, frontY: 12, backX: -28, backY: 9, headTilt: -0.18 }],
      [0.47, {}],
    ],
  },
  blaze_orbit: {
    startup: 0.25, active: 0.10, recovery: 0.12,
    frames: [
      [0,    { crouch: 0.12, frontX: -4, frontY: 3, backX: -6, backY: 3 }],
      [0.24, { crouch: 0.62, lean: -0.30, bodyRoll: -0.18, frontX: -22, frontY: 5, backX: 4, backY: -18, headTilt: -0.16 }],
      [0.30, { crouch: 0.04, lean: 0.22, bodyRoll: 0.24, frontX: 26, frontY: -34, backX: -32, backY: 10, headTilt: 0.18 }],
      [0.47, {}],
    ],
  },
  blood_moon: {
    startup: 0.25, active: 0.10, recovery: 0.13,
    frames: [
      [0,    { crouch: 0.10, lean: -0.10, frontX: -2, frontY: 2, backX: 0, backY: 1 }],
      [0.24, { crouch: 0.50, lean: -0.34, bodyRoll: 0.14, frontX: -20, frontY: -16, backX: -25, backY: -12, headTilt: -0.20 }],
      [0.31, { crouch: 0.65, lean: 0.35, bodyRoll: -0.24, frontX: 32, frontY: 15, backX: -30, backY: -19, headTilt: 0.24 }],
      [0.48, {}],
    ],
  },
  nine_lives: {
    startup: 0.25, active: 0.10, recovery: 0.12,
    frames: [
      [0,    { crouch: 0.10, lean: -0.10, frontX: -3, frontY: 2, backX: 1, backY: 2 }],
      [0.24, { crouch: 0.72, lean: -0.25, bodyRoll: 0.18, frontX: -15, frontY: -10, backX: -8, backY: 12, headTilt: -0.16 }],
      [0.30, { crouch: 0.82, lean: -0.40, bodyRoll: 0.28, frontX: -22, frontY: -24, backX: 12, backY: 19, headTilt: 0.22 }],
      [0.47, {}],
    ],
  },
  guardian_aura: {
    startup: 0.25, active: 0.10, recovery: 0.12,
    frames: [
      [0,    { crouch: 0.08, lean: -0.12, frontX: -3, frontY: 2, backX: 0, backY: 2 }],
      [0.24, { crouch: 0.45, lean: -0.20, frontX: -18, frontY: 7, backX: -20, backY: 10, headTilt: 0.12 }],
      [0.30, { crouch: 0.03, lean: -0.12, bodyRoll: 0.18, frontX: 20, frontY: -35, backX: -29, backY: -33, headTilt: -0.20 }],
      [0.47, {}],
    ],
  },
  time_fur: {
    startup: 0.25, active: 0.10, recovery: 0.13,
    frames: [
      [0,    { crouch: 0.12, lean: 0.10, frontX: 4, frontY: 0, backX: -2, backY: 1 }],
      [0.24, { crouch: 0.25, lean: 0.32, bodyRoll: 0.12, frontX: 20, frontY: -10, backX: -15, backY: 8, headTilt: 0.18 }],
      [0.31, { crouch: 0.36, lean: -0.42, bodyRoll: -0.27, frontX: 31, frontY: 2, backX: -20, backY: 20, headTilt: -0.24 }],
      [0.48, {}],
    ],
  },
  mirror_paw: {
    startup: 0.25, active: 0.10, recovery: 0.12,
    frames: [
      [0,    { crouch: 0.10, lean: -0.08, frontX: -3, frontY: 1, backX: 1, backY: 0 }],
      [0.24, { crouch: 0.35, lean: -0.35, bodyRoll: -0.15, frontX: -20, frontY: -12, backX: 10, backY: 10, headTilt: -0.16 }],
      [0.30, { crouch: 0.45, lean: 0.12, bodyRoll: 0.25, frontX: 29, frontY: -25, backX: 21, backY: 15, headTilt: 0.20 }],
      [0.47, {}],
    ],
  },
  kitten_army: {
    startup: 0.25, active: 0.10, recovery: 0.13,
    frames: [
      [0,    { crouch: 0.12, lean: -0.08, frontX: -4, frontY: 2, backX: 0, backY: 2 }],
      [0.24, { crouch: 0.75, lean: 0.16, bodyRoll: -0.16, frontX: 14, frontY: 10, backX: -17, backY: 14, headTilt: 0.15 }],
      [0.31, { crouch: 0.18, lean: 0.34, bodyRoll: 0.16, frontX: 33, frontY: -14, backX: 20, backY: -25, headTilt: -0.23 }],
      [0.48, {}],
    ],
  },
  thunder_step: {
    startup: 0.25, active: 0.10, recovery: 0.12,
    frames: [
      [0,    { crouch: 0.12, lean: -0.08, frontX: -4, frontY: 1, backX: 0, backY: 3 }],
      [0.24, { crouch: 0.76, lean: -0.38, bodyRoll: -0.18, frontX: -20, frontY: 10, backX: -27, backY: 12, headTilt: -0.14 }],
      [0.30, { crouch: 0.18, lean: 0.55, bodyRoll: 0.26, frontX: 34, frontY: 4, backX: -25, backY: 20, headTilt: 0.20 }],
      [0.47, {}],
    ],
  },
  frost_nova: {
    startup: 0.12, active: 0.08, recovery: 0.10, windup: 0.12,
    frames: [
      [0,    { crouch: 0.10, lean: -0.10, frontX: -3, frontY: 2, backX: 1, backY: 2 }],
      [0.11, { crouch: 0.58, lean: -0.18, bodyRoll: 0.18, frontX: -15, frontY: -16, backX: 8, backY: -10, headTilt: -0.14 }],
      [0.17, { crouch: 0.40, lean: 0.12, bodyRoll: -0.12, frontX: 28, frontY: 18, backX: -30, backY: 16, headTilt: 0.16 }],
      [0.30, {}],
    ],
  },
  whirling_claws: {
    startup: 0.10, active: 0.08, recovery: 0.10, windup: 0.10,
    frames: [
      [0,    { crouch: 0.10, lean: -0.08, frontX: -4, frontY: 2, backX: 0, backY: 2 }],
      [0.09, { crouch: 0.48, lean: -0.40, bodyRoll: -0.27, frontX: -22, frontY: 3, backX: -18, backY: -6, headTilt: -0.18 }],
      [0.15, { crouch: 0.30, lean: 0.48, bodyRoll: 0.32, frontX: 32, frontY: 7, backX: -31, backY: -12, headTilt: 0.22 }],
      [0.28, {}],
    ],
  },
  blood_fang: {
    startup: 0.10, active: 0.08, recovery: 0.10, windup: 0.10,
    frames: [
      [0,    { crouch: 0.10, lean: -0.10, frontX: -3, frontY: 2, backX: 0, backY: 1 }],
      [0.09, { crouch: 0.65, lean: -0.48, bodyRoll: -0.12, frontX: -16, frontY: 9, backX: -13, backY: 12, headTilt: -0.28 }],
      [0.15, { crouch: 0.60, lean: 0.56, bodyRoll: 0.22, frontX: 22, frontY: 15, backX: -20, backY: 18, headTilt: 0.32 }],
      [0.28, {}],
    ],
  },
  life_drain: {
    startup: 0.12, active: 0.08, recovery: 0.10, windup: 0.12,
    frames: [
      [0,    { crouch: 0.08, lean: 0.10, frontX: 9, frontY: -3, backX: 3, backY: -1 }],
      [0.11, { crouch: 0.28, lean: 0.42, bodyRoll: 0.12, frontX: 29, frontY: -14, backX: 15, backY: -5, headTilt: 0.14 }],
      [0.17, { crouch: 0.62, lean: -0.48, bodyRoll: -0.28, frontX: -17, frontY: -3, backX: -26, backY: 13, headTilt: -0.22 }],
      [0.30, {}],
    ],
  },
  shadow_strike: {
    startup: 0.10, active: 0.08, recovery: 0.10, windup: 0.10,
    frames: [
      [0,    { crouch: 0.12, lean: -0.10, frontX: -2, frontY: 1, backX: -3, backY: 1 }],
      [0.09, { crouch: 0.78, lean: -0.35, bodyRoll: 0.22, frontX: -21, frontY: -10, backX: -16, backY: 12, headTilt: -0.18 }],
      [0.15, { crouch: 0.20, lean: 0.48, bodyRoll: -0.26, frontX: 36, frontY: -25, backX: -32, backY: 14, headTilt: 0.25 }],
      [0.28, {}],
    ],
  },
  fireball: {
    startup: 0.10, active: 0.08, recovery: 0.10, windup: 0.10,
    frames: [
      [0,    { crouch: 0.08, lean: -0.06, frontX: -2, frontY: 1, backX: -2, backY: 2 }],
      [0.09, { crouch: 0.46, lean: -0.42, bodyRoll: 0.18, frontX: -18, frontY: -12, backX: -24, backY: 10, headTilt: -0.20 }],
      [0.15, { crouch: 0.26, lean: 0.46, bodyRoll: -0.20, frontX: 35, frontY: -12, backX: 22, backY: 2, headTilt: 0.16 }],
      [0.28, {}],
    ],
  },
  magic_yarn: {
    startup: 0.10, active: 0.08, recovery: 0.10, windup: 0.10,
    frames: [
      [0,    { crouch: 0.08, lean: -0.08, frontX: -3, frontY: 2, backX: 0, backY: 1 }],
      [0.09, { crouch: 0.50, lean: -0.32, bodyRoll: 0.20, frontX: -20, frontY: 5, backX: -26, backY: -12, headTilt: -0.20 }],
      [0.15, { crouch: 0.20, lean: 0.40, bodyRoll: -0.26, frontX: 34, frontY: -6, backX: -26, backY: -26, headTilt: 0.18 }],
      [0.28, {}],
    ],
  },
  paw_boomerang: {
    startup: 0.10, active: 0.08, recovery: 0.10, windup: 0.10,
    frames: [
      [0,    { crouch: 0.10, lean: -0.10, frontX: -4, frontY: 1, backX: 0, backY: 2 }],
      [0.09, { crouch: 0.42, lean: -0.36, bodyRoll: -0.24, frontX: -23, frontY: -22, backX: -14, backY: 11, headTilt: -0.15 }],
      [0.15, { crouch: 0.34, lean: 0.44, bodyRoll: 0.24, frontX: 30, frontY: 14, backX: -30, backY: 8, headTilt: 0.22 }],
      [0.28, {}],
    ],
  },
  needle_barrage: {
    startup: 0.10, active: 0.08, recovery: 0.10, windup: 0.10,
    frames: [
      [0,    { crouch: 0.10, lean: -0.12, frontX: -3, frontY: 1, backX: 1, backY: 2 }],
      [0.09, { crouch: 0.42, lean: -0.34, bodyRoll: 0.20, frontX: -12, frontY: -17, backX: -24, backY: -16, headTilt: -0.18 }],
      [0.15, { crouch: 0.42, lean: 0.36, bodyRoll: -0.22, frontX: 34, frontY: -24, backX: 30, backY: 10, headTilt: 0.18 }],
      [0.28, {}],
    ],
  },
  wind_sprint: {
    startup: 0.10, active: 0.08, recovery: 0.10, windup: 0.10,
    frames: [
      [0,    { crouch: 0.10, lean: -0.10, frontX: -2, frontY: 1, backX: -2, backY: 1 }],
      [0.09, { crouch: 0.56, lean: -0.36, bodyRoll: 0.18, frontX: -13, frontY: 18, backX: -30, backY: -9, headTilt: -0.18 }],
      [0.15, { crouch: 0.38, lean: 0.52, bodyRoll: -0.20, frontX: 34, frontY: 6, backX: -33, backY: 14, headTilt: 0.22 }],
      [0.28, {}],
    ],
  },
  double_leap: {
    // A movement skill starts travelling immediately; the pose follows the leap.
    startup: 0.08, active: 0.10, recovery: 0.10, windup: 0,
    frames: [
      [0,    { crouch: 0.15, lean: 0.08, frontX: 4, frontY: 2, backX: -3, backY: 2 }],
      [0.07, { crouch: 0.48, lean: 0.36, bodyRoll: 0.14, frontX: 23, frontY: -13, backX: -18, backY: 18, headTilt: 0.16 }],
      [0.15, { crouch: 0.10, lean: 0.48, bodyRoll: -0.28, frontX: 33, frontY: -33, backX: -25, backY: 20, headTilt: -0.20 }],
      [0.28, {}],
    ],
  },
  thunder_purr: {
    startup: 0.10, active: 0.08, recovery: 0.10, windup: 0.10,
    frames: [
      [0,    { crouch: 0.12, lean: -0.10, frontX: -3, frontY: 2, backX: -2, backY: 1 }],
      [0.09, { crouch: 0.48, lean: -0.34, bodyRoll: -0.18, frontX: -22, frontY: 2, backX: -27, backY: -12, headTilt: -0.22 }],
      [0.15, { crouch: 0.20, lean: 0.36, bodyRoll: 0.18, frontX: 33, frontY: -32, backX: 8, backY: 20, headTilt: 0.22 }],
      [0.28, {}],
    ],
  },
  hairball_cannon: {
    startup: 0.10, active: 0.08, recovery: 0.10, windup: 0.10,
    frames: [
      [0,    { crouch: 0.10, lean: -0.08, frontX: -4, frontY: 1, backX: 0, backY: 2 }],
      [0.09, { crouch: 0.65, lean: -0.48, bodyRoll: 0.16, frontX: 8, frontY: 15, backX: -26, backY: 6, headTilt: -0.32 }],
      [0.15, { crouch: 0.30, lean: 0.50, bodyRoll: -0.14, frontX: 12, frontY: -22, backX: -30, backY: 17, headTilt: 0.28 }],
      [0.28, {}],
    ],
  },
  brutal_bite: {
    startup: 0.10, active: 0.08, recovery: 0.11, windup: 0.10,
    frames: [
      [0,    { crouch: 0.12, lean: -0.10, frontX: -4, frontY: 3, backX: 0, backY: 1 }],
      [0.09, { crouch: 0.64, lean: -0.45, bodyRoll: -0.16, frontX: -19, frontY: 13, backX: 3, backY: 8, headTilt: -0.28 }],
      [0.15, { crouch: 0.72, lean: 0.54, bodyRoll: 0.20, frontX: 23, frontY: 15, backX: -11, backY: -16, headTilt: 0.32 }],
      [0.29, {}],
    ],
  },
  soul_siphon: {
    startup: 0.12, active: 0.08, recovery: 0.11, windup: 0.12,
    frames: [
      [0,    { crouch: 0.08, lean: 0.10, frontX: 3, frontY: 3, backX: -4, backY: 2 }],
      [0.11, { crouch: 0.18, lean: 0.42, bodyRoll: 0.20, frontX: 30, frontY: -22, backX: -20, backY: 10, headTilt: 0.18 }],
      [0.17, { crouch: 0.50, lean: -0.42, bodyRoll: -0.24, frontX: -14, frontY: -15, backX: -30, backY: -25, headTilt: -0.24 }],
      [0.31, {}],
    ],
  },
  moonlit_trap: {
    startup: 0.10, active: 0.08, recovery: 0.10, windup: 0.10,
    frames: [
      [0,    { crouch: 0.10, lean: -0.08, frontX: -3, frontY: 2, backX: 0, backY: 1 }],
      [0.09, { crouch: 0.30, lean: -0.26, bodyRoll: 0.25, frontX: -16, frontY: -18, backX: -24, backY: 7, headTilt: -0.20 }],
      [0.15, { crouch: 0.78, lean: 0.35, bodyRoll: -0.18, frontX: 29, frontY: 23, backX: -28, backY: -11, headTilt: 0.20 }],
      [0.28, {}],
    ],
  },
  rending_ground: {
    startup: 0.12, active: 0.08, recovery: 0.10, windup: 0.12,
    frames: [
      [0,    { crouch: 0.08, lean: -0.08, frontX: -4, frontY: 1, backX: 0, backY: 2 }],
      [0.11, { crouch: 0.38, lean: -0.38, bodyRoll: -0.22, frontX: 15, frontY: -31, backX: -29, backY: -20, headTilt: -0.25 }],
      [0.17, { crouch: 0.82, lean: 0.50, bodyRoll: 0.28, frontX: 29, frontY: 20, backX: -24, backY: 18, headTilt: 0.25 }],
      [0.30, {}],
    ],
  },
  void_maw: {
    startup: 0.25, active: 0.10, recovery: 0.14,
    frames: [
      [0,    { crouch: 0.1, frontX: -3, frontY: 1, backX: 2, backY: 1 }],
      [0.24, { crouch: 0.30, lean: -0.12, frontX: 18, frontY: -20, backX: -29, backY: -20, headTilt: -0.15 }],
      [0.30, { crouch: 0.28, lean: -0.08, bodyRoll: -0.10, frontX: 22, frontY: -14, backX: -34, backY: -13, headTilt: 0.12 }],
      [0.49, {}],
    ],
  },
};

export function actionDuration(spec) { return spec.startup + spec.active + spec.recovery; }

export function skillActionPose(action) {
  const spec = action && SKILL_ACTIONS[action.id];
  if (!spec) return null;
  const frames = spec.frames;
  const time = Math.max(0, action.elapsed);
  let i = 0;
  while (i < frames.length - 2 && time > frames[i + 1][0]) i++;
  const [fromTime, from] = frames[i];
  const [toTime, to] = frames[i + 1];
  const x = Math.max(0, Math.min(1, (time - fromTime) / (toTime - fromTime)));
  const ease = x * x * (3 - 2 * x);
  const pose = {};
  for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
    pose[key] = (from[key] || 0) * (1 - ease) + (to[key] || 0) * ease;
  }
  return pose;
}
