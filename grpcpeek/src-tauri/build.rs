fn main() {
  // For dynamic proto loading, we don't need to compile protos at build time
  // This can be extended later if we need to include specific protos
  tauri_build::build()
}
