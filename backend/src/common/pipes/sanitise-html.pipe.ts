import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window as unknown as Window);

@Injectable()
export class SanitiseHtmlPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    return this.sanitiseValue(value);
  }

  private isPlainObject(value: any): boolean {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === null || prototype === Object.prototype;
  }

  private sanitiseValue(value: any): any {
    if (typeof value === 'string') {
      return purify.sanitize(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitiseValue(item));
    }

    if (this.isPlainObject(value)) {
      const sanitisedObject: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        sanitisedObject[key] = this.sanitiseValue(val);
      }
      return sanitisedObject;
    }

    return value;
  }
}
