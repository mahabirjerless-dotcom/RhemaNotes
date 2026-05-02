async function test() {
  const targetUrl = 'https://www.youtube.com/watch?v=0C_soDevTKY';
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
  const res = await fetch(proxyUrl);
  const text = await res.text();
  console.log("Length:", text.length);
  console.log("Has captionTracks:", text.includes('captionTracks'));
}
test();
