# Firebase の設定と「記録の保存」について

このアプリは **Firebase Realtime Database（RTDB）** と **匿名認証** だけで動いています。
サーバー（Cloud Functions など）は使っていません。

- プロジェクト: `make10-47c34`
- データベース: `https://make10-47c34-default-rtdb.firebaseio.com`
- 接続情報は `src/firebase.ts`（apiKey は公開前提の値です。守るのは DB ルール）

---

## 1. いま何がどこに保存されるか

| パス | 内容 | 保存される期間 |
| --- | --- | --- |
| `rooms/{code}/players/...` | ニックネーム・得点・準備OK | ルームが削除されるまで |
| `rooms/{code}/currentRound` | 出題中の問題・解答例・結果 | 同上 |
| `rooms/{code}/answers/{round}/{uid}` | 各ラウンドの解答・パスの記録 | 同上 |
| `rooms/{code}/history/{round}` | 終わったラウンドの結果 | 同上 |
| `rooms/{code}/chat/{msgId}` | **ゲーム内チャット** | 直近 **60件** のみ（超えた分は送信時に自動削除） |
| `rooms/{code}/preparingAt` | 「問題を準備中」表示用の一時フラグ | 出題が終わると自動削除 |
| ブラウザの `localStorage` | `make10.room`（ルームコード）と `make10.name`（ニックネーム）だけ | 端末内のみ |

### 「記録」は残り続ける？

- **スコアや履歴をどこかに永久保存する仕組みはありません。** すべて `rooms/{code}` の中だけです。
- **GM（ルーム作成者）が「退出」すると、ルームごと削除**します。チャット・スコア・履歴・解答がまとめて消えます。
- ルームが削除されると、参加者側も自動でトップ画面に戻ります（`rooms/{code}` が消えたことを検知）。
- ただし **GMがタブを閉じた／電源が落ちただけ**の場合は削除が走らず、ルームが残ることがあります。その掃除は下の「4. 古いルームを自動で消す（任意）」を参照してください。
- チャットはルーム単位で直近60件だけなので、チャット履歴がサーバーに溜まり続けることはありません。

---

## 2. Firebase コンソールでやってもらう作業

アプリ側の実装は終わっているので、**Firebase 側は次の2つ（＋任意で1つ）** だけお願いします。

### (1) 匿名認証が有効か確認（必須）

Firebase コンソール → **Authentication** → **Sign-in method** → **匿名 / Anonymous** が「有効」になっていること。

> 無効だと `auth/operation-not-allowed` になり、ルーム作成もチャットも動きません。

### (2) Realtime Database のルールを更新（推奨）

Firebase コンソール → **Realtime Database** → **ルール** タブに、リポジトリの
[`firebase/database.rules.json`](../firebase/database.rules.json) の中身を貼り付けて「公開」。

いまのルールがすでに `rooms` 配下を読み書きできる設定（例: `".read": true, ".write": true`）なら、
**チャットのためだけに新しい設定は必須ではありません**（チャットも `rooms/{code}/chat` に書くため）。
ただし、下のルールにしておくとチャット本文の長さ・型がチェックされて安全です。

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "rooms": {
      "$room": {
        ".read": "auth != null",
        ".write": "auth != null",
        "chat": {
          "$msg": {
            ".validate": "newData.hasChildren(['uid','name','text','at']) && newData.child('text').isString() && newData.child('text').val().length <= 140 && newData.child('name').isString() && newData.child('name').val().length <= 20 && newData.child('at').isNumber()"
          }
        },
        "players": {
          "$uid": {
            "name": { ".validate": "newData.isString() && newData.val().length <= 20" },
            "score": { ".validate": "newData.isNumber()" },
            "isReady": { ".validate": "newData.isBoolean()" }
          }
        }
      }
    }
  }
}
```

CLI でデプロイする場合（`firebase-tools` が入っていてログイン済みなら）:

```bash
firebase deploy --only database --project make10-47c34
```

（リポジトリ直下の `firebase.json` が上記ルールファイルを指しています）

**このルールの意味**

- ログイン（匿名認証）していない人は読み書き不可
- ルームコードを知っている人だけがそのルームを読める（`rooms` 全体の一覧は取れない）
- チャットは 140 文字以内・名前は 20 文字以内・`at` は数値のみ

> ⚠️ ルームコードを知っていれば誰でもそのルームに読み書きできる「合言葉方式」です。
> 本気で他人を締め出したい場合は Cloud Functions などサーバー側の実装が必要になります。

### (3) 任意: 古いルームを自動削除する

`rooms` は GM が退出すれば消えますが、ブラウザを落とした場合は残ります。
放置が気になる場合は次のどちらかで掃除してください。

- **手動**: Firebase コンソール → Realtime Database → `rooms` を開いて不要なコードを削除
- **自動**: 下記の Cloud Functions（要 Blaze プラン）

---

## 3. データの削除タイミングまとめ

| 操作 | 消えるもの |
| --- | --- |
| GMが「退出」（確認ダイアログで解散） | `rooms/{code}` まるごと（参加者・スコア・履歴・チャット・問題） |
| 参加者が「退出」 | その人の `players/{uid}/name` と `isReady` だけ。スコアや発言は残る（ルーム削除まで） |
| チャットが61件目以降 | 一番古いメッセージから自動削除（直近60件を保持） |
| GMが「履歴を消す」 | そのルームのチャット全件 |
| 出題が完了 | `preparingAt`（準備中フラグ） |

> 補足: チャットを「送信した瞬間だけ表示して保存しない」ようにするには Realtime Database ではなく
> Firestore の TTL か、Functions 経由の配信が必要です。今回は「ルーム内・直近60件・解散で全消し」で
> 実用上ほぼ残らない形にしています。

---

## 4. 古いルームを自動で消す Cloud Functions のサンプル（任意）

`functions/index.js` に置いて `firebase deploy --only functions` すると、
**6時間アクセスのないルーム**を15分おきに削除します。

```js
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

initializeApp();

const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6時間

exports.cleanupRooms = onSchedule('every 15 minutes', async () => {
  const db = getDatabase();
  const snap = await db.ref('rooms').get();
  const rooms = snap.val() || {};
  const now = Date.now();
  const updates = {};

  for (const [code, room] of Object.entries(rooms)) {
    const times = [];
    if (typeof room?.preparingAt === 'number') times.push(room.preparingAt);
    if (typeof room?.currentRound?.startedAt === 'number') times.push(room.currentRound.startedAt);
    for (const m of Object.values(room?.chat || {})) {
      if (typeof m?.at === 'number') times.push(m.at);
    }
    const last = times.length > 0 ? Math.max(...times) : 0;
    if (last === 0 || now - last > MAX_AGE_MS) {
      updates[`rooms/${code}`] = null;
    }
  }

  if (Object.keys(updates).length > 0) await db.ref().update(updates);
});
```

必要なもの: Blaze プラン / `firebase-functions`・`firebase-admin` のインストール /
`functions/package.json`。不要ならこのセクションは無視してください。

---

## 5. チャット仕様（実装メモ）

- 保存先: `rooms/{code}/chat/{msgId}`（`{ uid, name, text, at }`）
- 最大 140 文字、前後の空白と連続改行は圧縮
- 連投防止 500ms（クライアント側）
- 直近 60 件を超えた分は送信時に削除
- 送信者の表示名は `players/{uid}/name`（同名は参加時に自動で連番）
- React のテキストとして描画するので HTML インジェクションは起きません
- GMは「履歴を消す」で全削除できます
