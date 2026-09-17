import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';

import { OcButton } from '../../../shared/ui';

type ScribeState = 'idle' | 'recording' | 'draft';

const SOAP_PLACEHOLDER = [
  'S - Motif et symptomes rapportes par le patient.',
  'O - Observations cliniques et constantes relevees.',
  'A - Evaluation et diagnostic retenu.',
  'P - Plan de traitement, conseils et suivi.',
].join('\n');

@Component({
  selector: 'app-ai-scribe-stub',
  imports: [OcButton],
  templateUrl: './ai-scribe-stub.html',
  styleUrl: './ai-scribe-stub.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiScribeStub implements OnInit {
  readonly text = input('');
  readonly textChange = output<string>();

  readonly state = signal<ScribeState>('idle');
  readonly currentText = signal('');

  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    if (this.text()) {
      this.currentText.set(this.text());
      this.state.set('draft');
    }
  }

  start(): void {
    this.state.set('recording');
    timer(2500)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.currentText.set(SOAP_PLACEHOLDER);
        this.state.set('draft');
        this.textChange.emit(this.currentText());
      });
  }

  update(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.currentText.set(value);
    this.textChange.emit(value);
  }

  restart(): void {
    this.currentText.set('');
    this.textChange.emit('');
    this.state.set('idle');
  }
}
