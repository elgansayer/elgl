import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window as unknown as Window);

@Injectable()
export class SanitiseHtmlPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    return this.sanitiseValue(value);
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const prototype = Object.getPrototypeOf(value) as unknown;
    return prototype === null || prototype === Object.prototype;
  }

  private sanitiseValue(value: unknown): unknown {
    if (typeof value === 'string') {
      return purify.sanitize(value);
    }

    if (Array.isArray(value)) {
      return value.map((item: unknown) => this.sanitiseValue(item));
    }

    if (this.isPlainObject(value)) {
      const sanitisedObject: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        sanitisedObject[key] = this.sanitiseValue(val);
      }
      return sanitisedObject;
    }

    return value;
  }
}
