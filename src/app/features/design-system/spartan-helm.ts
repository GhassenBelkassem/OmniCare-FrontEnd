import { Directive, ElementRef, effect, inject, input } from '@angular/core';
import { BrnButton } from '@spartan-ng/brain/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Private copy of the Spartan 1.2.0 CLI Helm button template.
 *
 * The CLI generator is currently blocked in this workspace by its published
 * zod@3.25.76 package missing index.cjs. These are intentionally kept beside
 * the development-only harness rather than exported from shared/ui.
 */
function classes(computed: () => ClassValue[] | string): void {
  const element = inject(ElementRef<HTMLElement>).nativeElement;
  effect(() => {
    element.className = twMerge(clsx(computed()));
  });
}

const buttonVariants = cva(
  'spartan-button group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'spartan-button-variant-default',
        outline: 'spartan-button-variant-outline',
        secondary: 'spartan-button-variant-secondary',
        ghost: 'spartan-button-variant-ghost',
        destructive: 'spartan-button-variant-destructive',
      },
      size: {
        default: 'spartan-button-size-default',
        sm: 'spartan-button-size-sm',
        lg: 'spartan-button-size-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type ButtonVariants = VariantProps<typeof buttonVariants>;

@Directive({
  selector: 'button[hlmBtn]',
  hostDirectives: [{ directive: BrnButton, inputs: ['disabled'] }],
  host: { 'data-slot': 'button' },
})
export class HlmButton {
  readonly variant = input<ButtonVariants['variant']>('default');
  readonly size = input<ButtonVariants['size']>('default');

  constructor() {
    classes(() => buttonVariants({ variant: this.variant(), size: this.size() }));
  }
}

export const SpartanHelmImports = [HlmButton] as const;
