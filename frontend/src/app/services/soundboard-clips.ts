export type SoundboardSoundId =
  | 'applause'
  | 'laugh'
  | 'drumroll'
  | 'airhorn'
  | 'gong';

export interface BundledSoundboardClip {
  id: SoundboardSoundId;
  name: string;
  icon: string;
  audioDataUrl: string;
}

/**
 * Reviewed, fixed sound effects bundled with the web client.
 *
 * Realtime events only carry a server-authoritative sound ID. Playback resolves
 * that ID against this catalogue instead of trusting a remote URL received over
 * Centrifugo. The tiny PCM WAV clips also keep the soundboard functional without
 * a separate media CDN dependency.
 */
export const BUNDLED_SOUNDBOARD_CLIPS: readonly BundledSoundboardClip[] = [
  {
    id: 'applause',
    name: 'Applause',
    icon: '👏',
    audioDataUrl:
      'data:audio/wav;base64,UklGRlQCAABXQVZFZm10IBAAAAABAAEA0AcAANAHAAABAAgAZGF0YTACAAB1gXiIlX5whXp7hW10knCUe21rf453Z2mDmY6OfVtwabFviVmvqD92uK1lo6napEM1e2FTv2i2jlNUq5phnqR1lpCDgZKIdpGRdG12j35shmxzf3qFjniCkHmGc4VtkZGTjn1zhoeAe3l8eoKKbYyLh5CEhpF9i3OKf42AeH+KhJGOj4FyinJ/km2OjIdvhIF5hHGBjXiJjXpzdIWHdXFweJF9eYp2jm+MhZKEeHGRfYGRg3NyhHeMdn57eHN0iod4joN2gneIe4aDjnWGdmtsh2NnmF+eflNXqXC8sFhKkaV4bjWePTuCRoRGlopfoXyOWJaMbH2XcHeLh22NgnyQfIuEcn54jYdygnh8ioyJjo11dotwkHR2cI9whYmChI6CdHyDeYCNjXmJdn9/jnSFj499e3qDeId6eYV9gX2BhI2BfYB7cnmGhHGFgIRyf3ZxfHqHg3B4hoyDfoV2f3KCfH11dnqCdIWCc3V0h4VyioqAjn9+enuKcnx/fniFinZye4l+ipKQhHp1jI2FXWN6V59YgbiEQmennFx1i2V5mpukj5lannt8nJiOkpKOh3yLeHiDdImJiHOIeIyMg3R6in57i3+DgYZ/goh4dop/g32JiIiMiH91dYN1iHV4h4OBd3x+foaLgnV/fYp6gYqAgXh5eoBzd3p5dXSBc4p+fXWGfoeJhXZ1f4CFdH5+ioB9g3p/foWGenaHc3uGgn95f3V3eHqCd32Lgnd7eYmHhQ==',
  },
  {
    id: 'laugh',
    name: 'Laughter',
    icon: '😂',
    audioDataUrl:
      'data:audio/wav;base64,UklGRnwCAABXQVZFZm10IBAAAAABAAEA0AcAANAHAAABAAgAZGF0YVgCAACArbqaZ0ZSgrG3kFtEYJi6qHJIUYa1sX5MTICzsn1KT4e3rHFGWpi7m1xFca61fklUk7ucW0Z3srByRWCiuYlNUI66nVtGebStbkRlpriESlKSu5taRneysXVGW5q7l1hGda+0gEtPh7esc0dUjbisdEhQhbS0hVJGbKK7pHBJTHanu6V1TUdmlba2lWhJSGWPsbqngVtGSWOIqbq1nnxcSEVTbo2nuImHhH97eHZ2d3p+gYWHiYmJh4WCf3x6eHZ2dnZ3eHp8fn+Bg4WGh4iJiYmJiYmJiIiHhoaFhIODgoGAgH9+fX18e3t6enl4eHd3d3Z2dnZ2dnZ2dnd4eHl6fH1/gIKEhYeIiYmJiYiGhIJ/fHl3dnZ3eXyAg4eJiYiEgHt3dnd6gIWJiYZ/eXZ3fIOIiYR8dnZ9hYmGfnd3f4eJgXh2f4iIfXZ6hYmAR12mtXJEdbecT1iorl1On7JfT6SsVFyzlUV9umpOrJpFhbZYY7pyT7KIR6eWRJ+cRJ2dRKCYRaiNSbJ8UrlmZbpSf61FnpNJtXBgulGEqESog1K6XHWxRp2RSrdpZrhMjKNEqoJRumRpuU+CrUaXnkSlkUetiUmvh0itjUakmkSTrEt3umRVs49EirdhUqujTWO1mUpls6FSVKK1cURytKpmRG+utYB3d4CIiIF5dnqBiImFfnh2d3uBhomJiIWBfXp4dnZ2dnd3eHl5eXl5eXh4d3Z2dnZ3eXx/g4aJiYiFgHt3dnh9hIiJhX54dnmBiImDe3Z5gYiIgHd3f4iIgHd3gYmGfHZ8hok=',
  },
  {
    id: 'drumroll',
    name: 'Drum Roll',
    icon: '🥁',
    audioDataUrl:
      'data:audio/wav;base64,UklGRqQCAABXQVZFZm10IBAAAAABAAEA0AcAANAHAAABAAgAZGF0YYACAAB+d4h4cnOFhnKOcIyKkpJpfoBiXX+AWaWgmL2aTb25tF3ChVhQUHFVi35rgIyci32BhoeQgnB8kYSJfX54hJGJh354jpFuh4qPbod/hYmCc3N4iHp0cHOCh36DdXGDiIuOdoR7jW56eoF2gHpyfoZyj3OQfZF1i4uFhn12cpGRf3V/dIJ6eXGTgmyNaZJ2ZY6Fh4NdkqFjpmCXVaV0wFlBl7RUW5ePVp6mnX6ZiHRuh4SCjoCDhX5vcHqJcomEh411i5BvgIlyb3OEdXSNen+Jd3FyeItzcIGOc4p6eYaGe46OhnB+jYORfnyQi3qJhW9/dnZ0eXxygXCOh4aEh3x4e5B9d45wdZWAg5VwmotdoYmCraR9r8B6dH3DxW18uKtlgVOelJN/cI1ymJGScHh3b3eRgI9/hYKPhouKgoCIgY54gnmCdHGKiYWNfY+Pc3x6hoRxh4N/jHOEj3pugnaMeoaPi4p0dYSHg3SOen6QjXmLjYiAjoCNi3CLiX90iJFzfICMdW6HcpxmcV+Wepu0TH13i1Jjl0CeQrBba5WHrYx9jY5jnHKPcm6LiIh8j4x7c453fotujXNzinNye3Rzg3B6eZBwcopudYJ/dIlvjoKFfXODeIZucol8dJCBdI6JdXZvj4qJb3aBj497jHJ1cYd7joCgvdPh5N7PuJ1/Y0o3KygtO05mgJiuv8nMx7uqln9qV0hAPUFLWmyAkqOvt7m1raCQf29hVk9NUVhjcYCOmqSpq6iimIyAc2hgW1pcYmp0f4qUm5+gnpmSiYB2bmhkY2Vpb3d/iI+Ul5iXk42HgHhybmtqa29zeX+Gi4+SkpGOioV/enVycG9wc3Z7',
  },
  {
    id: 'airhorn',
    name: 'Air Horn',
    icon: '📯',
    audioDataUrl:
      'data:audio/wav;base64,UklGRlQCAABXQVZFZm10IBAAAAABAAEA0AcAANAHAAABAAgAZGF0YTACAACAgoF7eoKIgnp5fYSLhHBtiaCFW2ecp3ZWc5yZempvf5ibc1FysapfRIS7l1dZjKKLcmtyi6KMWVeXu4REX6qxclFzm5h/b2p6m6FxS3S2qFpGiLiSWl+Km415amuLqI5UVZy8gENjqqtxV3SUlYZyZHWgpW1Hd7mlV0mLtI5eZIWVkIBnZIyujU5VoLt7RGiopnNddI2VjXRdc6aoaER7u6BVTo2ujGRngJCVhWRejrSLSVeluXdHbaWgdWRyhpWUdFdxq6pjQ3+8nFVUjqiLa2p5jZuKX1qSuIhGWqi2dEtxoZt6am9/mJtzUXKxql9EhLuXV1mMootya3KLooxZV5e7hERfqrFyUXObmH9vanqboXFLdLaoWkaIuJJaX4qbjXlqa4uojlRVnLyAQ2Oqq3FXdJSVhnJkdaClbUd3uaVXSYu0jl5khZWQgGdkjK6NTlWgu3tEaKimc110jZWNdF1zpqhoRHu7oFVOja6MZGeAkJWFZF6OtItJV6W5d0dtpaB1ZHKGlZR0V3GrqmNDf7ycVVSOqItranmNm4pfWpK4iEZaqLZ0S3Ghm3pqb3+Ym3NRcrGqX0SEu5dXWYyii3JrcouijFlXl7uERF+qsXJRc5uYf29qepuhcUt0tqhaR4i2kVxhiZiLem1uiaGLXF6VroBTa56edmR4jY2Ed296kpV1YXudkmxmhZeGcXSCiIaAd3aDjoRxdIiOfnJ7iId9en6BgoF+fX+Cgn9+fw==',
  },
  {
    id: 'gong',
    name: 'Gong',
    icon: '🔔',
    audioDataUrl:
      'data:audio/wav;base64,UklGRhwDAABXQVZFZm10IBAAAAABAAEA0AcAANAHAAABAAgAZGF0YfgCAACAp8LIup9/ZlhXXWVscnmFlai1tqaJZUY3PFV5nLS7sZ6IeG5pZ2RgYGd3j6m7va6Pa0w9QVZ0kKOqpZuRiIJ7cWRYU1ltiae7v7GUclZIS1pwhJKYmZiXlpOKemZUS1Flg6K3vK+WemJXV2BteYGHjJOcoaGWgmlTSE1hfpuvtKqXgXBmZGdrb3J3gY+eqaqeiG1VSk5gepOkqaKWiH12cm9rZ2Vqd4qerK6jjHFbUFNhdoqXnJqUjYmEf3ZrYV1hcIacq6+kj3djWVplc4GKj5CRkpORiX1tXlhca4KYqKuikXxsZGRpcXl+goeOlZqakoJvXlZaaX6ToaWekYJ2b25vcHFzd3+Klp+gl4dyYVhbaHuMmJyYkIeAe3h0cGxqbniHlqGjmop2Zl1faniGj5KRjouIhYF6cWhkaHODlKCim4t6bGRlbHZ/hYiKjI6Pjol+cmdhZHCAkZyfmYx+c21scHV5fH+DiZCVlY6CdGdhY25+jZealYyCenZ0dHR0dHd+h5GYmJKFdmljZW57iJCTkYuGgX57eHRwbnF5hJCYmpSHeW1naHB6g4mMi4qJh4aCfHVua211go6XmZSJfHJtbXJ4foKEhoiLjIyHf3ZtaWtzgIyUlpKJf3dzc3V3enx+gYaMkJCLgnduaWtzfomQko+Jgn16eHh3dnZ4fYSMkpOOhHlwa2xzfIWLjYuIhYKAfnt3c3J0eoOMkpOPhntzbm90e4GFh4eHh4aFgn53cm9xeIGKkZKOhn52c3N2en6AgoSGiIqJhoB4cm5wdn+IjpCNh4B6d3d4eXp8fYCEiYyMiYJ6cm9wdn6Gi4yKhoJ+fHt6eXh4eX2DiY2OioN7dHFydn2Dh4iIhoSCgX98eXZ1dnuBiI2Oi4R9dnN0d3yAg4SFhYWFhYJ/enVzdXmAh4yNioV+eXd3eXt+f4CChIaIiIWAenVzdHh/hoqLiYWAfHp6ent7fH1/g4eJiYeCe3ZzdHh+hIeIh4WCf359fHt6eXp9',
  },
] as const;

const CLIPS_BY_ID = new Map<SoundboardSoundId, BundledSoundboardClip>(
  BUNDLED_SOUNDBOARD_CLIPS.map((clip) => [clip.id, clip]),
);

export function getBundledSoundboardClip(
  soundId: string,
): BundledSoundboardClip | undefined {
  return CLIPS_BY_ID.get(soundId as SoundboardSoundId);
}

export function isBundledSoundboardSoundId(
  soundId: string,
): soundId is SoundboardSoundId {
  return CLIPS_BY_ID.has(soundId as SoundboardSoundId);
}
