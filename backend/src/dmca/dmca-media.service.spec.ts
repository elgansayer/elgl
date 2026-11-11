import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { R2ObjectService } from '../cloudflare-r2/r2-object.service';
import { R2GatewayError } from '../cloudflare-r2/r2.service';
import { DmcaMediaService, DmcaMediaObject } from './dmca-media.service';

const BASE = 'https://cdn.example.com';
const OWNER = '3f2b8c1e-7a4d-4e5f-9b6a-1c2d3e4f5a6b';

describe('DmcaMediaService', () => {
  const downloadObject = vi.fn();
  const uploadBytes = vi.fn();
  const deleteObject = vi.fn();
  let service: DmcaMediaService;

  const object = (
    index: number,
    contentType: string | null = null,
  ): DmcaMediaObject => ({
    url: `${BASE}/moments/${OWNER}/${index}.jpg`,
    key: `moments/${OWNER}/${index}.jpg`,
    quarantineKey: `dmca-quarantine/moment/m-1/${index}`,
    contentType,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    downloadObject.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'image/jpeg',
      etag: 'e',
    });
    uploadBytes.mockResolvedValue({});
    deleteObject.mockResolvedValue(undefined);

    service = new DmcaMediaService(
      {
        downloadObject,
        uploadBytes,
        deleteObject,
      } as unknown as R2ObjectService,
      {
        get: (key: string) =>
          key === 'CLOUDFLARE_R2_PUBLIC_URL' ? BASE : undefined,
      } as unknown as ConfigService,
    );
  });

  describe('plan', () => {
    it('plans only files on our media origin, once each, with fixed quarantine keys', () => {
      const planned = service.plan('moment', 'm-1', [
        `${BASE}/moments/${OWNER}/a.jpg`,
        'https://elsewhere.example.net/photo.jpg',
        `${BASE}/moments/${OWNER}/a.jpg`,
        `${BASE}/voice-notes/${OWNER}/b.ogg`,
      ]);

      expect(planned).toEqual([
        {
          url: `${BASE}/moments/${OWNER}/a.jpg`,
          key: `moments/${OWNER}/a.jpg`,
          quarantineKey: 'dmca-quarantine/moment/m-1/0',
          contentType: null,
        },
        {
          url: `${BASE}/voice-notes/${OWNER}/b.ogg`,
          key: `voice-notes/${OWNER}/b.ogg`,
          quarantineKey: 'dmca-quarantine/moment/m-1/1',
          contentType: null,
        },
      ]);
    });

    it('plans nothing when the public origin is not configured', () => {
      const unconfigured = new DmcaMediaService(
        {} as unknown as R2ObjectService,
        { get: () => undefined } as unknown as ConfigService,
      );
      expect(unconfigured.plan('moment', 'm-1', [`${BASE}/a.jpg`])).toEqual([]);
    });
  });

  describe('parse', () => {
    it('keeps well-formed entries and drops anything else', () => {
      expect(
        service.parse([
          object(0, 'image/png'),
          { url: 1 },
          null,
          'text',
          { ...object(1), quarantineKey: 'public/elsewhere/1' },
        ]),
      ).toEqual([object(0, 'image/png')]);
      expect(service.parse('nope')).toEqual([]);
    });
  });

  describe('quarantine', () => {
    it('copies to the private prefix, then removes the public file, recording the content type', async () => {
      const outcome = await service.quarantine([object(0)]);

      expect(downloadObject).toHaveBeenCalledWith(`moments/${OWNER}/0.jpg`);
      expect(uploadBytes).toHaveBeenCalledWith(
        'dmca-quarantine/moment/m-1/0',
        'image/jpeg',
        new Uint8Array([1, 2, 3]),
      );
      expect(deleteObject).toHaveBeenCalledWith(`moments/${OWNER}/0.jpg`);
      expect(uploadBytes.mock.invocationCallOrder[0]).toBeLessThan(
        deleteObject.mock.invocationCallOrder[0] ?? 0,
      );
      expect(outcome).toEqual({
        objects: [object(0, 'image/jpeg')],
        failed: 0,
      });
    });

    it('never deletes the public file when the private copy could not be written', async () => {
      uploadBytes.mockRejectedValue(new Error('r2 down'));

      const outcome = await service.quarantine([object(0)]);

      expect(deleteObject).not.toHaveBeenCalled();
      expect(outcome.failed).toBe(1);
    });

    it('treats a missing source as already moved so retries finish', async () => {
      downloadObject.mockRejectedValue(
        new R2GatewayError(404, 'NOT_FOUND', 'missing'),
      );

      await expect(service.quarantine([object(0)])).resolves.toEqual({
        objects: [object(0)],
        failed: 0,
      });
      expect(uploadBytes).not.toHaveBeenCalled();
    });

    it('keeps going after one file fails and counts it', async () => {
      downloadObject
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({
          bytes: new Uint8Array([9]),
          contentType: 'image/png',
          etag: '',
        });

      const outcome = await service.quarantine([object(0), object(1)]);

      expect(outcome.failed).toBe(1);
      expect(outcome.objects[1]?.contentType).toBe('image/png');
    });
  });

  describe('restore', () => {
    it('puts the file back at its original key with its recorded content type', async () => {
      await expect(service.restore([object(0, 'image/webp')])).resolves.toEqual(
        {
          failed: 0,
        },
      );

      expect(downloadObject).toHaveBeenCalledWith(
        'dmca-quarantine/moment/m-1/0',
      );
      expect(uploadBytes).toHaveBeenCalledWith(
        `moments/${OWNER}/0.jpg`,
        'image/webp',
        new Uint8Array([1, 2, 3]),
      );
      expect(deleteObject).toHaveBeenCalledWith('dmca-quarantine/moment/m-1/0');
    });

    it('treats a missing private copy as nothing to restore', async () => {
      downloadObject.mockRejectedValue(
        new R2GatewayError(404, 'NOT_FOUND', 'missing'),
      );
      await expect(service.restore([object(0)])).resolves.toEqual({
        failed: 0,
      });
    });

    it('reports failures without logging keys', async () => {
      downloadObject.mockRejectedValue(new Error('boom'));

      await expect(service.restore([object(0)])).resolves.toEqual({
        failed: 1,
      });
      expect(
        JSON.stringify(vi.mocked(Logger.prototype.error).mock.calls),
      ).not.toContain(OWNER);
    });
  });

  describe('discard', () => {
    it('removes private copies and tolerates ones that are already gone', async () => {
      deleteObject
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new R2GatewayError(404, 'NOT_FOUND', 'missing'))
        .mockRejectedValueOnce(new Error('boom'));

      await expect(
        service.discard([object(0), object(1), object(2)]),
      ).resolves.toEqual({ failed: 1 });
    });
  });
});
