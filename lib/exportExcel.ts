type ExcelCell = string | number | boolean | Date | null | undefined;
type ExcelRow = ExcelCell[];
type ExcelColWidth = number;
type ExcelRange = string | { s: { r: number; c: number }; e: { r: number; c: number } };

export type ExcelSheet = {
  name: string;
  headers: ExcelRow;
  rows: ExcelRow[];
  colWidths?: ExcelColWidth[];
  merges?: ExcelRange[];
  filterable?: boolean;
};

function triggerExcelDownload(filename: string, buffer: ArrayBuffer) {
  const blob = new Blob([buffer], {
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

type ExcelJsWorksheet = import("exceljs").Worksheet;

function mergeCells(worksheet: ExcelJsWorksheet, range: ExcelRange) {
  if (typeof range === "string") {
    worksheet.mergeCells(range);
    return;
  }

  worksheet.mergeCells(range.s.r + 1, range.s.c + 1, range.e.r + 1, range.e.c + 1);
}

export async function downloadExcelWorkbook(filename: string, sheets: ExcelSheet[]) {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();

  sheets.forEach((sheet, index) => {
    const safeName = (sheet.name || `Sheet${index + 1}`).slice(0, 31);
    const worksheet = workbook.addWorksheet(safeName);
    worksheet.addRow(sheet.headers);
    sheet.rows.forEach((row) => worksheet.addRow(row));

    if (sheet.filterable && sheet.headers.length > 0) {
      worksheet.views = [{ state: "frozen", ySplit: 1 }];
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: sheet.rows.length + 1, column: sheet.headers.length },
      };
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).height = 24;
      worksheet.eachRow((row) => {
        row.alignment = { vertical: "top", wrapText: true };
      });
    }

    if (sheet.colWidths && sheet.colWidths.length > 0) {
      sheet.colWidths.forEach((width, colIndex) => {
        worksheet.getColumn(colIndex + 1).width = width;
      });
    }

    if (sheet.merges && sheet.merges.length > 0) {
      sheet.merges.forEach((merge) => {
        mergeCells(worksheet, merge);
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  triggerExcelDownload(filename, buffer as ArrayBuffer);
}

export async function downloadExcelFile(
  filename: string,
  headers: ExcelRow,
  rows: ExcelRow[]
) {
  await downloadExcelWorkbook(filename, [
    {
      name: "Sheet1",
      headers,
      rows,
    },
  ]);
}
