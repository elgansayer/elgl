import type { MockInstance } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AudioIntroService } from './audio-intro.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('AudioIntroService', () => {
  let service: AudioIntroService;
  let supabaseService: SupabaseService;

  const mockSupabaseClient = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    update: vi.fn().mockReturnThis(),
    storage: {
      from: vi.fn().mockReturnThis(),
      createSignedUploadUrl: vi.fn(),
      getPublicUrl: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AudioIntroService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<AudioIntroService>(AudioIntroService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAudioIntro', () => {
    it('should return audio_url when data is present', async () => {
      const mockUserId = 'user-123';
      const mockAudioUrl = 'https://example.com/audio.mp3';

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { audio_intro_url: mockAudioUrl },
        error: null,
      });

      const result = await service.getAudioIntro(mockUserId);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('audio_intro_url');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', mockUserId);
      expect(mockSupabaseClient.single).toHaveBeenCalled();

      expect(result).toEqual({ audio_url: mockAudioUrl });
    });

    it('should return audio_url as null when audio_intro_url is null', async () => {
      const mockUserId = 'user-123';

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { audio_intro_url: null },
        error: null,
      });

      const result = await service.getAudioIntro(mockUserId);

      expect(result).toEqual({ audio_url: null });
    });

    it('should throw an error when supabase returns an error', async () => {
      const mockUserId = 'user-123';
      const mockError = new Error('Database error');

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      await expect(service.getAudioIntro(mockUserId)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('updateAudioIntro', () => {
    it('should successfully update the audio intro url', async () => {
      const mockUserId = 'user-123';
      const mockAudioUrl = 'https://example.com/audio.mp3';

      mockSupabaseClient.eq.mockResolvedValueOnce({
        error: null,
      });

      await service.updateAudioIntro(mockUserId, mockAudioUrl);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        audio_intro_url: mockAudioUrl,
      });
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', mockUserId);
    });

    it('should throw an error when supabase update fails', async () => {
      const mockUserId = 'user-123';
      const mockAudioUrl = 'https://example.com/audio.mp3';
      const mockError = new Error('Database error');

      mockSupabaseClient.eq.mockResolvedValueOnce({
        error: mockError,
      });

      await expect(
        service.updateAudioIntro(mockUserId, mockAudioUrl),
      ).rejects.toThrow('Database error');
    });
  });

  describe('getPresignedUploadUrl', () => {
    let dateNowSpy: MockInstance;

    beforeEach(() => {
      // Mock Date.now() to return a consistent value (e.g. 1000)
      dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);
    });

    afterEach(() => {
      dateNowSpy.mockRestore();
    });

    it('should return a signed upload URL and a public media URL', async () => {
      const filename = 'test-audio.mp3';
      const contentType = 'audio/mpeg';

      const mockSignedUrl = 'https://example.com/signed-url';
      const mockPublicUrl = 'https://example.com/public-url';

      mockSupabaseClient.storage.createSignedUploadUrl.mockResolvedValueOnce({
        data: { signedUrl: mockSignedUrl },
        error: null,
      });

      mockSupabaseClient.storage.getPublicUrl.mockReturnValueOnce({
        data: { publicUrl: mockPublicUrl },
      });

      const result = await service.getPresignedUploadUrl(filename, contentType);

      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('audio');
      expect(
        mockSupabaseClient.storage.createSignedUploadUrl,
      ).toHaveBeenCalledWith('audio-intros/1000_test-audio.mp3');
      expect(mockSupabaseClient.storage.getPublicUrl).toHaveBeenCalledWith(
        'audio-intros/1000_test-audio.mp3',
      );

      expect(result).toEqual({
        uploadUrl: mockSignedUrl,
        mediaUrl: mockPublicUrl,
      });
    });

    it('should fall back to empty string if public URL data is missing', async () => {
      const filename = 'test-audio.mp3';
      const contentType = 'audio/mpeg';

      const mockSignedUrl = 'https://example.com/signed-url';

      mockSupabaseClient.storage.createSignedUploadUrl.mockResolvedValueOnce({
        data: { signedUrl: mockSignedUrl },
        error: null,
      });

      mockSupabaseClient.storage.getPublicUrl.mockReturnValueOnce({
        data: null, // Simulate missing data
      });

      const result = await service.getPresignedUploadUrl(filename, contentType);

      expect(result).toEqual({ uploadUrl: mockSignedUrl, mediaUrl: '' });
    });

    it('should throw an error when signed URL creation fails', async () => {
      const filename = 'test-audio.mp3';
      const contentType = 'audio/mpeg';
      const mockError = new Error('Storage error');

      mockSupabaseClient.storage.createSignedUploadUrl.mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      await expect(
        service.getPresignedUploadUrl(filename, contentType),
      ).rejects.toThrow('Storage error');
    });
  });
});
