/** Shared getUserMedia constraints — echo/noise off for proximity voice/video. */

export const NEAR_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

export const NEAR_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: "user",
};

export function nearMediaStreamConstraints(input: {
  audio?: boolean;
  video?: boolean | MediaTrackConstraints;
}): MediaStreamConstraints {
  return {
    audio: input.audio === false ? false : NEAR_AUDIO_CONSTRAINTS,
    video:
      input.video === false || input.video === undefined
        ? false
        : typeof input.video === "object"
          ? { ...NEAR_VIDEO_CONSTRAINTS, ...input.video }
          : NEAR_VIDEO_CONSTRAINTS,
  };
}
