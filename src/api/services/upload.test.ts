import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    post: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

vi.mock('../client', () => ({ default: mockClient }))

import { uploadService } from './upload'

describe('uploadService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uploadFile posts multipart/form-data', async () => {
    const appendSpy = vi.spyOn(FormData.prototype, 'append')

    mockClient.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          fileUrl: 'u',
          filename: 'x.txt',
          originalName: 'x.txt',
          size: 1,
          mimetype: 'text/plain',
        },
      },
    })

    const file = new File(['x'], 'x.txt', { type: 'text/plain' })
    const out = await uploadService.uploadFile(file)

    expect(appendSpy).toHaveBeenCalledWith('file', file)
    expect(mockClient.post).toHaveBeenCalled()

    const [url, body, config] = mockClient.post.mock.calls[0]
    expect(url).toBe('/upload')
    expect(body).toBeInstanceOf(FormData)
    expect(config.headers['Content-Type']).toMatch(/multipart\/form-data/)
    expect(out.data.fileUrl).toBe('u')
  })

  it('uploadFiles posts multipart/form-data to /upload/multiple and appends each file', async () => {
    const appendSpy = vi.spyOn(FormData.prototype, 'append')

    mockClient.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          files: [
            { fileUrl: 'a', filename: 'a.jpg', originalName: 'a.jpg', size: 1, mimetype: 'image/jpeg' },
            { fileUrl: 'b', filename: 'b.jpg', originalName: 'b.jpg', size: 1, mimetype: 'image/jpeg' },
          ],
          count: 2,
        },
      },
    })

    const a = new File(['a'], 'a.jpg', { type: 'image/jpeg' })
    const b = new File(['b'], 'b.jpg', { type: 'image/jpeg' })

    const out = await uploadService.uploadFiles([a, b])

    expect(appendSpy).toHaveBeenCalledWith('files', a)
    expect(appendSpy).toHaveBeenCalledWith('files', b)

    const [url, body, config] = mockClient.post.mock.calls[0]
    expect(url).toBe('/upload/multiple')
    expect(body).toBeInstanceOf(FormData)
    expect(config.headers['Content-Type']).toMatch(/multipart\/form-data/)
    expect(out.data.count).toBe(2)
  })

  it('deleteFile calls DELETE /upload/:filename', async () => {
    mockClient.delete.mockResolvedValueOnce({ data: { success: true, message: 'Deleted' } })

    const out = await uploadService.deleteFile('abc.png')

    expect(mockClient.delete).toHaveBeenCalledWith('/upload/abc.png')
    expect(out).toEqual({ success: true, message: 'Deleted' })
  })

  it('recoverFile calls POST /upload/recover/:filename', async () => {
    mockClient.post.mockResolvedValueOnce({
      data: { success: true, message: 'Recovered', data: { fileUrl: 'https://example.com/file.png' } },
    })

    const out = await uploadService.recoverFile('abc.png')

    expect(mockClient.post).toHaveBeenCalledWith('/upload/recover/abc.png')
    expect(out).toEqual({
      success: true,
      message: 'Recovered',
      data: { fileUrl: 'https://example.com/file.png' },
    })
  })
})

