# Privacy Policy

Last updated: January 29, 2026

## Introduction

illo (hereinafter "the Service") respects user privacy and handles personal information appropriately. This Policy explains what information the Service collects, how it is used, and how it is protected.

---

## 1. Information We Collect

### Account Information

We collect the following information when you create an account:

| Information | Required/Optional | Purpose |
|-------------|-------------------|---------|
| Username | Required | Account identification, profile URL |
| Email address | Required | Account verification, password reset, important notifications |
| Password | Required | Stored securely hashed |
| Display name | Optional | Profile display |
| Bio | Optional | Profile display |
| Avatar/Cover image | Optional | Profile display |
| Date of birth | Optional | Age verification (for viewing adult content) |

### Posted Content

- Works (image files)
- Work titles, descriptions, tags
- Comments
- License settings

### Automatically Collected Information

#### For Security and Service Protection

| Information | Purpose | Retention Period |
|-------------|---------|------------------|
| IP address | Rate limiting, fraud prevention | Limited (Note 1) |
| User agent | Session management, fraud detection | Until session ends |
| Access time | Rate limit calculation | Individual data deleted after statistical aggregation |

**Note 1**: IP addresses are temporarily recorded for fraud detection, but are not stored long-term. They are only retained for a certain period if rate limit violations occur.

#### Session Information

- Login state maintenance
- Device information (device type, browser)
- Last access time

Sessions typically expire after 1 hour. If "Remember me" is selected, they are valid for 30 days.

### Cookie Usage

The Service uses cookies for the following purposes:

| Cookie | Purpose | Duration |
|--------|---------|----------|
| Auth token | Login state maintenance | 1 hour to 30 days |
| Language setting | Remember display language | 1 year |
| Color mode | Remember dark/light mode | 1 year |
| Consent status | Record of terms agreement | 1 year |

---

## 2. How We Use Information

We use collected information only for the following purposes:

### Service Provision

- Account creation and management
- Work posting, display, and distribution
- User communication features

### Security and Protection

- Detection and prevention of unauthorized access
- Protection from scraping and bots
- Prevention of account abuse
- Rate limit enforcement

### Service Improvement

- Analysis of aggregated statistics (in non-personally identifiable form)
- Technical problem diagnosis

---

## 3. Information Sharing

### Principle: No Third-Party Disclosure

We do not sell or provide user personal information to advertisers or data brokers.

### Exceptional Sharing

Information may be shared only in the following cases:

#### Federation (ActivityPub)

When using federation features, the following information is shared with other illo instances:

- Public profile information
- Works set to public
- Follow relationships, likes, comments

#### External Service Integration

| Service | Information Shared | Purpose |
|---------|-------------------|---------|
| Bluesky (OAuth) | DID, handle | Account authentication |
| Patreon (optional) | User ID, membership info | Supporter benefits application |

These service integrations are optional, and data sharing stops when integration is disconnected.

#### Legal Requests

Information may be disclosed only when required by law or in response to valid legal process.

---

## 4. Data Retention and Deletion

### Retention Periods

| Data Type | Retention Period |
|-----------|------------------|
| Account information | Until account deletion |
| Posted content | Until deletion action |
| Sessions | 1 hour to 30 days (depending on settings) |
| Rate limit logs | Deleted after statistical aggregation |
| Audit logs (admin actions) | Long-term retention for security reasons |

### Account Deletion

When you delete your account:

- Profile information is deleted
- Posted works are deleted
- Deletion requests are sent to other instances for federated information, but complete deletion cannot be guaranteed

### Data Export

We plan to provide a feature to export your data in the future.

---

## 5. Security

### Technical Measures

- Passwords are securely hashed with bcrypt
- TLS encryption for communications
- Encrypted storage of OAuth tokens
- Two-factor authentication (TOTP) support
- Passkey/WebAuthn support

### Access Restrictions

Access to personal information is limited to administrators necessary for service operation.

---

## 6. Your Rights

### Access to Information

You can view and edit your account information from the settings page.

### Right to Deletion

- You can delete individual works and comments at any time
- You can also delete your entire account

### Withdrawal of Consent

External service integrations can be disconnected at any time from the settings page.

---

## 7. Children's Privacy

The Service is not intended for persons under 13 years of age. If we become aware that someone under 13 has created an account, that account will be deleted.

---

## 8. Policy Changes

This Policy may be updated as needed. We will notify you within the Service of significant changes.

---

## 9. Contact

For questions or concerns about privacy, please contact the instance administrator.

---

## Appendix: About Source Code

The source code of the Service is publicly available under the illo Platform License v1.0.0. If you wish to review privacy-related implementations, please see the repository.
