/**
 * DREAM LOG — six damaged records recovered with the Sacred Digital brush.
 *
 * Each record is readable text underneath a two-by-three damaged surface. The
 * shared corruption canvas supplies the visual language; each erased cell is
 * stored in progression.dreamCleaning, so a partial cleaning survives a
 * refresh. The brush is the existing desktop tool, registered here as an
 * in-window surface; this app never creates a second cleaning mechanic.
 *
 * When the last cell of a record is erased, the record is unlocked in
 * progression.dreams and M.I.L.O. reacts once. The reaction is stored as a
 * narrative event, so closing and reopening the log cannot repeat it.
 */
import { el, clear } from "../core/dom.js";
import { progression } from "../core/progression.js";
import { t, onLocaleChange } from "../i18n/index.js";
import { dreamPages } from "../data/dreams.js";
import { createCorruptionBlock } from "../ui/corruption.js";

const BRUSH_TOOL_ID = "sacred-digital-brush";
const REACTION_HOLD_MS = 22_000;

function paragraphs(record) {
  return t(record.bodyKey)
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function cleanedSet(record) {
  return new Set(progression.getDreamCleaning(record.id));
}

function isComplete(record, cleaned = cleanedSet(record)) {
  return (
    progression.hasDream(record.id) ||
    cleaned.size >= Math.max(1, record.shards)
  );
}

function recordChipKey(cleanedCount, total) {
  if (cleanedCount >= total) return "dreams.statusRead";
  if (cleanedCount > 0) return "dreams.statusCleaning";
  return "dreams.statusCorrupted";
}

export const dreamsApp = {
  id: "dreams",
  titleKey: "app.dreams.title",
  icon: "assets/icons/dreams.svg",
  size: { w: 640, h: 560 },

  mount(body, ctx) {
    const root = el("div", { class: "app app--dreams" });
    const timers = new Set();
    const controllers = [];
    const surfaces = [];
    const records = [];
    let scrollTop = 0;
    let listEl = null;
    let metaEl = null;
    let statusEl = null;
    let noteEl = null;
    let destroyed = false;

    function schedule(callback, delay) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!destroyed) callback();
      }, delay);
      timers.add(timer);
      return timer;
    }

    function readableCount() {
      return records.filter((item) => item.complete).length;
    }

    function updateMeta() {
      const count = readableCount();
      if (metaEl) {
        metaEl.textContent = t("dreams.pages", {
          n: count,
          total: dreamPages.length,
        });
      }
      if (statusEl) {
        statusEl.textContent = t("dreams.pages", {
          n: count,
          total: dreamPages.length,
        });
      }
      if (noteEl) {
        if (count >= dreamPages.length) noteEl.textContent = t("dreams.allRead");
        else if (!progression.hasTool(BRUSH_TOOL_ID)) {
          noteEl.textContent = t("dreams.brushLocked");
        } else {
          noteEl.textContent = t("dreams.cleaningHint");
        }
      }
    }

    function announce(record) {
      if (!ctx.mascot || typeof ctx.mascot.showLine !== "function") return;
      const eventId = `dream-read:${record.id}`;
      if (progression.hasEvent(eventId)) return;
      const opened = ctx.mascot.showLine({
        key: record.commentKey,
        tone: "event",
        holdMs: REACTION_HOLD_MS,
      });
      // If a blocking tutorial owned the bubble, leave the event unrecorded so
      // the first moment M.I.L.O. can speak is still treated as the first read.
      if (opened) progression.completeEvent(eventId);
    }

    function finishRecord(record, state) {
      if (state.complete) return;
      state.complete = true;
      progression.unlockDream(record.id);
      state.recordEl.classList.remove("is-corrupted");
      state.recordEl.classList.add("is-read");
      state.bodyEl.removeAttribute("aria-hidden");
      state.srNote?.remove();
      state.damageEl?.classList.add("is-open");
      state.unregister?.();
      state.unregister = null;
      state.chip.textContent = t("dreams.statusRead");
      state.chip.className = "dreams__chip is-read";
      updateMeta();
      announce(record);
      schedule(() => {
        state.damageEl?.remove();
        state.damageEl = null;
      }, 240);
    }

    function cleanShard(record, state, point) {
      if (state.complete || !state.damageEl) return 0;
      const area = state.damageEl.getBoundingClientRect();
      const reach = Math.max(8, Number(point.radius) || 42) * 0.9;
      let nearest = null;
      let nearestDistance = Infinity;

      for (const shard of state.shards) {
        if (shard.cleaning) continue;
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
      nearest.cleaning = true;
      nearest.el.classList.add("is-dissolving");
      nearest.el.style.pointerEvents = "none";
      progression.markDreamFragment(record.id, nearest.id);
      nearest.controller.recover({ duration: 320 });
      state.cleanedCount = Math.min(record.shards, state.cleanedCount + 1);
      state.chip.textContent =
        state.cleanedCount >= record.shards
          ? t("dreams.statusRead")
          : t("dreams.statusCleaning", {
              n: state.cleanedCount,
              total: record.shards,
            });
      state.chip.classList.toggle("is-progress", state.cleanedCount > 0);

      if (state.cleanedCount >= record.shards) {
        schedule(() => finishRecord(record, state), 340);
      }
      return 1;
    }

    function renderRecord(record) {
      const cleaned = cleanedSet(record);
      let complete = isComplete(record, cleaned);
      // Repair the rare case where every shard was saved just before a close.
      if (!complete && cleaned.size >= record.shards) {
        progression.unlockDream(record.id);
        complete = true;
      }

      const chip = el("span", {
        class: `dreams__chip${complete ? " is-read" : cleaned.size ? " is-progress" : ""}`,
        text: complete
          ? t("dreams.statusRead")
          : cleaned.size
            ? t("dreams.statusCleaning", {
                n: Math.min(cleaned.size, record.shards),
                total: record.shards,
              })
            : t("dreams.statusCorrupted"),
      });

      const heading = el("div", { class: "dreams__heading" }, [
        el("span", {
          class: "dreams__index",
          text: t("dreams.recordLabel", { n: record.number }),
        }),
        el("h2", { class: "dreams__title", text: t(record.titleKey) }),
      ]);

      const article = el(
        "article",
        {
          class: `dreams__page ${complete ? "is-read" : "is-corrupted"}`,
          role: "listitem",
          dataset: { scene: record.scene, dream: record.id },
        },
        [
          el("header", { class: "dreams__page-head" }, [
            el("span", {
              class: "dreams__scene",
              dataset: { scene: record.scene },
              "aria-hidden": "true",
            }),
            heading,
            chip,
          ]),
        ],
      );

      const memory = el("div", {
        class: `dreams__memory${complete ? "" : " is-damaged"}`,
      });
      const bodyEl = el(
        "div",
        {
          class: "dreams__page-body",
          ...(complete ? {} : { "aria-hidden": "true" }),
        },
        paragraphs(record).map((line) =>
          el("p", { class: "dreams__line", text: line }),
        ),
      );
      memory.append(bodyEl);

      const srNote = complete
        ? null
        : el("p", {
            class: "visually-hidden",
            text: t("dreams.corruptedBody"),
          });
      if (srNote) article.append(srNote);
      article.append(memory);

      const state = {
        recordEl: article,
        bodyEl,
        memory,
        chip,
        srNote,
        damageEl: null,
        shards: [],
        cleanedCount: Math.min(cleaned.size, record.shards),
        complete,
        unregister: null,
      };
      records.push(state);

      if (!complete) {
        const damage = el("div", {
          class: "dreams__damage",
          "data-cleanable": "dreams",
          "aria-hidden": "true",
        });

        for (let index = 1; index <= record.shards; index += 1) {
          const shardId = `shard-${index}`;
          if (cleaned.has(shardId)) {
            const gone = el("span", {
              class: "dreams__shard is-cleaned",
              "aria-hidden": "true",
            });
            damage.append(gone);
            continue;
          }
          const shard = createCorruptionBlock({
            intensity: index % 3 === 0 ? "heavy" : "medium",
            seed: `${record.id}:${shardId}`,
            className: "dreams__shard",
          });
          shard.el.dataset.shard = shardId;
          damage.append(shard.el);
          controllers.push(shard.controller);
          state.shards.push({
            id: shardId,
            el: shard.el,
            controller: shard.controller,
            cleaning: false,
          });
        }

        memory.append(damage);
        state.damageEl = damage;
        if (ctx.brush && typeof ctx.brush.registerSurface === "function") {
          state.unregister = ctx.brush.registerSurface({
            root: damage,
            cleanAt: (point) => cleanShard(record, state, point),
          });
          if (state.unregister) surfaces.push(state.unregister);
        }
      }

      listEl.append(article);
    }

    const render = () => {
      if (destroyed) return;
      if (listEl) scrollTop = listEl.scrollTop;
      // Language switches rebuild the canvases and registered surfaces.
      for (const controller of controllers) controller.destroy();
      controllers.length = 0;
      for (const unregister of surfaces) unregister();
      surfaces.length = 0;
      records.length = 0;
      clear(root);

      listEl = el("div", {
        class: "dreams__list sunken",
        role: "list",
        "aria-label": t("dreams.listLabel"),
      });

      dreamPages.forEach(renderRecord);

      metaEl = el("span", {
        class: "app__meta",
        text: t("dreams.pages", {
          n: readableCount(),
          total: dreamPages.length,
        }),
      });
      noteEl = el("p", { class: "app__note" });
      statusEl = el("div", {
        class: "statusbar__cell statusbar__cell--grow sunken",
        text: t("dreams.pages", {
          n: readableCount(),
          total: dreamPages.length,
        }),
      });

      root.append(
        el("div", { class: "app__head" }, [
          el("span", { class: "app__label", text: t("dreams.listLabel") }),
          metaEl,
        ]),
        listEl,
        noteEl,
        el("div", { class: "statusbar" }, [
          statusEl,
          el("div", {
            class: "statusbar__cell statusbar__cell--tight sunken",
            text: t("dreams.archiveLabel"),
          }),
        ]),
      );

      updateMeta();
      listEl.scrollTop = scrollTop;
    };

    render();
    body.append(root);
    const stop = onLocaleChange(render);
    return () => {
      destroyed = true;
      stop();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      for (const unregister of surfaces) unregister();
      surfaces.length = 0;
      for (const controller of controllers) controller.destroy();
      controllers.length = 0;
    };
  },
};
