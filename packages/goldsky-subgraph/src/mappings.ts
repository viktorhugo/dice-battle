import { BigInt } from "@graphprotocol/graph-ts";
import {
  RoomCancelled,
  RoomCreated,
  RoomExpiredClaim,
  RoomJoined,
  RoomResolved,
  RoomTied,
} from "../generated/DiceBattle/DiceBattle";
import { GlobalStats, Player, Room, TokenVolume } from "../generated/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrCreatePlayer(address: string): Player {
  let player = Player.load(address);
  if (!player) {
    player = new Player(address);
    player.totalGames   = BigInt.fromI32(0);
    player.wins         = BigInt.fromI32(0);
    player.losses       = BigInt.fromI32(0);
    player.ties         = BigInt.fromI32(0);
    player.totalVolume  = BigInt.fromI32(0);
    player.totalWon     = BigInt.fromI32(0);
    player.totalLost    = BigInt.fromI32(0);
    player.lastGameAt   = BigInt.fromI32(0);
    player.currentStreak  = BigInt.fromI32(0);
    player.longestStreak  = BigInt.fromI32(0);
  }
  return player as Player;
}

function getOrCreateGlobalStats(): GlobalStats {
  let gs = GlobalStats.load("global");
  if (!gs) {
    gs = new GlobalStats("global");
    gs.open          = BigInt.fromI32(0);
    gs.matched       = BigInt.fromI32(0);
    gs.resolved      = BigInt.fromI32(0);
    gs.tied          = BigInt.fromI32(0);
    gs.expired       = BigInt.fromI32(0);
    gs.totalFinished = BigInt.fromI32(0);
  }
  return gs as GlobalStats;
}

function getOrCreateTokenVolume(token: string): TokenVolume {
  let tv = TokenVolume.load(token);
  if (!tv) {
    tv = new TokenVolume(token);
    tv.volume = BigInt.fromI32(0);
  }
  return tv as TokenVolume;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export function handleRoomCreated(event: RoomCreated): void {
  const room = new Room(event.params.roomId.toString());
  room.state      = "OPEN";
  room.playerA    = event.params.playerA.toHexString().toLowerCase();
  room.playerB    = null;
  room.token      = event.params.token.toHexString().toLowerCase();
  room.stake      = event.params.stake;
  room.winner     = null;
  room.rollA1     = null;
  room.rollA2     = null;
  room.rollB1     = null;
  room.rollB2     = null;
  room.createdAt  = event.block.timestamp;
  room.resolvedAt = null;
  room.txCreate   = event.transaction.hash.toHexString();
  room.txResolve  = null;
  room.save();

  const gs = getOrCreateGlobalStats();
  gs.open = gs.open.plus(BigInt.fromI32(1));
  gs.save();
}

export function handleRoomJoined(event: RoomJoined): void {
  const room = Room.load(event.params.roomId.toString());
  if (!room) return;
  room.state   = "MATCHED";
  room.playerB = event.params.playerB.toHexString().toLowerCase();
  room.save();

  const gs = getOrCreateGlobalStats();
  gs.open    = gs.open.minus(BigInt.fromI32(1));
  gs.matched = gs.matched.plus(BigInt.fromI32(1));
  gs.save();
}

export function handleRoomResolved(event: RoomResolved): void {
  const room = Room.load(event.params.roomId.toString());
  if (!room) return;

  const winner = event.params.winner.toHexString().toLowerCase();
  const ts = event.block.timestamp;

  room.state      = "RESOLVED";
  room.winner     = winner;
  room.rollA1     = event.params.rollA1;
  room.rollA2     = event.params.rollA2;
  room.rollB1     = event.params.rollB1;
  room.rollB2     = event.params.rollB2;
  room.resolvedAt = ts;
  room.txResolve  = event.transaction.hash.toHexString();
  room.save();

  const gs = getOrCreateGlobalStats();
  gs.matched       = gs.matched.minus(BigInt.fromI32(1));
  gs.resolved      = gs.resolved.plus(BigInt.fromI32(1));
  gs.totalFinished = gs.totalFinished.plus(BigInt.fromI32(1));
  gs.save();

  const tv = getOrCreateTokenVolume(room.token);
  tv.volume = tv.volume.plus(room.stake.times(BigInt.fromI32(2)));
  tv.save();

  const winnerStats = getOrCreatePlayer(winner);
  const newStreak   = winnerStats.currentStreak.plus(BigInt.fromI32(1));
  winnerStats.totalGames    = winnerStats.totalGames.plus(BigInt.fromI32(1));
  winnerStats.wins          = winnerStats.wins.plus(BigInt.fromI32(1));
  winnerStats.totalVolume   = winnerStats.totalVolume.plus(room.stake);
  winnerStats.totalWon      = winnerStats.totalWon.plus(event.params.payout);
  winnerStats.lastGameAt    = ts;
  winnerStats.currentStreak = newStreak;
  if (newStreak > winnerStats.longestStreak) winnerStats.longestStreak = newStreak;
  winnerStats.save();

  const loser = winner == room.playerA ? room.playerB! : room.playerA;
  const loserStats = getOrCreatePlayer(loser);
  loserStats.totalGames    = loserStats.totalGames.plus(BigInt.fromI32(1));
  loserStats.losses        = loserStats.losses.plus(BigInt.fromI32(1));
  loserStats.totalVolume   = loserStats.totalVolume.plus(room.stake);
  loserStats.totalLost     = loserStats.totalLost.plus(room.stake);
  loserStats.lastGameAt    = ts;
  loserStats.currentStreak = BigInt.fromI32(0);
  loserStats.save();
}

export function handleRoomTied(event: RoomTied): void {
  const room = Room.load(event.params.roomId.toString());
  if (!room) return;

  const ts = event.block.timestamp;
  room.state      = "TIED";
  room.rollA1     = event.params.rollA1;
  room.rollA2     = event.params.rollA2;
  room.rollB1     = event.params.rollB1;
  room.rollB2     = event.params.rollB2;
  room.resolvedAt = ts;
  room.save();

  const gs = getOrCreateGlobalStats();
  gs.matched       = gs.matched.minus(BigInt.fromI32(1));
  gs.tied          = gs.tied.plus(BigInt.fromI32(1));
  gs.totalFinished = gs.totalFinished.plus(BigInt.fromI32(1));
  gs.save();

  const tv = getOrCreateTokenVolume(room.token);
  tv.volume = tv.volume.plus(room.stake.times(BigInt.fromI32(2)));
  tv.save();

  const participants: string[] = [room.playerA];
  if (room.playerB) participants.push(room.playerB!);
  for (let i = 0; i < participants.length; i++) {
    const stats = getOrCreatePlayer(participants[i]);
    stats.totalGames    = stats.totalGames.plus(BigInt.fromI32(1));
    stats.ties          = stats.ties.plus(BigInt.fromI32(1));
    stats.totalVolume   = stats.totalVolume.plus(room.stake);
    stats.lastGameAt    = ts;
    stats.currentStreak = BigInt.fromI32(0);
    stats.save();
  }
}

export function handleRoomExpiredClaim(event: RoomExpiredClaim): void {
  const room = Room.load(event.params.roomId.toString());
  if (!room) return;
  room.state      = "EXPIRED";
  room.resolvedAt = event.block.timestamp;
  room.save();

  const gs = getOrCreateGlobalStats();
  gs.matched = gs.matched.minus(BigInt.fromI32(1));
  gs.expired = gs.expired.plus(BigInt.fromI32(1));
  gs.save();
}

export function handleRoomCancelled(event: RoomCancelled): void {
  const room = Room.load(event.params.roomId.toString());
  if (!room) return;
  room.state = "CANCELLED";
  room.save();

  const gs = getOrCreateGlobalStats();
  gs.open = gs.open.minus(BigInt.fromI32(1));
  gs.save();
}
