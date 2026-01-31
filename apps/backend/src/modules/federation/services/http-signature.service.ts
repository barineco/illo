import { Injectable } from '@nestjs/common'
import * as crypto from 'crypto'

export interface SignatureHeaders {
  signature: string
  date: string
  digest?: string
}

export interface VerifySignatureParams {
  signature: string
  headers: Record<string, string>
  publicKeyPem: string
  method: string
  path: string
}

/**
 * HTTP Signature Service
 *
 * ActivityPubの連合通信で使用するHTTP署名の生成と検証を行うサービス
 * RFC 9421 (HTTP Signatures) に基づいて実装
 *
 * RSA-SHA256署名アルゴリズムを使用（Mastodon互換）
 */
@Injectable()
export class HttpSignatureService {
  /**
   * リクエストに署名を追加
   *
   * @param params.keyId - 公開鍵のURL（例: https://example.com/users/alice#main-key）
   * @param params.privateKeyPem - PEM形式のRSA秘密鍵
   * @param params.method - HTTPメソッド（GET, POST等）
   * @param params.path - リクエストパス
   * @param params.headers - 署名対象のヘッダー
   * @param params.body - リクエストボディ（POST等の場合）
   * @returns 署名ヘッダー
   */
  async signRequest(params: {
    keyId: string
    privateKeyPem: string
    method: string
    path: string
    headers: Record<string, string>
    body?: any
  }): Promise<SignatureHeaders> {
    const { keyId, privateKeyPem, method, path, headers, body } = params

    // Dateヘッダーを生成（RFC 2616形式）
    const date = new Date().toUTCString()

    // Digestヘッダーを生成（ボディがある場合）
    let digest: string | undefined
    if (body) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
      const hash = crypto.createHash('sha256').update(bodyStr).digest('base64')
      digest = `SHA-256=${hash}`
    }

    // 署名文字列を構築
    const signatureString = this.buildSignatureString({
      method,
      path,
      headers: {
        ...headers,
        date,
        ...(digest ? { digest } : {}),
      },
    })

    // RSA-SHA256で署名
    const signer = crypto.createSign('RSA-SHA256')
    signer.update(signatureString)
    const signature = signer.sign(privateKeyPem, 'base64')

    // Signatureヘッダーを構築
    const signedHeaders = digest
      ? '(request-target) host date digest'
      : '(request-target) host date'

    const signatureHeader = [
      `keyId="${keyId}"`,
      `algorithm="rsa-sha256"`,
      `headers="${signedHeaders}"`,
      `signature="${signature}"`,
    ].join(',')

    return {
      signature: signatureHeader,
      date,
      ...(digest ? { digest } : {}),
    }
  }

  /**
   * 署名を検証
   *
   * @param params - 検証パラメータ
   * @returns 検証結果（true: 有効, false: 無効）
   */
  async verifySignature(params: VerifySignatureParams): Promise<boolean> {
    try {
      const { signature, headers, publicKeyPem, method, path } = params

      // Signatureヘッダーをパース
      const sigParams = this.parseSignatureHeader(signature)
      if (!sigParams) {
        return false
      }

      // 署名文字列を再構築
      const signatureString = this.buildSignatureString({
        method,
        path,
        headers,
        signedHeaders: sigParams.headers.split(' '),
      })

      // RSA-SHA256で検証
      const verifier = crypto.createVerify('RSA-SHA256')
      verifier.update(signatureString)
      return verifier.verify(publicKeyPem, sigParams.signature, 'base64')
    } catch (error) {
      console.error('Signature verification failed:', error)
      return false
    }
  }

  /**
   * RSA鍵ペアを生成
   *
   * @returns PEM形式の秘密鍵と公開鍵
   */
  async generateKeyPair(): Promise<{
    privateKey: string
    publicKey: string
  }> {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair(
        'rsa',
        {
          modulusLength: 2048,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem',
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
          },
        },
        (err, publicKey, privateKey) => {
          if (err) {
            reject(err)
          } else {
            resolve({ publicKey, privateKey })
          }
        },
      )
    })
  }

  /**
   * 署名文字列を構築
   *
   * @private
   */
  private buildSignatureString(params: {
    method: string
    path: string
    headers: Record<string, string>
    signedHeaders?: string[]
  }): string {
    const { method, path, headers } = params
    const signedHeaders =
      params.signedHeaders || ['(request-target)', 'host', 'date', 'digest']

    const lines: string[] = []

    for (const header of signedHeaders) {
      if (header === '(request-target)') {
        lines.push(`(request-target): ${method.toLowerCase()} ${path}`)
      } else {
        // Case-insensitive header lookup
        const headerKey = Object.keys(headers).find(
          (k) => k.toLowerCase() === header.toLowerCase(),
        )
        if (headerKey && headers[headerKey]) {
          lines.push(`${header}: ${headers[headerKey]}`)
        }
      }
    }

    return lines.join('\n')
  }

  /**
   * Signatureヘッダーをパース
   *
   * @private
   */
  private parseSignatureHeader(header: string): {
    keyId: string
    algorithm: string
    headers: string
    signature: string
  } | null {
    try {
      const parts: Record<string, string> = {}
      const regex = /(\w+)="([^"]+)"/g
      let match: RegExpExecArray | null

      while ((match = regex.exec(header)) !== null) {
        parts[match[1]] = match[2]
      }

      if (!parts.keyId || !parts.signature || !parts.headers) {
        return null
      }

      return {
        keyId: parts.keyId,
        algorithm: parts.algorithm || 'rsa-sha256',
        headers: parts.headers,
        signature: parts.signature,
      }
    } catch {
      return null
    }
  }
}
