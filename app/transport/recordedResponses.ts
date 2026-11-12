// Raw answers of a real PocketBase 0.40 running the table media migrations (1700001200, 1700001300), recorded
// 2026-11-12 with a master's token against `scenes`. Tests and the Storybook upload mock build their errors
// from these through `errorFromResponse`, so none of them invents the shape of a refusal.
export interface RecordedResponse { status: number; body: string }

export const RECORDED = {
  // POST a text file as `image`
  createTextAsImage: {
    status: 400,
    body: '{"data":{"image":{"code":"validation_invalid_mime_type","message":"\\"image_y200jnn7kz.png\\" mime type must be one of: image/jpeg, image/png, image/webp."}},"message":"Failed to create record.","status":400}',
  },
  // POST an image of 2,097,153 bytes
  createBigImage: {
    status: 400,
    body: '{"data":{"image":{"code":"validation_file_size_limit","message":"Failed to upload image.jpg - the maximum allowed file size is 2097152 bytes.","params":{"file":"image.jpg","maxSize":2097152}}},"message":"Failed to create record.","status":400}',
  },
  // POST a text file as `sound`
  createTextAsSound: {
    status: 400,
    body: '{"data":{"sound":{"code":"validation_invalid_mime_type","message":"\\"sound_dsokugejiv.mp3\\" mime type must be one of: audio/mpeg, audio/mp4, audio/x-m4a, audio/aac."}},"message":"Failed to create record.","status":400}',
  },
  // PATCH an existing scene with a text file as `image`
  updateTextAsImage: {
    status: 400,
    body: '{"data":{"image":{"code":"validation_invalid_mime_type","message":"\\"image_q0gq27xrf0.png\\" mime type must be one of: image/jpeg, image/png, image/webp."}},"message":"Failed to update record.","status":400}',
  },
  // PATCH an existing scene with a text file as `sound`
  updateTextAsSound: {
    status: 400,
    body: '{"data":{"sound":{"code":"validation_invalid_mime_type","message":"\\"sound_81ix3k7edu.mp3\\" mime type must be one of: audio/mpeg, audio/mp4, audio/x-m4a, audio/aac."}},"message":"Failed to update record.","status":400}',
  },
  // POST the 21st scene of a game: a rule refusal
  create21st: { status: 400, body: '{"data":{},"message":"Failed to create record.","status":400}' },
  // POST a scene under an id that already exists (a retry after a lost answer): the same 400 as a limit
  createDuplicateId: { status: 400, body: '{"data":{},"message":"Failed to create record.","status":400}' },
  // PATCH a scene that does not exist (or one the caller may not touch)
  updateNotFound: { status: 404, body: '{"data":{},"message":"The requested resource wasn\'t found.","status":404}' },
} as const satisfies Record<string, RecordedResponse>
