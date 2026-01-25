import * as XLSX from "xlsx";

type ExcelRow = Array<string | number | null | undefined>;

export function downloadExcelFile(
  filename: string,
  headers: ExcelRow,
  rows: ExcelRow[]
) {
  // Create worksheet data with headers
  const wsData = [headers, ...rows];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  // Generate Excel file and download
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
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
