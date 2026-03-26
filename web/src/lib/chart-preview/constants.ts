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

export function createOffCenterOrthographicProjection(
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number,
) {
  const near = 0.001
  const far = 100

  return new Float32Array([
    2 / (xmax - xmin),
    0,
    0,
    0,
    0,
    2 / (ymax - ymin),
    0,
    0,
    0,
    0,
    -2 / (far - near),
    0,
    -(xmax + xmin) / (xmax - xmin),
    -(ymax + ymin) / (ymax - ymin),
    -(far + near) / (far - near),
    1,
  ])
}

export function getProjectionForCanvas(canvasWidth: number, canvasHeight: number) {
  const { width, height } = fillRect(
    stageConstants.stageTargetWidth,
    stageConstants.stageTargetHeight,
    canvasWidth / canvasHeight,
  )
  const scaledWidth = stageConstants.stageTargetWidth * stageWidthRatio
  const scaledHeight = stageConstants.stageTargetHeight * stageHeightRatio
  const screenTop = stageConstants.stageTargetHeight * stageTopRatio
  const xmin = -width / 2
  const xmax = width / 2
  const ymin = height / 2
  const ymax = -height / 2
  const projection = createOffCenterOrthographicProjection(xmin, xmax, ymin, ymax)

  projection[0] *= scaledWidth
  projection[5] *= scaledHeight
  projection[12] -= 0
  projection[13] += (screenTop * 2 * scaledHeight) / (ymax - ymin)
  return projection
}
