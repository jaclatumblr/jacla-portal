import fs from "fs";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { defaultVoxSetlistLayout } from "../lib/voxSetlistLayout";

async function run() {
  const templateBuffer = fs.readFileSync(path.join(process.cwd(), "資料/Match Voxsetlist20250118.pdf"));
  const templateDoc = await PDFDocument.load(templateBuffer);
  const outputDoc = await PDFDocument.create();
  outputDoc.registerFontkit(fontkit);

  const fontBytes = fs.readFileSync("C:/Windows/Fonts/MSGOTHIC.TTC");
  const font = await outputDoc.embedFont(fontBytes, { subset: false });

  const templateBasePage = templateDoc.getPage(0);
  const { width, height } = templateBasePage.getSize();
  const embeddedTemplatePage = await outputDoc.embedPage(templateBasePage);

  const page = outputDoc.addPage([width, height]);
  page.drawPage(embeddedTemplatePage, { x: 0, y: 0, width, height });

  const l = defaultVoxSetlistLayout;

  // Render dummy data to all field positions listed in the layout
  const drawOptions = { size: 10, font, color: rgb(1, 0, 0) };

  const draw = (field: any, text: string) => {
    let drawX = field.x;
    font.encodeText(text);
    const textWidth = font.widthOfTextAtSize(text, field.size ?? 10);
    if (field.align === "center") drawX = field.x + (field.maxWidth - textWidth) / 2;
    if (field.align === "right") drawX = field.x + field.maxWidth - textWidth;
    page.drawText(text, { x: drawX, y: field.y, size: field.size ?? 10, font, color: rgb(1, 0, 0) });
    // draw bounding box
    page.drawRectangle({ x: field.x, y: field.y, width: field.maxWidth, height: field.size ?? 10, borderColor: rgb(0,0,1), borderWidth: 0.5 });
  };

  draw(l.fields.eventName, "Dummy Event Name");
  draw(l.fields.eventDate, "2026/03/17");
  draw(l.fields.bandName, "Dummy Band");
  draw(l.fields.pageLabel, "1/3");
  draw(l.fields.setOrder, "1");
  draw(l.fields.totalDuration, "15:00");
  draw(l.fields.plannedStartTime, "19:00");
  
  draw(l.notes.lighting, "照明要望ダミー");
  draw(l.notes.pa, "PA要望ダミー");
  draw(l.notes.stageSummary, "セット図ダミー");

  fs.writeFileSync("test-output.pdf", await outputDoc.save());
  console.log("Created test-output.pdf");
}

run().catch(console.error);
