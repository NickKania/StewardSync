import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true
    }
  ],
  template: `
    <div class="w-full">
      @if (label) {
        <label [for]="id" class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">
          {{ label }}
          @if (required) {
            <span class="text-red-500 dark:text-red-400">*</span>
          }
        </label>
      }
      <select
        [id]="id"
        [disabled]="disabled"
        [class]="getSelectClasses()"
        [(ngModel)]="value"
        (ngModelChange)="onValueChange($event)"
        (blur)="onTouched()"
      >
        @if (placeholder) {
          <option value="" disabled>{{ placeholder }}</option>
        }
        @for (option of options; track option.value) {
          <option [value]="option.value" [disabled]="option.disabled">
            {{ option.label }}
          </option>
        }
      </select>
      @if (error) {
        <p class="mt-1 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      }
    </div>
  `
})
export class SelectComponent implements ControlValueAccessor {
  @Input() id = `select-${Math.random().toString(36).substr(2, 9)}`;
  @Input() label = '';
  @Input() placeholder = '';
  @Input() options: SelectOption[] = [];
  @Input() required = false;
  @Input() disabled = false;
  @Input() error = '';

  value = '';
  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: string): void {
    this.value = value || '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onValueChange(value: string): void {
    this.value = value;
    this.onChange(value);
  }

  getSelectClasses(): string {
    const base = 'block w-full px-3 py-2 border rounded-lg shadow-sm bg-white focus:outline-none focus:ring-2 focus:border-primary-500 transition-colors appearance-none cursor-pointer text-gray-900 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700';
    const errorClass = this.error
      ? 'border-red-300 focus:ring-red-500 focus:border-red-500 dark:border-red-500/70 dark:focus:ring-red-400 dark:focus:border-red-400'
      : 'border-gray-300 focus:ring-primary-500 dark:border-gray-700 dark:focus:ring-primary-400 dark:focus:border-primary-400';
    const disabledClass = this.disabled ? 'bg-gray-100 cursor-not-allowed dark:bg-gray-800' : '';

    return `${base} ${errorClass} ${disabledClass}`;
  }
}
