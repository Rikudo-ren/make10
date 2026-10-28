# 音声アセット（すべて CC0 / パブリックドメイン）

このゲームの BGM と効果音は、**外部の CC0（パブリックドメイン）素材**を加工して同梱しています。
クレジット表記は不要ですが、出典を残しておきます。

## BGM（`bgm/`）

| ファイル | 元ネタ | ライセンス | 使っている場面 |
| --- | --- | --- | --- |
| `menu.mp3` | [FreePD.com](https://freepd.com/) — *Future Setting D* (Zoned) | CC0 1.0 | トップ画面・ロビー |
| `battle.mp3` | FreePD.com — *Future Setting A* (Zoned) | CC0 1.0 | 対戦中・ひとり練習 |
| `result.mp3` | FreePD.com — *Neon and Kickboxing* (Zoned) | CC0 1.0 | 最終結果画面 |

**加工内容**

1. イントロを避けて 34〜48 秒を切り出し
2. 末尾 1.5 秒と先頭 1.5 秒をクロスフェードして継ぎ目なしのループを作成
3. `loudnorm`（-16 LUFS / TP -1.5dB）で音量を揃える
4. MP3 96kbps ステレオで書き出し

## 効果音（`se/`）

| ファイル | 元ネタ（Kenney *Audio Pack* 内のパス） | 用途 |
| --- | --- | --- |
| `ui_click.mp3` | UI sounds / mouseclick1 | ボタン |
| `ui_hover.mp3` | UI sounds / rollover2 | ホバー |
| `ui_toggle.mp3` | UI sounds / switch4 | ON/OFF 切替 |
| `tile_select.mp3` | Digital sounds / pepSound1 | 数字タイル選択 |
| `op_select.mp3` | Digital sounds / pepSound3 | 演算子選択 |
| `calc.mp3` | Digital sounds / zapTwoTone | 計算実行 |
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

- 出典: [Kenney.nl — Audio Pack](https://kenney.nl/assets/audio-pack)（CC0 1.0）
- 加工: モノラル化 → `loudnorm`（-15 LUFS / TP -1.0dB）→ MP3 96kbps

## 実装メモ

- 再生は `src/lib/audio.ts` の軽量エンジン（Web Audio ではなく `HTMLAudioElement`）。
- ブラウザの自動再生制限に合わせて、最初のタップ／キー入力で `unlockAudio()` を呼びます。
- BGM はシーンに応じてクロスフェードで切り替え（トップ／対戦／結果）。
- ON・OFF と音量は端末ごとに `localStorage`（`make10.audio`）へ保存。
- ビルドは `vite-plugin-singlefile` で単一 HTML になるため、音声は base64 でインライン化されます。
