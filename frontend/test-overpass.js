(async () => {
  const bbox = '18.9400,72.8200,18.9500,72.8300';
  const query = `[out:json][timeout:10];
    (
      nwr["amenity"="restaurant"](${bbox});
      nwr["amenity"="cafe"](${bbox});
      nwr["tourism"="hotel"](${bbox});
    );
    out center;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'User-Agent': 'SoboiteApp/1.0' },
    body: query
  });
  const data = await res.json();
  console.log('Results:', data.elements.length);
  if (data.elements.length > 0) {
    console.log(data.elements[0]);
  }
})();
