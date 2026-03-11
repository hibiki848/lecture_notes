# 講義ノートメーカー向け Stripe サブスク導入ガイド（MVP）

このドキュメントは、既存 `Node.js/Express + MySQL` 構成の講義ノートメーカーに、**Free / Pro の2段階課金**を最小構成で安全に追加するための実装メモです。

## 1. 全体構成

### A. `server.js` に直接書く最小案

- 既存 `server.js` に以下を追加。
  - Stripe初期化
  - Billing API（Checkout / Webhook / Me / Cancel / Portal）
  - `requirePro` / `requireActiveSubscription` / `requireUsageLimit`
  - 機能ガード付きAPI（PDF / AI要約 / 問題生成 / クイズ作成）

### B. 分割構成（将来推奨）

```txt
src/
  app.js
  config/
    stripe.js
    db.js
    plans.js
  routes/
    billing.routes.js
    notes.routes.js
    quizzes.routes.js
  controllers/
    billing.controller.js
    notes.controller.js
    quizzes.controller.js
  services/
    billing.service.js
    usage.service.js
    stripe-webhook.service.js
  middleware/
    auth.middleware.js
    billing.middleware.js
    usage-limit.middleware.js
  repositories/
    subscription.repo.js
    payment-event.repo.js
    usage.repo.js
```

## 2. DB設計

MVPで最低限必要:

- `users`（既存）: `stripe_customer_id` を追加
- `subscriptions`: Stripeの契約状態を正として保持
- `payment_events`: Webhook重複受信対策 + 監査
- `plans`（任意だが推奨）: 将来の年額・クーポン対応で便利
- `usage_counters`: 月次のAI要約/問題生成回数を管理

## 3. SQL

`db/billing_schema.sql` に実行用SQLを用意。

- `payment_events.event_id` に UNIQUE 制約あり
- `subscriptions.stripe_subscription_id` に UNIQUE 制約あり
- `usage_counters (user_id, feature_code, period_month)` に UNIQUE 制約あり

## 4. Express API設計

### Billing API

#### `POST /api/billing/create-checkout-session`
- 役割: Pro月額の Checkout Session 作成
- 認証: 必須
- request例:
```json
{}
```
- response例:
```json
{ "url": "https://checkout.stripe.com/...", "sessionId": "cs_test_..." }
```

#### `POST /api/billing/webhook`
- 役割: Stripeイベント受信（署名検証あり）
- 認証: 不要（Stripe署名で検証）
- event対応:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

#### `GET /api/billing/me`
- 役割: ログインユーザーの契約状態・機能上限・使用量返却
- 認証: 必須

#### `POST /api/billing/cancel`
- 役割: `cancel_at_period_end=true` で期間末解約
- 認証: 必須

#### `POST /api/billing/portal`
- 役割: Stripe Billing Portal遷移URL発行
- 認証: 必須

### 講義ノートメーカーの主要機能に対するガード例

#### `POST /api/notes/:id/export-pdf`
- `requirePro`
- Freeは 403 / `PRO_REQUIRED`

#### `POST /api/notes/:id/ai-summary`
- `requireUsageLimit("ai_summary", "ai_summary_monthly_limit")`
- 実行後 `usage_counters` を加算

#### `POST /api/notes/:id/generate-quiz`
- `requireUsageLimit("quiz_generation", "quiz_generation_monthly_limit")`
- 実行後 `usage_counters` を加算

#### `POST /api/quizzes`
- クイズ作成時、プランごとの `max_custom_quizzes` を判定

### エラー返却方針

- 認証なし: `401`
- Pro限定機能: `403` + `{ code: "PRO_REQUIRED" }`
- 課金契約必須機能: `402` + `{ code: "SUBSCRIPTION_REQUIRED" }`
- 利用回数超過: `429` + `{ code: "USAGE_LIMIT_EXCEEDED" }`
- 汎用: `500` + `{ message: "server error" }`

## 5. Stripe連携コード要点

- Stripe初期化
  - `const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)`
- Checkout作成
  - `mode: "subscription"`
  - `line_items: [{ price: STRIPE_PRICE_ID_PRO_MONTHLY, quantity: 1 }]`
- Webhook署名検証
  - `stripe.webhooks.constructEvent(req.rawBody, signature, STRIPE_WEBHOOK_SECRET)`
- 正の状態遷移
  - success画面到達ではなく、**Webhook受信でDB更新**

## 6. DB更新処理（Webhook）

フロー:
1. `payment_events` に event_id が既にあるか確認
2. なければ `payment_events` にINSERT
3. イベント種別ごとに `subscriptions` を UPSERT
4. `invoice.payment_failed` は `past_due` に更新

## 7. 有料会員判定ミドルウェア

- `requirePro`
  - `plan_code=pro` かつ `status in(active, trialing)` を想定
- `requireActiveSubscription`
  - Pro限定でなく「契約有効」を要する機能向け
- `requireUsageLimit(feature, key)`
  - 将来、AI要約・問題生成・音声学習などの増加にも使い回せる

## 8. .env.example

`.env.example` を新規追加済み。Stripe + DB + App URL を定義。

## 9. 実装手順（初学者向け）

1. Stripeで Product/Price（Pro月額）を作成
2. `.env` に Stripe鍵 / Price ID を設定
3. `db/billing_schema.sql` を適用
4. `npm i stripe`
5. サーバー起動
6. Stripe CLIでWebhook転送
   - `stripe listen --forward-to localhost:3000/api/billing/webhook`
7. ログインして `create-checkout-session` 実行
8. テストカードで決済
9. `GET /api/billing/me` とDB反映を確認
10. `cancel` と `invoice.payment_failed` イベントを確認

## 10. 動作確認項目

- 無料ユーザーが `export-pdf` 実行 → 403
- 無料ユーザーが AI要約上限超過 → 429
- 決済成功で `subscriptions` が `active`
- 解約で `cancel_at_period_end=true`
- 支払い失敗で `past_due`
- Webhook再送で `payment_events` 重複が無視される
- 未ログインで billing API → 401
- `usage_counters` が月次で加算される
- ノートから問題生成APIの上限が効く
- クイズ作成上限がプランごとに効く

## 11. 注意点

- `success_url` 到達だけで有料化しない（Webhookを正にする）
- Webhook署名検証を必須化
- イベント重複は `payment_events.event_id UNIQUE` で抑止
- フロントの非表示だけに頼らずAPI側で必ず判定
- `users.stripe_customer_id` で Stripe Customer と user を1対1紐付け
- 解約はMVPでは期間末（`cancel_at_period_end`）が安全
- 将来、年額プラン/クーポンは `plans` テーブルで吸収
- 利用制限は `usage_counters` + `PLAN_FEATURES` で機能単位に柔軟化

## 講義ノートメーカー向け課金設計提案

### Free（学習導線を保つ）
- ノート保存: 30件
- AI要約: 月20回
- ノートから問題生成: 月10回
- 自作クイズ: 30問まで
- PDF出力: 不可

### Pro（継続学習を強化）
- ノート保存: 無制限
- AI要約: 月500回（実質無制限に近い）
- 問題生成: 月300回
- 自作クイズ: 1000問
- PDF出力: 可能

> 「理解→復習問題生成→自作問題→演習」の体験価値がコアなので、
> **問題生成系とPDF出力をPro差分に置く**のが自然です。

---

## 最小MVP構成

- `server.js` 単一ファイルに billing + webhook + middleware + ガードAPIを追加
- `subscriptions/payment_events/usage_counters` の3テーブル導入
- Free/Proの2段階固定（`PLAN_FEATURES`）

## 本番運用で追加したい改善案

- Webhook専用ルーター分離（raw body専用）
- DBトランザクションをサービス層へ分離
- `payment_events` に処理結果カラム（success/fail/retry）追加
- サブスク状態の定期同期ジョブ（Stripe API照合）
- 管理画面でプラン別上限値をDB管理化（コード直書き卒業）
- 年額プラン、クーポン、トライアル対応
- 失敗支払いのメール通知と段階的機能制限
