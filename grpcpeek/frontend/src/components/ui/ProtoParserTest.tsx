/**
 * ProtoParserTest - Standalone test component for the new proto parser
 * 
 * To use: Import and add <ProtoParserTest /> to App.tsx
 * Remove after testing is complete
 */

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button, Card } from './index';
import type { ImportPath, ProtoParseResult } from '../../types/workspace';

export function ProtoParserTest() {
  const [result, setResult] = useState<ProtoParseResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const importPaths: ImportPath[] = [
        {
          id: 'test-1',
          path: 'C:\\DATA\\Projects\\gRPCpeek\\test-data',
          type: 'directory',
          enabled: true,
        }
      ];

      const parseResult = await invoke<ProtoParseResult>('parse_proto_files', {
        importPaths
      });

      setResult(parseResult);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Proto Parser Test</h2>
        <p className="text-sm text-muted-foreground">
          Tests the new multi-phase proto parser with import resolution
        </p>
      </div>

      <Button onClick={runTest} disabled={isLoading}>
        {isLoading ? 'Testing...' : 'Run Parser Test'}
      </Button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              result.success 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}>
              {result.success ? '✓ Success' : '✗ Failed'}
            </span>
            <span className="text-sm text-muted-foreground">
              Found {result.services.length} service{result.services.length !== 1 ? 's' : ''}
            </span>
          </div>

          {result.warnings.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Warnings:</h3>
              {result.warnings.map((warning, i) => (
                <div key={i} className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
                  ⚠ {warning}
                </div>
              ))}
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Errors:</h3>
              {result.errors.map((err, i) => (
                <div key={i} className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                  <div><strong>{err.file}:</strong> {err.message}</div>
                  {err.suggestion && (
                    <div className="text-xs">→ {err.suggestion}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {result.services.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Services:</h3>
              {result.services.map((service, i) => (
                <div key={i} className="rounded-lg border border-border/60 bg-surface p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-mono font-semibold">{service.name}</h4>
                    {service.sourceProto && (
                      <span className="text-xs text-muted-foreground">
                        {service.sourceProto}
                      </span>
                    )}
                  </div>
                  {service.packageName && (
                    <div className="text-xs text-muted-foreground">
                      package: {service.packageName}
                    </div>
                  )}
                  <div className="space-y-1">
                    {service.methods.map((method, j) => (
                      <div key={j} className="rounded bg-surface-muted/30 p-2 text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{method.name}</span>
                          <span className="rounded bg-surface-emphasis px-1.5 py-0.5 text-[10px] text-surface-contrast">
                            {method.methodType}
                          </span>
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {method.inputType} → {method.outputType}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
