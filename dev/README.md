# 開発環境

このディレクトリには、illo の開発とテストに使用するスクリプトと設定ファイルが含まれています。

## ファイル構成

```
dev/
├── local-dev.sh                  # ローカル開発環境管理スクリプト
├── fed-dev.sh                    # 連合テスト環境管理スクリプト
│
├── .env.local-dev                # ローカル開発用環境変数（非追跡）
├── .env.local-dev.example        # ローカル開発用テンプレート
├── docker-compose.local-dev.yml  # ローカル開発用Docker構成
│
├── .env.fed-dev-1                # 連合テストInstance 1 環境変数（非追跡）
├── .env.fed-dev-1.example        # 連合テストInstance 1 テンプレート
├── docker-compose.fed-dev-1.yml  # 連合テストInstance 1 Docker構成
│
├── .env.fed-dev-2                # 連合テストInstance 2 環境変数（非追跡）
├── .env.fed-dev-2.example        # 連合テストInstance 2 テンプレート
└── docker-compose.fed-dev-2.yml  # 連合テストInstance 2 Docker構成
```

## ローカル開発環境 (local-dev)

### 概要

ハイブリッド構成で動作します。

- インフラ: Docker Compose（PostgreSQL, Redis, MinIO, MailHog）
- バックエンド: ネイティブプロセス（pnpm dev、ポート11104）
- フロントエンド: ネイティブプロセス（pnpm dev、ポート11103）

### セットアップ

```bash
# 環境変数を設定
cp dev/.env.local-dev.example dev/.env.local-dev

# 環境変数を編集（必要に応じて）
# BASE_URL, JWT_SECRET, ENCRYPTION_KEY などを設定
```

### 使用方法

```bash
# 全サービス起動
./dev/local-dev.sh start

# 全サービス停止
./dev/local-dev.sh stop

# 全サービス再起動
./dev/local-dev.sh restart

# ログ表示
./dev/local-dev.sh logs [service]
# service: frontend, backend, postgres, redis, minio, mailhog

# ステータス確認
./dev/local-dev.sh status

# 孤立プロセスのクリーンアップ (開発ポートがすでに使用されている時など)
./dev/local-dev.sh cleanup

# データベースリセット（全データ削除）
./dev/local-dev.sh reset

# ヘルプ表示
./dev/local-dev.sh help
```

### アクセス情報

- フロントエンド: http://localhost:11103
- バックエンドAPI: http://localhost:11104/api
- PostgreSQL: localhost:5432（illustboard_user/illustboard_pass）
- Redis: localhost:6379
- MinIO Console: http://localhost:9001（minioadmin/minioadmin）
- MailHog Web UI: http://localhost:8025

## 連合テスト環境 (feddev1/2)

### 概要

ActivityPub連合機能をテストするための2インスタンス環境です。

- Instance 1: http://localhost:13000（全サービスDocker、+10000ポートオフセット）
- Instance 2: http://localhost:23000（全サービスDocker、+20000ポートオフセット）

### セットアップ

```bash
# OrbStack環境の場合、環境変数ファイルなしで即座に起動可能
./dev/fed-dev.sh start
```

カスタム設定が必要な場合のみ、環境変数ファイルを作成してください：

```bash
# ドメイン名やシークレットキーをカスタマイズする
touch dev/.env.fed-dev-1
touch dev/.env.fed-dev-2

# 編集例（全て省略可能、デフォルト値が使用されます）
# BASE_URL=https://your-custom-domain.com
# JWT_SECRET=your_custom_secret_key
# ENCRYPTION_KEY=your_custom_encryption_key
```

### 注意事項

**連合テストには適切なドメイン名が必須です**

両インスタンスが `localhost` を使用すると、ActivityPub連合が正しく動作しません。以下のいずれかの方法で、各インスタンスに異なるドメイン名を割り当てる必要があります。

#### 推奨: OrbStack のローカルドメイン（macOS）

OrbStackを使用している場合、デフォルト設定で自動的に動作します。

- Instance 1: `https://nginx-feddev.illustboard-feddev-1.orb.local`（デフォルト）
- Instance 2: `https://nginx-feddev.illustboard-feddev-2.orb.local`（デフォルト）

環境変数ファイルは不要です。docker-compose.ymlにデフォルト値が設定されています。

#### 代替案: Cloudflare Tunnel

OrbStackを使用していない場合、Cloudflare Tunnelで外部に公開することで連合テストが可能です。

1. Cloudflare Tunnelをセットアップ
2. 各インスタンスに異なる公開URLを割り当て
3. 環境変数ファイルで公開URLを設定

### 使用方法

```bash
# 両インスタンス起動
./dev/fed-dev.sh start

# 両インスタンス停止
./dev/fed-dev.sh stop

# 再起動
./dev/fed-dev.sh restart [1|2] [service] [--force-recreate]
# 例: ./dev/fed-dev.sh restart 1 backend

# Dockerイメージ再ビルド
./dev/fed-dev.sh rebuild [1|2] [service] [--no-cache]
# 例: ./dev/fed-dev.sh rebuild backend
# 例: ./dev/fed-dev.sh rebuild 1 frontend --no-cache

# ログ表示
./dev/fed-dev.sh logs [1|2] [service]

# ステータス確認
./dev/fed-dev.sh status

# データベースリセット
./dev/fed-dev.sh reset

# ヘルプ表示
./dev/fed-dev.sh help
```

### アクセス情報

Instance 1:
- アプリケーション: http://localhost:13000
- PostgreSQL: localhost:15432
- Redis: localhost:16379
- MinIO Console: http://localhost:19001（minioadmin_fed/minioadmin_fed）
- MailHog: http://localhost:18025

Instance 2:
- アプリケーション: http://localhost:23000
- PostgreSQL: localhost:25432
- Redis: localhost:26379
- MinIO Console: http://localhost:29001（minioadmin_fed/minioadmin_fed）
- MailHog: http://localhost:28025

### 連合テストワークフロー

1. 両インスタンスを起動: `./dev/fed-dev.sh start`
2. Instance 1にアクセス: http://localhost:13000
3. Instance 2にアクセス: http://localhost:23000
4. 各インスタンスでユーザー登録
5. フォロー、作品投稿などの連合機能をテスト
6. 終了時に停止: `./dev/fed-dev.sh stop`

---

## トラブルシューティング

### feddev Docker イメージの再ビルド

コード変更がDockerコンテナに反映されない場合が割と多い。

```bash
# キャッシュなしで再ビルド
./dev/fed-dev.sh rebuild --no-cache

# コンテナを強制再作成
./dev/fed-dev.sh restart --force-recreate
```
