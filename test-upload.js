async function testUpload() {
  const formData = new FormData();
  // Create a dummy text file
  const fileBlob = new Blob(['Hello World text'], { type: 'text/plain' });
  formData.append('files', fileBlob, 'test.txt');

  const auth = 'Basic ' + Buffer.from('isaac:0821').toString('base64');

  try {
    const res = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      headers: { 'Authorization': auth },
      body: formData
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
testUpload();
