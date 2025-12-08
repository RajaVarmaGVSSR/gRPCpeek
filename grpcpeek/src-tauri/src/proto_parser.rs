use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tempfile::TempDir;
use walkdir::WalkDir;

use prost_reflect::{DescriptorPool, FieldDescriptor, MessageDescriptor};

const MAX_SAMPLE_DEPTH: usize = 4;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Service {
    pub name: String,
    pub package_name: Option<String>,
    pub methods: Vec<Method>,
    pub source_proto: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Method {
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
pub struct ImportPath {
    pub id: String,
    pub path: String,
    #[serde(rename = "type")]
    pub path_type: String,
    pub enabled: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtoParseResult {
    pub success: bool,
    pub services: Vec<Service>,
    pub errors: Vec<ProtoParseError>,
    pub warnings: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProtoParseError {
    pub file: String,
    pub message: String,
    pub suggestion: Option<String>,
}

pub fn parse_proto_files(import_paths: Vec<ImportPath>) -> ProtoParseResult {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    let enabled_imports: Vec<ImportPath> = import_paths
        .into_iter()
        .filter(|p| p.enabled)
        .collect();

    if enabled_imports.is_empty() {
        errors.push(ProtoParseError {
            file: "workspace".to_string(),
            message: "All import paths are disabled".to_string(),
            suggestion: Some("Enable at least one proto import path".to_string()),
        });

        return ProtoParseResult {
            success: false,
            services: Vec::new(),
            errors,
            warnings,
        };
    }

    let proto_paths = discover_proto_files(&enabled_imports, &mut warnings);

    if proto_paths.is_empty() {
        errors.push(ProtoParseError {
            file: "workspace".to_string(),
            message: "No .proto files found in the configured import paths".to_string(),
            suggestion: Some("Add directories or files that contain proto definitions".to_string()),
        });

        return ProtoParseResult {
            success: false,
            services: Vec::new(),
            errors,
            warnings,
        };
    }

    let proto_files = read_proto_files(&proto_paths, &mut errors);

    if proto_files.is_empty() {
        return ProtoParseResult {
            success: false,
            services: Vec::new(),
            errors,
            warnings,
        };
    }

    let mut services = extract_services(&proto_files, &mut warnings);

    let descriptor_pool = match compile_proto_bundle(&proto_files, &enabled_imports) {
        Ok(pool) => Some(pool),
        Err(err) => {
            errors.push(ProtoParseError {
                file: "protoc".to_string(),
                message: err,
                suggestion: Some("Ensure protoc is installed and import paths are correct".to_string()),
            });
            None
        }
    };

    if let Some(pool) = descriptor_pool {
        enrich_with_samples(&mut services, &pool, &mut warnings);
    }

    services.sort_by(|a, b| {
        let pkg_cmp = a.package_name.cmp(&b.package_name);
        if pkg_cmp == std::cmp::Ordering::Equal {
            a.name.cmp(&b.name)
        } else {
            pkg_cmp
        }
    });

    for service in &mut services {
        service
            .methods
            .sort_by(|a, b| a.name.cmp(&b.name));
    }

    let success = errors.is_empty() || !services.is_empty();

    ProtoParseResult {
        success,
        services,
        errors,
        warnings,
    }
}

fn discover_proto_files(import_paths: &[ImportPath], warnings: &mut Vec<String>) -> Vec<PathBuf> {
    let mut results = Vec::new();
    let mut seen = HashSet::new();

    for import in import_paths {
        let candidate_path = Path::new(&import.path);

        if !candidate_path.exists() {
            warnings.push(format!("Import path '{}' does not exist", import.path));
            continue;
        }

        if candidate_path.is_file() {
            if is_proto_file(candidate_path) {
                let canonical = candidate_path.to_path_buf();
                if seen.insert(canonical.clone()) {
                    results.push(canonical);
                }
            } else {
                warnings.push(format!(
                    "File '{}' is not a .proto file and was skipped",
                    import.path
                ));
            }
            continue;
        }

        let mut found_any = false;

        for entry in WalkDir::new(candidate_path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                let path = entry.path();
                if is_proto_file(path) {
                    found_any = true;
                    let cloned = path.to_path_buf();
                    if seen.insert(cloned.clone()) {
                        results.push(cloned);
                    }
                }
            }
        }

        if !found_any {
            warnings.push(format!("No .proto files found under '{}'", import.path));
        }
    }

    results.sort_by(|a, b| a.to_string_lossy().cmp(&b.to_string_lossy()));
    results
}

fn is_proto_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("proto"))
        .unwrap_or(false)
}

fn read_proto_files(
    paths: &[PathBuf],
    errors: &mut Vec<ProtoParseError>,
) -> Vec<(PathBuf, String)> {
    let mut result = Vec::new();

    for path in paths {
        match fs::read_to_string(path) {
            Ok(content) => result.push((path.clone(), content)),
            Err(err) => errors.push(ProtoParseError {
                file: path.to_string_lossy().to_string(),
                message: format!("Failed to read proto file: {}", err),
                suggestion: None,
            }),
        }
    }

    result
}

fn extract_services(
    proto_files: &[(PathBuf, String)],
    warnings: &mut Vec<String>,
) -> Vec<Service> {
    let service_re = Regex::new(r"service\s+(\w+)\s*\{([\s\S]*?)\}")
        .expect("valid service regex");
    let rpc_re = Regex::new(
        r"rpc\s+(\w+)\s*\(\s*(stream\s+)?([A-Za-z0-9_.]+)\s*\)\s+returns\s*\(\s*(stream\s+)?([A-Za-z0-9_.]+)\s*\)",
    )
    .expect("valid rpc regex");

    let mut services = Vec::new();

    for (path, content) in proto_files {
        let package_name = extract_package(content);

        for service_cap in service_re.captures_iter(content) {
            let service_name = service_cap
                .get(1)
                .map(|m| m.as_str().to_string())
                .unwrap_or_default();

            let body = service_cap
                .get(2)
                .map(|m| m.as_str())
                .unwrap_or("");

            let mut methods = Vec::new();

            for rpc_cap in rpc_re.captures_iter(body) {
                let method_name = rpc_cap
                    .get(1)
                    .map(|m| m.as_str().to_string())
                    .unwrap_or_default();

                let is_client_streaming = rpc_cap.get(2).is_some();
                let input_type = rpc_cap
                    .get(3)
                    .map(|m| m.as_str().to_string())
                    .unwrap_or_default();
                let is_server_streaming = rpc_cap.get(4).is_some();
                let output_type = rpc_cap
                    .get(5)
                    .map(|m| m.as_str().to_string())
                    .unwrap_or_default();

                let method_type = match (is_client_streaming, is_server_streaming) {
                    (false, false) => "unary",
                    (false, true) => "server_streaming",
                    (true, false) => "client_streaming",
                    (true, true) => "bidirectional_streaming",
                }
                .to_string();

                methods.push(Method {
                    name: method_name,
                    input_type,
                    output_type,
                    is_client_streaming,
                    is_server_streaming,
                    method_type,
                    sample_request: None,
                });
            }

            if methods.is_empty() {
                warnings.push(format!(
                    "Service '{}' in '{}' has no RPC methods",
                    service_name,
                    path.to_string_lossy()
                ));
            }

            services.push(Service {
                name: service_name,
                package_name: package_name.clone(),
                methods,
                source_proto: Some(path.to_string_lossy().to_string()),
            });
        }
    }

    services
}

fn extract_package(content: &str) -> Option<String> {
    let package_re = Regex::new(r"package\s+([A-Za-z0-9_.]+)\s*;").ok()?;
    package_re
        .captures(content)
        .and_then(|cap| cap.get(1))
        .map(|m| m.as_str().to_string())
}

fn compile_proto_bundle(
    proto_files: &[(PathBuf, String)],
    import_paths: &[ImportPath],
) -> Result<DescriptorPool, String> {
    if proto_files.is_empty() {
        return Err("No proto files available for compilation".to_string());
    }

    // Create temp directory only for the output descriptor file
    let temp_dir = TempDir::new()
        .map_err(|e| format!("Failed to create temporary directory: {}", e))?;
    let descriptor_path = temp_dir.path().join("bundle.pb");

    // Log for debugging
    eprintln!("[proto_parser] Compiling {} proto files", proto_files.len());
    eprintln!("[proto_parser] Import paths: {:?}", import_paths.iter().map(|p| &p.path).collect::<Vec<_>>());

    let mut command = Command::new("protoc");
    command.arg("--descriptor_set_out").arg(&descriptor_path);
    command.arg("--include_imports");

    // Add all import paths as proto_path for protoc
    // This allows protoc to resolve imports correctly from the original locations
    for import in import_paths {
        let import_path = Path::new(&import.path);
        if import_path.is_dir() {
            command.arg("--proto_path").arg(&import.path);
            eprintln!("[proto_parser] Added proto_path (dir): {}", import.path);
        } else if let Some(parent) = import_path.parent() {
            // If it's a file, add its parent directory
            if parent.exists() {
                command.arg("--proto_path").arg(parent);
                eprintln!("[proto_parser] Added proto_path (parent): {}", parent.display());
            }
        }
    }

    // Add each proto file using its path relative to the import paths
    // This ensures protoc can find them and resolve imports correctly
    for (original_path, _content) in proto_files {
        // Try to find the relative path from one of the import paths
        let proto_arg = find_relative_proto_path(original_path, import_paths)
            .unwrap_or_else(|| original_path.to_string_lossy().to_string());
        
        // Normalize path separators for protoc
        let normalized = proto_arg.replace('\\', "/");
        eprintln!("[proto_parser] Adding proto file: {} -> {}", original_path.display(), normalized);
        command.arg(&normalized);
    }

    eprintln!("[proto_parser] Running protoc with args: {:?}", command);

    let output = command.output().map_err(|e| {
        format!(
            "Failed to run protoc: {}. Ensure protoc is installed and in PATH.",
            e
        )
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("protoc failed: {}", stderr.trim()));
    }

    let descriptor_bytes = fs::read(&descriptor_path)
        .map_err(|e| format!("Failed to read descriptor set: {}", e))?;

    DescriptorPool::decode(descriptor_bytes.as_slice())
        .map_err(|e| format!("Failed to decode descriptor set: {}", e))
}

/// Find the relative path of a proto file from one of the import paths
fn find_relative_proto_path(proto_path: &Path, import_paths: &[ImportPath]) -> Option<String> {
    for import in import_paths {
        let import_root = Path::new(&import.path);
        if import_root.is_dir() {
            if let Ok(relative) = proto_path.strip_prefix(import_root) {
                if !relative.as_os_str().is_empty() {
                    return Some(relative.to_string_lossy().to_string());
                }
            }
        }
    }
    None
}


fn enrich_with_samples(
    services: &mut [Service],
    descriptor_pool: &DescriptorPool,
    warnings: &mut Vec<String>,
) {
    // Debug: log all available messages in the pool
    let all_message_names: Vec<String> = descriptor_pool
        .all_messages()
        .map(|m| m.full_name().to_string())
        .collect();
    
    // Debug: log all available enums in the pool
    let all_enum_names: Vec<String> = descriptor_pool
        .all_enums()
        .map(|e| e.full_name().to_string())
        .collect();
    
    eprintln!("[proto_parser] Available messages: {:?}", all_message_names);
    eprintln!("[proto_parser] Available enums: {:?}", all_enum_names);
    
    if all_message_names.is_empty() {
        warnings.push("No message types found in descriptor pool".to_string());
    }

    for service in services.iter_mut() {
        for method in service.methods.iter_mut() {
            let descriptor = find_message_descriptor(
                descriptor_pool,
                service.package_name.as_deref(),
                &method.input_type,
            );

            let Some(message_desc) = descriptor else {
                warnings.push(format!(
                    "Descriptor not found for '{}' (service package: {:?}). Available types: {:?}",
                    method.input_type,
                    service.package_name,
                    all_message_names.iter().take(10).collect::<Vec<_>>()
                ));
                continue;
            };

            let sample_value = generate_sample_json(message_desc, 0);
            match serde_json::to_string_pretty(&sample_value) {
                Ok(sample_json) => {
                    method.sample_request = Some(sample_json);
                }
                Err(err) => warnings.push(format!(
                    "Failed to serialize sample for message '{}': {}",
                    method.input_type, err
                )),
            }
        }
    }
}

fn find_message_descriptor<'a>(
    pool: &'a DescriptorPool,
    package: Option<&str>,
    type_name: &str,
) -> Option<MessageDescriptor> {
    let trimmed = type_name.trim_start_matches('.');

    // First try exact match with full name
    for message in pool.all_messages() {
        if message.full_name() == trimmed {
            return Some(message);
        }
    }

    // Try with service package prefix
    if let Some(pkg) = package {
        let qualified = format!("{}.{}", pkg, trimmed);
        for message in pool.all_messages() {
            if message.full_name() == qualified {
                return Some(message);
            }
        }
    }

    // Try matching just the type name part for cross-package references
    // e.g., "models.User" should match message with full_name "models.User"
    // This handles cases where input_type already includes package prefix
    if trimmed.contains('.') {
        // The type_name already has a package prefix (like "models.User")
        // It might be relative or absolute
        for message in pool.all_messages() {
            // Try exact match
            if message.full_name() == trimmed {
                return Some(message);
            }
            // Try suffix match (in case it's a relative reference)
            if message.full_name().ends_with(&format!(".{}", trimmed)) {
                return Some(message);
            }
        }
    }

    // Fallback: simple name match (only if unambiguous)
    let simple_name = trimmed.split('.').last().unwrap_or(trimmed);
    let mut simple_match = None;

    for message in pool.all_messages() {
        if message.name() == simple_name {
            if simple_match.is_some() {
                // Ambiguous - multiple messages with same simple name
                return None;
            }
            simple_match = Some(message);
        }
    }

    simple_match
}

fn generate_sample_json(message: MessageDescriptor, depth: usize) -> Value {
    if depth >= MAX_SAMPLE_DEPTH {
        return Value::Object(Map::new());
    }

    let mut object = Map::new();

    for field in message.fields() {
        object.insert(
            field.json_name().to_string(),
            default_value_for_field(&field, depth + 1),
        );
    }

    Value::Object(object)
}

fn default_value_for_field(field: &FieldDescriptor, depth: usize) -> Value {
    if field.is_list() {
        return Value::Array(Vec::new());
    }

    if field.is_map() {
        return Value::Object(Map::new());
    }

    use prost_reflect::Kind;

    match field.kind() {
        Kind::Double | Kind::Float => Value::Number(serde_json::Number::from_f64(0.0).unwrap()),
        Kind::Int32
        | Kind::Int64
        | Kind::Uint32
        | Kind::Uint64
        | Kind::Sint32
        | Kind::Sint64
        | Kind::Fixed32
        | Kind::Fixed64
        | Kind::Sfixed32
        | Kind::Sfixed64 => Value::Number(serde_json::Number::from(0)),
        Kind::Bool => Value::Bool(false),
        Kind::String => Value::String(String::new()),
        Kind::Bytes => Value::String("base64_encoded_bytes".to_string()),
        Kind::Enum(enum_desc) => enum_desc
            .values()
            .next()
            .map(|value| Value::String(value.name().to_string()))
            .unwrap_or_else(|| Value::Number(serde_json::Number::from(0))),
        Kind::Message(message_desc) => generate_sample_json(message_desc, depth),
    }
}

/// Compile proto files from import paths and return descriptor pool
/// This is used when making gRPC calls with import paths instead of proto content
pub fn compile_proto_from_paths(import_paths: Vec<ImportPath>) -> Result<DescriptorPool, String> {
    let mut warnings = Vec::new();
    
    let enabled_imports: Vec<ImportPath> = import_paths
        .into_iter()
        .filter(|p| p.enabled)
        .collect();

    if enabled_imports.is_empty() {
        return Err("No enabled import paths".to_string());
    }

    let proto_paths = discover_proto_files(&enabled_imports, &mut warnings);

    if proto_paths.is_empty() {
        return Err("No .proto files found in import paths".to_string());
    }

    let mut errors = Vec::new();
    let proto_files = read_proto_files(&proto_paths, &mut errors);

    if !errors.is_empty() {
        return Err(format!("Failed to read proto files: {:?}", errors));
    }

    compile_proto_bundle(&proto_files, &enabled_imports)
}

// Proto file parsing with import resolution
// Multi-phase parsing: discovery → dependency graph → validation → topological parse
