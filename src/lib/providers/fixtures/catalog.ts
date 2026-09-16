/**
 * Sample catalogue.
 *
 * Real titles, invented everything else. Statuses, availability, popularity
 * and release timing here are made up so the site has something substantial
 * to render before TMDB credentials exist. Nothing in this file should be
 * read as a claim about a real release schedule.
 *
 * Dates are computed relative to now, so the demo never goes stale.
 */
import type { SourceEpisode, SourceProvider, SourceTitle, TitleDetail } from '../types'

export const FIXTURE_REGION = 'US'

/**
 * TMDB watch-provider ids. The real directory replaces these wholesale on
 * the first live sync, so a wrong id here is self-correcting.
 */
export const FIXTURE_PROVIDERS: SourceProvider[] = [
  { providerId: 8, name: 'Netflix', logoPath: null, displayPriority: 0 },
  { providerId: 1899, name: 'Max', logoPath: null, displayPriority: 1 },
  { providerId: 15, name: 'Hulu', logoPath: null, displayPriority: 2 },
  { providerId: 337, name: 'Disney+', logoPath: null, displayPriority: 3 },
  { providerId: 9, name: 'Prime Video', logoPath: null, displayPriority: 4 },
  { providerId: 350, name: 'Apple TV+', logoPath: null, displayPriority: 5 },
  { providerId: 386, name: 'Peacock', logoPath: null, displayPriority: 6 },
  { providerId: 531, name: 'Paramount+', logoPath: null, displayPriority: 7 },
]

const PROVIDER_IDS = FIXTURE_PROVIDERS.map((p) => p.providerId)
const DAY = 86_400_000

function at(daysFromNow: number, hour = 0): Date {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  return new Date(d.getTime() + daysFromNow * DAY)
}

function nextWeekday(day: number, hour = 0): Date {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  let delta = (day - d.getDay() + 7) % 7
  if (delta === 0) delta = 7
  d.setDate(d.getDate() + delta)
  return d
}

const iso = (d: Date) => d.toISOString()
const dateOnly = (d: Date) => d.toISOString().slice(0, 10)

/** Stable pseudo-random from the title id, so the demo is reproducible. */
function seeded(n: number, salt = 1): number {
  const x = Math.sin(n * 12.9898 * salt) * 43758.5453
  return x - Math.floor(x)
}

export type FixtureEntry = {
  title: SourceTitle
  seasons?: Array<{ seasonNumber: number; airDate: Date | null; episodeCount: number }>
  episodes?: SourceEpisode[]
  offers?: Array<{ providerId: number; kind: 'FLATRATE' | 'RENT' | 'BUY' | 'ADS' | 'FREE' }>
  collectionEntries?: SourceTitle[]
}

/**
 * Compact table: [tmdbId, name, year, genres, popularity, status?]
 * Status defaults to Released for film and Returning Series for television.
 */
type Row = [number, string, number, string[], number, string?]

const FILMS: Row[] = [
  [693134, 'Dune: Part Two', 2024, ['Science Fiction', 'Adventure'], 420],
  [438631, 'Dune', 2021, ['Science Fiction', 'Adventure'], 330],
  [335984, 'Blade Runner 2049', 2017, ['Science Fiction', 'Drama'], 260],
  [329865, 'Arrival', 2016, ['Science Fiction', 'Drama', 'Mystery'], 245],
  [872585, 'Oppenheimer', 2023, ['Drama', 'History'], 385],
  [792307, 'Poor Things', 2023, ['Comedy', 'Drama', 'Science Fiction'], 288],
  [545611, 'Everything Everywhere All at Once', 2022, ['Science Fiction', 'Comedy', 'Adventure'], 302],
  [496243, 'Parasite', 2019, ['Thriller', 'Drama', 'Comedy'], 275],
  [419430, 'Get Out', 2017, ['Horror', 'Thriller', 'Mystery'], 231],
  [493922, 'Hereditary', 2018, ['Horror', 'Drama', 'Mystery'], 214],
  [530385, 'Midsommar', 2019, ['Horror', 'Drama', 'Mystery'], 208],
  [414906, 'The Batman', 2022, ['Crime', 'Mystery', 'Action'], 316],
  [361743, 'Top Gun: Maverick', 2022, ['Action', 'Drama'], 340],
  [346698, 'Barbie', 2023, ['Comedy', 'Adventure'], 368],
  [466420, 'Killers of the Flower Moon', 2023, ['Crime', 'Drama', 'History'], 252],
  [666277, 'Past Lives', 2023, ['Romance', 'Drama'], 186],
  [840430, 'The Holdovers', 2023, ['Comedy', 'Drama'], 195],
  [915935, 'Anatomy of a Fall', 2023, ['Thriller', 'Drama', 'Mystery'], 190],
  [1233413, 'Sinners', 2025, ['Horror', 'Thriller'], 410],
  [426063, 'Nosferatu', 2024, ['Horror', 'Drama'], 298],
  [933260, 'The Substance', 2024, ['Horror', 'Science Fiction'], 322],
  [937287, 'Challengers', 2024, ['Drama', 'Romance'], 244],
  [929590, 'Civil War', 2024, ['Action', 'Drama', 'Thriller'], 256],
  [786892, 'Furiosa', 2024, ['Action', 'Adventure', 'Science Fiction'], 284],
  [402431, 'Wicked', 2024, ['Musical', 'Fantasy'], 356],
  [974576, 'Conclave', 2024, ['Thriller', 'Drama', 'Mystery'], 236],
  [1064213, 'Anora', 2024, ['Comedy', 'Drama', 'Romance'], 262],
  [549509, 'The Brutalist', 2024, ['Drama', 'History'], 228],
  [1064486, 'Nickel Boys', 2024, ['Drama', 'History'], 172],
  [696506, 'Mickey 17', 2025, ['Science Fiction', 'Comedy'], 344],
  [157336, 'Interstellar', 2014, ['Science Fiction', 'Adventure', 'Drama'], 312],
  [27205, 'Inception', 2010, ['Science Fiction', 'Action', 'Thriller'], 305],
  [76341, 'Mad Max: Fury Road', 2015, ['Action', 'Adventure', 'Science Fiction'], 268],
  [37799, 'The Social Network', 2010, ['Drama', 'History'], 182],
  [244786, 'Whiplash', 2014, ['Drama', 'Musical'], 226],
  [313369, 'La La Land', 2016, ['Musical', 'Romance', 'Drama'], 240],
  [376867, 'Moonlight', 2016, ['Drama', 'Romance'], 168],
  [324857, 'Spider-Man: Into the Spider-Verse', 2018, ['Animation', 'Action', 'Adventure'], 290],
  [569094, 'Spider-Man: Across the Spider-Verse', 2023, ['Animation', 'Action', 'Adventure'], 348],
  [546554, 'Knives Out', 2019, ['Mystery', 'Comedy', 'Crime'], 254],
  [661374, 'Glass Onion', 2022, ['Mystery', 'Comedy', 'Crime'], 248],
  [603692, 'John Wick: Chapter 4', 2023, ['Action', 'Thriller', 'Crime'], 326],
  [447365, 'Guardians of the Galaxy Vol. 3', 2023, ['Science Fiction', 'Adventure', 'Comedy'], 300],
  [940721, 'Godzilla Minus One', 2023, ['Science Fiction', 'Action', 'Drama'], 270],
  [467244, 'The Zone of Interest', 2023, ['Drama', 'History'], 164],
  [800158, 'Aftersun', 2022, ['Drama'], 142],
  [674324, 'The Banshees of Inisherin', 2022, ['Comedy', 'Drama'], 196],
  [817758, 'Tar', 2022, ['Drama', 'Musical'], 158],
  [762504, 'Nope', 2022, ['Horror', 'Science Fiction', 'Mystery'], 232],
  [766507, 'Prey', 2022, ['Science Fiction', 'Action', 'Thriller'], 218],
  [579974, 'RRR', 2022, ['Action', 'Drama'], 222],
  [705996, 'Decision to Leave', 2022, ['Romance', 'Mystery', 'Thriller'], 154],
]

const SHOWS: Row[] = [
  [95396, 'Severance', 2022, ['Science Fiction', 'Thriller', 'Drama'], 430],
  [136315, 'The Bear', 2022, ['Comedy', 'Drama'], 372],
  [1535, 'Succession', 2018, ['Drama'], 254, 'Ended'],
  [83867, 'Andor', 2022, ['Science Fiction', 'Adventure', 'Drama'], 310, 'Ended'],
  [100088, 'The Last of Us', 2023, ['Drama', 'Horror', 'Science Fiction'], 396],
  [94997, 'House of the Dragon', 2022, ['Fantasy', 'Drama', 'Action'], 358],
  [127532, 'Shogun', 2024, ['Drama', 'History', 'Action'], 318],
  [106379, 'Fallout', 2024, ['Science Fiction', 'Adventure', 'Comedy'], 362],
  [125988, 'Silo', 2023, ['Science Fiction', 'Drama', 'Mystery'], 286],
  [93740, 'Foundation', 2021, ['Science Fiction', 'Drama'], 242],
  [94605, 'Arcane', 2021, ['Animation', 'Fantasy', 'Action'], 298, 'Ended'],
  [119051, 'Wednesday', 2022, ['Comedy', 'Fantasy', 'Mystery'], 330],
  [66732, 'Stranger Things', 2016, ['Science Fiction', 'Horror', 'Drama'], 388],
  [76479, 'The Boys', 2019, ['Action', 'Science Fiction', 'Comedy'], 344],
  [60059, 'Better Call Saul', 2015, ['Crime', 'Drama'], 260, 'Ended'],
  [1438, 'Barry', 2018, ['Comedy', 'Crime', 'Drama'], 188, 'Ended'],
  [97546, 'Ted Lasso', 2020, ['Comedy', 'Drama'], 276],
  [111803, 'The White Lotus', 2021, ['Comedy', 'Drama', 'Mystery'], 340],
  [117488, 'Yellowjackets', 2021, ['Drama', 'Horror', 'Mystery'], 224],
  [70523, 'Dark', 2017, ['Science Fiction', 'Mystery', 'Drama'], 232, 'Ended'],
  [87108, 'Chernobyl', 2019, ['Drama', 'History'], 206, 'Ended'],
  [1396, 'Breaking Bad', 2008, ['Crime', 'Drama', 'Thriller'], 284, 'Ended'],
  [1438000, 'The Wire', 2002, ['Crime', 'Drama'], 178, 'Ended'],
  [62560, 'Mr. Robot', 2015, ['Drama', 'Crime', 'Thriller'], 196, 'Ended'],
  [63247, 'Westworld', 2016, ['Science Fiction', 'Drama', 'Mystery'], 214, 'Ended'],
  [63639, 'The Expanse', 2015, ['Science Fiction', 'Drama'], 208, 'Ended'],
  [60574, 'Peaky Blinders', 2013, ['Crime', 'Drama'], 248, 'Ended'],
  [67070, 'Fleabag', 2016, ['Comedy', 'Drama'], 166, 'Ended'],
  [72750, 'Killing Eve', 2018, ['Drama', 'Thriller', 'Crime'], 172, 'Ended'],
  [107113, 'Only Murders in the Building', 2021, ['Comedy', 'Mystery', 'Crime'], 288],
  [194764, 'The Penguin', 2024, ['Crime', 'Drama'], 334],
  [114410, 'Ripley', 2024, ['Drama', 'Thriller', 'Crime'], 216],
  [235135, 'Baby Reindeer', 2024, ['Drama', 'Comedy'], 252],
  [108545, '3 Body Problem', 2024, ['Science Fiction', 'Drama', 'Mystery'], 294],
  [117489, 'Slow Horses', 2022, ['Drama', 'Thriller'], 238],
  [202250, 'Hijack', 2023, ['Thriller', 'Drama'], 182],
  [84958, 'Loki', 2021, ['Science Fiction', 'Adventure', 'Fantasy'], 292],
  [82856, 'The Mandalorian', 2019, ['Science Fiction', 'Adventure', 'Action'], 306],
  [93405, 'Squid Game', 2021, ['Thriller', 'Drama', 'Action'], 366],
  [71446, 'Money Heist', 2017, ['Crime', 'Drama', 'Thriller'], 230, 'Ended'],
  [98358, 'Dune: Prophecy', 2024, ['Science Fiction', 'Drama'], 268],
]

/**
 * Announced but unreleased. Real projects, invented dates and status — these
 * exist so the "upcoming" and "not streaming anywhere yet" rows have real
 * content, and so the streaming-debut alert has something to wait on.
 */
const UPCOMING: Array<[number, string, string[], number, number]> = [
  // [tmdbId, name, genres, popularity, days from now until release]
  [1155089, 'Dune: Part Three', ['Science Fiction', 'Adventure'], 412, 300],
  [83533, 'Avatar: Fire and Ash', ['Science Fiction', 'Adventure', 'Action'], 468, 92],
  [1272827, 'The Odyssey', ['Adventure', 'Drama', 'Fantasy'], 402, 220],
  [1087192, 'Shrek 5', ['Animation', 'Comedy', 'Family'], 318, 420],
  [617126, 'Avengers: Doomsday', ['Action', 'Science Fiction', 'Adventure'], 452, 175],
  [1035259, 'Supergirl', ['Action', 'Science Fiction', 'Adventure'], 286, 260],
  [1125510, 'The Mandalorian and Grogu', ['Science Fiction', 'Adventure', 'Action'], 344, 140],
  [1274939, 'Project Hail Mary', ['Science Fiction', 'Drama', 'Adventure'], 376, 48],
]


/**
 * A wider film pool, so taste calibration has enough to work with and the
 * selection algorithm has real variety to explore. In production this is the
 * whole TMDB catalogue; here it is enough breadth to exercise the scoring.
 */
const MORE_FILMS: Row[] = [
  [155, 'The Dark Knight', 2008, ['Action', 'Crime', 'Drama'], 296],
  [680, 'Pulp Fiction', 1994, ['Crime', 'Thriller'], 264],
  [550, 'Fight Club', 1999, ['Drama', 'Thriller'], 258],
  [13, 'Forrest Gump', 1994, ['Drama', 'Romance', 'Comedy'], 246],
  [278, 'The Shawshank Redemption', 1994, ['Drama', 'Crime'], 288],
  [238, 'The Godfather', 1972, ['Crime', 'Drama'], 274],
  [603, 'The Matrix', 1999, ['Science Fiction', 'Action'], 282],
  [1891, 'The Empire Strikes Back', 1980, ['Science Fiction', 'Adventure', 'Action'], 232],
  [120, 'The Lord of the Rings: The Fellowship of the Ring', 2001, ['Fantasy', 'Adventure'], 270],
  [122, 'The Lord of the Rings: The Return of the King', 2003, ['Fantasy', 'Adventure'], 268],
  [129, 'Spirited Away', 2001, ['Animation', 'Fantasy', 'Family'], 250],
  [4935, 'Howl\'s Moving Castle', 2004, ['Animation', 'Fantasy', 'Romance'], 196],
  [8392, 'My Neighbor Totoro', 1988, ['Animation', 'Family', 'Fantasy'], 188],
  [12477, 'Grave of the Fireflies', 1988, ['Animation', 'Drama'], 164],
  [372058, 'Your Name.', 2016, ['Animation', 'Romance', 'Drama'], 226],
  [354912, 'Coco', 2017, ['Animation', 'Family', 'Musical'], 232],
  [12, 'Finding Nemo', 2003, ['Animation', 'Family', 'Adventure'], 210],
  [14160, 'Up', 2009, ['Animation', 'Family', 'Adventure'], 218],
  [508442, 'Soul', 2020, ['Animation', 'Family', 'Fantasy'], 208],
  [150540, 'Inside Out', 2015, ['Animation', 'Family', 'Comedy'], 224],
  [637, 'Life Is Beautiful', 1997, ['Drama', 'Comedy'], 172],
  [389, '12 Angry Men', 1957, ['Drama', 'Crime'], 158],
  [497, 'The Green Mile', 1999, ['Drama', 'Crime', 'Fantasy'], 202],
  [769, 'GoodFellas', 1990, ['Crime', 'Drama'], 216],
  [311, 'Once Upon a Time in America', 1984, ['Crime', 'Drama'], 142],
  [274, 'The Silence of the Lambs', 1991, ['Crime', 'Thriller', 'Horror'], 228],
  [694, 'The Shining', 1980, ['Horror', 'Thriller'], 234],
  [539, 'Psycho', 1960, ['Horror', 'Thriller', 'Mystery'], 186],
  [948, 'Halloween', 1978, ['Horror', 'Thriller'], 170],
  [9552, 'The Exorcist', 1973, ['Horror'], 178],
  [346364, 'It', 2017, ['Horror'], 212],
  [138843, 'The Conjuring', 2013, ['Horror', 'Thriller', 'Mystery'], 198],
  [396422, 'Annabelle: Creation', 2017, ['Horror', 'Thriller'], 144],
  [381288, 'Split', 2016, ['Horror', 'Thriller'], 176],
  [530915, '1917', 2019, ['Drama', 'History', 'Action'], 214],
  [423, 'The Pianist', 2002, ['Drama', 'History'], 168],
  [857, 'Saving Private Ryan', 1998, ['Drama', 'History', 'Action'], 222],
  [424, "Schindler's List", 1993, ['Drama', 'History'], 226],
  [205596, 'The Imitation Game', 2014, ['Drama', 'History', 'Thriller'], 194],
  [335797, 'Sing', 2016, ['Animation', 'Comedy', 'Musical'], 152],
  [512195, 'Red Notice', 2021, ['Action', 'Comedy', 'Crime'], 190],
  [293660, 'Deadpool', 2016, ['Action', 'Comedy', 'Science Fiction'], 244],
  [299536, 'Avengers: Infinity War', 2018, ['Action', 'Science Fiction', 'Adventure'], 286],
  [299534, 'Avengers: Endgame', 2019, ['Action', 'Science Fiction', 'Adventure'], 292],
  [634649, 'Spider-Man: No Way Home', 2021, ['Action', 'Science Fiction', 'Adventure'], 302],
  [505642, 'Black Panther: Wakanda Forever', 2022, ['Action', 'Adventure', 'Science Fiction'], 236],
  [453395, 'Doctor Strange in the Multiverse of Madness', 2022, ['Action', 'Fantasy', 'Horror'], 228],
  [536554, 'M3GAN', 2022, ['Horror', 'Science Fiction', 'Comedy'], 182],
  [631842, 'Knock at the Cabin', 2023, ['Horror', 'Mystery', 'Thriller'], 158],
  [980078, 'Winnie the Pooh: Blood and Honey', 2023, ['Horror', 'Thriller'], 96],
  [502356, 'The Super Mario Bros. Movie', 2023, ['Animation', 'Family', 'Adventure'], 268],
  [976573, 'Elemental', 2023, ['Animation', 'Family', 'Romance'], 204],
  [787699, 'Wonka', 2023, ['Comedy', 'Family', 'Fantasy'], 246],
  [872906, 'Jules', 2023, ['Comedy', 'Drama', 'Science Fiction'], 88],
  [906126, 'Society of the Snow', 2023, ['Drama', 'History'], 186],
  [968051, 'The Nun II', 2023, ['Horror', 'Mystery', 'Thriller'], 174],
  [1008042, 'Talk to Me', 2022, ['Horror', 'Thriller'], 190],
  [713704, 'Evil Dead Rise', 2023, ['Horror'], 178],
  [615656, 'Meg 2: The Trench', 2023, ['Action', 'Science Fiction', 'Horror'], 166],
  [447277, 'The Little Mermaid', 2023, ['Adventure', 'Family', 'Fantasy'], 194],
  [298618, 'The Flash', 2023, ['Action', 'Adventure', 'Science Fiction'], 202],
  [569094123, 'Nimona', 2023, ['Animation', 'Fantasy', 'Adventure'], 172],
  [840326, 'Boy Kills World', 2023, ['Action', 'Thriller'], 118],
  [1029575, 'The Family Plan', 2023, ['Action', 'Comedy'], 148],
  [634492, 'Madame Web', 2024, ['Action', 'Science Fiction'], 152],
  [792308, 'Longlegs', 2024, ['Horror', 'Crime', 'Thriller'], 206],
  [1022789, 'Inside Out 2', 2024, ['Animation', 'Family', 'Comedy'], 278],
  [519182, 'Despicable Me 4', 2024, ['Animation', 'Family', 'Comedy'], 240],
  [533535, 'Deadpool & Wolverine', 2024, ['Action', 'Comedy', 'Science Fiction'], 296],
  [718821, 'Twisters', 2024, ['Action', 'Adventure', 'Drama'], 212],
  [1016150, 'Heretic', 2024, ['Horror', 'Thriller'], 184],
  [1032823, 'Trap', 2024, ['Thriller', 'Crime'], 168],
  [889737, 'Joker: Folie a Deux', 2024, ['Drama', 'Crime', 'Musical'], 176],
  [1100782, 'Smile 2', 2024, ['Horror', 'Mystery'], 180],
  [845781, 'Red One', 2024, ['Action', 'Comedy', 'Fantasy'], 190],
  [558449, 'Gladiator II', 2024, ['Action', 'Adventure', 'Drama'], 248],
  [762509, 'Mufasa: The Lion King', 2024, ['Animation', 'Adventure', 'Family'], 226],
  [539972, 'Kraven the Hunter', 2024, ['Action', 'Adventure', 'Thriller'], 148],
  [1184918, 'The Wild Robot', 2024, ['Animation', 'Family', 'Science Fiction'], 256],
]

const DUNE_COLLECTION = { tmdbId: 726871, name: 'Dune Collection' }

function toTitle(row: Row, kind: 'MOVIE' | 'TV'): SourceTitle {
  const [tmdbId, name, year, genres, popularity, status] = row
  const defaultStatus = kind === 'MOVIE' ? 'Released' : 'Returning Series'
  return {
    tmdbId,
    mediaType: kind,
    name,
    overview: null,
    posterPath: null,
    releaseDate: `${year}-${String(1 + Math.floor(seeded(tmdbId) * 12)).padStart(2, '0')}-14`,
    status: status ?? defaultStatus,
    popularity,
    voteAverage: 6.6 + seeded(tmdbId, 3) * 2.6,
    voteCount: 400 + Math.floor(seeded(tmdbId, 5) * 9000),
    genres,
    collection: name.startsWith('Dune') && kind === 'MOVIE' ? { ...DUNE_COLLECTION, posterPath: null } : null,
  }
}

/** Weekly episodes for a season starting on the given day. */
function weekly(season: number, count: number, first: Date): SourceEpisode[] {
  return Array.from({ length: count }, (_, i) => {
    const when = new Date(first.getTime() + i * 7 * DAY)
    return {
      seasonNumber: season,
      episodeNumber: i + 1,
      name: `Episode ${i + 1}`,
      overview: null,
      airDate: dateOnly(when),
      airstamp: iso(when),
      runtime: 48,
    }
  })
}

/**
 * Availability. Deterministic per title so the demo is stable, and weighted
 * so each service has a believable share rather than a uniform scatter.
 */
function offersFor(row: Row, kind: 'MOVIE' | 'TV'): FixtureEntry['offers'] {
  const [tmdbId, name] = row

  // A handful of unreleased films stream nowhere — they are what the
  // "finally streaming" alert exists for.
  if (UNSTREAMED.has(name)) return []

  const primary = PROVIDER_IDS[Math.floor(seeded(tmdbId, 7) * PROVIDER_IDS.length)]
  const offers: NonNullable<FixtureEntry['offers']> = [{ providerId: primary, kind: 'FLATRATE' }]

  // Films are commonly also rentable elsewhere; that duality is the
  // distinction the product cares about.
  if (kind === 'MOVIE' && seeded(tmdbId, 11) > 0.45) {
    const rentOn = PROVIDER_IDS[Math.floor(seeded(tmdbId, 13) * PROVIDER_IDS.length)]
    if (rentOn !== primary) offers.push({ providerId: rentOn, kind: 'RENT' })
  }
  return offers
}

/** Titles deliberately left with no streaming offer anywhere. */
const UNSTREAMED = new Set(['Mickey 17', 'Sinners', 'Dune: Part Three', 'The Brutalist'])

/** Shows with a season currently scheduled, and when it starts. */
const SCHEDULED: Record<string, { season: number; first: Date; episodes: number }> = {
  Severance: { season: 3, first: nextWeekday(5), episodes: 10 },
  'The Bear': { season: 5, first: nextWeekday(5, 3), episodes: 10 },
  Fallout: { season: 2, first: at(-14), episodes: 8 },
  Silo: { season: 3, first: at(12), episodes: 10 },
  'The Last of Us': { season: 3, first: at(45), episodes: 9 },
  'The White Lotus': { season: 4, first: at(21), episodes: 8 },
  'Stranger Things': { season: 5, first: at(3), episodes: 8 },
  'Only Murders in the Building': { season: 6, first: at(1), episodes: 10 },
  'House of the Dragon': { season: 3, first: at(96), episodes: 8 },
  Shogun: { season: 2, first: at(130), episodes: 10 },
  Foundation: { season: 4, first: at(60), episodes: 10 },
  'The Boys': { season: 5, first: at(38), episodes: 8 },
  Wednesday: { season: 3, first: at(74), episodes: 8 },
  'Squid Game': { season: 4, first: at(150), episodes: 7 },
  'Dune: Prophecy': { season: 2, first: at(88), episodes: 6 },
}

function buildEntry(row: Row, kind: 'MOVIE' | 'TV'): FixtureEntry {
  const title = toTitle(row, kind)
  const entry: FixtureEntry = { title, offers: offersFor(row, kind) }

  if (kind === 'TV') {
    const scheduled = SCHEDULED[row[1]]
    if (scheduled) {
      entry.seasons = [
        { seasonNumber: scheduled.season, airDate: scheduled.first, episodeCount: scheduled.episodes },
      ]
      entry.episodes = weekly(scheduled.season, scheduled.episodes, scheduled.first)
    }
  }

  if (row[1] === 'Dune: Part Two') {
    entry.collectionEntries = [
      toTitle([438631, 'Dune', 2021, ['Science Fiction', 'Adventure'], 330], 'MOVIE'),
      {
        ...toTitle([1155089, 'Dune: Part Three', 2027, ['Science Fiction', 'Adventure'], 240], 'MOVIE'),
        status: 'Post Production',
      },
    ]
  }

  return entry
}

export const FIXTURE_CATALOG: FixtureEntry[] = [
  ...FILMS.map((r) => buildEntry(r, 'MOVIE')),
  ...MORE_FILMS.map((r) => buildEntry(r, 'MOVIE')),
  ...SHOWS.map((r) => buildEntry(r, 'TV')),
  // Unreleased. No offers anywhere by definition — that is the point.
  ...UPCOMING.map(([tmdbId, name, genres, popularity, daysOut]) => {
    const release = at(daysOut)
    return {
      title: {
        tmdbId,
        mediaType: 'MOVIE' as const,
        name,
        overview: null,
        posterPath: null,
        releaseDate: dateOnly(release),
        status: daysOut > 180 ? 'In Production' : 'Post Production',
        popularity,
        voteAverage: 0,
        voteCount: 0,
        genres,
        collection: name.startsWith('Dune') ? { ...DUNE_COLLECTION, posterPath: null } : null,
      },
      offers: [],
    }
  }),
]

export function fixtureDetail(entry: FixtureEntry): TitleDetail {
  return {
    title: entry.title,
    seasons: (entry.seasons ?? []).map((s) => ({
      seasonNumber: s.seasonNumber,
      name: `Season ${s.seasonNumber}`,
      overview: null,
      posterPath: null,
      airDate: s.airDate ? dateOnly(s.airDate) : null,
      episodeCount: s.episodeCount,
    })),
    episodes: entry.episodes ?? [],
    collectionEntries: entry.collectionEntries ?? [],
  }
}
