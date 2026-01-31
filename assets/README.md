# Assets

このディレクトリには、プロジェクトで使用されるロゴやアセットファイルが含まれています。

## ディレクトリ構成

サービスロゴのソースファイルとエクスポート済みファイル。

- illo.af - Affinity Designer/Photo/Publisherで編集可能なロゴのベクターファイル（マスターファイル）
- illo-logo.svg - SVG形式のロゴファイル（Faviconとして使用）
- illo-card.png - OGカード用のロゴ画像 (1600x900px)
- illo-logo-grad.svg - グラデーション付きロゴバリエーション

## 反映について

フロントエンドアプリケーションで使用されるのは `assets/*` ではなく、`apps/frontend/public/assets/logo/*` にコピーされたファイルです。

ロゴファイルを更新した場合:

1. `assets/` でロゴファイルを編集・エクスポート
2. 必要なファイルを `apps/frontend/public/assets/logo/` にコピー
3. 変更をコミット

`apps/frontend/public/` 配下のファイルのみが本番環境で配信されます。

## ロゴファイルの編集

ロゴを編集する場合は、`illo.af` をAffinityで開いて編集してください。

編集後、必要な形式（SVG、PNGなど）でエクスポートし、`apps/frontend/public/assets/logo/` に配置してください。
