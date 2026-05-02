"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseUnits, decodeEventLog } from "viem";
import { useConnection, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { WalletBar } from "@/components/WalletBar";
import { DICE_BATTLE_ABI } from "@/lib/abi";
import { computeCommitment, generateSecret, storeSecret } from "@/lib/commitment";
import { ERC20_ABI, GAME_ADDRESS, getTokenAddress, TOKEN_KEYS, TokenKey } from "@/lib/constants";
import { logger } from "@/lib/logger";

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

const STAKE_PRESETS = [
  { label: "0.50", value: "0.5" },
  { label: "1.00", value: "1" },
  { label: "2.00", value: "2" },
  { label: "5.00", value: "5" },
];

export default function CreateRoomPage() {
  const router = useRouter();
  const { address, isConnected } = useConnection();
  const publicClient = usePublicClient();
  const { mutateAsync: writeContractAsync } = useWriteContract();

  const [token, setToken] = useState<TokenKey>("cUSD");
  const [stake, setStake] = useState("1");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"idle" | "approving" | "creating" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const tokenAddress = getTokenAddress(token);
  const stakeValid = stake !== "" && !isNaN(Number(stake)) && Number(stake) > 0;

  const { data: tokenDecimals } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "decimals",
  });

  const { data: currentAllowance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address!, GAME_ADDRESS],
    query: { enabled: !!address },
  });

  const allowanceReady =
    stakeValid &&
    tokenDecimals != null &&
    currentAllowance != null &&
    currentAllowance >= parseUnits(stake, tokenDecimals);

  async function onCreate() {
    logger.log("[onCreate] Iniciando creación de sala");
    logger.log("[onCreate] Wallet:", address, "| Token:", token, "| Stake:", stake);

    if (!address || !publicClient) {
      logger.warn("[onCreate] Abortado: wallet no conectada");
      setError("Connect your wallet first");
      return;
    }
    if (GAME_ADDRESS === "0x0000000000000000000000000000000000000000") {
      logger.warn("[onCreate] Abortado: NEXT_PUBLIC_GAME_ADDRESS no configurado");
      setError("Contract address not configured. Set NEXT_PUBLIC_GAME_ADDRESS.");
      return;
    }
    if (!stakeValid) {
      setError("Enter a valid stake amount");
      return;
    }
    if (tokenDecimals == null) {
      setError("Could not read token decimals. Try again.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const tokenAddress = getTokenAddress(token);
      const stakeWei = parseUnits(stake, tokenDecimals);
      logger.log("[onCreate] Token address:", tokenAddress);
      logger.log("[onCreate] Stake en wei:", stakeWei.toString());

      // 1. Check allowance, approve if needed
      logger.log("[onCreate] [1/5] Consultando allowance del ERC20...");
      const allowance = (
        await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, GAME_ADDRESS],
        })
      ) as bigint;
      logger.log("[onCreate] Allowance actual:", allowance.toString());
      logger.log("[onCreate] Allowance suficiente:", allowance >= stakeWei);

      if (allowance < stakeWei) {
        logger.log("[onCreate] Allowance insuficiente — enviando approve...");
        setStep("approving");
        const approveHash = await writeContractAsync({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [GAME_ADDRESS, stakeWei],
        });
        logger.log("[onCreate] Tx approve enviada:", approveHash);
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        logger.log("[onCreate] Approve confirmado");
      } else {
        logger.log("[onCreate] Allowance ya suficiente — se omite approve");
      }

      // 2. Generate secret and commitment
      logger.log("[onCreate] [2/5] Generando secreto y commitment...");
      const secret = generateSecret();
      const commitment = computeCommitment(secret, address);
      logger.log("[onCreate] Secret (bytes32):", secret);
      logger.log("[onCreate] Commitment (keccak256(secret, address)):", commitment);

      // 3. Create room
      logger.log("[onCreate] [3/5] Enviando createRoom al contrato...");
      logger.log("[onCreate] Args → token:", tokenAddress, "| stake:", stakeWei.toString(), "| commitment:", commitment);
      setStep("creating");
      const createHash = await writeContractAsync({
        address: GAME_ADDRESS,
        abi: DICE_BATTLE_ABI,
        functionName: "createRoom",
        args: [tokenAddress, stakeWei, commitment],
      });
      logger.log("[onCreate] Tx createRoom enviada:", createHash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
      logger.log("[onCreate] Tx confirmada en bloque:", receipt.blockNumber.toString(), "| status:", receipt.status, "| logs:", receipt.logs.length);

      if (receipt.status === "reverted") {
        throw new Error(`Transaction reverted (hash: ${createHash}). Check token is allowed and balance is sufficient.`);
      }

      // 4. Parse RoomCreated event to get roomId
      logger.log("[onCreate] [4/5] Buscando evento RoomCreated en los logs...");
      let roomId: bigint | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: DICE_BATTLE_ABI,
            data: log.data,
            topics: log.topics,
          });
          logger.log("[onCreate] Log decodificado:", decoded.eventName, decoded.args);
          if (decoded.eventName === "RoomCreated") {
            roomId = (decoded.args as { roomId: bigint }).roomId;
            logger.log("[onCreate] RoomCreated encontrado — roomId:", roomId.toString());
            break;
          }
        } catch {
          // log de otro contrato, ignorar
        }
      }

      if (roomId === null) {
        logger.error("[onCreate] No se encontró RoomCreated en el receipt");
        throw new Error("Could not find RoomCreated event in receipt");
      }

      // 5. Persist secret locally (only on creator's device!)
      logger.log("[onCreate] [5/5] Guardando secreto en localStorage para roomId:", roomId.toString());
      storeSecret(roomId.toString(), secret);
      logger.log("[onCreate] Secreto guardado. Redirigiendo a /join/" + roomId);

      setStep("done");
      router.push(`/join/${roomId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("[onCreate] Error:", msg);
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
        <div className={`grid ${GRID_COLS[TOKEN_KEYS.length] ?? "grid-cols-2"} gap-2`}>
          {
            TOKEN_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setToken(key)}
                className={`rounded-xl border py-3 text-sm font-semibold ${
                  key === token
                    ? "border-celo-yellow bg-celo-yellow/10 text-celo-yellow"
                    : "border-white/10 text-white/70"
                }`}
              >
                {key}
              </button>
            ))
          }
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

      {allowanceReady
        ? "✓ Ready — confirm to play (1 tx)"
        : `Approve ${stake} ${token} + Create (2 tx)`
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
