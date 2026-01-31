-- CreateTable: Sessions for tracking user login sessions
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" VARCHAR(500) NOT NULL,
    "deviceName" VARCHAR(100),
    "deviceType" VARCHAR(50),
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "location" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Login attempts for security monitoring
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" VARCHAR(255) NOT NULL,
    "ipAddress" VARCHAR(45) NOT NULL,
    "userAgent" VARCHAR(500),
    "success" BOOLEAN NOT NULL,
    "failureReason" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshToken_key" ON "sessions"("refreshToken");
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");
CREATE INDEX "sessions_refreshToken_idx" ON "sessions"("refreshToken");
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

CREATE INDEX "login_attempts_email_idx" ON "login_attempts"("email");
CREATE INDEX "login_attempts_ipAddress_idx" ON "login_attempts"("ipAddress");
CREATE INDEX "login_attempts_createdAt_idx" ON "login_attempts"("createdAt");
CREATE INDEX "login_attempts_success_idx" ON "login_attempts"("success");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
