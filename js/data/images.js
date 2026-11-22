/**
 * IMAGE DUMP — the image collection.
 *
 * One entry per local file. The files live in assets/photos/ (originals) with
 * 320px previews in assets/photos/thumbs/; nothing is loaded from the network.
 *
 * Entry:
 *   id        stable, language-independent key. Also the seed for corruption
 *             and the key used by narrative events — never rename one.
 *   filename  the name shown under the thumbnail (the visitor's own naming).
 *   src       original file, opened in the viewer.
 *   thumb     small file used by the grid.
 *   width     original pixel size, for the viewer's status bar.
 *   height
 *   dialogueKey   optional translation key for a M.I.L.O. comment that plays
 *                 when this photo is opened. null = opens silently.
 *   eventId       optional narrative event ID recorded on first open.
 *   trackId       optional MUSIC PLAYER track unlocked the first time this
 *                 photo is opened. Uses the shared progression store.
 *
 * These are the creator's own photographs: no captions, dialogue or stories are
 * invented here. Only `sunset` is wired to anything, because it unlocks the
 * existing "horizon" track.
 */
export const photos = [
  {
    id: "img-01",
    filename: "IMG-1.jpg",
    src: "assets/photos/img-01.jpg",
    thumb: "assets/photos/thumbs/img-01.jpg",
    width: 1024,
    height: 1024,
    dialogueKey: "mascot.context.gallery.06",
    eventId: null,
    trackId: null,
  },
  {
    id: "img-02",
    filename: "IMG-2.jpg",
    src: "assets/photos/img-02.jpg",
    thumb: "assets/photos/thumbs/img-02.jpg",
    width: 1024,
    height: 1024,
    dialogueKey: "mascot.context.gallery.07",
    eventId: null,
    trackId: null,
  },
  {
    id: "img-03",
    filename: "IMG-3.jpg",
    src: "assets/photos/img-03.jpg",
    thumb: "assets/photos/thumbs/img-03.jpg",
    width: 1024,
    height: 1024,
    dialogueKey: "mascot.context.gallery.08",
    eventId: null,
    trackId: null,
  },
  {
    id: "img-04",
    filename: "IMG-4.jpg",
    src: "assets/photos/img-04.jpg",
    thumb: "assets/photos/thumbs/img-04.jpg",
    width: 1024,
    height: 1024,
    dialogueKey: "mascot.context.gallery.09",
    eventId: null,
    trackId: null,
  },
  {
    id: "img-05",
    filename: "IMG-5.jpg",
    src: "assets/photos/img-05.jpg",
    thumb: "assets/photos/thumbs/img-05.jpg",
    width: 1024,
    height: 1024,
    dialogueKey: "mascot.context.gallery.03",
    eventId: null,
    trackId: null,
  },
  {
    id: "img-06",
    filename: "IMG-6.jpg",
    src: "assets/photos/img-06.jpg",
    thumb: "assets/photos/thumbs/img-06.jpg",
    width: 1024,
    height: 1024,
    dialogueKey: "mascot.context.gallery.04",
    eventId: null,
    trackId: null,
  },
  {
    id: "img-07",
    filename: "IMG-7.jpg",
    src: "assets/photos/img-07.jpg",
    thumb: "assets/photos/thumbs/img-07.jpg",
    width: 1024,
    height: 1024,
    dialogueKey: "mascot.context.gallery.10",
    eventId: null,
    trackId: null,
  },
  {
    id: "img-08",
    filename: "IMG-8.jpg",
    src: "assets/photos/img-08.jpg",
    thumb: "assets/photos/thumbs/img-08.jpg",
    width: 1024,
    height: 1024,
    dialogueKey: "mascot.context.gallery.11",
    eventId: null,
    trackId: null,
  },
  {
    id: "img-09",
    filename: "IMG-9.jpg",
    src: "assets/photos/img-09.jpg",
    thumb: "assets/photos/thumbs/img-09.jpg",
    width: 1024,
    height: 1024,
    dialogueKey: "mascot.context.gallery.12",
    eventId: null,
    trackId: null,
  },
  {
    id: "img-10",
    filename: "IMG-10.jpg",
    src: "assets/photos/img-10.jpg",
    thumb: "assets/photos/thumbs/img-10.jpg",
    width: 1024,
    height: 1024,
    dialogueKey: "mascot.context.gallery.13",
    eventId: null,
    trackId: null,
  },
  {
    id: "img-11",
    filename: "IMG-11.jpg",
    src: "assets/photos/img-11.jpg",
    thumb: "assets/photos/thumbs/img-11.jpg",
    width: 894,
    height: 894,
    dialogueKey: "mascot.context.gallery.14",
    eventId: null,
    trackId: null,
  },
  {
    id: "img-12",
    filename: "IMG-12.jpg",
    src: "assets/photos/img-12.jpg",
    thumb: "assets/photos/thumbs/img-12.jpg",
    width: 1024,
    height: 1024,
    dialogueKey: "mascot.context.gallery.15",
    eventId: null,
    trackId: null,
  },
  {
    id: "img-13",
    filename: "IMG-13.jpg",
    src: "assets/photos/img-13.jpg",
    thumb: "assets/photos/thumbs/img-13.jpg",
    width: 1024,
    height: 1024,
    dialogueKey: "mascot.context.gallery.16",
    eventId: null,
    trackId: null,
  },
  {
    id: "img-14",
    filename: "IMG-14.jpg",
    src: "assets/photos/img-14.jpg",
    thumb: "assets/photos/thumbs/img-14.jpg",
    width: 1024,
    height: 1024,
    dialogueKey: "mascot.context.gallery.05",
    eventId: null,
    trackId: null,
  },
  {
    id: "img-15",
    filename: "IMG-15.jpg",
    src: "assets/photos/img-15.jpg",
    thumb: "assets/photos/thumbs/img-15.jpg",
    width: 1024,
    height: 1024,
    dialogueKey: "mascot.context.gallery.17",
    eventId: null,
    trackId: null,
  },
  {
    id: "img-16",
    filename: "IMG-16.jpg",
    src: "assets/photos/img-16.jpg",
    thumb: "assets/photos/thumbs/img-16.jpg",
    width: 1024,
    height: 1024,
    dialogueKey: "mascot.context.gallery.18",
    eventId: null,
    trackId: null,
  },
  {
    id: "img-17",
    filename: "IMG-17.jpg",
    src: "assets/photos/img-17.jpg",
    thumb: "assets/photos/thumbs/img-17.jpg",
    width: 1024,
    height: 1024,
    dialogueKey: "mascot.context.gallery.19",
    eventId: null,
    trackId: null,
  },
  {
    id: "img-18",
    filename: "IMG-18.jpg",
    src: "assets/photos/img-18.jpg",
    thumb: "assets/photos/thumbs/img-18.jpg",
    width: 894,
    height: 894,
    dialogueKey: "mascot.context.gallery.20",
    eventId: null,
    trackId: null,
  },
  {
    id: "img-19",
    filename: "IMG-19.jpg",
    src: "assets/photos/img-19.jpg",
    thumb: "assets/photos/thumbs/img-19.jpg",
    width: 894,
    height: 894,
    dialogueKey: "mascot.context.gallery.21",
    eventId: null,
    trackId: null,
  },
  {
    id: "sunset",
    filename: "sunset.png",
    src: "assets/photos/sunset.png",
    thumb: "assets/photos/thumbs/sunset.jpg",
    width: 478,
    height: 316,
    dialogueKey: null,
    // Opening this photo is the HORIZON discovery through js/core/horizon.js:
    // it grants the desktop Horizon.wav file, and the track is only collected
    // after that file is dropped on its matching MUSIC PLAYER slot. Both IDs
    // are stable and already part of the progression schema.
    eventId: "sunset-frame",
    trackId: "horizon",
  },
];

export const PHOTO_BY_ID = new Map(photos.map((photo) => [photo.id, photo]));
