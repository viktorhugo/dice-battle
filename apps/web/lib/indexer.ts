/**
 * Shim — re-exports everything from the repository layer.
 *
 * Consumers can keep their existing import paths. Migrate them to
 * @/lib/repository when convenient, then delete this file.
 */
export {
  getOpenRooms,
  getOpenRoomsPage,
  getRoomById,
  getRoomCreatedAt,
  getRoomsCreatedAt,
  getActiveRoomsByPlayer,
  getMatchedRoomsAsGuest,
  getPlayerProfile,
  getPlayerMiniStats,
  getLeaderboardAllTime,
  getLeaderboardPeriod,
  getLiveStats,
  getHeadToHead,
  getContractStats,
  getRepository,
} from "./repository";

export type {
  Room as IndexerRoom,
  Room as IndexerProfileRoom,
  Room as ActiveIndexerRoom,
  Player as IndexerPlayer,
  LeaderboardEntry,
  LiveStats,
  PlayerMiniStats,
  H2HSummary,
  ContractStats,
  RecentGame,
  SortKey,
  LeaderboardTab,
} from "./repository/types";
