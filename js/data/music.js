/**
 * MUSIC PLAYER — known track entries.
 *
 * The six titles that exist in the project. Twisters, Horizon, Sacred Digital,
 * Outsider, Triton and Signals have their real masters in assets/audio/. No
 * cover artwork or final album order is invented here.
 *
 *   {
 *     id: "twisters",        // stable, language-independent key
 *     artist: "HOLYSAGA",    // display artist, same in every language
 *     title: "Twisters",     // the track's own name, same in every language
 *     src: null,             // assets/audio/… once a real file exists
 *     visual: "twisters",    // preset name the visualizer will resolve later
 *     listenKey: "…",        // M.I.L.O.'s first-import line (optional)
 *     understandAt: 0.7,     // share of unique listening that unlocks meaning
 *   }
 *
 * A `src` makes the track playable, not collected: MUSIC PLAYER still enables
 * it only after its file is dropped into the matching slot, which writes the
 * ID to progression.
 *
 * `id` is what the shared progression store saves, so never rename an ID that
 * has shipped: doing so orphans saved discoveries. Add new tracks by appending
 * an entry; the MUSIC PLAYER list, lock state and visualizer all follow.
 *
 * Collecting a track is not understanding it: `understandAt` is the share of
 * its unique duration that must really be heard before the archive decodes it.
 * It is per track on purpose, so a longer or more difficult piece can ask for
 * more. `listenKey` is the line M.I.L.O. says the first time the track is
 * imported; leave it out and the player stays silent.
 */
export const tracks = [
  {
    id: "twisters",
    artist: "HOLYSAGA",
    title: "Twisters",
    src: "assets/audio/twisters.wav",
    visual: "twisters",
    understandAt: 0.7,
  },
  {
    id: "horizon",
    artist: "HOLYSAGA",
    title: "Horizon",
    src: "assets/audio/horizon.wav",
    visual: "horizon",
    understandAt: 0.7,
  },
  {
    id: "sacred-digital",
    artist: "HOLYSAGA",
    title: "Sacred Digital",
    src: "assets/audio/sacred-digital.wav",
    visual: "sacred-digital",
    understandAt: 0.7,
    listenKey: "mascot.sacred.listen",
  },
  {
    id: "outsider",
    artist: "HOLYSAGA",
    title: "Outsider",
    src: "assets/audio/outsider.wav",
    visual: "outsider",
    understandAt: 0.7,
  },
  {
    id: "triton",
    artist: "HOLYSAGA",
    title: "Triton",
    src: "assets/audio/triton.wav",
    visual: "triton",
    understandAt: 0.7,
  },
  {
    id: "signals",
    artist: "HOLYSAGA",
    title: "Signals",
    src: "assets/audio/signals.wav",
    visual: "signals",
    understandAt: 0.7,
  },
];

export const TRACK_BY_ID = new Map(tracks.map((track) => [track.id, track]));
