import * as XLSX from "xlsx";

type ExcelRow = Array<string | number | null | undefined>;
type ExcelColWidth = number;

export type ExcelSheet = {
  name: string;
  headers: ExcelRow;
  rows: ExcelRow[];
  colWidths?: ExcelColWidth[];
  merges?: Array<string | XLSX.Range>;
};

function triggerExcelDownload(filename: string, workbook: XLSX.WorkBook) {
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Delay revoke so Safari/Firefox can finish the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadExcelWorkbook(filename: string, sheets: ExcelSheet[]) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((sheet, index) => {
    const wsData = [sheet.headers, ...sheet.rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    if (sheet.colWidths && sheet.colWidths.length > 0) {
      ws["!cols"] = sheet.colWidths.map((width) => ({ wch: width }));
    }
    if (sheet.merges && sheet.merges.length > 0) {
      ws["!merges"] = sheet.merges.map((merge) =>
        typeof merge === "string" ? XLSX.utils.decode_range(merge) : merge
      );
    }
    const safeName = (sheet.name || `Sheet${index + 1}`).slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  });
  triggerExcelDownload(filename, wb);
}

export function downloadExcelFile(
  filename: string,
  headers: ExcelRow,
  rows: ExcelRow[]
) {
  downloadExcelWorkbook(filename, [
    {
      name: "Sheet1",
      headers,
      rows,
    },
  ]);
}
