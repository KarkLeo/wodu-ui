import { describe, it, expect } from 'vitest'
import {
  emptyStage, withScene, withoutScene, checkStage, checkSceneData, checkSceneDraft,
  checkUpload, neutralFileName, fileUrl, playbackTarget, MEDIA_LIMITS, IMAGE_TYPES, AUDIO_TYPES,
  withSound, withoutSound, checkSoundData, checkSoundDraft, shouldPlayOverlay, nextOverlayMemory, endOverlay, shouldPlayKey, playedToTheEnd, formatDuration, overlayKey,
  oneShotClearDelay, SOUND_NAME_MAX,
  withImage, withoutImage, withImageEdited, checkImageData, checkImageDraft, revealKey, shouldReveal, CAPTION_MAX,
  STALE_ONE_SHOT_SECONDS, ONE_SHOT_CLEAR_GRACE_SECONDS, ONE_SHOT_UNKNOWN_CLEAR_SECONDS,
  ONE_SHOT_CLEAR_MIN_TAIL_SECONDS, oneShotOverDelay, nextSoundArrival,
} from './stage'
import { ONE_SHOT_READY_FALLBACK_SECONDS, READY_FALLBACK_SECONDS } from '@/services/webAudioTrack'
import type { Scene, Stage, StageImage, StageSound, TableImage } from '@/types/stage'

const tavern: Scene = { id: 'scene-tavern-0001', name: 'Tavern', image: 'image_ab12.webp', sound: 'sound_cd34.mp3' }
const shown: StageImage = {
  id: 'i1',
  file: { collection: 'images', record: 'image-record-0001', name: 'map.png' },
  caption: 'A map',
  shownAt: '2026-11-12T10:00:00.000Z',
}
const playing: StageSound = {
  id: 'k1',
  file: { collection: 'sounds', record: 'sound-record-0001', name: 'rain.mp3' },
  loop: true,
  startedAt: '2026-11-12T10:00:00.000Z',
}

describe('constants', () => {
  it('pins the limits and type lists', () => {
    expect(MEDIA_LIMITS).toEqual({ scenes: 20, sounds: 15, images: 30 })
    expect(IMAGE_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp'])
    expect(AUDIO_TYPES).toEqual(['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac'])
  })
})

describe('withScene', () => {
  it('points at the scene files and keeps the rest', () => {
    const before = { ...emptyStage('g1'), image: shown, sound: playing }
    const next = withScene(before, tavern)
    expect(next.scene).toEqual({
      id: 'scene-tavern-0001',
      image: { collection: 'scenes', record: 'scene-tavern-0001', name: 'image_ab12.webp' },
      sound: { collection: 'scenes', record: 'scene-tavern-0001', name: 'sound_cd34.mp3' },
    })
    expect(next.image).toBe(before.image)
    expect(next.sound).toBe(before.sound)
    expect(before.scene).toBeNull()
  })
  it('keeps null for a missing file', () => {
    expect(withScene(emptyStage('g1'), { ...tavern, sound: null }).scene?.sound).toBeNull()
  })
  it('never carries the scene name into the stage', () => {
    expect(JSON.stringify(withScene(emptyStage('g1'), tavern))).not.toContain('Tavern')
  })
})

describe('withoutScene', () => {
  it('clears only the scene', () => {
    const before = withScene({ ...emptyStage('g1'), image: shown, sound: playing }, tavern)
    const next = withoutScene(before)
    expect(next.scene).toBeNull()
    expect(next.image).toBe(before.image)
    expect(next.sound).toBe(before.sound)
    expect(next.id).toBe('g1')
    expect(before.scene).not.toBeNull()
  })
})

describe('checkStage', () => {
  it('accepts what withScene produced', () => {
    const stage = withScene({ ...emptyStage('g1'), image: shown, sound: playing }, tavern)
    expect(checkStage(JSON.parse(JSON.stringify(stage)), 'g1')).toEqual(stage)
  })
  it('rejects another game id, a missing id and a non-object', () => {
    expect(checkStage(emptyStage('g2'), 'g1')).toBeNull()
    expect(checkStage({ scene: null, image: null, sound: null }, 'g1')).toBeNull()
    expect(checkStage(null, 'g1')).toBeNull()
    expect(checkStage('stage', 'g1')).toBeNull()
    expect(checkStage([], 'g1')).toBeNull()
  })
  it('turns a FileRef with an unknown collection or an empty name into a null part', () => {
    const scene = withScene(emptyStage('g1'), tavern).scene
    const badCollection = { id: 'g1', scene: { ...scene, image: { collection: 'users', record: 's1', name: 'a.png' } }, image: null, sound: null }
    expect(checkStage(badCollection, 'g1')?.scene).toBeNull()
    const emptyName = { id: 'g1', scene: { ...scene, sound: { collection: 'scenes', record: 's1', name: '' } }, image: null, sound: null }
    expect(checkStage(emptyName, 'g1')?.scene).toBeNull()
  })
  it('turns a FileRef whose record or name could climb out of its path into a null part', () => {
    const scene = withScene(emptyStage('g1'), tavern).scene!
    const partWith = (image: unknown) => checkStage({ id: 'g1', scene: { ...scene, image }, image: null, sound: null }, 'g1')?.scene
    const good = { collection: 'scenes', record: 'scene-tavern-0001', name: 'image_ab12.webp' }
    expect(partWith(good)).not.toBeNull()
    expect(partWith({ ...good, record: 'short' })).toBeNull()
    expect(partWith({ ...good, record: 'x'.repeat(37) })).toBeNull()
    expect(partWith({ ...good, record: '../scenes/other-record-0001' })).toBeNull()
    expect(partWith({ ...good, record: 'scene tavern 0001' })).toBeNull()
    for (const name of ['a/b.png', 'a\\b.png', 'a?x=1.png', 'a#b.png', '..', 'a..b.png']) {
      expect(partWith({ ...good, name }), name).toBeNull()
    }
  })
  it('a bad part becomes null and the rest survives', () => {
    const scene = withScene(emptyStage('g1'), tavern).scene
    const out = checkStage({ id: 'g1', scene, image: { id: 'i1' }, sound: playing }, 'g1')
    expect(out).toEqual({ id: 'g1', scene, image: null, sound: playing })
    expect(checkStage({ id: 'g1', scene: 5, image: shown, sound: { ...playing, loop: 'yes' } }, 'g1'))
      .toEqual({ id: 'g1', scene: null, image: shown, sound: null })
  })
})

describe('checkSceneData', () => {
  it('trims the name', () => {
    expect(checkSceneData({ id: 's1', name: '  Tavern ' })).toEqual({ id: 's1', name: 'Tavern' })
  })
  it('refuses a name that is empty after trimming', () => {
    expect(checkSceneData({ id: 's1', name: '' })).toBeNull()
    expect(checkSceneData({ id: 's1', name: '   ' })).toBeNull()
  })
  it('refuses an empty id, a name over 80 or a non-string', () => {
    expect(checkSceneData({ id: '', name: 'x' })).toBeNull()
    expect(checkSceneData({ id: 's1', name: 'x'.repeat(81) })).toBeNull()
    expect(checkSceneData({ id: 's1', name: 'x'.repeat(80) })).not.toBeNull()
    expect(checkSceneData({ id: 's1', name: 5 })).toBeNull()
    expect(checkSceneData({ id: 7, name: 'x' })).toBeNull()
    expect(checkSceneData(null)).toBeNull()
  })
})

describe('checkSceneDraft', () => {
  it('reports problems', () => {
    expect(checkSceneDraft({ name: '  ', hasImage: true, hasSound: false })).toEqual(['nameRequired'])
    expect(checkSceneDraft({ name: 'x'.repeat(81), hasImage: true, hasSound: false })).toEqual(['nameTooLong'])
    expect(checkSceneDraft({ name: 'Rain', hasImage: false, hasSound: false })).toEqual(['noFiles'])
    expect(checkSceneDraft({ name: 'Rain', hasImage: false, hasSound: true })).toEqual([])
  })
})

describe('checkUpload', () => {
  it('checks type and size', () => {
    expect(checkUpload('image', { type: 'image/webp', size: 2097152 })).toBe('ok')
    expect(checkUpload('image', { type: 'image/webp', size: 2097153 })).toBe('size')
    expect(checkUpload('image', { type: 'image/gif', size: 10 })).toBe('type')
    expect(checkUpload('audio', { type: 'audio/mpeg', size: 20971520 })).toBe('ok')
    expect(checkUpload('audio', { type: 'audio/ogg', size: 10 })).toBe('type')
  })
})

describe('neutralFileName', () => {
  it('maps types to neutral names', () => {
    expect(neutralFileName('image', 'image/jpeg')).toBe('image.jpg')
    expect(neutralFileName('image', 'image/png')).toBe('image.png')
    expect(neutralFileName('image', 'image/webp')).toBe('image.webp')
    expect(neutralFileName('audio', 'audio/x-m4a')).toBe('sound.m4a')
    expect(neutralFileName('audio', 'audio/mp4')).toBe('sound.m4a')
    expect(neutralFileName('audio', 'audio/mpeg')).toBe('sound.mp3')
    expect(neutralFileName('audio', 'audio/aac')).toBe('sound.aac')
  })
  it('throws for a type outside the lists', () => {
    expect(() => neutralFileName('image', 'image/gif')).toThrow()
    expect(() => neutralFileName('audio', 'image/png')).toThrow()
  })
})

describe('fileUrl', () => {
  it('builds the file address', () => {
    const ref = { collection: 'scenes', record: 's1', name: 'image_ab 12.webp' } as const
    expect(fileUrl('https://api.test', ref)).toBe('https://api.test/api/files/scenes/s1/image_ab%2012.webp')
    expect(fileUrl('https://api.test', { ...ref, record: 'a b/c' })).toBe('https://api.test/api/files/scenes/a%20b%2Fc/image_ab%2012.webp')
    expect(fileUrl('https://api.test/', ref, '176x112')).toBe('https://api.test/api/files/scenes/s1/image_ab%2012.webp?thumb=176x112')
  })
})

describe('playbackTarget', () => {
  const base = 'https://api.test'
  const onTavern = withScene(emptyStage('g1'), tavern)
  const all = { sound: 'on', background: true } as const

  it('builds the scene sound and backdrop URLs', () => {
    expect(playbackTarget(onTavern, all, base)).toEqual({
      sceneSound: 'https://api.test/api/files/scenes/scene-tavern-0001/sound_cd34.mp3',
      backdrop: 'https://api.test/api/files/scenes/scene-tavern-0001/image_ab12.webp',
      wantsSound: true,
      overlay: null,
    })
  })

  it('gives no sound URL unless sound is on, but still wants sound', () => {
    for (const sound of ['unset', 'off'] as const) {
      const target = playbackTarget(onTavern, { sound, background: true }, base)
      expect(target.sceneSound).toBeNull()
      expect(target.wantsSound).toBe(true)
      expect(target.backdrop).not.toBeNull()
    }
  })

  it('gives no backdrop with the background off, and sound is unaffected', () => {
    const target = playbackTarget(onTavern, { sound: 'on', background: false }, base)
    expect(target.backdrop).toBeNull()
    expect(target.sceneSound).not.toBeNull()
  })

  it('has nothing for a scene without a sound or an image', () => {
    const rain = withScene(emptyStage('g1'), { ...tavern, image: null })
    expect(playbackTarget(rain, all, base).backdrop).toBeNull()
    const quiet = withScene(emptyStage('g1'), { ...tavern, sound: null })
    expect(playbackTarget(quiet, all, base)).toMatchObject({ sceneSound: null, wantsSound: false })
  })

  it('has nothing for no stage, whatever the prefs', () => {
    expect(playbackTarget(null, all, base)).toEqual({ sceneSound: null, backdrop: null, wantsSound: false, overlay: null })
  })

  it('wants sound when only an overlay sound plays', () => {
    const stage = { ...emptyStage('g1'), sound: playing }
    expect(playbackTarget(stage, { sound: 'unset', background: true }, base))
      .toEqual({ sceneSound: null, backdrop: null, wantsSound: true, overlay: null })
  })

  it('wants no sound for an empty stage', () => {
    expect(playbackTarget(emptyStage('g1'), all, base).wantsSound).toBe(false)
  })

  describe('overlay', () => {
    const oneShot: StageSound = { ...playing, loop: false }
    const withOverlay = (sound: StageSound) => ({ ...emptyStage('g1'), sound })
    const url = 'https://api.test/api/files/sounds/sound-record-0001/rain.mp3'

    it('hands over the stage\'s sound with sound on, keyed by id and start; the memory decides whether it plays', () => {
      expect(playbackTarget(withOverlay(playing), all, base).overlay).toEqual({ key: overlayKey(playing), src: url, loop: true })
      expect(playbackTarget(withOverlay(oneShot), all, base).overlay).toEqual({ key: overlayKey(oneShot), src: url, loop: false })
    })

    it('is null with sound off or unset', () => {
      for (const sound of ['unset', 'off'] as const) {
        const target = playbackTarget(withOverlay(playing), { sound, background: true }, base)
        expect(target.overlay).toBeNull()
        expect(target.wantsSound).toBe(true)
      }
    })

    it('is null without a sound on the stage', () => {
      expect(playbackTarget(onTavern, all, base).overlay).toBeNull()
    })
  })
})

describe('withSound', () => {
  const stage = { ...withScene(emptyStage('g1'), tavern), image: shown }
  it('points at the sound file, copies loop, stamps startedAt and keeps scene and image', () => {
    const next = withSound(stage, { id: 'x1', name: 'Brawl', loop: true, duration: 160, file: 'sound_ab.mp3' }, '2026-11-12T10:00:00.000Z')
    expect(next.sound).toEqual({
      id: 'x1',
      file: { collection: 'sounds', record: 'x1', name: 'sound_ab.mp3' },
      loop: true,
      startedAt: '2026-11-12T10:00:00.000Z',
    })
    expect(JSON.stringify(next)).not.toContain('Brawl')
    expect(next.scene).toBe(stage.scene)
    expect(next.image).toBe(stage.image)
  })
  it('withoutSound clears only the sound', () => {
    const next = withoutSound({ ...stage, sound: playing })
    expect(next.sound).toBeNull()
    expect(next.scene).toBe(stage.scene)
    expect(next.image).toBe(stage.image)
  })
})

describe('shouldPlayOverlay', () => {
  const at = (s: string) => new Date(s)
  const oneShot = { ...playing, loop: false, startedAt: '2026-11-12T10:00:00.000Z' }
  it('plays loops always, one-shots only while fresh', () => {
    expect(STALE_ONE_SHOT_SECONDS).toBe(5)
    expect(shouldPlayOverlay({ ...oneShot, loop: true }, at('2026-11-12T11:00:00Z'))).toBe(true)
    expect(shouldPlayOverlay(oneShot, at('2026-11-12T10:00:05Z'))).toBe(true)
    expect(shouldPlayOverlay(oneShot, at('2026-11-12T10:00:06Z'))).toBe(false)
  })
  it('plays a one-shot whose startedAt is in the future', () => {
    expect(shouldPlayOverlay(oneShot, at('2026-11-12T09:00:00Z'))).toBe(true)
  })
  it('does not play a one-shot whose startedAt does not parse, unless it loops', () => {
    const broken = { ...oneShot, startedAt: 'yesterday-ish' }
    expect(shouldPlayOverlay(broken, at('2026-11-12T10:00:00Z'))).toBe(false)
    expect(shouldPlayOverlay({ ...broken, loop: true }, at('2026-11-12T10:00:00Z'))).toBe(true)
  })
})

describe('oneShotClearDelay', () => {
  const oneShot = { ...playing, loop: false, startedAt: '2026-11-12T10:00:00.000Z' }
  const at = (s: string) => new Date(s)
  it('names its constants', () => {
    expect(ONE_SHOT_CLEAR_GRACE_SECONDS).toBe(15)
    expect(ONE_SHOT_CLEAR_MIN_TAIL_SECONDS).toBe(30)
    expect(ONE_SHOT_UNKNOWN_CLEAR_SECONDS).toBe(3600)
  })
  it('gives a device that starts late its whole cue: the grace outlasts both ready fallbacks with room to spare', () => {
    expect(ONE_SHOT_CLEAR_GRACE_SECONDS - (READY_FALLBACK_SECONDS + ONE_SHOT_READY_FALLBACK_SECONDS)).toBeGreaterThanOrEqual(5)
  })
  it('is null for a loop, whoever plays it', () => {
    expect(oneShotClearDelay(playing, 30, at('2026-11-12T10:00:00Z'), false)).toBeNull()
    expect(oneShotClearDelay(playing, 30, at('2026-11-12T10:00:00Z'), true)).toBeNull()
  })
  it('with a known duration counts duration plus the larger of 30 s and half of it, playing here (a backstop) or not', () => {
    for (const playingHere of [false, true]) {
      expect(oneShotClearDelay(oneShot, 30, at('2026-11-12T10:00:10Z'), playingHere)).toBe(50000)
      expect(oneShotClearDelay(oneShot, 100, at('2026-11-12T10:00:00Z'), playingHere)).toBe(150000)
      expect(oneShotClearDelay(oneShot, 0, at('2026-11-12T10:00:00Z'), playingHere)).toBe(30000)
      expect(oneShotClearDelay(oneShot, 30, at('2026-11-12T10:05:00Z'), playingHere)).toBe(0)
    }
  })
  it('with an unknown duration has no backstop while playing here, and waits an hour otherwise', () => {
    expect(oneShotClearDelay(oneShot, null, at('2026-11-12T10:00:09Z'), true)).toBeNull()
    expect(oneShotClearDelay(oneShot, null, at('2026-11-12T10:00:09Z'), false)).toBe(3591000)
    expect(oneShotClearDelay(oneShot, null, at('2026-11-12T11:00:01Z'), false)).toBe(0)
  })
  it('is 0, not NaN, for a startedAt that does not parse', () => {
    expect(oneShotClearDelay({ ...oneShot, startedAt: 'yesterday-ish' }, 30, at('2026-11-12T10:00:00Z'), false)).toBe(0)
    expect(oneShotClearDelay({ ...oneShot, startedAt: 'yesterday-ish' }, 30, at('2026-11-12T10:00:00Z'), true)).toBe(0)
    expect(oneShotClearDelay({ ...oneShot, startedAt: 'yesterday-ish' }, null, at('2026-11-12T10:00:00Z'), false)).toBe(0)
  })
  it('counts the whole duration for a startedAt in the future', () => {
    expect(oneShotClearDelay(oneShot, 30, at('2026-11-12T09:59:50Z'), false)).toBe(70000)
  })
})

describe('oneShotOverDelay', () => {
  const oneShot = { ...playing, loop: false, startedAt: '2026-11-12T10:00:00.000Z' }
  const at = (s: string) => new Date(s)
  it('is the time left until startedAt plus the duration, never below zero', () => {
    expect(oneShotOverDelay(oneShot, 30, at('2026-11-12T10:00:10Z'))).toBe(20000)
    expect(oneShotOverDelay(oneShot, 30, at('2026-11-12T10:01:00Z'))).toBe(0)
    expect(oneShotOverDelay(oneShot, 30, at('2026-11-12T09:59:50Z'))).toBe(40000)
  })
  it('is null for a loop or an unknown duration: never over by the clock', () => {
    expect(oneShotOverDelay(playing, 30, at('2026-11-12T12:00:00Z'))).toBeNull()
    expect(oneShotOverDelay(oneShot, null, at('2026-11-12T12:00:00Z'))).toBeNull()
  })
  it('is 0 for a startedAt that does not parse', () => {
    expect(oneShotOverDelay({ ...oneShot, startedAt: 'yesterday-ish' }, 30, at('2026-11-12T10:00:00Z'))).toBe(0)
  })
})

describe('nextSoundArrival', () => {
  const oneShot = { ...playing, loop: false }
  const other = { ...oneShot, startedAt: '2026-11-12T10:00:07.000Z' }
  const withSoundSlot = (sound: StageSound | null) => ({ ...emptyStage('g1'), sound })
  const first = { source: 'live' as const, at: 1000 }
  it('records the first value of a game', () => {
    expect(nextSoundArrival(undefined, withSoundSlot(oneShot), undefined, 'load', 5)).toEqual({ source: 'load', at: 5 })
  })
  it('does not move when the sound slot keeps its key, whatever else changed', () => {
    const before = withSoundSlot(oneShot)
    const sceneOn = withScene(before, tavern)
    expect(nextSoundArrival(before, sceneOn, first, 'live', 60000)).toBe(first)
    expect(nextSoundArrival(sceneOn, { ...sceneOn, image: shown }, first, 'load', 90000)).toBe(first)
  })
  it('moves when the sound slot gets another key, or goes or comes back', () => {
    const before = withSoundSlot(oneShot)
    expect(nextSoundArrival(before, withSoundSlot(other), first, 'live', 7000)).toEqual({ source: 'live', at: 7000 })
    expect(nextSoundArrival(before, withSoundSlot(null), first, 'live', 8000)).toEqual({ source: 'live', at: 8000 })
    expect(nextSoundArrival(withSoundSlot(null), before, first, 'load', 9000)).toEqual({ source: 'load', at: 9000 })
  })
})

describe('formatDuration', () => {
  it('formats whole seconds as m:ss and null as a dash', () => {
    expect([252, 6, 0, 3600, null].map(formatDuration)).toEqual(['4:12', '0:06', '0:00', '60:00', '—'])
    expect(formatDuration(6.9)).toBe('0:06')
  })
})

describe('checkSoundData', () => {
  it('keeps a valid sound and defaults a missing or null duration to null', () => {
    expect(checkSoundData({ id: 's1', name: ' Brawl ', loop: true, duration: 12.5 }))
      .toEqual({ id: 's1', name: 'Brawl', loop: true, duration: 12.5 })
    expect(checkSoundData({ id: 's1', name: 'a', loop: false })).toEqual({ id: 's1', name: 'a', loop: false, duration: null })
    expect(checkSoundData({ id: 's1', name: 'a', loop: false, duration: null })?.duration).toBeNull()
    expect(checkSoundData({ id: 's1', name: 'a', loop: false, duration: 0 })?.duration).toBe(0)
  })
  it('refuses a bad id, a non-boolean loop, a bad duration and a bad name', () => {
    const ok = { id: 's1', name: 'a', loop: false, duration: 1 }
    expect(checkSoundData(null)).toBeNull()
    expect(checkSoundData({ ...ok, id: '' })).toBeNull()
    expect(checkSoundData({ ...ok, loop: 'yes' })).toBeNull()
    expect(checkSoundData({ ...ok, loop: undefined })).toBeNull()
    for (const duration of [-1, Infinity, NaN, '3']) expect(checkSoundData({ ...ok, duration })).toBeNull()
    expect(checkSoundData({ ...ok, name: '   ' })).toBeNull()
    expect(checkSoundData({ ...ok, name: 'x'.repeat(SOUND_NAME_MAX + 1) })).toBeNull()
    expect(checkSoundData({ ...ok, name: 'x'.repeat(SOUND_NAME_MAX) })).not.toBeNull()
  })
})

describe('checkSoundDraft', () => {
  it('reports each problem and is empty when clean', () => {
    expect(checkSoundDraft({ name: '  ', hasFile: true })).toEqual(['nameRequired'])
    expect(checkSoundDraft({ name: 'x'.repeat(81), hasFile: true })).toEqual(['nameTooLong'])
    expect(checkSoundDraft({ name: 'Brawl', hasFile: false })).toEqual(['noFile'])
    expect(checkSoundDraft({ name: '', hasFile: false })).toEqual(['nameRequired', 'noFile'])
    expect(checkSoundDraft({ name: 'Brawl', hasFile: true })).toEqual([])
  })
})

describe('overlayKey', () => {
  it('differs for the same sound started twice', () => {
    expect(overlayKey(playing)).toBe('k1:2026-11-12T10:00:00.000Z')
    expect(overlayKey(playing)).not.toBe(overlayKey({ ...playing, startedAt: '2026-11-12T10:05:00.000Z' }))
  })
})

describe('overlay memory', () => {
  const oneShot = { ...playing, loop: false, startedAt: '2026-11-12T10:00:00.000Z' }
  const loop = { ...playing, id: 'looper', loop: true, startedAt: '2026-11-12T10:00:00.000Z' }
  const ms = (s: string) => new Date(s).getTime()
  const T0 = ms('2026-11-12T10:00:00.000Z')
  const live = { source: 'live' as const, at: T0 }
  const found = { source: 'load' as const, at: T0 }
  const empty = {}

  it('changes nothing when there is no overlay', () => {
    expect(nextOverlayMemory(empty, null, live, true, T0)).toBe(empty)
  })
  it('live and sound on at arrival: plays; sound turned on 2 s later: plays', () => {
    expect(shouldPlayKey(nextOverlayMemory(empty, oneShot, live, true, T0), oneShot)).toBe(true)
    const waiting = nextOverlayMemory(empty, oneShot, live, false, T0)
    expect(shouldPlayKey(waiting, oneShot)).toBe(false)
    expect(waiting[overlayKey(oneShot)]!.play).toBeNull()
    expect(shouldPlayKey(nextOverlayMemory(waiting, oneShot, live, true, T0 + 2000), oneShot)).toBe(true)
  })
  it('sound turned on 60 s after first sight: a one-shot is skipped, a loop plays', () => {
    const waiting = nextOverlayMemory(empty, oneShot, live, false, T0)
    expect(shouldPlayKey(nextOverlayMemory(waiting, oneShot, live, true, T0 + 60000), oneShot)).toBe(false)
    const loopWaiting = nextOverlayMemory(empty, loop, live, false, T0)
    expect(shouldPlayKey(nextOverlayMemory(loopWaiting, loop, live, true, T0 + 60000), loop)).toBe(true)
  })
  it('found on load follows the startedAt rule when it is decided; a loop found plays', () => {
    expect(shouldPlayKey(nextOverlayMemory(empty, oneShot, found, true, T0 + 3000), oneShot)).toBe(true)
    expect(shouldPlayKey(nextOverlayMemory(empty, oneShot, found, true, T0 + 30000), oneShot)).toBe(false)
    expect(shouldPlayKey(nextOverlayMemory(empty, loop, found, true, T0 + 3600000), loop)).toBe(true)
  })
  it('a loop met again with the same key (a reconnect snapshot) keeps its record, so it is not restarted or re-decided', () => {
    const playingNow = nextOverlayMemory(empty, loop, live, true, T0)
    expect(nextOverlayMemory(playingNow, loop, found, true, T0 + 90000)).toBe(playingNow)
  })
  it('a replay with a new startedAt is a new key and plays', () => {
    const first = nextOverlayMemory(empty, oneShot, live, true, T0)
    const replay = { ...oneShot, startedAt: '2026-11-12T10:02:00.000Z' }
    const next = nextOverlayMemory(first, replay, { source: 'live', at: T0 + 120000 }, true, T0 + 120000)
    expect(shouldPlayKey(next, replay)).toBe(true)
  })

  // A failed write rolls the stage back: the same key returns as a live value with a later time.
  it('a skipped one-shot that goes to null and comes back live and later is still not played', () => {
    const skipped = nextOverlayMemory(empty, oneShot, found, true, T0 + 600000)
    expect(shouldPlayKey(skipped, oneShot)).toBe(false)
    const cleared = nextOverlayMemory(skipped, null, live, true, T0 + 600001)
    const back = nextOverlayMemory(cleared, oneShot, { source: 'live', at: T0 + 600002 }, true, T0 + 600002)
    expect(shouldPlayKey(back, oneShot)).toBe(false)
  })
  it('a one-shot that could not be played yet, rolled back as live, does not become fresh', () => {
    const waiting = nextOverlayMemory(empty, oneShot, found, false, T0 + 600000)
    const back = nextOverlayMemory(waiting, oneShot, { source: 'live', at: T0 + 700000 }, true, T0 + 700000)
    expect(shouldPlayKey(back, oneShot)).toBe(false)
  })
  it('a previous one-shot restored by a rollback is not restarted once it ended or was replaced', () => {
    const other = { ...oneShot, id: 'other' }
    let memory = nextOverlayMemory(empty, oneShot, live, true, T0)
    memory = endOverlay(memory, overlayKey(oneShot))
    memory = nextOverlayMemory(memory, other, live, true, T0 + 1000)
    memory = nextOverlayMemory(memory, oneShot, { source: 'live', at: T0 + 2000 }, true, T0 + 2000)
    expect(shouldPlayKey(memory, oneShot)).toBe(false)
  })
  it('a previous loop restored by a rollback still sounds, even after being replaced meanwhile', () => {
    const other = { ...loop, id: 'other' }
    let memory = nextOverlayMemory(empty, loop, live, true, T0)
    memory = endOverlay(memory, overlayKey(loop))
    memory = nextOverlayMemory(memory, other, live, true, T0 + 1000)
    memory = nextOverlayMemory(memory, loop, { source: 'live', at: T0 + 2000 }, true, T0 + 2000)
    expect(shouldPlayKey(memory, loop)).toBe(true)
  })

  // The store's latest time and source must not be read later than the key's first sight.
  it('a found stale one-shot seen while sound was off stays found when a live change follows and sound is turned on', () => {
    let memory = nextOverlayMemory(empty, oneShot, { source: 'load', at: T0 }, false, T0 + 600000)
    memory = nextOverlayMemory(memory, oneShot, { source: 'live', at: T0 + 610000 }, false, T0 + 610000)
    memory = nextOverlayMemory(memory, oneShot, { source: 'live', at: T0 + 620000 }, true, T0 + 620000)
    expect(shouldPlayKey(memory, oneShot)).toBe(false)
  })
  it('a live one-shot seen at T0 is not refreshed by a change 30 s later, so sound on at 31 s skips it', () => {
    let memory = nextOverlayMemory(empty, oneShot, live, false, T0)
    memory = nextOverlayMemory(memory, oneShot, { source: 'live', at: T0 + 30000 }, false, T0 + 30000)
    memory = nextOverlayMemory(memory, oneShot, { source: 'live', at: T0 + 30000 }, true, T0 + 31000)
    expect(shouldPlayKey(memory, oneShot)).toBe(false)
  })

  it('a one-shot is retired when it ends or is replaced; a loop only when it ends by itself (never)', () => {
    const memory = nextOverlayMemory(nextOverlayMemory(empty, oneShot, live, true, T0), loop, live, true, T0)
    expect(shouldPlayKey(endOverlay(memory, overlayKey(oneShot)), oneShot)).toBe(false)
    expect(endOverlay(memory, overlayKey(loop))).toBe(memory)
    expect(endOverlay(memory, 'unknown')).toBe(memory)
  })
  it('knows a track that played to its end', () => {
    const memory = endOverlay(nextOverlayMemory(empty, oneShot, live, true, T0), overlayKey(oneShot), true)
    expect(playedToTheEnd(memory, overlayKey(oneShot))).toBe(true)
    expect(playedToTheEnd(nextOverlayMemory(empty, oneShot, live, true, T0), overlayKey(oneShot))).toBe(false)
  })
})

const T = '2026-11-12T11:00:00.000Z'
const grum: TableImage = { id: 'i1', caption: 'Old Grum, the innkeeper', file: 'image_ab.webp' }
const stageWithSceneAndSound = () => withSound(withScene(emptyStage('g1'), tavern), { id: 'sound-record-0001', name: 'Rain', loop: true, duration: null, file: 'rain.mp3' }, T)

describe('withImage', () => {
  it('with the caption', () => {
    expect(withImage(emptyStage('g1'), grum, true, T).image).toEqual({
      id: 'i1', file: { collection: 'images', record: 'i1', name: 'image_ab.webp' }, caption: 'Old Grum, the innkeeper', shownAt: T,
    })
  })
  it('without the caption carries no caption text at all', () => {
    const next = withImage(emptyStage('g1'), grum, false, T)
    expect(next.image?.caption).toBeNull()
    expect(JSON.stringify(next)).not.toContain('Grum')
  })
  it('an image with no caption shows none even when asked to', () => {
    expect(withImage(emptyStage('g1'), { ...grum, caption: null }, true, T).image?.caption).toBeNull()
  })
  it('keeps scene and sound; withoutImage clears only the image', () => {
    const before = stageWithSceneAndSound()
    const next = withImage(before, grum, true, T)
    expect(next.scene).toBe(before.scene)
    expect(next.sound).toBe(before.sound)
    const cleared = withoutImage(next)
    expect(cleared.image).toBeNull()
    expect(cleared.scene).toBe(before.scene)
    expect(cleared.sound).toBe(before.sound)
    expect(next.image).not.toBeNull()
  })
})

describe('withImageEdited', () => {
  const live = withImage(emptyStage('g1'), grum, true, T)
  it('leaves the stage alone when another image is shown or none', () => {
    const other = { ...grum, id: 'i2', file: 'other.png', caption: 'x' }
    expect(withImageEdited(live, other)).toBe(live)
    const empty = emptyStage('g1')
    expect(withImageEdited(empty, grum)).toBe(empty)
  })
  it('replaces the file name and keeps shownAt', () => {
    const next = withImageEdited(live, { ...grum, file: 'new.webp' })
    expect(next.image?.file).toEqual({ collection: 'images', record: 'i1', name: 'new.webp' })
    expect(next.image?.shownAt).toBe(T)
  })
  it('a shown caption follows the edit', () => {
    expect(withImageEdited(live, { ...grum, caption: 'Grum the younger' }).image?.caption).toBe('Grum the younger')
  })
  it('a shown caption becomes null when removed', () => {
    expect(withImageEdited(live, { ...grum, caption: null }).image?.caption).toBeNull()
  })
  it('a null stage caption stays null, shown without caption', () => {
    const hidden = withImage(emptyStage('g1'), grum, false, T)
    const next = withImageEdited(hidden, { ...grum, caption: 'Secret' })
    expect(next.image?.caption).toBeNull()
    expect(JSON.stringify(next)).not.toContain('Secret')
  })
  it('a null stage caption stays null, image had none', () => {
    const bare = withImage(emptyStage('g1'), { ...grum, caption: null }, true, T)
    expect(withImageEdited(bare, { ...grum, caption: 'Added later' }).image?.caption).toBeNull()
  })
  it('does not touch the other slots', () => {
    const before = withImage(stageWithSceneAndSound(), grum, true, T)
    const next = withImageEdited(before, { ...grum, file: 'n.webp' })
    expect(next.scene).toBe(before.scene)
    expect(next.sound).toBe(before.sound)
  })
})

describe('checkImageData', () => {
  it('trims the caption, turns an empty one into null, cuts one over the limit', () => {
    expect(checkImageData({ id: 'i1', caption: '  Grum  ' })).toEqual({ id: 'i1', caption: 'Grum' })
    expect(checkImageData({ id: 'i1', caption: '   ' })).toEqual({ id: 'i1', caption: null })
    expect(checkImageData({ id: 'i1', caption: null })).toEqual({ id: 'i1', caption: null })
    expect(checkImageData({ id: 'i1' })).toEqual({ id: 'i1', caption: null })
    expect(checkImageData({ id: 'i1', caption: 'a'.repeat(CAPTION_MAX) })?.caption).toHaveLength(CAPTION_MAX)
    // A stored row with a longer caption (written by hand, or by an older client) still shows, so it can be edited or deleted.
    expect(checkImageData({ id: 'i1', caption: 'a'.repeat(CAPTION_MAX + 1) })).toEqual({ id: 'i1', caption: 'a'.repeat(CAPTION_MAX) })
    // Cut as text, never in the middle of a character.
    const cut = checkImageData({ id: 'i1', caption: `${'a'.repeat(CAPTION_MAX - 1)}🗺️ and more` })?.caption
    expect(cut).toBe('a'.repeat(CAPTION_MAX - 1))
    expect(checkImageData({ id: 'i1', caption: ` ${'a'.repeat(CAPTION_MAX)} ` })?.caption).toHaveLength(CAPTION_MAX)
  })
  it('refuses wrong types, a missing id and non-objects', () => {
    expect(checkImageData({ id: 'i1', caption: 5 })).toBeNull()
    expect(checkImageData({ id: '', caption: 'x' })).toBeNull()
    expect(checkImageData({ id: 7 })).toBeNull()
    expect(checkImageData({ caption: 'x' })).toBeNull()
    expect(checkImageData(null)).toBeNull()
    expect(checkImageData([])).toBeNull()
    expect(checkImageData('x')).toBeNull()
  })
  it('drops extra keys', () => {
    expect(checkImageData({ id: 'i1', caption: 'x', extra: 1 })).toEqual({ id: 'i1', caption: 'x' })
  })
})

describe('checkImageDraft', () => {
  it('is clean with an empty caption and a file', () => {
    expect(checkImageDraft({ caption: '', hasFile: true })).toEqual([])
    expect(checkImageDraft({ caption: '   ', hasFile: true })).toEqual([])
  })
  it('flags a caption over the limit by its trimmed length', () => {
    expect(checkImageDraft({ caption: 'a'.repeat(CAPTION_MAX + 1), hasFile: true })).toEqual(['captionTooLong'])
    expect(checkImageDraft({ caption: ` ${'a'.repeat(CAPTION_MAX)} `, hasFile: true })).toEqual([])
  })
  it('flags a missing file', () => {
    expect(checkImageDraft({ caption: '', hasFile: false })).toEqual(['noFile'])
    expect(checkImageDraft({ caption: 'a'.repeat(CAPTION_MAX + 1), hasFile: false })).toEqual(['captionTooLong', 'noFile'])
  })
})

describe('revealKey', () => {
  it('differs when the same image is shown twice', () => {
    const a = withImage(emptyStage('g1'), grum, true, T).image!
    const b = withImage(emptyStage('g1'), grum, true, '2026-11-12T11:05:00.000Z').image!
    expect(revealKey(a)).toBe(`i1:${T}`)
    expect(revealKey(a)).not.toBe(revealKey(b))
  })
})

describe('shouldReveal', () => {
  it('never reveals the first value seen since the table opened', () => {
    expect(shouldReveal(undefined, 'a:1', false)).toBe(false)
    expect(shouldReveal(undefined, null, false)).toBe(false)
  })
  it('reveals a change to a new key', () => {
    expect(shouldReveal('a:1', 'b:2', false)).toBe(true)
    expect(shouldReveal(null, 'a:1', false)).toBe(true)
  })
  it('never reveals to the master', () => {
    expect(shouldReveal('a:1', 'b:2', true)).toBe(false)
    expect(shouldReveal(null, 'a:1', true)).toBe(false)
  })
  it('never reveals null or the same key', () => {
    expect(shouldReveal('a:1', null, false)).toBe(false)
    expect(shouldReveal(null, null, false)).toBe(false)
    expect(shouldReveal('a:1', 'a:1', false)).toBe(false)
  })
  it('the same image shown again after hiding reveals', () => {
    expect(shouldReveal(null, 'a:2', false)).toBe(true)
  })
})

describe('blank captions are no caption', () => {
  it('withImage puts null for an empty or blank caption, and trims a real one', () => {
    expect(withImage(emptyStage('g1'), { ...grum, caption: '' }, true, T).image?.caption).toBeNull()
    expect(withImage(emptyStage('g1'), { ...grum, caption: '   ' }, true, T).image?.caption).toBeNull()
    expect(withImage(emptyStage('g1'), { ...grum, caption: '  Grum  ' }, true, T).image?.caption).toBe('Grum')
  })
  it('an edit of a stage with a blank caption stays null and never carries the new text', () => {
    const blank: Stage = { ...emptyStage('g1'), image: { id: 'i1', file: { collection: 'images', record: 'i1', name: 'a.webp' }, caption: '  ', shownAt: T } }
    const next = withImageEdited(blank, { ...grum, caption: 'Secret' })
    expect(next.image?.caption).toBeNull()
    expect(JSON.stringify(next)).not.toContain('Secret')
    const viaWith = withImage(emptyStage('g1'), { ...grum, caption: ' ' }, true, T)
    expect(JSON.stringify(withImageEdited(viaWith, { ...grum, caption: 'Secret' }))).not.toContain('Secret')
  })
  it('an edit to a blank caption removes a shown one', () => {
    const live = withImage(emptyStage('g1'), grum, true, T)
    expect(withImageEdited(live, { ...grum, caption: '   ' }).image?.caption).toBeNull()
  })
  it('checkStage maps a blank caption to null', () => {
    const raw = { id: 'g1', scene: null, sound: null, image: { ...shown, caption: '   ' } }
    expect(checkStage(raw, 'g1')?.image?.caption).toBeNull()
  })
})

describe('checkStage bounds the caption players render', () => {
  const withCaption = (caption: unknown) => checkStage({ id: 'g1', scene: null, sound: null, image: { ...shown, caption } }, 'g1')
  it('cuts a caption over the limit to the limit, keeping the image', () => {
    const out = withCaption('a'.repeat(CAPTION_MAX + 1))
    expect(out?.image?.caption).toBe('a'.repeat(CAPTION_MAX))
    expect(out?.image?.id).toBe(shown.id)
  })
  it('leaves a caption of exactly the limit alone, and trims before counting', () => {
    expect(withCaption('a'.repeat(CAPTION_MAX))?.image?.caption).toBe('a'.repeat(CAPTION_MAX))
    expect(withCaption(` ${'a'.repeat(CAPTION_MAX)} `)?.image?.caption).toBe('a'.repeat(CAPTION_MAX))
  })
  it('trims after the cut too, so a cut never leaves a trailing space', () => {
    const words = `${'a'.repeat(CAPTION_MAX - 1)} tail`
    expect(withCaption(words)?.image?.caption).toBe('a'.repeat(CAPTION_MAX - 1))
    expect(withImage(emptyStage('g1'), { ...grum, caption: words }, true, T).image?.caption).toBe('a'.repeat(CAPTION_MAX - 1))
  })
  it('does not split an emoji when cutting', () => {
    const out = withCaption(`${'a'.repeat(CAPTION_MAX - 1)}😀`)?.image?.caption
    expect(out).toBe('a'.repeat(CAPTION_MAX - 1))
  })
  it('still drops the image slot for a caption that is not a string or null', () => {
    expect(withCaption(5)?.image).toBeNull()
  })
})

describe('stage round trip through checkStage', () => {
  const rich: TableImage = { id: 'image-record-0001', caption: 'Old Grum, the innkeeper', file: 'image_ab.webp' }
  const trip = (stage: Stage) => checkStage(JSON.parse(JSON.stringify(stage)), 'g1')
  it('withImage with a caption, without one, and for an image with none', () => {
    const base = stageWithSceneAndSound()
    for (const next of [
      withImage(base, rich, true, T),
      withImage(base, rich, false, T),
      withImage(base, { ...rich, caption: null }, true, T),
    ]) expect(trip(next)).toEqual(next)
  })
  it('withImageEdited with a caption changed, removed and kept null', () => {
    const live = withImage(emptyStage('g1'), rich, true, T)
    const hidden = withImage(emptyStage('g1'), rich, false, T)
    for (const next of [
      withImageEdited(live, { ...rich, caption: 'Grum the younger', file: 'n.png' }),
      withImageEdited(live, { ...rich, caption: null }),
      withImageEdited(hidden, { ...rich, caption: 'Secret' }),
    ]) expect(trip(next)).toEqual(next)
  })
})

describe('withImageEdited identity and immutability', () => {
  it('returns the same object when nothing would change', () => {
    const live = withImage(emptyStage('g1'), grum, true, T)
    expect(withImageEdited(live, grum)).toBe(live)
    const hidden = withImage(emptyStage('g1'), grum, false, T)
    expect(withImageEdited(hidden, { ...grum, caption: 'Other' })).toBe(hidden)
    expect(withImageEdited(live, { ...grum, caption: '  Old Grum, the innkeeper ' })).toBe(live)
  })
  it('does not change its input', () => {
    const empty = emptyStage('g1')
    withImage(empty, grum, true, T)
    expect(empty.image).toBeNull()
    const live = withImage(emptyStage('g1'), grum, true, T)
    const before = live.image
    withImageEdited(live, { ...grum, file: 'new.png', caption: 'New' })
    expect(live.image).toBe(before)
    expect(live.image?.file.name).toBe('image_ab.webp')
    expect(live.image?.caption).toBe('Old Grum, the innkeeper')
  })
})

describe('caption length counting', () => {
  // UTF-16 units, like the sibling name checks: the UI counter must count the same way.
  it('61 astral emoji are 122 units: a draft is flagged, a stored one is cut to 60 whole ones', () => {
    const caption = '😀'.repeat(61)
    expect(checkImageDraft({ caption, hasFile: true })).toEqual(['captionTooLong'])
    expect(checkImageData({ id: 'i1', caption })?.caption).toBe('😀'.repeat(60))
    expect(checkImageData({ id: 'i1', caption: '😀'.repeat(60) })?.caption).toBe('😀'.repeat(60))
  })
})
