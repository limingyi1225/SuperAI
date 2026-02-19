async function testUpload() {
  const formData = new FormData();
  // Create a 5MB dummy text file
  const fileBlob = new Blob(['A'.repeat(5 * 1024 * 1024)], { type: 'text/plain' });
  formData.append('files', fileBlob, 'large.txt');

  const auth = 'Basic ' + Buffer.from('isaac:0821').toString('base64');

  try {
    const res = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      headers: { 'Authorization': auth },
      body: formData
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text.substring(0, 200));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
testUpload();
