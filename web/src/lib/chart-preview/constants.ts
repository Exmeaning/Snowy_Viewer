export const stageConstants = {
  stageLaneTop: 47,
  stageLaneHeight: 850,
  stageLaneWidth: 1420,
  stageNumLanes: 12,
  stageTexWidth: 2048,
  stageTexHeight: 1176,
  stageTargetWidth: 1920,
  stageTargetHeight: 1080,
  stageZoom: 927 / 800,
  backgroundSize: 2462.25,
} as const

export const stageAspectRatio = stageConstants.stageTargetWidth / stageConstants.stageTargetHeight
export const stageWidthRatio =
  (stageConstants.stageZoom * stageConstants.stageLaneWidth) /
  (stageConstants.stageTexHeight * stageAspectRatio) /
  stageConstants.stageNumLanes
export const stageHeightRatio =
  (stageConstants.stageZoom * stageConstants.stageLaneHeight) / stageConstants.stageTexHeight
export const stageTopRatio =
  0.5 + (stageConstants.stageZoom * stageConstants.stageLaneTop) / stageConstants.stageTexHeight

export const worldStageWidth =
  (stageConstants.stageTexWidth / stageConstants.stageLaneWidth) * stageConstants.stageNumLanes
export const worldStageLeft = -worldStageWidth / 2
export const worldStageTop = stageConstants.stageLaneTop / stageConstants.stageLaneHeight
export const worldStageHeight = stageConstants.stageTexHeight / stageConstants.stageLaneHeight

export const worldBackgroundWidth =
  stageConstants.backgroundSize / (stageConstants.stageTargetWidth * stageWidthRatio)
export const worldBackgroundHeight =
  stageConstants.backgroundSize / (stageConstants.stageTargetHeight * stageHeightRatio)
export const worldBackgroundLeft = -worldBackgroundWidth / 2
export const worldBackgroundTop =
  0.5 / stageHeightRatio + stageConstants.stageLaneTop / stageConstants.stageLaneHeight - worldBackgroundHeight / 2

export function fillRect(
  targetWidth: number,
  targetHeight: number,
  sourceAspectRatio: number,
) {
  const targetAspectRatio = targetWidth / targetHeight
  const width =
    targetAspectRatio < sourceAspectRatio ? sourceAspectRatio * targetHeight : targetWidth
  const height =
    targetAspectRatio > sourceAspectRatio ? targetWidth / sourceAspectRatio : targetHeight

  return { width, height }
}
