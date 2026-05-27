"use client";

import { useReadContract } from "wagmi";
import { isAddress } from "viem";
import { TOURNAMENT_ADDRESS, TOURNAMENT_ABI } from "@/lib/constants";

export function useNickname(address?: string) {
  return useReadContract({
    address: TOURNAMENT_ADDRESS,
    abi: TOURNAMENT_ABI,
    functionName: "getNickname",
    args: [address as `0x${string}`],
    query: {
      enabled: !!address && isAddress(address) && TOURNAMENT_ADDRESS !== "0x0000000000000000000000000000000000000000",
      staleTime: 30_000,
    },
  });
}
