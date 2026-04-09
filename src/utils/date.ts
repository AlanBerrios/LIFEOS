export function toDate(value: string | Date | null | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value : new Date(value);
}

export function toDateRequired(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function getTodayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
