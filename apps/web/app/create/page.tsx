"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseUnits, formatUnits, decodeEventLog } from "viem";
import { useConnection, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { WalletBar } from "@/components/WalletBar";
import { SecretBackupModal, hasSeenBackup } from "@/components/game/SecretBackupModal";
import { DICE_BATTLE_ABI } from "@/lib/abi";
import { computeCommitment, generateSecret, storeSecret } from "@/lib/commitment";
import { ERC20_ABI, GAME_ADDRESS, getTokenAddress, TOKEN_KEYS, TokenKey } from "@/lib/constants";
import { getTokenIcon } from "@/lib/utils";
import { useErrorToast } from "@/hooks/useErrorToast";
import { logger } from "@/lib/logger";
import { Spinner } from "@/components/ui/spinner";
import { ArrowBigLeftDash, CheckCheck, Rocket } from "lucide-react";
import { useTranslations } from "next-intl";

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

const TOKEN_SELECTED_CLS: Record<string, string> = {
  USDm: "border-[#5118C1] bg-[#5118C1]/10 text-purple-200",
  USDT: "border-teal-500/80 bg-teal-500/10 text-teal-200",
  USDC: "border-blue-500/80 bg-blue-500/10 text-blue-200",
};

const TOKEN_CARD_BORDER: Record<string, string> = {
  USDm: "border-[#5118C1]/25",
  USDT: "border-teal-500/25",
  USDC: "border-blue-500/25",
};

export default function CreateRoomPage() {
  const router = useRouter();
  const { address, isConnected } = useConnection();
  const publicClient = usePublicClient();
  const { mutateAsync: writeContractAsync } = useWriteContract();
  const create = useTranslations("create");
  const common = useTranslations("common");

  const [token, setToken] = useState<TokenKey>("USDm");
  const [stake, setStake] = useState("1");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"idle" | "approving" | "creating" | "done">("idle");
  const [error, setError] = useErrorToast();
  const [pendingRoom, setPendingRoom] = useState<{ roomId: string; secret: `0x${string}` } | null>(null);
  const tokenAddress = getTokenAddress(token);
  const stakeValid = stake !== "" && !isNaN(Number(stake)) && Number(stake) > 0;

  const { data: tokenDecimals } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "decimals",
  });

  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address!, GAME_ADDRESS],
    query: { enabled: !!address },
  });

  const { data: tokenBalance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address!],
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  function isAllowanceReady(allowance: bigint | undefined) {
    return stakeValid &&
      tokenDecimals != null &&
      allowance != null &&
      allowance >= parseUnits(stake, tokenDecimals);
  }

  let allowanceReady = isAllowanceReady(currentAllowance);

  const stakeWei = stakeValid && tokenDecimals != null ? parseUnits(stake, tokenDecimals) : 0n;
  const hasInsufficientBalance =
    tokenBalance != null && tokenDecimals != null && stakeWei > 0n && (tokenBalance as bigint) < stakeWei;
  const balanceFormatted =
    tokenBalance != null && tokenDecimals != null
      ? formatUnits(tokenBalance as bigint, tokenDecimals)
      : null;

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

    try {
      const tokenAddress = getTokenAddress(token);
      const stakeWei = parseUnits(stake, tokenDecimals);

      // Guard: verify on-chain balance before spending any gas
      const balance = (await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;
      if (balance < stakeWei) {
        setError(
          `Insufficient ${token} — you have ${formatUnits(balance, tokenDecimals)} but need ${stake}`
        );
        return;
      }
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
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Espera extra para indexación (ajustar según red)
        const { data: freshAllowance } = await refetchAllowance();
        isAllowanceReady(freshAllowance)
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
      logger.log("[onCreate] Secreto guardado.");

      setStep("done");

      // Show backup modal unless already seen for this room
      if (hasSeenBackup(roomId.toString())) {
        router.push(`/join/${roomId}`);
      } else {
        setPendingRoom({ roomId: roomId.toString(), secret });
      }
    } catch (e) {
      logger.error("[onCreate] Error:", e instanceof Error ? e.message : String(e));
      setError(e);
      setStep("idle");
    } finally {
      setBusy(false);
    }
  }

  const tokenIcon = getTokenIcon(tokenAddress);
  const cardBorder = TOKEN_CARD_BORDER[token] ?? "border-zinc-700/40";

  return (
    <div className="flex flex-col gap-5">
      <WalletBar />

      {pendingRoom && (
        <SecretBackupModal
          roomId={pendingRoom.roomId}
          secret={pendingRoom.secret}
          onDismiss={() => router.push(`/join/${pendingRoom.roomId}`)}
        />
      )}

      <header className="flex items-center justify-between pt-2">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1">
          <ArrowBigLeftDash /> {common("back")}
        </Link>
        <h1 className="text-lg font-semibold">{create("title")}</h1>
        <div className="w-10" />
      </header>

      {/* Token selector */}
      <section className="flex flex-col gap-2">
        <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          {create("token")}
        </label>
        <div className={`grid ${GRID_COLS[TOKEN_KEYS.length] ?? "grid-cols-2"} gap-2`}>
          {TOKEN_KEYS.map((key) => {
            const isActive = key === token;
            const activeCls = TOKEN_SELECTED_CLS[key] ?? "border-celo-yellow bg-celo-yellow/10 text-celo-yellow";
            return (
              <button
                key={key}
                type="button"
                onClick={() => setToken(key)}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-colors ${
                  isActive ? activeCls : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
                }`}
              >
                <Image
                  src={getTokenIcon(getTokenAddress(key))}
                  alt={key}
                  width={22}
                  height={22}
                  className="rounded-full"
                />
                {key}
              </button>
            );
          })}
        </div>
      </section>

      {/* Stake selector */}
      <section className="flex flex-col gap-2">
        <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          {create("stake")}
        </label>
        <div className="grid grid-cols-4 gap-2">
          {STAKE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setStake(preset.value)}
              className={`rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors ${
                stake === preset.value
                  ? "border-celo-yellow bg-celo-yellow/10 text-celo-yellow"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          className="mt-1 rounded-xl border-2 border-zinc-800 bg-zinc-900/60 px-4 py-3 font-mono text-sm text-white placeholder:text-zinc-600 focus:border-celo-yellow focus:outline-none transition-colors"
          placeholder={create("custom_amount")}
        />
      </section>

      {/* Summary card */}
      <section className={`relative overflow-hidden rounded-2xl border-2 bg-zinc-900/80 backdrop-blur-md p-4 ${cardBorder}`}>
        {/* Token watermark */}
        <Image
          src={tokenIcon}
          alt=""
          width={100}
          height={100}
          aria-hidden
          className="pointer-events-none absolute -left-[30px] top-[64%] select-none opacity-30"
        />
        <div className="relative flex flex-col gap-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">{create("your_balance")}</span>
            <span className={`font-mono text-sm font-semibold ${hasInsufficientBalance ? "text-red-400" : "text-zinc-300"}`}>
              {balanceFormatted != null
                ? `${parseFloat(balanceFormatted).toFixed(2)} ${token}`
                : <span className="text-zinc-600">…</span>
              }
              {hasInsufficientBalance && <span className="ml-1.5 text-[10px]">{create("insufficient")}</span>}
            </span>
          </div>
          <div className="border-t border-zinc-800/60" />
          <div className="flex justify-between">
            <span className="text-zinc-400">{create("your_stake")}</span>
            <span className="font-mono text-zinc-300">{stake || "0"} {token}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">{create("opponent_matches")}</span>
            <span className="font-mono text-zinc-300">{stake || "0"} {token}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-zinc-800 pt-2.5 font-semibold">
            <span className="text-zinc-400 ml-16">{create("if_you_win")}</span>
            <span className="font-mono text-green-400 ">
              ~{stakeValid ? (Number(stake) * 1.96).toFixed(2) : "0.00"} {token}
            </span>
          </div>
          <p className="text-[10px] text-amber-400/70 ml-16">{create("protocol_fee")}</p>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border-2 border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Allowance indicator */}
      <div className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-xs ${
        allowanceReady
          ? "border-green-500/20 bg-green-500/5 text-green-400"
          : "border-zinc-700 bg-zinc-900/60 text-zinc-400"
      }`}>
        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${allowanceReady ? "bg-green-400" : "bg-zinc-600"}`} />
        {allowanceReady ? create("ready") : create("needs_approval")}
      </div>

      {/* CTA */}
      {(() => {
        const isDisabled = !isConnected || busy || tokenDecimals == null || hasInsufficientBalance;
        const showNeutral = hasInsufficientBalance && step === "idle";
        return (
          <button
            type="button"
            disabled={isDisabled}
            onClick={onCreate}
            className={`group relative overflow-hidden flex items-center justify-center gap-2 rounded-2xl py-[18px] font-heading text-[15px] font-semibold transition-transform duration-150 active:scale-[0.97] disabled:pointer-events-none ${
              showNeutral
                ? "border border-red-500/30 bg-red-500/10 text-red-400"
                : "text-[#0C0C0C] disabled:opacity-40 animate-btn-glow"
            }`}
            style={showNeutral ? undefined : { background: "#FCFF52" }}
          >
            <span aria-hidden className="absolute inset-0 bg-black/0 transition-colors duration-150 group-active:bg-black/10" />
            <span className="relative z-10 flex items-center gap-2">
              {step === "approving" && <><Spinner /> {create("approving")}</>}
              {step === "creating" && <><Spinner /> {create("creating")}</>}
              {step === "done" && <>{create("room_created")} <CheckCheck /></>}
              {step === "idle" && (
                !isConnected ? common("connect_wallet")
                : tokenDecimals == null ? common("loading")
                : hasInsufficientBalance ? create("insufficient_top_up", { token })
                : <><Rocket className="h-5 w-5" /> {create("create_and_stake")}</>
              )}
            </span>
          </button>
        );
      })()}
    </div>
  );
}
