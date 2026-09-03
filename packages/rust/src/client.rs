use crate::Error;
use serde_json::Value;
use std::io::Read;

const DEFAULT_BASE_URL: &str = "https://app.postshiba.com";

#[derive(Clone)]
pub struct Client {
    api_key: String,
    base_url: String,
    team_id: Option<String>,
}

impl Client {
    pub fn new(api_key: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            base_url: DEFAULT_BASE_URL.to_owned(),
            team_id: None,
        }
    }

    pub fn base_url(mut self, base_url: impl Into<String>) -> Self {
        let url = base_url.into();
        self.base_url = url.trim_end_matches('/').to_owned();
        self
    }

    pub fn team_id(mut self, team_id: impl ToString) -> Self {
        self.team_id = Some(team_id.to_string());
        self
    }

    pub fn users(&self) -> Users<'_> {
        Users { client: self }
    }

    pub fn emails(&self) -> Emails<'_> {
        Emails { client: self }
    }

    pub fn clusters(&self) -> Clusters<'_> {
        Clusters { client: self }
    }

    pub fn sending_domains(&self) -> SendingDomains<'_> {
        SendingDomains { client: self }
    }

    pub fn tenants(&self) -> Tenants<'_> {
        Tenants { client: self }
    }

    pub fn inboxes(&self) -> Inboxes<'_> {
        Inboxes { client: self }
    }

    pub fn messages(&self) -> Messages<'_> {
        Messages { client: self }
    }

    pub fn events(&self) -> Events<'_> {
        Events { client: self }
    }

    pub fn smtp_credentials(&self) -> SmtpCredentials<'_> {
        SmtpCredentials { client: self }
    }

    pub fn webhooks(&self) -> Webhooks<'_> {
        Webhooks { client: self }
    }

    pub fn suppressions(&self) -> Suppressions<'_> {
        Suppressions { client: self }
    }

    pub fn firewall(&self) -> Firewall<'_> {
        Firewall { client: self }
    }

    fn team(&self) -> Result<&str, Error> {
        self.team_id.as_deref().ok_or_else(Error::missing_team_id)
    }

    fn request(
        &self,
        method: &str,
        path: &str,
        body: Option<&Value>,
        extra: &[(&str, &str)],
    ) -> Result<Value, Error> {
        let bytes = self.request_bytes(method, path, body, extra)?;
        if bytes.is_empty() {
            return Ok(Value::Object(Default::default()));
        }
        serde_json::from_slice(&bytes).map_err(|err| Error::message(err.to_string()))
    }

    fn request_bytes(
        &self,
        method: &str,
        path: &str,
        body: Option<&Value>,
        extra: &[(&str, &str)],
    ) -> Result<Vec<u8>, Error> {
        let url = format!("{}{}", self.base_url, path);
        let mut req = ureq::request(method, &url)
            .set("Authorization", &format!("Bearer {}", self.api_key))
            .set("Accept", "application/json");
        for (name, value) in extra {
            req = req.set(name, value);
        }
        let result = match body {
            Some(payload) => req.send_json(payload),
            None => req.call(),
        };
        match result {
            Ok(response) => read_body(response),
            Err(ureq::Error::Status(_, response)) => {
                let bytes = read_body(response)?;
                let text = String::from_utf8_lossy(&bytes);
                Err(Error::from_body(&text))
            }
            Err(err) => Err(Error::message(err.to_string())),
        }
    }
}

fn read_body(response: ureq::Response) -> Result<Vec<u8>, Error> {
    let mut bytes = Vec::new();
    response
        .into_reader()
        .read_to_end(&mut bytes)
        .map_err(|err| Error::message(err.to_string()))?;
    Ok(bytes)
}

pub struct Users<'a> {
    client: &'a Client,
}

impl Users<'_> {
    pub fn me(&self) -> Result<Value, Error> {
        self.client.request("GET", "/api/v1/users/me", None, &[])
    }
}

pub struct Emails<'a> {
    client: &'a Client,
}

impl Emails<'_> {
    pub fn send(&self, body: &Value) -> Result<Value, Error> {
        self.client
            .request("POST", "/api/v1/emails", Some(body), &[])
    }

    pub fn send_on_cluster(
        &self,
        cluster_id: impl ToString,
        body: &Value,
        idempotency_key: Option<&str>,
        sandbox: bool,
    ) -> Result<Value, Error> {
        let team_id = self.client.team()?;
        let path = format!(
            "/api/v1/teams/{}/clusters/{}/sends",
            team_id,
            cluster_id.to_string()
        );
        let mut payload = body.clone();
        if sandbox {
            payload
                .as_object_mut()
                .ok_or_else(|| Error::message("send body must be a JSON object"))?
                .insert("sandbox".into(), Value::Bool(true));
        }
        if let Some(key) = idempotency_key {
            self.client
                .request("POST", &path, Some(&payload), &[("Idempotency-Key", key)])
        } else {
            self.client.request("POST", &path, Some(&payload), &[])
        }
    }
}

pub struct Clusters<'a> {
    client: &'a Client,
}

impl Clusters<'_> {
    pub fn list(&self) -> Result<Value, Error> {
        let path = format!("/api/v1/teams/{}/clusters", self.client.team()?);
        self.client.request("GET", &path, None, &[])
    }

    pub fn get(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/clusters/{}", id.to_string());
        self.client.request("GET", &path, None, &[])
    }

    pub fn create(&self, body: &Value) -> Result<Value, Error> {
        let path = format!("/api/v1/teams/{}/clusters", self.client.team()?);
        self.client.request("POST", &path, Some(body), &[])
    }

    pub fn update(&self, id: impl ToString, body: &Value) -> Result<Value, Error> {
        let path = format!("/api/v1/clusters/{}", id.to_string());
        self.client.request("PATCH", &path, Some(body), &[])
    }

    pub fn suspend(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/clusters/{}/suspend", id.to_string());
        self.client.request("POST", &path, None, &[])
    }

    pub fn resume(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/clusters/{}/resume", id.to_string());
        self.client.request("POST", &path, None, &[])
    }

    pub fn delete(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/clusters/{}", id.to_string());
        self.client.request("DELETE", &path, None, &[])
    }
}

pub struct SendingDomains<'a> {
    client: &'a Client,
}

impl SendingDomains<'_> {
    pub fn list(&self) -> Result<Value, Error> {
        let path = format!("/api/v1/teams/{}/sending_domains", self.client.team()?);
        self.client.request("GET", &path, None, &[])
    }

    pub fn get(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/sending_domains/{}", id.to_string());
        self.client.request("GET", &path, None, &[])
    }

    pub fn create(&self, body: &Value) -> Result<Value, Error> {
        let path = format!("/api/v1/teams/{}/sending_domains", self.client.team()?);
        self.client.request("POST", &path, Some(body), &[])
    }

    pub fn verify(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/sending_domains/{}/verify", id.to_string());
        self.client.request("POST", &path, None, &[])
    }

    pub fn suspend(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/sending_domains/{}/suspend", id.to_string());
        self.client.request("POST", &path, None, &[])
    }

    pub fn resume(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/sending_domains/{}/resume", id.to_string());
        self.client.request("POST", &path, None, &[])
    }

    pub fn make_primary(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/sending_domains/{}/make_primary", id.to_string());
        self.client.request("POST", &path, None, &[])
    }

    pub fn delete(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/sending_domains/{}", id.to_string());
        self.client.request("DELETE", &path, None, &[])
    }
}

pub struct Tenants<'a> {
    client: &'a Client,
}

impl Tenants<'_> {
    pub fn list(&self) -> Result<Value, Error> {
        let path = format!("/api/v1/teams/{}/tenants", self.client.team()?);
        self.client.request("GET", &path, None, &[])
    }

    pub fn get(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/tenants/{}", id.to_string());
        self.client.request("GET", &path, None, &[])
    }

    pub fn create(&self, body: &Value) -> Result<Value, Error> {
        let path = format!("/api/v1/teams/{}/tenants", self.client.team()?);
        self.client.request("POST", &path, Some(body), &[])
    }

    pub fn delete(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/tenants/{}", id.to_string());
        self.client.request("DELETE", &path, None, &[])
    }
}

pub struct Inboxes<'a> {
    client: &'a Client,
}

impl Inboxes<'_> {
    pub fn list(&self) -> Result<Value, Error> {
        let path = format!("/api/v1/teams/{}/inboxes", self.client.team()?);
        self.client.request("GET", &path, None, &[])
    }

    pub fn get(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/inboxes/{}", id.to_string());
        self.client.request("GET", &path, None, &[])
    }

    pub fn create(&self, body: &Value) -> Result<Value, Error> {
        let path = format!("/api/v1/teams/{}/inboxes", self.client.team()?);
        self.client.request("POST", &path, Some(body), &[])
    }

    pub fn verify(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/inboxes/{}/verify", id.to_string());
        self.client.request("POST", &path, None, &[])
    }

    pub fn delete(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/inboxes/{}", id.to_string());
        self.client.request("DELETE", &path, None, &[])
    }
}

pub struct Messages<'a> {
    client: &'a Client,
}

impl Messages<'_> {
    pub fn list(&self, inbox_id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/inboxes/{}/inbound_messages", inbox_id.to_string());
        self.client.request("GET", &path, None, &[])
    }

    pub fn get(&self, inbox_id: impl ToString, id: impl ToString) -> Result<Value, Error> {
        let path = format!(
            "/api/v1/inboxes/{}/inbound_messages/{}",
            inbox_id.to_string(),
            id.to_string()
        );
        self.client.request("GET", &path, None, &[])
    }

    pub fn download_attachment(
        &self,
        inbox_id: impl ToString,
        id: impl ToString,
        index: impl ToString,
    ) -> Result<Vec<u8>, Error> {
        let path = format!(
            "/api/v1/inboxes/{}/inbound_messages/{}/attachments/{}",
            inbox_id.to_string(),
            id.to_string(),
            index.to_string()
        );
        self.client.request_bytes("GET", &path, None, &[])
    }
}

pub struct Events<'a> {
    client: &'a Client,
}

impl Events<'_> {
    pub fn list(&self, cluster_id: impl ToString) -> Result<Value, Error> {
        let path = format!(
            "/api/v1/teams/{}/clusters/{}/message_events",
            self.client.team()?,
            cluster_id.to_string()
        );
        self.client.request("GET", &path, None, &[])
    }

    pub fn get(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/message_events/{}", id.to_string());
        self.client.request("GET", &path, None, &[])
    }
}

pub struct SmtpCredentials<'a> {
    client: &'a Client,
}

impl SmtpCredentials<'_> {
    pub fn create(&self, cluster_id: impl ToString, body: &Value) -> Result<Value, Error> {
        let path = format!(
            "/api/v1/teams/{}/clusters/{}/smtp_credentials",
            self.client.team()?,
            cluster_id.to_string()
        );
        self.client.request("POST", &path, Some(body), &[])
    }

    pub fn delete(&self, cluster_id: impl ToString, id: impl ToString) -> Result<Value, Error> {
        let path = format!(
            "/api/v1/teams/{}/clusters/{}/smtp_credentials/{}",
            self.client.team()?,
            cluster_id.to_string(),
            id.to_string()
        );
        self.client.request("DELETE", &path, None, &[])
    }
}

pub struct Webhooks<'a> {
    client: &'a Client,
}

impl Webhooks<'_> {
    pub fn list(&self) -> Result<Value, Error> {
        let path = format!("/api/v1/teams/{}/webhook_endpoints", self.client.team()?);
        self.client.request("GET", &path, None, &[])
    }

    pub fn get(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/webhook_endpoints/{}", id.to_string());
        self.client.request("GET", &path, None, &[])
    }

    pub fn create(&self, body: &Value) -> Result<Value, Error> {
        let path = format!("/api/v1/teams/{}/webhook_endpoints", self.client.team()?);
        self.client.request("POST", &path, Some(body), &[])
    }

    pub fn update(&self, id: impl ToString, body: &Value) -> Result<Value, Error> {
        let path = format!("/api/v1/webhook_endpoints/{}", id.to_string());
        self.client.request("PATCH", &path, Some(body), &[])
    }

    pub fn delete(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/webhook_endpoints/{}", id.to_string());
        self.client.request("DELETE", &path, None, &[])
    }
}

pub struct Suppressions<'a> {
    client: &'a Client,
}

impl Suppressions<'_> {
    pub fn list(&self) -> Result<Value, Error> {
        let path = format!("/api/v1/teams/{}/suppressions", self.client.team()?);
        self.client.request("GET", &path, None, &[])
    }

    pub fn create(&self, body: &Value) -> Result<Value, Error> {
        let path = format!("/api/v1/teams/{}/suppressions", self.client.team()?);
        self.client.request("POST", &path, Some(body), &[])
    }

    pub fn delete(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/suppressions/{}", id.to_string());
        self.client.request("DELETE", &path, None, &[])
    }
}

pub struct Firewall<'a> {
    client: &'a Client,
}

impl Firewall<'_> {
    pub fn get(&self) -> Result<Value, Error> {
        let path = format!("/api/v1/teams/{}/firewall", self.client.team()?);
        self.client.request("GET", &path, None, &[])
    }

    pub fn update(&self, body: &Value) -> Result<Value, Error> {
        let path = format!("/api/v1/teams/{}/firewall", self.client.team()?);
        self.client.request("PATCH", &path, Some(body), &[])
    }

    pub fn add_entry(&self, body: &Value) -> Result<Value, Error> {
        let path = format!("/api/v1/teams/{}/firewall_entries", self.client.team()?);
        self.client.request("POST", &path, Some(body), &[])
    }

    pub fn delete_entry(&self, id: impl ToString) -> Result<Value, Error> {
        let path = format!("/api/v1/firewall_entries/{}", id.to_string());
        self.client.request("DELETE", &path, None, &[])
    }
}
