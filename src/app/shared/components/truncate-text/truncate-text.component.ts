import { Component, input, ViewChild, ElementRef, AfterViewInit, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-truncate-text',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative inline-block w-full" (mouseenter)="onMouseEnter()" (mouseleave)="onMouseLeave()">
      <span #textElement class="block truncate overflow-hidden" [class]="maxW()">{{ text() }}</span>
      <div *ngIf="showTooltip()" [ngClass]="getTooltipClasses()">
        {{ tooltipText() || text() }}
        <div *ngIf="tooltipPosition() === 'top'" class="absolute left-1/2 -translate-x-1/2 bottom-[-4px] w-2 h-2 bg-gray-900 rotate-45 dark:bg-white"></div>
        <div *ngIf="tooltipPosition() === 'bottom'" class="absolute left-1/2 -translate-x-1/2 top-[-4px] w-2 h-2 bg-gray-900 rotate-45 dark:bg-white"></div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
    `
  ]
})
export class TruncateTextComponent implements AfterViewInit {
  @ViewChild('textElement', { static: false }) textElement!: ElementRef<HTMLSpanElement>;

  text = input.required<string>();
  tooltipText = input<string>('');
  maxW = input<string>('');
  alwaysShow = input(false);
  position = input<'top' | 'bottom' | 'auto'>('auto');

  showTooltip = signal(false);
  tooltipPosition = signal<'top' | 'bottom'>('top');
  isTruncated = signal(false);

  ngAfterViewInit(): void {
    this.checkTruncation();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkTruncation();
  }

  checkTruncation(): void {
    if (!this.textElement) return;

    const element = this.textElement.nativeElement;
    const isOverflowing = element.scrollWidth > element.clientWidth;
    this.isTruncated.set(isOverflowing);
  }

  onMouseEnter(): void {
    if (this.alwaysShow() || this.isTruncated()) {
      this.determinePosition();
      this.showTooltip.set(true);
    }
  }

  onMouseLeave(): void {
    this.showTooltip.set(false);
  }

  getTooltipClasses(): string {
    const pos = this.tooltipPosition();
    const base = 'absolute z-[9999] px-3 py-2 rounded-lg text-sm bg-gray-900 text-white dark:bg-white dark:text-gray-900';
    const position = pos === 'top' ? 'bottom-full left-1/2 -translate-x-1/2 mb-2' : 'top-full left-1/2 -translate-x-1/2 mt-2';
    return `${base} ${position}`;
  }

  determinePosition(): void {
    const pos = this.position();
    if (pos !== 'auto') {
      this.tooltipPosition.set(pos);
      return;
    }

    if (!this.textElement) return;

    const element = this.textElement.nativeElement;
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;

    this.tooltipPosition.set(spaceAbove > spaceBelow ? 'top' : 'bottom');
  }
}
