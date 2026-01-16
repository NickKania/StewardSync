import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-toggle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ToggleComponent),
      multi: true
    }
  ],
  template: `
    <div class="w-full">
      @if (label) {
        <label class="block text-sm font-medium text-gray-700 mb-2">
          {{ label }}
          @if (required) {
            <span class="text-red-500">*</span>
          }
        </label>
      }
      <label class="flex items-center cursor-pointer">
        <div class="relative">
          <input
            type="checkbox"
            class="sr-only"
            [checked]="value"
            [disabled]="disabled"
            (change)="onToggle($event)"
          />
          <div
            class="w-11 h-6 rounded-full transition-colors duration-200 ease-in-out"
            [class.bg-gray-200]="!value"
            [class.bg-primary-500]="value"
            [class.opacity-50]="disabled"
          ></div>
          <div
            class="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out shadow"
            [class.translate-x-5]="value"
          ></div>
        </div>
        @if (hint) {
          <span class="ml-3 text-sm text-gray-600">{{ hint }}</span>
        }
      </label>
    </div>
  `,
  styles: [`
    .dot {
      transform: translateX(0);
    }
    .translate-x-5 {
      transform: translateX(1.25rem);
    }
  `]
})
export class ToggleComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() hint = '';
  @Input() required = false;
  @Input() disabled = false;

  value = false;
  onChange: (value: boolean) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: boolean): void {
    this.value = value ?? false;
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onToggle(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.value = checkbox.checked;
    this.onChange(this.value);
    this.onTouched();
  }
}
