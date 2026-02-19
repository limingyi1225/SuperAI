const fs = require('fs');

async function test() {
  const mod = await import('pdf-parse');
  // Check if we can disable the worker
  const fakePdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<< /Size 1 >>\n%%EOF');
  
  try {
     const options = { disableWorker: true, workerSrc: 'none' }; // Guessing API options
     const parser = new mod.PDFParse(new Uint8Array(fakePdf), options);
     console.log('Parser instantiated with options', parser.options || parser);
  } catch(e) { }
}
test();
