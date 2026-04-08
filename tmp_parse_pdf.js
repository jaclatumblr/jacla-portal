const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function extractTextPositions(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    
    console.log(`--- Page ${i} (Width: ${viewport.width}, Height: ${viewport.height}) ---`);
    for (const item of textContent.items) {
      if (item.str.trim() === '') continue;
      // Coordinates in pdfjs: item.transform[4] (x), item.transform[5] (y from bottom)
      const x = item.transform[4].toFixed(2);
      const y = item.transform[5].toFixed(2);
      console.log(`Text: "${item.str}" | X: ${x}, Y: ${y}, size: ${Math.abs(item.transform[0]).toFixed(1)}`);
    }
  }
}

extractTextPositions('資料/例.pdf').catch(console.error);
