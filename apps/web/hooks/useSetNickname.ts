"use client";

import { useWriteContract, usePublicClient } from "wagmi";
import { TOURNAMENT_ADDRESS, TOURNAMENT_ABI } from "@/lib/constants";

export function useSetNickname() {
  const { mutateAsync: writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();

  async function setNickname(name: string): Promise<string> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Nickname cannot be empty");
    if (trimmed.length > 20) throw new Error("Max 20 characters");

    const hash = await writeContractAsync({
      address: TOURNAMENT_ADDRESS,
      abi: TOURNAMENT_ABI,
      functionName: "setNickname",
      args: [trimmed],
    });

    await publicClient!.waitForTransactionReceipt({ hash });
    return trimmed;
  }

  return { setNickname, isPending };
}
