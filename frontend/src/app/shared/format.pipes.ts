import { Pipe, PipeTransform } from '@angular/core';
import { CURRENCY } from '../core/labels';

const money = new Intl.NumberFormat('fr-MA', { style: 'currency', currency: CURRENCY, maximumFractionDigits: 2 });
const moneyCompact = new Intl.NumberFormat('fr-MA', { style: 'currency', currency: CURRENCY, notation: 'compact', maximumFractionDigits: 1 });
const num = new Intl.NumberFormat('fr-FR');
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined, compact = false): string {
    if (value === null || value === undefined) return '—';
    return (compact ? moneyCompact : money).format(value);
  }
}

@Pipe({ name: 'num', standalone: true })
export class NumPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : num.format(value);
  }
}

@Pipe({ name: 'frDate', standalone: true })
export class FrDatePipe implements PipeTransform {
  transform(value: string | null | undefined, withTime = false): string {
    if (!value) return '—';
    return (withTime ? dateTimeFmt : dateFmt).format(new Date(value));
  }
}

/** "il y a 5 min", "il y a 2 j"... */
@Pipe({ name: 'ago', standalone: true })
export class AgoPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '—';
    const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
    if (seconds < 60) return 'à l\'instant';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.round(hours / 24);
    return days < 30 ? `il y a ${days} j` : dateFmt.format(new Date(value));
  }
}
