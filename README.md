# illo

セルフホスト可能なオープンソースのイラスト投稿プラットフォーム。

---

## 概要

illo は、クリエイターが自分のデータを完全にコントロールすることを目指して作った分散型のイラスト投稿プラットフォームです。

### 設計

- クリエイター・ファースト: クローラー対策、段階的な公開範囲
- 連合型連携: ActivityPubによるネットワーク
- 分散型連携: BlueskyOAuthによる認証
- プライバシー重視: EXIF削除、署名付きURL、コンテンツフィルター

---

## 主な機能

### 作品管理

- イラスト・マンガ作品の投稿
- 複数画像対応
- タグ・コレクション機能（作品整理 / リスト化）
- レーティング（ALL_AGES / NSFW / R-18 / R-18G）

### ソーシャル機能

- フォロー / フォロワー
- いいね・ブックマーク・リアクション
- コメント（ネスト返信可）
- DM・通知
- ミュート機能（ユーザー / キーワード / タグ）

### ActivityPub連合

- WebFinger / HTTP 署名
- Update / Delete Activity 対応

### セキュリティ・プライバシー

- JWT認証、2FA / TOTP
- 画像暗号化（AES-256-GCM）
- 署名付きURL
- EXIF削除
- 年齢認証・コンテンツフィルター
- クローラーブロック設定（動的 robots.txt）

---

## 技術スタック

- Frontend: Nuxt 3, Vue 3, TypeScript, Tailwind CSS v3
- Backend: NestJS, TypeScript, Prisma ORM
- Database: PostgreSQL 16
- Cache/Queue: Redis 7, BullMQ
- Storage: MinIO (S3互換)
- Federation: ActivityPub

---

## セットアップ

### 必要要件

- Node.js 20.x 以上
- pnpm 9.x 以上
- Docker / Docker Compose

### 開発環境

```bash
# リポジトリをクローン
git clone https://github.com/barineco/illo.git
cd illo

# 依存関係をインストール
pnpm install

# 環境変数を設定
cp dev/.env.local-dev.example dev/.env.local-dev

# 開発環境を起動（インフラ + フロントエンド + バックエンド）
./dev/local-dev.sh start

# アクセス
# フロントエンド: http://localhost:11103
# バックエンドAPI: http://localhost:11104
# MinIO Console: http://localhost:9001
# MailHog: http://localhost:8025

# 停止
./dev/local-dev.sh stop
```

詳細は `./dev/local-dev.sh help` を参照してください。

### 本番環境

```bash
# 初回セットアップ（秘密鍵自動生成）
./install.sh install

# 環境設定を編集
# .env を編集（BASE_URL, POSTGRES_PASSWORD, SMTP設定など）

# 設定検証
./install.sh check-env

# サービス起動
./install.sh start
```

詳細は `./install.sh help` を参照してください。

---

## プロジェクト構造

```
illo/
├── apps/
│   ├── frontend/     # Nuxt 3 アプリケーション
│   └── backend/      # NestJS アプリケーション
├── packages/
│   └── shared/       # 共通型定義
├── dev/              # 開発環境
│   ├── local-dev.sh  # ローカル開発環境管理
│   └── fed-dev.sh    # 連合テスト環境管理
├── .env.example      # 本番環境設定テンプレート
├── docker-compose.yml # 本番Docker構成
└── install.sh        # 本番環境インストーラー
```

---

## 開発状況

現在ベータ版です。本番環境での使用は推奨しません。


### 開発ガイドライン

- コミットメッセージは Conventional Commits 形式
- コードスタイルは ESLint + Prettier に従う
