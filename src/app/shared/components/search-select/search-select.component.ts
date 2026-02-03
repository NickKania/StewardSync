import {
  Component,
  Input,
  forwardRef,
  signal,
  ViewChild,
  ElementRef,
  HostListener,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from "@angular/forms";
import { SelectOption } from "../select/select.component";

@Component({
  selector: "app-search-select",
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchSelectComponent),
      multi: true,
    },
  ],
  template: `
    <div class="w-full relative">
      @if (label) {
        <label
          [for]="id"
          class="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200"
        >
          {{ label }}
          @if (required) {
            <span class="text-red-500 dark:text-red-400">*</span>
          }
        </label>
      }

      <div class="relative">
        <input
          [id]="id"
          [disabled]="disabled"
          [class]="getInputClasses()"
          [(ngModel)]="searchTerm"
          (input)="onInputChange()"
          (focus)="onFocus()"
          (click)="onClick()"
          (blur)="onBlur()"
          (keydown)="onKeyDown($event)"
          [placeholder]="placeholder || 'Search...'"
          #searchInput
        />
        <div
          class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
        >
          <svg
            class="w-5 h-5 text-gray-400 dark:text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            ></path>
          </svg>
        </div>
      </div>

      @if (isOpen()) {
        <div
          class="absolute z-[9999] w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto dark:bg-gray-900 dark:border-gray-700"
          [class.top-full]="dropdownDirection() === 'down'"
          [class.mt-1]="dropdownDirection() === 'down'"
          [class.bottom-full]="dropdownDirection() === 'up'"
          [class.mb-1]="dropdownDirection() === 'up'"
          [style.max-height]="'300px'"
          style="transform: translateZ(0);"
        >
          @if (filteredOptions().length === 0) {
            <div class="px-3 py-2 text-gray-500 dark:text-gray-400">
              No results found
            </div>
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
        <p class="mt-1 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      }
    </div>
  `,
})
export class SearchSelectComponent implements ControlValueAccessor {
  @Input() id = `search-select-${Math.random().toString(36).substr(2, 9)}`;
  @Input() label = "";
  @Input() placeholder = "";
  @Input()
  set options(value: SelectOption[]) {
    this.optionsInternal = value ?? [];
    if (!this.searchTerm && this.value()) {
      this.syncSearchTermWithValue();
    }
  }
  get options(): SelectOption[] {
    return this.optionsInternal;
  }
  @Input() required = false;
  @Input() disabled = false;
  @Input() error = "";

  value = signal("");
  searchTerm = "";
  isOpen = signal(false);
  dropdownDirection = signal<"up" | "down">("down");
  selectedIndex = signal(0);
  private optionsInternal: SelectOption[] = [];
  @ViewChild("searchInput", { static: false })
  searchInput!: ElementRef<HTMLInputElement>;

  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  filteredOptions(): SelectOption[] {
    if (!this.searchTerm) return this.options;

    const term = this.searchTerm.toLowerCase();
    return this.options.filter(
      (option) =>
        option.label.toLowerCase().includes(term) ||
        option.value.toLowerCase().includes(term),
    );
  }

  writeValue(value: string): void {
    this.value.set(value || "");
    const selectedOption = this.options.find(
      (o) => String(o.value) === String(value),
    );
    if (selectedOption) {
      this.searchTerm = selectedOption.label;
    } else {
      this.searchTerm = "";
    }
  }

  private syncSearchTermWithValue(): void {
    const currentValue = this.value();
    if (!currentValue) {
      return;
    }

    const selectedOption = this.options.find(
      (o) => String(o.value) === String(currentValue),
    );
    if (selectedOption) {
      this.searchTerm = selectedOption.label;
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
    this.value.set(option.value);
    this.searchTerm = option.label;
    this.isOpen.set(false);
    this.onChange(option.value);
  }

  onFocus(): void {
    this.updateDropdownDirection();
    this.isOpen.set(true);
  }

  onClick(): void {
    this.searchTerm = "";
    this.updateDropdownDirection();
    this.isOpen.set(true);
    this.selectedIndex.set(0);
  }

  onInputChange(): void {
    this.selectedIndex.set(0);
    if (this.isOpen()) {
      this.updateDropdownDirection();
    }
  }

  onBlur(): void {
    setTimeout(() => {
      this.isOpen.set(false);
      this.onTouched();

      const match = this.options.find((o) => o.label === this.searchTerm);
      if (match) {
        if (String(match.value) !== String(this.value())) {
          this.value.set(match.value);
          this.onChange(match.value);
        }
        this.searchTerm = match.label;
        return;
      }

      if (this.searchTerm) {
        this.searchTerm = "";
        if (!this.value()) {
          this.onChange("");
        } else {
          this.syncSearchTermWithValue();
        }
        return;
      }

      if (this.value()) {
        this.syncSearchTermWithValue();
      } else {
        this.onChange("");
      }
    }, 200);
  }

  onKeyDown(event: KeyboardEvent): void {
    const options = this.filteredOptions();

    switch (event.key) {
      case "Tab":
        // Allow tab navigation without preventing default
        this.isOpen.set(false);
        // Restore the label if there's a value
        if (this.value()) {
          const selectedOption = this.options.find(
            (o) => String(o.value) === String(this.value()),
          );
          if (selectedOption) {
            this.searchTerm = selectedOption.label;
          }
        }
        break;
      case "ArrowDown":
        event.preventDefault();
        this.selectedIndex.set(
          Math.min(this.selectedIndex() + 1, options.length - 1),
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        this.selectedIndex.set(Math.max(this.selectedIndex() - 1, 0));
        break;
      case "Enter":
        event.preventDefault();
        if (options[this.selectedIndex()]) {
          this.selectOption(options[this.selectedIndex()]);
        }
        break;
      case "Escape":
        this.isOpen.set(false);
        // Restore the label of the selected value when closing with escape
        if (this.value() && !this.searchTerm) {
          const selectedOption = this.options.find(
            (o) => String(o.value) === String(this.value()),
          );
          if (selectedOption) {
            this.searchTerm = selectedOption.label;
          }
        }
        break;
    }
  }

  @HostListener("window:resize")
  onWindowResize(): void {
    if (this.isOpen()) {
      this.updateDropdownDirection();
    }
  }

  @HostListener("window:scroll")
  onWindowScroll(): void {
    if (this.isOpen()) {
      this.updateDropdownDirection();
    }
  }

  private updateDropdownDirection(): void {
    if (!this.searchInput?.nativeElement) {
      this.dropdownDirection.set("down");
      return;
    }

    const rect = this.searchInput.nativeElement.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const dropdownHeight = Math.min(
      300,
      Math.max(120, this.filteredOptions().length * 44),
    );
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    const shouldOpenUp =
      spaceBelow < Math.min(dropdownHeight, 240) && spaceAbove > spaceBelow;
    this.dropdownDirection.set(shouldOpenUp ? "up" : "down");
  }

  getInputClasses(): string {
    const base =
      "block w-full px-3 py-2 border rounded-lg shadow-sm bg-white focus:outline-none focus:ring-2 focus:border-primary-500 transition-colors text-gray-900 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700";
    const errorClass = this.error
      ? "border-red-300 focus:ring-red-500 focus:border-red-500 dark:border-red-500/70 dark:focus:ring-red-400 dark:focus:border-red-400"
      : "border-gray-300 focus:ring-primary-500 dark:border-gray-700 dark:focus:ring-primary-400 dark:focus:border-primary-400";
    const disabledClass = this.disabled
      ? "bg-gray-100 cursor-not-allowed dark:bg-gray-800"
      : "";

    return `${base} ${errorClass} ${disabledClass}`;
  }

  getOptionClasses(option: SelectOption): string {
    const isSelected = option.value === this.value();
    const base =
      "px-3 py-2.5 cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-0 whitespace-nowrap dark:hover:bg-gray-800 dark:border-gray-800";
    const selectedClass = isSelected
      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
      : "text-gray-900 dark:text-gray-100";
    const disabledClass = option.disabled
      ? "opacity-50 cursor-not-allowed"
      : "";

    return `${base} ${selectedClass} ${disabledClass}`;
  }
}
