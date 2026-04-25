// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod proto_parser;

use base64::{engine::general_purpose, Engine as _};
use bytes::Buf;
use futures::StreamExt;
use http::{Request as HttpRequest, Uri};
use hyper::{Body, Client};
use hyper::client::HttpConnector;
use hyper_rustls::HttpsConnector;
use lazy_static::lazy_static;
use prost::Message as ProstMessage;
use prost_reflect::{DescriptorPool, DynamicMessage};
use regex::Regex;
use rustls::{Certificate, PrivateKey};
use rustls_pemfile::{certs, pkcs8_private_keys};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::io::BufReader;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tokio::sync::mpsc;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

// ---------------------------------------------------------------------------
// Application state — caches the most-recently compiled descriptor pool so
// gRPC call commands don't recompile protos on every request.
// ---------------------------------------------------------------------------

struct AppState {
    /// (cache_key, pool). The key is the sorted enabled import path strings joined by NUL.
    pool: Mutex<Option<(String, Arc<DescriptorPool>)>>,
}

impl AppState {
    fn new() -> Self {
        Self { pool: Mutex::new(None) }
    }

    fn get_or_compile(
        &self,
        import_paths: &[proto_parser::ImportPath],
    ) -> Result<Arc<DescriptorPool>, String> {
        let key = cache_key(import_paths);
        {
            let guard = self.pool.lock().unwrap_or_else(|p| p.into_inner());
            if let Some((k, p)) = guard.as_ref() {
                if k == &key {
                    return Ok(Arc::clone(p));
                }
            }
        }
        let pool = Arc::new(proto_parser::compile_descriptor_pool(import_paths)?);
        *self.pool.lock().unwrap_or_else(|p| p.into_inner()) = Some((key, Arc::clone(&pool)));
        Ok(pool)
    }

    fn store(&self, import_paths: &[proto_parser::ImportPath], pool: DescriptorPool) {
        let key = cache_key(import_paths);
        *self.pool.lock().unwrap_or_else(|p| p.into_inner()) = Some((key, Arc::new(pool)));
    }
}

fn validate_metadata(meta: &HashMap<String, String>) -> Result<(), String> {
    for (k, v) in meta {
        if k.chars().any(|c| c.is_control()) {
            return Err(format!("Invalid metadata key '{}': contains control characters", k));
        }
        if v.chars().any(|c| c == '\n' || c == '\r' || c == '\0') {
            return Err(format!("Invalid metadata value for '{}': contains newline or null characters", k));
        }
    }
    Ok(())
}

fn cache_key(paths: &[proto_parser::ImportPath]) -> String {
    let mut keys: Vec<&str> = paths.iter().filter(|p| p.enabled).map(|p| p.path.as_str()).collect();
    keys.sort();
    keys.join("\0")
}

// ---------------------------------------------------------------------------
// Active client stream state (client/bidi streaming)
// ---------------------------------------------------------------------------

struct ActiveClientStream {
    sender: mpsc::UnboundedSender<Vec<u8>>,
    input_desc: prost_reflect::MessageDescriptor,
    response_receiver: tokio::sync::oneshot::Receiver<Result<String, String>>,
}

lazy_static! {
    static ref ACTIVE_CLIENT_STREAMS: Mutex<HashMap<String, ActiveClientStream>> =
        Mutex::new(HashMap::new());
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceInfo {
    pub name: String,
    pub methods: Vec<MethodInfo>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MethodInfo {
    pub name: String,
    pub input_type: String,
    pub output_type: String,
    pub is_client_streaming: bool,
    pub is_server_streaming: bool,
    pub method_type: String,
    pub sample_request: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TlsConfig {
    pub enabled: bool,
    pub client_cert_path: Option<String>,
    pub client_key_path: Option<String>,
    pub server_ca_cert_path: Option<String>,
    pub insecure_skip_verify: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AuthConfig {
    #[serde(rename = "type")]
    pub auth_type: String,
    pub token: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub key: Option<String>,
    pub value: Option<String>,
}

// ---------------------------------------------------------------------------
// TLS helpers
// ---------------------------------------------------------------------------

fn load_certificates(path: &str) -> Result<Vec<Certificate>, String> {
    let file = std::fs::File::open(path)
        .map_err(|e| format!("Failed to open certificate '{}': {}", path, e))?;
    let certs = certs(&mut BufReader::new(file))
        .map_err(|e| format!("Failed to parse certificates from '{}': {}", path, e))?;
    Ok(certs.into_iter().map(Certificate).collect())
}

fn load_private_key(path: &str) -> Result<PrivateKey, String> {
    let file = std::fs::File::open(path)
        .map_err(|e| format!("Failed to open private key '{}': {}", path, e))?;
    pkcs8_private_keys(&mut BufReader::new(file))
        .map_err(|e| format!("Failed to parse private key from '{}': {}", path, e))?
        .into_iter()
        .next()
        .map(PrivateKey)
        .ok_or_else(|| format!("No private key found in '{}'", path))
}

struct NoCertificateVerification;

impl rustls::client::ServerCertVerifier for NoCertificateVerification {
    fn verify_server_cert(
        &self,
        _end_entity: &rustls::Certificate,
        _intermediates: &[rustls::Certificate],
        _server_name: &rustls::ServerName,
        _scts: &mut dyn Iterator<Item = &[u8]>,
        _ocsp_response: &[u8],
        _now: std::time::SystemTime,
    ) -> Result<rustls::client::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::ServerCertVerified::assertion())
    }
}

fn build_https_connector(tls: Option<&TlsConfig>) -> Result<HttpsConnector<HttpConnector>, String> {
    if let Some(cfg) = tls.filter(|c| c.enabled) {
        let mut root_store = rustls::RootCertStore::empty();
        if let Some(ca_path) = &cfg.server_ca_cert_path {
            for cert in load_certificates(ca_path)? {
                root_store.add(&cert)
                    .map_err(|e| format!("Failed to add CA certificate: {}", e))?;
            }
        } else {
            root_store.add_trust_anchors(webpki_roots::TLS_SERVER_ROOTS.iter().map(|ta| {
                rustls::OwnedTrustAnchor::from_subject_spki_name_constraints(
                    ta.subject.to_vec(),
                    ta.spki.to_vec(),
                    ta.name_constraints.as_ref().map(|nc| nc.to_vec()),
                )
            }));
        }

        let builder = rustls::ClientConfig::builder()
            .with_safe_defaults()
            .with_root_certificates(root_store);

        let client_config = if let (Some(cert), Some(key)) =
            (&cfg.client_cert_path, &cfg.client_key_path)
        {
            builder
                .with_client_auth_cert(load_certificates(cert)?, load_private_key(key)?)
                .map_err(|e| format!("Failed to configure client auth: {}", e))?
        } else {
            builder.with_no_client_auth()
        };

        let final_config = if cfg.insecure_skip_verify.unwrap_or(false) {
            let mut c = client_config;
            c.dangerous()
                .set_certificate_verifier(Arc::new(NoCertificateVerification));
            c
        } else {
            client_config
        };

        Ok(hyper_rustls::HttpsConnectorBuilder::new()
            .with_tls_config(final_config)
            .https_or_http()
            .enable_http2()
            .build())
    } else {
        Ok(hyper_rustls::HttpsConnectorBuilder::new()
            .with_native_roots()
            .https_or_http()
            .enable_http2()
            .build())
    }
}

// ---------------------------------------------------------------------------
// Auth header helper
// ---------------------------------------------------------------------------

fn apply_auth(mut builder: hyper::http::request::Builder, auth: &AuthConfig) -> hyper::http::request::Builder {
    match auth.auth_type.as_str() {
        "bearer" => {
            if let Some(token) = &auth.token {
                builder = builder.header("authorization", format!("Bearer {}", token));
            }
        }
        "basic" => {
            if let (Some(u), Some(p)) = (&auth.username, &auth.password) {
                let encoded = general_purpose::STANDARD.encode(format!("{}:{}", u, p).as_bytes());
                builder = builder.header("authorization", format!("Basic {}", encoded));
            }
        }
        "apiKey" => {
            if let (Some(k), Some(v)) = (&auth.key, &auth.value) {
                builder = builder.header(k.as_str(), v.as_str());
            }
        }
        _ => {}
    }
    builder
}

// ---------------------------------------------------------------------------
// gRPC framing helpers
// ---------------------------------------------------------------------------

fn grpc_frame(protobuf_bytes: &[u8]) -> Vec<u8> {
    let mut frame = Vec::with_capacity(5 + protobuf_bytes.len());
    frame.push(0u8); // no compression
    frame.extend_from_slice(&(protobuf_bytes.len() as u32).to_be_bytes());
    frame.extend_from_slice(protobuf_bytes);
    frame
}

// ---------------------------------------------------------------------------
// Error formatting
// ---------------------------------------------------------------------------

fn format_connection_error(raw: &str, endpoint: &str, service: &str, method: &str) -> String {
    let (category, hints) = if raw.contains("certificate") || raw.contains("tls") || raw.contains("ssl") {
        ("TLS/Certificate Error", vec![
            "Server may require TLS but TLS is not enabled".to_string(),
            "Try 'Insecure Skip Verify' for self-signed certs in development".to_string(),
            "Check that cert/key file paths are correct".to_string(),
        ])
    } else if raw.contains("connection refused") {
        ("Connection Refused", vec![
            "Server may not be running".to_string(),
            "Check host and port".to_string(),
        ])
    } else if raw.contains("broken pipe") || raw.contains("stream closed") || raw.contains("connection reset") {
        ("Connection Closed", vec![
            "TLS mismatch: server expects TLS but client is not using it (or vice versa)".to_string(),
            "Server closed the connection during handshake".to_string(),
        ])
    } else if raw.contains("timeout") || raw.contains("timed out") {
        ("Connection Timeout", vec![
            "Server took too long to respond".to_string(),
        ])
    } else {
        ("Error", vec![])
    };

    serde_json::json!({
        "status": "error",
        "error": raw,
        "error_category": category,
        "troubleshooting_hints": hints,
        "grpc_status": "UNAVAILABLE",
        "grpc_message": raw,
        "endpoint": endpoint,
        "service": service,
        "method": method,
        "response": null,
    })
    .to_string()
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Parse a single proto file uploaded directly by the user (legacy path).
#[tauri::command]
async fn parse_proto_file(proto_content: String) -> Result<Vec<ServiceInfo>, String> {
    let service_re = Regex::new(r"service\s+(\w+)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}")
        .map_err(|e| e.to_string())?;
    let rpc_re = Regex::new(
        r"rpc\s+(\w+)\s*\(\s*(stream\s+)?([A-Za-z0-9_.]+)\s*\)\s+returns\s*\(\s*(stream\s+)?([A-Za-z0-9_.]+)\s*\)",
    )
    .map_err(|e| e.to_string())?;

    let mut services = Vec::new();
    for svc_cap in service_re.captures_iter(&proto_content) {
        let service_name = svc_cap.get(1).ok_or("no service name")?.as_str().to_string();
        let body = svc_cap.get(2).ok_or("no service body")?.as_str();
        let mut methods = Vec::new();

        for rpc_cap in rpc_re.captures_iter(body) {
            let is_client = rpc_cap.get(2).is_some();
            let is_server = rpc_cap.get(4).is_some();
            methods.push(MethodInfo {
                name: rpc_cap.get(1).ok_or("no method name")?.as_str().to_string(),
                input_type: rpc_cap.get(3).ok_or("no input type")?.as_str().to_string(),
                output_type: rpc_cap.get(5).ok_or("no output type")?.as_str().to_string(),
                is_client_streaming: is_client,
                is_server_streaming: is_server,
                method_type: match (is_client, is_server) {
                    (false, false) => "unary",
                    (false, true) => "server_streaming",
                    (true, false) => "client_streaming",
                    (true, true) => "bidirectional_streaming",
                }
                .to_string(),
                sample_request: None,
            });
        }
        services.push(ServiceInfo { name: service_name, methods });
    }

    if services.is_empty() {
        return Err("No services found in proto file".to_string());
    }

    // Enrich with samples using protox
    if let Ok(pool) = proto_parser::compile_single_file(&proto_content) {
        for svc in &mut services {
            for method in &mut svc.methods {
                if let Some(desc) = pool
                    .all_messages()
                    .find(|m| m.name() == method.input_type || m.full_name() == method.input_type)
                {
                    if let Ok(json) = serde_json::to_string_pretty(&build_sample(&desc)) {
                        method.sample_request = Some(json);
                    }
                }
            }
        }
    }

    Ok(services)
}

/// Build a sample JSON Value for a message descriptor (used by parse_proto_file).
fn build_sample(desc: &prost_reflect::MessageDescriptor) -> Value {
    use prost_reflect::Kind;
    let mut obj = serde_json::Map::new();
    let mut seen_oneofs = std::collections::HashSet::new();
    for field in desc.fields() {
        if let Some(oneof) = field.containing_oneof() {
            if !seen_oneofs.insert(oneof.name().to_string()) {
                continue;
            }
        }
        let val = if field.is_list() {
            Value::Array(vec![])
        } else if field.is_map() {
            Value::Object(serde_json::Map::new())
        } else {
            match field.kind() {
                Kind::String => Value::String(String::new()),
                Kind::Bool => Value::Bool(false),
                Kind::Bytes => Value::String(String::new()),
                Kind::Double | Kind::Float => {
                    Value::Number(serde_json::Number::from_f64(0.0).unwrap())
                }
                Kind::Int32 | Kind::Int64 | Kind::Uint32 | Kind::Uint64
                | Kind::Sint32 | Kind::Sint64 | Kind::Fixed32 | Kind::Fixed64
                | Kind::Sfixed32 | Kind::Sfixed64 => Value::Number(serde_json::Number::from(0)),
                Kind::Enum(e) => e.values().next()
                    .map(|v| Value::String(v.name().to_string()))
                    .unwrap_or(Value::Number(0.into())),
                Kind::Message(m) => build_sample(&m),
            }
        };
        obj.insert(field.json_name().to_string(), val);
    }
    Value::Object(obj)
}

/// Parse proto files from workspace import paths. Caches the descriptor pool so
/// subsequent gRPC calls don't recompile.
#[tauri::command]
fn parse_proto_files(
    state: tauri::State<'_, AppState>,
    import_paths: Vec<proto_parser::ImportPath>,
) -> proto_parser::ProtoParseResult {
    let (result, pool) = proto_parser::parse_proto_files(import_paths.clone());
    if let Some(p) = pool {
        state.store(&import_paths, p);
    }
    result
}

#[tauri::command]
async fn call_grpc_method(
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
    tab_id: String,
    service: String,
    method: String,
    request_data: String,
    endpoint: String,
    proto_content: Option<String>,
    import_paths: Option<Vec<proto_parser::ImportPath>>,
    metadata: Option<HashMap<String, String>>,
    auth: Option<AuthConfig>,
    tls_config: Option<TlsConfig>,
) -> Result<String, String> {
    let request_json: Value = serde_json::from_str(&request_data)
        .map_err(|e| format!("Failed to parse request JSON: {}", e))?;

    let pool = resolve_pool(&state, proto_content.as_deref(), import_paths.as_deref())?;

    let clean_endpoint = endpoint
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .to_string();

    let service_desc = pool
        .services()
        .find(|s| s.name() == service)
        .ok_or_else(|| format!("Service '{}' not found in proto", service))?;

    let pkg = service_desc.parent_file().package_name().to_string();
    let grpc_path = if pkg.is_empty() {
        format!("/{}/{}", service, method)
    } else {
        format!("/{}.{}/{}", pkg, service, method)
    };

    let method_desc = service_desc
        .methods()
        .find(|m| m.name() == method)
        .ok_or_else(|| format!("Method '{}' not found in service '{}'", method, service))?;

    let input_desc = method_desc.input();
    let output_desc = method_desc.output();

    let request_msg =
        DynamicMessage::deserialize(input_desc.clone(), &mut serde_json::Deserializer::from_str(&request_data))
            .map_err(|e| format!("Failed to deserialize request JSON to protobuf: {}", e))?;

    let request_body = grpc_frame(&request_msg.encode_to_vec());

    let use_tls = tls_config.as_ref().map(|c| c.enabled).unwrap_or(false);
    let uri: Uri = format!(
        "{}://{}{}",
        if use_tls { "https" } else { "http" },
        clean_endpoint,
        grpc_path
    )
    .parse()
    .map_err(|e| format!("Invalid URI: {}", e))?;

    let mut req_builder = HttpRequest::builder()
        .method("POST")
        .uri(uri)
        .header("content-type", "application/grpc")
        .header("te", "trailers");

    if let Some(ref a) = auth {
        req_builder = apply_auth(req_builder, a);
    }
    if let Some(ref meta) = metadata {
        validate_metadata(meta)?;
        for (k, v) in meta {
            req_builder = req_builder.header(k.as_str(), v.as_str());
        }
    }

    let req = req_builder
        .body(Body::from(request_body))
        .map_err(|e| format!("Failed to build request: {}", e))?;

    let connector = build_https_connector(tls_config.as_ref())?;
    let client = Client::builder().http2_only(true).build::<_, Body>(connector);

    let response = client.request(req).await.map_err(|e| {
        format_connection_error(&e.to_string(), &clean_endpoint, &service, &method)
    })?;

    let grpc_status_raw = response
        .headers()
        .get("grpc-status")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let grpc_message = response
        .headers()
        .get("grpc-message")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let mut response_metadata = serde_json::Map::new();
    for (name, value) in response.headers() {
        if let Ok(val_str) = value.to_str() {
            response_metadata.insert(name.as_str().to_string(), Value::String(val_str.to_string()));
        }
    }

    let is_server_streaming = method_desc.is_server_streaming();
    let mut response_data = None;
    let mut response_messages: Vec<Value> = Vec::new();
    let mut decode_success = false;

    if is_server_streaming {
        let mut body_stream = response.into_body();
        let mut buf = bytes::BytesMut::new();
        let mut idx = 0;

        while let Some(chunk) = body_stream.next().await {
            buf.extend_from_slice(&chunk.map_err(|e| format!("Stream read error: {}", e))?);
            loop {
                if buf.len() < 5 {
                    break;
                }
                let msg_len = u32::from_be_bytes([buf[1], buf[2], buf[3], buf[4]]) as usize;
                if buf.len() < 5 + msg_len {
                    break;
                }
                buf.advance(5);
                let msg_bytes = buf.split_to(msg_len);
                let msg = DynamicMessage::decode(output_desc.clone(), msg_bytes.as_ref())
                    .map_err(|e| format!("Failed to decode streaming response frame: {}", e))?;
                let json = serde_json::to_value(msg)
                    .map_err(|e| format!("Failed to serialize response: {}", e))?;

                let _ = app.emit("grpc-stream-message", serde_json::json!({
                    "tabId": tab_id,
                    "index": idx,
                    "data": json.clone(),
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                }));
                response_messages.push(json);
                idx += 1;
                decode_success = true;
            }
        }
        response_data = Some(Value::Array(response_messages.clone()));
    } else {
        let body_bytes = hyper::body::to_bytes(response.into_body())
            .await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        if body_bytes.len() >= 5 {
            let msg_len = u32::from_be_bytes([
                body_bytes[1], body_bytes[2], body_bytes[3], body_bytes[4],
            ]) as usize;
            if body_bytes.len() >= 5 + msg_len {
                let msg = DynamicMessage::decode(output_desc.clone(), &body_bytes[5..5 + msg_len])
                    .map_err(|e| format!("Failed to decode response: {}", e))?;
                let json = serde_json::to_value(msg)
                    .map_err(|e| format!("Failed to serialize response: {}", e))?;
                response_data = Some(json);
                decode_success = true;
            }
        }
    }

    let grpc_status = grpc_status_raw.unwrap_or_else(|| {
        if decode_success { "0".to_string() } else { "unknown".to_string() }
    });

    let response_size = response_data
        .as_ref()
        .and_then(|d| serde_json::to_string(d).ok())
        .map(|s| s.len())
        .unwrap_or(0);

    let result = serde_json::json!({
        "status": if grpc_status == "0" { "success" } else { "error" },
        "grpc_status": grpc_status,
        "grpc_message": grpc_message,
        "endpoint": clean_endpoint,
        "service": service,
        "method": method,
        "is_streaming": is_server_streaming,
        "message_count": if is_server_streaming { response_messages.len() } else { 1 },
        "request": request_json,
        "response": response_data,
        "response_metadata": Value::Object(response_metadata),
        "response_size": response_size,
        "timestamp": chrono::Utc::now().to_rfc3339(),
    });

    Ok(serde_json::to_string_pretty(&result).unwrap())
}

#[tauri::command]
async fn start_client_stream(
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
    tab_id: String,
    service: String,
    method: String,
    endpoint: String,
    proto_content: Option<String>,
    import_paths: Option<Vec<proto_parser::ImportPath>>,
    metadata: Option<HashMap<String, String>>,
    auth: Option<AuthConfig>,
    tls_config: Option<TlsConfig>,
) -> Result<String, String> {
    let pool = resolve_pool(&state, proto_content.as_deref(), import_paths.as_deref())?;

    let service_desc = pool
        .services()
        .find(|s| s.name() == service)
        .ok_or_else(|| format!("Service '{}' not found", service))?;

    let method_desc = service_desc
        .methods()
        .find(|m| m.name() == method)
        .ok_or_else(|| format!("Method '{}' not found", method))?;

    let input_desc = method_desc.input();
    let output_desc = method_desc.output();
    let is_bidi = method_desc.is_client_streaming() && method_desc.is_server_streaming();

    let pkg = service_desc.parent_file().package_name().to_string();
    let grpc_path = if pkg.is_empty() {
        format!("/{}/{}", service, method)
    } else {
        format!("/{}.{}/{}", pkg, service, method)
    };

    let clean_endpoint = endpoint
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .to_string();

    let use_tls = tls_config.as_ref().map(|c| c.enabled).unwrap_or(false);
    let uri: Uri = format!(
        "{}://{}{}",
        if use_tls { "https" } else { "http" },
        clean_endpoint,
        grpc_path
    )
    .parse()
    .map_err(|e| format!("Invalid URI: {}", e))?;

    let (message_tx, mut message_rx) = mpsc::unbounded_channel::<Vec<u8>>();
    let (response_tx, response_rx) = tokio::sync::oneshot::channel();

    let metadata_c = metadata.clone();
    let auth_c = auth.clone();
    let tls_c = tls_config.clone();
    let output_desc_c = output_desc.clone();
    let tab_id_c = tab_id.clone();
    let app_c = app.clone();

    tokio::spawn(async move {
        let result: Result<String, String> = async {
            let mut req_builder = HttpRequest::builder()
                .method("POST")
                .uri(uri)
                .header("content-type", "application/grpc")
                .header("te", "trailers");

            if let Some(ref a) = auth_c {
                req_builder = apply_auth(req_builder, a);
            }
            if let Some(ref meta) = metadata_c {
                validate_metadata(meta)?;
                for (k, v) in meta {
                    req_builder = req_builder.header(k.as_str(), v.as_str());
                }
            }

            let (mut body_sender, body_receiver) = Body::channel();
            let req = req_builder.body(body_receiver).map_err(|e| e.to_string())?;

            let connector = build_https_connector(tls_c.as_ref())?;
            let client = Client::builder().http2_only(true).build::<_, Body>(connector);

            let response_future = client.request(req);

            let sender_task = tokio::spawn(async move {
                while let Some(msg_bytes) = message_rx.recv().await {
                    if body_sender.send_data(bytes::Bytes::from(msg_bytes)).await.is_err() {
                        break;
                    }
                }
            });

            let response = response_future.await.map_err(|e| e.to_string())?;

            if is_bidi {
                let mut body_stream = response.into_body();
                let mut buf = bytes::BytesMut::new();
                let mut idx = 0;

                while let Some(chunk) = body_stream.next().await {
                    if let Ok(c) = chunk {
                        buf.extend_from_slice(&c);
                        loop {
                            if buf.len() < 5 { break; }
                            let msg_len = u32::from_be_bytes([buf[1], buf[2], buf[3], buf[4]]) as usize;
                            if buf.len() < 5 + msg_len { break; }
                            buf.advance(5);
                            let msg_bytes = buf.split_to(msg_len);
                            if let Ok(msg) = DynamicMessage::decode(output_desc_c.clone(), msg_bytes.as_ref()) {
                                if let Ok(json) = serde_json::to_value(msg) {
                                    let _ = app_c.emit("grpc-stream-message", serde_json::json!({
                                        "tabId": tab_id_c,
                                        "index": idx,
                                        "data": json,
                                        "timestamp": chrono::Utc::now().to_rfc3339(),
                                    }));
                                    idx += 1;
                                }
                            }
                        }
                    }
                }
                let _ = sender_task.await;
                serde_json::to_string(&serde_json::json!({
                    "grpc_status": "0",
                    "grpc_message": "OK",
                    "message": "Bidirectional stream completed"
                }))
                .map_err(|e| e.to_string())
            } else {
                let _ = sender_task.await;
                let body_bytes = hyper::body::to_bytes(response.into_body())
                    .await
                    .map_err(|e| e.to_string())?;

                if body_bytes.len() < 5 {
                    return Err("Response too short".to_string());
                }
                let msg_len = u32::from_be_bytes([
                    body_bytes[1], body_bytes[2], body_bytes[3], body_bytes[4],
                ]) as usize;
                if body_bytes.len() < 5 + msg_len {
                    return Err("Incomplete response".to_string());
                }
                let msg = DynamicMessage::decode(output_desc_c, &body_bytes[5..5 + msg_len])
                    .map_err(|e| e.to_string())?;
                let json = serde_json::to_value(msg).map_err(|e| e.to_string())?;
                serde_json::to_string(&serde_json::json!({
                    "response": json,
                    "grpc_status": "0",
                    "grpc_message": "OK"
                }))
                .map_err(|e| e.to_string())
            }
        }
        .await;

        let _ = response_tx.send(result);
    });

    ACTIVE_CLIENT_STREAMS.lock().unwrap_or_else(|p| p.into_inner()).insert(
        tab_id.clone(),
        ActiveClientStream {
            sender: message_tx,
            input_desc,
            response_receiver: response_rx,
        },
    );

    Ok("Stream opened".to_string())
}

#[tauri::command]
async fn send_stream_message(
    tab_id: String,
    message_id: String,
    body: String,
) -> Result<String, String> {
    let (sender, input_desc) = {
        let streams = ACTIVE_CLIENT_STREAMS.lock().unwrap_or_else(|p| p.into_inner());
        let s = streams
            .get(&tab_id)
            .ok_or("Stream not found. Start the stream first.")?;
        (s.sender.clone(), s.input_desc.clone())
    };

    let msg = DynamicMessage::deserialize(input_desc, &mut serde_json::Deserializer::from_str(&body))
        .map_err(|e| format!("Failed to deserialize message: {}", e))?;

    sender
        .send(grpc_frame(&msg.encode_to_vec()))
        .map_err(|_| "Failed to send message, stream may be closed".to_string())?;

    Ok(format!("Message {} sent", message_id))
}

#[tauri::command]
async fn finish_streaming(tab_id: String) -> Result<String, String> {
    let response_receiver = {
        let mut streams = ACTIVE_CLIENT_STREAMS.lock().unwrap_or_else(|p| p.into_inner());
        let s = streams
            .remove(&tab_id)
            .ok_or("Stream not found. Start the stream first.")?;
        drop(s.sender); // closing the sender signals end-of-stream to the server
        s.response_receiver
    };

    response_receiver
        .await
        .map_err(|_| "Failed to receive response from stream task".to_string())?
}

#[tauri::command]
fn open_response_in_temp_file(file_name: String, contents: String) -> Result<String, String> {
    let sanitized = Regex::new(r#"[^A-Za-z0-9._-]"#)
        .map_err(|e| e.to_string())?
        .replace_all(&file_name, "_")
        .into_owned();

    let temp_path = std::env::temp_dir().join(sanitized);
    std::fs::write(&temp_path, contents)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    let mut cmd = if cfg!(target_os = "macos") {
        let mut c = Command::new("open");
        c.arg(&temp_path);
        c
    } else if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.args(["/C", "start", "", &temp_path.to_string_lossy()]);
        c
    } else {
        let mut c = Command::new("xdg-open");
        c.arg(&temp_path);
        c
    };

    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    cmd.spawn().map_err(|e| format!("Failed to open file: {}", e))?;
    Ok(temp_path.to_string_lossy().to_string())
}

#[tauri::command]
fn save_response_to_file(path: String, contents: String) -> Result<(), String> {
    let dest: PathBuf = PathBuf::from(&path);

    // Resolve symlinks and ".." so the check can't be fooled by path traversal tricks.
    // Canonicalize requires the parent directory to exist (the file itself may not yet).
    let resolved = if dest.exists() {
        dest.canonicalize()
    } else {
        dest.parent()
            .ok_or("Invalid path")?
            .canonicalize()
    }
    .map_err(|e| format!("Cannot resolve path: {}", e))?;

    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    if !resolved.starts_with(&home) {
        return Err("Save path must be within your home directory".to_string());
    }

    std::fs::write(&dest, contents)
        .map_err(|e| format!("Failed to save file: {}", e))
}

// ---------------------------------------------------------------------------
// Pool resolution helper (shared by call_grpc_method and start_client_stream)
// ---------------------------------------------------------------------------

fn resolve_pool(
    state: &tauri::State<'_, AppState>,
    proto_content: Option<&str>,
    import_paths: Option<&[proto_parser::ImportPath]>,
) -> Result<Arc<DescriptorPool>, String> {
    if let Some(paths) = import_paths {
        state.get_or_compile(paths)
    } else if let Some(content) = proto_content {
        proto_parser::compile_single_file(content).map(Arc::new)
    } else {
        Err("Either proto_content or import_paths must be provided".to_string())
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

fn main() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            parse_proto_file,
            parse_proto_files,
            call_grpc_method,
            start_client_stream,
            send_stream_message,
            finish_streaming,
            open_response_in_temp_file,
            save_response_to_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
