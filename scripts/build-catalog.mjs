import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDirectory = path.join(root, 'backend/AnimeTracker.Api/Data');
const input = path.resolve(root, process.argv.find(arg => arg.startsWith('--input='))?.slice(8) ?? '.tools/anime-offline-database.json');
const releaseUrl = 'https://github.com/manami-project/anime-offline-database/releases/download/2026-27/anime-offline-database-minified.json';
if (process.argv.includes('--download')) {
  await mkdir(path.dirname(input), { recursive: true });
  const response = await fetch(releaseUrl);
  if (!response.ok) throw new Error(`Dataset download failed: HTTP ${response.status}`);
  await writeFile(input, Buffer.from(await response.arrayBuffer()));
}
const raw = await readFile(input);
const source = JSON.parse(raw.toString('utf8'));
if (!Array.isArray(source.data) || source.lastUpdate !== '2026-07-04') throw new Error('Expected the pinned 2026-27 dataset release.');
const editorial = JSON.parse(await readFile(path.join(dataDirectory, 'catalog-editorial.json'), 'utf8'));
const overrides = new Map(editorial.map((anime, index) => [anime.id, { ...anime, featuredOrder: index + 1 }]));
const excluded = new Set(['hentai', 'erotica', 'pornography', 'borderline porn', 'adult audience only']);
const genres = new Map([
  ['action', 'Action'], ['adventure', 'Adventure'], ['comedy', 'Comedy'], ['drama', 'Drama'], ['fantasy', 'Fantasy'],
  ['horror', 'Horror'], ['mystery', 'Mystery'], ['romance', 'Romance'], ['sci-fi', 'Sci-Fi'], ['science fiction', 'Sci-Fi'],
  ['slice of life', 'Slice of Life'], ['sports', 'Sports'], ['supernatural', 'Supernatural'], ['suspense', 'Suspense'],
  ['music', 'Music'], ['historical', 'Historical'], ['mecha', 'Mecha'], ['psychological', 'Psychological'], ['gourmet', 'Gourmet'],
]);
const formats = { TV: 'TV', MOVIE: 'Movie', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'Special' };
const catalog = new Map();
for (const row of source.data) {
  if (!formats[row.type]) continue;
  const link = row.sources.find(url => /^https:\/\/myanimelist\.net\/anime\/\d+$/.test(url));
  if (!link) continue;
  const id = Number(link.split('/').at(-1));
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) continue;
  const override = overrides.get(id);
  // A small reviewed editorial list overrides noisy content-theme tags (e.g. Hunter x Hunter).
  if (!override && row.tags.some(tag => excluded.has(tag))) continue;
  const score = row.status === 'UPCOMING' ? 0 : row.score?.arithmeticGeometricMean ?? 0;
  const title = override?.title ?? row.title;
  catalog.set(id, {
    id, title, originalTitle: row.title,
    alternativeTitles: Array.from([...new Set([row.title, title, ...row.synonyms])].join('|')).slice(0, 10000).join(''),
    synopsis: override?.synopsis ?? '',
    posterUrl: /^https:\/\//.test(row.picture) ? row.picture : '',
    genres: [...new Set(row.tags.flatMap(tag => genres.has(tag) ? [genres.get(tag)] : []))].join('|'),
    studio: override?.studio ?? row.studios.map(name => name.replace(/\b\p{L}/gu, letter => letter.toUpperCase())).join(' / '),
    format: formats[row.type], year: row.animeSeason?.year ?? 0,
    episodes: Math.max(0, row.episodes ?? 0),
    episodeMinutes: row.duration?.value > 0 ? Math.max(1, Math.round(row.duration.value / 60)) : 0,
    communityScore: Number.isFinite(score) ? Math.round(score * 100) / 100 : 0,
    airing: row.status === 'ONGOING', sourceUrl: link,
    featuredOrder: override?.featuredOrder ?? 0,
  });
}
const serialized = `${JSON.stringify([...catalog.values()].sort((a, b) => a.id - b.id))}\n`;
const snapshot = {
  version: createHash('sha256').update(serialized).digest('hex'),
  sourceName: 'anime-offline-database', sourceUrl: source.repository,
  releaseUrl, lastUpdated: source.lastUpdate, titleCount: catalog.size,
  sourceSha256: createHash('sha256').update(raw).digest('hex'),
  licenseName: source.license.name, licenseUrl: source.license.url,
};
await writeFile(path.join(dataDirectory, 'catalog.json'), serialized);
await writeFile(path.join(dataDirectory, 'catalog-info.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(JSON.stringify({ titles: catalog.size, dataDate: snapshot.lastUpdated, bytes: Buffer.byteLength(serialized), missingEditorial: editorial.filter(a => !catalog.has(a.id)).map(a => a.title) }));
