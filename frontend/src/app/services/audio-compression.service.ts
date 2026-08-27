import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AudioCompressionService {
  /**
   * Compresses or transcodes an audio Blob on the client side using the Web Audio API.
   * Downsamples the audio to 16kHz Mono to significantly reduce file size for voice notes.
   *
   * @param audioBlob The original audio recording blob.
   * @returns A promise resolving to the compressed audio Blob.
   */
  async compressAudio(audioBlob: Blob): Promise<Blob> {
    console.warn(
      `[AudioCompressionService] Compressing audio blob of size: ${audioBlob.size} bytes`,
    );

    try {
      // 1. Convert Blob to ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer();

      // 2. Decode Audio Data
      const AudioContextClass = window.AudioContext;
      if (!AudioContextClass) {
        throw new Error('AudioContext is not available in this browser');
      }
      const audioContext = new AudioContextClass();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // 3. Downsample to 16kHz Mono for voice compression
      const targetSampleRate = 16000;
      const offlineContext = new OfflineAudioContext(
        1, // mono
        audioBuffer.duration * targetSampleRate,
        targetSampleRate,
      );

      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start(0);

      const renderedBuffer = await offlineContext.startRendering();

      // 4. Encode to WAV
      const wavBlob = this.audioBufferToWav(renderedBuffer);
      console.warn(
        `[AudioCompressionService] Compressed to WAV blob of size: ${wavBlob.size} bytes`,
      );

      return wavBlob;
    } catch (error) {
      console.error('[AudioCompressionService] Compression failed, returning original blob', error);
      return audioBlob;
    }
  }

  /**
   * Encodes an AudioBuffer into a WAV Blob.
   */
  private audioBufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    const channels = [];
    let offset = 0;
    let pos = 0;

    // Helper functions to write data to the DataView
    const setUint16 = (data: number) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };

    const setUint32 = (data: number) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };

    // Write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // Write interleaved data
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        // Clamp the sample to the range [-1, 1]
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        // Scale to 16-bit signed integer
        sample = sample < 0 ? sample * 32768 : sample * 32767;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([bufferArray], { type: 'audio/wav' });
  }
}
