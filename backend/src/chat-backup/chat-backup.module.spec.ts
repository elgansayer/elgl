import { AppModule } from '../app.module';
import { ChatModule } from '../chat/chat.module';
import { ChatBackupController } from './chat-backup.controller';
import { ChatBackupModule } from './chat-backup.module';
import { ChatBackupService } from './chat-backup.service';

function metadata<T>(target: object, key: string): T[] {
  return (Reflect.getMetadata(key, target) as T[] | undefined) ?? [];
}

describe('ChatBackupModule registration', () => {
  it('is mounted by AppModule and owns the backup controller', () => {
    const imports = metadata<unknown>(AppModule, 'imports');
    expect(
      imports.filter((module) => module === ChatBackupModule),
    ).toHaveLength(1);
    expect(metadata<unknown>(ChatBackupModule, 'controllers')).toEqual([
      ChatBackupController,
    ]);
    expect(metadata<unknown>(ChatBackupModule, 'providers')).toContain(
      ChatBackupService,
    );
  });

  it('is not also registered by ChatModule', () => {
    expect(metadata<unknown>(ChatModule, 'controllers')).not.toContain(
      ChatBackupController,
    );
    expect(metadata<unknown>(ChatModule, 'providers')).not.toContain(
      ChatBackupService,
    );
  });
});
