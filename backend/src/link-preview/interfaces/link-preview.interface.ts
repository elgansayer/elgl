import type { ShareLinkPreview } from '../../sharing/sharing.types';

export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
  /** Present when the URL resolves to an internal HelloTalk share target. */
  share?: ShareLinkPreview;
}
