type ExcelRow = Array<string | number | null | undefined>;

const escapeCell = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");

export function downloadExcelFile(
  filename: string,
  headers: ExcelRow,
  rows: ExcelRow[]
) {
  const toRow = (row: ExcelRow) =>
    `<tr>${row
      .map((cell) => `<td>${escapeCell(String(cell ?? ""))}</td>`)
      .join("")}</tr>`;

  const table = `<table><thead>${toRow(headers)}</thead><tbody>${rows
    .map(toRow)
    .join("")}</tbody></table>`;
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body>${table}</body></html>`;
  const blob = new Blob(["\ufeff", html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
