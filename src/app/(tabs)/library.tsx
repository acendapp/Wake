import { Feather } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import * as WebBrowser from 'expo-web-browser'

import { ARTICLES, BYLINE, readMinutes, type Article } from '@/content/articles'
import { SOURCE_TOPICS, sourcesForGoal, type Source } from '@/content/sources'
import { GOAL_LIBRARY } from '@/engine/goalLibrary'
import type { ActionCategory, Goal, Intent, ReadinessState } from '@/engine/types'
import { daysWithPlans, logicalDate } from '@/lib/days'
import { day } from '@/theme/colors'

// The Library — two faces behind one segmented control:
//
//  LEARN (default): the infinite well. Real, authored editorial about morning
//  wellness (src/content/articles.ts) with an in-app reader. This is the daily
//  reason to reopen the tab; it can grow forever where a move catalog cannot.
//
//  MY ROUTINES: the earned collection. Only the moves the engine has actually
//  prescribed to *this* user, each with their relationship to it ("in today's
//  routine", "completed 4 times"). It starts small and grows with use — an
//  asset the user builds, never an inventory they can exhaust. Moves the engine
//  hasn't reached for are deliberately invisible (a closing tease, no counts
//  anywhere) so the catalog never reads as finite.

// ── My Moves: real data ──────────────────────────────────────────────────────

const ROUTINE_GOALS = GOAL_LIBRARY.filter((g) => g.scope === 'routine')

const CATEGORY_META: Record<
  ActionCategory,
  { label: string; icon: React.ComponentProps<typeof Feather>['name'] }
> = {
  movement: { label: 'Movement', icon: 'activity' },
  transition: { label: 'Transition', icon: 'log-in' },
  light: { label: 'Light', icon: 'sun' },
  focus: { label: 'Focus', icon: 'target' },
  hydration: { label: 'Hydration', icon: 'droplet' },
  caffeine: { label: 'Caffeine', icon: 'coffee' },
  nutrition: { label: 'Nutrition', icon: 'heart' },
  digital: { label: 'Digital', icon: 'smartphone' },
}

const STATE_LABEL: Record<ReadinessState, string> = {
  deficit: 'Restore',
  aligned: 'Ready',
  surplus: 'Charged',
}

const INTENT_LABEL: Record<Intent, string> = {
  calm: 'Calm',
  energize: 'Energy',
  focus: 'Focus',
}

const ALL_STATES: ReadinessState[] = ['deficit', 'aligned', 'surplus']
const ALL_INTENTS: Intent[] = ['calm', 'energize', 'focus']

function isStaple(goal: Goal): boolean {
  return (
    ALL_STATES.every((s) => goal.states.includes(s)) &&
    ALL_INTENTS.every((i) => goal.intents.includes(i))
  )
}

function goalForActionSlug(slug: string): Goal | null {
  return ROUTINE_GOALS.find((g) => g.variants.some((v) => v.slug === slug)) ?? null
}

/** One entry in the user's earned collection: a goal + their history with it. */
type CollectionEntry = {
  goal: Goal
  /** How many mornings it has appeared in. */
  prescribed: number
  /** How many times it was checked off. */
  completed: number
  inToday: boolean
  doneToday: boolean
}

/** The user's relationship with a move, as a single line. */
function relationshipLine(e: CollectionEntry): string {
  if (e.inToday && e.doneToday) return 'In today’s routine — done'
  if (e.inToday) return 'In today’s routine'
  if (e.completed > 1) return `Completed ${e.completed} times`
  if (e.completed === 1) return 'Completed once'
  return 'New — not yet done'
}

// ── Screen ───────────────────────────────────────────────────────────────────

type LibraryView = 'learn' | 'moves'

export default function LibraryScreen() {
  const router = useRouter()
  const [view, setView] = useState<LibraryView>('learn')
  const [selected, setSelected] = useState<Goal | null>(null)
  const [reading, setReading] = useState<Article | null>(null)
  const [showSources, setShowSources] = useState(false)
  const [collection, setCollection] = useState<CollectionEntry[]>([])
  const [collectionLoading, setCollectionLoading] = useState(true)
  const [collectionError, setCollectionError] = useState(false)

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Build the collection from real history: every plan the engine has produced
  // for this user, and what they checked off. A load failure surfaces as a
  // retryable error rather than silently falling through to the cold-start empty
  // state (which would tell a returning user they have no routines).
  const loadCollection = useCallback(() => {
    setCollectionLoading(true)
    setCollectionError(false)
    daysWithPlans()
      .then((rows) => {
        if (!mounted.current) return
        const today = logicalDate()
        const byGoal = new Map<string, CollectionEntry>()
        for (const row of rows) {
          const sequence = row.plan?.sequence ?? []
          const completedSlugs = row.completed_slugs ?? []
          for (const action of sequence) {
            const goal = goalForActionSlug(action.slug)
            if (!goal) continue
            const entry = byGoal.get(goal.slug) ?? {
              goal,
              prescribed: 0,
              completed: 0,
              inToday: false,
              doneToday: false,
            }
            entry.prescribed += 1
            const done = completedSlugs.includes(action.slug)
            if (done) entry.completed += 1
            if (row.local_date === today) {
              entry.inToday = true
              entry.doneToday = done
            }
            byGoal.set(goal.slug, entry)
          }
        }
        // Today's moves first, then most-completed, then most-prescribed.
        const sorted = [...byGoal.values()].sort((a, b) => {
          if (a.inToday !== b.inToday) return a.inToday ? -1 : 1
          if (a.completed !== b.completed) return b.completed - a.completed
          return b.prescribed - a.prescribed
        })
        setCollection(sorted)
        setCollectionLoading(false)
      })
      .catch(() => {
        if (!mounted.current) return
        setCollectionError(true)
        setCollectionLoading(false)
      })
  }, [])

  // Refreshed on focus so a morning check-in or a /routine check-off shows up.
  useFocusEffect(loadCollection)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <View style={styles.headerRow}>
            <Text style={styles.eyebrow}>The library</Text>
            {/* Same gear as the You page — jumps to You → Settings. */}
            <Pressable
              hitSlop={10}
              onPress={() =>
                router.push({ pathname: '/you', params: { settings: String(Date.now()) } })
              }
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Feather name="settings" size={18} color={day.muted} />
            </Pressable>
          </View>
          <Text style={styles.title}>
            {view === 'learn' ? 'Learn' : 'My routines'}
          </Text>
          <Text style={styles.tagline}>
            {view === 'learn'
              ? 'The thinking behind better mornings.'
              : 'The moves your mornings are built from.'}
          </Text>
        </Animated.View>

        {/* ── Segmented control ────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(500).delay(90)}>
          <View style={styles.segment}>
            <SegmentButton
              label="Learn"
              selected={view === 'learn'}
              onPress={() => setView('learn')}
            />
            <SegmentButton
              label="My routines"
              selected={view === 'moves'}
              onPress={() => setView('moves')}
            />
          </View>
        </Animated.View>

        {view === 'learn' ? (
          <LearnFeed key="learn" onRead={setReading} />
        ) : (
          <MovesCollection
            key="moves"
            collection={collection}
            loading={collectionLoading}
            error={collectionError}
            onRetry={loadCollection}
            onOpen={setSelected}
          />
        )}

        {/* Always-present entry to the citation library — the health claims in both
            faces of this tab trace back here (Apple Guideline 1.4.1). */}
        <Pressable
          style={styles.sourcesEntry}
          onPress={() => setShowSources(true)}
          accessibilityRole="button"
          accessibilityLabel="Sources and references"
        >
          <Feather name="book-open" size={15} color={day.muted} />
          <Text style={styles.sourcesEntryLabel}>Sources &amp; references</Text>
          <Feather name="chevron-right" size={16} color={day.border} />
        </Pressable>
      </ScrollView>

      {/* ── Article reader (full screen) ─────────────────────────────────────── */}
      <Modal
        visible={reading != null}
        animationType="slide"
        onRequestClose={() => setReading(null)}
      >
        {/* SafeAreaView gets no insets inside a Modal unless the Modal carries its
            own provider — without this the close button lands under the notch. */}
        <SafeAreaProvider>
          {reading && <ArticleReader article={reading} onClose={() => setReading(null)} />}
        </SafeAreaProvider>
      </Modal>

      {/* ── Sources & references (full screen) ───────────────────────────────── */}
      <Modal
        visible={showSources}
        animationType="slide"
        onRequestClose={() => setShowSources(false)}
      >
        <SafeAreaProvider>
          <ReferencesScreen onClose={() => setShowSources(false)} />
        </SafeAreaProvider>
      </Modal>

      {/* ── Move detail bottom sheet ─────────────────────────────────────────── */}
      <Modal
        visible={selected != null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelected(null)}>
          {/* The sheet itself swallows taps so only the backdrop dismisses. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            {selected && <GoalDetail goal={selected} onClose={() => setSelected(null)} />}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

function SegmentButton({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      style={[styles.segmentButton, selected && styles.segmentButtonOn]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.segmentLabel, selected && styles.segmentLabelOn]}>{label}</Text>
    </Pressable>
  )
}

// ── Learn: the editorial feed ────────────────────────────────────────────────

function LearnFeed({ onRead }: { onRead: (article: Article) => void }) {
  const featured = ARTICLES.find((a) => a.featured)
  const rest = ARTICLES.filter((a) => !a.featured)

  return (
    <Animated.View entering={FadeIn.duration(350)}>
      {/* Featured piece: the valley art under a cream wash, magazine-cover style. */}
      {featured && (
        <Pressable
          style={styles.featuredCard}
          onPress={() => onRead(featured)}
          accessibilityRole="button"
        >
          <Image
            source={require('../../../assets/images/valley.jpg')}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient
            colors={['rgba(250,248,244,0.92)', 'rgba(250,248,244,0.55)', 'rgba(250,248,244,0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.featuredContent}>
            <Text style={styles.articleTag}>{featured.tag}</Text>
            <Text style={styles.featuredTitle}>{featured.title}</Text>
            <Text style={styles.articleMeta}>
              {BYLINE} · {readMinutes(featured)} min read
            </Text>
          </View>
        </Pressable>
      )}

      {/* The rest: a magazine table of contents — typographic rows, no boxes. */}
      <View style={styles.articleList}>
        {rest.map((a, i) => (
          <View key={a.slug}>
            {i > 0 && <View style={styles.articleDivider} />}
            <Pressable
              style={styles.articleRow}
              onPress={() => onRead(a)}
              accessibilityRole="button"
            >
              <Text style={styles.articleTag}>{a.tag}</Text>
              <Text style={styles.articleTitle}>{a.title}</Text>
              <Text style={styles.articleMeta}>
                {BYLINE} · {readMinutes(a)} min read
              </Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Text style={styles.feedFooter}>New pieces land every week.</Text>
    </Animated.View>
  )
}

// ── The article reader — a quiet, full-screen reading surface ────────────────

function ArticleReader({ article, onClose }: { article: Article; onClose: () => void }) {
  return (
    <SafeAreaView style={styles.readerSafe} edges={['top', 'bottom']}>
      {/* Fixed header: the close chip never scrolls away, so there's always an
          exit in reach no matter how deep into the piece you are. */}
      <View style={styles.readerHeader}>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={styles.readerClose}
          accessibilityRole="button"
          accessibilityLabel="Close article"
        >
          <Feather name="x" size={20} color={day.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.readerScroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.articleTag}>{article.tag}</Text>
        <Text style={styles.readerTitle}>{article.title}</Text>
        <Text style={styles.articleMeta}>
          {BYLINE} · {readMinutes(article)} min read
        </Text>

        <View style={styles.readerRule} />

        {article.body.map((block, i) =>
          block.type === 'h' ? (
            <Text key={i} style={styles.readerH}>
              {block.text}
            </Text>
          ) : (
            <Text key={i} style={styles.readerP}>
              {block.text}
            </Text>
          ),
        )}

        {/* Citations for the physiological claims above (Apple Guideline 1.4.1).
            Each opens its source in an in-app browser; the note keeps the content
            framed as educational, not medical advice. */}
        {article.sources && article.sources.length > 0 && (
          <View style={styles.sourcesBlock}>
            <Text style={styles.sourcesLabel}>Sources</Text>
            {article.sources.map((s, i) => (
              <SourceLink key={i} source={s} />
            ))}
            <Text style={styles.sourcesNote}>
              Shared for general education, not medical advice. Talk to a clinician about your
              own health.
            </Text>
          </View>
        )}

        <View style={styles.readerEndRow}>
          <View style={styles.readerEndLine} />
          <Feather name="sun" size={13} color={day.gold} />
          <View style={styles.readerEndLine} />
        </View>

        {/* Finishing the piece deserves its own exit — no reaching back to the top. */}
        <Pressable style={styles.readerDone} onPress={onClose} accessibilityRole="button">
          <Text style={styles.readerDoneLabel}>Done</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Sources: one tappable citation row, shared everywhere they appear ────────

function SourceLink({ source }: { source: Source }) {
  return (
    <Pressable
      style={styles.sourceRow}
      onPress={() => WebBrowser.openBrowserAsync(source.url).catch(() => {})}
      accessibilityRole="link"
      accessibilityLabel={`Open source: ${source.label}`}
    >
      <Feather name="external-link" size={13} color={day.gold} style={styles.sourceIcon} />
      <Text style={styles.sourceText}>{source.label}</Text>
    </Pressable>
  )
}

// The full-screen references library: every citation behind the moves and articles,
// grouped by topic, one tap from the Library tab (Apple Guideline 1.4.1 — health
// information must carry findable citations to its sources).
function ReferencesScreen({ onClose }: { onClose: () => void }) {
  return (
    <SafeAreaView style={styles.readerSafe} edges={['top', 'bottom']}>
      <View style={styles.readerHeader}>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={styles.readerClose}
          accessibilityRole="button"
          accessibilityLabel="Close references"
        >
          <Feather name="x" size={20} color={day.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.readerScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.articleTag}>References</Text>
        <Text style={styles.readerTitle}>Where this comes from</Text>
        <Text style={styles.refIntro}>
          Wake&rsquo;s morning guidance draws on published research. Below are the sources behind
          the moves and articles. Everything here is general education, not medical advice — for
          your own health, talk to a clinician.
        </Text>

        <View style={styles.readerRule} />

        <Text style={styles.refSectionHead}>The science behind the moves</Text>
        {SOURCE_TOPICS.map((topic) => (
          <View key={topic.key} style={styles.refTopic}>
            <Text style={styles.refTopicTitle}>{topic.title}</Text>
            {topic.sources.map((s, i) => (
              <SourceLink key={i} source={s} />
            ))}
          </View>
        ))}

        <Text style={[styles.refSectionHead, styles.refSectionHeadSpaced]}>Article sources</Text>
        {ARTICLES.filter((a) => a.sources && a.sources.length > 0).map((a) => (
          <View key={a.slug} style={styles.refTopic}>
            <Text style={styles.refTopicTitle}>{a.title}</Text>
            {a.sources!.map((s, i) => (
              <SourceLink key={i} source={s} />
            ))}
          </View>
        ))}

        <Pressable style={styles.readerDone} onPress={onClose} accessibilityRole="button">
          <Text style={styles.readerDoneLabel}>Done</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

// ── My Moves: the earned collection ──────────────────────────────────────────

function MovesCollection({
  collection,
  loading,
  error,
  onRetry,
  onOpen,
}: {
  collection: CollectionEntry[]
  loading: boolean
  error: boolean
  onRetry: () => void
  onOpen: (goal: Goal) => void
}) {
  if (loading && collection.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <ActivityIndicator color={day.gold} />
      </View>
    )
  }

  if (error && collection.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Feather name="cloud-off" size={24} color={day.muted} />
        <Text style={styles.emptyTitle}>Couldn’t load your routines.</Text>
        <Text style={styles.emptyBody}>Check your connection and try again.</Text>
        <Pressable style={styles.retryButton} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <Animated.View entering={FadeIn.duration(350)}>
      {collection.length === 0 ? (
        // Cold start: the collection begins with the first morning.
        <View style={styles.emptyWrap}>
          <Feather name="sunrise" size={24} color={day.gold} />
          <Text style={styles.emptyTitle}>Your collection starts with your first morning.</Text>
          <Text style={styles.emptyBody}>
            Every move Wake prescribes you lives here afterward — what it does, why it works,
            and your history with it.
          </Text>
        </View>
      ) : (
        <View style={styles.moveList}>
          {collection.map((e) => {
            const lead = e.goal.variants[0]
            const meta = CATEGORY_META[e.goal.category]
            return (
              <Pressable
                key={e.goal.slug}
                style={styles.moveCard}
                onPress={() => onOpen(e.goal)}
                accessibilityRole="button"
              >
                <View style={styles.moveIcon}>
                  <Feather name={meta.icon} size={16} color={day.gold} />
                </View>
                <View style={styles.moveText}>
                  <Text style={styles.moveTitle}>{lead.title}</Text>
                  <Text style={styles.moveRelationship}>{relationshipLine(e)}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={day.border} />
              </Pressable>
            )
          })}
        </View>
      )}

      {/* The tease — never a count, never a list. The catalog stays a mystery and
          the line doubles as proof the engine adapts. Only shown once a collection
          exists: a brand-new user's empty state speaks for itself. */}
      {collection.length > 0 && (
        <Text style={styles.tease}>
          There&rsquo;s more Wake hasn&rsquo;t reached for yet. New moves appear here as your
          mornings change.
        </Text>
      )}
    </Animated.View>
  )
}

// ── Move detail (bottom sheet) ───────────────────────────────────────────────

function GoalDetail({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const lead = goal.variants[0]
  const meta = CATEGORY_META[goal.category]
  const sources = sourcesForGoal(goal.slug)

  return (
    <View>
      <View style={styles.sheetHandle} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.sheetScroll}
      >
        <View style={styles.sheetCategoryRow}>
          <Feather name={meta.icon} size={14} color={day.gold} />
          <Text style={styles.sheetCategory}>{meta.label}</Text>
        </View>

        <Text style={styles.sheetTitle}>{lead.title}</Text>
        <Text style={styles.sheetExample}>{lead.example}</Text>

        <Text style={styles.sheetSectionLabel}>Why it works</Text>
        <Text style={styles.sheetBody}>{lead.description}</Text>

        {sources.length > 0 && (
          <View style={styles.moveSources}>
            <Text style={styles.moveSourcesLabel}>Sources</Text>
            {sources.map((s, i) => (
              <SourceLink key={i} source={s} />
            ))}
          </View>
        )}

        <Text style={styles.sheetSectionLabel}>When Wake reaches for it</Text>
        {isStaple(goal) ? (
          <Text style={styles.sheetBody}>
            A staple — this earns a place in any morning, whatever your state and whatever
            you&rsquo;re after.
          </Text>
        ) : (
          <View>
            <View style={styles.tagRow}>
              {goal.states.map((s) => (
                <View key={s} style={styles.tag}>
                  <Text style={styles.tagLabel}>{STATE_LABEL[s]}</Text>
                </View>
              ))}
            </View>
            <View style={styles.tagRow}>
              {goal.intents.map((i) => (
                <View key={i} style={[styles.tag, styles.tagIntent]}>
                  <Text style={styles.tagIntentLabel}>{INTENT_LABEL[i]}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.sheetSectionLabel}>Your time, your version</Text>
        <View style={styles.variantList}>
          {goal.variants.map((v) => (
            <View key={v.slug} style={styles.variantRow}>
              <Text style={styles.variantMinutes}>{v.estMinutes} min</Text>
              <Text style={styles.variantExample}>{v.example}</Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.sheetClose} onPress={onClose} accessibilityRole="button">
          <Text style={styles.sheetCloseLabel}>Got it</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const PAGE_PAD = 28

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: day.background,
  },
  scroll: {
    paddingTop: 18,
    paddingBottom: 48,
    paddingHorizontal: PAGE_PAD,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: day.muted,
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 44,
    color: day.text,
    marginTop: 10,
  },
  tagline: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: day.muted,
    marginTop: 6,
  },

  // ── Segmented control ───────────────────────────────────────────────────────
  segment: {
    flexDirection: 'row',
    backgroundColor: day.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    padding: 4,
    marginTop: 24,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentButtonOn: {
    backgroundColor: day.gold,
  },
  segmentLabel: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 14,
    color: day.muted,
  },
  segmentLabelOn: {
    color: day.onAccent,
  },

  // ── Learn feed ──────────────────────────────────────────────────────────────
  featuredCard: {
    height: 210,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    marginTop: 26,
  },
  featuredContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-end',
  },
  featuredTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    lineHeight: 29,
    color: day.text,
    marginTop: 8,
    maxWidth: 280,
  },
  articleList: {
    marginTop: 14,
  },
  articleRow: {
    paddingVertical: 20,
  },
  articleDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: day.border,
  },
  articleTag: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: day.gold,
  },
  articleTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    lineHeight: 25,
    color: day.text,
    marginTop: 7,
  },
  articleMeta: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12.5,
    color: day.muted,
    marginTop: 7,
  },
  feedFooter: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontStyle: 'italic',
    fontSize: 13.5,
    color: day.muted,
    textAlign: 'center',
    marginTop: 26,
  },

  // ── Article reader ──────────────────────────────────────────────────────────
  readerSafe: {
    flex: 1,
    backgroundColor: day.background,
  },
  readerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
  },
  // A real target: 40pt chip on a visible surface, not a bare glyph.
  readerClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: day.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerScroll: {
    paddingHorizontal: PAGE_PAD,
    paddingTop: 10,
    paddingBottom: 56,
  },
  readerTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 30,
    lineHeight: 39,
    color: day.text,
    marginTop: 10,
    marginBottom: 10,
  },
  readerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: day.border,
    marginTop: 24,
    marginBottom: 6,
  },
  readerP: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 16.5,
    lineHeight: 28,
    color: day.text,
    marginTop: 20,
  },
  readerH: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 20,
    lineHeight: 28,
    color: day.text,
    marginTop: 34,
  },
  sourcesBlock: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: day.border,
  },
  sourcesLabel: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: day.muted,
    marginBottom: 4,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
  },
  sourceIcon: {
    marginTop: 3,
  },
  sourceText: {
    flex: 1,
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 13.5,
    lineHeight: 20,
    color: day.gold,
    textDecorationLine: 'underline',
  },
  sourcesNote: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontStyle: 'italic',
    fontSize: 12.5,
    lineHeight: 18,
    color: day.muted,
    marginTop: 12,
  },

  // ── Move-sheet inline sources ───────────────────────────────────────────────
  moveSources: {
    marginTop: 14,
  },
  moveSourcesLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: day.muted,
    marginBottom: 2,
  },

  // ── Sources & references entry + screen ─────────────────────────────────────
  sourcesEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 30,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: day.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
  },
  sourcesEntryLabel: {
    flex: 1,
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 14,
    color: day.text,
  },
  refIntro: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    lineHeight: 23,
    color: day.muted,
    marginTop: 10,
  },
  refSectionHead: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    color: day.text,
    marginTop: 20,
    marginBottom: 2,
  },
  refSectionHeadSpaced: {
    marginTop: 40,
  },
  refTopic: {
    marginTop: 16,
  },
  refTopicTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 14.5,
    lineHeight: 20,
    color: day.text,
    marginBottom: 2,
  },
  readerEndRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 44,
  },
  readerEndLine: {
    width: 36,
    height: 1,
    backgroundColor: day.gold,
    opacity: 0.5,
  },
  readerDone: {
    backgroundColor: day.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 36,
  },
  readerDoneLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: day.onAccent,
  },

  // ── My Moves ────────────────────────────────────────────────────────────────
  moveList: {
    marginTop: 26,
    gap: 12,
  },
  moveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: day.surface,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    padding: 16,
  },
  moveIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: day.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveText: {
    flex: 1,
  },
  moveTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: day.text,
  },
  moveRelationship: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 13,
    color: day.gold,
    marginTop: 4,
  },
  tease: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontStyle: 'italic',
    fontSize: 13.5,
    lineHeight: 20,
    color: day.muted,
    textAlign: 'center',
    marginTop: 28,
    paddingHorizontal: 12,
  },
  emptyWrap: {
    alignItems: 'center',
    marginTop: 48,
    paddingHorizontal: 8,
  },
  emptyTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 20,
    lineHeight: 28,
    color: day.text,
    textAlign: 'center',
    marginTop: 16,
  },
  emptyBody: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14.5,
    lineHeight: 22,
    color: day.muted,
    textAlign: 'center',
    marginTop: 10,
  },
  retryButton: {
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderWidth: 1.5,
    borderColor: day.gold,
  },
  retryLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 15,
    color: day.gold,
  },

  // ── Bottom sheet ────────────────────────────────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: day.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: day.border,
  },
  sheetScroll: {
    paddingHorizontal: PAGE_PAD,
    paddingTop: 22,
    paddingBottom: 40,
  },
  sheetCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sheetCategory: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: day.muted,
  },
  sheetTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    lineHeight: 40,
    color: day.text,
    marginTop: 10,
  },
  sheetExample: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 24,
    color: day.muted,
    marginTop: 8,
  },
  sheetSectionLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: day.muted,
    marginTop: 28,
  },
  sheetBody: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    lineHeight: 23,
    color: day.text,
    marginTop: 10,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    backgroundColor: day.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagLabel: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 13,
    color: day.text,
  },
  tagIntent: {
    borderColor: day.gold,
    backgroundColor: day.goldTint,
  },
  tagIntentLabel: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 13,
    color: day.gold,
  },
  variantList: {
    marginTop: 12,
    gap: 12,
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  variantMinutes: {
    width: 52,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 14,
    color: day.gold,
    marginTop: 1,
  },
  variantExample: {
    flex: 1,
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: day.text,
  },
  sheetClose: {
    backgroundColor: day.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  sheetCloseLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: day.onAccent,
  },
})
