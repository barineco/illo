/**
 * User-Agent検出シグナル
 * HeadlessChrome, Puppeteer等のパターンを検出
 */
export interface UserAgentSignal {
  isHeadless: boolean; // HeadlessChrome, Puppeteer等
  isEmpty: boolean; // 空のUA
  isSuspicious: boolean; // PhantomJS, Selenium等
  knownBotPattern: boolean; // 既知のスクレイパー
  score: number; // 0-30
  details: string[];
}

/**
 * Client Hints検証シグナル
 * Sec-CH-UA ヘッダーの有無と整合性を検証
 */
export interface ClientHintsSignal {
  hasSecChUa: boolean; // Sec-CH-UAヘッダー存在
  hasSecChUaMobile: boolean; // モバイル判定
  hasSecChUaPlatform: boolean; // プラットフォーム情報
  consistency: boolean; // UAとの整合性
  score: number; // 0-25
  details: string[];
}

/**
 * HTTPヘッダー整合性シグナル
 * Accept-Language/Encoding の異常を検出
 */
export interface HeaderConsistencySignal {
  hasAcceptLanguage: boolean;
  hasAcceptEncoding: boolean;
  acceptEncodingValid: boolean; // gzip, deflate等の標準値
  connectionHeaderNormal: boolean;
  score: number; // 0-25
  details: string[];
}

/**
 * レートリミット連携シグナル
 * 既存の検出スコアと連携
 */
export interface RateLimitSignal {
  currentTier: string; // RateLimitTier
  recentViolations: number;
  patternScore: number;
  score: number; // 0-20
}

/**
 * ユーザーインタラクションシグナル
 * マウス/タッチ/キーボードイベントの有無を検証
 */
export interface UserInteractionSignal {
  hasToken: boolean; // インタラクショントークンの存在
  tokenValid: boolean; // トークンの検証結果
  tokenAge: number; // トークンの年齢（秒）
  tokenExpired: boolean; // トークンの有効期限切れ
  hasRealInteraction: boolean; // 実際のユーザーイベント（マウス、タッチ、キーボード）の有無
  score: number; // 0-30
  details: string[];
}

/**
 * 複合ヘッドレスブラウザスコア
 * 5つのシグナルを統合した最終判定
 */
export interface HeadlessBotScore {
  totalScore: number; // 0-100
  signals: {
    userAgent: UserAgentSignal;
    clientHints: ClientHintsSignal;
    headerConsistency: HeaderConsistencySignal;
    rateLimit: RateLimitSignal;
    userInteraction: UserInteractionSignal;
  };
  verdict: 'normal' | 'suspicious' | 'likely_bot' | 'definite_bot';
  confidence: number; // 0-1
}

/**
 * ヘッドレス検出アクション
 */
export enum HeadlessDetectionAction {
  ALLOW = 'allow', // 通常処理
  LOG_ONLY = 'log_only', // ログ記録のみ
  DEGRADE_QUALITY = 'degrade', // サムネイルへダウングレード
  RATE_LIMIT = 'rate_limit', // 追加のレートリミット適用
  BLOCK = 'block', // 403 Forbidden
}

/**
 * ヘッドレス検出設定
 */
export interface HeadlessDetectionConfig {
  // 機能フラグ
  enabled: boolean;
  measurementMode: boolean; // true: ログのみ, false: 実際にアクションを実行

  // スコア閾値
  suspiciousThreshold: number; // 31
  likelyBotThreshold: number; // 51
  definiteBotThreshold: number; // 76

  // 各シグナルの重み
  userAgentWeight: number;
  clientHintsWeight: number;
  headerWeight: number;
  rateLimitWeight: number;
  userInteractionWeight: number;

  // 対応設定
  suspiciousAction: HeadlessDetectionAction;
  likelyBotAction: HeadlessDetectionAction;
  definiteBotAction: HeadlessDetectionAction;

  // ホワイトリスト
  allowedUserAgents: string[];
  allowedIpRanges: string[];
}

/**
 * ヘッドレス検出統計
 */
export interface HeadlessDetectionStats {
  totalChecks: number;
  byVerdict: {
    normal: number;
    suspicious: number;
    likely_bot: number;
    definite_bot: number;
  };
  topDetectedUserAgents: { userAgent: string; count: number }[];
  last24Hours: {
    checks: number;
    blocked: number;
    degraded: number;
  };
}
