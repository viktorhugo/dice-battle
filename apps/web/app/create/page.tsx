"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseUnits, decodeEventLog } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { WalletBar } from "@/components/WalletBar";
import { DICE_BATTLE_ABI } from "@/lib/abi";
import { computeCommitment, generateSecret, storeSecret } from "@/lib/commitment";
import { ERC20_ABI, GAME_ADDRESS, TOKENS } from "@/lib/constants";

type TokenKey = "cUSD" | "USDT" | "USDC";

const STAKE_PRESETS = [
  { label: "0.50", value: "0.5" },
  { label: "1.00", value: "1" },
  { label: "2.00", value: "2" },
  { label: "5.00", value: "5" },
];

export default function CreateRoomPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [token, setToken] = useState<TokenKey>("cUSD");
  const [stake, setStake] = useState("1");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"idle" | "approving" | "creating" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    if (!address || !publicClient) {
      setError("Connect your wallet first");
      return;
    }
    if (GAME_ADDRESS === "0x0000000000000000000000000000000000000000") {
      setError("Contract address not configured. Set NEXT_PUBLIC_GAME_ADDRESS.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const tokenAddress = TOKENS[token];
      const stakeWei = parseUnits(stake, 18);

      // 1. Check allowance, approve if needed
      const allowance = (
          await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, GAME_ADDRESS],
        })
      ) as bigint;
      console.log("stakeWei:", stakeWei);
      console.log("Current allowance:", allowance.toString());

      if (allowance < stakeWei) {
        setStep("approving");
        const approveHash = await writeContractAsync({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [GAME_ADDRESS, stakeWei],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 2. Generate secret and commitment
      const secret = generateSecret();
      const commitment = computeCommitment(secret, address);

      // 3. Create room
      setStep("creating");
      const createHash = await writeContractAsync({
        address: GAME_ADDRESS,
        abi: DICE_BATTLE_ABI,
        functionName: "createRoom",
        args: [tokenAddress, stakeWei, commitment],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash });

      // 4. Parse RoomCreated event to get roomId
      let roomId: bigint | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: DICE_BATTLE_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "RoomCreated") {
            roomId = (decoded.args as { roomId: bigint }).roomId;
            break;
          }
        } catch {
          // not our event
        }
      }

      if (roomId === null) {
        throw new Error("Could not find RoomCreated event in receipt");
      }

      // 5. Persist secret locally (only on creator's device!)
      storeSecret(roomId.toString(), secret);

      setStep("done");
      router.push(`/game/${roomId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStep("idle");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <WalletBar />

      <header className="flex items-center justify-between pt-2">
        <Link href="/" className="text-sm text-white/60">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Create room</h1>
        <div className="w-10" />
      </header>

      <section className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wider text-white/50">
          Token
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(["cUSD", "USDT", "USDC"] as const).map( (token) => (
            <button
              key={token}
              type="button"
              onClick={() => setToken(token)}
              className={`rounded-xl border py-3 text-sm font-semibold ${
                token === token
                  ? "border-celo-yellow bg-celo-yellow/10 text-celo-yellow"
                  : "border-white/10 text-white/70"
              }`}
            >
              {token}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wider text-white/50">
          Stake
        </label>
        <div className="grid grid-cols-4 gap-2">
          {
            STAKE_PRESETS.map( (stakePreset) => (
              <button
                key={stakePreset.value}
                type="button"
                onClick={() => setStake(stakePreset.value)}
                className={`rounded-xl border py-2 text-sm font-semibold ${
                  stake === stakePreset.value
                    ? "border-celo-yellow bg-celo-yellow/10 text-celo-yellow"
                    : "border-white/10 text-white/70"
                }`}
              >
                {stakePreset.label}
              </button>
            ))
          }
        </div>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          className="mt-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm focus:border-celo-yellow focus:outline-none"
          placeholder="Custom amount"
        />
      </section>

      <section className="rounded-xl bg-white/5 p-4 text-xs text-white/60">
        <div className="flex justify-between">
          <span> Your stake </span>
          <span className="font-mono">
            {stake} {token}
          </span>
        </div>
        <div className="flex justify-between">
          <span> Opponent matches </span>
          <span className="font-mono">
            {stake} {token}
          </span>
        </div>
        <div className="mt-2 flex justify-between border-t border-white/10 pt-2 font-semibold text-white">
          <span> If you win </span>
          <span className="font-mono">
            ~{(Number(stake) * 1.96).toFixed(2)} {token}
          </span>
        </div>
        <div className="mt-0.5 text-[10px] text-white/40"> Protocol fee: 2% of pot </div>
      </section>

      {
          error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            {error}
          </div>
        )
      }

      <button
        type="button"
        disabled={!isConnected || busy}
        onClick={onCreate}
        className="rounded-2xl bg-celo-yellow py-4 text-center font-semibold text-celo-dark active:opacity-80 disabled:opacity-40"
      >
        {step === "approving" && "Approving…"}
        {step === "creating" && "Creating room…"}
        {step === "done" && "Done!"}
        {step === "idle" && (isConnected ? "Create and stake" : "Connect wallet")}
      </button>
    </div>
  );
}
