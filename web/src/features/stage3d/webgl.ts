let webgl: boolean | undefined

/** True if this browser can create a WebGL context. Checked once; no three.js import. */
export function hasWebGL() {
  webgl ??= !!document.createElement('canvas').getContext('webgl2') || !!document.createElement('canvas').getContext('webgl')
  return webgl
}
