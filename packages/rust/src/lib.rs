mod client;
mod error;
pub mod webhooks;

pub use client::{
    Client, Clusters, Emails, Events, Firewall, Inboxes, Messages, SendingDomains, SmtpCredentials,
    Suppressions, Tenants, Users, Webhooks,
};
pub use error::Error;
