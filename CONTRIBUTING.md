# Contributing to illo

illoへの貢献を検討いただきありがとうございます。

このドキュメントでは、プロジェクトへの貢献方法について説明します。

## 貢献の方法

### Issue報告

バグを見つけた場合や機能リクエストがある場合、GitHubのIssueを作成してください。

バグ報告の場合:

- 再現手順を具体的に記載
- 期待される動作と実際の動作
- 環境情報（OS、ブラウザ、各バージョンなど）
- 可能であればスクリーンショット等

機能リクエストの場合:

- 提案する機能の説明
- その機能が必要な理由やユースケース
- 可能であれば実装のアイデア

### Pull Request

1. フォークとクローン
   ```bash
   git clone https://github.com/YOUR_USERNAME/illo.git
   cd illo
   ```

2. ブランチ作成
   ```bash
   git checkout -b feature/your-feature-name
   # または
   git checkout -b fix/your-bug-fix
   ```

3. 開発環境セットアップ

   詳細は [docs/dev/SETUP.md](docs/dev/SETUP.md) を参照してください。

   ```bash
   # 依存関係インストール
   pnpm install

   # 開発環境起動
   ./dev/local-dev.sh start
   ```

4. 変更をコミット
   ```bash
   git add .
   git commit -m "feat: add your feature"
   ```

5. Push & PR作成
   ```bash
   git push origin feature/your-feature-name
   ```

   GitHubでPull Requestを作成してください。

## コミットメッセージ規約

[Conventional Commits](https://www.conventionalcommits.org/) 形式を採用しています。

### フォーマット

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Type

- feat: 新機能
- fix: バグ修正
- docs: ドキュメントのみの変更
- style: コードの意味に影響しない変更（空白、フォーマット等）
- refactor: バグ修正でも新機能でもないコード変更
- perf: パフォーマンス改善
- test: テストの追加・修正
- chore: ビルドプロセスや補助ツールの変更

### 例

```
feat(auth): add passkey authentication support

- Implement WebAuthn registration flow
- Add passkey login option to login page
- Store authenticator credentials in database

Closes #33550336
```

```
fix(frontend): resolve image upload progress not updating

The progress bar was not updating due to missing event listener.
```

## コードスタイル

### Linting & Formatting

ESLint と Prettier を使用しています。

```bash
# リント実行
pnpm lint

# フォーマット
pnpm format
```

### TypeScript

- 厳格な型チェックを有効にしています
- 可能な範囲で適切な型定義を追加してください（any型の使用は許容されます）

### バックエンド（NestJS）

- サービスクラスにビジネスロジックを集約
- コントローラーは薄く保つ
- DTOを使用して入力を検証
- 適切なエラーハンドリングを実装

### フロントエンド（Nuxt/Vue）

- Composition API を使用
- Composables で再利用可能なロジックを抽出
- TypeScript で型安全性を確保

## ディレクトリ構造

```
illo/
├── apps/
│   ├── backend/       # NestJS バックエンド
│   └── frontend/      # Nuxt 3 フロントエンド
├── packages/
│   └── shared/        # 共有型定義
├── docs/              # ドキュメント
└── dev/               # 開発環境スクリプト
```

## テスト

現在テストカバレッジは低い状態ですが、新しい機能にはテストの追加を推奨します。

```bash
# バックエンドテスト
cd apps/backend
pnpm test

# フロントエンドテスト
cd apps/frontend
pnpm test
```

## ライセンス

このプロジェクトは illo Platform License v1.0.0（ソースアベイラブルライセンス）の下で公開されています。貢献いただいたコードも同じライセンスの下で公開されます。詳細は [LICENSE](LICENSE) を参照してください。

## フォークポリシー

illoはソースアベイラブルソフトウェアであり、ライセンス条件の範囲内でフォークやインスタンスの運営を歓迎します。ただし、以下の点にご注意ください。

### 歓迎されること

- 自分のインスタンスを運営すること
- UIのカスタマイズ（色、ロゴ、レイアウトなど）
- 新機能の追加
- バグ修正や改善のPull Request
- 他のilloインスタンスとの連合
- クリエイター保護機能の強化

### 禁止されていること（ライセンス違反）

以下の行為はライセンスに違反します：

1. クリエイター保護機能の削除・弱体化
   - 署名付きURLアクセス制御の削除
   - レート制限機能の削除
   - スクレイピング防止機能の削除
   - AI学習オプトアウト機能の削除
   - 年齢制限機能の削除

2. 利用規約要件の不遵守
   - 無断スクレイピング・クローリング禁止の撤廃
   - 無断転載禁止の撤廃
   - 無断AI学習利用禁止の撤廃
   - クリエイターの著作権保有保証の撤廃

3. 帰属表示の削除
   - "Powered by illo" またはそれに相当する表示の削除

4. 競合サービスとしての運用
   - illoまたはライセンサーが提供するサービスと競合する形での利用

### インスタンス運営者へのお願い

インスタンスを運営する場合は、以下をお願いします：

- ライセンスの利用規約要件と同等以上の保護を提供する利用規約を設定してください
- アーティストの権利を尊重し、クリエイター保護機能を維持してください
- ソースコードを改変した場合は公開してください（ライセンスのソース開示義務）
- セキュリティアップデートを適時適用してください

## 質問・サポート

- GitHub Issues で質問を投稿してください
- セキュリティに関する問題は、公開Issueではなく直接連絡してください

---

改めて、illoへの貢献を検討いただきありがとうございます。
