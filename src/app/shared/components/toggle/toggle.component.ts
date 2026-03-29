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
        <label class="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-200">
          {{ label }}
          @if (required) {
            <span class="text-danger">*</span>
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
            [ngClass]="{
              'bg-gray-200 dark:bg-gray-700': !value,
              'bg-primary-500 dark:bg-primary-400': value,
              'opacity-50': disabled
            }"
          ></div>
          <div
            class="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out shadow dark:bg-gray-100"
            [class.translate-x-5]="value"
          ></div>
        </div>
        @if (hint) {
          <span class="ml-3 text-sm text-gray-600 dark:text-gray-300">{{ hint }}</span>
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
