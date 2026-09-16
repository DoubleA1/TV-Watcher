/**
 * Taste selection checks.
 *
 * The selection algorithm mixes three buckets and deliberately includes
 * randomness, so the properties worth asserting are statistical: does it
 * vary between draws, does it avoid what we already rated, does it still
 * favour films people have actually seen, and does a hated genre get
 * suppressed without vanishing entirely.
 */
import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { getEntitlement, nextToRate, FREE_RATING_LIMIT } from '../src/lib/taste'

async function main() {
  const user = await prisma.user.findFirstOrThrow({ where: { email: 'demo@tvwatcher.local' } })
  await prisma.rating.deleteMany({ where: { userId: user.id } })
  await prisma.suggestion.deleteMany({ where: { userId: user.id } })

  // --- variety -------------------------------------------------------------
  const a = await nextToRate(user.id, 12)
  const b = await nextToRate(user.id, 12)
  const overlap = a.filter((x) => b.some((y) => y.id === x.id)).length
  console.log(`two draws of 12 share ${overlap} titles (want < 12 — some variety)`)

  // --- excludes what we already answered -----------------------------------
  for (const card of a.slice(0, 6)) {
    await prisma.rating.create({ data: { userId: user.id, titleId: card.id, value: 'LIKED' } })
  }
  const after = await nextToRate(user.id, 12)
  const repeats = after.filter((x) => a.slice(0, 6).some((y) => y.id === x.id)).length
  console.log(`already-rated titles reappearing: ${repeats} (want 0)`)

  // --- hated genres are suppressed, not erased -----------------------------
  await prisma.rating.deleteMany({ where: { userId: user.id } })
  const horror = await prisma.title.findMany({
    where: { mediaType: 'MOVIE', genres: { has: 'Horror' } },
    take: 8,
    select: { id: true },
  })
  for (const h of horror) {
    await prisma.rating.create({ data: { userId: user.id, titleId: h.id, value: 'HATED' } })
  }

  let horrorSeen = 0
  const DRAWS = 12
  for (let i = 0; i < DRAWS; i++) {
    const draw = await nextToRate(user.id, 12)
    horrorSeen += draw.filter((c) => c.genres.includes('Horror')).length
  }
  const perDraw = horrorSeen / DRAWS
  console.log(`horror per 12-card draw after hating 8 horror films: ${perDraw.toFixed(2)}`)
  console.log(`  suppressed (< 2.5): ${perDraw < 2.5} · not erased (> 0): ${horrorSeen > 0}`)

  // --- free allowance counts verdicts only ---------------------------------
  await prisma.rating.deleteMany({ where: { userId: user.id } })
  const pool = await prisma.title.findMany({ where: { mediaType: 'MOVIE' }, take: 20, select: { id: true } })
  for (const t of pool.slice(0, 5)) {
    await prisma.rating.create({ data: { userId: user.id, titleId: t.id, value: 'NOT_SEEN' } })
  }
  const afterSkips = await getEntitlement(user.id)
  for (const t of pool.slice(5, 10)) {
    await prisma.rating.create({ data: { userId: user.id, titleId: t.id, value: 'LIKED' } })
  }
  const afterVerdicts = await getEntitlement(user.id)
  console.log(`5 "not seen" cost ${afterSkips.counted} of the allowance (want 0)`)
  console.log(`5 verdicts cost ${afterVerdicts.counted} (want 5), remaining ${afterVerdicts.remaining} of ${FREE_RATING_LIMIT}`)

  const ok =
    overlap < 12 &&
    repeats === 0 &&
    perDraw < 2.5 &&
    horrorSeen > 0 &&
    afterSkips.counted === 0 &&
    afterVerdicts.counted === 5

  await prisma.rating.deleteMany({ where: { userId: user.id } })
  console.log(ok ? '\nPASS' : '\nFAIL')
  if (!ok) process.exitCode = 1
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
