import * as vscode from 'vscode';
import { normalize, join } from 'path';
import { ReadStream } from 'fs';
import { IXmlSchemaProperties, languageId, globalSettings } from './extension';

export default class XmlLinterProvider implements vscode.Disposable {

    private static readonly saxPath = normalize(join(__dirname, '..', 'lib/sax'));

    private documentListener: vscode.Disposable;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private schemaPropertiesArray: Array<IXmlSchemaProperties>;

    constructor(private context: vscode.ExtensionContext, schemaPropertiesArray: Array<IXmlSchemaProperties>) {
        this.schemaPropertiesArray = schemaPropertiesArray;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection();

        this.documentListener = vscode.workspace.onDidChangeTextDocument(evnt => this.triggerLint(evnt.document), this, this.context.subscriptions);

        vscode.workspace.onDidOpenTextDocument(doc => this.triggerLint(doc), this, context.subscriptions);
        vscode.workspace.onDidCloseTextDocument(doc => this.cleanupDocument(doc), null, context.subscriptions);

        vscode.workspace.textDocuments.forEach(doc => this.triggerLint(doc), this);
    }

    public dispose() {
        this.documentListener.dispose();
        this.diagnosticCollection.clear();
    }

    private cleanupDocument(textDocument: vscode.TextDocument): void {
        this.diagnosticCollection.delete(textDocument.uri);
    }

    private triggerLint(textDocument: vscode.TextDocument): void {

        if (textDocument.languageId !== languageId) {
            return;
        }

        const sax = require(XmlLinterProvider.saxPath), strict = true, parser = sax.parser(strict);

        const diagnostics: vscode.Diagnostic[] = [];

        parser.onerror = (_err: any) => {
            let position = new vscode.Position(parser.line, parser.column);

            if (undefined === diagnostics.find(e => e.range.start.line === position.line)) {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(position, position), parser.error.message, vscode.DiagnosticSeverity.Error));
            }
            parser.resume();
        };

        parser.onopentag = (node: any) => {

            let schemaProperties = this.schemaPropertiesArray.find(e => undefined !== e.fileUris.find(n => n.toString() === textDocument.uri.toString()));
            if (schemaProperties === undefined) {
                return;
            }

            let position = new vscode.Position(parser.line, parser.column);
            let nodeNameSplitted: Array<string> = node.name.split('.');
            let schemaTagWithAttributes = schemaProperties.tagCollection.find(e => e.tag === nodeNameSplitted[0]);

            if (schemaTagWithAttributes !== undefined) {
                nodeNameSplitted.shift();
                Object.keys(node.attributes).concat(nodeNameSplitted).forEach((a: string) => {
                    if (schemaTagWithAttributes !== undefined && schemaTagWithAttributes.attributes.indexOf(a) < 0 && a.indexOf(":") < 0) {
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
                let newUri = vscode.Uri.parse(attr.value);
                this.loadSchemaContents(newUri, textDocument.uri, () => this.triggerLint(textDocument));
            } else if (attr.name === "xmlns") {
                let newUriString = globalSettings.schemaMapping.filter(m => m.xmlns === attr.value).map(m => m.xsdUri).pop();
                if (newUriString !== undefined) {
                    let newUri = vscode.Uri.parse(newUriString);
                    this.loadSchemaContents(newUri, textDocument.uri, () => this.triggerLint(textDocument));
                }
            }
        };

        parser.onend = () => {
            this.diagnosticCollection.set(textDocument.uri, diagnostics);
        };

        parser.write(textDocument.getText()).close();
    }

    private loadSchemaContents(schemaUri: vscode.Uri, editorFileUri: vscode.Uri, recheck: () => void): void {
        let schemaProperties = this.schemaPropertiesArray.find(e => e.namespaceUri.toString() === schemaUri.toString());
        if (schemaProperties !== undefined) {
            if (undefined === schemaProperties.fileUris.find(fu => fu.toString() === editorFileUri.toString())) {
                schemaProperties.fileUris.push(editorFileUri);
            }
            return;
        }

        schemaProperties = { namespaceUri: schemaUri, xsdContent: ``, fileUris: [editorFileUri], tagCollection: [] } as IXmlSchemaProperties;

        let tagsArray: string[] = [];
        let atttributesArray: string[] = [];
        let content = '';
        let saveTagsAndAttributes = () => {
            tagsArray.forEach(element => {
                if (schemaProperties !== undefined) {
                    schemaProperties.tagCollection.push({ tag: element, attributes: atttributesArray });
                    schemaProperties.xsdContent = content;
                }
            });
            if (schemaProperties !== undefined) {
                this.schemaPropertiesArray.push(schemaProperties);
            }
        };

        const getUri = require('get-uri');

        getUri(schemaUri.toString(true), function (err: any, rs: ReadStream) {
            if (err) {
                vscode.window.showErrorMessage(`Error getting XSD:\n${err.toString()}`);
                return;
            }

            rs.on('data', function (buf: any) {
                content += buf.toString();
            });

            rs.on('end', function () {
                var sax = require(XmlLinterProvider.saxPath), strict = true, parser = sax.parser(strict);

                parser.onopentag = (node: any) => {
                    if (node.name.endsWith(":element") && node.attributes["name"] !== undefined) {
                        tagsArray.push(node.attributes["name"]);
                    }

                    if (node.name.endsWith(":attribute") && node.attributes["name"] !== undefined) {
                        atttributesArray.push(node.attributes["name"]);
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