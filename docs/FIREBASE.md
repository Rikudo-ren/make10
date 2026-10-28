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
| `rooms/{code}/players/...` | ニックネーム・得点・準備OK | **最終アクセスから24時間**（自動削除） |
| `rooms/{code}/currentRound` | 出題中の問題・解答例・結果 | 同上 |
| `rooms/{code}/answers/{round}/{uid}` | 各ラウンドの解答・パスの記録 | 同上 |
| `rooms/{code}/history/{round}` | 終わったラウンドの結果 | 同上 |
| `rooms/{code}/chat/{msgId}` | **ゲーム内チャット** | 直近 **60件** のみ（超えた分は送信時に自動削除） |
| `rooms/{code}/expiresAt` | そのルームの有効期限（最終アクセス + 24時間） | ルームと一緒に消える |
| `rooms/index/{code}` | 期限切れ掃除用の軽量インデックス（`expiresAt` だけ） | ルームと一緒に消える |
| `rooms/{code}/preparingAt` | 「問題を準備中」表示用の一時フラグ | 出題が終わると自動削除 |
| ブラウザの `localStorage` | `make10.room`（ルームコード）と `make10.name`（ニックネーム）だけ | 端末内のみ |

### 「記録」は残り続ける？

**残りません。最終アクセスから24時間で自動削除されます。**

- **スコアや履歴をどこかに永久保存する仕組みはありません。** すべて `rooms/{code}` の中だけです。
- **GM（ルーム作成者）が「退出」すると、ルームごと削除**します。チャット・スコア・履歴・解答がまとめて消えます。
- さらに **最終アクセス（作成・参加・解答・パス・チャット・設定変更など）から24時間経過したルーム**は、
  アプリを開いた人のクライアントが自動で削除します（下の「24時間TTLの仕組み」参照）。
- 期限切れのルームにルームコードで参加しようとした場合も、その場で削除してエラーにします。
- ルームが削除されると、参加者側も自動でトップ画面に戻ります（`rooms/{code}` が消えたことを検知）。
- チャットはルーム単位で直近60件だけなので、チャット履歴がサーバーに溜まり続けることはありません。

### 24時間TTLの仕組み（Cloud Functions 不要）

Realtime Database には Firestore の TTL に相当する自動削除機能がないため、
**「ルームの期限だけを持つ軽量インデックス」＋「クライアント側の掃除」** で実現しています。

1. ルーム作成・参加・操作のたびに `rooms/{code}/expiresAt` と `rooms/index/{code}/expiresAt` を
   「今 + 24時間」に更新（連続操作時は1分に1回までに間引き）
2. アプリ起動時と10分おきに `rooms/index` を読み、`expiresAt` を過ぎたルームを丸ごと削除
3. ゴミが残らないよう、`rooms/index` のエントリもルームと同時に削除

- 追加の Firebase 作業は **不要**です（ルールは `rooms` 配下を読み書きできればOK）。
- 誰もアプリを開かないと掃除は走りませんが、その場合も次に誰かが開いた時点で消えます。
- **この機能より前に作られた古いルーム**（期限情報が無いもの）は、1日1回の自動スキャンで
  「その時点から24時間」の期限が付与されます。すぐ消したければコンソールから手動削除してください。
- 厳密に「24時間後に必ず消す」必要があるなら、下の Cloud Functions 版に置き換えてください。

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
        "expiresAt": { ".validate": "newData.isNumber()" },
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

### (3) 任意: サーバー側でも確実に消したい場合

クライアント側の掃除で通常は十分ですが、「誰もアプリを開いていなくても24時間で必ず消したい」
場合は下の Cloud Functions 版（要 Blaze プラン）に置き換えてください。

---

## 3. データの削除タイミングまとめ

| 操作 | 消えるもの |
| --- | --- |
| GMが「退出」（確認ダイアログで解散） | `rooms/{code}` まるごと（参加者・スコア・履歴・チャット・問題） |
| 参加者が「退出」 | その人の `players/{uid}/name` と `isReady` だけ。スコアや発言は残る（ルーム削除まで） |
| チャットが61件目以降 | 一番古いメッセージから自動削除（直近60件を保持） |
| GMが「履歴を消す」 | そのルームのチャット全件 |
| 出題が完了 | `preparingAt`（準備中フラグ） |
| **最終アクセスから24時間** | **`rooms/{code}` と `rooms/index/{code}`（アプリ起動時の自動掃除）** |

> 補足: チャットを「送信した瞬間だけ表示して保存しない」ようにするには Realtime Database ではなく
> Firestore の TTL か、Functions 経由の配信が必要です。今回は「ルーム内・直近60件・解散で全消し」で
> 実用上ほぼ残らない形にしています。

---

## 4. サーバー側で24時間TTLを厳密に運用する場合（任意）

`functions/index.js` に置いて `firebase deploy --only functions` すると、
**15分おきに `rooms/index` を見て、期限切れルームを削除**します
（クライアント側の掃除と同じルールなので、併用しても問題ありません）。

```js
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

initializeApp();

const TTL_MS = 24 * 60 * 60 * 1000;

exports.cleanupRooms = onSchedule('every 15 minutes', async () => {
  const db = getDatabase();
  const now = Date.now();

  // 1) 期限切れルームを削除
  const idx = (await db.ref('rooms/index').get()).val() || {};
  const updates = {};
  for (const [code, entry] of Object.entries(idx)) {
    const exp = entry?.expiresAt;
    if (typeof exp === 'number' && exp <= now) {
      updates[`rooms/${code}`] = null;
      updates[`rooms/index/${code}`] = null;
    }
  }
  if (Object.keys(updates).length > 0) await db.ref().update(updates);

  // 2) 期限情報が無いルーム（旧データ）に期限を付ける
  const rooms = (await db.ref('rooms').get()).val() || {};
  const idx2 = (await db.ref('rooms/index').get()).val() || {};
  const fixes = {};
  for (const code of Object.keys(rooms)) {
    if (!idx2[code]?.expiresAt) {
      fixes[`rooms/${code}/expiresAt`] = now + TTL_MS;
      fixes[`rooms/index/${code}/expiresAt`] = now + TTL_MS;
    }
  }
  if (Object.keys(fixes).length > 0) await db.ref().update(fixes);
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
