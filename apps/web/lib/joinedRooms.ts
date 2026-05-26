const KEY = "dice-battle:joined-rooms";

export function storeJoinedRoom(roomId: string) {
  if (typeof window === "undefined") return;
  try {
    const existing = getJoinedRoomIds();
    if (!existing.includes(roomId)) {
      localStorage.setItem(KEY, JSON.stringify([...existing, roomId]));
    }
  } catch {}
}

export function getJoinedRoomIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

export function removeJoinedRoom(roomId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(getJoinedRoomIds().filter((id) => id !== roomId)));
  } catch {}
}
