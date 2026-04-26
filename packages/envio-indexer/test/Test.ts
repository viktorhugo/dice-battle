import assert from "assert";
import { 
  TestHelpers,
  DiceBattle_RoomCancelled
} from "generated";
const { MockDb, DiceBattle } = TestHelpers;

describe("DiceBattle contract RoomCancelled event tests", () => {
  // Create mock db
  const mockDb = MockDb.createMockDb();

  // Creating mock for DiceBattle contract RoomCancelled event
  const event = DiceBattle.RoomCancelled.createMockEvent({/* It mocks event fields with default values. You can overwrite them if you need */});

  it("DiceBattle_RoomCancelled is created correctly", async () => {
    // Processing the event
    const mockDbUpdated = await DiceBattle.RoomCancelled.processEvent({
      event,
      mockDb,
    });

    // Getting the actual entity from the mock database
    let actualDiceBattleRoomCancelled = mockDbUpdated.entities.DiceBattle_RoomCancelled.get(
      `${event.chainId}_${event.block.number}_${event.logIndex}`
    );

    // Creating the expected entity
    const expectedDiceBattleRoomCancelled: DiceBattle_RoomCancelled = {
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      roomId: event.params.roomId,
    };
    // Asserting that the entity in the mock database is the same as the expected entity
    assert.deepEqual(actualDiceBattleRoomCancelled, expectedDiceBattleRoomCancelled, "Actual DiceBattleRoomCancelled should be the same as the expectedDiceBattleRoomCancelled");
  });
});
