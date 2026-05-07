type DatedItem = {
  date: string;
};

type FiscalYearGroup<T> = {
  fiscalYear: number;
  label: string;
  items: T[];
};

const FISCAL_YEAR_START_MONTH = 4;

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function compareDateDesc(left: string, right: string) {
  const leftDate = parseDateOnly(left);
  const rightDate = parseDateOnly(right);

  if (!leftDate && !rightDate) return right.localeCompare(left);
  if (!leftDate) return 1;
  if (!rightDate) return -1;

  return rightDate.getTime() - leftDate.getTime();
}

export function getFiscalYear(value: string) {
  const parsed = parseDateOnly(value);
  if (!parsed) return 0;

  const year = parsed.getFullYear();
  const month = parsed.getMonth() + 1;
  return month >= FISCAL_YEAR_START_MONTH ? year : year - 1;
}

export function groupItemsByFiscalYear<T extends DatedItem>(items: T[]): FiscalYearGroup<T>[] {
  const groups = new Map<number, T[]>();

  items
    .slice()
    .sort((left, right) => compareDateDesc(left.date, right.date))
    .forEach((item) => {
      const fiscalYear = getFiscalYear(item.date);
      const existing = groups.get(fiscalYear) ?? [];
      existing.push(item);
      groups.set(fiscalYear, existing);
    });

  return Array.from(groups.entries())
    .sort(([leftYear], [rightYear]) => rightYear - leftYear)
    .map(([fiscalYear, groupedItems]) => ({
      fiscalYear,
      label: fiscalYear > 0 ? `${fiscalYear}年度` : "年度未設定",
      items: groupedItems,
    }));
}
