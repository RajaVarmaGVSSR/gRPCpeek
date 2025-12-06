// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod proto_parser;

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use http::{Uri, Request as HttpRequest};
use hyper::{Client, Body};
use std::process::Command;
use tempfile::NamedTempFile;
use std::io::Write;
use prost_reflect::{DescriptorPool, DynamicMessage};
use prost::Message;
use std::sync::Arc;
use rustls::{Certificate, PrivateKey};
use rustls_pemfile::{certs, pkcs8_private_keys};
use std::io::BufReader;
use base64::{Engine as _, engine::general_purpose};
use tauri::Emitter;
use bytes::BytesMut;
use std::sync::Mutex;
use std::collections::HashMap;
use tokio::sync::mpsc;

// Active client stream connection with channel for sending messages
struct ActiveClientStream {
    sender: mpsc::UnboundedSender<Vec<u8>>,
    descriptor_pool: Arc<DescriptorPool>,
    input_desc: prost_reflect::MessageDescriptor,
    output_desc: prost_reflect::MessageDescriptor,
    response_receiver: tokio::sync::oneshot::Receiver<Result<String, String>>,
}

lazy_static::lazy_static! {
    static ref ACTIVE_CLIENT_STREAMS: Mutex<HashMap<String, ActiveClientStream>> = Mutex::new(HashMap::new());
}

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
    pub auth_type: String,  // 'none' | 'bearer' | 'basic' | 'apiKey'
    pub token: Option<String>,  // For bearer
    pub username: Option<String>,  // For basic
    pub password: Option<String>,  // For basic
    pub key: Option<String>,  // For API key header name
    pub value: Option<String>,  // For API key value
}

fn load_certificates_from_file(path: &str) -> Result<Vec<Certificate>, String> {
    let cert_file = std::fs::File::open(path)
        .map_err(|e| format!("Failed to open certificate file '{}': {}", path, e))?;
    let mut reader = BufReader::new(cert_file);
    
    let certs_result = certs(&mut reader)
        .map_err(|e| format!("Failed to parse certificates from '{}': {}", path, e))?;
    
    Ok(certs_result.into_iter().map(Certificate).collect())
}

fn load_private_key_from_file(path: &str) -> Result<PrivateKey, String> {
    let key_file = std::fs::File::open(path)
        .map_err(|e| format!("Failed to open private key file '{}': {}", path, e))?;
    let mut reader = BufReader::new(key_file);
    
    let keys = pkcs8_private_keys(&mut reader)
        .map_err(|e| format!("Failed to parse private key from '{}': {}", path, e))?;
    
    keys.into_iter()
        .next()
        .map(PrivateKey)
        .ok_or_else(|| format!("No private key found in '{}'", path))
}

// Custom certificate verifier that skips all verification (INSECURE - for dev only!)
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
        // Skip all verification - INSECURE!
        Ok(rustls::client::ServerCertVerified::assertion())
    }
}

#[tauri::command]
async fn parse_proto_file(proto_content: String) -> Result<Vec<ServiceInfo>, String> {
    let mut services = Vec::new();

    let service_re = Regex::new(r"service\s+(\w+)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}")
        .map_err(|e| format!("Failed to compile service regex: {}", e))?;

    let rpc_re = Regex::new(
        r"rpc\s+(\w+)\s*\(\s*(stream\s+)?([A-Za-z0-9_.]+)\s*\)\s+returns\s*\(\s*(stream\s+)?([A-Za-z0-9_.]+)\s*\)"
    )
    .map_err(|e| format!("Failed to compile rpc regex: {}", e))?;

    for service_cap in service_re.captures_iter(&proto_content) {
        let service_name = service_cap
            .get(1)
            .ok_or("Failed to extract service name")?
            .as_str()
            .to_string();

        let service_body = service_cap
            .get(2)
            .ok_or("Failed to extract service body")?
            .as_str();

        let mut methods = Vec::new();

        for rpc_cap in rpc_re.captures_iter(service_body) {
            let method_name = rpc_cap
                .get(1)
                .ok_or("Failed to extract method name")?
                .as_str()
                .to_string();

            let is_client_streaming = rpc_cap.get(2).is_some();

            let input_type = rpc_cap
                .get(3)
                .ok_or("Failed to extract input type")?
                .as_str()
                .to_string();

            let is_server_streaming = rpc_cap.get(4).is_some();

            let output_type = rpc_cap
                .get(5)
                .ok_or("Failed to extract output type")?
                .as_str()
                .to_string();

            let method_type = match (is_client_streaming, is_server_streaming) {
                (false, false) => "unary",
                (false, true) => "server_streaming",
                (true, false) => "client_streaming",
                (true, true) => "bidirectional_streaming",
            }
            .to_string();

            methods.push(MethodInfo {
                name: method_name,
                input_type,
                output_type,
                is_client_streaming,
                is_server_streaming,
                method_type,
            });
        }

        services.push(ServiceInfo { name: service_name, methods });
    }

    if services.is_empty() {
        return Err("No services found in proto file".to_string());
    }

    Ok(services)
}

fn compile_proto_to_descriptors(proto_content: &str) -> Result<DescriptorPool, String> {
    // Create temporary proto file
    let mut proto_file = NamedTempFile::with_suffix(".proto")
        .map_err(|e| format!("Failed to create temp proto file: {}", e))?;

    proto_file.write_all(proto_content.as_bytes())
        .map_err(|e| format!("Failed to write proto content: {}", e))?;

    // Create temporary output file for FileDescriptorSet
    let descriptor_file = NamedTempFile::with_suffix(".pb")
        .map_err(|e| format!("Failed to create temp descriptor file: {}", e))?;

    let descriptor_path = descriptor_file.path().to_string_lossy();

    let proto_path = proto_file.path().parent()
        .ok_or("Failed to get proto file directory")?
        .to_string_lossy();

    // Run protoc to generate FileDescriptorSet
    let output = Command::new("protoc")
        .args(&[
            "--descriptor_set_out",
            &descriptor_path,
            "--proto_path",
            &proto_path,
            "--include_imports",
            proto_file.path().file_name()
                .ok_or("Failed to get proto filename")?
                .to_string_lossy()
                .as_ref(),
        ])
        .output()
        .map_err(|e| format!("Failed to run protoc: {}. Make sure protoc is installed and in PATH.", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("protoc failed: {}", stderr));
    }

    // Read the generated FileDescriptorSet
    let descriptor_bytes = std::fs::read(&*descriptor_path)
        .map_err(|e| format!("Failed to read descriptor file: {}", e))?;

    // Decode into DescriptorPool
    let pool = DescriptorPool::decode(descriptor_bytes.as_slice())
        .map_err(|e| format!("Failed to decode FileDescriptorSet: {}", e))?;

    Ok(pool)
}

// Helper function to format error responses as JSON for consistent frontend parsing
fn format_error_response(
    raw_error: &str,
    endpoint: &str,
    service: &str,
    method: &str,
    error_category: &str,
    troubleshooting_hints: Vec<String>,
) -> String {
    let result = serde_json::json!({
        "status": "error",
        "error": raw_error,  // Preserve the exact error message
        "error_category": error_category,
        "troubleshooting_hints": troubleshooting_hints,
        "grpc_status": "UNAVAILABLE",
        "grpc_message": raw_error,
        "endpoint": endpoint,
        "service": service,
        "method": method,
        "response": null,
    });
    serde_json::to_string(&result).unwrap_or_else(|_| {
        format!(r#"{{"status":"error","error":"{}"}}"#, raw_error)
    })
}

// Helper function to read multiple gRPC frames from a response body
fn read_grpc_frames(body_bytes: &[u8]) -> Result<Vec<Vec<u8>>, String> {
    let mut frames = Vec::new();
    let mut offset = 0;
    
    while offset + 5 <= body_bytes.len() {
        let _compression_flag = body_bytes[offset];
        let message_len = u32::from_be_bytes([
            body_bytes[offset + 1],
            body_bytes[offset + 2],
            body_bytes[offset + 3],
            body_bytes[offset + 4],
        ]) as usize;
        
        offset += 5;
        
        if offset + message_len > body_bytes.len() {
            return Err(format!(
                "Invalid frame: expected {} bytes but only {} remaining",
                message_len,
                body_bytes.len() - offset
            ));
        }
        
        frames.push(body_bytes[offset..offset + message_len].to_vec());
        offset += message_len;
    }
    
    Ok(frames)
}

#[tauri::command]
async fn call_grpc_method(
    app: tauri::AppHandle,
    tab_id: String,
    service: String,
    method: String,
    request_data: String,
    endpoint: String,
    proto_content: Option<String>,
    import_paths: Option<Vec<proto_parser::ImportPath>>,
    metadata: Option<std::collections::HashMap<String, String>>,
    auth: Option<AuthConfig>,
    tls_config: Option<TlsConfig>,
) -> Result<String, String> {
    let request_json: Value = serde_json::from_str(&request_data)
        .map_err(|e| format!("Failed to parse request JSON: {}", e))?;

    let clean_endpoint = endpoint
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .to_string();

    // Compile proto files to get descriptor pool
    let descriptor_pool = if let Some(paths) = import_paths {
        // Use import paths to compile protos
        proto_parser::compile_proto_from_paths(paths)
            .map_err(|e| format!("Failed to compile protos from import paths: {}", e))?
    } else if let Some(content) = proto_content {
        // Use proto content (legacy single-file approach)
        compile_proto_to_descriptors(&content)
            .map_err(|e| format!("Failed to compile proto: {}", e))?
    } else {
        return Err("Either proto_content or import_paths must be provided".to_string());
    };

    // Extract package name from the first service found
    let first_service = descriptor_pool
        .services()
        .next()
        .ok_or_else(|| "No services found in proto".to_string())?;
    
    let package_name = first_service.parent_file().package_name().to_string();

    // Build the gRPC path: /package.ServiceName/MethodName
    let grpc_path = if !package_name.is_empty() {
        format!("/{}.{}/{}", package_name, service, method)
    } else {
        format!("/{}/{}", service, method)
    };

    // Find the service and method descriptors
    let service_desc = descriptor_pool
        .services()
        .find(|s| s.name() == service)
        .ok_or_else(|| format!("Service '{}' not found in proto", service))?;

    let method_desc = service_desc
        .methods()
        .find(|m| m.name() == method)
        .ok_or_else(|| format!("Method '{}' not found in service '{}'", method, service))?;

    // Get input/output message descriptors
    let input_desc = method_desc.input();
    let output_desc = method_desc.output();

    // Encode JSON request to protobuf using descriptor-guided deserialization
    let mut deserializer = serde_json::Deserializer::from_str(&request_data);
    let request_msg = DynamicMessage::deserialize(input_desc.clone(), &mut deserializer)
        .map_err(|e| format!("Failed to deserialize JSON to protobuf: {}", e))?;

    // Serialize to protobuf bytes
    let protobuf_bytes = request_msg.encode_to_vec();

    // Add gRPC message framing:
    // - 1 byte: compression flag (0 = no compression)
    // - 4 bytes: message length (big-endian u32)
    // - N bytes: protobuf message body
    let mut request_body = Vec::new();
    request_body.push(0u8); // No compression
    request_body.extend_from_slice(&(protobuf_bytes.len() as u32).to_be_bytes());
    request_body.extend_from_slice(&protobuf_bytes);

    // Determine if TLS is enabled
    let use_tls = tls_config.as_ref().map(|c| c.enabled).unwrap_or(false);
    let scheme = if use_tls { "https" } else { "http" };
    
    // Build HTTP/2 request
    let uri: Uri = format!("{}://{}{}", scheme, clean_endpoint, grpc_path)
        .parse()
        .map_err(|e| format!("Invalid URI: {}", e))?;

    let mut req_builder = HttpRequest::builder()
        .method("POST")
        .uri(uri)
        .header("content-type", "application/grpc")
        .header("te", "trailers");
    
    // Add authentication headers
    if let Some(auth_config) = auth {
        match auth_config.auth_type.as_str() {
            "bearer" => {
                if let Some(token) = auth_config.token {
                    req_builder = req_builder.header("authorization", format!("Bearer {}", token));
                }
            }
            "basic" => {
                if let (Some(username), Some(password)) = (auth_config.username, auth_config.password) {
                    let credentials = format!("{}:{}", username, password);
                    let encoded = general_purpose::STANDARD.encode(credentials.as_bytes());
                    req_builder = req_builder.header("authorization", format!("Basic {}", encoded));
                }
            }
            "apiKey" => {
                if let (Some(key), Some(value)) = (auth_config.key, auth_config.value) {
                    req_builder = req_builder.header(key, value);
                }
            }
            _ => {} // "none" or unknown types - no auth header
        }
    }
    
    // Add custom metadata headers
    if let Some(meta) = metadata {
        for (key, value) in meta {
            req_builder = req_builder.header(key, value);
        }
    }
    
    let req = req_builder
        .body(Body::from(request_body))
        .map_err(|e| format!("Failed to build request: {}", e))?;

    // Create HTTP client with or without TLS
    let https_connector = if use_tls {
        let tls_cfg = tls_config.as_ref().unwrap();
        
        // Build TLS configuration
        let mut root_store = rustls::RootCertStore::empty();
        
        // Load CA certificates
        if let Some(ca_path) = &tls_cfg.server_ca_cert_path {
            let ca_certs = load_certificates_from_file(ca_path)?;
            for cert in ca_certs {
                root_store.add(&cert)
                    .map_err(|e| format!("Failed to add CA certificate: {}", e))?;
            }
        } else {
            // Use system root certificates
            root_store.add_trust_anchors(
                webpki_roots::TLS_SERVER_ROOTS.iter().map(|ta| {
                    rustls::OwnedTrustAnchor::from_subject_spki_name_constraints(
                        ta.subject.to_vec(),
                        ta.spki.to_vec(),
                        ta.name_constraints.as_ref().map(|nc| nc.to_vec()),
                    )
                })
            );
        }
        
        let config_builder = rustls::ClientConfig::builder()
            .with_safe_defaults()
            .with_root_certificates(root_store);
        
        // Handle client certificates (mTLS)
        let client_config = if let (Some(cert_path), Some(key_path)) = (&tls_cfg.client_cert_path, &tls_cfg.client_key_path) {
            let client_certs = load_certificates_from_file(cert_path)?;
            let client_key = load_private_key_from_file(key_path)?;
            
            config_builder.with_client_auth_cert(client_certs, client_key)
                .map_err(|e| format!("Failed to configure client authentication: {}", e))?
        } else {
            config_builder.with_no_client_auth()
        };
        
        // Handle insecure skip verify
        let final_config = if tls_cfg.insecure_skip_verify.unwrap_or(false) {
            let mut config = client_config;
            config.dangerous().set_certificate_verifier(Arc::new(NoCertificateVerification));
            config
        } else {
            client_config
        };
        
        hyper_rustls::HttpsConnectorBuilder::new()
            .with_tls_config(final_config)
            .https_or_http()
            .enable_http2()
            .build()
    } else {
        // For non-TLS, still use HttpsConnector but with native roots
        hyper_rustls::HttpsConnectorBuilder::new()
            .with_native_roots()
            .https_or_http()
            .enable_http2()
            .build()
    };

    let client = Client::builder()
        .http2_only(true)
        .build::<_, Body>(https_connector);

    let response = client
        .request(req)
        .await
        .map_err(|e| {
            // Preserve the raw error and provide helpful troubleshooting hints
            let error_str = e.to_string();
            
            // Be more specific with error detection - order matters!
            let (error_category, hints) = if error_str.contains("certificate") || error_str.contains("tls") || error_str.contains("ssl") {
                ("TLS/Certificate Error", vec![
                    "Server may require TLS but TLS is not enabled".to_string(),
                    "Server certificate might not be trusted (try 'Insecure Skip Verify' for testing)".to_string(),
                    "Client certificate may be required but not provided".to_string(),
                    "Certificate/key file paths might be incorrect".to_string(),
                ])
            } else if error_str.contains("connection refused") {
                // Most specific - server actively refusing connection
                ("Connection Refused", vec![
                    "Server may not be running".to_string(),
                    "Check if host and port are correct".to_string(),
                    "Firewall might be blocking the connection".to_string(),
                ])
            } else if error_str.contains("broken pipe") || error_str.contains("stream closed") || error_str.contains("connection reset") {
                // Connection was established but closed unexpectedly
                ("Connection Closed", vec![
                    "Server closed the connection during handshake".to_string(),
                    "TLS mismatch: server expects TLS but client not using it, or vice versa".to_string(),
                    "Server may have rejected the connection".to_string(),
                ])
            } else if error_str.contains("timeout") || error_str.contains("timed out") {
                ("Connection Timeout", vec![
                    "Server took too long to respond".to_string(),
                    "Network latency or connectivity issues".to_string(),
                ])
            } else if error_str.to_lowercase().contains("connect") {
                // Generic connection issues - catch-all for connection problems
                ("Connection Error", vec![
                    "Unable to establish connection to server".to_string(),
                    "Check network connectivity and firewall settings".to_string(),
                ])
            } else {
                // Unknown error - no hints
                ("Error", vec![])
            };
            
            format_error_response(&error_str, &clean_endpoint, &service, &method, error_category, hints)
        })?;

    // Extract headers before consuming body
    let grpc_status_raw = response.headers().get("grpc-status")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let grpc_message = response.headers().get("grpc-message")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| String::new());

    // Check if this is a streaming method by checking method descriptor
    let is_server_streaming = method_desc.is_server_streaming();

    // Decode gRPC framed response(s)
    let mut response_data = None;
    let mut response_messages = Vec::new();
    let mut decode_success = false;

    if is_server_streaming {
        // Server streaming: process body as a stream and emit events in real-time
        use futures::StreamExt;
        use bytes::Buf;
        
        let mut body_stream = response.into_body();
        let mut buffer = bytes::BytesMut::new();
        let mut message_index = 0;
        
        // Process streaming body frame by frame
        while let Some(chunk_result) = body_stream.next().await {
            match chunk_result {
                Ok(chunk) => {
                    buffer.extend_from_slice(&chunk);
                    
                    // Try to read complete gRPC frames from buffer
                    loop {
                        if buffer.len() < 5 {
                            // Not enough data for frame header
                            break;
                        }
                        
                        // Read frame header
                        let _compression_flag = buffer[0];
                        let message_len = u32::from_be_bytes([
                            buffer[1], buffer[2], buffer[3], buffer[4],
                        ]) as usize;
                        
                        // Check if we have the complete message
                        if buffer.len() < 5 + message_len {
                            // Wait for more data
                            break;
                        }
                        
                        // Extract the message
                        buffer.advance(5); // Skip header
                        let message_bytes = buffer.split_to(message_len);
                        
                        // Decode and emit the message immediately
                        match DynamicMessage::decode(output_desc.clone(), message_bytes.as_ref()) {
                            Ok(response_msg) => {
                                match serde_json::to_value(response_msg) {
                                    Ok(json_value) => {
                                        // Emit event for this streaming message immediately
                                        let event_payload = serde_json::json!({
                                            "tabId": tab_id,
                                            "index": message_index,
                                            "data": json_value,
                                            "timestamp": chrono::Utc::now().to_rfc3339(),
                                        });
                                        
                                        // Emit event - log for debugging
                                        println!("[STREAMING] Emitting message {} at {}", message_index, chrono::Utc::now().to_rfc3339());
                                        match app.emit("grpc-stream-message", &event_payload) {
                                            Ok(_) => println!("[STREAMING] Event emitted successfully"),
                                            Err(e) => eprintln!("[STREAMING] Failed to emit event: {:?}", e),
                                        }
                                        
                                        response_messages.push(json_value);
                                        message_index += 1;
                                        decode_success = true;
                                    }
                                    Err(e) => {
                                        return Err(format!("Failed to convert response to JSON: {}", e));
                                    }
                                }
                            }
                            Err(e) => {
                                return Err(format!("Failed to decode response protobuf frame: {}", e));
                            }
                        }
                    }
                }
                Err(e) => {
                    return Err(format!("Failed to read response stream: {}", e));
                }
            }
        }
        
        // For streaming, return the array directly as the response
        response_data = Some(serde_json::Value::Array(response_messages.clone()));
    } else {
        // Unary: read body all at once
        let body_bytes = hyper::body::to_bytes(response.into_body())
            .await
            .map_err(|e| format!("Failed to read response: {}", e))?;
            
        // Read single frame
        if body_bytes.len() >= 5 {
            let _compression_flag = body_bytes[0];
            let message_len = u32::from_be_bytes([
                body_bytes[1], body_bytes[2], body_bytes[3], body_bytes[4],
            ]) as usize;

            if body_bytes.len() >= 5 + message_len {
                let message_bytes = &body_bytes[5..5 + message_len];

                // Decode protobuf response to JSON using descriptor-guided serialization
                match DynamicMessage::decode(output_desc.clone(), message_bytes) {
                    Ok(response_msg) => {
                        match serde_json::to_value(response_msg) {
                            Ok(json_value) => {
                                response_data = Some(json_value);
                                decode_success = true;
                            }
                            Err(e) => {
                                return Err(format!("Failed to convert response to JSON: {}", e));
                            }
                        }
                    }
                    Err(e) => {
                        return Err(format!("Failed to decode response protobuf: {}", e));
                    }
                }
            }
        }
    }

    // Determine gRPC status: if we successfully decoded a response and no explicit error status, assume success
    let grpc_status = grpc_status_raw.unwrap_or_else(|| {
        if decode_success { "0".to_string() } else { "unknown".to_string() }
    });

    let note = if grpc_status == "0" {
        if is_server_streaming {
            format!("✓ gRPC streaming call successful! Received {} messages.", response_messages.len())
        } else {
            "✓ gRPC call successful! Response decoded from protobuf.".to_string()
        }
    } else {
        "✓ Connected to gRPC server. Call failed - see grpc_status and grpc_message for details.".to_string()
    };

    // Calculate approximate response size
    let response_size = if let Some(ref data) = response_data {
        serde_json::to_string(data).unwrap_or_default().len()
    } else {
        0
    };

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
        "response_size": response_size,
        "note": note,
        "timestamp": chrono::Utc::now().to_rfc3339(),
    });

    Ok(serde_json::to_string_pretty(&result).unwrap())
}

fn generate_default_value_for_field(field: &prost_reflect::FieldDescriptor) -> Value {
    use prost_reflect::Kind;
    
    if field.is_list() {
        return Value::Array(vec![]);
    }
    
    if field.is_map() {
        return Value::Object(serde_json::Map::new());
    }
    
    match field.kind() {
        Kind::Double | Kind::Float => Value::Number(serde_json::Number::from_f64(0.0).unwrap()),
        Kind::Int32 | Kind::Int64 | Kind::Uint32 | Kind::Uint64 
        | Kind::Sint32 | Kind::Sint64 | Kind::Fixed32 | Kind::Fixed64 
        | Kind::Sfixed32 | Kind::Sfixed64 => Value::Number(serde_json::Number::from(0)),
        Kind::Bool => Value::Bool(false),
        Kind::String => Value::String(String::new()),
        Kind::Bytes => Value::String(String::from("base64_encoded_bytes")),
        Kind::Message(msg_desc) => {
            // Recursively generate default object for nested message
            let mut obj = serde_json::Map::new();
            for nested_field in msg_desc.fields() {
                obj.insert(
                    nested_field.json_name().to_string(),
                    generate_default_value_for_field(&nested_field)
                );
            }
            Value::Object(obj)
        }
        Kind::Enum(enum_desc) => {
            // Use first enum value (usually the default/zero value)
            if let Some(first_value) = enum_desc.values().next() {
                Value::String(first_value.name().to_string())
            } else {
                Value::Number(serde_json::Number::from(0))
            }
        }
    }
}

#[tauri::command]
async fn generate_sample_request(message_type: String, proto_content: String) -> Result<String, String> {
    // Compile proto to get descriptor pool
    let descriptor_pool = compile_proto_to_descriptors(&proto_content)
        .map_err(|e| format!("Failed to compile proto: {}", e))?;
    
    // Find the message descriptor
    let message_desc = descriptor_pool
        .all_messages()
        .find(|m| m.name() == message_type || m.full_name() == message_type)
        .ok_or_else(|| format!("Message type '{}' not found in proto", message_type))?;
    
    // Generate default JSON object for the message
    let mut result = serde_json::Map::new();
    for field in message_desc.fields() {
        result.insert(
            field.json_name().to_string(),
            generate_default_value_for_field(&field)
        );
    }
    
    // Return formatted JSON
    serde_json::to_string_pretty(&Value::Object(result))
        .map_err(|e| format!("Failed to serialize JSON: {}", e))
}

/// New multi-phase proto parser with import resolution
#[tauri::command]
fn parse_proto_files(import_paths: Vec<proto_parser::ImportPath>) -> proto_parser::ProtoParseResult {
    proto_parser::parse_proto_files(import_paths)
}

/// Initialize client streaming (open HTTP/2 stream)
#[tauri::command]
async fn start_client_stream(
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
    println!("[CLIENT_STREAMING] Starting stream for tab {}", tab_id);
    
    // Compile proto files to get descriptor pool
    let descriptor_pool = if let Some(paths) = import_paths {
        proto_parser::compile_proto_from_paths(paths)
            .map_err(|e| format!("Failed to compile protos: {}", e))?
    } else if let Some(content) = proto_content {
        compile_proto_to_descriptors(&content)
            .map_err(|e| format!("Failed to compile proto: {}", e))?
    } else {
        return Err("No proto content or import paths available".to_string());
    };
    
    let descriptor_pool = Arc::new(descriptor_pool);
    
    // Find service and method descriptors
    let service_desc = descriptor_pool
        .services()
        .find(|s| s.name() == service)
        .ok_or_else(|| format!("Service '{}' not found", service))?;
    
    let method_desc = service_desc
        .methods()
        .find(|m| m.name() == method)
        .ok_or_else(|| format!("Method '{}' not found", method))?;
    
    let input_desc = method_desc.input();
    let output_desc = method_desc.output();
    
    // Check if this is bidirectional streaming
    let is_bidirectional = method_desc.is_client_streaming() && method_desc.is_server_streaming();
    println!("[CLIENT_STREAMING] Method is bidirectional: {}", is_bidirectional);
    
    // Build gRPC path
    let first_service = descriptor_pool.services().next().unwrap();
    let package_name = first_service.parent_file().package_name().to_string();
    let grpc_path = if !package_name.is_empty() {
        format!("/{}.{}/{}", package_name, service, method)
    } else {
        format!("/{}/{}", service, method)
    };
    
    let clean_endpoint = endpoint
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .to_string();
    
    let use_tls = tls_config.as_ref().map(|c| c.enabled).unwrap_or(false);
    let scheme = if use_tls { "https" } else { "http" };
    
    let uri: Uri = format!("{}://{}{}", scheme, clean_endpoint, grpc_path)
        .parse()
        .map_err(|e| format!("Invalid URI: {}", e))?;
    
    // Create channels for streaming
    let (message_tx, mut message_rx) = mpsc::unbounded_channel::<Vec<u8>>();
    let (response_tx, response_rx) = tokio::sync::oneshot::channel();
    
    // Clone values for the async task
    let metadata_clone = metadata.clone();
    let auth_clone = auth.clone();
    let descriptor_pool_clone = descriptor_pool.clone();
    let output_desc_clone = output_desc.clone();
    let tab_id_clone = tab_id.clone();
    let app_clone = app.clone();
    
    // Spawn a task to handle the HTTP/2 streaming request
    tokio::spawn(async move {
        let result = async {
            // Build HTTP request
            let mut req_builder = HttpRequest::builder()
                .method("POST")
                .uri(uri)
                .header("content-type", "application/grpc")
                .header("te", "trailers");
            
            // Add auth headers
            if let Some(auth_config) = auth_clone {
                match auth_config.auth_type.as_str() {
                    "bearer" => {
                        if let Some(token) = auth_config.token {
                            req_builder = req_builder.header("authorization", format!("Bearer {}", token));
                        }
                    }
                    "basic" => {
                        if let (Some(username), Some(password)) = (auth_config.username, auth_config.password) {
                            let credentials = format!("{}:{}", username, password);
                            let encoded = general_purpose::STANDARD.encode(credentials.as_bytes());
                            req_builder = req_builder.header("authorization", format!("Basic {}", encoded));
                        }
                    }
                    "apiKey" => {
                        if let (Some(key), Some(value)) = (auth_config.key, auth_config.value) {
                            req_builder = req_builder.header(key, value);
                        }
                    }
                    _ => {}
                }
            }
            
            // Add metadata headers
            if let Some(meta) = metadata_clone {
                for (key, value) in meta {
                    req_builder = req_builder.header(key, value);
                }
            }
            
            // Create a channel-based body that we can stream to
            let (mut body_sender, body_receiver) = Body::channel();
            
            let req = req_builder
                .body(body_receiver)
                .map_err(|e| format!("Failed to build request: {}", e))?;
            
            // Create HTTP client
            let https_connector = hyper_rustls::HttpsConnectorBuilder::new()
                .with_native_roots()
                .https_or_http()
                .enable_http2()
                .build();
            
            let client = Client::builder()
                .http2_only(true)
                .build::<_, Body>(https_connector);
            
            // Send the request (stream will stay open)
            let response_future = client.request(req);
            
            // Spawn a task to send messages from the channel
            let sender_task = tokio::spawn(async move {
                while let Some(message_bytes) = message_rx.recv().await {
                    println!("[CLIENT_STREAMING] Sending message of {} bytes", message_bytes.len());
                    if body_sender.send_data(bytes::Bytes::from(message_bytes)).await.is_err() {
                        eprintln!("[CLIENT_STREAMING] Failed to send message");
                        break;
                    }
                }
                println!("[CLIENT_STREAMING] Message channel closed, finishing stream");
            });
            
            // Wait for response
            let response = response_future.await
                .map_err(|e| format!("gRPC call failed: {}", e))?;
            
            // For bidirectional streaming, process response as a stream
            if is_bidirectional {
                use futures::StreamExt;
                use bytes::Buf;
                
                let mut body_stream = response.into_body();
                let mut buffer = bytes::BytesMut::new();
                let mut message_index = 0;
                
                // Process streaming response frames
                while let Some(chunk_result) = body_stream.next().await {
                    match chunk_result {
                        Ok(chunk) => {
                            buffer.extend_from_slice(&chunk);
                            
                            // Try to read complete gRPC frames from buffer
                            loop {
                                if buffer.len() < 5 {
                                    break;
                                }
                                
                                let _compression_flag = buffer[0];
                                let message_len = u32::from_be_bytes([
                                    buffer[1], buffer[2], buffer[3], buffer[4],
                                ]) as usize;
                                
                                if buffer.len() < 5 + message_len {
                                    break;
                                }
                                
                                buffer.advance(5);
                                let message_bytes = buffer.split_to(message_len);
                                
                                // Decode and emit the message
                                match DynamicMessage::decode(output_desc_clone.clone(), message_bytes.as_ref()) {
                                    Ok(response_msg) => {
                                        match serde_json::to_value(response_msg) {
                                            Ok(json_value) => {
                                                let event_payload = serde_json::json!({
                                                    "tabId": tab_id_clone,
                                                    "index": message_index,
                                                    "data": json_value,
                                                    "timestamp": chrono::Utc::now().to_rfc3339(),
                                                });
                                                
                                                println!("[BIDIRECTIONAL_STREAMING] Emitting response message {}", message_index);
                                                let _ = app_clone.emit("grpc-stream-message", &event_payload);
                                                message_index += 1;
                                            }
                                            Err(e) => eprintln!("[BIDIRECTIONAL_STREAMING] Failed to serialize: {}", e),
                                        }
                                    }
                                    Err(e) => eprintln!("[BIDIRECTIONAL_STREAMING] Failed to decode: {}", e),
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("[BIDIRECTIONAL_STREAMING] Stream error: {}", e);
                            break;
                        }
                    }
                }
                
                // Ensure sender task completes
                let _ = sender_task.await;
                
                // Return success (responses already emitted via events)
                let result = serde_json::json!({
                    "grpc_status": "0",
                    "grpc_message": "OK",
                    "message": "Bidirectional stream completed"
                });
                
                serde_json::to_string(&result)
                    .map_err(|e| format!("Failed to serialize result: {}", e))
            } else {
                // For client streaming (not bidirectional), wait for single response
                // Ensure sender task completes first
                let _ = sender_task.await;
                
                // Read response body
                let body_bytes = hyper::body::to_bytes(response.into_body())
                    .await
                    .map_err(|e| format!("Failed to read response: {}", e))?;
                
                // Decode gRPC frame
                if body_bytes.len() < 5 {
                    return Err("Response too short".to_string());
                }
                
                let _compression_flag = body_bytes[0];
                let message_len = u32::from_be_bytes([
                    body_bytes[1], body_bytes[2], body_bytes[3], body_bytes[4],
                ]) as usize;
                
                if body_bytes.len() < 5 + message_len {
                    return Err("Incomplete response".to_string());
                }
                
                let message_bytes = &body_bytes[5..5 + message_len];
                let response_msg = DynamicMessage::decode(output_desc_clone, message_bytes)
                    .map_err(|e| format!("Failed to decode response: {}", e))?;
                
                let response_json = serde_json::to_value(response_msg)
                    .map_err(|e| format!("Failed to serialize response: {}", e))?;
                
                let result = serde_json::json!({
                    "response": response_json,
                    "grpc_status": "0",
                    "grpc_message": "OK"
                });
                
                serde_json::to_string(&result)
                    .map_err(|e| format!("Failed to serialize result: {}", e))
            }
        }.await;
        
        // Send result back through channel
        let _ = response_tx.send(result);
    });
    
    // Store the active stream
    let stream = ActiveClientStream {
        sender: message_tx,
        descriptor_pool: descriptor_pool.clone(),
        input_desc: input_desc.clone(),
        output_desc: output_desc.clone(),
        response_receiver: response_rx,
    };
    
    let mut streams = ACTIVE_CLIENT_STREAMS.lock().unwrap();
    streams.insert(tab_id.clone(), stream);
    
    Ok("Stream opened".to_string())
}

/// Send a message in a client streaming request
#[tauri::command]
async fn send_stream_message(
    tab_id: String,
    message_id: String,
    body: String,
) -> Result<String, String> {
    println!("[CLIENT_STREAMING] Sending message {} for tab {}", message_id, tab_id);
    
    // Get the active stream
    let (sender, input_desc) = {
        let streams = ACTIVE_CLIENT_STREAMS.lock().unwrap();
        let stream = streams.get(&tab_id)
            .ok_or_else(|| "Stream not found. Start the stream first.".to_string())?;
        (stream.sender.clone(), stream.input_desc.clone())
    };
    
    // Parse and encode the message
    let request_json: Value = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;
    
    let mut deserializer = serde_json::Deserializer::from_str(&body);
    let message = DynamicMessage::deserialize(input_desc, &mut deserializer)
        .map_err(|e| format!("Failed to deserialize message: {}", e))?;
    
    let protobuf_bytes = message.encode_to_vec();
    
    // Add gRPC framing
    let mut framed_message = Vec::new();
    framed_message.push(0u8); // No compression
    framed_message.extend_from_slice(&(protobuf_bytes.len() as u32).to_be_bytes());
    framed_message.extend_from_slice(&protobuf_bytes);
    
    // Send through channel (this will send immediately over HTTP/2)
    sender.send(framed_message)
        .map_err(|_| "Failed to send message, stream may be closed".to_string())?;
    
    println!("[CLIENT_STREAMING] Message {} sent successfully", message_id);
    Ok(format!("Message {} sent", message_id))
}

/// Finish a client streaming request (close stream and get response)
#[tauri::command]
async fn finish_streaming(
    tab_id: String,
) -> Result<String, String> {
    println!("[CLIENT_STREAMING] Finishing stream for tab {}", tab_id);
    
    // Remove the stream and get its response receiver
    let response_receiver = {
        let mut streams = ACTIVE_CLIENT_STREAMS.lock().unwrap();
        let stream = streams.remove(&tab_id)
            .ok_or_else(|| "Stream not found. Start the stream first.".to_string())?;
        
        // Drop the sender to close the stream (this signals end-of-stream to server)
        drop(stream.sender);
        
        stream.response_receiver
    };
    
    // Wait for the response from the background task
    println!("[CLIENT_STREAMING] Waiting for server response...");
    let result = response_receiver.await
        .map_err(|_| "Failed to receive response from stream task".to_string())?;
    
    println!("[CLIENT_STREAMING] Received response");
    result
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            parse_proto_file,
            call_grpc_method,
            generate_sample_request,
            parse_proto_files,
            start_client_stream,
            send_stream_message,
            finish_streaming
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
