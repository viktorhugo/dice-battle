import type {
  Room,
  Player,
  LeaderboardEntry,
  LiveStats,
  PlayerMiniStats,
  H2HSummary,
  ContractStats,
} from "./types";

export interface IGameRepository {
  getOpenRooms(limit?: number): Promise<Room[]>;

  getOpenRoomsPage(
    page: number,
    pageSize?: number,
    excludeAddress?: string
  ): Promise<{ rooms: Room[]; total: number }>;

  getRoomById(roomId: string): Promise<Room | null>;

  getRoomCreatedAt(roomId: string): Promise<number | null>;

  getRoomsCreatedAt(ids: string[]): Promise<Record<string, number>>;

  getActiveRoomsByPlayer(address: string): Promise<Room[]>;

  getMatchedRoomsAsGuest(address: string): Promise<Room[]>;

  getPlayerProfile(address: string): Promise<{
    player: Player | null;
    rooms: Room[];
  }>;

  getPlayerMiniStats(address: string): Promise<PlayerMiniStats | null>;

  getLeaderboardAllTime(limit?: number): Promise<LeaderboardEntry[]>;

  getLeaderboardPeriod(sinceSeconds: number): Promise<LeaderboardEntry[]>;

  getLiveStats(excludeAddress?: string): Promise<LiveStats>;

  getHeadToHead(
    myAddress: string,
    opponentAddress: string
  ): Promise<H2HSummary | null>;

  getContractStats(): Promise<ContractStats>;
}
