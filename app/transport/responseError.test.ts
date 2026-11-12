import { describe, expect, it } from 'vitest'
import { ClientResponseError } from 'pocketbase'
import { errorFromResponse, parseBody } from './responseError'
import { RECORDED } from './recordedResponses'

describe('errorFromResponse', () => {
  it('keeps the status and puts the whole recorded body in `response`, field codes under response.data', () => {
    const err = errorFromResponse('/api/collections/scenes/records', RECORDED.createTextAsImage.status, RECORDED.createTextAsImage.body)
    expect(err).toBeInstanceOf(ClientResponseError)
    expect(err.status).toBe(400)
    expect(err.response).toMatchObject({ status: 400, message: 'Failed to create record.' })
    expect((err.response.data as Record<string, { code: string }>).image.code).toBe('validation_invalid_mime_type')
    // The SDK's `data` getter is the same whole body, not its `data` member.
    expect(err.data).toBe(err.response)
  })

  it('reads every recorded refusal with the field and the code it names, or an empty data', () => {
    const codes = (key: keyof typeof RECORDED) => {
      const r = RECORDED[key]
      const data = errorFromResponse('', r.status, r.body).response.data as Record<string, { code: string }>
      return Object.entries(data).map(([field, v]) => `${field}:${v.code}`)
    }
    expect(codes('createTextAsImage')).toEqual(['image:validation_invalid_mime_type'])
    expect(codes('createBigImage')).toEqual(['image:validation_file_size_limit'])
    expect(codes('createTextAsSound')).toEqual(['sound:validation_invalid_mime_type'])
    expect(codes('updateTextAsImage')).toEqual(['image:validation_invalid_mime_type'])
    expect(codes('updateTextAsSound')).toEqual(['sound:validation_invalid_mime_type'])
    expect(codes('create21st')).toEqual([])
    expect(codes('createDuplicateId')).toEqual([])
    expect(codes('updateNotFound')).toEqual([])
    expect(errorFromResponse('', 404, RECORDED.updateNotFound.body).status).toBe(404)
  })

  it('treats an empty, malformed or non-object body as an empty one', () => {
    for (const text of ['', 'not json', '[1]', 'null', '"x"']) expect(parseBody(text)).toEqual({})
  })
})
