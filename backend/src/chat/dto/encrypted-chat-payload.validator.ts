import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export const MAX_ENCRYPTED_CHAT_PAYLOAD_LENGTH = 60000;

const ENCRYPTED_CHAT_PAYLOAD_PATTERN =
  /^e2ee:v1:[A-Za-z0-9+/]{16}={0,2}:[A-Za-z0-9+/]+={0,2}$/;

export function IsEncryptedChatPayload(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isEncryptedChatPayload',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const isEncrypted =
            'is_encrypted' in args.object
              ? args.object.is_encrypted
              : undefined;
          if (isEncrypted !== true) {
            return value === undefined || value === null;
          }

          return (
            typeof value === 'string' &&
            value.length <= MAX_ENCRYPTED_CHAT_PAYLOAD_LENGTH &&
            ENCRYPTED_CHAT_PAYLOAD_PATTERN.test(value)
          );
        },
      },
    });
  };
}
