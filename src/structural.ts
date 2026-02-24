import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";
import * as chokidar from "chokidar";

export class StructuralIndexer {
  private services: Map<string, ts.LanguageService> = new Map();
  private projectRoots: string[] = [];
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  public async initialize() {
    const tsconfigs = await this.findTsConfigs(this.workspaceRoot);
    console.error(`Found ${tsconfigs.length} TypeScript projects for Structural Indexing.`);
    for (const configPath of tsconfigs) {
      this.createServiceForProject(configPath);
    }
  }

  private async findTsConfigs(dir: string): Promise<string[]> {
    const results: string[] = [];
    let list: fs.Dirent[];
    try {
      list = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (e) {
      return results;
    }
    
    for (const file of list) {
      if (file.isDirectory()) {
        if (["node_modules", ".git", "dist", "build", "coverage"].includes(file.name)) continue;
        results.push(...await this.findTsConfigs(path.join(dir, file.name)));
      } else if (file.name === "tsconfig.json") {
        results.push(path.join(dir, file.name));
      }
    }
    return results;
  }

  private createServiceForProject(configPath: string) {
    const projectDir = path.dirname(configPath);
    const parsedCommandLine = ts.getParsedCommandLineOfConfigFile(
      configPath,
      {},
      {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: () => {},
      } as any
    );

    if (!parsedCommandLine) return;

    const files: Record<string, { version: number }> = {};
    parsedCommandLine.fileNames.forEach((fileName) => {
      files[fileName] = { version: 0 };
    });

    chokidar.watch(projectDir, {
      ignored: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**", "**/coverage/**"],
      ignoreInitial: true,
    }).on("all", (event, filePath) => {
      const absPath = path.resolve(filePath);
      if (files[absPath]) {
        files[absPath].version++;
      } else if (/\.(ts|tsx|js|jsx)$/.test(absPath)) {
        files[absPath] = { version: 0 };
      }
    });

    const servicesHost: ts.LanguageServiceHost = {
      getScriptFileNames: () => Object.keys(files),
      getScriptVersion: (fileName) => (files[fileName] && files[fileName].version.toString()) || "0",
      getScriptSnapshot: (fileName) => {
        if (!fs.existsSync(fileName)) {
          return undefined;
        }
        return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName, "utf8"));
      },
      getCurrentDirectory: () => projectDir,
      getCompilationSettings: () => parsedCommandLine.options,
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
    };

    const service = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());
    this.services.set(projectDir, service);
    this.projectRoots.push(projectDir);
    // Sort project roots so that deeper, more specific ones match first
    this.projectRoots.sort((a, b) => b.length - a.length);
    console.error(`Initialized Language Service for project at ${projectDir}`);
  }

  private getServiceForFile(filePath: string): ts.LanguageService | undefined {
    const absoluteFilePath = path.resolve(filePath);
    for (const root of this.projectRoots) {
      if (absoluteFilePath.startsWith(root)) {
        return this.services.get(root);
      }
    }
    return undefined;
  }

  private convertPosition(service: ts.LanguageService, filePath: string, line: number, char: number): number {
    const sourceFile = service.getProgram()?.getSourceFile(filePath);
    if (!sourceFile) throw new Error("Source file not found in TS program");
    return sourceFile.getPositionOfLineAndCharacter(line - 1, char - 1);
  }

  private positionToLineChar(service: ts.LanguageService, filePath: string, pos: number) {
    const sourceFile = service.getProgram()?.getSourceFile(filePath);
    if (!sourceFile) return { line: -1, character: -1 };
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
    return { line: line + 1, character: character + 1 };
  }

  public getDefinition(filePath: string, line: number, character: number) {
    const absolutePath = path.resolve(filePath);
    const service = this.getServiceForFile(absolutePath);
    if (!service) throw new Error("File not in any known TypeScript project");
    const pos = this.convertPosition(service, absolutePath, line, character);
    const defs = service.getDefinitionAtPosition(absolutePath, pos);
    
    // Map output to include line and character
    return (defs || []).map(def => {
      const { line, character } = this.positionToLineChar(service, def.fileName, def.textSpan.start);
      return {
        fileName: def.fileName,
        line,
        character,
        kind: def.kind,
        name: def.name,
        containerName: def.containerName
      };
    });
  }

  public getReferences(filePath: string, line: number, character: number) {
    const absolutePath = path.resolve(filePath);
    const service = this.getServiceForFile(absolutePath);
    if (!service) throw new Error("File not in any known TypeScript project");
    const pos = this.convertPosition(service, absolutePath, line, character);
    const refs = service.getReferencesAtPosition(absolutePath, pos);
    
    return (refs || []).map(ref => {
      const { line, character } = this.positionToLineChar(service, ref.fileName, ref.textSpan.start);
      return {
        fileName: ref.fileName,
        line,
        character,
        isWriteAccess: ref.isWriteAccess,
        isDefinition: (ref as any).isDefinition
      };
    });
  }

  public getFileStructure(filePath: string) {
    const absolutePath = path.resolve(filePath);
    const service = this.getServiceForFile(absolutePath);
    if (!service) throw new Error("File not in any known TypeScript project");
    const navItems = service.getNavigationBarItems(absolutePath);
    
    const formatItem = (item: ts.NavigationBarItem): any => {
      const startPos = item.spans && item.spans.length > 0 && item.spans[0] ? item.spans[0].start : 0;
      const { line, character } = this.positionToLineChar(service, absolutePath, startPos);
      const result: any = {
        text: item.text,
        kind: item.kind,
        line,
        character
      };
      if (item.childItems && item.childItems.length > 0) {
        result.children = item.childItems.map(formatItem);
      }
      return result;
    };
    
    return navItems.map(formatItem);
  }
}
