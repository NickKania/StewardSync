import { Pipe, PipeTransform } from '@angular/core';
import { format, formatDistanceToNow, isValid } from 'date-fns';

@Pipe({
  name: 'dateFormat',
  standalone: true
})
export class DateFormatPipe implements PipeTransform {
  transform(
    value: number | Date | null | undefined,
    formatString: string = 'PPp'
  ): string {
    if (!value) return '';

    const date = typeof value === 'number' ? new Date(value) : value;

    if (!isValid(date)) return '';

    return format(date, formatString);
  }
}

@Pipe({
  name: 'timeAgo',
  standalone: true
})
export class TimeAgoPipe implements PipeTransform {
  transform(value: number | Date | null | undefined): string {
    if (!value) return '';

    const date = typeof value === 'number' ? new Date(value) : value;

    if (!isValid(date)) return '';

    return formatDistanceToNow(date, { addSuffix: true });
  }
}
