// Authored body poses for the first four committed skills. Times are seconds
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
