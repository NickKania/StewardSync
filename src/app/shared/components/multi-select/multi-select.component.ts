import { Component, input, output, ElementRef, ViewChild, inject, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TruncateTextComponent } from '../truncate-text/truncate-text.component';

export interface MultiSelectOption {
  value: string;
  label: string;
  selected?: boolean;
}

@Component({
  selector: 'app-multi-select',
  standalone: true,
  imports: [CommonModule, FormsModule, TruncateTextComponent],
  template: `
    <div class="relative w-full">
      @if (label()) {
        <label [for]="id" class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">
          {{ label() }}
          @if (required()) {
            <span class="text-danger">*</span>
          }
        </label>
      }

      <div
        (click)="toggleDropdown()"
        [class]="getDropdownClasses()"
        [attr.id]="id"
      >
        <div class="flex items-center justify-between">
          <app-truncate-text [text]="selectedCount() > 0 ? (selectedCount() + ' ' + (selectedCount() === 1 ? 'option' : 'options') + ' selected') : (placeholder() || 'Select options')" />
          <svg class="w-4 h-4 text-gray-400 transition-transform dark:text-gray-500" [class.rotate-180]="isOpen" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </div>
      </div>

      @if (isOpen) {
        <div class="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg dark:bg-gray-800 dark:border-gray-700 max-h-60 overflow-y-auto">
          <div class="p-2 border-b border-gray-200 dark:border-gray-700">
            <label class="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
              <input
                type="checkbox"
                [(ngModel)]="allSelected"
                (ngModelChange)="toggleAll($event)"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
              />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-200">Select All</span>
            </label>
          </div>
          @for (option of options(); track option.value) {
            <label class="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
              <input
                type="checkbox"
                [(ngModel)]="option.selected"
                (ngModelChange)="onOptionChange()"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
              />
              <span class="text-sm text-gray-700 dark:text-gray-200">{{ option.label }}</span>
            </label>
          }
          @if (options().length === 0) {
            <p class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No options available</p>
          }
        </div>
      }

      @if (error()) {
        <p class="mt-1 text-sm text-danger">{{ error() }}</p>
      }
    </div>
  `
})
export class MultiSelectComponent {
  @ViewChild('dropdownContainer', { static: false }) dropdownContainer!: ElementRef;

  id = `multi-select-${Math.random().toString(36).substr(2, 9)}`;
  isOpen = false;
  allSelected = false;

  options = input.required<MultiSelectOption[]>();
  label = input('');
  placeholder = input('');
  required = input(false);
  disabled = input(false);
  error = input('');

  selectionChange = output<string[]>();

  selectedCount() {
    return this.options().filter((opt) => opt.selected).length;
  }

  getDropdownText() {
    if (this.selectedCount() > 0) {
      return `${this.selectedCount()} ${this.selectedCount() === 1 ? 'option' : 'options'} selected`;
    } else if (this.placeholder()) {
      return this.placeholder();
    } else {
      return 'Select options';
    }
  }

  toggleDropdown() {
    if (this.disabled()) return;
    this.isOpen = !this.isOpen;
  }

  toggleAll(selected: boolean) {
    this.options().forEach((opt) => {
      opt.selected = selected;
    });
    this.emitSelection();
  }

  onOptionChange() {
    this.allSelected = this.options().every((opt) => opt.selected);
    this.emitSelection();
  }

  emitSelection() {
    const selected = this.options()
      .filter((opt) => opt.selected)
      .map((opt) => opt.value);
    this.selectionChange.emit(selected);
  }

  getDropdownClasses() {
    const base = 'block w-full px-3 py-2 border rounded-lg shadow-sm bg-white focus:outline-none transition-colors cursor-pointer min-h-[42px] flex items-center dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700';
    const errorClass = this.error()
      ? 'border-danger-border'
      : 'border-gray-300 dark:border-gray-700';
    const disabledClass = this.disabled() ? 'bg-gray-100 cursor-not-allowed dark:bg-gray-800' : 'hover:border-gray-400 dark:hover:border-gray-600';

    return `${base} ${errorClass} ${disabledClass}`;
  }

  closeDropdown(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      this.isOpen = false;
    }
  }

  constructor() {
    document.addEventListener('click', this.closeDropdown.bind(this));
  }
}
