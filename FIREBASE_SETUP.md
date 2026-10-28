# Firebase 側でやること（チェックリスト）

このアプリは Firebase **Authentication（匿名）** と **Realtime Database** だけを使っています。
今回のチャット追加で、保存先が 1 つ増えました。

| 用途 | パス | 備考 |
| --- | --- | --- |
| ルーム（設定・参加者・スコア・ラウンド履歴） | `rooms/{ROOM_CODE}` | 既存のまま |
| ゲーム内チャット | `chats/{ROOM_CODE}/messages/{pushId}` | **今回追加** |

---

## 1. 匿名ログインを有効にする（既に動いていれば作業不要）

Firebase コンソール → **Authentication** → **Sign-in method** → **匿名** を「有効」。
（ログインできていないと `authError` がトップ画面に出ます）

## 2. Realtime Database のルールを更新する ← 必須

Firebase コンソール → **Realtime Database** → **ルール** に以下を貼り付けて公開します。

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "rooms": {
      "$code": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "chats": {
      "$code": {
        ".write": "auth != null && root.child('rooms').child($code).child('gmUid').val() === auth.uid",
        "messages": {
          ".read": "auth != null",
          "$msg": {
            ".write": "auth != null && ((!data.exists() && newData.child('uid').val() === auth.uid) || (data.exists() && data.child('uid').val() === auth.uid))",
            ".validate": "!newData.exists() || (newData.hasChildren(['uid','name','text']) && newData.child('text').isString() && newData.child('text').val().length <= 120)"
          }
        }
      }
    }
  }
}
```

このルールの意味:

- `rooms/{code}` は今まで通り「ログイン済みなら読み書き可」（クライアント側で GM 判定しています）
- `chats/{code}/messages` はログイン済みなら**読める**、**自分のメッセージだけ**書ける／消せる
- `chats/{code}` 全体を消せるのは **そのルームの GM だけ**（再戦時に履歴を消すため）
- `text` は 120 文字まで・型チェックあり

> ⚠️ ルールを変えずに（テストモードのままで）もチャットは動きますが、
> 「誰でも全部読み書きできてしまう」状態なので、公開前には上記にしておくのがおすすめです。

## 3. チャットの保存ポリシー（実装済み）

「記録を残さない」方針で、次のようにしています。

- チャットは `rooms` ではなく **`chats/{ROOM_CODE}` という別ノード**に保存（スコアやラウンド履歴には一切混ざりません）
- **GM が「ロビーに戻る（再戦）」を押したタイミングで `chats/{ROOM_CODE}` ごと削除**
- 各ユーザーは、**自分が送った 30 分以上前のメッセージを自動削除**（チャットを開いたときに掃除）
- 表示・保持するのは直近 120 件まで
- ログアウト・退出してもメッセージは残りますが、部屋が消えれば道連れで消えます

> Realtime Database には TTL 機能が無いので「◯時間後に自動削除」をサーバー側でやるなら
> Cloud Functions か、下記 5. の掃除処理が必要です。

## 4. 動作確認

1. 2 端末（または通常ウィンドウ + シークレットウィンドウ）で同じルームに入る
2. 右下の 💬 ボタンからチャットを開いて送信
3. もう片方に届き、未読バッジが付くこと
4. GM が「ロビーに戻る（再戦）」→ `chats/{CODE}` が消えること
5. パスを押したあとも、数字を選んで解答できること（パスは自動で取り消されます）

## 5.（任意）古いルーム・チャットの掃除

部屋は誰も消さない限り `rooms/{CODE}` に残り続けます（＝スコアや履歴も残ります）。
「記録を一切残したくない」場合は、たとえば Cloud Functions のスケジュール実行で
24 時間以上更新のない `rooms/{code}` と `chats/{code}` を削除します。

```js
// functions/index.js（例）
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
admin.initializeApp();

exports.cleanupOldRooms = onSchedule('every 24 hours', async () => {
  const db = admin.database();
  const snap = await db.ref('rooms').get();
  const now = Date.now();
  const rooms = snap.val() || {};
  const updates = {};
  for (const code of Object.keys(rooms)) {
    const r = rooms[code];
    const last = Math.max(
      r?.currentRound?.endedAt || 0,
      r?.currentRound?.startedAt || 0,
      ...Object.values(r?.history || {}).map((h) => h?.endedAt || 0),
    );
    if (!last || now - last > 24 * 60 * 60 * 1000) {
      updates[`rooms/${code}`] = null;
      updates[`chats/${code}`] = null;
    }
  }
  if (Object.keys(updates).length) await db.ref().update(updates);
});
```

> 関数を使わない場合は、コンソールの Realtime Database 画面から
> `rooms` / `chats` の不要なコードを手で削除でも OK です。

## 6. 補足：API キーについて

`src/firebase.ts` に書かれている `apiKey` などは公開前提の識別子で、
これ自体が漏れても Firebase のデータは守られます（守るのはルール）。
一方で **Database のルールが `true` のまま**だと誰でも DB を読み書きできるので、
そこだけは必ず確認してください。
