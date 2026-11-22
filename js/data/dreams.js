/**
 * DREAM LOG — six recovered dream records.
 *
 * IDs are stable and never translated. All visible text lives in the four
 * dictionaries under the record's `titleKey` and `bodyKey`, with blank lines
 * separating paragraphs. `scene` selects a small CSS memory plate; `shards`
 * is the number of damaged cells the Sacred brush must erase before the record
 * becomes readable.
 *
 * A record is finished only when every shard is cleaned. The cleaned shard IDs
 * live in progression.dreamCleaning; the finished record itself is recorded in
 * progression.dreams, so a refresh never asks for the same record twice.
 */
export const dreamPages = [
  {
    id: "dream-001",
    number: "001",
    titleKey: "dreams.001.title",
    bodyKey: "dreams.001.body",
    commentKey: "mascot.dream.001",
    scene: "school",
    shards: 6,
  },
  {
    id: "dream-002",
    number: "002",
    titleKey: "dreams.002.title",
    bodyKey: "dreams.002.body",
    commentKey: "mascot.dream.002",
    scene: "castle",
    shards: 6,
  },
  {
    id: "dream-003",
    number: "003",
    titleKey: "dreams.003.title",
    bodyKey: "dreams.003.body",
    commentKey: "mascot.dream.003",
    scene: "hotel",
    shards: 6,
  },
  {
    id: "dream-004",
    number: "004",
    titleKey: "dreams.004.title",
    bodyKey: "dreams.004.body",
    commentKey: "mascot.dream.004",
    scene: "houses",
    shards: 6,
  },
  {
    id: "dream-005",
    number: "005",
    titleKey: "dreams.005.title",
    bodyKey: "dreams.005.body",
    commentKey: "mascot.dream.005",
    scene: "mother",
    shards: 6,
  },
  {
    id: "dream-006",
    number: "006",
    titleKey: "dreams.006.title",
    bodyKey: "dreams.006.body",
    commentKey: "mascot.dream.006",
    scene: "fields",
    shards: 6,
  },
];
