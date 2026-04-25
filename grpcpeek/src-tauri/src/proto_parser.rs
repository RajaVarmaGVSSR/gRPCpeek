use prost::Message as ProstMessage;
use prost_reflect::{DescriptorPool, FieldDescriptor, MessageDescriptor};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tempfile::NamedTempFile;
use walkdir::WalkDir;

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

/// Parse proto files from import paths, generate sample requests, and return the compiled
/// descriptor pool so callers can cache it and skip recompilation on subsequent gRPC calls.
pub fn parse_proto_files(import_paths: Vec<ImportPath>) -> (ProtoParseResult, Option<DescriptorPool>) {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    let enabled: Vec<ImportPath> = import_paths.into_iter().filter(|p| p.enabled).collect();

    if enabled.is_empty() {
        errors.push(ProtoParseError {
            file: "workspace".to_string(),
            message: "All import paths are disabled".to_string(),
            suggestion: Some("Enable at least one proto import path".to_string()),
        });
        return (ProtoParseResult { success: false, services: vec![], errors, warnings }, None);
    }

    let proto_paths = discover_proto_files(&enabled, &mut warnings);

    if proto_paths.is_empty() {
        errors.push(ProtoParseError {
            file: "workspace".to_string(),
            message: "No .proto files found in the configured import paths".to_string(),
            suggestion: Some("Add directories or files that contain proto definitions".to_string()),
        });
        return (ProtoParseResult { success: false, services: vec![], errors, warnings }, None);
    }

    let proto_files = read_proto_files(&proto_paths, &mut errors);

    if proto_files.is_empty() {
        return (ProtoParseResult { success: false, services: vec![], errors, warnings }, None);
    }

    let mut services = extract_services(&proto_files, &mut warnings);

    let pool = match compile_with_protox(&proto_files, &enabled) {
        Ok(pool) => {
            enrich_with_samples(&mut services, &pool, &mut warnings);
            Some(pool)
        }
        Err(err) => {
            errors.push(ProtoParseError {
                file: "protox".to_string(),
                message: err.clone(),
                suggestion: Some("Check that import paths are correct and proto files are valid".to_string()),
            });
            warnings.push(format!(
                "Sample request generation degraded: {}. Falling back to regex-based stubs.",
                err
            ));
            None
        }
    };

    // Regex-based fallback for any methods still missing a sample
    generate_stub_samples(&mut services, &proto_files, &mut warnings);

    services.sort_by(|a, b| {
        a.package_name.cmp(&b.package_name)
            .then_with(|| a.name.cmp(&b.name))
    });
    for service in &mut services {
        service.methods.sort_by(|a, b| a.name.cmp(&b.name));
    }

    let success = errors.is_empty() || !services.is_empty();
    (ProtoParseResult { success, services, errors, warnings }, pool)
}

/// Compile a descriptor pool from import paths. Used by gRPC call commands when
/// the pool is not already cached in application state.
pub fn compile_descriptor_pool(import_paths: &[ImportPath]) -> Result<DescriptorPool, String> {
    let enabled: Vec<ImportPath> = import_paths.iter().filter(|p| p.enabled).cloned().collect();

    if enabled.is_empty() {
        return Err("No enabled import paths".to_string());
    }

    let mut warnings = Vec::new();
    let proto_paths = discover_proto_files(&enabled, &mut warnings);

    if proto_paths.is_empty() {
        return Err("No .proto files found in import paths".to_string());
    }

    let mut errors = Vec::new();
    let proto_files = read_proto_files(&proto_paths, &mut errors);

    if !errors.is_empty() {
        return Err(format!("Failed to read proto files: {:?}", errors));
    }

    compile_with_protox(&proto_files, &enabled)
}

/// Compile a descriptor pool from raw proto file content (single-file legacy path).
pub fn compile_single_file(proto_content: &str) -> Result<DescriptorPool, String> {
    let proto_content = proto_content.trim_start_matches('\u{FEFF}');
    const MAX_PROTO_BYTES: usize = 5 * 1024 * 1024; // 5 MB
    if proto_content.len() > MAX_PROTO_BYTES {
        return Err(format!(
            "Proto content too large ({} bytes). Maximum allowed is {} bytes.",
            proto_content.len(),
            MAX_PROTO_BYTES
        ));
    }

    let mut temp_file = NamedTempFile::with_suffix(".proto")
        .map_err(|e| format!("Failed to create temp proto file: {}", e))?;
    temp_file
        .write_all(proto_content.as_bytes())
        .map_err(|e| format!("Failed to write proto content: {}", e))?;
    // Flush ensures the kernel write buffer is flushed before protox reads the file.
    temp_file
        .flush()
        .map_err(|e| format!("Failed to flush proto content: {}", e))?;

    let proto_path = temp_file.path().to_path_buf();
    let proto_dir = proto_path
        .parent()
        .ok_or("Failed to get proto file directory")?;
    let file_name = proto_path
        .file_name()
        .ok_or("Failed to get proto filename")?
        .to_string_lossy()
        .to_string();

    // temp_file must stay alive until protox finishes reading it
    let fds = protox::compile(vec![file_name.as_str()], vec![proto_dir])
        .map_err(|e| format!("Proto compilation failed: {:?}", e))?;

    drop(temp_file);

    let bytes = fds.encode_to_vec();
    DescriptorPool::decode(bytes.as_slice())
        .map_err(|e| format!("Failed to decode descriptor pool: {}", e))
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

fn compile_with_protox(
    proto_files: &[(PathBuf, String)],
    import_paths: &[ImportPath],
) -> Result<DescriptorPool, String> {
    // Build deduplicated include directories from configured import paths
    let mut seen = HashSet::new();
    let mut include_dirs: Vec<PathBuf> = import_paths
        .iter()
        .filter_map(|p| {
            let path = Path::new(&p.path);
            if path.is_dir() {
                Some(path.to_path_buf())
            } else {
                path.parent().map(|parent| parent.to_path_buf())
            }
        })
        .filter(|p| seen.insert(p.clone()))
        .collect();

    // Some projects store vendor protos in subdirectories (e.g. google/type/money.proto
    // living under proto/parent/google/type/money.proto). Scan for any import statements
    // that don't resolve under the current include dirs and add the missing parent dirs.
    for extra in find_extra_include_dirs(proto_files, &include_dirs, import_paths) {
        if seen.insert(extra.clone()) {
            include_dirs.push(extra);
        }
    }

    // Write all proto files to a temp directory using the in-memory content (already
    // BOM-stripped). protox::compile reads from disk, so we must give it clean files.
    let temp_dir = tempfile::TempDir::new()
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    let mut service_files: Vec<String> = Vec::new();

    for (path, content) in proto_files {
        if let Some(rel) = relative_to_include_dir(path, &include_dirs) {
            let dest = temp_dir.path().join(&rel);
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create temp directory structure: {}", e))?;
            }
            std::fs::write(&dest, content.as_bytes())
                .map_err(|e| format!("Failed to write temp proto file: {}", e))?;
            if has_service_definition(content) {
                service_files.push(rel);
            }
        }
    }

    if service_files.is_empty() {
        return Err("No proto files with service definitions found".to_string());
    }

    let fds = protox::compile(&service_files, &[temp_dir.path()])
        .map_err(|e| format!("Proto compilation failed: {:?}", e))?;

    let bytes = fds.encode_to_vec();
    DescriptorPool::decode(bytes.as_slice())
        .map_err(|e| format!("Failed to decode descriptor pool: {}", e))
}

/// For each import statement that cannot be satisfied by any of `include_dirs`,
/// walk the configured import path directories looking for a subdirectory that
/// would resolve the import. Returns the extra parent directories to add.
fn find_extra_include_dirs(
    proto_files: &[(PathBuf, String)],
    include_dirs: &[PathBuf],
    import_paths: &[ImportPath],
) -> Vec<PathBuf> {
    let import_re = Regex::new(r#"import\s+"([^"]+)";"#).expect("valid import regex");

    // Collect all import statements from proto file contents
    let all_imports: HashSet<String> = proto_files
        .iter()
        .flat_map(|(_, content)| {
            import_re
                .captures_iter(content)
                .filter_map(|cap| cap.get(1).map(|m| m.as_str().to_string()))
        })
        .collect();

    let mut extra: Vec<PathBuf> = Vec::new();
    let mut seen: HashSet<PathBuf> = include_dirs.iter().cloned().collect();

    for import_stmt in &all_imports {
        // Already resolvable — nothing to do
        if include_dirs.iter().any(|d| d.join(import_stmt).exists()) {
            continue;
        }
        if extra.iter().any(|d| d.join(import_stmt).exists()) {
            continue;
        }

        // Find the first path component so we can search for a matching directory
        let first = match import_stmt.split('/').next() {
            Some(s) if !s.is_empty() => s,
            _ => continue,
        };

        'outer: for ip in import_paths {
            let root = Path::new(&ip.path);
            if !root.is_dir() {
                continue;
            }
            for entry in WalkDir::new(root).max_depth(5).into_iter().filter_map(|e| e.ok()) {
                if entry.file_type().is_dir()
                    && entry.file_name().to_str() == Some(first)
                {
                    if let Some(parent) = entry.path().parent() {
                        if parent.join(import_stmt).exists() && seen.insert(parent.to_path_buf()) {
                            extra.push(parent.to_path_buf());
                            break 'outer;
                        }
                    }
                }
            }
        }
    }

    extra
}

fn discover_proto_files(import_paths: &[ImportPath], warnings: &mut Vec<String>) -> Vec<PathBuf> {
    let mut results = Vec::new();
    let mut seen = HashSet::new();

    for import in import_paths {
        let candidate = Path::new(&import.path);

        if !candidate.exists() {
            warnings.push(format!("Import path '{}' does not exist", import.path));
            continue;
        }

        if candidate.is_file() {
            if is_proto_file(candidate) {
                if seen.insert(candidate.to_path_buf()) {
                    results.push(candidate.to_path_buf());
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
        for entry in WalkDir::new(candidate).max_depth(20).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() && is_proto_file(entry.path()) {
                found_any = true;
                let p = entry.path().to_path_buf();
                if seen.insert(p.clone()) {
                    results.push(p);
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
            Ok(content) => {
                    let content = content.trim_start_matches('\u{FEFF}').to_string();
                    result.push((path.clone(), content));
                }
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
    let service_re = Regex::new(r"service\s+(\w+)\s*\{([\s\S]*?)\}").expect("valid service regex");
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

            let body = service_cap.get(2).map(|m| m.as_str()).unwrap_or("");

            let mut methods = Vec::new();
            for rpc_cap in rpc_re.captures_iter(body) {
                let is_client_streaming = rpc_cap.get(2).is_some();
                let is_server_streaming = rpc_cap.get(4).is_some();
                let method_type = match (is_client_streaming, is_server_streaming) {
                    (false, false) => "unary",
                    (false, true) => "server_streaming",
                    (true, false) => "client_streaming",
                    (true, true) => "bidirectional_streaming",
                }
                .to_string();

                methods.push(Method {
                    name: rpc_cap.get(1).map(|m| m.as_str().to_string()).unwrap_or_default(),
                    input_type: rpc_cap.get(3).map(|m| m.as_str().to_string()).unwrap_or_default(),
                    output_type: rpc_cap.get(5).map(|m| m.as_str().to_string()).unwrap_or_default(),
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
    let re = Regex::new(r"package\s+([A-Za-z0-9_.]+)\s*;").ok()?;
    re.captures(content)
        .and_then(|cap| cap.get(1))
        .map(|m| m.as_str().to_string())
}

fn has_service_definition(content: &str) -> bool {
    let re = Regex::new(r"service\s+\w+\s*\{").expect("valid service regex");
    re.is_match(content)
}

/// Return the path of `file` relative to one of the `roots`, normalising path
/// separators so the result can be passed to protox as a file name.
fn relative_to_include_dir(file: &Path, roots: &[PathBuf]) -> Option<String> {
    let file_str = file.to_string_lossy();
    let file_norm = file_str.trim_start_matches(r"\\?\");

    for root in roots {
        let root_str = root.to_string_lossy();
        let root_norm = root_str.trim_start_matches(r"\\?\");

        if let Some(rel) = file_norm.strip_prefix(root_norm) {
            let trimmed = rel.trim_start_matches(['/', '\\']);
            if !trimmed.is_empty() {
                return Some(trimmed.replace('\\', "/"));
            }
        }

        if let Ok(rel) = file.strip_prefix(root) {
            let s = rel.to_string_lossy();
            if !s.is_empty() {
                return Some(s.replace('\\', "/"));
            }
        }
    }
    None
}

fn enrich_with_samples(
    services: &mut [Service],
    pool: &DescriptorPool,
    warnings: &mut Vec<String>,
) {
    for service in services.iter_mut() {
        for method in service.methods.iter_mut() {
            let descriptor = find_message_descriptor(
                pool,
                service.package_name.as_deref(),
                &method.input_type,
            );

            match descriptor {
                Some(msg_desc) => {
                    match serde_json::to_string_pretty(&generate_sample_json(msg_desc, 0)) {
                        Ok(json) => method.sample_request = Some(json),
                        Err(e) => warnings.push(format!(
                            "Failed to serialize sample for '{}': {}",
                            method.input_type, e
                        )),
                    }
                }
                None => warnings.push(format!(
                    "Descriptor not found for '{}' (service package: {:?})",
                    method.input_type, service.package_name
                )),
            }
        }
    }
}

fn find_message_descriptor(
    pool: &DescriptorPool,
    package: Option<&str>,
    type_name: &str,
) -> Option<MessageDescriptor> {
    let trimmed = type_name.trim_start_matches('.');

    // Exact full-name match
    if let Some(m) = pool.get_message_by_name(trimmed) {
        return Some(m);
    }

    // With service package prefix
    if let Some(pkg) = package {
        let qualified = format!("{}.{}", pkg, trimmed);
        if let Some(m) = pool.get_message_by_name(&qualified) {
            return Some(m);
        }
    }

    // Suffix match for cross-package references
    if trimmed.contains('.') {
        for message in pool.all_messages() {
            if message.full_name().ends_with(&format!(".{}", trimmed)) {
                return Some(message);
            }
        }
    }

    // Unambiguous simple-name match
    let simple = trimmed.split('.').last().unwrap_or(trimmed);
    let mut found = None;
    for message in pool.all_messages() {
        if message.name() == simple {
            if found.is_some() {
                return None; // ambiguous
            }
            found = Some(message);
        }
    }
    found
}

fn generate_sample_json(message: MessageDescriptor, depth: usize) -> Value {
    if depth >= MAX_SAMPLE_DEPTH {
        return Value::Object(Map::new());
    }

    let mut object = Map::new();
    let mut seen_oneofs: HashSet<String> = HashSet::new();

    for field in message.fields() {
        // For oneof groups emit only the first variant so the sample is valid proto3 JSON
        if let Some(oneof) = field.containing_oneof() {
            if !seen_oneofs.insert(oneof.name().to_string()) {
                continue;
            }
        }
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
        Kind::Double | Kind::Float => {
            Value::Number(serde_json::Number::from_f64(0.0).unwrap())
        }
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
        Kind::Bytes => Value::String(String::new()),
        Kind::Enum(enum_desc) => enum_desc
            .values()
            .next()
            .map(|v| Value::String(v.name().to_string()))
            .unwrap_or_else(|| Value::Number(serde_json::Number::from(0))),
        Kind::Message(msg_desc) => well_known_sample(&msg_desc)
            .unwrap_or_else(|| generate_sample_json(msg_desc, depth)),
    }
}

/// Return a correctly-shaped JSON value for proto well-known types.
/// Returns None for ordinary messages so the caller recurses normally.
fn well_known_sample(msg: &MessageDescriptor) -> Option<Value> {
    match msg.full_name() {
        "google.protobuf.Timestamp" => Some(Value::String("1970-01-01T00:00:00Z".into())),
        "google.protobuf.Duration" => Some(Value::String("0s".into())),
        "google.protobuf.Any" => Some(serde_json::json!({
            "@type": "type.googleapis.com/package.MessageName"
        })),
        "google.protobuf.FieldMask" => Some(Value::String("field1,field2".into())),
        "google.protobuf.Struct" => Some(Value::Object(Map::new())),
        "google.protobuf.Value" => Some(Value::Null),
        "google.protobuf.ListValue" => Some(Value::Array(vec![])),
        "google.protobuf.StringValue" | "google.protobuf.BytesValue" => {
            Some(Value::String(String::new()))
        }
        "google.protobuf.Int32Value"
        | "google.protobuf.Int64Value"
        | "google.protobuf.UInt32Value"
        | "google.protobuf.UInt64Value" => Some(Value::Number(serde_json::Number::from(0))),
        "google.protobuf.FloatValue" | "google.protobuf.DoubleValue" => {
            Some(Value::Number(serde_json::Number::from_f64(0.0).unwrap()))
        }
        "google.protobuf.BoolValue" => Some(Value::Bool(false)),
        _ => None,
    }
}

/// Regex-based fallback: generate stub samples for methods that still have none.
/// Less accurate than descriptor-driven generation but works when protox compilation fails.
fn generate_stub_samples(
    services: &mut [Service],
    proto_files: &[(PathBuf, String)],
    warnings: &mut Vec<String>,
) {
    let field_re = Regex::new(
        r"(?:repeated\s+|optional\s+)?(?:double|float|int32|int64|uint32|uint64|sint32|sint64|fixed32|fixed64|sfixed32|sfixed64|bool|string|bytes|[A-Za-z0-9_.]+)\s+(\w+)\s*=",
    )
    .expect("valid field regex");

    let mut message_fields: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    for (_path, content) in proto_files {
        for (msg_name, body) in extract_message_bodies(content) {
            let fields: Vec<String> = field_re
                .captures_iter(&body)
                .filter_map(|fc| fc.get(1).map(|m| m.as_str().to_string()))
                .collect();
            message_fields.entry(msg_name).or_default().extend(fields);
        }
    }

    let mut stub_count = 0;
    for service in services.iter_mut() {
        for method in service.methods.iter_mut() {
            if method.sample_request.is_some() {
                continue;
            }
            let simple = method.input_type.split('.').last().unwrap_or(&method.input_type);
            let mut obj = Map::new();
            if let Some(fields) = message_fields.get(simple) {
                for field_name in fields {
                    obj.insert(to_camel_case(field_name), Value::String(String::new()));
                }
            }
            if let Ok(json) = serde_json::to_string_pretty(&Value::Object(obj)) {
                method.sample_request = Some(json);
                stub_count += 1;
            }
        }
    }

    if stub_count > 0 {
        warnings.push(format!(
            "{} method(s) used regex-based stub samples (protox compilation unavailable)",
            stub_count
        ));
    }
}

/// Extract all top-level message bodies from a proto file, handling nested blocks
/// (oneof, map entries, nested messages) correctly by counting braces.
fn extract_message_bodies(content: &str) -> Vec<(String, String)> {
    let message_start_re =
        Regex::new(r"message\s+(\w+)\s*\{").expect("valid message start regex");
    let mut result = Vec::new();

    for cap in message_start_re.captures_iter(content) {
        let name = cap.get(1).unwrap().as_str().to_string();
        let body_start = cap.get(0).unwrap().end(); // position after the opening '{'

        let mut depth: i32 = 1;
        let mut body_end = body_start;
        for ch in content[body_start..].chars() {
            match ch {
                '{' => depth += 1,
                '}' => {
                    depth -= 1;
                    if depth == 0 {
                        break;
                    }
                }
                _ => {}
            }
            body_end += ch.len_utf8();
        }

        result.push((name, content[body_start..body_end].to_string()));
    }

    result
}

fn to_camel_case(s: &str) -> String {
    let mut result = String::new();
    let mut next_upper = false;
    for ch in s.chars() {
        if ch == '_' {
            next_upper = true;
        } else if next_upper {
            result.extend(ch.to_uppercase());
            next_upper = false;
        } else {
            result.push(ch);
        }
    }
    result
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_test_server_protos() {
        let import_paths = vec![ImportPath {
            id: "test-1".to_string(),
            path: concat!(env!("CARGO_MANIFEST_DIR"), "/../../test-server/proto").to_string(),
            path_type: "directory".to_string(),
            enabled: true,
        }];

        let (result, _pool) = parse_proto_files(import_paths);

        println!("Success: {}", result.success);
        for err in &result.errors {
            println!("  ERROR [{}] {}", err.file, err.message);
        }
        for w in &result.warnings {
            println!("  WARN {}", w);
        }
        for svc in &result.services {
            println!("  Service: {} (package: {:?})", svc.name, svc.package_name);
            for method in &svc.methods {
                println!(
                    "    {} ({}) sample={}",
                    method.name,
                    method.method_type,
                    method.sample_request.is_some()
                );
            }
        }

        assert!(result.success, "Parsing should succeed");
        assert!(!result.services.is_empty(), "Should find services");

        let missing: Vec<_> = result
            .services
            .iter()
            .flat_map(|s| {
                s.methods.iter().filter(|m| m.sample_request.is_none()).map(move |m| {
                    format!("{}.{} (input: {})", s.name, m.name, m.input_type)
                })
            })
            .collect();
        assert!(missing.is_empty(), "Methods missing samples:\n  {}", missing.join("\n  "));
    }

    #[test]
    fn test_oneof_sample_has_single_variant() {
        let proto = r#"
syntax = "proto3";
package test;

service Svc { rpc Do (Req) returns (Req); }

message Req {
  oneof payload {
    string text = 1;
    int32 number = 2;
  }
  string name = 3;
}
"#;
        let pool = compile_single_file(proto).expect("compile should succeed");
        let msg = pool.get_message_by_name("test.Req").expect("Req should exist");
        let sample = generate_sample_json(msg, 0);
        let obj = sample.as_object().expect("should be object");

        // "name" must be present; exactly one of text/number should appear (not both)
        assert!(obj.contains_key("name"), "non-oneof field should be present");
        let has_text = obj.contains_key("text");
        let has_number = obj.contains_key("number");
        assert!(
            has_text ^ has_number,
            "exactly one oneof variant should appear, got text={} number={}",
            has_text,
            has_number
        );
    }

    #[test]
    fn test_stub_fallback_generates_samples() {
        let proto_content = r#"
syntax = "proto3";
package test;

service TestService {
  rpc DoSomething (DoRequest) returns (DoResponse);
}

message DoRequest {
  string name = 1;
  int32 count = 2;
  bool active = 3;
}

message DoResponse { string result = 1; }
"#;
        let proto_files = vec![(PathBuf::from("test.proto"), proto_content.to_string())];
        let mut services = vec![Service {
            name: "TestService".to_string(),
            package_name: Some("test".to_string()),
            methods: vec![Method {
                name: "DoSomething".to_string(),
                input_type: "DoRequest".to_string(),
                output_type: "DoResponse".to_string(),
                is_client_streaming: false,
                is_server_streaming: false,
                method_type: "unary".to_string(),
                sample_request: None,
            }],
            source_proto: None,
        }];

        let mut warnings = Vec::new();
        generate_stub_samples(&mut services, &proto_files, &mut warnings);

        let sample = services[0].methods[0]
            .sample_request
            .as_ref()
            .expect("stub should generate a sample");
        let parsed: Value = serde_json::from_str(sample).expect("valid JSON");
        let obj = parsed.as_object().expect("object");
        assert!(obj.contains_key("name"));
        assert!(obj.contains_key("count"));
        assert!(obj.contains_key("active"));
    }
}
