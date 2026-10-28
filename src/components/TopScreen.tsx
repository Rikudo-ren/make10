import { useState } from 'react';
import { Button, Card } from './ui';
import { IconArrowRight, IconBolt, IconGrid, IconPlay, IconTarget, IconUsers } from './icons';
import { playSe } from '../lib/audio';
import type { JoinPreview } from '../lib/useRoom';
import { TeamPicker } from './TeamPicker';
import { pickJoinTeamId } from '../lib/teams';
import { TEAM_DEFS } from '../lib/teams';

interface Props {
  busy: boolean;
  error: string | null;
  authError: string | null;
  onCreate: (name: string) => void;
  onPeek: (code: string) => Promise<JoinPreview | null>;
  onJoin: (code: string, name: string, teamId?: number | null) => void;
  onSolo: () => void;
}

const STATUS_LABEL: Record<JoinPreview['status'], string> = {
  lobby: 'ロビーで待機中',
  playing: '対戦中（途中参加できます）',
  judging: '結果発表中（次の問題から参加できます）',
  finished: '試合終了（ロビーに戻れば再戦に参加できます）',
};

export function TopScreen({ busy, error, authError, onCreate, onPeek, onJoin, onSolo }: Props) {
  const [name, setName] = useState(() => localStorage.getItem('make10.name') ?? '');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'none' | 'join'>('none');
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);

  /** 参加ボタン: チーム戦で所属が未保存なら、まずチーム選択を出す */
  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    if (preview && preview.code === trimmed && preview.needsTeamChoice) {
      if (selectedTeam === null) return;
      playSe('join');
      onJoin(trimmed, name.trim(), selectedTeam);
      return;
    }
    const pv = await onPeek(trimmed);
    if (!pv) return;
    if (pv.needsTeamChoice) {
      setPreview(pv);
      // 既定は「人数が一番少ないチーム」を選んでおく（あとから変更可）
      setSelectedTeam(
        pickJoinTeamId({
          players: pv.teams.flatMap((t) =>
            t.members.map((m) => ({ uid: m.name, teamId: t.teamId })),
          ),
          teamCount: pv.teamCount,
        }),
      );
      return;
    }
    playSe('join');
    onJoin(trimmed, name.trim());
  };

  const save = (n: string) => {
    setName(n);
    localStorage.setItem('make10.name', n);
  };

  const canGo = !!name.trim() && !busy;

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-8 px-5 pt-10 pb-24">
      {/* 背景装飾 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-16 h-72 w-72 rounded-full ambient-cyan" />
        <div className="absolute -right-10 top-0 h-80 w-80 rounded-full ambient-magenta" />
        <div className="noise absolute inset-0 opacity-40" />
        <div className="grid-overlay absolute inset-0" />
      </div>

      {/* ステータスバー */}
      <div className="relative flex items-center justify-between gap-4 border-b border-white/10 pb-3">
        <div className="label flex items-center gap-2 text-cyan-200/70">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_10px_#22e0ff]" />
          SYSTEM ONLINE
        </div>
        <div className="num flex items-center gap-3 text-[10px] tracking-[.3em] text-slate-500">
          <span className="hidden sm:inline">MACRO // CALC-BATTLE</span>
          <span className="text-cyan-300/60">v2.0</span>
        </div>
      </div>

      {/* ヒーロー */}
      <div className="relative flex flex-col items-center gap-8 text-center lg:flex-row lg:items-stretch lg:justify-between lg:gap-12 lg:text-left">
        <div className="flex max-w-xl flex-col justify-center">
          <div className="mb-4 flex items-center justify-center gap-2 lg:justify-start">
            <span className="chip border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-200">
              REALTIME CALC BATTLE
            </span>
            <span className="label hidden text-slate-500 sm:inline">TARGET 10</span>
          </div>

          <h1 className="font-display leading-[0.92] font-black tracking-tight">
            <span className="glitch block text-[15vw] leading-[0.9] sm:text-[74px]" data-text="MAKE 10">
              <span className="grad-cyber">MAKE 10</span>
            </span>
            <span className="mt-1 block text-[7vw] tracking-[0.42em] text-cyan-100/90 sm:text-[30px]">
              BATTLE
            </span>
          </h1>

          <p className="jp mt-5 text-[13px] leading-relaxed text-slate-400 sm:text-sm">
            出された数字を四則演算でつないで <b className="text-cyan-300">「10」</b> を作れ。
            <br className="hidden sm:block" />
            同じ問題に全員で同時挑戦する、早解きリアルタイム対戦。
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
            <span className="chip gap-1.5 text-cyan-200/90">
              <IconTarget size={12} /> 出題は必ず解あり
            </span>
            <span className="chip gap-1.5 text-cyan-200/90">
              <IconBolt size={12} /> 通信ラグ補正
            </span>
            <span className="chip gap-1.5 text-cyan-200/90">
              <IconUsers size={12} /> 人数制限なしで対戦
            </span>
          </div>
        </div>

        {/* 例題カード */}
        <div className="card card-accent hud-corner relative w-full max-w-sm shrink-0 overflow-hidden p-5 sm:p-6">
          <div className="scan-line" />
          <div className="relative mb-4 flex items-center justify-between">
            <span className="label text-cyan-200/80">HOW TO PLAY</span>
            <span className="chip border-solar/40 bg-solar/10 text-amber-200">
              TARGET
              <b className="num ml-1 text-base">10</b>
            </span>
          </div>
          <div className="relative grid grid-cols-4 gap-2">
            {['7', '3', '8', '2'].map((n, i) => (
              <div key={i} className="aspect-square">
                <span className="tile title-example-tile" style={{ cursor: 'default' }}>
                  {n}
                </span>
              </div>
            ))}
          </div>
          <div className="relative my-3 flex items-center gap-2">
            <span className="hairline flex-1" />
            <IconArrowRight size={14} className="rotate-90 text-cyan-300/70" />
            <span className="hairline flex-1" />
          </div>
          <div className="relative border border-white/10 bg-black/40 px-4 py-3 text-center">
            <div className="label text-slate-500">SOLUTION EXAMPLE</div>
            <div className="num mt-1 text-[15px] font-bold text-cyan-100 sm:text-[17px]">
              8 + ( 7 − 3 ) ÷ 2 <span className="text-fuchsia-300">= 10</span>
            </div>
          </div>
          <p className="jp mt-3 text-center text-[11px] leading-relaxed text-slate-500">
            数字 → 演算子 → 数字、の順にタップで計算。
            <br />
            数字が1個になり <b className="text-cyan-300">10</b> になったらクリア。
          </p>
        </div>
      </div>

      {/* 操作カード */}
      <Card accent className="relative mx-auto w-full max-w-2xl p-6 sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <span className="label text-cyan-200/80">PLAYER SETUP</span>
          <span className="hairline flex-1" />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="label jp tracking-[.2em] text-cyan-200/70">ニックネーム</span>
          <input
            className="input font-bold tracking-wide"
            placeholder="例：たろう"
            maxLength={16}
            value={name}
            onChange={(e) => save(e.target.value)}
          />
        </label>

        {mode === 'join' && (
          <label className="animate-float-up mt-4 flex flex-col gap-1.5">
            <span className="label jp tracking-[.2em] text-cyan-200/70">ルームコード（6文字）</span>
            <input
              className="input num text-center text-2xl font-black tracking-[.45em] uppercase"
              placeholder="ABC123"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setPreview(null);
                setSelectedTeam(null);
              }}
              inputMode="text"
              autoCapitalize="characters"
            />
          </label>
        )}

        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          <Button
            variant="primary"
            disabled={!canGo}
            onClick={() => {
              playSe('start');
              onCreate(name.trim());
            }}
            className="py-4"
          >
            <IconPlay size={14} />
            ルームを作る
          </Button>
          {mode === 'join' ? (
            <Button
              variant="magenta"
              disabled={!canGo || code.length < 4 || (preview?.needsTeamChoice && selectedTeam === null)}
              onClick={() => void handleJoin()}
              className="py-4"
            >
              <IconArrowRight size={14} />
              {preview?.needsTeamChoice
                ? selectedTeam !== null
                  ? `${TEAM_DEFS[selectedTeam]?.label ?? ''}で参加`
                  : 'チームを選んで参加'
                : 'このコードで参加'}
            </Button>
          ) : (
            <Button
              variant="soft"
              disabled={busy}
              onClick={() => {
                playSe('toggle');
                setMode('join');
              }}
              className="py-4"
            >
              <IconGrid size={14} />
              ルームに入る
            </Button>
          )}
        </div>

        {preview?.needsTeamChoice && (
          <div className="animate-float-up mt-5 border border-white/10 bg-black/30 p-4">
            <div className="label jp text-cyan-200/80">参加するチームを選んでください</div>
            <p className="jp mt-1.5 text-[11px] leading-relaxed text-slate-400">
              このルームはチーム戦です（{STATUS_LABEL[preview.status]}／{preview.playerCount}人参加中）。
              各チームのメンバーを見て、入りたいチームをタップしてください。
              {preview.status === 'lobby' && preview.teamAssignMode !== 'manual' && (
                <>
                  <br />
                  ※ ロビーから試合を始める場合は、開始時にチーム分け設定
                  （{preview.teamAssignMode === 'random' ? 'ランダム' : 'バランス'}）で振り分け直されます。
                  対戦中の途中参加では、選んだチームにそのまま入ります。
                </>
              )}
              {preview.isReturning && preview.myScore !== null && (
                <>
                  <br />
                  前回の記録が残っています: <b className="text-cyan-200">{preview.myScore}点</b>
                  を引き継いで復帰します（所属チームだけ選んでください）。
                </>
              )}
            </p>
            <div className="mt-3">
              <TeamPicker
                teams={preview.teams}
                selected={selectedTeam}
                onSelect={setSelectedTeam}
                showScores={preview.status !== 'lobby'}
                disabled={busy}
              />
            </div>
          </div>
        )}

        <div className="my-5 flex items-center gap-3">
          <span className="hairline flex-1" />
          <span className="label text-slate-500">OR</span>
          <span className="hairline flex-1" />
        </div>

        <Button
          variant="ghost"
          className="w-full py-3.5"
          onClick={() => {
            playSe('ui');
            onSolo();
          }}
        >
          ひとり練習モード（オフライン）
        </Button>

        {(error || authError) && (
          <p className="jp mt-5 border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-200">
            {error ?? `接続エラー: ${authError}`}
          </p>
        )}
      </Card>

      <div className="relative flex flex-col items-center gap-2 text-center">
        <div className="num flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] tracking-[.2em] text-slate-600">
          <span>BGM: Komiku (CC0)</span>
          <span className="text-slate-700">/</span>
          <span>SE: Kenney Audio Pack (CC0)</span>
        </div>
        <p className="jp text-[10px] leading-relaxed text-slate-600">
          ルームとスコア・履歴・チャットは、最終アクセスから24時間で自動削除されます。
        </p>
      </div>
    </div>
  );
}
