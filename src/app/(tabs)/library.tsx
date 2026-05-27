import { TabPlaceholder } from '@/components/TabPlaceholder'

// The catalog of every move the engine can prescribe — light, breath, cold,
// caffeine timing, movement — each with the why behind it. Authored content, so
// it's populated from day one (no cold start), and the Today sequence can deep
// link into it ("why this move? →").
export default function LibraryScreen() {
  return (
    <TabPlaceholder
      icon="book-open"
      title="Library"
      tagline="Every move, explained."
      body="The full catalog of what Wake prescribes — light, breath, cold, caffeine, movement — and the why behind each."
    />
  )
}
