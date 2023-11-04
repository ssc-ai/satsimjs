async function fetchTle(url, linesPerSatellite, callback) {
  const response = await fetch(url);
  const text = await response.text();

  const lines = text.split('\n');
  const count = lines.length - 1;

  for(let i = 0; i < count; i+=linesPerSatellite) {
    let line1, line2, line3 = '';
    if(linesPerSatellite === 2) {
      line1 = lines[i].slice(2, 8);
      line2 = lines[i];
      line3 = lines[i+1];
    } else {
      line1 = lines[i].trim();
      line2 = lines[i+1];
      line3 = lines[i+2];
    }

    callback(line1, line2, line3)
  }  
}

export {
  fetchTle
}