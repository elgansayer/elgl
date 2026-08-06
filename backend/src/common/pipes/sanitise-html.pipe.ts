import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window as unknown as Window);

@Injectable()
export class SanitiseHtmlPipe implements PipeTransform {
  transform(value: any, _metadata: ArgumentMetadata) {
    return this.sanitiseValue(value);
  }

  private sanitiseValue(value: any, keyName?: string): any {
    if (typeof value === 'string') {
      // Skip sanitisation for password fields to avoid corrupting legitimate passwords
      if (keyName && keyName.toLowerCase().includes('password')) {
        return value;
      }
      return purify.sanitize(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitiseValue(item, keyName));
    }

    if (this.isPlainObject(value)) {
      const sanitised: any = {};
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          sanitised[key] = this.sanitiseValue(value[key], key);
        }
      }
      return sanitised;
    }

    return value;
  }

  private isPlainObject(val: any): boolean {
    if (val === null || typeof val !== 'object') {
      return false;
    }
    const proto = Object.getPrototypeOf(val);
    return proto === Object.prototype || proto === null;
  }
}
