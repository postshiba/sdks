---
name: postshiba-create-cluster
description: Creates a shared-IP PostShiba cluster and waits for sending readiness while enforcing approval and payment gates. Applies when a user asks to create or provision a PostShiba sending cluster.
---

# Create a cluster

Use the `postshiba` hub skill for the MCP connection, token scope, and shared safety rules.

1. Call `whoami` to confirm the token. Determine the team name from trusted context or ask the user. Do not infer it from the `whoami` email.
2. Call `list_clusters` before creating anything.
   - If an existing cluster satisfies the request, return it instead of creating a duplicate.
   - A pending team can have one cluster. A second cluster requires approval.
3. Call `create_cluster` for a shared-IP cluster whose name matches the team name.
4. Handle creation gates without workarounds.
   - For `403 kyc_required`, stop. The team already has a cluster and needs approval for another. KYC is not an MCP action.
   - For `payment_required`, stop.
5. Poll `get_cluster` with the returned cluster id until `sending_ready` is true. Do not attempt any send while it is false.
6. Report the cluster id and current status.
   - Cluster creation issues a default SMTP user but hides its password. Use the `postshiba-create-credentials` workflow when the user needs a password.
   - Until the team is approved, sends may target only team member emails and live inbox addresses. Other recipients return `403 kyc_required`.
