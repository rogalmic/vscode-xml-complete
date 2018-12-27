import * as vscode from 'vscode';
import { normalize, join } from 'path';
import { ReadStream } from 'fs';

export default class XmlLinterProvider implements vscode.Disposable {

    private static saxPath = normalize(join(__dirname, '..', 'lib/sax'));

    private documentListener: vscode.Disposable;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private tagAttributes: Map<string, Array<string>>;

    constructor(private context: vscode.ExtensionContext, allowedTagAttributes: Map<string, Array<string>>) {
        this.tagAttributes = allowedTagAttributes;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection();

        this.documentListener = vscode.workspace.onDidChangeTextDocument((e) => {
            this.triggerLint(e.document);
        }, this, this.context.subscriptions);

        vscode.workspace.onDidOpenTextDocument(this.triggerLint, this, context.subscriptions);
        vscode.workspace.onDidCloseTextDocument((textDocument) => {
            this.diagnosticCollection.delete(textDocument.uri);
        }, null, context.subscriptions);

        vscode.workspace.textDocuments.forEach(this.triggerLint, this);
    }

    public dispose() {
        this.documentListener.dispose();
        this.diagnosticCollection.clear();
    }

    private triggerLint(textDocument: vscode.TextDocument): void {

        if (textDocument.languageId != "xml") {
            return;
        }

        const sax = require(XmlLinterProvider.saxPath), strict = true, parser = sax.parser(strict);

        const diagnostics: vscode.Diagnostic[] = [];

        parser.onerror = (e: any) => {
            let position = new vscode.Position(parser.line, parser.column);

            if (undefined === diagnostics.find(e => e.range.start.line == position.line)) {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(position, position), parser.error.message, vscode.DiagnosticSeverity.Error));
            }
            parser.resume();
        };

        parser.onopentag = (node: any) => {

            if (this.tagAttributes.size === 0) {
                return;
            }

            let position = new vscode.Position(parser.line, parser.column);
            let nodeNameSplitted: Array<string> = node.name.split('.');
            let schemaTag: Array<string> = this.tagAttributes.get(nodeNameSplitted[0]) || [];

            if (schemaTag.length != 0) {
                nodeNameSplitted.shift();
                Object.keys(node.attributes).concat(nodeNameSplitted).forEach((a: string) => {
                    if (schemaTag.indexOf(a) < 0 && a.indexOf(":") < 0) {
                        diagnostics.push(new vscode.Diagnostic(new vscode.Range(position, position), `Unknown xml attribute '${a}' for tag ${node.name}`, vscode.DiagnosticSeverity.Information));
                    }
                });
            }
            else if (node.name.indexOf(":") < 0) {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(position, position), `Unknown xml tag '${node.name}'`, vscode.DiagnosticSeverity.Information));
            }
        };

        parser.onattribute = (attr: any) => {
            if (attr.name.endsWith(":schemaLocation")) {
                this.loadSchemaContents(attr.value, () => this.triggerLint(textDocument));
            }
        };

        parser.onend = () => {
            this.diagnosticCollection.set(textDocument.uri, diagnostics);
        };

        parser.write(textDocument.getText()).close();
    }

    private schemaUri: string = ''; //TODO many files, recurrence

    private loadSchemaContents(uri: string, recheck: () => void): void {
        if (uri == this.schemaUri) {
            return;
        }
        this.schemaUri = uri;

        let tags: string[] = [];
        let atttributes: string[] = [];
        let saveTagsAndAttributes = () => {
            tags.forEach(element => {
                this.tagAttributes.set(element, atttributes);
            });
        };

        const getUri = require('get-uri');

        getUri(uri, function (err: any, rs: ReadStream) {
            if (err) {
                vscode.window.showErrorMessage(`Error getting XSD:\n${err.toString()}`);
                return;
            }

            let content = '';

            rs.on('data', function (buf: any) {
                content += buf.toString();
            });

            rs.on('end', function () {
                var sax = require(XmlLinterProvider.saxPath), strict = true, parser = sax.parser(strict);

                parser.onopentag = (node: any) => {
                    if (node.name.endsWith(":element") && node.attributes["name"] !== undefined) {
                        tags.push(node.attributes["name"]);
                    }

                    if (node.name.endsWith(":attribute") && node.attributes["name"] !== undefined) {
                        atttributes.push(node.attributes["name"]);
                    }
                };

                parser.onend = () => {
                    saveTagsAndAttributes();
                    recheck();
                };
                try {
                    parser.write(content).close();
                }
                catch (ex) {
                    vscode.window.showErrorMessage(`Error parsing XSD:\n${ex.message}`);
                }

            });
        });
    }
}