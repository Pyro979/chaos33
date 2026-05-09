const BASE = import.meta.url.replace(/\/js\/catalog\.js$/, '/');

export async function loadCatalog() {
  const paths = [
    'data/characters.json',
    'data/road.json',
    'data/starting.json',
    'data/finds.json',
    'data/luck.json',
    'data/misery.json'
  ];
  const urls = paths.map((p) => new URL(p, BASE).href);
  const [characters, road, starting, finds, luck, misery] = await Promise.all(
    urls.map((u) => fetch(u).then((r) => r.json()))
  );

  const byId = (arr) =>
    arr.reduce((o, x) => {
      o[x.id] = x;
      return o;
    }, {});

  return {
    characters,
    charactersById: byId(characters),
    road,
    roadById: byId(road),
    starting,
    startingById: byId(starting),
    finds,
    findsById: byId(finds),
    luck,
    luckById: byId(luck),
    misery,
    miseryById: byId(misery)
  };
}
