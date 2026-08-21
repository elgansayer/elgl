import { buttonVariants } from './hlm-button';

describe('HlmButton product variants', () => {
  it('provides a touch-safe text button size', () => {
    const classes = buttonVariants({ size: 'touch' });

    expect(classes).toContain('min-h-11');
    expect(classes).toContain('px-4');
  });

  it('provides a touch-safe icon button size', () => {
    expect(buttonVariants({ size: 'icon-touch' })).toContain('size-11');
  });

  it('provides a solid destructive action variant', () => {
    const classes = buttonVariants({ variant: 'destructive-solid' });

    expect(classes).toContain('bg-destructive');
    expect(classes).toContain('text-primary-foreground');
  });
});
