# 音声アセット（すべて CC0 / パブリックドメイン）

BGM と効果音は**外部の CC0 素材**を加工して `public/audio/` に同梱しています。
（`public/` 配下なので本体の HTML / JS には埋め込まれず、必要なときに遅延読み込みされます）

## BGM（`public/audio/bgm/`）

| ファイル | 元トラック | 作者 / 出典 | ライセンス | 使う場面 |
| --- | --- | --- | --- | --- |
| `menu.mp3` | *Welcome to the machine* | Komiku（[chosic.com](https://chosic.com) 収録） | CC0 1.0 | トップ画面・ロビー |
| `battle.mp3` | *Action Techno* | Komiku | CC0 1.0 | 対戦中・ひとり練習 |
| `result.mp3` | *Ultimate Power* | Komiku | CC0 1.0 | 最終結果画面 |

**加工内容（ループ化作業）**

1. テンポを推定（120 / 85.1 / 117.6 BPM）し、オンセット位置からビートの位相を割り出して
   **小節の頭でカット**（16 / 8 / 8 小節）
2. 正確なループ長（32.00s / 22.56s / 16.33s）で切り出し
3. `loudnorm`（-17 LUFS / TP -1.8dB）で3曲の音量を揃える
4. MP3 80kbps ステレオで書き出し（1曲あたり 160〜320KB）

## 効果音（`public/audio/se/`）

[Kenney.nl — Audio Pack](https://kenney.nl/assets/audio-pack)（CC0 1.0）から抜粋。

| ファイル | 元ファイル | 用途 |
| --- | --- | --- |
| `ui_click.mp3` | UI sounds / mouseclick1 | ボタン |
| `ui_hover.mp3` | UI sounds / rollover2 | ホバー |
| `ui_toggle.mp3` | UI sounds / switch4 | ON/OFF 切替 |
| `tile_select.mp3` | Digital sounds / pepSound1 | 数字タイル選択 |
| `op_select.mp3` | Digital sounds / pepSound3 | 演算子選択 |
| `calc.mp3` | Digital sounds / zapTwoTone | 計算確定 |
| `correct.mp3` | Jingle sounds / jingles_HIT07 | 正解 |
| `wrong.mp3` | Digital sounds / lowDown | 誤答・操作不可 |
| `tick.mp3` | UI sounds / click2 | カウントダウン |
| `go.mp3` | Digital sounds / threeTone1 | スタート |
| `round_end.mp3` | Jingle sounds / jingles_HIT02 | ラウンド確定 |
| `finish.mp3` | Jingle sounds / jingles_STEEL04 | 最終結果 |
| `chat_send.mp3` | UI sounds / switch13 | 自分のコメント送信 |
| `chat_recv.mp3` | Digital sounds / pepSound2 | 他人のコメント受信 |
| `join.mp3` | Digital sounds / powerUp4 | 入室 |
| `leave.mp3` | Digital sounds / phaserDown1 | 退室 |
| `start.mp3` | Digital sounds / powerUp1 | ゲーム開始 |
| `pass.mp3` | Digital sounds / lowRandom | パス |
| `laser.mp3` | Digital sounds / laser1 | 予備 |

- 加工: モノラル化 → `loudnorm`（-15 LUFS / TP -1.0dB）→ MP3 64kbps（合計 144KB）

## 実装メモ

- 再生は `src/lib/audio.ts`（`HTMLAudioElement` ベースの軽量エンジン）。
- 音源は `/audio/...` の URL で**必要になったときだけ**読み込む。
  - BGM: シーンが切り替わったときにストリーミング開始（クロスフェード）
  - SE: 初回再生時に読み込み（よく使う8種だけ unlock 直後に先読み）
- ブラウザの自動再生制限に合わせ、最初のタップ／キー入力で `unlockAudio()`。
- ON・OFF と音量は端末ごとに `localStorage`（`make10.audio`）へ保存。
- フォントも `public/fonts/`（woff2 のみ・合計 64KB）に置いて、HTML に埋め込まない。
