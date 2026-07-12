export async function loadGoogleFont(family: string, text: string): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(cssUrl)).text();
  const match = css.match(/src: url\(([^)]+)\) format\('(opentype|truetype)'\)/);
  if (!match) throw new Error(`Could not find font source for ${family}`);

  const res = await fetch(match[1]);
  if (!res.ok) throw new Error(`Failed to fetch font data for ${family}`);
  return res.arrayBuffer();
}
