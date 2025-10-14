// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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

#[tauri::command]
async fn parse_proto_file(proto_content: String) -> Result<Vec<ServiceInfo>, String> {
    // Parse proto file using regex to extract services and methods
    let mut services = Vec::new();
    
    // Regex to match service blocks: service ServiceName { ... }
    let service_re = Regex::new(r"service\s+(\w+)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}")
        .map_err(|e| format!("Failed to compile service regex: {}", e))?;
    
    // Regex to match rpc methods with optional stream keywords
    // Captures: method_name, (stream)?, input_type, (stream)?, output_type
    let rpc_re = Regex::new(r"rpc\s+(\w+)\s*\(\s*(stream\s+)?([A-Za-z0-9_.]+)\s*\)\s+returns\s*\(\s*(stream\s+)?([A-Za-z0-9_.]+)\s*\)")
        .map_err(|e| format!("Failed to compile rpc regex: {}", e))?;
    
    // Find all services
    for service_cap in service_re.captures_iter(&proto_content) {
        let service_name = service_cap.get(1)
            .ok_or("Failed to extract service name")?
            .as_str()
            .to_string();
        
        let service_body = service_cap.get(2)
            .ok_or("Failed to extract service body")?
            .as_str();
        
        let mut methods = Vec::new();
        
        // Find all RPC methods in this service
        for rpc_cap in rpc_re.captures_iter(service_body) {
            let method_name = rpc_cap.get(1)
                .ok_or("Failed to extract method name")?
                .as_str()
                .to_string();
            
            let is_client_streaming = rpc_cap.get(2).is_some();
            
            let input_type = rpc_cap.get(3)
                .ok_or("Failed to extract input type")?
                .as_str()
                .to_string();
            
            let is_server_streaming = rpc_cap.get(4).is_some();
            
            let output_type = rpc_cap.get(5)
                .ok_or("Failed to extract output type")?
                .as_str()
                .to_string();
            
            let method_type = match (is_client_streaming, is_server_streaming) {
                (false, false) => "unary",
                (false, true) => "server_streaming",
                (true, false) => "client_streaming",
                (true, true) => "bidirectional_streaming",
            }.to_string();
            
            methods.push(MethodInfo {
                name: method_name,
                input_type,
                output_type,
                is_client_streaming,
                is_server_streaming,
                method_type,
            });
        }
        
        services.push(ServiceInfo {
            name: service_name,
            methods,
        });
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
    service: String,
    method: String,
    request_data: String,
    endpoint: String,
    proto_content: String,
) -> Result<String, String> {
    let request_json: Value = serde_json::from_str(&request_data)
        .map_err(|e| format!("Failed to parse request JSON: {}", e))?;

    let clean_endpoint = endpoint
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .to_string();

    // Extract package name from proto file
    let package_re = Regex::new(r"package\s+([A-Za-z0-9_.]+)\s*;")
        .map_err(|e| format!("Failed to compile package regex: {}", e))?;

    let package_name = package_re.captures(&proto_content)
        .and_then(|cap| cap.get(1))
        .map(|m| m.as_str())
        .unwrap_or("");

    // Build the gRPC path: /package.ServiceName/MethodName
    let grpc_path = if !package_name.is_empty() {
        format!("/{}.{}/{}", package_name, service, method)
    } else {
        format!("/{}/{}", service, method)
    };

    // Compile proto file to FileDescriptorSet using protoc
    let descriptor_pool = compile_proto_to_descriptors(&proto_content)
        .map_err(|e| format!("Failed to compile proto: {}", e))?;

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

    // Build HTTP/2 request
    let uri: Uri = format!("http://{}{}", clean_endpoint, grpc_path)
        .parse()
        .map_err(|e| format!("Invalid URI: {}", e))?;

    let req = HttpRequest::builder()
        .method("POST")
        .uri(uri)
        .header("content-type", "application/grpc")
        .header("te", "trailers")
        .body(Body::from(request_body))
        .map_err(|e| format!("Failed to build request: {}", e))?;

    let client = Client::builder()
        .http2_only(true)
        .build_http();

    let response = client
        .request(req)
        .await
        .map_err(|e| format!("gRPC call failed: {}. Is the server running?", e))?;

    // Extract headers before consuming body
    let grpc_status_raw = response.headers().get("grpc-status")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let grpc_message = response.headers().get("grpc-message")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| String::new());

    let body_bytes = hyper::body::to_bytes(response.into_body())
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // Check if this is a streaming method by checking method descriptor
    let is_server_streaming = method_desc.is_server_streaming();

    // Decode gRPC framed response(s)
    let mut response_data = None;
    let mut response_messages = Vec::new();
    let mut decode_success = false;

    if is_server_streaming {
        // Server streaming: read multiple frames
        match read_grpc_frames(&body_bytes) {
            Ok(frames) => {
                for frame_bytes in frames {
                    match DynamicMessage::decode(output_desc.clone(), frame_bytes.as_slice()) {
                        Ok(response_msg) => {
                            match serde_json::to_value(response_msg) {
                                Ok(json_value) => {
                                    response_messages.push(json_value);
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
                decode_success = !response_messages.is_empty();
                response_data = Some(serde_json::Value::Array(response_messages.clone()));
            }
            Err(e) => {
                return Err(format!("Failed to read gRPC frames: {}", e));
            }
        }
    } else {
        // Unary: read single frame
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
        "response_size": body_bytes.len(),
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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            parse_proto_file,
            call_grpc_method,
            generate_sample_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
