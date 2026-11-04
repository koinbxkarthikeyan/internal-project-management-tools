/** A choice a person made that should still be there when they come back (the List / Board layout of a page): kept in this browser, read and written safely. */
const key = (name: string) => `koinbx.pref.${name}`;

export function readPref(name: string): string | null {
  try {
    return localStorage.getItem(key(name));
  } catch {
    return null;
  }
}

export function writePref(name: string, value: string): void {
  try {
    localStorage.setItem(key(name), value);
  } catch {
    // the choice just is not kept
  }
}
