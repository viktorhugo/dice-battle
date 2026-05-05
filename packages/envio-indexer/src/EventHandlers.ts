import {
  DiceBattle,
  DiceBattle_RoomCancelled,
  DiceBattle_RoomCreated,
  DiceBattle_RoomExpiredClaim,
  DiceBattle_RoomJoined,
  DiceBattle_RoomResolved,
  DiceBattle_RoomTied,
  Player,
  Room,
} from "generated";

function newPlayer(address: string): Player {
  return {
    id: address,
    totalGames: 0n,
    wins: 0n,
    losses: 0n,
    ties: 0n,
    totalVolume: 0n,
    totalWon: 0n,
    totalLost: 0n,
    lastGameAt: 0n,
    currentStreak: 0n,
    longestStreak: 0n,
  };
}

// ─── Raw event handlers ───────────────────────────────────────────────────────

DiceBattle.RoomCreated.handler(async ({ event, context }) => {
  const raw: DiceBattle_RoomCreated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    roomId: event.params.roomId,
    playerA: event.params.playerA,
    token: event.params.token,
    stake: event.params.stake,
    commitment: event.params.commitment,
  };
  context.DiceBattle_RoomCreated.set(raw);

  const room: Room = {
    id: event.params.roomId.toString(),
    state: "OPEN",
    playerA: event.params.playerA.toLowerCase(),
    playerB: undefined,
    token: event.params.token.toLowerCase(),
    stake: event.params.stake,
    winner: undefined,
    rollA1: undefined,
    rollA2: undefined,
    rollB1: undefined,
    rollB2: undefined,
    createdAt: BigInt(event.block.timestamp),
    resolvedAt: undefined,
    txCreate: event.transaction.hash,
    txResolve: undefined,
  };
  context.Room.set(room);
});

DiceBattle.RoomJoined.handler(async ({ event, context }) => {
  const raw: DiceBattle_RoomJoined = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    roomId: event.params.roomId,
    playerB: event.params.playerB,
    matchedAtBlock: event.params.matchedAtBlock,
  };
  context.DiceBattle_RoomJoined.set(raw);

  const room = await context.Room.get(event.params.roomId.toString());
  if (!room) return;
  context.Room.set({ ...room, state: "MATCHED", playerB: event.params.playerB.toLowerCase() });
});

DiceBattle.RoomResolved.handler(async ({ event, context }) => {
  const raw: DiceBattle_RoomResolved = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    roomId: event.params.roomId,
    winner: event.params.winner,
    rollA1: event.params.rollA1,
    rollA2: event.params.rollA2,
    rollB1: event.params.rollB1,
    rollB2: event.params.rollB2,
    payout: event.params.payout,
    fee: event.params.fee,
  };
  context.DiceBattle_RoomResolved.set(raw);

  const room = await context.Room.get(event.params.roomId.toString());
  if (!room) return;

  const winner = event.params.winner.toLowerCase();
  const loser = winner === room.playerA ? room.playerB! : room.playerA;
  const ts = BigInt(event.block.timestamp);

  context.Room.set({
    ...room,
    state: "RESOLVED",
    winner,
    rollA1: Number(event.params.rollA1),
    rollA2: Number(event.params.rollA2),
    rollB1: Number(event.params.rollB1),
    rollB2: Number(event.params.rollB2),
    resolvedAt: ts,
    txResolve: event.transaction.hash,
  });

  // Winner stats
  const winnerStats = (await context.Player.get(winner)) ?? newPlayer(winner);
  const newStreak = winnerStats.currentStreak + 1n;
  context.Player.set({
    ...winnerStats,
    totalGames: winnerStats.totalGames + 1n,
    wins: winnerStats.wins + 1n,
    totalVolume: winnerStats.totalVolume + room.stake,
    totalWon: winnerStats.totalWon + event.params.payout,
    lastGameAt: ts,
    currentStreak: newStreak,
    longestStreak: newStreak > winnerStats.longestStreak ? newStreak : winnerStats.longestStreak,
  });

  // Loser stats
  const loserStats = (await context.Player.get(loser)) ?? newPlayer(loser);
  context.Player.set({
    ...loserStats,
    totalGames: loserStats.totalGames + 1n,
    losses: loserStats.losses + 1n,
    totalVolume: loserStats.totalVolume + room.stake,
    totalLost: loserStats.totalLost + room.stake,
    lastGameAt: ts,
    currentStreak: 0n,
  });
});

DiceBattle.RoomTied.handler(async ({ event, context }) => {
  const raw: DiceBattle_RoomTied = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    roomId: event.params.roomId,
    rollA1: event.params.rollA1,
    rollA2: event.params.rollA2,
    rollB1: event.params.rollB1,
    rollB2: event.params.rollB2,
  };
  context.DiceBattle_RoomTied.set(raw);

  const room = await context.Room.get(event.params.roomId.toString());
  if (!room) return;

  const ts = BigInt(event.block.timestamp);

  context.Room.set({
    ...room,
    state: "TIED",
    rollA1: Number(event.params.rollA1),
    rollA2: Number(event.params.rollA2),
    rollB1: Number(event.params.rollB1),
    rollB2: Number(event.params.rollB2),
    resolvedAt: ts,
  });

  // Both players tie — increment ties, reset streak
  for (const addr of [room.playerA, room.playerB!]) {
    if (!addr) continue;
    const stats = (await context.Player.get(addr)) ?? newPlayer(addr);
    context.Player.set({
      ...stats,
      totalGames: stats.totalGames + 1n,
      ties: stats.ties + 1n,
      totalVolume: stats.totalVolume + room.stake,
      lastGameAt: ts,
      currentStreak: 0n,
    });
  }
});

DiceBattle.RoomExpiredClaim.handler(async ({ event, context }) => {
  const raw: DiceBattle_RoomExpiredClaim = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    roomId: event.params.roomId,
    claimer: event.params.claimer,
  };
  context.DiceBattle_RoomExpiredClaim.set(raw);

  const room = await context.Room.get(event.params.roomId.toString());
  if (!room) return;
  context.Room.set({ ...room, state: "EXPIRED", resolvedAt: BigInt(event.block.timestamp) });
});

DiceBattle.RoomCancelled.handler(async ({ event, context }) => {
  const raw: DiceBattle_RoomCancelled = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    roomId: event.params.roomId,
  };
  context.DiceBattle_RoomCancelled.set(raw);

  const room = await context.Room.get(event.params.roomId.toString());
  if (!room) return;
  context.Room.set({ ...room, state: "CANCELLED" });
});
