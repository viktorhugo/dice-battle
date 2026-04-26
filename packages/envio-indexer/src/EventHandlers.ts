/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
import {
  DiceBattle,
  DiceBattle_RoomCancelled,
  DiceBattle_RoomCreated,
  DiceBattle_RoomExpiredClaim,
  DiceBattle_RoomJoined,
  DiceBattle_RoomResolved,
  DiceBattle_RoomTied,
} from "generated";

DiceBattle.RoomCancelled.handler(async ({ event, context }) => {
  const entity: DiceBattle_RoomCancelled = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    roomId: event.params.roomId,
  };

  context.DiceBattle_RoomCancelled.set(entity);
});

DiceBattle.RoomCreated.handler(async ({ event, context }) => {
  const entity: DiceBattle_RoomCreated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    roomId: event.params.roomId,
    playerA: event.params.playerA,
    token: event.params.token,
    stake: event.params.stake,
    commitment: event.params.commitment,
  };

  context.DiceBattle_RoomCreated.set(entity);
});

DiceBattle.RoomExpiredClaim.handler(async ({ event, context }) => {
  const entity: DiceBattle_RoomExpiredClaim = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    roomId: event.params.roomId,
    claimer: event.params.claimer,
  };

  context.DiceBattle_RoomExpiredClaim.set(entity);
});

DiceBattle.RoomJoined.handler(async ({ event, context }) => {
  const entity: DiceBattle_RoomJoined = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    roomId: event.params.roomId,
    playerB: event.params.playerB,
    matchedAtBlock: event.params.matchedAtBlock,
  };

  context.DiceBattle_RoomJoined.set(entity);
});

DiceBattle.RoomResolved.handler(async ({ event, context }) => {
  const entity: DiceBattle_RoomResolved = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    roomId: event.params.roomId,
    winner: event.params.winner,
    rollA: event.params.rollA,
    rollB: event.params.rollB,
    payout: event.params.payout,
    fee: event.params.fee,
  };

  context.DiceBattle_RoomResolved.set(entity);
});

DiceBattle.RoomTied.handler(async ({ event, context }) => {
  const entity: DiceBattle_RoomTied = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    roomId: event.params.roomId,
    rollA: event.params.rollA,
    rollB: event.params.rollB,
  };

  context.DiceBattle_RoomTied.set(entity);
});
