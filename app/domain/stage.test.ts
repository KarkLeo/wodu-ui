import { describe, it, expect } from 'vitest'
import {
  emptyStage, withScene, withoutScene, checkStage, checkSceneData, checkSceneDraft,
  checkUpload, neutralFileName, fileUrl, playbackTarget, MEDIA_LIMITS, IMAGE_TYPES, AUDIO_TYPES,
  withSound, withoutSound, checkSoundData, checkSoundDraft, shouldPlayOverlay, formatDuration, overlayKey,
  oneShotClearDelay, SOUND_NAME_MAX, STALE_ONE_SHOT_SECONDS,
} from './stage'
import type { Scene, StageImage, StageSound } from '@/types/stage'

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
    const live = (now: string) => ({ receivedLive: true, now: new Date(now) })
    const url = 'https://api.test/api/files/sounds/sound-record-0001/rain.mp3'

    it('plays a looping sound with sound on, keyed by id and start', () => {
      expect(playbackTarget(withOverlay(playing), all, base, { receivedLive: false, now: new Date('2026-11-12T12:00:00Z') }).overlay)
        .toEqual({ key: overlayKey(playing), src: url, loop: true })
    })

    it('is null with sound off or unset', () => {
      for (const sound of ['unset', 'off'] as const) {
        const target = playbackTarget(withOverlay(playing), { sound, background: true }, base, live('2026-11-12T10:00:01Z'))
        expect(target.overlay).toBeNull()
        expect(target.wantsSound).toBe(true)
      }
    })

    it('is null for a stale one-shot found on load, played when received live', () => {
      const late = new Date('2026-11-12T10:10:00Z')
      expect(playbackTarget(withOverlay(oneShot), all, base, { receivedLive: false, now: late }).overlay).toBeNull()
      expect(playbackTarget(withOverlay(oneShot), all, base, { receivedLive: true, now: late }).overlay)
        .toEqual({ key: overlayKey(oneShot), src: url, loop: false })
    })

    it('still wants sound for a stale one-shot that is not played, even with sound on', () => {
      const target = playbackTarget(withOverlay(oneShot), all, base, { receivedLive: false, now: new Date('2026-11-12T10:10:00Z') })
      expect(target.overlay).toBeNull()
      expect(target.wantsSound).toBe(true)
    })

    it('is null without a sound on the stage', () => {
      expect(playbackTarget(onTavern, all, base, live('2026-11-12T10:00:01Z')).overlay).toBeNull()
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
  it('plays loops always, one-shots only live or fresh', () => {
    expect(STALE_ONE_SHOT_SECONDS).toBe(5)
    expect(shouldPlayOverlay({ ...oneShot, loop: true }, false, at('2026-11-12T11:00:00Z'))).toBe(true)
    expect(shouldPlayOverlay(oneShot, true, at('2026-11-12T11:00:00Z'))).toBe(true)
    expect(shouldPlayOverlay(oneShot, false, at('2026-11-12T10:00:05Z'))).toBe(true)
    expect(shouldPlayOverlay(oneShot, false, at('2026-11-12T10:00:06Z'))).toBe(false)
  })
  it('plays a one-shot whose startedAt is in the future', () => {
    expect(shouldPlayOverlay(oneShot, false, at('2026-11-12T09:00:00Z'))).toBe(true)
  })
  it('does not play a one-shot whose startedAt does not parse, unless it arrived live or loops', () => {
    const broken = { ...oneShot, startedAt: 'yesterday-ish' }
    expect(shouldPlayOverlay(broken, false, at('2026-11-12T10:00:00Z'))).toBe(false)
    expect(shouldPlayOverlay(broken, true, at('2026-11-12T10:00:00Z'))).toBe(true)
    expect(shouldPlayOverlay({ ...broken, loop: true }, false, at('2026-11-12T10:00:00Z'))).toBe(true)
  })
})

describe('oneShotClearDelay', () => {
  const oneShot = { ...playing, loop: false, startedAt: '2026-11-12T10:00:00.000Z' }
  const at = (s: string) => new Date(s)
  it('is null for a loop', () => {
    expect(oneShotClearDelay(playing, 30, at('2026-11-12T10:00:00Z'))).toBeNull()
  })
  it('counts down the known duration and never goes below zero', () => {
    expect(oneShotClearDelay(oneShot, 30, at('2026-11-12T10:00:10Z'))).toBe(20000)
    expect(oneShotClearDelay(oneShot, 30, at('2026-11-12T10:01:00Z'))).toBe(0)
  })
  it('is 0 for a duration of 0', () => {
    expect(oneShotClearDelay(oneShot, 0, at('2026-11-12T10:00:00Z'))).toBe(0)
  })
  it('is 0, not NaN, for a startedAt that does not parse', () => {
    expect(oneShotClearDelay({ ...oneShot, startedAt: 'yesterday-ish' }, 30, at('2026-11-12T10:00:00Z'))).toBe(0)
    expect(oneShotClearDelay({ ...oneShot, startedAt: 'yesterday-ish' }, null, at('2026-11-12T10:00:00Z'))).toBe(0)
  })
  it('counts the whole duration for a startedAt in the future', () => {
    expect(oneShotClearDelay(oneShot, 30, at('2026-11-12T09:59:50Z'))).toBe(40000)
  })
  it('falls back to the stale window for an unknown duration', () => {
    expect(oneShotClearDelay(oneShot, null, at('2026-11-12T10:00:02Z'))).toBe(3000)
    expect(oneShotClearDelay(oneShot, null, at('2026-11-12T10:00:09Z'))).toBe(0)
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
