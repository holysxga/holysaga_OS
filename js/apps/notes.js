/**
 * NOTES.TXT
 *
 * A read-only notepad built from a larger archive of damaged fragments. The
 * File menu is genuinely functional (close window, about panel); the page
 * itself is a random selection from the creator's note pool, freshly picked
 * each time the program opens and stable while it stays on screen (a language
 * switch must not reshuffle the page, only re-render the same fragments).
 *
 * Some notes begin corrupted. They are cleaned with the Sacred Digital brush —
 * the same tool DREAM LOG registers — through an in-window cleaning surface.
 * Every cleaned cell is stored per note in progression.noteCleaning, so:
 *   - cleaning one note never touches another;
 *   - a partially cleaned note keeps its progress across refreshes;
 *   - a fully cleaned note stays readable forever;
 *   - the underlying sentence is real text, revealed as the cells go.
 */
import { el, clear } from "../core/dom.js";
import { t, onLocaleChange } from "../i18n/index.js";
import { pickNotes } from "../data/notes.js";
import { progression } from "../core/progression.js";
import { createCorruptionBlock } from "../ui/corruption.js";

const SHARD_RECOVER_MS = 280;

export const notesApp = {
  id: "notes",
  titleKey: "app.notes.title",
  icon: "assets/icons/notes.svg",
  size: { w: 565, h: 430 },

  mount(body, ctx = {}) {
    const root = el("div", { class: "app app--notes" });
    const state = {
      menuOpen: false,
      about: false,
      // One page per opening: a different combination each session.
      blocks: pickNotes({ count: 7 }),
    };
    let corruptions = [];
    let surfaces = [];
    let damageStates = [];
    let destroyed = false;

    const releaseSurfaces = () => {
      for (const unregister of surfaces) unregister();
      surfaces = [];
    };

    const releaseCorruptions = () => {
      for (const controller of corruptions) controller.destroy();
      corruptions = [];
    };

    /** The note's lines, resolved in the current language on every render. */
    function linesOf(block) {
      return t(block.key)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    }

    /** Saved cleaning for one note, plus whether it is fully readable. */
    function readNote(block) {
      const cleaned = new Set(progression.getNoteCleaning(block.id));
      const complete =
        !block.corrupted ||
        progression.hasNote(block.id) ||
        cleaned.size >= block.shards;
      return { cleaned, complete };
    }

    function finishNote(block, damageEl, shards) {
      progression.unlockNote(block.id);
      damageEl?.classList.add("is-open");
      window.setTimeout(() => damageEl?.remove(), SHARD_RECOVER_MS + 120);
      for (const shard of shards) {
        if (shard.controller && !shard.cleaned) {
          shard.cleaned = true;
          shard.el.classList.add("is-dissolving");
          shard.controller.recover({ duration: SHARD_RECOVER_MS });
        }
      }
    }

    function cleanShard(block, state_, point) {
      if (destroyed || state_.complete) return 0;
      const area = state_.damageEl.getBoundingClientRect();
      const reach = Math.max(10, Number(point.radius) || 42) * 0.9;
      let nearest = null;
      let nearestDistance = Infinity;

      for (const shard of state_.shards) {
        if (shard.cleaned) continue;
        const rect = shard.el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        const left = rect.left - area.left;
        const top = rect.top - area.top;
        const right = left + rect.width;
        const bottom = top + rect.height;
        const x = Math.min(Math.max(point.x, left), right);
        const y = Math.min(Math.max(point.y, top), bottom);
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance > reach || distance >= nearestDistance) continue;
        nearest = shard;
        nearestDistance = distance;
      }

      if (!nearest) return 0;
      nearest.cleaned = true;
      nearest.el.classList.add("is-dissolving");
      progression.markNoteFragment(block.id, nearest.id);
      nearest.controller.recover({ duration: SHARD_RECOVER_MS });
      state_.cleanedCount += 1;

      if (state_.cleanedCount >= block.shards) {
        state_.complete = true;
        finishNote(block, state_.damageEl, state_.shards);
      }
      return 1;
    }

    /** One damaged note: readable text under an opaque cell grid. */
    function renderCorrupted(block, lines, index) {
      const saved = readNote(block);
      const section = el("section", { class: "notes__block is-corrupted" }, [
        el("p", {
          class: "notes__block-label",
          text: t("notes.entryLabel", { n: String(index + 1).padStart(2, "0") }),
        }),
      ]);

      if (saved.complete) {
        section.classList.add("is-read");
        section.append(
          ...lines.map((line) => el("p", { class: "notes__line", text: line })),
        );
        return section;
      }

      const surface = el("div", { class: "notes__surface" }, [
        ...lines.map((line) => el("p", { class: "notes__line", text: line })),
      ]);
      const damage = el("div", {
        class: "notes__damage",
        "data-cleanable": "notes",
        "aria-hidden": "true",
      });

      const state_ = {
        damageEl: damage,
        shards: [],
        cleanedCount: Math.min(saved.cleaned.size, block.shards),
        complete: false,
      };

      for (let cell = 1; cell <= block.shards; cell += 1) {
        const shardId = `cell-${cell}`;
        if (saved.cleaned.has(shardId)) {
          damage.append(
            el("span", { class: "notes__shard is-cleaned", "aria-hidden": "true" }),
          );
          continue;
        }
        const shard = createCorruptionBlock({
          intensity: cell % 2 === 0 ? "medium" : "heavy",
          seed: `${block.id}:${shardId}`,
          className: "notes__shard",
        });
        shard.el.dataset.shard = shardId;
        damage.append(shard.el);
        corruptions.push(shard.controller);
        state_.shards.push({
          id: shardId,
          el: shard.el,
          controller: shard.controller,
          cleaned: false,
        });
      }

      surface.append(damage);
      section.append(surface);
      damageStates.push(state_);

      if (ctx.brush && typeof ctx.brush.registerSurface === "function") {
        const unregister = ctx.brush.registerSurface({
          root: damage,
          cleanAt: (point) => cleanShard(block, state_, point),
        });
        if (unregister) surfaces.push(unregister);
      }

      return section;
    }

    const render = () => {
      if (destroyed) return;
      // Rebuilds (language switch) replace the canvases; release the observers.
      releaseCorruptions();
      releaseSurfaces();
      damageStates = [];
      clear(root);

      const renderBlock = (block, index) => {
        const lines = linesOf(block);
        if (block.corrupted && block.shards > 0) {
          return renderCorrupted(block, lines, index);
        }
        return el("section", { class: "notes__block is-read" }, [
          el("p", {
            class: "notes__block-label",
            text: t("notes.entryLabel", { n: String(index + 1).padStart(2, "0") }),
          }),
          ...lines.map((line) => el("p", { class: "notes__line", text: line })),
        ]);
      };

      const menuItems = [
        el("button", {
          class: "notes__menu-item",
          type: "button",
          role: "menuitem",
          text: t("notes.fileAbout"),
          on: {
            click: () => {
              state.menuOpen = false;
              state.about = true;
              render();
            },
          },
        }),
        el("button", {
          class: "notes__menu-item",
          type: "button",
          role: "menuitem",
          text: t("notes.fileClose"),
          on: {
            click: () => {
              state.menuOpen = false;
              ctx.close?.();
            },
          },
        }),
      ];

      const menuButton = el("button", {
        class: "notes__menu-btn raised",
        type: "button",
        text: t("notes.file"),
        "aria-haspopup": "menu",
        "aria-expanded": state.menuOpen ? "true" : "false",
        on: {
          click: (event) => {
            event.stopPropagation();
            state.menuOpen = !state.menuOpen;
            render();
          },
        },
      });

      const menu = state.menuOpen
        ? el("div", { class: "notes__menu raised", role: "menu" }, menuItems)
        : null;

      const page = el("div", { class: "notes__page sunken" }, [
        el("div", { class: "notes__text" }, state.blocks.map(renderBlock)),
      ]);

      const about = state.about
        ? el("div", { class: "notes__about" }, [
            el("p", { class: "notes__about-text", text: t("notes.aboutText") }),
            el("button", {
              class: "notes__about-close raised",
              type: "button",
              text: t("notes.aboutClose"),
              on: {
                click: () => {
                  state.about = false;
                  render();
                },
              },
            }),
          ])
        : null;

      root.append(
        el("div", { class: "notes__menubar" }, [menuButton, menu]),
        el("div", { class: "notes__document" }, [page, about]),
        el("p", { class: "app__note", text: t("notes.timedNote") }),
        el("div", { class: "statusbar" }, [
          el("div", {
            class: "statusbar__cell statusbar__cell--grow sunken",
            text: t("notes.status"),
          }),
        ]),
      );
    };

    // Clicking anywhere else closes the open File menu.
    const closeMenu = () => {
      if (!state.menuOpen) return;
      state.menuOpen = false;
      render();
    };
    const onDocumentPointerDown = (event) => {
      if (!root.contains(event.target)) closeMenu();
      else if (!event.target.closest(".notes__menubar")) closeMenu();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape" && state.menuOpen) closeMenu();
    };

    render();
    body.append(root);
    document.addEventListener("pointerdown", onDocumentPointerDown);
    document.addEventListener("keydown", onKeyDown);
    const stop = onLocaleChange(render);

    return () => {
      destroyed = true;
      stop();
      releaseCorruptions();
      releaseSurfaces();
      damageStates = [];
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  },
};
