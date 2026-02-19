const auth = 'Basic ' + Buffer.from('isaac:0821').toString('base64');

async function testUpload() {
  const formData = new FormData();
  // PDF
  const pdfBlob = new Blob(['%PDF-1.4...'], { type: 'application/pdf' });
  formData.append('files', pdfBlob, 'test.pdf');

  // Image
  const imgBlob = new Blob(['\xff\xd8\xff...'], { type: 'image/jpeg' });
  formData.append('files', imgBlob, 'test.jpg');

  try {
    const res = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      headers: { 'Authorization': auth },
      body: formData
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response body:', text);
  } catch (e) { console.error(e) }
}
testUpload();
