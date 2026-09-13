mod client;
mod error;
pub mod webhooks;

pub use client::{
    Client, Clusters, Emails, Events, Firewall, Inboxes, Messages, Network, SendingDomains,
    SmtpCredentials, Suppressions, Templates, Tenants, Users, Webhooks,
};
pub use error::Error;
