// Quick test of the proto parser regex
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const protoContent = fs.readFileSync(path.join(__dirname, '../../test-server/test.proto'), 'utf8');

console.log('Proto file length:', protoContent.length);
console.log('\n--- Testing Parser ---\n');

const services = [];
const serviceRegex = /service\s+(\w+)\s*{([\s\S]*?)}/g;
const rpcRegex = /rpc\s+(\w+)\s*\(\s*(stream\s+)?([A-Za-z0-9_.]+)\s*\)\s+returns\s*\(\s*(stream\s+)?([A-Za-z0-9_.]+)\s*\)/g;

let svcMatch;
while ((svcMatch = serviceRegex.exec(protoContent)) !== null) {
  const svcName = svcMatch[1];
  const svcBody = svcMatch[2];
  const methods = [];

  console.log(`Found service: ${svcName}`);
  console.log(`Service body length: ${svcBody.length}`);

  let rpcMatch;
  while ((rpcMatch = rpcRegex.exec(svcBody)) !== null) {
    const methodName = rpcMatch[1];
    const inputType = rpcMatch[3];
    const outputType = rpcMatch[5];
    console.log(`  - Method: ${methodName}(${inputType}) -> ${outputType}`);
    methods.push({ name: methodName, inputType, outputType });
  }

  services.push({ name: svcName, methods });
}

console.log('\n--- Result ---\n');
console.log(JSON.stringify(services, null, 2));
