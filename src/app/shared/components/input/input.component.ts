import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true
    }
  ],
  template: `
    <div class="w-full">
      @if (label) {
        <label [for]="id" class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">
          {{ label }}
          @if (required) {
            <span class="text-danger">*</span>
          }
        </label>
      }
      <input
        [id]="id"
        [type]="type"
        [placeholder]="placeholder"
        [disabled]="disabled"
        [readonly]="readonly"
        [class]="getInputClasses()"
        [(ngModel)]="value"
        (ngModelChange)="onValueChange($event)"
        (blur)="onTouched()"
      />
      @if (error) {
        <p class="mt-1 text-sm text-danger">{{ error }}</p>
      }
      @if (hint && !error) {
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ hint }}</p>
      }
    </div>
  `
})
export class InputComponent implements ControlValueAccessor {
  @Input() id = `input-${Math.random().toString(36).substr(2, 9)}`;
  @Input() label = '';
  @Input() type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' = 'text';
  @Input() placeholder = '';
  @Input() required = false;
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() error = '';
  @Input() hint = '';

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

  getInputClasses(): string {
    const base = 'block w-full px-3 py-2 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-primary-500 transition-colors bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 dark:placeholder-gray-500';
    const errorClass = this.error
      ? 'border-danger-border focus:ring-danger-ring focus:border-danger'
      : 'border-gray-300 focus:ring-primary-500 dark:border-gray-700 dark:focus:ring-primary-400 dark:focus:border-primary-400';
    const disabledClass = this.disabled ? 'bg-gray-100 cursor-not-allowed dark:bg-gray-800' : '';

    return `${base} ${errorClass} ${disabledClass}`;
  }
}
