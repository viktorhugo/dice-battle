"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { useConnection } from "wagmi";
import { ArrowBigLeftDash, Pencil, Plus } from "lucide-react";
import { WalletBar } from "@/components/WalletBar";
import { Identicon } from "@/components/ui/identicon";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import { NicknameEditModal } from "@/components/NicknameEditModal";
import { useNickname } from "@/hooks/useNickname";
import { useCeloProfile } from "@/hooks/useCeloProfile";
import { getTokenDecimals } from "@/lib/constants";
import { truncateAddress, getTokenSymbol } from "@/lib/utils";
import { getPlayerProfile, type IndexerPlayer, type IndexerProfileRoom } from "@/lib/indexer";
import { ACHIEVEMENTS, buildPlayerStats, sortedAchievements, type Achievement, type PlayerStats, type Rarity } from "@/lib/achievements";
import { logger } from "@/lib/logger";
import { useTranslations } from "next-intl";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeDiceStats(rooms: IndexerProfileRoom[], address: string) {
  const addrLower = address.toLowerCase();
  const rolls: number[] = [];
  let bestTotal = -1;
  let bestHand = { d1: 0, d2: 0 };

  for (const room of rooms) {
    if (room.rollA1 == null || room.rollB1 == null) continue;
    const isA = room.playerA === addrLower;
    const d1 = isA ? room.rollA1 : room.rollB1;
    const d2 = isA ? (room.rollA2 ?? 0) : (room.rollB2 ?? 0);
    rolls.push(d1, d2);
    if (d1 + d2 > bestTotal) { bestTotal = d1 + d2; bestHand = { d1, d2 }; }
  }

  if (rolls.length === 0) return null;

  const avg = (rolls.reduce((a, b) => a + b, 0) / rolls.length).toFixed(1);
  const freq: Record<number, number> = {};
  for (const r of rolls) freq[r] = (freq[r] ?? 0) + 1;
  const lucky = Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);

  return { avg, bestHand, lucky };
}

function computeAvgDuration(rooms: IndexerProfileRoom[]): string | null {
  const durations = rooms
    .filter((r) => r.resolvedAt && r.createdAt)
    .map((r) => Number(r.resolvedAt) - Number(r.createdAt));

  if (durations.length === 0) return null;

  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const m = Math.floor(avg / 60);
  const s = Math.round(avg % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-white/5 py-3">
      <span className="text-base font-bold text-white">{value}</span>
      <span className="text-xs text-white/40">{label}</span>
    </div>
  );
}

function OutcomeBar({ wins, losses, ties, gamesLabel }: { wins: number; losses: number; ties: number; gamesLabel: string }) {
  const total = wins + losses + ties;
  if (total === 0) return null;
  const wPct = (wins / total) * 100;
  const lPct = (losses / total) * 100;
  const tPct = (ties / total) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/10">
        {wPct > 0 && <div className="bg-green-500 transition-all" style={{ width: `${wPct}%` }} />}
        {lPct > 0 && <div className="bg-red-500 transition-all" style={{ width: `${lPct}%` }} />}
        {tPct > 0 && <div className="bg-yellow-500 transition-all" style={{ width: `${tPct}%` }} />}
      </div>
      <div className="flex justify-between px-0.5 text-xs">
        <span className="text-green-400">{wins}W</span>
        <span className="text-white/30">{total} {gamesLabel}</span>
        <span className="text-red-400">{losses}L · <span className="text-yellow-400">{ties}T</span></span>
      </div>
    </div>
  );
}

function GameRow({ room, address, resultLabels }: {
  room: IndexerProfileRoom;
  address: string;
  resultLabels: { tied: string; won: string; lost: string; expired: string };
}) {
  const addrLower = address.toLowerCase();
  const opponent = room.playerA === addrLower ? room.playerB : room.playerA;

  const isWin = room.state === "RESOLVED" && room.winner === addrLower;
  const isTie = room.state === "TIED";
  const isLoss = room.state === "RESOLVED" && !isWin;

  const resultLabel = isTie ? resultLabels.tied : isWin ? resultLabels.won : isLoss ? resultLabels.lost : resultLabels.expired;
  const resultColor = isTie
    ? "text-yellow-400"
    : isWin
    ? "text-green-400"
    : isLoss
    ? "text-red-400"
    : "text-white/30";

  const amount = formatUnits(
    BigInt(room.stake),
    getTokenDecimals(room.token as `0x${string}`)
  );
  const symbol = getTokenSymbol(room.token);

  return (
    <li>
      <Link
        href={`/game/${room.id}`}
        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 active:opacity-70"
      >
        <span className={`w-14 text-sm font-semibold ${resultColor}`}>{resultLabel}</span>
        <span className="text-sm text-white">{amount} {symbol}</span>
        <span className="font-mono text-xs text-white/40">
          {opponent ? truncateAddress(opponent) : "—"}
        </span>
      </Link>
    </li>
  );
}

// ─── Achievements ─────────────────────────────────────────────────────────────

const RARITY_STYLES: Record<Rarity, string> = {
  common:    "border-white/15 bg-white/5",
  rare:      "border-blue-500/30 bg-blue-500/5",
  epic:      "border-purple-500/40 bg-purple-500/5",
  legendary: "border-yellow-500/50 bg-yellow-500/5",
};

function AchievementCard({
  achievement,
  unlocked,
  stats,
}: {
  achievement: Achievement;
  unlocked: boolean;
  stats: PlayerStats;
}) {
  const prog = achievement.progress?.(stats);
  const progressPct = prog ? (prog.value / prog.max) * 100 : null;

  return (
    <div
      title={achievement.description}
      className={[
        "relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all",
        unlocked ? RARITY_STYLES[achievement.rarity] : "border-white/8 bg-white/3 opacity-40 grayscale",
      ].join(" ")}
    >
      {/* Lock indicator */}
      {!unlocked && (
        <span className="absolute right-1.5 top-1.5 text-[9px] leading-none">🔒</span>
      )}

      <span className="text-2xl leading-none">{achievement.emoji}</span>
      <span className="line-clamp-1 text-[10px] font-semibold text-white">
        {achievement.name}
      </span>
      <span className="line-clamp-2 text-[9px] leading-tight text-white/40">
        {achievement.description}
      </span>

      {/* Progress bar */}
      {progressPct !== null && (
        <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-celo-yellow transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Progress label for locked + quantifiable */}
      {!unlocked && prog && (
        <span className="text-[9px] text-white/30">
          {prog.value}/{prog.max}
        </span>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { address } = useParams<{ address: string }>();
  const { address: connectedAddress } = useConnection();
  const isOwnProfile = !!connectedAddress && connectedAddress.toLowerCase() === address.toLowerCase();
  const profile = useTranslations("profile");

  const resultLabels = {
    tied:    profile("tied_label"),
    won:     profile("won_label"),
    lost:    profile("lost_label"),
    expired: profile("expired_label"),
  };

  const { data: nickname, refetch: refetchNickname } = useNickname(address);
  const { profile: celoProfile } = useCeloProfile(address);
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);

  const [player, setPlayer] = useState<IndexerPlayer | null>(null);
  const [rooms, setRooms] = useState<IndexerProfileRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getPlayerProfile(address)
      .then(({ player, rooms }) => {
        logger.log("[profile] player:", player, "rooms:", rooms.length);
        setPlayer(player);
        setRooms(rooms);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error("[profile] Error:", msg);
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [address]);

  function handleCopy() {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const winRate =
    player && Number(player.totalGames) > 0
      ? Math.round((Number(player.wins) / Number(player.totalGames)) * 100)
      : 0;

  const diceStats = computeDiceStats(rooms, address);
  const avgDuration = computeAvgDuration(rooms);

  const playerStats = player ? buildPlayerStats(player, rooms, address) : null;
  const achievementList = playerStats ? sortedAchievements(playerStats) : null;
  const unlockedCount = achievementList?.filter((a) => a.unlocked).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <WalletBar />

      <header className="flex items-center justify-between pt-2">
        <Link href="/" className="text-sm text-white/60 flex items-center gap-1">
          <ArrowBigLeftDash /> {profile("back")}
        </Link>
        <h1 className="text-lg font-semibold">{profile("title")}</h1>
        <div className="w-10" />
      </header>

      {/* ── Profile hero — solo si hay banner ────────────────────────────── */}
      {celoProfile?.banner ? (
        <div className="relative -mx-4 -mt-2">
          {/* Banner */}
          <div className="relative h-[12rem] w-full overflow-hidden rounded-b-2xl">
            <Image
              src={celoProfile.banner}
              alt="Profile banner"
              fill
              className="object-cover [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]"
              unoptimized
            />
          </div>

          {/* Avatar superpuesto */}
          <div className="absolute -bottom-7 left-4">
            {loading ? (
              <Skeleton className="h-16 w-16 rounded-full ring-4 ring-[#b1b1b1]" />
            ) : celoProfile.avatar ? (
              <div className="relative h-16 w-16 rounded-full ring-4 ring-[#b1b1b1] overflow-hidden">
                <Image
                  src={celoProfile.avatar}
                  alt={celoProfile.displayName}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <Identicon address={address} size={64} className="ring-4 ring-[#b1b1b1] rounded-full" />
            )}
          </div>
        </div>
      ) : null}

      {/* ── Name + address row ────────────────────────────────────────────── */}
      <div className={`flex flex-col gap-0.5 pl-1 ${celoProfile?.banner ? "pt-4" : "pt-2 flex-row items-center gap-3"}`}>
        {/* Avatar sin banner — inline a la izquierda */}
        {!celoProfile?.banner && (
          <div className="shrink-0">
            {loading ? (
              <Skeleton className="h-12 w-12 rounded-full" />
            ) : celoProfile?.avatar ? (
              <div className="relative h-12 w-12 rounded-full ring-2 ring-[#b1b1b1] overflow-hidden">
                <Image
                  src={celoProfile.avatar}
                  alt={celoProfile.displayName}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <Identicon address={address} size={48} className="ring-2 ring-[#b1b1b1] rounded-full" />
            )}
          </div>
        )}

        <div className="flex flex-col gap-0.5">
        {/* Primary display name: on-chain nickname > celoname display > address */}
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-white leading-tight">
            {nickname || celoProfile?.displayName || truncateAddress(address)}
          </span>
          {isOwnProfile && (
            nickname ? (
              <button
                onClick={() => setNicknameModalOpen(true)}
                className="text-white/30 hover:text-white/60 transition-colors"
                title="Edit nickname"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setNicknameModalOpen(true)}
                className="flex items-center gap-1 rounded-full border border-[#FCFF52]/40 bg-[#FCFF52]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#FCFF52] hover:bg-[#FCFF52]/20 transition-all"
              >
                <Plus className="h-3 w-3" /> {profile("add_nickname")}
              </button>
            )
          )}
        </div>

        {/* Celoname subtle */}
        {celoProfile && (
          <span className="text-xs text-[#00C4B3]/70 font-mono">{celoProfile.fullName}</span>
        )}

        {/* Address copy */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 w-fit rounded-md px-1 py-0.5 transition-colors hover:bg-white/5 active:opacity-70"
          title="Copy address"
        >
          <span className="font-mono text-[10px] text-white/30">{truncateAddress(address)}</span>
          <span className="text-[10px] text-white/20">{copied ? "✓" : "⎘"}</span>
        </button>

        {!loading && player && Number(player.currentStreak) > 0 && (
          <span className="text-sm text-orange-400 mt-1">
            🔥 {profile("win_streak", { count: player.currentStreak })}
          </span>
        )}
        </div>
      </div>

      <NicknameEditModal
        current={nickname ?? ""}
        open={nicknameModalOpen}
        onClose={() => setNicknameModalOpen(false)}
        onSaved={() => { refetchNickname(); }}
      />

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 py-3">
              <Skeleton className="h-5 w-8" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      ) : player ? (
        <>
          <div className="grid grid-cols-4 gap-2">
            <StatCard value={player.totalGames} label={profile("games_label")} />
            <StatCard value={player.wins} label={profile("wins_label")} />
            <StatCard value={`${winRate}%`} label={profile("rate_label")} />
            <StatCard value={player.currentStreak} label={profile("streak_label")} />
          </div>

          {/* Outcome bar */}
          <OutcomeBar
            wins={Number(player.wins)}
            losses={Number(player.losses)}
            ties={Number(player.ties)}
            gamesLabel={profile("games_label")}
          />

          {Number(player.longestStreak) > 0 && (
            <p className="text-center text-xs text-white/30">
              {profile("longest_streak", { count: player.longestStreak })}
            </p>
          )}
        </>
      ) : (
        !loading && (
          <p className="pt-4 text-center text-sm text-white/40">{profile("no_games")}</p>
        )
      )}

      {/* Dice stats */}
      {!loading && diceStats && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-white/50">{profile("dice_stats")}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-sm font-bold text-white">{diceStats.avg}</p>
              <p className="text-xs text-white/40">{profile("avg_die")}</p>
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {diceStats.bestHand.d1}+{diceStats.bestHand.d2}
              </p>
              <p className="text-xs text-white/40">{profile("best_hand")}</p>
            </div>
            <div>
              <p className="text-sm font-bold text-white">{diceStats.lucky}</p>
              <p className="text-xs text-white/40">{profile("lucky_num")}</p>
            </div>
          </div>
          {avgDuration && (
            <p className="mt-2 text-center text-xs text-white/30">
              {profile("avg_duration", { duration: avgDuration })}
            </p>
          )}
        </div>
      )}

      {/* Achievements */}
      {!loading && achievementList && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/60">{profile("achievements")}</h2>
            <span className="text-xs text-white/30">
              {unlockedCount}/{ACHIEVEMENTS.length}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {achievementList.map(({ achievement, unlocked }) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                unlocked={unlocked}
                stats={playerStats!}
              />
            ))}
          </div>
        </>
      )}

      {/* Recent games */}
      {!loading && rooms.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-white/60">{profile("recent_games")}</h2>
          <ul className="flex flex-col gap-2">
            {rooms.map((room) => (
              <GameRow key={room.id} room={room} address={address} resultLabels={resultLabels} />
            ))}
          </ul>
        </>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
