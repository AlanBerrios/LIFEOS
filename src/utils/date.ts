export function toDate(value: string | Date | null | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value : new Date(value);
}

export function toDateRequired(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}
