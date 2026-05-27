import { TabPlaceholder } from '@/components/TabPlaceholder'

// Your trajectory over time: streak, patterns the engine has found, and the
// identity you're building toward — with settings tucked in here (a gear), not
// given a tab of its own.
export default function YouScreen() {
  return (
    <TabPlaceholder
      icon="user"
      title="You"
      tagline="Your trajectory."
      body="Your streak, the patterns we've found, and your settings will live here."
    />
  )
}
