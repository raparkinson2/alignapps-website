import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator, Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useCallback, useEffect } from 'react';
import {
  X,
  FileText,
  Crown,
  Download,
  Check,
  Lock,
  Zap,
  ChevronRight,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  useTeamStore,
  getPlayerName,
} from '@/lib/store';
import type { Sport } from '@/lib/store';
import type {
  HockeyStats,
  HockeyGoalieStats,
  SoccerStats,
  SoccerGoalieStats,
  LacrosseStats,
  LacrosseGoalieStats,
  BasketballStats,
  BaseballStats,
  BaseballPitcherStats,
} from '@/lib/store-types';
import {
  hasEntitlement,
  getPackage,
  purchasePackage,
  restorePurchases,
  isRevenueCatEnabled,
} from '@/lib/revenuecatClient';
import type { PurchasesPackage } from 'react-native-purchases';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type ExportScope = 'current' | 'history';

// ─── CSV helpers ────────────────────────────────────────────────────────────

function csvEscape(val: string | number | undefined | null): string {
  const s = val == null ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(...cells: (string | number | undefined | null)[]): string {
  return cells.map(csvEscape).join(',');
}

function buildCSV(
  teamName: string,
  seasonName: string,
  sport: Sport,
  players: ReturnType<typeof useTeamStore.getState>['players'],
  games: ReturnType<typeof useTeamStore.getState>['games'],
): string {
  const lines: string[] = [];

  // Header meta
  lines.push(row('Team', teamName));
  lines.push(row('Season', seasonName || 'Current'));
  lines.push(row('Sport', sport));
  lines.push(row('Exported', new Date().toLocaleDateString()));
  lines.push('');

  // Compute attendance per player
  const invited = new Map<string, number>();
  const attended = new Map<string, number>();
  for (const g of games) {
    for (const pid of g.invitedPlayers ?? []) {
      invited.set(pid, (invited.get(pid) ?? 0) + 1);
    }
    for (const pid of g.checkedInPlayers ?? []) {
      attended.set(pid, (attended.get(pid) ?? 0) + 1);
    }
  }

  // Only real players (not coaches/parents)
  const fieldPlayers = players.filter(
    (p) =>
      p.position !== 'Coach' &&
      p.position !== 'Parent' &&
      !p.roles?.includes('coach') &&
      !p.roles?.includes('parent'),
  );

  if (sport === 'hockey') {
    lines.push(row('Name', '#', 'Pos', 'GP', 'G', 'A', 'PTS', 'PIM', '+/-', 'Invited', 'Games Played', 'Att%'));
    for (const p of fieldPlayers) {
      const s = p.stats as HockeyStats | undefined;
      const inv = invited.get(p.id) ?? 0;
      const att = attended.get(p.id) ?? 0;
      const pct = inv > 0 ? Math.round((att / inv) * 100) : 0;
      const gp = s?.gamesPlayed ?? 0;
      const g = s?.goals ?? 0;
      const a = s?.assists ?? 0;
      lines.push(row(getPlayerName(p), p.number ?? '', p.position, gp, g, a, g + a, s?.pim ?? 0, s?.plusMinus ?? 0, inv, att, `${pct}%`));
    }

    // Goalies
    const goalies = fieldPlayers.filter((p) => p.goalieStats);
    if (goalies.length > 0) {
      lines.push('');
      lines.push(row('Goalies', '', '', 'GP', 'W', 'L', 'SV%', 'GAA', 'SA', 'Saves', 'GA'));
      for (const p of goalies) {
        const gs = p.goalieStats as HockeyGoalieStats;
        const sa = gs.shotsAgainst ?? 0;
        const sv = gs.saves ?? 0;
        const svPct = sa > 0 ? (sv / sa).toFixed(3) : '.000';
        const gaa = gs.games > 0 ? (gs.goalsAgainst / gs.games).toFixed(2) : '0.00';
        lines.push(row(getPlayerName(p), p.number ?? '', 'G', gs.games, gs.wins, gs.losses, svPct, gaa, sa, sv, gs.goalsAgainst));
      }
    }
  } else if (sport === 'soccer') {
    lines.push(row('Name', '#', 'Pos', 'GP', 'G', 'A', 'PTS', 'YC', 'Invited', 'Games Played', 'Att%'));
    for (const p of fieldPlayers) {
      const s = p.stats as SoccerStats | undefined;
      const inv = invited.get(p.id) ?? 0;
      const att = attended.get(p.id) ?? 0;
      const pct = inv > 0 ? Math.round((att / inv) * 100) : 0;
      const gp = s?.gamesPlayed ?? 0;
      const g = s?.goals ?? 0;
      const a = s?.assists ?? 0;
      lines.push(row(getPlayerName(p), p.number ?? '', p.position, gp, g, a, g + a, s?.yellowCards ?? 0, inv, att, `${pct}%`));
    }
    // Soccer goalies
    const goalies = fieldPlayers.filter((p) => p.goalieStats);
    if (goalies.length > 0) {
      lines.push('');
      lines.push(row('Goalies', '', '', 'GP', 'W', 'L', 'SV%', 'GAA', 'SA', 'Saves', 'GA'));
      for (const p of goalies) {
        const gs = p.goalieStats as SoccerGoalieStats;
        const sa = gs.shotsAgainst ?? 0;
        const sv = gs.saves ?? 0;
        const svPct = sa > 0 ? (sv / sa).toFixed(3) : '.000';
        const gaa = gs.games > 0 ? (gs.goalsAgainst / gs.games).toFixed(2) : '0.00';
        lines.push(row(getPlayerName(p), p.number ?? '', 'GK', gs.games, gs.wins, gs.losses, svPct, gaa, sa, sv, gs.goalsAgainst));
      }
    }
  } else if (sport === 'lacrosse') {
    lines.push(row('Name', '#', 'Pos', 'GP', 'G', 'A', 'PTS', 'GB', 'CT', 'Invited', 'Games Played', 'Att%'));
    for (const p of fieldPlayers) {
      const s = p.stats as LacrosseStats | undefined;
      const inv = invited.get(p.id) ?? 0;
      const att = attended.get(p.id) ?? 0;
      const pct = inv > 0 ? Math.round((att / inv) * 100) : 0;
      const gp = s?.gamesPlayed ?? 0;
      const g = s?.goals ?? 0;
      const a = s?.assists ?? 0;
      lines.push(row(getPlayerName(p), p.number ?? '', p.position, gp, g, a, g + a, s?.groundBalls ?? 0, s?.causedTurnovers ?? 0, inv, att, `${pct}%`));
    }
    // Lacrosse goalies
    const goalies = fieldPlayers.filter((p) => p.goalieStats);
    if (goalies.length > 0) {
      lines.push('');
      lines.push(row('Goalies', '', '', 'GP', 'W', 'L', 'SV%', 'GAA', 'SA', 'Saves', 'GA'));
      for (const p of goalies) {
        const gs = p.goalieStats as unknown as LacrosseGoalieStats;
        const sa = gs.shotsAgainst ?? 0;
        const sv = gs.saves ?? 0;
        const svPct = sa > 0 ? (sv / sa).toFixed(3) : '.000';
        const gaa = gs.games > 0 ? (gs.goalsAgainst / gs.games).toFixed(2) : '0.00';
        lines.push(row(getPlayerName(p), p.number ?? '', 'G', gs.games, gs.wins, gs.losses, svPct, gaa, sa, sv, gs.goalsAgainst));
      }
    }
  } else if (sport === 'basketball') {
    lines.push(row('Name', '#', 'Pos', 'GP', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'PPG', 'RPG', 'APG', 'Invited', 'Games Played', 'Att%'));
    for (const p of fieldPlayers) {
      const s = p.stats as BasketballStats | undefined;
      const inv = invited.get(p.id) ?? 0;
      const att = attended.get(p.id) ?? 0;
      const pct = inv > 0 ? Math.round((att / inv) * 100) : 0;
      const gp = s?.gamesPlayed ?? 0;
      const pts = s?.points ?? 0;
      const reb = s?.rebounds ?? 0;
      const ast = s?.assists ?? 0;
      const ppg = gp > 0 ? (pts / gp).toFixed(1) : '0.0';
      const rpg = gp > 0 ? (reb / gp).toFixed(1) : '0.0';
      const apg = gp > 0 ? (ast / gp).toFixed(1) : '0.0';
      lines.push(row(getPlayerName(p), p.number ?? '', p.position, gp, pts, reb, ast, s?.steals ?? 0, s?.blocks ?? 0, ppg, rpg, apg, inv, att, `${pct}%`));
    }
  } else if (sport === 'baseball' || sport === 'softball') {
    lines.push(row('Name', '#', 'Pos', 'GP', 'AB', 'H', 'HR', 'RBI', 'BB', 'K', 'AVG', 'Invited', 'Games Played', 'Att%'));
    for (const p of fieldPlayers) {
      const s = p.stats as BaseballStats | undefined;
      const inv = invited.get(p.id) ?? 0;
      const att = attended.get(p.id) ?? 0;
      const pct = inv > 0 ? Math.round((att / inv) * 100) : 0;
      const gp = s?.gamesPlayed ?? 0;
      const ab = s?.atBats ?? 0;
      const h = s?.hits ?? 0;
      const avg = ab > 0 ? (h / ab).toFixed(3).replace(/^0/, '') : '.000';
      lines.push(row(getPlayerName(p), p.number ?? '', p.position, gp, ab, h, s?.homeRuns ?? 0, s?.rbi ?? 0, s?.walks ?? 0, s?.strikeouts ?? 0, avg, inv, att, `${pct}%`));
    }
    // Pitchers
    const pitchers = fieldPlayers.filter((p) => p.pitcherStats);
    if (pitchers.length > 0) {
      lines.push('');
      lines.push(row('Pitchers', '', '', 'GS', 'W', 'L', 'IP', 'K', 'BB', 'H', 'ER', 'ERA'));
      for (const p of pitchers) {
        const ps = p.pitcherStats as BaseballPitcherStats;
        const era = ps.innings > 0 ? ((ps.earnedRuns / ps.innings) * 9).toFixed(2) : '0.00';
        lines.push(row(getPlayerName(p), p.number ?? '', p.position, ps.starts, ps.wins, ps.losses, ps.innings, ps.strikeouts, ps.walks, ps.hits, ps.earnedRuns, era));
      }
    }
  } else {
    // Generic fallback
    lines.push(row('Name', '#', 'Pos', 'Invited', 'Games Played', 'Att%'));
    for (const p of fieldPlayers) {
      const inv = invited.get(p.id) ?? 0;
      const att = attended.get(p.id) ?? 0;
      const pct = inv > 0 ? Math.round((att / inv) * 100) : 0;
      lines.push(row(getPlayerName(p), p.number ?? '', p.position, inv, att, `${pct}%`));
    }
  }

  return lines.join('\n');
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ExportStatsModal({ visible, onClose }: Props) {
  const players = useTeamStore((s) => s.players);
  const games = useTeamStore((s) => s.games);
  const teamName = useTeamStore((s) => s.teamName);
  const teamSettings = useTeamStore((s) => s.teamSettings);

  const sport = teamSettings?.sport ?? 'hockey';
  const seasonName = teamSettings?.currentSeasonName ?? '';
  const hasHistory = (teamSettings?.seasonHistory?.length ?? 0) > 0;

  const [checking, setChecking] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [rcEnabled] = useState(() => isRevenueCatEnabled());

  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [scope, setScope] = useState<ExportScope>('current');

  const checkPremium = useCallback(async () => {
    setChecking(true);
    const result = await hasEntitlement('premium');
    setIsPremium(result.ok && result.data);
    setChecking(false);
  }, []);

  const loadPackage = useCallback(async () => {
    const result = await getPackage('$rc_annual');
    if (result.ok && result.data) setPkg(result.data);
  }, []);

  useEffect(() => {
    if (visible) {
      checkPremium();
      loadPackage();
    }
  }, [visible, checkPremium, loadPackage]);

  const handlePurchase = async () => {
    if (!pkg) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPurchasing(true);
    const result = await purchasePackage(pkg);
    setPurchasing(false);
    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsPremium(true);
    }
  };

  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);
    if (result.ok) {
      await checkPremium();
    }
  };

  const handleExport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExporting(true);

    try {
      const lines: string[] = [];

      if (scope === 'current' || !hasHistory) {
        // Current season
        const csv = buildCSV(teamName, seasonName, sport, players, games);
        lines.push(csv);
      } else {
        // All seasons from history
        const history = teamSettings?.seasonHistory ?? [];
        for (const season of [...history].reverse()) {
          const fakePlayers = season.playerStats.map((ap) => ({
            id: ap.playerId,
            firstName: ap.playerName.split(' ')[0] ?? ap.playerName,
            lastName: ap.playerName.split(' ').slice(1).join(' '),
            jerseyNumber: ap.jerseyNumber,
            position: ap.position,
            roles: [] as string[],
            status: 'active' as const,
            stats: ap.stats,
            goalieStats: ap.goalieStats,
            pitcherStats: ap.pitcherStats,
          }));
          // Attendance from archived record
          const fakeGames: typeof games = [];
          for (const ap of season.playerStats) {
            for (let i = 0; i < (ap.gamesInvited ?? 0); i++) {
              if (!fakeGames[i]) {
                fakeGames.push({ id: `fake-${i}`, date: '', time: '', invitedPlayers: [], checkedInPlayers: [], checkedOutPlayers: [], opponent: '', location: '', address: '', jerseyColor: '', photos: [], showBeerDuty: false, invitesSent: false });
              }
              fakeGames[i].invitedPlayers.push(ap.playerId);
              if (i < (ap.gamesAttended ?? 0)) {
                fakeGames[i].checkedInPlayers.push(ap.playerId);
              }
            }
          }
          lines.push(buildCSV(teamName, season.seasonName, season.sport, fakePlayers as any, fakeGames));
          lines.push('\n');
        }
        // Also current season at the end
        lines.push(`\n`);
        lines.push(buildCSV(teamName, seasonName || 'Current Season', sport, players, games));
      }

      const fullCSV = lines.join('\n');
      const fileName = `${teamName.replace(/[^a-zA-Z0-9]/g, '_')}_stats_${new Date().toISOString().split('T')[0]}.csv`;

      await Share.share({
        title: `${teamName} Stats Export`,
        message: fullCSV,
        // On iOS, include a subject for email sharing
      });
    } catch (_err) {
      // User cancelled or share failed — no action needed
    } finally {
      setExporting(false);
    }
  };

  // ── Paywall UI ─────────────────────────────────────────────────────────────

  const renderPaywall = () => (
    <Animated.View entering={FadeInDown.delay(80).springify()}>
      {/* Icon */}
      <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 24 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: 'rgba(245,158,11,0.15)',
            borderWidth: 1.5,
            borderColor: 'rgba(245,158,11,0.35)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Crown size={32} color="#f59e0b" />
        </View>
        <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 }}>
          Premium Feature
        </Text>
        <Text style={{ color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
          Export stats to CSV — share with{'\n'}coaches, parents, or your league.
        </Text>
      </View>

      {/* Feature bullets */}
      <View
        style={{
          backgroundColor: 'rgba(15,23,42,0.6)',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.07)',
          marginBottom: 20,
          overflow: 'hidden',
        }}
      >
        {[
          { icon: <FileText size={16} color="#67e8f9" />, label: 'Full roster stats as CSV' },
          { icon: <Download size={16} color="#22c55e" />, label: 'Share via Mail, Messages, Files' },
          { icon: <Check size={16} color="#a78bfa" />, label: 'Attendance data included' },
          { icon: <Lock size={16} color="#f59e0b" />, label: 'All past seasons (if archived)' },
        ].map((item, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: 'rgba(255,255,255,0.05)',
              gap: 12,
            }}
          >
            {item.icon}
            <Text style={{ color: '#cbd5e1', fontSize: 14 }}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Price / CTA */}
      {rcEnabled && pkg ? (
        <>
          <Pressable
            onPress={handlePurchase}
            disabled={purchasing}
            style={({ pressed }) => ({
              borderRadius: 14,
              overflow: 'hidden',
              opacity: pressed || purchasing ? 0.8 : 1,
              marginBottom: 12,
            })}
          >
            <LinearGradient
              colors={['#f59e0b', '#d97706']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 15,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {purchasing ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <>
                  <Zap size={18} color="#000" />
                  <Text style={{ color: '#000', fontSize: 16, fontWeight: '800' }}>
                    {pkg.product.priceString}/mo · Start Free Trial
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={handleRestore}
            disabled={restoring}
            style={{ alignItems: 'center', paddingVertical: 10 }}
          >
            {restoring ? (
              <ActivityIndicator color="#64748b" size="small" />
            ) : (
              <Text style={{ color: '#64748b', fontSize: 13 }}>Restore Purchases</Text>
            )}
          </Pressable>
        </>
      ) : (
        <View
          style={{
            backgroundColor: 'rgba(245,158,11,0.08)',
            borderRadius: 14,
            padding: 16,
            borderWidth: 1,
            borderColor: 'rgba(245,158,11,0.2)',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#f59e0b', fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
            Go to the Payments tab in Vibecode{'\n'}to activate subscriptions for your team.
          </Text>
        </View>
      )}
    </Animated.View>
  );

  // ── Export UI ──────────────────────────────────────────────────────────────

  const renderExporter = () => (
    <Animated.View entering={FadeInDown.delay(60).springify()}>
      <View style={{ alignItems: 'center', paddingTop: 4, paddingBottom: 24 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: 'rgba(34,197,94,0.15)',
            borderWidth: 1.5,
            borderColor: 'rgba(34,197,94,0.35)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          <FileText size={28} color="#22c55e" />
        </View>
        <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 }}>
          Export Stats
        </Text>
        <Text style={{ color: '#64748b', fontSize: 14, marginTop: 5, textAlign: 'center' }}>
          {players.filter((p) => p.position !== 'Coach' && p.position !== 'Parent' && !p.roles?.includes('coach') && !p.roles?.includes('parent')).length} players · {sport}
        </Text>
      </View>

      {/* Scope selector */}
      <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
        What to export
      </Text>
      <View
        style={{
          backgroundColor: 'rgba(15,23,42,0.6)',
          borderRadius: 14,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.07)',
          marginBottom: 24,
          overflow: 'hidden',
        }}
      >
        {([
          {
            key: 'current' as ExportScope,
            label: 'Current Season',
            sub: seasonName || 'Ongoing season',
          },
          ...(hasHistory
            ? [
                {
                  key: 'history' as ExportScope,
                  label: 'All Seasons',
                  sub: `Current + ${teamSettings?.seasonHistory?.length ?? 0} archived seasons`,
                },
              ]
            : []),
        ]).map((option, i) => (
          <Pressable
            key={option.key}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setScope(option.key);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: 'rgba(255,255,255,0.05)',
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 2,
                borderColor: scope === option.key ? '#22c55e' : 'rgba(255,255,255,0.2)',
                backgroundColor: scope === option.key ? 'rgba(34,197,94,0.2)' : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              {scope === option.key && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' }} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>{option.label}</Text>
              <Text style={{ color: '#475569', fontSize: 12, marginTop: 1 }}>{option.sub}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* What's included info */}
      <View
        style={{
          backgroundColor: 'rgba(103,232,249,0.06)',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(103,232,249,0.15)',
          padding: 14,
          marginBottom: 24,
          flexDirection: 'row',
          gap: 10,
          alignItems: 'flex-start',
        }}
      >
        <ChevronRight size={14} color="#67e8f9" style={{ marginTop: 2 }} />
        <Text style={{ color: '#94a3b8', fontSize: 13, lineHeight: 19, flex: 1 }}>
          Includes all player stats, attendance data (Invited / Games Played / %), and per-position stat columns.
          Opens in your system share sheet.
        </Text>
      </View>

      {/* Export button */}
      <Pressable
        onPress={handleExport}
        disabled={exporting}
        style={({ pressed }) => ({
          borderRadius: 14,
          overflow: 'hidden',
          opacity: pressed || exporting ? 0.8 : 1,
        })}
      >
        <LinearGradient
          colors={['#22c55e', '#16a34a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            paddingVertical: 15,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Download size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
                Export as CSV
              </Text>
            </>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );

  // ── Modal shell ────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0a1628' }}>
        <LinearGradient
          colors={['#0d1f3c', '#0a1628', '#0a1628']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {/* Header */}
        <Animated.View
          entering={FadeIn.delay(30)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '700' }}>
            Stats Export
          </Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} color="#94a3b8" />
          </Pressable>
        </Animated.View>

        <ScrollView
          contentContainerStyle={{ padding: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {checking ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <ActivityIndicator color="#67e8f9" size="large" />
              <Text style={{ color: '#475569', marginTop: 16, fontSize: 14 }}>Checking subscription…</Text>
            </View>
          ) : isPremium ? (
            renderExporter()
          ) : (
            renderPaywall()
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
