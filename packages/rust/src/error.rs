use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Error {
    pub error: Option<String>,
    pub field: Option<String>,
    pub message: String,
}

impl Error {
    pub(crate) fn message(message: impl Into<String>) -> Self {
        Self {
            error: None,
            field: None,
            message: message.into(),
        }
    }

    pub(crate) fn missing_team_id() -> Self {
        Self {
            error: Some("missing_team_id".into()),
            field: Some("team_id".into()),
            message: "team_id is required".into(),
        }
    }

    pub(crate) fn from_body(body: &str) -> Self {
        match serde_json::from_str::<serde_json::Value>(body) {
            Ok(value) => Self {
                error: string_field(&value, "error"),
                field: string_field(&value, "field"),
                message: string_field(&value, "message").unwrap_or_else(|| body.to_owned()),
            },
            Err(_) => Self::message(body),
        }
    }
}

fn string_field(value: &serde_json::Value, key: &str) -> Option<String> {
    value.get(key)?.as_str().map(str::to_owned)
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for Error {}
