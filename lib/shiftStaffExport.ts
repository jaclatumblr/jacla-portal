export type ShiftStaffExportDepartment = "pa" | "lighting";

export type ShiftStaffExportStaff = {
  name: string;
  enrollmentYear?: number | null;
};

export type ShiftStaffExportItem = {
  bandName: string;
  staffCells: Array<{
    label: string;
    staff: ShiftStaffExportStaff[];
  }>;
};

const departmentLabel = (department: ShiftStaffExportDepartment) =>
  department === "pa" ? "PA" : "照明";

const sanitizeFilenamePart = (value: string) =>
  value.replace(/[\\/:*?"<>|]/g, "_").trim();

const yearPalette = [
  "FFFFE4E6",
  "FFFFEDD5",
  "FFFEF3C7",
  "FFDCFCE7",
  "FFDFF6FF",
  "FFE0E7FF",
  "FFF3E8FF",
  "FFFCE7F3",
];

const palette = {
  titleBg: "FF1F2937",
  titleFg: "FFFFFFFF",
  headerBg: "FFE5E7EB",
  headerFg: "FF111827",
  bandBg: "FFF9FAFB",
  unknownBg: "FFF3F4F6",
  mixedBg: "FFE5E7EB",
  border: "FFD1D5DB",
  text: "FF111827",
};

const uniqueStaff = (staff: ShiftStaffExportStaff[]) => {
  const seen = new Set<string>();
  return staff
    .map((entry) => ({
      name: entry.name.trim(),
      enrollmentYear: entry.enrollmentYear ?? null,
    }))
    .filter((entry) => entry.name.length > 0 && entry.name !== "未割当")
    .filter((entry) => {
      const key = `${entry.name}:${entry.enrollmentYear ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const triggerExcelDownload = (filename: string, buffer: ArrayBuffer) => {
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export async function downloadShiftStaffExcel({
  department,
  eventName,
  eventDate,
  items,
}: {
  department: ShiftStaffExportDepartment;
  eventName?: string | null;
  eventDate?: string | null;
  items: ShiftStaffExportItem[];
}) {
  const { Workbook } = await import("exceljs");
  const label = departmentLabel(department);
  const roleHeaders = items[0]?.staffCells.map((cell) => cell.label) ?? [];
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(`${label}シフト`);
  const years = Array.from(
    new Set(
      items.flatMap((item) =>
        item.staffCells.flatMap((cell) =>
          cell.staff
            .map((staff) => staff.enrollmentYear)
            .filter((year): year is number => typeof year === "number")
        )
      )
    )
  ).sort((a, b) => a - b);
  const colorByYear = new Map(
    years.map((year, index) => [year, yearPalette[index % yearPalette.length]] as const)
  );
  const filenameBase = sanitizeFilenamePart(
    `${eventName?.trim() || "event"}_${label}シフト_${eventDate?.slice(0, 10) || "export"}`
  );
  const columnCount = roleHeaders.length + 1;
  const titleRow = sheet.addRow([`${eventName?.trim() || "Event"} ${label}シフト`]);
  sheet.mergeCells(1, 1, 1, columnCount);
  titleRow.height = 28;
  titleRow.eachCell((cell) => {
    cell.font = { bold: true, size: 14, color: { argb: palette.titleFg } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.titleBg } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  const headerRow = sheet.addRow(["バンド名", ...roleHeaders]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: palette.headerFg } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.headerBg } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: palette.border } },
      left: { style: "thin", color: { argb: palette.border } },
      bottom: { style: "thin", color: { argb: palette.border } },
      right: { style: "thin", color: { argb: palette.border } },
    };
  });

  items.forEach((item) => {
    const row = sheet.addRow([
      item.bandName,
      ...item.staffCells.map((cell) => {
        const staff = uniqueStaff(cell.staff);
        return staff.length > 0 ? staff.map((entry) => entry.name).join(" / ") : "未割当";
      }),
    ]);
    row.eachCell((cell, col) => {
      const staff = col > 1 ? uniqueStaff(item.staffCells[col - 2]?.staff ?? []) : [];
      const yearsInCell = Array.from(
        new Set(staff.map((entry) => entry.enrollmentYear).filter((year): year is number => typeof year === "number"))
      );
      const fillColor =
        col === 1
          ? palette.bandBg
          : yearsInCell.length === 1
            ? colorByYear.get(yearsInCell[0]) ?? palette.unknownBg
            : yearsInCell.length > 1
              ? palette.mixedBg
              : palette.unknownBg;

      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
      cell.font = { color: { argb: palette.text }, bold: col === 1 };
      cell.alignment = {
        horizontal: col === 1 ? "left" : "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin", color: { argb: palette.border } },
        left: { style: "thin", color: { argb: palette.border } },
        bottom: { style: "thin", color: { argb: palette.border } },
        right: { style: "thin", color: { argb: palette.border } },
      };
    });
  });

  sheet.columns = [{ width: 28 }, ...roleHeaders.map(() => ({ width: 20 }))];
  sheet.views = [{ state: "frozen", ySplit: 2 }];

  if (years.length > 0) {
    sheet.addRow([]);
    const legendTitleRow = sheet.addRow(["入学年度"]);
    legendTitleRow.getCell(1).font = { bold: true };
    years.forEach((year) => {
      const row = sheet.addRow([`${year}年度`]);
      row.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: colorByYear.get(year) ?? palette.unknownBg },
      };
      row.getCell(1).border = {
        top: { style: "thin", color: { argb: palette.border } },
        left: { style: "thin", color: { argb: palette.border } },
        bottom: { style: "thin", color: { argb: palette.border } },
        right: { style: "thin", color: { argb: palette.border } },
      };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerExcelDownload(`${filenameBase || `${label}シフト`}.xlsx`, buffer);
}
