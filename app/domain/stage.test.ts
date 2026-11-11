import { describe, it, expect } from 'vitest'
import {
  emptyStage, withScene, withoutScene, checkStage, checkSceneData, checkSceneDraft,
  checkUpload, neutralFileName, fileUrl, sameFile, MEDIA_LIMITS, IMAGE_TYPES, AUDIO_TYPES,
} from './stage'
import type { Scene, StageImage, StageSound } from '@/types/stage'

const tavern: Scene = { id: 's1', name: 'Tavern', image: 'image_ab12.webp', sound: 'sound_cd34.mp3' }
const shown: StageImage = {
  id: 'i1',
  file: { collection: 'images', record: 'i1', name: 'map.png' },
  caption: 'A map',
  shownAt: '2026-11-12T10:00:00.000Z',
}
const playing: StageSound = {
  id: 'k1',
  file: { collection: 'sounds', record: 'k1', name: 'rain.mp3' },
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
      id: 's1',
      image: { collection: 'scenes', record: 's1', name: 'image_ab12.webp' },
      sound: { collection: 'scenes', record: 's1', name: 'sound_cd34.mp3' },
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
    expect(fileUrl('https://api.test/', ref, '176x112')).toBe('https://api.test/api/files/scenes/s1/image_ab%2012.webp?thumb=176x112')
  })
})

describe('sameFile', () => {
  it('compares by collection, record and name; two nulls are the same', () => {
    const a = { collection: 'scenes', record: 's1', name: 'a.png' } as const
    expect(sameFile(a, { ...a })).toBe(true)
    expect(sameFile(a, { ...a, name: 'b.png' })).toBe(false)
    expect(sameFile(a, { ...a, record: 's2' })).toBe(false)
    expect(sameFile(a, { ...a, collection: 'images' })).toBe(false)
    expect(sameFile(a, null)).toBe(false)
    expect(sameFile(null, a)).toBe(false)
    expect(sameFile(null, null)).toBe(true)
  })
})
