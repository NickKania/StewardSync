import { Component, Input, forwardRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { SelectOption } from '../select/select.component';

@Component({
  selector: 'app-search-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchSelectComponent),
      multi: true
    }
  ],
  template: `
    <div class="w-full relative">
      @if (label) {
        <label [for]="id" class="block text-sm font-medium text-gray-700 mb-1">
          {{ label }}
          @if (required) {
            <span class="text-red-500">*</span>
          }
        </label>
      }
      
      <div class="relative">
        <input
          [id]="id"
          [disabled]="disabled"
          [class]="getInputClasses()"
          [(ngModel)]="searchTerm"
          (focus)="isOpen.set(true)"
          (blur)="onBlur()"
          (keydown)="onKeyDown($event)"
          [placeholder]="placeholder || 'Search...'"
        />
        <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </div>
      </div>

      @if (isOpen()) {
        <div class="absolute z-[100] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          @if (filteredOptions().length === 0) {
            <div class="px-3 py-2 text-gray-500">No results found</div>
          } @else {
            @for (option of filteredOptions(); track option.value) {
              <div
                (mousedown)="selectOption(option)"
                [class]="getOptionClasses(option)"
              >
                {{ option.label }}
              </div>
            }
          }
        </div>
      }

      @if (error) {
        <p class="mt-1 text-sm text-red-600">{{ error }}</p>
      }
    </div>
  `
})
export class SearchSelectComponent implements ControlValueAccessor {
  @Input() id = `search-select-${Math.random().toString(36).substr(2, 9)}`;
  @Input() label = '';
  @Input() placeholder = '';
  @Input() options: SelectOption[] = [];
  @Input() required = false;
  @Input() disabled = false;
  @Input() error = '';

  value = '';
  searchTerm = signal('');
  isOpen = signal(false);
  selectedIndex = signal(0);

  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  filteredOptions = computed(() => {
    if (!this.searchTerm()) return this.options;
    
    const term = this.searchTerm().toLowerCase();
    return this.options.filter(option =>
      option.label.toLowerCase().includes(term) ||
      option.value.toLowerCase().includes(term)
    );
  });

  writeValue(value: string): void {
    this.value = value || '';
    const selectedOption = this.options.find(o => String(o.value) === String(value));
    if (selectedOption) {
      this.searchTerm.set(selectedOption.label);
    } else if (!value) {
      this.searchTerm.set('');
    }
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

  selectOption(option: SelectOption): void {
    this.value = option.value;
    this.searchTerm.set(option.label);
    this.isOpen.set(false);
    this.onChange(option.value);
  }

  onBlur(): void {
    setTimeout(() => {
      this.isOpen.set(false);
      this.onTouched();
      
      const match = this.options.find(o => o.label === this.searchTerm());
      if (match && String(match.value) !== String(this.value)) {
        this.value = match.value;
        this.onChange(match.value);
      } else if (!match && this.searchTerm()) {
        this.searchTerm.set('');
        if (!this.value) {
          this.onChange('');
        }
      } else if (!this.searchTerm()) {
        this.value = '';
        this.onChange('');
      }
    }, 200);
  }

  onKeyDown(event: KeyboardEvent): void {
    const options = this.filteredOptions();
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex.set(Math.min(this.selectedIndex() + 1, options.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex.set(Math.max(this.selectedIndex() - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (options[this.selectedIndex()]) {
          this.selectOption(options[this.selectedIndex()]);
        }
        break;
      case 'Escape':
        this.isOpen.set(false);
        break;
    }
  }

  getInputClasses(): string {
    const base = 'block w-full px-3 py-2 border rounded-lg shadow-sm bg-white focus:outline-none focus:ring-2 focus:border-primary-500 transition-colors';
    const errorClass = this.error
      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
      : 'border-gray-300 focus:ring-primary-500';
    const disabledClass = this.disabled ? 'bg-gray-100 cursor-not-allowed' : '';

    return `${base} ${errorClass} ${disabledClass}`;
  }

  getOptionClasses(option: SelectOption): string {
    const isSelected = option.value === this.value;
    const base = 'px-3 py-2.5 cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-0 whitespace-nowrap';
    const selectedClass = isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-900';
    const disabledClass = option.disabled ? 'opacity-50 cursor-not-allowed' : '';

    return `${base} ${selectedClass} ${disabledClass}`;
  }
}
