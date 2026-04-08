const fs = require('fs');
const pdfParse = require('pdf-parse');

const dataBuffer = fs.readFileSync('資料/Match Voxsetlist20250118.pdf');
pdfParse(dataBuffer).then(function(data) {
  console.log(data.text);
}).catch(err => {
  console.error(err);
});
