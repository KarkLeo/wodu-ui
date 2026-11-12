import { createSceneAudio, type SceneAudio } from './SceneAudio'
import { webAudioDeps } from './webAudioTrack'

let instance: SceneAudio | null = null

/** The one scene audio service of the app, made on first use (Web Audio is touched only then). */
export function sceneAudio(): SceneAudio {
  instance ??= createSceneAudio(webAudioDeps())
  return instance
}
