# Kafka topics

Prefix: `orarepot.`

| Topic | Producer | Consumers |
|---|---|---|
| `orarepot.user.created` | identity | reporting |
| `orarepot.member.invited` | members | reporting |
| `orarepot.member.joined` | members | reporting |
| `orarepot.merchant.created` | merchant | billing, reporting |
| `orarepot.template.updated` | templates | reporting |
| `orarepot.wallet.reserved` | billing | reporting |
| `orarepot.wallet.captured` | billing | reporting |
| `orarepot.wallet.released` | billing | reporting |
| `orarepot.otp.sent` | otp | developer, reporting |
| `orarepot.otp.failed` | otp | developer, reporting |

Payload is the outbox `jsonb` row. Relay publishes after the domain transaction commits.
