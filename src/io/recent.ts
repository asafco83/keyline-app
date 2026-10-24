// SVGcinema — io/recent
// Main menu › Open recent: the last projects opened or saved, newest first. Where the browser can
// reopen files (Chrome, Edge: File System Access) an entry keeps the file's handle and opens the file
// itself, asking for permission again if the browser wants it. Elsewhere an entry keeps a copy of the
// project as it was when it was last opened or saved (only the newest few copies, to save space).
// Everything stays in this browser (IndexedDB key 'recent').
import { IDB } from './assets';
import { confirmDiscard } from './guard';
import { loadProjectFile, toast } from './open';

export interface RecentEntry {
  /** the file name, e.g. "Logo intro.SVGcinema" */
  name: string;
  /** when it was last opened or saved (ms) */
  at: number;
  handle?: FileSystemFileHandle | null;
  /** a copy of the project, where there is no handle */
  blob?: Blob | null;
}

const MAX = 8,
  MAX_COPIES = 4,
  MAX_COPY_BYTES = 40 * 1024 * 1024;
let list: RecentEntry[] = [],
  loaded: Promise<void> | null = null;

export function loadRecent() {
  if (!loaded)
    loaded = IDB.get('recent').then(v => {
      list = Array.isArray(v) ? v.filter(e => e && e.name) : [];
    });
  return loaded;
}
export function recentList(): readonly RecentEntry[] {
  return list;
}
async function store() {
  if (await IDB.set('recent', list)) return;
  // a handle that can't be stored (some browsers): keep the names and copies
  list = list.map(e => ({ ...e, handle: null }));
  await IDB.set('recent', list);
}
async function same(a: RecentEntry, name: string, handle: FileSystemFileHandle | null) {
  if (handle && a.handle && (a.handle as any).isSameEntry) {
    try {
      return await (a.handle as any).isSameEntry(handle);
    } catch (_) {}
  }
  return !handle && !a.handle && a.name === name;
}
/** Remember a project that was just opened or saved: by its handle, else as a copy (`blob`). */
export async function addRecent(name: string, handle: FileSystemFileHandle | null, blob: Blob | null) {
  await loadRecent();
  const keep: RecentEntry[] = [];
  for (const e of list) if (!(await same(e, name, handle))) keep.push(e);
  const copy = !handle && blob && blob.size <= MAX_COPY_BYTES ? blob : null;
  if (!handle && !copy) {
    list = keep;
    return store();
  }
  list = [{ name, at: Date.now(), handle: handle || null, blob: copy }, ...keep].slice(0, MAX);
  // only the newest few copies are kept
  let copies = 0;
  list = list.filter(e => e.handle || (e.blob && ++copies <= MAX_COPIES));
  return store();
}
export async function clearRecent() {
  list = [];
  await IDB.set('recent', []);
  toast('The recent projects list is cleared.');
}
/** a short "when" for the menu: Today, Yesterday, or the date */
export function recentWhen(at: number, now = Date.now()) {
  const d = new Date(at),
    n = new Date(now),
    day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(),
    diff = Math.round((day(n) - day(d)) / 864e5);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(diff > 300 ? { year: 'numeric' } : {}),
  });
}
export async function openRecent(i: number) {
  const e = list[i];
  if (!e) return;
  if (!(await confirmDiscard('Opening another project closes this one. Save your changes first?'))) return;
  if (e.handle) {
    try {
      const h: any = e.handle;
      if (h.queryPermission && (await h.queryPermission({ mode: 'readwrite' })) !== 'granted') {
        if ((await h.requestPermission({ mode: 'readwrite' })) !== 'granted') {
          toast(`SVGcinema needs your permission to open ${e.name}.`);
          return;
        }
      }
      const f: File = await h.getFile();
      await loadProjectFile(f, h);
      return;
    } catch (err) {
      list = list.filter(x => x !== e);
      await store();
      toast(`Couldn’t find ${e.name}: it may have been moved, renamed or deleted.`);
      return;
    }
  }
  if (e.blob) {
    const ok = await loadProjectFile(new File([e.blob], e.name, { type: 'application/zip' }), null);
    const w = recentWhen(e.at);
    if (ok)
      toast(
        `Opened the copy of ${e.name} from ${/^(Today|Yesterday)$/.test(w) ? w.toLowerCase() : w}. Save writes a new file.`,
      );
  }
}
