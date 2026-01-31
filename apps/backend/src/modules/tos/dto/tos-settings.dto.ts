export class TosSettingsResponse {
  tosVersion: number
  tosUpdatedAt: Date | null
}

export class TosStatusResponse {
  needsAcceptance: boolean
  currentVersion: number
  acceptedVersion: number | null
  acceptedAt: Date | null
}

export class AcceptTosDto {
  version: number
}
